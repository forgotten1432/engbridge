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

// Open lexicon (CEFR-J / Octanove levels, WordNet definitions, CMU IPA)
export const lexiconIndex = () => json('content/lexicon/index.json');
export const lexiconLevel = lv => json(`content/lexicon/${lv}.json`);
let lexMap = null;
export async function lexiconLookup(word) {
  if (!lexMap) {
    lexMap = new Map();
    for (const lv of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      try { for (const e of await lexiconLevel(lv)) if (!lexMap.has(e.w.toLowerCase())) lexMap.set(e.w.toLowerCase(), { ...e, level: lv }); } catch {}
    }
  }
  const w = String(word || '').toLowerCase().replace(/[’']s$/, '').replace(/[^a-z\-' ]/g, '');
  const tries = [w, w.replace(/ies$/, 'y'), w.replace(/es$/, ''), w.replace(/s$/, ''), w.replace(/ied$/, 'y'), w.replace(/ed$/, ''), w.replace(/ed$/, 'e'), w.replace(/d$/, ''),
    w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/([a-z])\1ing$/, '$1'), w.replace(/([a-z])\1ed$/, '$1'), w.replace(/er$/, ''), w.replace(/est$/, ''), w.replace(/ly$/, ''), w.replace(/ier$/, 'y'), w.replace(/iest$/, 'y')];
  for (const t of tries) if (t && lexMap.has(t)) return lexMap.get(t);
  return null;
}
