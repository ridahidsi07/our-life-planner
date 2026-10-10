export type PwaOfflineMode =
  | 'sw_cached_ready'
  | 'standalone_file'
  | 'sw_installing'
  | 'shortcut_only';

export interface PwaOfflineStatus {
  mode: PwaOfflineMode;
  swSupported: boolean;
  swRegistered: boolean;
  swControlled: boolean;
  updateAvailable: boolean;
  cacheName: string | null;
  cachedPaths: string[];
  isShellComplete: boolean;
  canPromptInstall: boolean;
  statusSummary: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const CACHE_PREFIX = 'our-life-planner-shell-';
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const statusListeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of statusListeners) {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeToPwaStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function isStandaloneFileEdition(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as { __OLP_STANDALONE_FILE__?: boolean }).__OLP_STANDALONE_FILE__ ||
      window.location.protocol === 'file:'
  );
}

export function canUseServiceWorker(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (isStandaloneFileEdition()) return false;
  const proto = window.location.protocol;
  if (proto !== 'http:' && proto !== 'https:') return false;
  return 'serviceWorker' in navigator && 'caches' in window;
}

/**
 * Registers the PWA Service Worker (`/sw.js`) and sets up lifecycle listeners.
 */
export async function registerPwaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      deferredInstallPrompt = e as BeforeInstallPromptEvent;
      notifyListeners();
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      notifyListeners();
    });
  }

  if (!canUseServiceWorker()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (installing) {
        installing.addEventListener('statechange', () => {
          notifyListeners();
        });
      }
      notifyListeners();
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      notifyListeners();
    });

    notifyListeners();
    return registration;
  } catch (err) {
    console.warn('Service worker registration unavailable:', err);
    notifyListeners();
    return null;
  }
}

/**
 * Queries CacheStorage and ServiceWorkerRegistration to determine actual offline startup readiness.
 */
export async function inspectPwaOfflineStatus(): Promise<PwaOfflineStatus> {
  if (isStandaloneFileEdition()) {
    return {
      mode: 'standalone_file',
      swSupported: false,
      swRegistered: false,
      swControlled: false,
      updateAvailable: false,
      cacheName: null,
      cachedPaths: [],
      isShellComplete: true,
      canPromptInstall: false,
      statusSummary:
        'Running from the self-contained Standalone Offline HTML file. All code, styles, and local data operate without an internet connection.',
    };
  }

  if (!canUseServiceWorker()) {
    return {
      mode: 'shortcut_only',
      swSupported: false,
      swRegistered: false,
      swControlled: false,
      updateAvailable: false,
      cacheName: null,
      cachedPaths: [],
      isShellComplete: false,
      canPromptInstall: Boolean(deferredInstallPrompt),
      statusSummary:
        'Service Worker offline caching is not available in this browser context. Adding to Home Screen creates a launch shortcut only; use the Standalone Offline HTML bundle for offline use.',
    };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const swRegistered = Boolean(
      registration && (registration.active || registration.installing || registration.waiting)
    );
    const swControlled = Boolean(navigator.serviceWorker.controller);
    const updateAvailable = Boolean(registration?.waiting);

    let activeCacheName: string | null = null;
    let cachedPaths: string[] = [];

    const allCacheNames = await window.caches.keys();
    const shellCaches = allCacheNames.filter((name) => name.startsWith(CACHE_PREFIX));
    if (shellCaches.length > 0) {
      activeCacheName = shellCaches[shellCaches.length - 1];
      const cache = await window.caches.open(activeCacheName);
      const requests = await cache.keys();
      cachedPaths = requests.map((req) => {
        try {
          return new URL(req.url).pathname;
        } catch {
          return req.url;
        }
      });
    }

    const hasHtml = cachedPaths.includes('/index.html') || cachedPaths.includes('/');
    const isShellComplete = Boolean(registration?.active && hasHtml && cachedPaths.length >= 2);

    if (isShellComplete) {
      return {
        mode: 'sw_cached_ready',
        swSupported: true,
        swRegistered: true,
        swControlled,
        updateAvailable,
        cacheName: activeCacheName,
        cachedPaths,
        isShellComplete: true,
        canPromptInstall: Boolean(deferredInstallPrompt),
        statusSummary: `Offline app shell is cached and verified (${cachedPaths.length} shell resources in ${activeCacheName}). The planner can start and run without an internet connection.`,
      };
    }

    if (registration && (registration.installing || registration.active)) {
      return {
        mode: 'sw_installing',
        swSupported: true,
        swRegistered,
        swControlled,
        updateAvailable,
        cacheName: activeCacheName,
        cachedPaths,
        isShellComplete: false,
        canPromptInstall: Boolean(deferredInstallPrompt),
        statusSummary:
          'Service Worker is initializing the offline app shell cache. Keep this tab open for a moment or click Verify & Repair Cache below.',
      };
    }

    return {
      mode: 'shortcut_only',
      swSupported: true,
      swRegistered: false,
      swControlled: false,
      updateAvailable: false,
      cacheName: null,
      cachedPaths: [],
      isShellComplete: false,
      canPromptInstall: Boolean(deferredInstallPrompt),
      statusSummary:
        'Offline Service Worker cache is not yet registered. Adding to Home Screen will act as a browser shortcut until the offline cache is active, or you can download the Standalone Offline HTML bundle.',
    };
  } catch {
    return {
      mode: 'shortcut_only',
      swSupported: false,
      swRegistered: false,
      swControlled: false,
      updateAvailable: false,
      cacheName: null,
      cachedPaths: [],
      isShellComplete: false,
      canPromptInstall: Boolean(deferredInstallPrompt),
      statusSummary:
        'Could not verify Service Worker cache storage. Use the Standalone Offline HTML bundle if you need guaranteed offline startup.',
    };
  }
}

/**
 * Checks for an updated Service Worker script on the server.
 */
export async function checkForPwaUpdate(): Promise<{
  checked: boolean;
  updateAvailable: boolean;
}> {
  if (!canUseServiceWorker()) {
    return { checked: false, updateAvailable: false };
  }
  try {
    const registration =
      (await navigator.serviceWorker.getRegistration('/')) ||
      (await registerPwaServiceWorker());
    if (!registration) {
      return { checked: false, updateAvailable: false };
    }
    await registration.update();
    if (registration.installing) {
      const worker = registration.installing;
      await new Promise<void>((resolve) => {
        const onStateChange = () => {
          if (
            worker.state === 'installed' ||
            worker.state === 'activated' ||
            worker.state === 'redundant'
          ) {
            worker.removeEventListener('statechange', onStateChange);
            resolve();
          }
        };
        worker.addEventListener('statechange', onStateChange);
        setTimeout(resolve, 2500);
      });
    }
    notifyListeners();
    return {
      checked: true,
      updateAvailable: Boolean(registration.waiting),
    };
  } catch {
    return { checked: false, updateAvailable: false };
  }
}

/**
 * Activates a waiting Service Worker update (`SKIP_WAITING`).
 */
export async function applyWaitingPwaUpdate(): Promise<boolean> {
  if (!canUseServiceWorker()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration || !registration.waiting) return false;

    await new Promise<void>((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve();
      registration.waiting!.postMessage({ type: 'SKIP_WAITING' }, [channel.port2]);
      setTimeout(resolve, 500);
    });
    notifyListeners();
    return true;
  } catch {
    return false;
  }
}

/**
 * Recovers/repairs the offline app shell cache without modifying any user planner data in localStorage.
 */
export async function recoverPwaOfflineCache(): Promise<PwaOfflineStatus> {
  if (!canUseServiceWorker()) {
    return inspectPwaOfflineStatus();
  }

  try {
    let registration: ServiceWorkerRegistration | undefined | null =
      await navigator.serviceWorker.getRegistration('/');
    if (!registration) {
      registration = await registerPwaServiceWorker();
    }

    if (registration?.active) {
      await new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        registration!.active!.postMessage({ type: 'RECOVER_CACHE' }, [channel.port2]);
        setTimeout(resolve, 1500);
      });
    } else {
      // Fallback: purge shell caches and re-register
      const keys = await window.caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => window.caches.delete(k))
      );
      await registerPwaServiceWorker();
    }
  } catch (err) {
    console.warn('Error during PWA cache recovery:', err);
  }

  notifyListeners();
  return inspectPwaOfflineStatus();
}

/**
 * Triggers the browser's native install prompt if captured via `beforeinstallprompt`.
 */
export async function triggerNativeInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredInstallPrompt) return 'unavailable';
  try {
    await deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    notifyListeners();
    return choice.outcome;
  } catch {
    return 'unavailable';
  }
}
