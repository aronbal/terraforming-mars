/*
 * The service worker.
 *
 * It exists chiefly so the browser will show client-side notifications, and so the
 * app can be installed to a phone's home screen. Beyond that it caches only the
 * artwork and fonts under `assets/`: those never change without changing their name,
 * they are the bulk of what a phone downloads, and getting one from cache cannot show
 * a player a stale game.
 *
 * Nothing else is cached. API responses, the HTML shell and the scripts all stay on
 * the network, so a deploy takes effect on the next load and game state is never served
 * from yesterday.
 */

const CACHE_NAME = 'tm-assets-v1';

const CACHEABLE_SUFFIXES = ['.png', '.jpg', '.jpeg', '.svg', '.ttf', '.woff2'];

type ExtendableEventLike = Event & {
  waitUntil(promise: Promise<unknown>): void;
};

type FetchEventLike = ExtendableEventLike & {
  readonly request: Request;
  respondWith(response: Promise<Response> | Response): void;
};

type ServiceWorkerScope = {
  addEventListener(type: string, listener: (event: Event) => void): void;
  skipWaiting(): Promise<void>;
  clients: {claim(): Promise<void>};
  caches: CacheStorage;
  location: Location;
};

const worker = self as unknown as ServiceWorkerScope;

function isCacheableAsset(request: Request): boolean {
  if (request.method !== 'GET') {
    return false;
  }
  const url = new URL(request.url);
  if (url.origin !== worker.location.origin) {
    return false;
  }
  if (!url.pathname.includes('/assets/')) {
    return false;
  }
  return CACHEABLE_SUFFIXES.some((suffix) => url.pathname.endsWith(suffix));
}

async function fromCacheElseNetwork(request: Request): Promise<Response> {
  const cache = await worker.caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached !== undefined) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

worker.addEventListener('install', (event) => {
  (event as ExtendableEventLike).waitUntil(worker.skipWaiting());
});

worker.addEventListener('activate', (event) => {
  (event as ExtendableEventLike).waitUntil((async () => {
    const names = await worker.caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => worker.caches.delete(name)));
    await worker.clients.claim();
  })());
});

worker.addEventListener('fetch', (event) => {
  const fetchEvent = event as FetchEventLike;
  if (isCacheableAsset(fetchEvent.request)) {
    fetchEvent.respondWith(fromCacheElseNetwork(fetchEvent.request));
  }
});
