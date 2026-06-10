/* Motorcycle Log service worker, deliberately tiny.
   Stale-while-revalidate for the static shell; the sync API is never cached. */
const CACHE = 'odo-v2';
const ASSETS = [
  '/', '/index.html', '/style.css', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Only GETs to our own origin are cacheable; the sync API must always hit the network.
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok && url.origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network; // serve cache fast, refresh in the background
    })
  );
});
