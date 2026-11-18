// TAB 3 – Error Hunter: spaced repetition over the learner's own mistakes.
import { get } from '../store.js';
import { dueErrors, activeErrors, answerError, removeError, MASTER_STREAK } from '../errors.js';
import { ruleName } from '../content.js';
import { esc, md, matches } from '../text.js';
import { speak } from '../speech.js';

const when = t => { const d = Math.round((t - Date.now()) / 86400000); return d <= 0 ? 'şimdi' : d === 1 ? 'yarın' : `${d} gün sonra`; };

export async function renderErrors(view) {
  const s = get();
  const due = dueErrors(), active = activeErrors(), mastered = s.errors.filter(e => e.mastered);
  const names = {};
  for (const e of s.errors) names[e.rule] ??= await ruleName(e.rule);
  view.innerHTML = `<h1>Hata Avcısı</h1>
    <p class="muted small">Derslerde, diktede ve AI değerlendirmesinde yaptığın her hata buraya gelir. Bir hata, farklı günlerde ${MASTER_STREAK} kez üst üste doğru cevaplanınca ustalaşılmış sayılır.</p>
    <div class="row"><span class="pill warn">${due.length} tekrar bekliyor</span><span class="pill">${active.length} aktif</span><span class="pill ok">${mastered.length} ustalaşıldı</span></div>
    <div class="card" id="drill"></div>
    <h2>Aktif hatalar</h2>
    ${active.length ? active.map(e => `<div class="card"><div class="row small muted"><span class="pill">${esc(names[e.rule] || e.rule)}</span><span>${esc(e.source)}</span><span class="grow"></span><span>${'●'.repeat(e.streak || 0)}${'○'.repeat(MASTER_STREAK - (e.streak || 0))}</span></div>
      <div style="margin:6px 0">${md(e.prompt)}</div>
      <div class="small">✓ <b>${esc(e.answer[0])}</b>${e.user ? `<br>✗ <span class="muted">${esc(e.user)}</span>` : ''}</div>
      <div class="row small muted" style="margin-top:6px"><span class="grow">Sıradaki tekrar: ${when(e.srs?.due || 0)}</span><button class="btn sm ghost" data-del="${e.id}">Sil</button></div></div>`).join('') : '<div class="empty">Aktif hata yok. Harika!</div>'}`;
  view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('Bu hata kaydı silinsin mi?')) { removeError(b.dataset.del); renderErrors(view); } });
  drill(view.querySelector('#drill'), view);
}

function drill(box, view) {
  const queue = dueErrors();
  if (!queue.length) { box.innerHTML = '<h3>Tekrar</h3><p class="muted">Şu an tekrar edilecek hata yok. Yeni hatalar dersler ve diktede ortaya çıkacak.</p>'; return; }
  let i = 0;
  const next = () => {
    if (i >= queue.length) { box.innerHTML = '<h3>Bitti ✓</h3><p class="muted">Bugünkü hata tekrarı tamamlandı.</p>'; setTimeout(() => renderErrors(view), 900); return; }
    const e = queue[i++];
    const isDict = e.prompt.startsWith('🎧');
    box.innerHTML = `<div class="ex-head"><span>Hata tekrarı</span><span>${i} / ${queue.length}</span></div>
      <div class="ex-prompt">${isDict ? 'Cümleyi dinle ve yaz.' : md(e.prompt)}</div>
      ${isDict ? '<button class="btn sm" id="say">▶︎ Dinle</button>' : ''}
      <textarea class="field" id="in" rows="2" placeholder="Cevabın…" spellcheck="false" style="margin-top:8px"></textarea>
      <div class="row" style="margin-top:10px"><button class="btn primary grow" id="chk">Kontrol et</button></div><div id="fb"></div>`;
    const $ = q => box.querySelector(q);
    if (isDict) { $('#say').onclick = () => speak(e.answer[0]); speak(e.answer[0]); }
    $('#chk').onclick = () => {
      const v = $('#in').value; if (!v.trim()) return;
      // For cloze-type prompts accept either the missing word(s) or the full sentence.
      const line = e.prompt.split('\n').find(l => /_{3,}/.test(l));
      const full = line ? e.answer.map(a => line.replace(/_{3,}/, a)) : [];
      const ok = matches(v, [...e.answer, ...full]);
      const r = answerError(e.id, ok);
      $('#fb').innerHTML = `<div class="feedback ${ok ? 'ok' : 'bad'}"><b>${ok ? (r.mastered ? 'Ustalaştın! 🏆' : 'Doğru ✓') : 'Doğrusu:'}</b> ${ok ? '' : esc(e.answer[0])}${e.explain ? `<div style="margin-top:6px">${md(e.explain)}</div>` : ''}</div>`;
      $('#chk').textContent = 'Devam →';
      $('#chk').onclick = next;
    };
  };
  box.innerHTML = `<h3>Tekrar zamanı</h3><p>${queue.length} hata seni bekliyor.</p><button class="btn primary" id="go">Başla</button>`;
  box.querySelector('#go').onclick = next;
}
