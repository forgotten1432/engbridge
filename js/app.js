// App shell: tab router, level picker, first-run seeding, badges, service worker.
import { get, save, onChange, LEVELS } from './store.js';
import * as C from './content.js';
import { newSrs, isDue } from './srs.js';
import { dueErrors } from './errors.js';
import { $, $$, toast } from './ui.js';
import { stop } from './speech.js';
import { renderLearn } from './views/learn.js';
import { renderRead } from './views/read.js';
import { renderErrors } from './views/errors.js';
import { renderVault } from './views/vault.js';
import { renderAI } from './views/ai.js';

const VIEWS = { learn: renderLearn, read: renderRead, errors: renderErrors, vault: renderVault, ai: renderAI };
let current = 'learn';

async function show(tab, params) {
  stop();
  current = tab;
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const view = $('#view');
  try { await VIEWS[tab](view, params); }
  catch (e) { console.error(e); view.innerHTML = `<div class="card">Bir sorun oluştu: ${e.message}</div>`; }
  window.scrollTo({ top: 0 });
}

function badges() {
  const s = get();
  const e = dueErrors().length, v = s.vault.filter(x => isDue(x.srs)).length;
  $('#errBadge').hidden = !e; $('#errBadge').textContent = e;
  $('#vaultBadge').hidden = !v; $('#vaultBadge').textContent = v;
}

async function seed() {
  const s = get();
  let changed = false;
  if (!s.seeded.errors) {
    try {
      const items = await C.errorSeed();
      for (const it of items) s.errors.push({ id: 'seed-' + it.id, key: 'seed-' + it.id, prompt: it.prompt, answer: it.answer, user: it.user || '', rule: it.rule, explain: it.explain_tr || '', source: 'Teşhis', count: 1, streak: 0, mastered: false, createdAt: Date.now(), srs: newSrs() });
      s.seeded.errors = true; changed = true;
    } catch (e) { console.warn('error seed', e); }
  }
  if (!s.seeded.vault) {
    try {
      const cards = await C.vocabSeed();
      for (const c of cards) if (!s.vault.some(v => v.term.toLowerCase() === c.term.toLowerCase())) s.vault.push({ id: 'seed-' + c.term, ...c, srs: newSrs(), addedAt: Date.now() });
      s.seeded.vault = true; changed = true;
    } catch (e) { console.warn('vault seed', e); }
  }
  if (changed) save();
}

function init() {
  const sel = $('#levelSelect');
  sel.innerHTML = LEVELS.map(l => `<option ${l === get().profile.level ? 'selected' : ''}>${l}</option>`).join('');
  sel.onchange = () => { get().profile.level = sel.value; save(); toast(`Seviyen: ${sel.value}`); show(current); };
  $$('.tabs button').forEach(b => b.onclick = () => show(b.dataset.tab));
  onChange(badges);
  seed().then(() => { badges(); show('learn'); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}
init();
