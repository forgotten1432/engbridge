// TAB 1 – Personal tutor: homework → Stage 1 (6 words + grammar + 5 exercises) → Stage 2 (reading + one-question-at-a-time talk) → end-of-lesson summary.
import { get, save } from '../store.js';
import * as AI from '../ai.js';
import * as TU from '../tutor.js';
import { addError } from '../errors.js';
import { addToVault } from './vault.js';
import { renderExercise } from '../exercise.js';
import { esc, md } from '../text.js';
import { speak, stop } from '../speech.js';
import { toast, download } from '../ui.js';

const REG = { formal: 'Formal', neutral: 'Neutral', conversational: 'Conversational' };
let goTab = () => {};
export const setTabSwitcher = f => (goTab = f);

const busy = (btn, on, label) => { if (!btn) return; btn.disabled = on; btn.innerHTML = on ? '<span class="spin"></span> Öğretmen hazırlıyor…' : label; };
const guard = async (btn, label, fn) => { busy(btn, true); try { await fn(); return true; } catch (e) { toast(e.message, 6000); busy(btn, false, label); return false; } };

export async function renderTutor(view) {
  await TU.ensureTutor();
  const t = TU.T();
  if (t.session) return renderSession(view);
  renderHome(view);
}

function renderHome(view) {
  const t = TU.T(), s = get(), mod = TU.currentModule();
  const key = AI.hasKey();
  const last = t.log[t.log.length - 1];
  view.innerHTML = `<h1>Öğretmenin</h1>
    <p class="muted small">Hedef: ${esc(t.profile.level)} → B2 · Açıklama dili: ${({ more: 'çok Türkçe', normal: 'İngilizce + kısa Türkçe', less: 'çoğunlukla İngilizce' })[t.turkish] || 'İngilizce + kısa Türkçe'}</p>
    ${key ? '' : `<div class="card warn-card"><b>Öğretmen Gemini ile çalışır.</b><p class="small">Ücretsiz anahtarını <b>aistudio.google.com</b> → “Get API key” bölümünden al ve ayarlara yapıştır. Anahtar sadece bu telefonda saklanır.</p><button class="btn primary" id="setKey">⚙️ Anahtarı gir</button> <button class="btn" id="offline">📘 Hazır derslere git</button></div>`}
    <div class="card"><div class="row"><h3 class="grow" style="margin:0">Yol haritası</h3><span class="pill lv">${esc(TU.lessonLabel())}</span></div>
      <div class="mods">${t.modules.map(m => `<div class="modrow ${m.status}"><span class="n">${m.n}</span><span class="grow">${esc(m.title)}</span><span class="pill ${m.status === 'done' ? 'ok' : m.status === 'in-progress' ? 'warn' : ''}">${m.status === 'done' ? 'Bitti' : m.status === 'in-progress' ? 'Devam' : 'Sırada'}</span></div>`).join('')}</div></div>
    ${t.homework ? `<div class="card"><h3>📝 Bekleyen ödev <span class="small muted">(${esc(t.homework.from || '')})</span></h3>
      <p class="hw">${esc(t.homework.prompt)}</p>
      <p class="small muted">Hedef ifadeler: ${t.homework.targets.map(x => `<span class="pill">${esc(x)}</span>`).join(' ')}</p>
      <ul class="small">${t.homework.checklist.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      <button class="btn primary" id="hw" ${key ? '' : 'disabled'}>Ödevi teslim et</button></div>` : ''}
    <div class="card"><h3>📘 Sıradaki ders: ${esc(TU.lessonLabel())}</h3><p class="small muted">${esc(mod.title)}</p><p>${esc(t.next || mod.focus)}</p>
      <p class="small muted">1. aşama: 6 kelime + dilbilgisi + 5 alıştırma · 2. aşama: kısa okuma + tek tek sorularla sohbet · Sonunda özet ve ödev.</p>
      <button class="btn ${t.homework ? '' : 'primary'}" id="start" ${key ? '' : 'disabled'}>Derse başla</button>
      ${mod.lesson ? `<button class="btn ghost sm" id="ref">Bu modülün hazır dersleri →</button>` : ''}</div>
    ${last ? `<div class="card"><h3>Son ders</h3><p class="small"><b>${esc(last.title)}</b></p><p class="small muted">${esc(last.summary)}</p></div>` : ''}
    <details class="card"><summary><b>🎯 Aktif hata günlüğü (${t.patterns.length})</b></summary>
      ${t.patterns.map(p => `<div class="pair"><span class="small"><b>${esc(p.title)}</b></span><span class="w">${esc(p.wrong)}</span><span class="r">${esc(p.right)}</span><span class="n">${esc(p.rule)}</span></div>`).join('')}</details>
    <div class="card"><h3>Diğer</h3><div class="row">
      <button class="btn sm" id="tools">✨ Serbest yazma, rol yapma, alıştırma üretici</button>
      <button class="btn sm" id="settings">⚙️ AI ayarları ve yedek</button>
      <button class="btn sm" id="mem">🧠 Hafızayı indir (.md)</button></div>
      <label class="small muted" style="display:block;margin-top:10px">Açıklama dili
        <select class="field" id="trs"><option value="more">Çok Türkçe</option><option value="normal">İngilizce + kısa Türkçe</option><option value="less">Çoğunlukla İngilizce</option></select></label>
      <p class="small muted">Öğretmen, doğruluğun arttıkça Türkçeyi kendisi de azaltır. Uygurca karşılıkları yapay zekâ yazar; anadili Uygurca olan biri kontrol etmedi.</p></div>`;
  const $ = q => view.querySelector(q);
  $('#trs').value = t.turkish || 'normal';
  $('#trs').onchange = e => { t.turkish = e.target.value; save(); };
  $('#setKey')?.addEventListener('click', () => goTab('ai', { sub: 'me' }));
  $('#settings').onclick = () => goTab('ai', { sub: 'me' });
  $('#tools').onclick = () => goTab('ai', { sub: 'write' });
  $('#offline')?.addEventListener('click', () => goTab('learn'));
  $('#ref')?.addEventListener('click', () => goTab('learn'));
  $('#mem').onclick = () => download(`engbridge-hafiza-${new Date().toISOString().slice(0, 10)}.md`, TU.memoryMarkdown(), 'text/markdown');
  $('#hw')?.addEventListener('click', () => renderHomework(view));
  $('#start')?.addEventListener('click', e => guard(e.target, 'Derse başla', async () => {
    const plan = await TU.stage1();
    t.session = { stage: 'learn', plan, exIndex: 0, exResults: [], chat: [], startedAt: Date.now() };
    save(); renderSession(view);
  }));
}

function renderHomework(view) {
  const hw = TU.T().homework;
  view.innerHTML = `<button class="btn ghost sm" id="back">← Öğretmen</button><h1>Ödev</h1>
    <div class="card"><p class="hw">${esc(hw.prompt)}</p><p class="small muted">Hedef ifadeler (en az ikisini kullan): ${hw.targets.map(x => `<span class="pill">${esc(x)}</span>`).join(' ')}</p>
    <ul class="small">${hw.checklist.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
    <textarea class="field" id="txt" rows="7" placeholder="3–4 bağlantılı cümle yaz…"></textarea>
    <div class="row" style="margin-top:8px"><span class="small muted grow" id="wc">0 kelime</span><button class="btn primary" id="go">Gönder</button></div></div><div id="res"></div>`;
  const $ = q => view.querySelector(q);
  const draft = get().tutor.hwDraft || ''; $('#txt').value = draft;
  const wc = () => ($('#wc').textContent = `${$('#txt').value.trim().split(/\s+/).filter(Boolean).length} kelime`); wc();
  $('#txt').oninput = () => { wc(); get().tutor.hwDraft = $('#txt').value; save(); };
  $('#back').onclick = () => renderTutor(view);
  $('#go').onclick = e => {
    const text = $('#txt').value.trim();
    if (text.split(/\s+/).length < 15) return toast('Biraz daha uzun yaz: 3–4 cümle.');
    guard(e.target, 'Gönder', async () => {
      const r = await TU.gradeHomework(hw, text);
      for (const er of r.errors || []) addError({ prompt: `Düzelt: "${er.original}"`, answer: er.correction, user: er.original, rule: er.rule || 'general', explain: er.explanation_tr, source: 'Ödev' });
      const t = TU.T();
      t.homeworkDone.push({ ...hw, answer: text, score: r.score, at: Date.now() });
      t.homework = null; t.hwDraft = ''; save();
      $('#go').hidden = true; $('#txt').readOnly = true;
      $('#res').innerHTML = `<div class="card"><div class="row"><h3 class="grow" style="margin:0">Puan: ${Number(r.score) || 0}/100</h3></div>
        <p>${md(r.verdict_tr || '')}</p>
        ${(r.checklist || []).map(c => `<div class="small">${c.ok ? '✅' : '❌'} ${esc(c.item)} ${c.note_tr ? `<span class="muted">– ${esc(c.note_tr)}</span>` : ''}</div>`).join('')}
        ${r.targets_used?.length ? `<p class="small muted">Kullandığın hedef ifadeler: ${r.targets_used.map(esc).join(', ')}</p>` : ''}
        <h3>Hatalar</h3>${fbList((r.errors || []).map(x => ({ original: x.original, better: x.correction, note_tr: x.explanation_tr })))}
        <h3>B2 sürümü</h3><p class="en">${esc(r.improved || '')} <button class="btn sm ghost" id="say">🔊</button></p>
        <p class="small muted">Hatalar Hata Avcısı'na eklendi.</p><button class="btn primary" id="next">Derse geç →</button></div>`;
      $('#say').onclick = () => speak(r.improved);
      $('#next').onclick = () => renderTutor(view);
    });
  };
}

const fbList = list => list?.length ? list.map(f => `<div class="pair"><span class="w">${esc(f.original)}</span><span class="r">${esc(f.better)}</span>${f.note_tr ? `<span class="n">${md(f.note_tr)}</span>` : ''}</div>`).join('') : '<p class="muted small">Önemli bir hata yok.</p>';

function stepper(stage) {
  const steps = [['learn', '1 · Kelime + kural'], ['ex', '1 · Alıştırma'], ['read', '2 · Okuma'], ['talk', '2 · Sohbet'], ['end', 'Özet']];
  const i = steps.findIndex(x => x[0] === stage);
  return `<div class="stepper">${steps.map((x, j) => `<span class="${j < i ? 'done' : j === i ? 'on' : ''}">${x[1]}</span>`).join('')}</div>`;
}

function renderSession(view) {
  const t = TU.T(), S = t.session;
  stop();
  view.innerHTML = `<div class="row"><button class="btn ghost sm" id="home">← Öğretmen</button><span class="grow"></span><button class="btn ghost sm bad" id="quit">Dersi iptal et</button></div>
    <h1>${esc(S.plan.title)}</h1><p class="small muted">${esc(TU.lessonLabel())} · ${esc(S.plan.objective_tr || '')}</p>${stepper(S.stage)}<div id="stage"></div>`;
  view.querySelector('#home').onclick = () => renderHome(view);
  view.querySelector('#quit').onclick = () => { if (confirm('Bu ders silinsin mi? (İlerleme kaydedilmez.)')) { t.session = null; save(); renderHome(view); } };
  const box = view.querySelector('#stage');
  ({ learn: stageLearn, ex: stageEx, read: stageRead, talk: stageTalk, end: stageEnd })[S.stage](box, view, S);
  window.scrollTo({ top: 0 });
}

const go = (view, S, stage) => { S.stage = stage; save(); renderSession(view); };

function stageLearn(box, view, S) {
  const P = S.plan, g = P.grammar || {};
  box.innerHTML = `<h2>Yeni kelimeler</h2>${P.vocab.map((v, i) => `<div class="card vcard">
      <div class="row"><b class="term">${esc(v.term)}</b><span class="pill">${esc(REG[String(v.register).toLowerCase()] || v.register || '')}</span><span class="ipa">${esc(v.ipa || '')}</span><span class="grow"></span><button class="btn sm ghost" data-say="${i}">🔊</button></div>
      <div>🇹🇷 ${esc(v.tr || '')}</div>${v.ug ? `<div class="ug" dir="rtl">${esc(v.ug)}</div>` : ''}
      ${v.coll?.length ? `<div class="small muted">Kalıplar: ${v.coll.map(esc).join(' · ')}</div>` : ''}
      ${v.ex ? `<div class="en">“${esc(v.ex)}”</div>` : ''}</div>`).join('')}
    <button class="btn" id="vault">🗂️ 6 kelimeyi kasaya ekle</button>
    <h2>Dilbilgisi: ${esc(g.title || '')}</h2>
    <div class="card explain">${g.explain_en ? `<p>${md(g.explain_en)}</p>` : ''}${g.explain_tr ? `<p class="muted">${md(g.explain_tr)}</p>` : ''}
      ${g.table?.length ? `<table class="tbl">${g.table.map((r, i) => `<tr>${r.map(c => i ? `<td>${md(String(c))}</td>` : `<th>${esc(String(c))}</th>`).join('')}</tr>`).join('')}</table>` : ''}
      ${(g.pairs || []).map(p => `<div class="pair"><span class="w">${esc(p.wrong)}</span><span class="r">${esc(p.right)}</span>${p.note_tr ? `<span class="n">${md(p.note_tr)}</span>` : ''}</div>`).join('')}</div>
    <button class="btn primary" id="next">Alıştırmalara geç (${S.plan.exercises.length}) →</button>`;
  box.querySelectorAll('[data-say]').forEach(b => b.onclick = () => { const v = P.vocab[+b.dataset.say]; speak(`${v.term}. ${v.ex || ''}`); });
  box.querySelector('#vault').onclick = e => {
    let n = 0;
    for (const v of P.vocab) if (addToVault({ term: v.term, ipa: v.ipa, tr: v.tr, ug: v.ug, register: String(v.register || 'neutral').toLowerCase(), coll: v.coll || [], ex: v.ex ? [v.ex] : [], level: 'B1' })) n++;
    e.target.disabled = true; e.target.textContent = `Eklendi ✓ (${n} yeni)`;
  };
  box.querySelector('#next').onclick = () => go(view, S, 'ex');
}

function stageEx(box, view, S) {
  const list = S.plan.exercises;
  let last = null;
  const next = () => {
    if (last) { S.exResults.push(last); if (!last.correct) addError({ prompt: last.ex.prompt, answer: last.ex.answer, user: last.user, rule: last.ex.rule, explain: last.ex.explain_tr, source: 'Öğretmen' }); last = null; S.exIndex++; save(); }
    if (S.exIndex >= list.length) {
      const ok = S.exResults.filter(r => r.correct).length;
      box.innerHTML = `<div class="card"><h3>1. aşama bitti: ${ok}/${list.length}</h3><p class="small muted">${ok < list.length ? 'Yanlışlar Hata Avcısı\'na eklendi; ders sonunda öğretmen bunları da değerlendirecek.' : 'Hepsi doğru.'}</p>
        <button class="btn primary" id="s2">2. aşama: okuma + sohbet →</button></div>`;
      box.querySelector('#s2').onclick = e => guard(e.target, '2. aşama: okuma + sohbet →', async () => {
        S.reading = await TU.stage2(S.plan);
        if (!S.reading?.text) throw new Error('Okuma metni hazırlanamadı. Tekrar dene.');
        go(view, S, 'read');
      });
      return;
    }
    const ex = list[S.exIndex];
    box.innerHTML = '<div class="card" id="ex"></div>';
    renderExercise(box.querySelector('#ex'), ex, { index: S.exIndex, total: list.length, onResult: (c, u) => (last = { correct: c, user: u, ex }), onNext: next });
  };
  next();
}

function stageRead(box, view, S) {
  const R = S.reading, qs = R.questions || [];
  const answers = S.readAnswers || (S.readAnswers = {});
  box.innerHTML = `<h2>${esc(R.title || 'Okuma')}</h2>
    <div class="row"><button class="btn sm" id="play">▶︎ Sesli oku</button><button class="btn sm" id="slow">🐢 Yavaş</button><button class="btn sm ghost" id="stop">■</button></div>
    <div class="card passage">${String(R.text).split(/\n\n+/).map(p => `<p>${esc(p)}</p>`).join('')}</div>
    ${qs.map((q, i) => `<div class="card" data-q="${i}"><b>${i + 1}. ${esc(q.q)}</b><div class="opts" style="margin-top:8px">${q.options.map((o, j) => `<button class="opt" data-o="${j}">${esc(o)}</button>`).join('')}</div><div class="fb small"></div></div>`).join('')}
    <button class="btn primary" id="talk">Sohbete başla →</button>`;
  box.querySelector('#play').onclick = () => speak(R.text);
  box.querySelector('#slow').onclick = () => speak(R.text, { rate: 0.75 });
  box.querySelector('#stop').onclick = stop;
  const mark = (card, q, picked) => {
    card.querySelectorAll('.opt').forEach((b, j) => { b.disabled = true; if (j === Number(q.answer)) b.classList.add('right'); else if (j === picked) b.classList.add('wrong'); });
    card.querySelector('.fb').innerHTML = md(q.explain_tr || '');
  };
  box.querySelectorAll('[data-q]').forEach(card => {
    const i = +card.dataset.q, q = qs[i];
    if (i in answers) mark(card, q, answers[i]);
    card.querySelectorAll('.opt').forEach(b => b.onclick = () => { if (i in answers) return; answers[i] = +b.dataset.o; save(); mark(card, q, answers[i]); });
  });
  box.querySelector('#talk').onclick = () => {
    S.readScore = qs.filter((q, i) => answers[i] === Number(q.answer)).length;
    if (!S.chat.length) S.chat.push({ role: 'ai', text: R.first_question || 'What do you think about the text?' });
    go(view, S, 'talk');
  };
}

function stageTalk(box, view, S) {
  const mine = () => S.chat.filter(m => m.role === 'me').length;
  const done = () => mine() >= TU.CONVO_TURNS && S.chat[S.chat.length - 1]?.role === 'ai';
  box.innerHTML = `<p class="small muted">Öğretmen tek tek soru soracak (${TU.CONVO_TURNS} soru). Her cevaptan sonra sadece önemli hatalar gösterilir. 2–4 bağlantılı cümleyle cevap vermeye çalış.</p>
    <div class="chat" id="log"></div>
    <div class="card" id="bar"><textarea class="field" id="msg" rows="3" placeholder="İngilizce cevap ver…"></textarea>
      <div class="row" style="margin-top:8px"><span class="small muted grow" id="cnt"></span><button class="btn primary" id="send">Gönder</button></div></div>
    <button class="btn primary" id="finish" hidden>Dersi bitir →</button>`;
  const $ = q => box.querySelector(q);
  const draw = () => {
    $('#log').innerHTML = S.chat.map((m, i) => `<div class="msg ${m.role}">${esc(m.text)}${m.role === 'ai' ? ` <button class="btn sm ghost" data-say="${i}">🔊</button>` : ''}</div>
      ${m.review ? `<div class="review">${m.review.well_done ? `<div class="small">👍 ${esc(m.review.well_done)}</div>` : ''}${m.review.feedback?.length ? fbList(m.review.feedback) : ''}${m.review.b2_version ? `<div class="small muted">B2 sürümü: <span class="en">${esc(m.review.b2_version)}</span></div>` : ''}</div>` : ''}`).join('');
    box.querySelectorAll('[data-say]').forEach(b => b.onclick = () => speak(S.chat[+b.dataset.say].text));
    $('#cnt').textContent = `${mine()}/${TU.CONVO_TURNS} cevap`;
    $('#bar').hidden = done(); $('#finish').hidden = !done() && mine() < 2;
    $('#finish').textContent = done() ? 'Dersi bitir →' : 'Sohbeti burada bitir ve dersi kapat →';
  };
  draw();
  $('#msg').value = S.draft || '';
  $('#msg').oninput = () => { S.draft = $('#msg').value; save(); };
  $('#send').onclick = e => {
    const text = $('#msg').value.trim(); if (!text) return;
    S.chat.push({ role: 'me', text }); S.draft = ''; $('#msg').value = ''; save(); draw();
    guard(e.target, 'Gönder', async () => {
      const r = await TU.convoTurn(S);
      const me = S.chat[S.chat.length - 1];
      me.review = { feedback: r.feedback || [], well_done: r.well_done || '', b2_version: r.b2_version || '' };
      for (const f of r.feedback || []) addError({ prompt: `Düzelt: "${f.original}"`, answer: f.better, user: f.original, rule: f.rule || 'general', explain: f.note_tr, source: 'Öğretmen sohbet' });
      if (r.next) S.chat.push({ role: 'ai', text: r.next });
      save(); busy(e.target, false, 'Gönder'); draw();
      $('#log').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }).then(ok => { if (!ok && S.chat[S.chat.length - 1]?.role === 'me') { $('#msg').value = S.chat.pop().text; save(); draw(); } });
  };
  // a reply that is still waiting for review (e.g. app closed mid-request): allow resending
  if (S.chat[S.chat.length - 1]?.role === 'me') {
    $('#bar').hidden = false;
    const last = S.chat.pop(); $('#msg').value = last.text; save(); draw();
  }
  $('#finish').onclick = e => guard(e.target, 'Dersi bitir →', async () => {
    S.result = await TU.finishLesson(S);
    go(view, S, 'end');
  });
}

function stageEnd(box, view, S) {
  const r = S.result || {};
  const ex = S.exResults || [];
  box.innerHTML = `<div class="card"><h2 style="margin-top:0">Ders özeti</h2>
      <p class="small muted">Alıştırma ${ex.filter(x => x.correct).length}/${ex.length} · Okuma ${S.readScore ?? 0}/${S.reading?.questions?.length ?? 0} · Sohbet ${S.chat.filter(m => m.role === 'me').length} cevap</p>
      <p>${md(r.summary_tr || '')}</p>
      ${r.learned?.length ? `<h3>Öğrendiklerin</h3><ul>${r.learned.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${r.new_patterns?.length ? `<h3>Hata günlüğüne eklenecekler</h3>${r.new_patterns.map(p => `<div class="pair"><span class="small"><b>${esc(p.title)}</b></span><span class="w">${esc(p.wrong)}</span><span class="r">${esc(p.right)}</span><span class="n">${esc(p.rule)}</span></div>`).join('')}` : ''}
      ${r.resolved?.length ? `<h3>Artık doğru kullandıkların 🎉</h3><ul>${r.resolved.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${r.homework?.prompt ? `<h3>📝 Ödev</h3><p class="hw">${esc(r.homework.prompt)}</p><p class="small muted">Hedef ifadeler: ${(r.homework.targets || []).map(esc).join(', ')}</p>` : ''}
      ${r.next_focus ? `<h3>Sıradaki ders</h3><p>${esc(r.next_focus)}</p>` : ''}
      <button class="btn primary" id="save">Kaydet ve bitir</button></div>`;
  box.querySelector('#save').onclick = () => { TU.applyFinish(S, r); toast('Ders kaydedildi. Ödevin hazır.'); renderHome(view); };
}
