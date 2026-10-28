const CACHE_VERSION = 'v1-indexGnhAoXeAjs-indexCwg4vGncss';
const CACHE_PREFIX = 'our-life-planner-shell-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// Precache assets specified relative to the service worker scope
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./icon-192.svg",
  "./icon-512.svg",
  "./assets/index-Cwg4v-Gn.css",
  "./assets/index-GnhAoXeA.js"
];

function getScopeBaseUrl() {
  const scope = self.registration ? self.registration.scope : self.location.href;
  return scope.endsWith('/') ? scope : scope + '/';
}

function toAbsoluteUrl(relOrAbs) {
  return new URL(relOrAbs, getScopeBaseUrl()).href;
}

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const scopeUrl = toAbsoluteUrl('./');
  const indexUrl = toAbsoluteUrl('./index.html');

  try {
    await Promise.all(
      PRECACHE_ASSETS.map(async (assetPath) => {
        const fullUrl = toAbsoluteUrl(assetPath);
        const response = await fetch(fullUrl, { cache: 'reload' });
        if (!response || !response.ok) {
          throw new Error(
            `[SW] Precache failed for required asset: ${assetPath} (status: ${
              response ? response.status : 'network error'
            })`
          );
        }
        await cache.put(fullUrl, response.clone());
        const pathname = new URL(fullUrl).pathname;
        if (pathname !== fullUrl) {
          await cache.put(pathname, response.clone());
        }
        if (assetPath === './index.html' || fullUrl === indexUrl) {
          await cache.put(scopeUrl, response.clone());
          const scopePath = new URL(scopeUrl).pathname;
          if (scopePath !== scopeUrl) {
            await cache.put(scopePath, response.clone());
          }
        }
      })
    );
  } catch (err) {
    console.error('[SW] Precache failed; aborting install to preserve previous release:', err);
    try {
      await caches.delete(CACHE_NAME);
    } catch {
      // ignore deletion errors
    }
    throw err;
  }
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
        const scopeUrl = toAbsoluteUrl('./');
        const indexUrl = toAbsoluteUrl('./index.html');
        const scopePath = new URL(scopeUrl).pathname;
        const indexPath = new URL(indexUrl).pathname;

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            await cache.put(indexUrl, networkResponse.clone());
            await cache.put(scopeUrl, networkResponse.clone());
            await cache.put(indexPath, networkResponse.clone());
            await cache.put(scopePath, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          // Offline navigation fallback: check exact URL, then index/scope URLs, then pathnames
          const cachedExact = await cache.match(request);
          if (cachedExact) return cachedExact;

          const cachedIndexUrl = await cache.match(indexUrl);
          if (cachedIndexUrl) return cachedIndexUrl;

          const cachedScopeUrl = await cache.match(scopeUrl);
          if (cachedScopeUrl) return cachedScopeUrl;

          const cachedIndexPath = await cache.match(indexPath);
          if (cachedIndexPath) return cachedIndexPath;

          const cachedScopePath = await cache.match(scopePath);
          if (cachedScopePath) return cachedScopePath;

          const cachedFallback = (await cache.match('/index.html')) || (await cache.match('/'));
          if (cachedFallback) return cachedFallback;

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

      const cachedPath = await cache.match(url.pathname);
      if (cachedPath) {
        return cachedPath;
      }

      try {
        const networkResponse = await fetch(request);
        if (
          networkResponse &&
          networkResponse.ok &&
          (url.pathname.includes('/assets/') ||
            url.pathname.endsWith('.png') ||
            url.pathname.endsWith('.svg') ||
            url.pathname.endsWith('.webmanifest') ||
            url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.js'))
        ) {
          await cache.put(request, networkResponse.clone());
          await cache.put(url.pathname, networkResponse.clone());
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
          const cachedUrls = keys.map((req) => req.url);
          const cachedPaths = keys.map((req) => {
            try {
              return new URL(req.url).pathname;
            } catch {
              return req.url;
            }
          });

          const indexUrl = toAbsoluteUrl('./index.html');
          const scopeUrl = toAbsoluteUrl('./');
          const indexPath = new URL(indexUrl).pathname;
          const scopePath = new URL(scopeUrl).pathname;

          const hasHtml =
            cachedUrls.includes(indexUrl) ||
            cachedUrls.includes(scopeUrl) ||
            cachedPaths.includes(indexPath) ||
            cachedPaths.includes(scopePath) ||
            cachedPaths.includes('/index.html') ||
            cachedPaths.includes('/');

          const jsAssets = PRECACHE_ASSETS.filter((p) => p.endsWith('.js') || p.includes('.js?'));
          const cssAssets = PRECACHE_ASSETS.filter((p) => p.endsWith('.css') || p.includes('.css?'));

          const hasAnyJs =
            cachedPaths.some((p) => p.endsWith('.js')) ||
            cachedUrls.some((u) => u.includes('.js'));
          const hasAnyCss =
            cachedPaths.some((p) => p.endsWith('.css')) ||
            cachedUrls.some((u) => u.includes('.css'));

          const hasJs =
            jsAssets.length > 0
              ? jsAssets.every((p) => {
                  const full = toAbsoluteUrl(p);
                  const pth = new URL(full).pathname;
                  return cachedUrls.includes(full) || cachedPaths.includes(pth);
                })
              : hasAnyJs;

          const hasCss =
            cssAssets.length > 0
              ? cssAssets.every((p) => {
                  const full = toAbsoluteUrl(p);
                  const pth = new URL(full).pathname;
                  return cachedUrls.includes(full) || cachedPaths.includes(pth);
                })
              : hasAnyCss;

          const isShellComplete = Boolean(hasHtml && hasJs && hasCss);

          if (replyPort) {
            replyPort.postMessage({
              ok: true,
              cacheName: CACHE_NAME,
              version: CACHE_VERSION,
              cachedPaths,
              hasHtml,
              hasJs,
              hasCss,
              isShellComplete,
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
          const cachedPaths = keys.map((req) => {
            try {
              return new URL(req.url).pathname;
            } catch {
              return req.url;
            }
          });
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
