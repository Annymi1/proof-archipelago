// Proof Archipelago — offline cache.
// The game page (index.html) keeps itself up to date: it is served from the cache at once, and every time the game
// is opened the page asks this worker to compare the cached copy with the server ('pa-check' below).
// Bump VERSION only after changing an icon, the manifest or this file.
const VERSION = 'pa-v10';
const CORE = ['./', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './maskable-512.png',
  './apple-touch-icon.png', './favicon-64.png'];
const PAGE = new URL('./index.html', self.location).href, ROOT = new URL('./', self.location).href;

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's HTTP cache, so an update never stores a stale page
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// This worker reads and writes only its own cache. A worker that has been replaced may still be finishing a request:
// it must not write any more, or it would bring back the cache that the new worker has just removed.
const replaced = () => !!self.serviceWorker && self.serviceWorker.state === 'redundant';
const cached = req => caches.match(req, { cacheName: VERSION, ignoreSearch: true });
// only good answers go into the cache: a 404 or a 500 must not be served forever
const keep = r => !!r && r.ok;
const store = (req, r) => {
  if (!keep(r) || replaced()) return;
  const copy = r.clone();
  caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
};

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google Fonts: serve from cache, refresh in the background
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') {
    e.respondWith(caches.match(req, { cacheName: VERSION }).then(hit => {
      const net = fetch(req).then(r => { store(req, r); return r; }).catch(() => hit || Response.error());
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // the game itself: cache first, fall back to the network; offline, a page request gets the game
  e.respondWith(cached(req).then(hit => hit || fetch(req).then(r => { store(req, r); return r; })
    .catch(async () => (req.mode === 'navigate' && await cached(PAGE)) || Response.error())));
});

// 'pa-check' from an open page: fetch the page from the server; if it differs from the cached copy, store the new one
// and tell that page ('pa-update'), which then offers a reload. Offline or on an error nothing happens.
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'pa-check') return;
  e.waitUntil((async () => {
    const old = await cached(PAGE);
    const r = await fetch(PAGE, { cache: 'no-cache' }).catch(() => null);
    if (!keep(r) || replaced()) return;
    const fresh = await r.clone().text(), before = old ? await old.text() : null;
    if (fresh === before || replaced()) return;
    const c = await caches.open(VERSION);
    await Promise.all([c.put(PAGE, r.clone()), c.put(ROOT, r.clone())]);
    if (before !== null && e.source) e.source.postMessage({ type: 'pa-update' });
  })());
});
