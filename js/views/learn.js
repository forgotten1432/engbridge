// TAB 1 – Curriculum (A1 → C2) and lesson player.
import { get, save, LEVELS } from '../store.js';
import * as C from '../content.js';
import { esc, md } from '../text.js';
import { renderExercise } from '../exercise.js';
import { addError } from '../errors.js';
import { speak } from '../speech.js';
import { toast } from '../ui.js';

export async function renderLearn(view, params = {}) {
  if (params.lesson) return renderLesson(view, params.lesson);
  const cur = await C.curriculum();
  const s = get();
  const my = s.profile.level;
  const stat = l => s.lessons[l.id];
  const lvStats = lv => {
    const ls = lv.modules.flatMap(m => m.lessons), ready = ls.filter(l => l.ready), done = ready.filter(l => stat(l)?.done);
    return { total: ls.length, ready: ready.length, done: done.length };
  };
  view.innerHTML = `
    <h1>Müfredat</h1>
    <p class="muted small">A1'den C2'ye tüm seviyeler. Seviyeni üstten seçebilirsin; diğer seviyeler de her zaman açık.</p>
    ${cur.levels.map(lv => {
      const st = lvStats(lv);
      return `<details class="level" ${lv.id === my ? 'open' : ''} data-level="${lv.id}">
        <summary><div class="lvhead"><h2>${esc(lv.id)} · ${esc(lv.title)}</h2>${lv.id === my ? '<span class="pill lv">Seviyem</span>' : ''}</div>
          <div class="small muted">${esc(lv.desc)}</div>
          <div class="row small muted" style="margin-top:6px"><span class="grow">${st.done}/${st.ready} ders tamamlandı${st.ready < st.total ? ` · ${st.total - st.ready} ders yakında` : ''}</span></div>
          <div class="progress"><i style="width:${st.ready ? Math.round(100 * st.done / st.ready) : 0}%"></i></div>
        </summary>
        ${lv.modules.map(m => `<div class="mod"><h3>${esc(m.title)}</h3>${m.desc ? `<div class="small muted">${esc(m.desc)}</div>` : ''}
          ${m.lessons.map(l => {
            const p = stat(l);
            return `<button class="lesson ${l.ready ? '' : 'soon'}" data-lesson="${esc(l.id)}" ${l.ready ? '' : 'disabled'}>
              <span class="t">${esc(l.title)}<small>${l.ready ? (p ? `En iyi: %${p.best}${p.done ? ' · tamamlandı' : ''}` : `${l.count || ''} alıştırma`) : 'Yakında'}</small></span>
              ${p?.done ? '<span class="pill ok">✓</span>' : l.ready ? '<span class="pill">Başla</span>' : ''}
            </button>`;
          }).join('')}</div>`).join('')}
      </details>`;
    }).join('')}`;
  view.querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => renderLesson(view, b.dataset.lesson));
}

async function renderLesson(view, id) {
  let L;
  try { L = await C.lesson(id); }
  catch { view.innerHTML = `<div class="card">Bu ders henüz eklenmedi.</div><button class="btn" id="back">← Müfredat</button>`; view.querySelector('#back').onclick = () => renderLearn(view); return; }
  view.innerHTML = `
    <button class="btn ghost sm" id="back">← Müfredat</button>
    <h1>${esc(L.title)}</h1>
    <div class="row"><span class="pill lv">${esc(L.level)}</span><span class="pill">${L.exercises.length} alıştırma</span></div>
    <div class="card explain">
      <h3>Konu anlatımı</h3>
      ${(L.explain_tr || []).map(p => `<p>${md(p)}</p>`).join('')}
      ${L.explain_en ? `<details style="margin-top:8px"><summary class="small muted">English explanation</summary>${(L.explain_en || []).map(p => `<p>${md(p)}</p>`).join('')}</details>` : ''}
      ${L.table ? `<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:15px">${L.table.map((r, i) => `<tr>${r.map(c => `<${i ? 'td' : 'th'} style="border-bottom:1px solid var(--line);padding:6px;text-align:left">${md(c)}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table></div>` : ''}
    </div>
    ${L.pairs?.length ? `<div class="card"><h3>Yanlış ↔ Doğal</h3>${L.pairs.map(p => `<div class="pair"><span class="w">${esc(p.wrong)}</span><span class="r">${esc(p.right)} <button class="btn sm ghost" data-say="${esc(p.right)}">🔊</button></span>${p.note_tr ? `<span class="n">${md(p.note_tr)}</span>` : ''}</div>`).join('')}</div>` : ''}
    <div class="card" id="exBox"></div>`;
  view.querySelector('#back').onclick = () => renderLearn(view);
  view.querySelectorAll('[data-say]').forEach(b => b.onclick = () => speak(b.dataset.say));

  const box = view.querySelector('#exBox');
  let i = 0, score = 0, last = null;
  const start = () => {
    box.innerHTML = `<h3>Alıştırmalar</h3><p class="muted small">${L.exercises.length} soru. Yanlışların otomatik olarak Hatalar sekmesine eklenir.</p><button class="btn primary" id="go">Başla</button>`;
    box.querySelector('#go').onclick = () => step();
  };
  const commit = () => {
    if (!last) return;
    const ex = L.exercises[last.i];
    if (last.correct) score++;
    else addError({ prompt: ex.type === 'mcq' ? `${ex.prompt}\n(${ex.options.join(' / ')})` : ex.prompt, answer: ex.answer, user: last.user, rule: ex.rule || L.rule, explain: ex.explain_tr, source: `Ders ${L.id}` });
    last = null;
  };
  const step = () => {
    commit();
    if (i >= L.exercises.length) return finish();
    const idx = i++;
    renderExercise(box, L.exercises[idx], {
      index: idx, total: L.exercises.length,
      onResult: (correct, user) => (last = { i: idx, correct, user }),
      onNext: step,
    });
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const finish = () => {
    const pct = Math.round(100 * score / L.exercises.length);
    const s = get(), prev = s.lessons[L.id] || { best: 0, attempts: 0 };
    s.lessons[L.id] = { best: Math.max(prev.best, pct), attempts: prev.attempts + 1, done: prev.done || pct >= 80, last: Date.now() };
    save();
    box.innerHTML = `<h3>Sonuç: %${pct}</h3><p>${score}/${L.exercises.length} doğru. ${pct >= 80 ? 'Ders tamamlandı 🎉' : 'Dersi tamamlamak için %80 gerekiyor.'}</p>
      ${score < L.exercises.length ? '<p class="small muted">Yanlışların Hatalar sekmesinde tekrar edilecek.</p>' : ''}
      <div class="row"><button class="btn" id="again">Tekrar çöz</button><button class="btn primary" id="back2">Müfredata dön</button></div>`;
    box.querySelector('#again').onclick = () => { i = 0; score = 0; step(); };
    box.querySelector('#back2').onclick = () => renderLearn(view);
    toast(`Ders sonucu: %${pct}`);
  };
  start();
}

export const levelOptions = () => LEVELS.map(l => `<option>${l}</option>`).join('');
