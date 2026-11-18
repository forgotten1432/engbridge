// Shared exercise player: cloze | fix | mcq | transform
import { esc, matches, md } from './text.js';
import { shuffle } from './ui.js';
import { speak } from './speech.js';

export const TYPE_LABEL = {
  cloze: 'Boşluk doldur',
  fix: 'Eksik/yanlış olanı düzelt',
  mcq: 'Doğru seçeneği seç',
  transform: 'Cümleleri birleştir / dönüştür',
};

const promptHTML = p => esc(p).replace(/_{3,}/g, '<span class="blank"></span>');

// ex: {type, prompt, options?, answer:[...], explain_tr?, hint?, rule?}
// opts: {index, total, onResult(correct, userAnswer), onNext}
export function renderExercise(root, ex, opts = {}) {
  const answers = Array.isArray(ex.answer) ? ex.answer : [ex.answer];
  const head = `<div class="ex-head"><span>${esc(TYPE_LABEL[ex.type] || ex.type)}</span>${opts.total ? `<span>${opts.index + 1} / ${opts.total}</span>` : ''}</div>`;
  let body = '';
  if (ex.type === 'mcq') {
    const options = ex.shuffle === false ? ex.options : shuffle(ex.options || []);
    body = `<div class="ex-prompt">${promptHTML(ex.prompt)}</div><div class="opts">${options.map(o => `<button class="opt" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  } else if (ex.type === 'transform') {
    body = `<div class="ex-prompt">${md(ex.prompt)}</div><textarea class="field" id="exIn" rows="3" placeholder="Cevabını yaz…" autocapitalize="sentences"></textarea>`;
  } else if (ex.type === 'fix') {
    body = `<div class="ex-prompt">${esc(ex.prompt)}</div><textarea class="field" id="exIn" rows="2" autocapitalize="sentences">${esc(ex.prompt)}</textarea><p class="small muted">Cümleyi düzelterek yeniden yaz.</p>`;
  } else {
    body = `<div class="ex-prompt">${promptHTML(ex.prompt)}</div><input class="field" id="exIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Eksik kelime(ler)">`;
  }
  root.innerHTML = `${head}${body}${ex.hint ? `<details class="small muted" style="margin-top:8px"><summary>İpucu</summary>${md(ex.hint)}</details>` : ''}
    <div class="row" style="margin-top:12px"><button class="btn primary grow" id="exCheck">Kontrol et</button></div><div id="exFb"></div>`;

  // MCQ: compare the picked option exactly (matches() ignores punctuation, which some options differ by).
  const exact = ex.type === 'mcq' && (ex.options || []).some(o => answers.includes(o));
  const isRight = v => exact ? answers.includes(v) : matches(v, answers);
  let done = false, picked = null;
  const input = root.querySelector('#exIn');
  root.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    if (done) return;
    root.querySelectorAll('.opt').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel'); picked = b.dataset.v;
  });
  input?.addEventListener('keydown', e => { if (e.key === 'Enter' && ex.type === 'cloze') { e.preventDefault(); check(); } });
  root.querySelector('#exCheck').onclick = () => (done ? opts.onNext?.() : check());

  function finish(correct, user) {
    done = true;
    const fb = root.querySelector('#exFb');
    const model = answers[0];
    const full = ex.type === 'cloze' ? ex.prompt.replace(/_{3,}/, model) : model;
    fb.innerHTML = `<div class="feedback ${correct ? 'ok' : 'bad'}">
      <b>${correct ? 'Doğru! ✓' : 'Doğrusu:'}</b> ${correct ? '' : esc(full)}
      ${ex.explain_tr ? `<div style="margin-top:6px">${md(ex.explain_tr)}</div>` : ''}
      <div class="row" style="margin-top:8px">
        <button class="btn sm" id="exSay">🔊 Dinle</button>
        ${!correct && ex.type === 'transform' ? '<button class="btn sm" id="exOverride">Benimki de doğru</button>' : ''}
      </div></div>`;
    root.querySelector('#exSay').onclick = () => speak(full);
    const ov = root.querySelector('#exOverride');
    if (ov) ov.onclick = () => { ov.remove(); opts.onResult?.(true, user, { override: true }); fb.querySelector('b').textContent = 'Tamam, doğru sayıldı ✓'; };
    if (ex.type === 'mcq') root.querySelectorAll('.opt').forEach(b => {
      if (isRight(b.dataset.v)) b.classList.add('right');
      else if (b.dataset.v === user) b.classList.add('wrong');
    });
    const btn = root.querySelector('#exCheck');
    btn.textContent = opts.onNext ? 'Devam →' : 'Tamam';
    if (!opts.onNext) btn.disabled = true;
    if (input) input.readOnly = true;
    opts.onResult?.(correct, user);
  }

  function check() {
    const user = ex.type === 'mcq' ? picked : input.value;
    if (!user || !String(user).trim()) { (input || root).focus?.(); return; }
    finish(isRight(user), user);
  }
  setTimeout(() => input?.focus({ preventScroll: true }), 50);
}
