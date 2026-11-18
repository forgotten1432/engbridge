// TAB 4 – Vocabulary vault with SM-2 review and Anki TSV export.
import { get, save, uid } from '../store.js';
import { newSrs, review, isDue, preview } from '../srs.js';
import { esc } from '../text.js';
import { speak } from '../speech.js';
import { download, toast } from '../ui.js';

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
    <div class="seg" style="margin-top:10px"><button data-m="review" class="${mode === 'review' ? 'on' : ''}">Tekrar et</button><button data-m="list" class="${mode === 'list' ? 'on' : ''}">Liste</button><button data-m="add" class="${mode === 'add' ? 'on' : ''}">+ Ekle</button></div>
    <div id="vbox"></div>`;
  view.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; renderVault(view); });
  view.querySelector('#tsv').onclick = exportTSV;
  const box = view.querySelector('#vbox');
  if (mode === 'review') return reviewMode(box, view);
  if (mode === 'add') return addForm(box, view);
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
