const CACHE = 'skinconcept-v8-auto-update-' + Date.now();
const ASSETS = [
  './', './index.html', './style.css', './shared.js',
  './kundenkartei.html', './kunden.html', './finanzen.html',
  './preislisten.html', './bestellungen.html',
  './aufgaben.html', './monatsabschluss.html',
  './import-kunden.html', './rechnungen.html', './jspdf.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network first, fallback to cache
  e.respondWith(
    fetch(e.request).then(r => {
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return r;
    }).catch(() => caches.match(e.request))
  );
});
