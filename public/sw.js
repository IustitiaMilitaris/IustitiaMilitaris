const CACHE_NAME = 'ethical-simulator-__BUILD_ID__';
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(['/', '/index.html', '/manifest.json', '/brand-mark.svg', '/logo-full.png', '/icon-192.png', '/icon-512.png', '/images/s1.jpg', '/images/s2.jpg', '/images/s3.jpg', ...[] /* BUILD_ASSETS */])).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ethical-simulator-') && k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || /^\/(api|ws)(\/|$)/.test(url.pathname)) return;
  event.respondWith(fetch(event.request).then(async response => {
    if (response.ok) { const cache = await caches.open(CACHE_NAME); await cache.put(event.request.mode === 'navigate' ? '/index.html' : event.request, response.clone()); }
    return response;
  }).catch(async () => (await caches.match(event.request.mode === 'navigate' ? '/index.html' : event.request)) || Response.error()));
});
