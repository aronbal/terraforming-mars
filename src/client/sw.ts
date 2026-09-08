const CACHE_NAME = 'terraforming-mars-static-v1';

const STATIC_ASSETS = [
  '/',
  '/styles.css',
  '/vendors.js',
  '/main.js',
  '/manifest.json',
  '/favicon.ico',
];

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const request = event.request;

  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  const url = new URL(request.url);

  // Never cache game/API requests. Game state must always come from the server.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket')) {
    return;
  }

  // Cache static resources, while using the network first so new deployments
  // are picked up without serving stale application code indefinitely.
  if (url.pathname === '/'
      || url.pathname === '/styles.css'
      || url.pathname === '/vendors.js'
      || url.pathname === '/main.js'
      || url.pathname === '/manifest.json'
      || url.pathname === '/favicon.ico'
      || url.pathname.startsWith('/chunks/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error())),
    );
  }
});
