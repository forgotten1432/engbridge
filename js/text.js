// Text helpers: escaping, answer normalisation, word diff for dictation.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CONTRACTIONS = [
  [/\bi'm\b/g, 'i am'], [/\byou're\b/g, 'you are'], [/\bwe're\b/g, 'we are'], [/\bthey're\b/g, 'they are'],
  [/\b(he|she|it|that|what|there)'s\b/g, '$1 is'], [/\bisn't\b/g, 'is not'], [/\baren't\b/g, 'are not'],
  [/\bwasn't\b/g, 'was not'], [/\bweren't\b/g, 'were not'], [/\bdon't\b/g, 'do not'], [/\bdoesn't\b/g, 'does not'],
  [/\bdidn't\b/g, 'did not'], [/\bhaven't\b/g, 'have not'], [/\bhasn't\b/g, 'has not'], [/\bhadn't\b/g, 'had not'],
  [/\bwon't\b/g, 'will not'], [/\bwouldn't\b/g, 'would not'], [/\bcan't\b/g, 'cannot'], [/\bcouldn't\b/g, 'could not'],
  [/\bshouldn't\b/g, 'should not'], [/\b(i|you|we|they|he|she|it)'ve\b/g, '$1 have'], [/\b(i|you|we|they|he|she|it)'d\b/g, '$1 would'],
  [/\b(i|you|we|they|he|she|it)'ll\b/g, '$1 will'],
];

// Normalise for comparison: case, apostrophes, punctuation, spacing, contractions.
export function norm(s, { expand = true } = {}) {
  let t = String(s ?? '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/[“”]/g, '"');
  if (expand) for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep);
  return t.replace(/[.,!?;:"()]/g, ' ').replace(/\s+/g, ' ').trim();
}

export const matches = (input, answers) => {
  const n = norm(input);
  return (Array.isArray(answers) ? answers : [answers]).some(a => norm(a) === n);
};

export const SMALL_WORDS = new Set(['is', 'are', 'am', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'a', 'an', 'the', 'to', 'of', 'will', 'would']);

// Word-level LCS diff. Returns tokens {w, kind:'ok'|'miss'|'extra', small}
export function wordDiff(expected, typed) {
  const A = norm(expected).split(' ').filter(Boolean);
  const B = norm(typed).split(' ').filter(Boolean);
  const m = A.length, n = B.length;
  const L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--)
    L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < m && j < n) {
    if (A[i] === B[j]) { out.push({ w: A[i], kind: 'ok' }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { out.push({ w: A[i], kind: 'miss', small: SMALL_WORDS.has(A[i]) }); i++; }
    else { out.push({ w: B[j], kind: 'extra' }); j++; }
  }
  while (i < m) { out.push({ w: A[i], kind: 'miss', small: SMALL_WORDS.has(A[i]) }); i++; }
  while (j < n) { out.push({ w: B[j], kind: 'extra' }); j++; }
  const correct = out.filter(t => t.kind === 'ok').length;
  return { tokens: out, score: m ? Math.round(100 * correct / Math.max(m, n)) : 0, missedSmall: out.filter(t => t.kind === 'miss' && t.small).map(t => t.w) };
}

export const renderDiff = d => `<p class="diff">${d.tokens.map(t => `<span class="${t.kind}${t.small ? ' small' : ''}">${esc(t.w)}</span>`).join(' ')}</p>`;

// Simple Markdown-ish → HTML (bold, italics, line breaks). Input is escaped first.
export const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>').replace(/\n/g, '<br>');
