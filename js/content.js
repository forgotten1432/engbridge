// Loads curriculum and content JSON files from /content. Results are memoised.
const cache = new Map();

async function json(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch(path).then(r => {
    if (!r.ok) throw new Error(`${path} yüklenemedi (${r.status})`);
    return r.json();
  });
  cache.set(path, p);
  p.catch(() => cache.delete(path));
  return p;
}

export const curriculum = () => json('content/curriculum.json');
export const lesson = id => json(`content/lessons/${id}.json`);
export const readingIndex = () => json('content/reading/index.json');
export const passage = id => json(`content/reading/${id}.json`);
export const dictation = () => json('content/dictation.json');
export const vocabSeed = () => json('content/vocab.json');
export const errorSeed = () => json('content/errors.json');

// Flat lookups over curriculum
export async function allLessons() {
  const c = await curriculum();
  const out = [];
  for (const lv of c.levels) for (const m of lv.modules) for (const l of m.lessons) out.push({ ...l, level: lv.id, module: m.id, moduleTitle: m.title });
  return out;
}

export async function ruleName(rule) {
  const c = await curriculum();
  return c.rules?.[rule]?.tr || rule;
}
