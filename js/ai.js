// Gemini API (bring your own key). The key stays in this device's localStorage.
import { get } from './store.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

export const hasKey = () => !!get().settings.apiKey?.trim();

async function call(contents, { system, json = false, temperature = 0.4 } = {}) {
  const { apiKey, model } = get().settings;
  if (!apiKey) throw new Error('Önce AI ayarlarına Gemini API anahtarını gir.');
  if (!navigator.onLine) throw new Error('İnternet bağlantısı yok. AI özellikleri çevrimiçi çalışır.');
  const body = {
    contents,
    generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  };
  const r = await fetch(`${BASE}${encodeURIComponent(model || 'gemini-2.5-flash')}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || r.statusText;
    if (r.status === 400 && /API key/i.test(msg)) throw new Error('API anahtarı geçersiz görünüyor.');
    if (r.status === 404) throw new Error(`Model bulunamadı: ${model}. Ayarlardan başka bir model adı dene.`);
    if (r.status === 429) throw new Error('Kota/limit doldu. Biraz sonra tekrar dene.');
    throw new Error(`Gemini hatası (${r.status}): ${msg}`);
  }
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
