// TAB 4 – Vocabulary vault with SM-2 review and Anki TSV export.
import { get, save, uid } from '../store.js';
import { newSrs, review, isDue, preview } from '../srs.js';
import { esc } from '../text.js';
import { speak } from '../speech.js';
import { download, toast, openSheet, closeSheet } from '../ui.js';
import * as C from '../content.js';

const REG = { neutral: 'nötr', formal: 'resmî', informal: 'gündelik', workplace: 'iş', academic: 'akademik', slang: 'argo' };

export function addToVault(card) {
  const s = get();
  if (s.vault.some(v => v.term.toLowerCase() === card.term.toLowerCase())) return false;
  s.vault.unshift({ id: uid(), level: card.level || s.profile.level, register: 'neutral', coll: [], ex: [], ...card, srs: newSrs(), addedAt: Date.now() });
  save();
  return true;
}

let mode = 'list';
export function renderVault(view) {
  const s = get();
  const due = s.vault.filter(v => isDue(v.srs));
  view.innerHTML = `<h1>Kelime kasası</h1>
    <div class="row"><span class="pill warn">${due.length} tekrar bekliyor</span><span class="pill">${s.vault.length} kart</span><span class="grow"></span>
      <button class="btn sm" id="tsv">⬇︎ Anki (.tsv)</button></div>
    <div class="seg" style="margin-top:10px"><button data-m="review" class="${mode === 'review' ? 'on' : ''}">Tekrar et</button><button data-m="list" class="${mode === 'list' ? 'on' : ''}">Liste</button><button data-m="dict" class="${mode === 'dict' ? 'on' : ''}">📚 Sözlük</button><button data-m="add" class="${mode === 'add' ? 'on' : ''}">+ Ekle</button></div>
    <div id="vbox"></div>`;
  view.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; renderVault(view); });
  view.querySelector('#tsv').onclick = exportTSV;
  const box = view.querySelector('#vbox');
  if (mode === 'review') return reviewMode(box, view);
  if (mode === 'add') return addForm(box, view);
  if (mode === 'dict') return dictMode(box, view);
  listMode(box);
}

const cardBack = v => `
  ${v.ipa ? `<div class="ipa">${esc(v.ipa)}</div>` : ''}
  <p style="font-size:19px;margin:8px 0 2px">${esc(v.tr || '')}</p>
  ${v.ug ? `<p class="ug" dir="rtl" lang="ug">${esc(v.ug)}</p>` : ''}
  <div class="row" style="justify-content:center"><span class="pill">${esc(REG[v.register] || v.register || '')}</span>${v.level ? `<span class="pill lv">${esc(v.level)}</span>` : ''}</div>
  ${v.coll?.length ? `<p class="small muted" style="margin-bottom:2px">Kalıplar</p><div>${v.coll.map(c => `<span class="pill" style="margin:2px">${esc(c)}</span>`).join('')}</div>` : ''}
  ${v.ex?.length ? `<div style="text-align:left;margin-top:10px">${v.ex.map(e => `<p style="margin:4px 0">• ${esc(e)} <button class="btn sm ghost" data-say="${esc(e)}">🔊</button></p>`).join('')}</div>` : ''}`;

function reviewMode(box, view) {
  const queue = get().vault.filter(v => isDue(v.srs)).sort((a, b) => (a.srs?.due || 0) - (b.srs?.due || 0));
  if (!queue.length) { box.innerHTML = '<div class="empty">Bugün tekrar edilecek kart yok. 🎉</div>'; return; }
  let i = 0;
  const show = () => {
    if (i >= queue.length) { box.innerHTML = '<div class="empty">Tekrar bitti ✓</div>'; setTimeout(() => renderVault(view), 800); return; }
    const v = queue[i];
    box.innerHTML = `<div class="card flash"><div class="small muted">${i + 1} / ${queue.length}</div>
      <div class="term">${esc(v.term)}</div><div><button class="btn sm" id="say">🔊</button></div>
      <div id="back" hidden>${cardBack(v)}</div>
      <button class="btn primary" id="reveal" style="margin-top:14px">Cevabı göster</button>
      <div class="grades" id="grades" hidden>
        ${['again', 'hard', 'good', 'easy'].map(g => `<button class="btn ${g === 'again' ? 'bad' : g === 'good' ? 'primary' : g === 'easy' ? 'ok' : ''}" data-g="${g}">${{ again: 'Tekrar', hard: 'Zor', good: 'İyi', easy: 'Kolay' }[g]}<small>${preview(v.srs, g)}</small></button>`).join('')}
      </div></div>`;
    const $ = q => box.querySelector(q);
    $('#say').onclick = () => speak(v.term);
    $('#reveal').onclick = () => { $('#back').hidden = false; $('#grades').hidden = false; $('#reveal').hidden = true; speak(v.term); box.querySelectorAll('[data-say]').forEach(b => b.onclick = () => speak(b.dataset.say)); };
    box.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
      v.srs = review(v.srs, b.dataset.g); save();
      if (b.dataset.g === 'again') queue.push(v);
      i++; show();
    });
  };
  show();
}

function listMode(box) {
  const s = get();
  box.innerHTML = `<input class="field" id="q" placeholder="Ara…" style="margin-bottom:8px"><div id="items"></div>`;
  const draw = () => {
    const q = box.querySelector('#q').value.trim().toLowerCase();
    const items = s.vault.filter(v => !q || [v.term, v.tr, v.ug].some(x => String(x || '').toLowerCase().includes(q)));
    box.querySelector('#items').innerHTML = items.map(v => `<details class="card"><summary class="row"><b class="grow">${esc(v.term)}</b><span class="small muted">${esc(v.tr || '')}</span></summary><div style="text-align:center">${cardBack(v)}</div>
      <div class="row" style="margin-top:8px"><span class="small muted grow">Sıradaki: ${isDue(v.srs) ? 'şimdi' : new Date(v.srs.due).toLocaleDateString('tr-TR')}</span><button class="btn sm ghost" data-del="${v.id}">Sil</button></div></details>`).join('') || '<div class="empty">Kart yok.</div>';
    box.querySelectorAll('[data-say]').forEach(b => b.onclick = () => speak(b.dataset.say));
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('Kart silinsin mi?')) { s.vault = s.vault.filter(v => v.id !== b.dataset.del); save(); draw(); } });
  };
  box.querySelector('#q').oninput = draw;
  draw();
}

function addForm(box, view) {
  box.innerHTML = `<div class="card">
    <label class="small muted">İngilizce kelime / kalıp<input class="field" id="f_term" autocapitalize="off"></label>
    <label class="small muted">IPA (isteğe bağlı)<input class="field" id="f_ipa"></label>
    <label class="small muted">Türkçe anlam<input class="field" id="f_tr"></label>
    <label class="small muted">Uygurca anlam<input class="field ug" id="f_ug" dir="rtl" lang="ug"></label>
    <label class="small muted">Kalıplar (virgülle)<input class="field" id="f_coll"></label>
    <label class="small muted">Örnek cümleler (her satıra bir)<textarea class="field" id="f_ex" rows="3"></textarea></label>
    <label class="small muted">Üslup<select class="field" id="f_reg">${Object.entries(REG).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <button class="btn primary" id="save" style="margin-top:10px">Kaydet</button></div>`;
  box.querySelector('#save').onclick = () => {
    const g = id => box.querySelector('#' + id).value.trim();
    if (!g('f_term') || !g('f_tr')) return toast('Kelime ve Türkçe anlam gerekli.');
    const ok = addToVault({ term: g('f_term'), ipa: g('f_ipa'), tr: g('f_tr'), ug: g('f_ug'), register: g('f_reg'), coll: g('f_coll').split(',').map(x => x.trim()).filter(Boolean), ex: g('f_ex').split('\n').map(x => x.trim()).filter(Boolean) });
    toast(ok ? 'Eklendi.' : 'Bu kelime zaten kasada.');
    if (ok) { mode = 'list'; renderVault(view); }
  };
}

function exportTSV() {
  const v = get().vault;
  if (!v.length) return toast('Kasada kart yok.');
  const clean = s => String(s || '').replace(/[\t\r\n]+/g, ' ').trim();
  const rows = v.map(c => {
    const front = `<b>${esc(c.term)}</b>${c.ipa ? `<br><span style="color:#888">${esc(c.ipa)}</span>` : ''}${c.coll?.length ? `<br><small>${c.coll.map(esc).join(' · ')}</small>` : ''}`;
    const back = `${esc(c.tr || '')}${c.ug ? `<br><div dir="rtl" lang="ug" style="color:#b7791f;font-size:1.1em">${esc(c.ug)}</div>` : ''}${c.ex?.length ? `<br><i>${c.ex.map(esc).join('<br>')}</i>` : ''}`;
    return [clean(front), clean(back), clean(['EngBridge', c.level, c.register].filter(Boolean).join(' '))].join('\t');
  });
  download(`engbridge-anki-${new Date().toISOString().slice(0, 10)}.tsv`, '#separator:tab\n#html:true\n#tags column:3\n' + rows.join('\n') + '\n', 'text/tab-separated-values');
  toast('Anki dosyası indirildi. Anki: Dosya → İçe Aktar.');
}

// ---- Open lexicon browser (A1–C2) ----
const POS_TR = { noun: 'isim', verb: 'fiil', adjective: 'sıfat', adverb: 'zarf', preposition: 'edat', conjunction: 'bağlaç', pronoun: 'zamir', determiner: 'belirteç', interjection: 'ünlem', number: 'sayı', numeral: 'sayı', 'modal verb': 'modal fiil', 'be-verb': 'be fiili', 'do-verb': 'do fiili', 'have-verb': 'have fiili', 'infinitive-to': 'to', article: 'artikel' };
const posTr = p => POS_TR[String(p).toLowerCase()] || p;

export function showLexEntry(e, { level, source } = {}) {
  const lv = level || e.level;
  const inVault = get().vault.some(v => v.term.toLowerCase() === e.w.toLowerCase());
  openSheet(`<h2 style="margin-top:0">${esc(e.w)} <button class="btn sm" id="lxSay">🔊</button></h2>
    <div class="row">${e.i ? `<span class="ipa">${esc(e.i)}</span>` : ''}${lv ? `<span class="pill lv">${esc(lv)}</span>` : ''}${(e.p || []).map(p => `<span class="pill">${esc(posTr(p))}</span>`).join('')}</div>
    ${(e.d || []).map(([pos, def, ex]) => `<div class="card" style="background:var(--card2)"><div class="small muted">${esc(posTr(pos))} · English</div><div>${esc(def)}</div>${ex ? `<div class="small" style="margin-top:4px"><i>“${esc(ex)}”</i> <button class="btn sm ghost" data-lxs="${esc(ex)}">🔊</button></div>` : ''}</div>`).join('') || '<p class="muted small">Bu kelime için tanım yok.</p>'}
    <h3>Kelime kasasına ekle</h3>
    <label class="small muted">Türkçe anlam<input class="field" id="lxTr" placeholder="ör. ertelemek"></label>
    <label class="small muted">Uygurca anlam (isteğe bağlı)<input class="field ug" id="lxUg" dir="rtl" lang="ug"></label>
    <button class="btn primary" id="lxAdd" style="margin-top:8px" ${inVault ? 'disabled' : ''}>${inVault ? 'Kasada var ✓' : '+ Kasaya ekle'}</button>
    <p class="small muted">Seviye: CEFR-J / Octanove · Tanım: WordNet · Telaffuz: CMU (ABD). Kaynaklar: AI → Profil.</p>`, root => {
    root.querySelector('#lxSay').onclick = () => speak(e.w);
    root.querySelectorAll('[data-lxs]').forEach(b => b.onclick = () => speak(b.dataset.lxs));
    root.querySelector('#lxAdd').onclick = () => {
      const tr = root.querySelector('#lxTr').value.trim();
      if (!tr) return toast('Türkçe anlamı yaz (kartın arka yüzü için).');
      addToVault({ term: e.w, ipa: e.i || '', tr, ug: root.querySelector('#lxUg').value.trim(), level: lv, register: 'neutral', coll: [], ex: (e.d || []).map(d => d[2]).filter(Boolean).slice(0, 2), source: source || 'Sözlük' });
      toast('Kasaya eklendi.'); closeSheet();
    };
  });
}

let dictLevel = null, dictQuery = '', dictLimit = 120;
async function dictMode(box) {
  const s = get();
  dictLevel ??= s.profile.level;
  const idx = await C.lexiconIndex();
  box.innerHTML = `<div class="row"><select class="field" id="dlv" style="width:auto">${Object.entries(idx.levels).map(([l, n]) => `<option value="${l}" ${l === dictLevel ? 'selected' : ''}>${l} · ${n} kelime</option>`).join('')}<option value="ALL" ${dictLevel === 'ALL' ? 'selected' : ''}>Tümü</option></select>
    <input class="field grow" id="dq" placeholder="Ara (İngilizce)…" value="${esc(dictQuery)}" autocapitalize="off" spellcheck="false" style="flex:1"></div>
    <p class="small muted">Açık kaynak seviyeli kelime listesi. Kelimeye dokun: telaffuz, İngilizce tanım ve örnek; Türkçe anlamını yazıp kasana ekle.</p>
    <div id="dlist"><div class="empty"><span class="spin"></span></div></div>`;
  const draw = async () => {
    const lvls = dictLevel === 'ALL' ? Object.keys(idx.levels) : [dictLevel];
    let items = [];
    for (const lv of lvls) items.push(...(await C.lexiconLevel(lv)).map(e => ({ ...e, level: lv })));
    const q = dictQuery.trim().toLowerCase();
    if (q) items = items.filter(e => e.w.toLowerCase().includes(q)).sort((a, b) => (a.w.toLowerCase().startsWith(q) ? 0 : 1) - (b.w.toLowerCase().startsWith(q) ? 0 : 1) || a.w.length - b.w.length);
    const vaultSet = new Set(s.vault.map(v => v.term.toLowerCase()));
    const shown = items.slice(0, dictLimit);
    box.querySelector('#dlist').innerHTML = `<div class="small muted" style="margin:6px 0">${items.length} sonuç</div>` + shown.map((e, k) => `<button class="lesson" data-k="${k}"><span class="t"><b>${esc(e.w)}</b> <span class="ipa small">${esc(e.i || '')}</span><small>${esc((e.p || []).map(posTr).join(', '))}${e.d?.[0] ? ' · ' + esc(e.d[0][1].slice(0, 70)) + (e.d[0][1].length > 70 ? '…' : '') : ''}</small></span>${vaultSet.has(e.w.toLowerCase()) ? '<span class="pill ok">✓</span>' : `<span class="pill lv">${e.level}</span>`}</button>`).join('')
      + (items.length > shown.length ? `<button class="btn" id="more" style="width:100%;margin-top:8px">Daha fazla göster (${items.length - shown.length})</button>` : '');
    box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => showLexEntry(shown[+b.dataset.k]));
    box.querySelector('#more')?.addEventListener('click', () => { dictLimit += 200; draw(); });
  };
  box.querySelector('#dlv').onchange = e => { dictLevel = e.target.value; dictLimit = 120; draw(); };
  let t; box.querySelector('#dq').oninput = e => { clearTimeout(t); t = setTimeout(() => { dictQuery = e.target.value; dictLimit = 120; draw(); }, 200); };
  draw();
}
