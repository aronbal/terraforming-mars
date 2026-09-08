const CACHE_NAME = 'terraforming-mars-static-v1';

const STATIC_ASSETS = [
  '/',
  '/styles.css',
  '/mobile.css',
  '/vendors.js',
  '/main.js',
  '/manifest.json',
  '/favicon.ico',
];

// TypeScript is configured with DOM types rather than WebWorker types.
// Keep the service-worker-specific browser APIs local to this file.
const serviceWorker = self as any;

serviceWorker.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  serviceWorker.skipWaiting();
});

serviceWorker.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )),
  );
  serviceWorker.clients.claim();
});

serviceWorker.addEventListener('fetch', (event: any) => {
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
      || url.pathname === '/mobile.css'
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
