// TAB 5 – AI Tutor Studio (bring-your-own Gemini key).
import { get, save, exportBackup, importBackup, resetAll } from '../store.js';
import * as AI from '../ai.js';
import * as C from '../content.js';
import { addError, ruleCounts, activeErrors } from '../errors.js';
import { esc, md } from '../text.js';
import { renderExercise } from '../exercise.js';
import { englishVoices, speak, canSpeak } from '../speech.js';
import { toast, copyText } from '../ui.js';

let sub = 'write';
const SCENARIOS = [
  'Ordering food and asking about ingredients at a restaurant',
  'A job interview for a position at an international company',
  'Talking to a colleague about a project deadline that is in danger',
  'Calling a landlord about a broken heater',
  'Checking in at a hotel and solving a problem with the booking',
  'Small talk with a new neighbour',
  'Explaining a problem with a rental car to customer service',
  'Discussing weekend plans with a friend',
];
const PROMPTS = {
  A1: ['Describe your family.', 'Write about your daily routine.'],
  A2: ['Write about your last holiday.', 'Describe your home and your neighbourhood.'],
  B1: ['Is it better to learn a language with apps or with a teacher? Explain your opinion.', 'Describe a difficult situation at work or school and how you solved it.'],
  B2: ['Some people say remote work makes employees less productive. Do you agree?', 'How has technology changed the way people make friends?'],
  C1: ['Evaluate the advantages and drawbacks of a four-day working week.', 'To what extent should governments regulate social media?'],
  C2: ['"Efficiency is the enemy of creativity." Discuss.', 'Critically assess the claim that cities, not nations, will shape the future.'],
};

export function renderAI(view, params) {
  if (params?.sub) sub = params.sub;
  const s = get();
  view.innerHTML = `<h1>AI Öğretmen</h1>
    <div class="seg">${[['write', '✍️ Yazı'], ['chat', '💬 Sohbet'], ['gen', '🧪 Alıştırma'], ['me', '⚙️ Profil']].map(([k, l]) => `<button data-s="${k}" class="${sub === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${!AI.hasKey() && sub !== 'me' ? `<div class="card"><b>Gemini API anahtarı gerekli.</b><p class="small muted">Yapay zekâ özellikleri kendi ücretsiz Gemini anahtarınla çalışır. Profil sekmesinden ekleyebilirsin. Diğer tüm bölümler anahtarsız ve internetsiz çalışır.</p><button class="btn primary" id="goKey">Anahtar ekle</button></div>` : ''}
    <div id="aibox"></div>`;
  view.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { sub = b.dataset.s; renderAI(view); });
  view.querySelector('#goKey')?.addEventListener('click', () => { sub = 'me'; renderAI(view); });
  const box = view.querySelector('#aibox');
  ({ write: writeTab, chat: chatTab, gen: genTab, me: meTab })[sub](box, view, s);
}

const busy = (btn, on, label) => { btn.disabled = on; btn.innerHTML = on ? '<span class="spin"></span> Bekle…' : label; };

function errorsBlock(errors) {
  if (!errors?.length) return '<p class="muted">Hata bulunmadı 👏</p>';
  return errors.map(e => `<div class="pair"><span class="w">${esc(e.original)}</span><span class="r">${esc(e.correction)}</span><span class="n">${md(e.explanation_tr || '')}</span></div>`).join('');
}
function importErrors(errors, source) {
  for (const e of errors || []) addError({ prompt: `Düzelt: "${e.original}"`, answer: e.correction, user: e.original, rule: e.rule || 'general', explain: e.explanation_tr, source });
}

function writeTab(box, view, s) {
  const lv = s.profile.level, prompts = PROMPTS[lv] || PROMPTS.B1;
  box.innerHTML = `<div class="card"><h3>Paragraf değerlendirme</h3>
    <label class="small muted">Konu<select class="field" id="pr">${prompts.map(p => `<option>${esc(p)}</option>`).join('')}<option value="">Kendi konum…</option></select></label>
    <input class="field" id="own" placeholder="Kendi konunu yaz" hidden style="margin-top:6px">
    <textarea class="field" id="txt" rows="7" placeholder="4–5 cümlelik bir paragraf yaz. Bağlaç kullanmayı unutma: however, furthermore, as a result…" style="margin-top:8px"></textarea>
    <div class="row" style="margin-top:8px"><span class="small muted grow" id="wc">0 kelime</span><button class="btn primary" id="go">Değerlendir</button></div></div><div id="res"></div>`;
  const $ = q => box.querySelector(q);
  $('#pr').onchange = () => ($('#own').hidden = !!$('#pr').value);
  $('#txt').oninput = () => ($('#wc').textContent = `${$('#txt').value.trim().split(/\s+/).filter(Boolean).length} kelime`);
  $('#go').onclick = async () => {
    const text = $('#txt').value.trim(); if (text.split(/\s+/).length < 15) return toast('Biraz daha uzun yaz (en az 15 kelime).');
    busy($('#go'), true);
    try {
      const r = await AI.gradeParagraph({ level: lv, prompt: $('#pr').value || $('#own').value, text });
      $('#res').innerHTML = `<div class="card"><div class="row"><h3 class="grow" style="margin:0">Puan: ${r.score}/100</h3><span class="pill lv">Tahmini seviye: ${esc(r.cefr_estimate || '?')}</span></div>
        <p>${md(r.summary_tr || '')}</p><h3>Düzeltilmiş sürüm</h3><p style="font-size:17px">${esc(r.corrected || '')} <button class="btn sm ghost" id="say">🔊</button></p>
        <h3>Hatalar</h3>${errorsBlock(r.errors)}
        ${r.errors?.length ? `<button class="btn primary" id="imp">Hataları Hata Avcısı'na ekle (${r.errors.length})</button>` : ''}</div>`;
      $('#say').onclick = () => speak(r.corrected);
      $('#imp')?.addEventListener('click', e => { importErrors(r.errors, 'AI yazı'); e.target.disabled = true; e.target.textContent = 'Eklendi ✓'; });
    } catch (e) { toast(e.message, 5000); }
    busy($('#go'), false, 'Değerlendir');
  };
}

function chatTab(box, view, s) {
  const lv = s.profile.level;
  let history = [], scenario = SCENARIOS[0];
  box.innerHTML = `<div class="card"><label class="small muted">Senaryo<select class="field" id="sc">${SCENARIOS.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>
    <button class="btn primary" id="start" style="margin-top:8px">Başlat</button></div><div class="chat" id="log"></div>
    <div class="card" id="inbar" hidden><textarea class="field" id="msg" rows="2" placeholder="İngilizce cevap ver…"></textarea>
    <div class="row" style="margin-top:8px"><button class="btn primary grow" id="send">Gönder</button><button class="btn" id="end">Bitir ve değerlendir</button></div></div><div id="rev"></div>`;
  const $ = q => box.querySelector(q);
  const draw = () => { $('#log').innerHTML = history.map(m => `<div class="msg ${m.role}">${esc(m.text)}${m.role === 'ai' ? ' <button class="btn sm ghost" data-say="1">🔊</button>' : ''}</div>`).join(''); box.querySelectorAll('[data-say]').forEach((b, i) => b.onclick = () => speak(history.filter(m => m.role === 'ai')[i].text)); };
  const ask = async () => {
    try { const t = await AI.chatTurn({ level: lv, scenario, history }); history.push({ role: 'ai', text: t.trim() }); draw(); if (canSpeak()) speak(t); }
    catch (e) { toast(e.message, 5000); }
  };
  $('#start').onclick = async () => { scenario = $('#sc').value; history = []; $('#rev').innerHTML = ''; busy($('#start'), true); await ask(); busy($('#start'), false, 'Yeniden başlat'); $('#inbar').hidden = !history.length; };
  $('#send').onclick = async () => { const t = $('#msg').value.trim(); if (!t) return; history.push({ role: 'me', text: t }); $('#msg').value = ''; draw(); busy($('#send'), true); await ask(); busy($('#send'), false, 'Gönder'); };
  $('#end').onclick = async () => {
    if (!history.some(m => m.role === 'me')) return toast('Önce birkaç cevap yaz.');
    busy($('#end'), true);
    try {
      const r = await AI.chatReview({ level: lv, scenario, history });
      $('#rev').innerHTML = `<div class="card"><h3>Sohbet değerlendirmesi</h3><p>${md(r.summary_tr || '')}</p><h3>Hatalar</h3>${errorsBlock(r.errors)}
        ${r.better_phrases?.length ? `<h3>Daha doğal söyleyişler</h3>${r.better_phrases.map(p => `<div class="pair"><span class="n">${esc(p.learner)}</span><span class="r">${esc(p.natural)}</span><span class="n">${md(p.note_tr || '')}</span></div>`).join('')}` : ''}
        ${r.errors?.length ? `<button class="btn primary" id="imp">Hataları Hata Avcısı'na ekle</button>` : ''}</div>`;
      $('#imp')?.addEventListener('click', e => { importErrors(r.errors, 'AI sohbet'); e.target.disabled = true; e.target.textContent = 'Eklendi ✓'; });
    } catch (e) { toast(e.message, 5000); }
    busy($('#end'), false, 'Bitir ve değerlendir');
  };
}

async function genTab(box, view, s) {
  const cur = await C.curriculum();
  const counts = ruleCounts();
  const rules = Object.entries(cur.rules);
  const top = counts[0]?.[0] || 'aux-drop';
  box.innerHTML = `<div class="card"><h3>Sonsuz alıştırma üretici</h3>
    <p class="small muted">${counts.length ? `En çok hata yaptığın konu: <b>${esc(cur.rules[top]?.tr || top)}</b> (${counts[0][1]} hata).` : 'Henüz hata kaydın yok; bir konu seç.'}</p>
    <label class="small muted">Konu<select class="field" id="rule">${rules.map(([k, v]) => `<option value="${k}" ${k === top ? 'selected' : ''}>${esc(v.tr)}${counts.find(c => c[0] === k) ? ` (${counts.find(c => c[0] === k)[1]} hata)` : ''}</option>`).join('')}</select></label>
    <button class="btn primary" id="go" style="margin-top:8px">10 alıştırma üret</button></div><div class="card" id="exs" hidden></div>`;
  const $ = q => box.querySelector(q);
  $('#go').onclick = async () => {
    busy($('#go'), true);
    try {
      const rule = $('#rule').value;
      const r = await AI.generateExercises({ level: s.profile.level, rule, ruleTitle: cur.rules[rule]?.en || rule });
      const list = (r.exercises || []).filter(x => x.prompt && x.answer && (x.type !== 'mcq' || x.options?.length));
      if (!list.length) throw new Error('Alıştırma üretilemedi, tekrar dene.');
      play(list, rule);
    } catch (e) { toast(e.message, 5000); }
    busy($('#go'), false, '10 yeni alıştırma üret');
  };
  function play(list, rule) {
    const exBox = $('#exs'); exBox.hidden = false;
    let i = 0, last = null, score = 0;
    const next = () => {
      if (last) { if (last.correct) score++; else addError({ prompt: last.ex.prompt, answer: last.ex.answer, user: last.user, rule, explain: last.ex.explain_tr, source: 'AI alıştırma' }); last = null; }
      if (i >= list.length) { exBox.innerHTML = `<h3>Bitti: ${score}/${list.length}</h3><p class="muted small">Yanlışlar Hata Avcısı'na eklendi.</p>`; return; }
      const ex = list[i++];
      renderExercise(exBox, { ...ex, answer: Array.isArray(ex.answer) ? ex.answer : [ex.answer] }, { index: i - 1, total: list.length, onResult: (c, u) => (last = { correct: c, user: u, ex }), onNext: next });
    };
    next();
  }
}

async function meTab(box, view, s) {
  const st = s.settings;
  const lessons = await C.allLessons();
  const done = lessons.filter(l => s.lessons[l.id]?.done);
  box.innerHTML = `<div class="card"><h3>Gemini ayarları</h3>
    <p class="small muted">Ücretsiz anahtarı <b>aistudio.google.com</b> → “Get API key” bölümünden alabilirsin. Anahtar yalnızca bu cihazda saklanır; telefonu kullanan biri görebilir.</p>
    <label class="small muted">API anahtarı<input class="field" id="key" type="password" autocomplete="off" value="${esc(st.apiKey)}" placeholder="AIza…"></label>
    <label class="small muted">Model<select class="field" id="model"><option value="">Otomatik (önerilen)</option>${st.model ? `<option value="${esc(st.model)}" selected>${esc(st.model)}</option>` : ''}</select></label>
    <p class="small muted" id="modelInfo">${st.model ? `Elle seçildi: <b>${esc(st.model)}</b>` : st.autoModel ? `Otomatik seçilen: <b>${esc(st.autoModel)}</b>` : 'Otomatik: anahtarı kaydedince en yeni hızlı model seçilir.'}</p>
    <div class="row" style="margin-top:8px"><button class="btn primary" id="saveKey">Kaydet</button><button class="btn" id="test">Bağlantıyı dene</button><button class="btn ghost" id="models">Modelleri listele</button></div></div>
    <div class="card"><h3>Ses</h3>
      <label class="small muted">İngilizce ses<select class="field" id="voice"><option value="">Otomatik</option>${englishVoices().map(v => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === st.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select></label>
      <label class="small muted">Hız: <span id="rv">${st.rate}</span>×<input type="range" id="rate" min="0.6" max="1.3" step="0.05" value="${st.rate}" style="width:100%"></label>
      <button class="btn sm" id="vtest">🔊 Dene</button></div>
    <div class="card"><h3>İlerleme özeti</h3><p class="small muted">${done.length} ders tamamlandı · ${activeErrors().length} aktif hata · ${s.vault.length} kelime kartı</p>
      <button class="btn" id="copy">📋 Profilimi kopyala (Markdown)</button><p class="small muted">Başka bir öğretmene ya da AI'ya ilerlemeni anlatmak için.</p></div>
    <div class="card"><h3>Kaynaklar ve lisanslar</h3><div id="credits" class="small muted">…</div></div>
    <div class="card"><h3>Yedek</h3><div class="row"><button class="btn" id="exp">⬇︎ Yedeği indir</button><label class="btn">⬆︎ Yedeği yükle<input type="file" id="imp" accept="application/json,.json" hidden></label></div>
      <button class="btn ghost sm bad" id="reset" style="margin-top:10px">Tüm verileri sıfırla</button></div>`;
  const $ = q => box.querySelector(q);
  const fillModels = async () => {
    const list = (await AI.listModels()).sort((a, b) => AI.rankModel(b.id) - AI.rankModel(a.id));
    const sel = $('#model'), keep = st.model;
    sel.innerHTML = `<option value="">Otomatik (önerilen)${st.autoModel ? ` – şu an ${esc(st.autoModel)}` : ''}</option>` + list.map(m => `<option value="${esc(m.id)}" ${m.id === keep ? 'selected' : ''}>${esc(m.name)} — ${esc(m.id)}</option>`).join('');
    return list;
  };
  const info = () => ($('#modelInfo').innerHTML = st.model ? `Elle seçildi: <b>${esc(st.model)}</b>` : st.autoModel ? `Otomatik seçilen: <b>${esc(st.autoModel)}</b>` : 'Otomatik');
  const saveSettings = () => { const k = $('#key').value.trim(); if (k !== st.apiKey) st.autoModel = ''; st.apiKey = k; st.model = $('#model').value; save(); };
  $('#saveKey').onclick = async () => {
    saveSettings(); toast('Kaydedildi.');
    if (st.apiKey && !st.model) { try { await AI.resolveAutoModel(true); info(); } catch (e) { toast(e.message, 5000); } }
  };
  $('#model').onchange = () => { st.model = $('#model').value; save(); info(); };
  if (st.apiKey && navigator.onLine) fillModels().then(l => { $('#modelInfo').innerHTML += ` · <span class="muted">${l.length} model kullanılabilir</span>`; }).catch(() => {});
  $('#models').onclick = async () => { saveSettings(); busy($('#models'), true); try { const l = await fillModels(); toast(`${l.length} model bulundu.`); } catch (e) { toast(e.message, 5000); } busy($('#models'), false, 'Modelleri listele'); };
  $('#test').onclick = async () => {
    saveSettings(); busy($('#test'), true);
    try {
      if (!st.model) await AI.resolveAutoModel(true);
      await AI.chatTurn({ level: 'A1', scenario: 'Say hello in one short sentence.', history: [] });
      info(); toast(`Bağlantı çalışıyor ✓ (${AI.currentModel()})`, 4000);
    } catch (e) { toast(e.message, 6000); }
    busy($('#test'), false, 'Bağlantıyı dene');
  };
  $('#voice').onchange = e => { st.voiceURI = e.target.value; save(); };
  $('#rate').oninput = e => { st.rate = +e.target.value; $('#rv').textContent = st.rate; save(); };
  $('#vtest').onclick = () => speak('Hello! This is how your English voice sounds.');
  $('#copy').onclick = async () => { (await copyText(await profileMarkdown())) ? toast('Kopyalandı.') : toast('Kopyalanamadı.'); };
  $('#exp').onclick = exportBackup;
  C.lexiconIndex().then(ix => { $('#credits').innerHTML = ix.sources.map(x => `<p style="margin:4px 0"><b>${esc(x.name)}</b> — ${esc(x.by)}. ${esc(x.used)}. Lisans: ${esc(x.license)}. <a href="${esc(x.url)}" target="_blank" rel="noopener">kaynak</a></p>`).join('') + '<p style="margin:4px 0">Ders, okuma ve dikte içerikleri, Türkçe ve Uygurca açıklamalar EngBridge için yazılmıştır.</p>'; }).catch(() => {});
  $('#imp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { await importBackup(f); toast('Yedek yüklendi.'); location.reload(); } catch (err) { toast(err.message, 5000); } };
  $('#reset').onclick = () => { if (confirm('Tüm ilerleme, hatalar ve kelimeler silinecek. Emin misin?') && confirm('Bu işlem geri alınamaz. Önce yedek indirdin mi? Silinsin mi?')) { resetAll(); location.reload(); } };
}

async function profileMarkdown() {
  const s = get(), cur = await C.curriculum(), lessons = await C.allLessons();
  const done = lessons.filter(l => s.lessons[l.id]?.done);
  const counts = ruleCounts();
  return `# EngBridge ilerleme özeti
- Seviye: **${s.profile.level}**
- Tamamlanan dersler (${done.length}): ${done.map(l => `${l.id} ${l.title} (%${s.lessons[l.id].best})`).join('; ') || '—'}
- Kelime kasası: ${s.vault.length} kart
- Aktif hatalar: ${activeErrors().length}

## En sık hata türleri
${counts.map(([r, n]) => `- ${cur.rules[r]?.tr || r}: ${n}`).join('\n') || '- —'}

## Aktif hata örnekleri
${activeErrors().slice(0, 15).map(e => `- ✗ ${e.user || '—'} → ✓ ${e.answer[0]}`).join('\n') || '- —'}
`;
}
