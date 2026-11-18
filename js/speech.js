// Web Speech API wrapper (English voices).
import { get } from './store.js';

export const canSpeak = () => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

export function englishVoices() {
  if (!canSpeak()) return [];
  return speechSynthesis.getVoices().filter(v => /^en[-_]/i.test(v.lang));
}

function pickVoice() {
  const voices = englishVoices();
  const chosen = voices.find(v => v.voiceURI === get().settings.voiceURI);
  if (chosen) return chosen;
  const rank = v => (/en[-_]US/i.test(v.lang) ? 3 : /en[-_]GB/i.test(v.lang) ? 2 : 0) + (/premium|enhanced|natural/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);
  return voices.sort((a, b) => rank(b) - rank(a))[0] || null;
}

export function speak(text, { rate, onend } = {}) {
  if (!canSpeak() || !text) { onend?.(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text));
  const v = pickVoice();
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
  u.rate = rate ?? (Number(get().settings.rate) || 1);
  if (onend) { u.onend = onend; u.onerror = onend; }
  speechSynthesis.speak(u);
}

export const stop = () => canSpeak() && speechSynthesis.cancel();
if (canSpeak()) speechSynthesis.onvoiceschanged = () => {};
