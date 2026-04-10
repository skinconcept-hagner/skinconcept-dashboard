const CACHE = 'skinconcept-v1';
const ASSETS = [
  './', './index.html', './style.css', './shared.js',
  './kundenkartei.html', './kunden.html', './finanzen.html',
  './content.html', './preislisten.html', './bestellungen.html',
  './aufgaben.html', './nachsorge.html', './monatsabschluss.html',
  './import-kunden.html'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
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
