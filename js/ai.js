// Gemini API (bring your own key). The key stays in this device's localStorage.
// Model: if the user leaves it empty ("Otomatik"), the app asks Google which models
// this key can use and picks the newest fast "flash" model that supports generateContent.
import { get, save } from './store.js';

const API = 'https://generativelanguage.googleapis.com/v1beta/';

export const hasKey = () => !!get().settings.apiKey?.trim();

function friendly(status, msg, model) {
  if (status === 400 && /API key/i.test(msg)) return 'API anahtarı geçersiz görünüyor.';
  if (status === 403) return 'Bu anahtarın Gemini API izni yok (Google AI Studio\'dan yeni anahtar oluştur).';
  if (status === 404) return `Model bulunamadı: ${model}.`;
  if (status === 429) return 'Kota/limit doldu. Biraz sonra tekrar dene.';
  if (status === 503 || status === 500 || status === 502) return 'Gemini şu an çok yoğun (tüm modeller denendi). Birkaç dakika sonra tekrar dene.';
  return `Gemini hatası (${status}): ${msg}`;
}

async function request(path, init = {}) {
  const key = get().settings.apiKey?.trim();
  if (!key) throw new Error('Önce AI ayarlarına Gemini API anahtarını gir.');
  if (!navigator.onLine) throw new Error('İnternet bağlantısı yok. AI özellikleri çevrimiçi çalışır.');
  const r = await fetch(API + path, { ...init, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, ...(init.headers || {}) } });
  const data = await r.json().catch(() => ({}));
  return { r, data };
}

// ---- model discovery ----
export async function listModels() {
  const out = [];
  let token = '';
  for (let page = 0; page < 5; page++) {
    const { r, data } = await request(`models?pageSize=200${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`);
    if (!r.ok) throw new Error(friendly(r.status, data?.error?.message || r.statusText, '—'));
    out.push(...(data.models || []));
    token = data.nextPageToken; if (!token) break;
  }
  return out
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => ({ id: m.name.replace(/^models\//, ''), name: m.displayName || m.name, desc: m.description || '' }))
    .filter(m => /^gemini/i.test(m.id) && !/embed|image|tts|audio|live|vision|aqa|robotics|computer-use|learnlm/i.test(m.id));
}

export function rankModel(id) {
  const v = parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/i) || [])[1] || '0');
  let score = v * 20;
  if (/flash/i.test(id)) score += 5;          // fast, generous free tier
  else if (/pro|ultra/i.test(id)) score += 2;
  else score += 3;                             // codename models (e.g. gemini-4-xxx)
  if (/lite|nano|8b/i.test(id)) score -= 2;
  if (/preview|exp/i.test(id)) score -= 0.5;
  if (/-\d{3,}$|-\d{2}-\d{2}/.test(id)) score -= 0.2;   // pinned snapshots: prefer the alias
  if (/latest/i.test(id)) score += 0.3;
  return score;
}

async function rankedModels(force = false) {
  const st = get().settings;
  if (!force && st.modelList?.length && Date.now() - (st.modelListAt || 0) < 86400000) return st.modelList;
  const models = (await listModels()).sort((a, b) => rankModel(b.id) - rankModel(a.id));
  st.modelList = models.map(m => m.id); st.modelListAt = Date.now(); save();
  return st.modelList;
}

export async function resolveAutoModel(force = false) {
  const st = get().settings;
  if (!force && st.autoModel) return st.autoModel;
  const models = (await rankedModels(force)).map(id => ({ id }));
  if (!models.length) throw new Error('Bu anahtarla kullanılabilir bir Gemini modeli bulunamadı.');
  st.autoModel = models[0].id; st.autoModelAt = Date.now();
  save();
  return st.autoModel;
}

export const currentModel = () => get().settings.lastModel || get().settings.model?.trim() || get().settings.autoModel || '';

async function call(contents, { system, json = false, temperature = 0.4 } = {}) {
  const st = get().settings;
  const auto = !st.model?.trim();
  let model = auto ? await resolveAutoModel() : st.model.trim();
  const body = JSON.stringify({
    contents,
    generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  });
  const gen = m => request(`models/${encodeURIComponent(m)}:generateContent`, { method: 'POST', body });
  const busy = st => st === 429 || st === 500 || st === 502 || st === 503 || st === 504;
  let { r, data } = await gen(model);
  // Auto mode: the remembered model may have been retired – pick again once.
  if (auto && (r.status === 404 || (r.status === 400 && /model/i.test(data?.error?.message || '')))) {
    model = await resolveAutoModel(true);
    ({ r, data } = await gen(model));
  }
  // Overloaded / temporary error: wait a moment and retry, then fall back to the next models.
  if (busy(r.status)) {
    await new Promise(res => setTimeout(res, 1500));
    ({ r, data } = await gen(model));
  }
  if (busy(r.status)) {
    let others = [];
    try { others = (await rankedModels()).filter(id => id !== model); } catch {}
    for (const alt of others.slice(0, 4)) {
      const res = await gen(alt);
      if (res.r.ok) { r = res.r; data = res.data; model = alt; break; }
      if (!busy(res.r.status)) break;
    }
  }
  if (r.ok) { get().settings.lastModel = model; save(); }
  if (!r.ok) throw new Error(friendly(r.status, data?.error?.message || r.statusText, model) + (r.status === 404 && !auto ? ' Model kutusunu boş bırakırsan uygulama uygun modeli kendisi seçer.' : ''));
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!text) throw new Error('Boş yanıt geldi (içerik filtresi olabilir).');
  if (!json) return text;
  try { return JSON.parse(text.replace(/^```json\s*|\s*```$/g, '')); }
  catch { throw new Error('Yanıt beklenen biçimde değil. Tekrar dene.'); }
}

const user = text => ({ role: 'user', parts: [{ text }] });

const TUTOR = `You are an expert English teacher for Turkish and Uyghur speakers. Explanations for the learner must be in Turkish (short, clear). Be accurate and encouraging. Learner's typical weaknesses: dropping auxiliary/linking verbs (is/are/was/were/had) in multi-clause sentences, irregular verb forms, phrasal verb precision, third conditional, "be used to + V-ing" vs "used to + V1", and writing run-on sentences instead of cohesive paragraphs with connectors.`;

export async function gradeParagraph({ level, prompt, text }) {
  return call([user(`Learner CEFR level: ${level}. Writing prompt: "${prompt}".
Learner's paragraph:
"""${text}"""

Evaluate clause completeness (missing auxiliaries/linking verbs), verb forms, connectors/cohesion, register and vocabulary for the learner's level.
Return JSON:
{"score": 0-100, "cefr_estimate": "A1|A2|B1|B2|C1|C2",
 "corrected": "a corrected, natural version at one level above the learner",
 "summary_tr": "2-3 sentence overall feedback in Turkish",
 "errors": [{"original": "exact wrong fragment", "correction": "fixed fragment", "rule": one of ["aux-drop","irregular-verbs","phrasal-verbs","conditionals","used-to","connectors","tenses","prepositions","articles","word-order","register","vocabulary","general"], "explanation_tr": "short Turkish explanation"}]}`)], { system: TUTOR, json: true });
}

export async function chatTurn({ level, scenario, history }) {
  return call(history.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.text }] })).concat(history.length ? [] : [user('Start the roleplay.')]), {
    system: `${TUTOR}
You are a roleplay partner. Scenario: ${scenario}. Learner level: ${level}.
Speak ONLY English in the roleplay. Keep each turn to 1-3 short sentences at the learner's level and ask exactly ONE question per turn. Do not correct mistakes during the chat.`,
    temperature: 0.8,
  });
}

export async function chatReview({ level, scenario, history }) {
  const transcript = history.map(m => `${m.role === 'ai' ? 'Partner' : 'Learner'}: ${m.text}`).join('\n');
  return call([user(`Scenario: ${scenario}. Learner level: ${level}.
Transcript:
${transcript}

Analyse ONLY the learner's lines. Return JSON:
{"summary_tr": "overall feedback in Turkish",
 "errors": [{"original": "...", "correction": "...", "rule": "aux-drop|irregular-verbs|phrasal-verbs|conditionals|used-to|connectors|tenses|prepositions|articles|word-order|register|vocabulary|general", "explanation_tr": "..."}],
 "better_phrases": [{"learner": "what the learner said", "natural": "a more natural alternative at the next level", "note_tr": "why"}]}`)], { system: TUTOR, json: true });
}

export async function generateExercises({ level, rule, ruleTitle, count = 10 }) {
  return call([user(`Create ${count} new exercises for CEFR ${level} on the grammar point "${ruleTitle}" (rule id: ${rule}).
Mix these types: "cloze" (sentence with ___ and the missing word(s)), "fix" (sentence with one error; answer = corrected full sentence), "mcq" (4 options, one correct), "transform" (combine/rewrite; give 1-3 accepted answers).
Return JSON: {"exercises":[{"type":"cloze|fix|mcq|transform","prompt":"...","options":["..."] (mcq only),"answer":["accepted answer 1","accepted answer 2"],"explain_tr":"short Turkish explanation","rule":"${rule}"}]}
For mcq, "answer" must contain the exact text of the correct option. Natural, everyday and workplace contexts.`)], { system: TUTOR, json: true, temperature: 0.9 });
}
