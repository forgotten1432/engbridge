// Error Hunter log: every wrong answer becomes a spaced-repetition item.
import { get, save, uid } from './store.js';
import { newSrs, review, isDue } from './srs.js';
import { norm } from './text.js';

export const MASTER_STREAK = 3;

// item: {prompt, answer:[...]|string, user, rule, explain, source}
export function addError(item) {
  const s = get();
  const answers = Array.isArray(item.answer) ? item.answer : [item.answer];
  const key = norm(item.prompt) + '|' + norm(answers[0]);
  const existing = s.errors.find(e => e.key === key);
  if (existing) {
    existing.count = (existing.count || 1) + 1;
    existing.user = item.user ?? existing.user;
    existing.streak = 0;
    existing.mastered = false;
    existing.srs = { ...(existing.srs || newSrs()), due: Date.now() };
  } else {
    s.errors.unshift({
      id: uid(), key, prompt: item.prompt, answer: answers, user: item.user || '',
      rule: item.rule || 'general', explain: item.explain || '', source: item.source || 'manual',
      count: 1, streak: 0, mastered: false, createdAt: Date.now(), srs: newSrs(),
    });
  }
  save();
}

export const dueErrors = () => get().errors.filter(e => !e.mastered && isDue(e.srs));
export const activeErrors = () => get().errors.filter(e => !e.mastered);

export function answerError(id, correct) {
  const e = get().errors.find(x => x.id === id);
  if (!e) return null;
  if (correct) {
    e.streak = (e.streak || 0) + 1;
    e.srs = review(e.srs, 'good');
    if (e.streak >= MASTER_STREAK) { e.mastered = true; e.masteredAt = Date.now(); }
  } else {
    e.streak = 0;
    e.count = (e.count || 1) + 1;
    e.srs = review(e.srs, 'again');
  }
  save();
  return e;
}

export function removeError(id) {
  const s = get();
  s.errors = s.errors.filter(e => e.id !== id);
  save();
}

// rule -> number of active errors (for the exercise generator)
export function ruleCounts() {
  const counts = {};
  for (const e of activeErrors()) counts[e.rule] = (counts[e.rule] || 0) + (e.count || 1);
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}
