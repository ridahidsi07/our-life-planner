const CACHE_VERSION = 'v1-indexDhShGUpMjs-indexCErgnZ2css';
const CACHE_PREFIX = 'our-life-planner-shell-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon-192.svg",
  "/icon-512.svg",
  "/assets/index-CErgn_Z2.css",
  "/assets/index-DhShGUpM.js"
];

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    PRECACHE_ASSETS.map(async (assetUrl) => {
      try {
        const response = await fetch(assetUrl, { cache: 'reload' });
        if (response && response.ok) {
          await cache.put(assetUrl, response.clone());
          if (assetUrl === '/index.html') {
            await cache.put('/', response.clone());
          }
        }
      } catch (err) {
        console.warn('[SW] Could not precache asset:', assetUrl, err);
      }
    })
  );
}

self.addEventListener('install', (event) => {
  const isInitialInstall = !self.registration.active;
  event.waitUntil(
    precacheAppShell().then(() => {
      if (isInitialInstall) {
        return self.skipWaiting();
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve(false);
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            await cache.put('/index.html', networkResponse.clone());
            await cache.put('/', networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cachedExact = await cache.match(request);
          if (cachedExact) return cachedExact;
          const cachedIndex = await cache.match('/index.html');
          if (cachedIndex) return cachedIndex;
          const cachedRoot = await cache.match('/');
          if (cachedRoot) return cachedRoot;
          return new Response(
            '<!doctype html><html><head><meta charset="utf-8"><title>Offline</title></head><body><h1>Our Life Planner</h1><p>Offline cache is not yet initialized. Please reconnect once and reload.</p></body></html>',
            {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        }
      })()
    );
    return;
  }

  // Static shell assets: Cache-first with network fallback and runtime cache population
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }
      try {
        const networkResponse = await fetch(request);
        if (
          networkResponse &&
          networkResponse.ok &&
          (url.pathname.startsWith('/assets/') ||
            url.pathname.endsWith('.svg') ||
            url.pathname.endsWith('.webmanifest') ||
            url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.js'))
        ) {
          await cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        throw err;
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  const replyPort = event.ports && event.ports[0];

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting().then(() => {
      if (replyPort) {
        replyPort.postMessage({ ok: true, version: CACHE_VERSION });
      }
    });
    return;
  }

  if (data.type === 'GET_CACHE_STATUS') {
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          const keys = await cache.keys();
          const cachedPaths = keys.map((req) => new URL(req.url).pathname);
          const hasHtml =
            cachedPaths.includes('/index.html') || cachedPaths.includes('/');
          const hasBundle =
            PRECACHE_ASSETS.filter((p) => p.startsWith('/assets/')).every((p) =>
              cachedPaths.includes(p)
            );
          if (replyPort) {
            replyPort.postMessage({
              ok: true,
              cacheName: CACHE_NAME,
              version: CACHE_VERSION,
              cachedPaths,
              isShellComplete: hasHtml && hasBundle,
            });
          }
        } catch (err) {
          if (replyPort) {
            replyPort.postMessage({
              ok: false,
              error: err && err.message ? err.message : String(err),
            });
          }
        }
      })()
    );
    return;
  }

  if (data.type === 'RECOVER_CACHE') {
    event.waitUntil(
      (async () => {
        try {
          const allKeys = await caches.keys();
          await Promise.all(
            allKeys
              .filter((k) => k.startsWith(CACHE_PREFIX))
              .map((k) => caches.delete(k))
          );
          await precacheAppShell();
          const cache = await caches.open(CACHE_NAME);
          const keys = await cache.keys();
          const cachedPaths = keys.map((req) => new URL(req.url).pathname);
          if (replyPort) {
            replyPort.postMessage({
              ok: true,
              cacheName: CACHE_NAME,
              version: CACHE_VERSION,
              cachedPaths,
            });
          }
        } catch (err) {
          if (replyPort) {
            replyPort.postMessage({
              ok: false,
              error: err && err.message ? err.message : String(err),
            });
          }
        }
      })()
    );
  }
});
