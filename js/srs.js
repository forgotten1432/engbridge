// SM-2 scheduling (SuperMemo 2) with Anki-style buttons.
// grade: 'again' | 'hard' | 'good' | 'easy'
const Q = { again: 1, hard: 3, good: 4, easy: 5 };
const DAY = 86400000;

export function newSrs() {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: Date.now() };
}

export function review(srs, grade, now = Date.now()) {
  const s = { ...(srs || newSrs()) };
  const q = Q[grade] ?? 4;
  if (q < 3) {
    s.reps = 0;
    s.lapses = (s.lapses || 0) + 1;
    s.interval = 0;
    s.due = now + 10 * 60 * 1000;          // relearn in 10 minutes
  } else {
    if (s.reps === 0) s.interval = grade === 'easy' ? 4 : 1;
    else if (s.reps === 1) s.interval = grade === 'hard' ? 3 : 6;
    else {
      const mult = grade === 'hard' ? 1.2 : grade === 'easy' ? s.ease * 1.3 : s.ease;
      s.interval = Math.max(s.interval + 1, Math.round(s.interval * mult));
    }
    s.reps += 1;
    s.due = now + s.interval * DAY;
  }
  // SM-2 ease update
  s.ease = Math.max(1.3, s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  s.last = now;
  return s;
}

export const isDue = (srs, now = Date.now()) => !srs || srs.due <= now;

export function preview(srs, grade) {
  const n = review(srs, grade);
  if (n.interval === 0) return '10 dk';
  return n.interval === 1 ? '1 gün' : `${n.interval} gün`;
}
