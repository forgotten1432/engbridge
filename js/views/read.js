// TAB 2 – Graded reading (with word lookup) and dictation trainer.
import { get, save } from '../store.js';
import * as C from '../content.js';
import { esc, md, wordDiff, renderDiff } from '../text.js';
import { speak, stop, canSpeak } from '../speech.js';
import { openSheet, closeSheet, toast } from '../ui.js';
import { addToVault } from './vault.js';
import { addError } from '../errors.js';

let sub = 'reading';

export async function renderRead(view, params = {}) {
  if (params.sub) sub = params.sub;
  view.innerHTML = `<div class="seg"><button data-sub="reading" class="${sub === 'reading' ? 'on' : ''}">📖 Okuma</button><button data-sub="dictation" class="${sub === 'dictation' ? 'on' : ''}">🎧 Dikte</button></div><div id="sub"></div>`;
  view.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { stop(); sub = b.dataset.sub; renderRead(view); });
  const box = view.querySelector('#sub');
  if (sub === 'reading') return params.passage ? renderPassage(box, params.passage) : renderLibrary(box);
  return renderDictation(box);
}

async function renderLibrary(box) {
  const idx = await C.readingIndex();
  const s = get(), my = s.profile.level;
  const levels = [...new Set(idx.map(p => p.level))];
  box.innerHTML = `<h1>Okuma kütüphanesi</h1><p class="muted small">Altı çizili kelimelere dokun: telaffuz, Türkçe ve Uygurca anlam, kalıplar.</p>
    ${levels.map(lv => `<h2>${esc(lv)}${lv === my ? ' <span class="pill lv">Seviyem</span>' : ''}</h2>
      ${idx.filter(p => p.level === lv).map(p => `<button class="lesson" data-p="${esc(p.id)}"><span class="t">${esc(p.title)}<small>${esc(p.topic)} · ${p.words} kelime${s.reading[p.id] ? ` · son puan ${s.reading[p.id].score}/${s.reading[p.id].total}` : ''}</small></span><span class="pill">Oku</span></button>`).join('')}`).join('') || '<div class="empty">Henüz okuma parçası yok.</div>'}`;
  box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => renderPassage(box, b.dataset.p));
}

function linkGlossary(text, glossary) {
  const keys = Object.keys(glossary || {}).sort((a, b) => b.length - a.length);
  if (!keys.length) return esc(text);
  const re = new RegExp(`\\b(${keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
  return esc(text).replace(re, m => {
    const key = keys.find(k => k.toLowerCase() === m.toLowerCase());
    return `<button class="gw" data-g="${esc(key)}">${m}</button>`;
  });
}

async function renderPassage(box, id) {
  const P = await C.passage(id);
  box.innerHTML = `<button class="btn ghost sm" id="back">← Kütüphane</button>
    <h1>${esc(P.title)}</h1><div class="row"><span class="pill lv">${esc(P.level)}</span><span class="pill">${esc(P.topic)}</span></div>
    <div class="row" style="margin:10px 0"><button class="btn sm" id="play">▶︎ Sesli oku</button><button class="btn sm" id="slow">🐢 Yavaş</button><button class="btn sm ghost" id="stop">■ Durdur</button></div>
    <div class="card passage">${P.text.split(/\n\n+/).map(p => `<p>${linkGlossary(p, P.glossary)}</p>`).join('')}</div>
    <div class="card" id="qs"><h3>Anlama ve çıkarım soruları</h3></div>`;
  box.querySelector('#back').onclick = () => { stop(); renderLibrary(box); };
  box.querySelector('#play').onclick = () => speak(P.text.replace(/\n+/g, ' '));
  box.querySelector('#slow').onclick = () => speak(P.text.replace(/\n+/g, ' '), { rate: 0.8 });
  box.querySelector('#stop').onclick = stop;
  if (!canSpeak()) ['play', 'slow', 'stop'].forEach(i => box.querySelector('#' + i).disabled = true);
  box.querySelectorAll('.gw').forEach(b => b.onclick = () => showWord(b.dataset.g, P.glossary[b.dataset.g], P));

  const qs = box.querySelector('#qs');
  qs.insertAdjacentHTML('beforeend', P.questions.map((q, i) => `<div class="card" style="background:var(--card2)" data-q="${i}">
      <div class="small muted">${esc(q.kind === 'inference' ? 'Çıkarım' : q.kind === 'vocab' ? 'Kelime' : 'Anlama')}</div>
      <div style="margin:4px 0 8px">${esc(q.q)}</div>
      <div class="opts">${q.options.map((o, j) => `<button class="opt" data-o="${j}">${esc(o)}</button>`).join('')}</div>
      <div class="fb small"></div></div>`).join('') + '<div id="rscore" class="muted small"></div>');
  const answered = {};
  qs.querySelectorAll('[data-q]').forEach(card => {
    const qi = +card.dataset.q, q = P.questions[qi];
    card.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (qi in answered) return;
      const ok = +b.dataset.o === q.answer;
      answered[qi] = ok;
      b.classList.add(ok ? 'right' : 'wrong');
      card.querySelector(`[data-o="${q.answer}"]`).classList.add('right');
      card.querySelector('.fb').innerHTML = `<div class="feedback ${ok ? 'ok' : 'bad'}">${q.explain_tr ? md(q.explain_tr) : ok ? 'Doğru!' : 'Yanlış.'}</div>`;
      if (Object.keys(answered).length === P.questions.length) {
        const score = Object.values(answered).filter(Boolean).length;
        const s = get(); s.reading[P.id] = { score, total: P.questions.length, last: Date.now() }; save();
        qs.querySelector('#rscore').textContent = `Puan: ${score}/${P.questions.length}`;
      }
    });
  });
}

function showWord(key, g, P) {
  if (!g) return;
  const inVault = get().vault.some(v => v.term.toLowerCase() === key.toLowerCase());
  openSheet(`<h2 style="margin-top:0">${esc(key)} <button class="btn sm" id="say">🔊</button></h2>
    ${g.ipa ? `<div class="ipa">${esc(g.ipa)}</div>` : ''}
    ${g.pos ? `<span class="pill">${esc(g.pos)}</span>` : ''}
    <p style="font-size:18px;margin:10px 0 4px">${esc(g.tr)}</p>
    ${g.ug ? `<p class="ug" dir="rtl" lang="ug">${esc(g.ug)}</p>` : ''}
    ${g.coll?.length ? `<h3>Kalıplar</h3><ul>${g.coll.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    <button class="btn primary" id="add" ${inVault ? 'disabled' : ''}>${inVault ? 'Kasada var ✓' : '+ Kelime kasasına ekle'}</button>`, root => {
    root.querySelector('#say').onclick = () => speak(key);
    root.querySelector('#add').onclick = () => {
      addToVault({ term: key, ipa: g.ipa, tr: g.tr, ug: g.ug, register: g.register || 'neutral', coll: g.coll || [], ex: g.ex || [sentenceWith(P.text, key)].filter(Boolean), source: P.title });
      toast('Kelime kasasına eklendi.'); closeSheet();
    };
  });
}
const sentenceWith = (text, w) => text.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).find(s => s.toLowerCase().includes(w.toLowerCase())) || '';

async function renderDictation(box) {
  const all = await C.dictation();
  const s = get();
  let level = s.profile.level, rate = 1, cur = null;
  const pool = () => all.filter(d => d.level === level);
  const pick = () => {
    const p = pool(); if (!p.length) return null;
    const unseen = p.filter(d => !s.dictation[d.id]);
    const weak = p.filter(d => (s.dictation[d.id]?.best ?? 0) < 100);
    const list = unseen.length ? unseen : weak.length ? weak : p;
    return list[Math.floor(Math.random() * list.length)];
  };
  const levels = [...new Set(all.map(d => d.level))];
  box.innerHTML = `<h1>Dinle ve yaz</h1><p class="muted small">Cümleyi dinle, duyduğunu yaz. Atlanan küçük kelimeler (is, are, have, had, a, the…) kırmızıyla işaretlenir.</p>
    <div class="card">
      <div class="row"><label class="small muted">Seviye <select class="field" id="dl" style="width:auto;padding:6px 8px">${levels.map(l => `<option ${l === level ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <span class="grow"></span><div class="seg" style="margin:0" id="rates"><button data-r="0.8">0.8×</button><button data-r="1" class="on">1×</button><button data-r="1.15">1.15×</button></div></div>
      <div class="row" style="margin:14px 0"><button class="btn primary grow" id="play">▶︎ Dinle</button><button class="btn" id="next">Yeni cümle</button></div>
      <textarea class="field" id="typed" rows="2" placeholder="Duyduğunu yaz…" autocapitalize="sentences" spellcheck="false"></textarea>
      <div class="row" style="margin-top:10px"><button class="btn primary grow" id="check">Kontrol et</button><button class="btn ghost" id="show">Göster</button></div>
      <div id="dres"></div>
    </div>
    <p class="small muted" id="dstat"></p>`;
  const $ = q => box.querySelector(q);
  const stat = () => { const p = pool(); const done = p.filter(d => s.dictation[d.id]?.best === 100).length; $('#dstat').textContent = `${level}: ${done}/${p.length} cümle hatasız yazıldı.`; };
  const load = () => { cur = pick(); $('#typed').value = ''; $('#dres').innerHTML = cur ? '' : '<div class="empty">Bu seviyede dikte cümlesi yok.</div>'; stat(); };
  $('#dl').onchange = e => { level = e.target.value; load(); };
  box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { rate = +b.dataset.r; box.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('on', x === b)); });
  $('#play').onclick = () => cur && speak(cur.text, { rate });
  $('#next').onclick = () => { load(); cur && speak(cur.text, { rate }); };
  $('#show').onclick = () => cur && ($('#dres').innerHTML = `<div class="feedback bad">${esc(cur.text)}${cur.tr ? `<div class="small muted">${esc(cur.tr)}</div>` : ''}</div>`);
  $('#check').onclick = () => {
    if (!cur || !$('#typed').value.trim()) return;
    const d = wordDiff(cur.text, $('#typed').value);
    const rec = s.dictation[cur.id] || { best: 0, attempts: 0 };
    s.dictation[cur.id] = { best: Math.max(rec.best, d.score), attempts: rec.attempts + 1, last: Date.now() };
    save();
    if (d.score < 100) addError({ prompt: `🎧 Dikte: "${cur.text}"`, answer: cur.text, user: $('#typed').value, rule: d.missedSmall.length ? 'aux-drop' : 'listening', explain: d.missedSmall.length ? `Atlanan küçük kelime(ler): **${d.missedSmall.join(', ')}**. Bu kelimeler hızlı konuşmada zayıf okunur ama cümlenin yapısı için zorunludur.` : '', source: 'Dikte' });
    $('#dres').innerHTML = `<div class="feedback ${d.score === 100 ? 'ok' : 'bad'}"><b>%${d.score}</b>${d.missedSmall.length ? ` · Atlanan küçük kelimeler: <b>${esc(d.missedSmall.join(', '))}</b>` : ''}${renderDiff(d)}<div class="small">${esc(cur.text)}</div>${cur.tr ? `<div class="small muted">${esc(cur.tr)}</div>` : ''}</div>`;
    stat();
  };
  if (!canSpeak()) { $('#play').disabled = true; $('#dres').innerHTML = '<div class="feedback bad">Bu tarayıcı sesli okumayı desteklemiyor.</div>'; }
  load();
}
