// Service worker (PWA): the morning page opens instantly and works offline.
// - Pages (/today, /editions…): network first, 4 s timeout, then the cached copy. Every page that
//   loads is cached, so the last edition you opened is readable on the U-Bahn.
// - Static files (CSS, fonts, scripts, icons): served from cache, refreshed in the background.
// - Never cached: /admin, /api, /probe and anything that is not a GET.
// Bump VERSION when the list of precached files changes; old caches are removed on activate.
const VERSION = 'v4';
const PAGES = `ranica-pages-${VERSION}`;
const STATIC = `ranica-static-${VERSION}`;
const PRECACHE = [
  '/today',
  '/app.css',
  '/css/tokens.css',
  '/css/ranica.css',
  '/fonts/fonts.css',
  '/fit.js',
  '/icons/icon-192.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC).then((c) => c.addAll(PRECACHE.filter((p) => p !== '/today')))
      .then(() => caches.open(PAGES)).then((c) => c.add('/today').catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ranica-') && k !== PAGES && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const NEVER = /^\/(admin|api|probe|health)(\/|$)/;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || NEVER.test(url.pathname)) return;

  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(PAGES);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = (await cache.match(req)) ?? (await cache.match('/today'));
    return hit ?? new Response('<!doctype html><meta charset="utf-8"><title>Ranica</title><p style="font-family:serif;padding:2em">Offline, and this page has not been opened before.</p>', {
      status: 503,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  return hit ?? (await fresh) ?? new Response('', { status: 504 });
}
