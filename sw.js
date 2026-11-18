// Offline support. App shell: cache-first. Content JSON: network-first with cache fallback,
// so new lessons appear as soon as they are published.
const VERSION = 'engbridge-v2';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png',
  './css/app.css?v=1', './js/app.js?v=1', './js/app.js', './js/store.js', './js/srs.js', './js/text.js', './js/speech.js',
  './js/ui.js', './js/content.js', './js/errors.js', './js/ai.js', './js/exercise.js',
  './js/views/learn.js', './js/views/read.js', './js/views/errors.js', './js/views/vault.js', './js/views/ai.js',
  './content/curriculum.json', './content/dictation.json', './content/vocab.json', './content/errors.json', './content/reading/index.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;           // e.g. Gemini API: never cached
  if (url.pathname.includes('/content/')) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => caches.match(req).then(r => r || new Response('{"error":"offline"}', { status: 503, headers: { 'Content-Type': 'application/json' } }))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return r;
  }).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
