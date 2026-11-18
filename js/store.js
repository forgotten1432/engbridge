// Persistent state in localStorage with JSON backup / restore.
const KEY = 'engbridge.v1';
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function fresh() {
  return {
    version: 1,
    profile: { level: 'B1', createdAt: Date.now() },
    lessons: {},          // lessonId -> {best, attempts, done, last}
    errors: [],           // error log items (SM-2 scheduled)
    vault: [],            // vocabulary cards (SM-2 scheduled)
    reading: {},          // passageId -> {score, last}
    dictation: {},        // sentenceId -> {best, attempts}
    seeded: { errors: false, vault: false },
    settings: { apiKey: '', model: 'gemini-2.5-flash', rate: 1, voiceURI: '' },
  };
}

function merge(base, data) {
  const out = { ...base, ...data };
  for (const k of ['profile', 'seeded', 'settings']) out[k] = { ...base[k], ...(data?.[k] || {}) };
  for (const k of ['lessons', 'reading', 'dictation']) out[k] = { ...(data?.[k] || {}) };
  for (const k of ['errors', 'vault']) out[k] = Array.isArray(data?.[k]) ? data[k] : [];
  return out;
}

let state = (() => {
  try { const raw = localStorage.getItem(KEY); return raw ? merge(fresh(), JSON.parse(raw)) : fresh(); }
  catch { return fresh(); }
})();

const listeners = new Set();
export const get = () => state;
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('save failed', e); }
  listeners.forEach(f => f(state));
}
export const onChange = f => listeners.add(f);

export function exportBackup() {
  const blob = new Blob([JSON.stringify({ app: 'engbridge', exportedAt: new Date().toISOString(), state }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `engbridge-yedek-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function importBackup(file) {
  const data = JSON.parse(await file.text());
  const s = data?.state || data;
  if (!s || typeof s !== 'object' || !('profile' in s)) throw new Error('Bu dosya bir EngBridge yedeği değil.');
  state = merge(fresh(), s);
  save();
}

export function resetAll() { state = fresh(); save(); }
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
