import fs from 'fs';
import path from 'path';
import http from 'http';
import { execFile } from 'child_process';
import { INITIAL_SETTINGS } from '../src/utils/sampleData';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failed++;
  }
}

function findBrowserExecutable(): string | null {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

interface BrowserPwaReport {
  phase1SwRegistered?: boolean;
  phase1SwControlled?: boolean;
  phase1OfflineMode?: string;
  phase1BannerText?: string;
  phase1CachedPaths?: string[];
  phase2OfflineBootSucceeded?: boolean;
  phase2TaskTitleFound?: boolean;
  phase2NetworkHtmlHitsDuringOffline?: number;
  phase2NetworkAssetHitsDuringOffline?: number;
  phase3AfterDeleteMode?: string;
  phase3AfterRepairMode?: string;
  phase3AfterRepairCachedCount?: number;
  phase3UpdateDetected?: boolean;
  phase3UpdatedCacheName?: string;
  phase3TaskPreservedAfterRepair?: boolean;
  error?: string;
}

async function runBrowserPwaE2ETest(): Promise<BrowserPwaReport> {
  const browserExe = findBrowserExecutable();
  if (!browserExe) {
    throw new Error('No headless browser (Edge or Chrome) found on system.');
  }

  const distDir = path.resolve(process.cwd(), 'dist');
  const indexHtmlPath = path.resolve(distDir, 'index.html');
  const swPath = path.resolve(distDir, 'sw.js');

  if (!fs.existsSync(indexHtmlPath) || !fs.existsSync(swPath)) {
    throw new Error('dist/index.html or dist/sw.js missing. Run npm run build first.');
  }

  const rawIndexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
  const baseSwContent = fs.readFileSync(swPath, 'utf-8');

  const preSeedScript = `<script>
  try {
    if (!localStorage.getItem('our_life_planner_settings_v1')) {
      localStorage.setItem('our_life_planner_settings_v1', ${JSON.stringify(
        JSON.stringify({ ...INITIAL_SETTINGS, hasCompletedSetup: true })
      )});
    }
  } catch (e) {}
</script>`;

  const harnessScript = `
<script type="module">
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitForCondition(predicate, timeoutMs = 6000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await predicate();
      if (res) return res;
      await wait(100);
    }
    return null;
  }

  function clickAppInstallButton() {
    const installBtn = Array.from(document.querySelectorAll('button')).find(
      (b) =>
        (b.textContent || '').includes('App Install') ||
        (b.textContent || '').includes('Install App') ||
        (b.getAttribute('title') || '').toLowerCase().includes('install')
    );
    if (installBtn) {
      installBtn.click();
      return true;
    }
    return false;
  }

  async function runPwaHarness() {
    const phase = new URLSearchParams(window.location.search).get('phase') || '1';

    try {
      if (phase === '1') {
        // Wait for Service Worker registration & shell precache
        await navigator.serviceWorker.ready;
        await waitForCondition(async () => {
          const keys = await caches.keys();
          if (keys.length === 0) return false;
          const c = await caches.open(keys[0]);
          const reqs = await c.keys();
          return reqs.length >= 4 && Boolean(navigator.serviceWorker.controller);
        }, 5000);

        // Open PwaInstallModal via Sidebar button
        clickAppInstallButton();
        const banner = await waitForCondition(
          () => document.querySelector('[data-testid="pwa-offline-status-banner"]'),
          3000
        );

        const cacheNames = await caches.keys();
        let cachedPaths = [];
        if (cacheNames.length > 0) {
          const cache = await caches.open(cacheNames[0]);
          const keys = await cache.keys();
          cachedPaths = keys.map((r) => new URL(r.url).pathname);
        }

        // Save phase 1 state in sessionStorage and tell test server to switch to OFFLINE mode
        const phase1Data = {
          phase1SwRegistered: true,
          phase1SwControlled: Boolean(navigator.serviceWorker.controller),
          phase1OfflineMode: banner ? banner.getAttribute('data-offline-mode') : 'missing',
          phase1BannerText: banner ? (banner.textContent || '').trim() : '',
          phase1CachedPaths: cachedPaths,
        };
        sessionStorage.setItem('__pwa_test_phase1', JSON.stringify(phase1Data));

        await fetch('/__test_control?mode=offline', { method: 'POST' });
        // Navigate to phase=2 while server is in strict offline mode!
        window.location.href = '/?phase=2';
        return;
      }

      if (phase === '2') {
        // We just booted while the server is rejecting all HTML and asset requests!
        await wait(450);
        const rootEl = document.getElementById('root');
        const bodyText = document.body ? document.body.innerText : '';
        const booted = Boolean(
          rootEl &&
            rootEl.children.length > 0 &&
            (bodyText.includes('Today') || bodyText.includes('Our Life Planner'))
        );

        const phase2Data = {
          phase2OfflineBootSucceeded: booted,
          phase2TaskTitleFound: bodyText.includes('Finish Q3 tax prep') || bodyText.includes('Today'),
        };
        sessionStorage.setItem('__pwa_test_phase2', JSON.stringify(phase2Data));

        // Re-enable server so we can test cache recovery and SW update in phase 3
        await fetch('/__test_control?mode=online', { method: 'POST' });
        window.location.href = '/?phase=3';
        return;
      }

      if (phase === '3') {
        await wait(400);
        // 1. Delete all caches to simulate cache eviction/corruption
        const existingKeys = await caches.keys();
        for (const k of existingKeys) {
          await caches.delete(k);
        }

        // Open PwaInstallModal
        clickAppInstallButton();
        const bannerBefore = await waitForCondition(
          () => document.querySelector('[data-testid="pwa-offline-status-banner"]'),
          3000
        );
        const afterDeleteMode = bannerBefore
          ? bannerBefore.getAttribute('data-offline-mode')
          : 'unknown';

        // 2. Click "Verify & repair offline cache" button
        const repairBtn = document.querySelector('[data-testid="pwa-repair-cache-btn"]');
        if (!repairBtn) throw new Error('Repair cache button not found in PwaInstallModal');
        repairBtn.click();

        await waitForCondition(async () => {
          const b = document.querySelector('[data-testid="pwa-offline-status-banner"]');
          return b && b.getAttribute('data-offline-mode') === 'sw_cached_ready';
        }, 4000);

        const bannerAfter = document.querySelector('[data-testid="pwa-offline-status-banner"]');
        const afterRepairMode = bannerAfter
          ? bannerAfter.getAttribute('data-offline-mode')
          : 'unknown';

        const repairedKeys = await caches.keys();
        let afterRepairCachedCount = 0;
        if (repairedKeys.length > 0) {
          const c = await caches.open(repairedKeys[0]);
          afterRepairCachedCount = (await c.keys()).length;
        }

        // 3. Switch server to serve v2-updated Service Worker and click "Check for update"
        await fetch('/__test_control?sw=v2', { method: 'POST' });
        const checkUpdateBtn = document.querySelector('[data-testid="pwa-check-update-btn"]');
        if (!checkUpdateBtn) throw new Error('Check update button not found');
        checkUpdateBtn.click();

        const applyUpdateBtn = await waitForCondition(
          () => document.querySelector('[data-testid="pwa-apply-update-btn"]'),
          5000
        );
        const updateDetected = Boolean(applyUpdateBtn);
        if (applyUpdateBtn) {
          applyUpdateBtn.click();
          await wait(500);
        }

        const finalCacheKeys = await caches.keys();
        const phase1Data = JSON.parse(sessionStorage.getItem('__pwa_test_phase1') || '{}');
        const phase2Data = JSON.parse(sessionStorage.getItem('__pwa_test_phase2') || '{}');
        const storedSettings = localStorage.getItem('our_life_planner_settings_v1');

        await fetch('/__report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...phase1Data,
            ...phase2Data,
            phase3AfterDeleteMode: afterDeleteMode,
            phase3AfterRepairMode: afterRepairMode,
            phase3AfterRepairCachedCount: afterRepairCachedCount,
            phase3UpdateDetected: updateDetected,
            phase3UpdatedCacheName: finalCacheKeys[finalCacheKeys.length - 1] || null,
            phase3TaskPreservedAfterRepair: Boolean(storedSettings),
          }),
        });
      }
    } catch (err) {
      await fetch('/__test_control?mode=online', { method: 'POST' }).catch(() => {});
      await fetch('/__report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: err && err.message ? err.message : String(err),
        }),
      });
    }
  }

  setTimeout(runPwaHarness, 250);
</script>
<img src="/__hold.gif" style="display:none" />
`;

  const withPreSeed = rawIndexHtml.replace('<head>', `<head>\n${preSeedScript}`);
  const lastBodyIdx = withPreSeed.lastIndexOf('</body>');
  const instrumentedIndexHtml =
    withPreSeed.slice(0, lastBodyIdx) +
    harnessScript +
    '\n</body>' +
    withPreSeed.slice(lastBodyIdx + '</body>'.length);

  return new Promise<BrowserPwaReport>((resolve, reject) => {
    let holdResponses: http.ServerResponse[] = [];
    let resolved = false;
    let isServerOffline = false;
    let swVersionMode: 'v1' | 'v2' = 'v1';
    let networkHtmlHitsDuringOffline = 0;
    let networkAssetHitsDuringOffline = 0;

    const server = http.createServer((req, res) => {
      const reqUrl = req.url || '/';

      // Test control endpoints are always reachable by the harness
      if (reqUrl.startsWith('/__test_control')) {
        const u = new URL(reqUrl, 'http://127.0.0.1');
        if (u.searchParams.get('mode') === 'offline') {
          isServerOffline = true;
          networkHtmlHitsDuringOffline = 0;
          networkAssetHitsDuringOffline = 0;
        } else if (u.searchParams.get('mode') === 'online') {
          isServerOffline = false;
        }
        if (u.searchParams.get('sw') === 'v2') {
          swVersionMode = 'v2';
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
        return;
      }

      if (reqUrl === '/__hold.gif') {
        holdResponses.push(res);
        return;
      }

      if (reqUrl === '/__report' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
          for (const hr of holdResponses) {
            try {
              hr.writeHead(204);
              hr.end();
            } catch {
              // ignore
            }
          }
          holdResponses = [];
          if (!resolved) {
            resolved = true;
            try {
              const parsed = JSON.parse(body) as BrowserPwaReport;
              parsed.phase2NetworkHtmlHitsDuringOffline = networkHtmlHitsDuringOffline;
              parsed.phase2NetworkAssetHitsDuringOffline = networkAssetHitsDuringOffline;
              server.close();
              resolve(parsed);
            } catch (e) {
              server.close();
              reject(e);
            }
          }
        });
        return;
      }

      // When simulating offline mode, reject all app navigation and asset requests!
      if (isServerOffline) {
        if (reqUrl.startsWith('/assets/')) {
          networkAssetHitsDuringOffline++;
        } else {
          networkHtmlHitsDuringOffline++;
        }
        req.socket.destroy();
        return;
      }

      // Serve /sw.js
      if (reqUrl === '/sw.js') {
        const swContent =
          swVersionMode === 'v2'
            ? baseSwContent.replace(/const CACHE_VERSION = '([^']+)';/, "const CACHE_VERSION = '$1-v2';")
            : baseSwContent;
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        });
        res.end(swContent);
        return;
      }

      // Serve index.html for / or /index.html or /?phase=...
      const cleanPath = reqUrl.split('?')[0];
      if (cleanPath === '/' || cleanPath === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(instrumentedIndexHtml);
        return;
      }

      // Serve static files from dist/
      const filePath = path.resolve(distDir, `.${cleanPath}`);
      if (filePath.startsWith(distDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.js': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.webmanifest': 'application/manifest+json; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.html': 'text/html; charset=utf-8',
        };
        res.writeHead(200, {
          'Content-Type': mimeMap[ext] || 'application/octet-stream',
        });
        res.end(fs.readFileSync(filePath));
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('Could not bind local server'));
        return;
      }
      const url = `http://127.0.0.1:${addr.port}/?phase=1`;
      const userDataDir = path.resolve(
        process.cwd(),
        'dist',
        `.tmp-edge-pwa-${Date.now()}`
      );

      const child = execFile(
        browserExe,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          `--user-data-dir=${userDataDir}`,
          '--virtual-time-budget=25000',
          '--dump-dom',
          url,
        ],
        { timeout: 28000, maxBuffer: 10 * 1024 * 1024 },
        (err) => {
          setTimeout(() => {
            try {
              fs.rmSync(userDataDir, { recursive: true, force: true });
            } catch {
              // ignore
            }
          }, 500);
          if (!resolved) {
            resolved = true;
            server.close();
            reject(err || new Error('Browser exited before posting /__report'));
          }
        }
      );

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            child.kill();
          } catch {
            // ignore
          }
          server.close();
          reject(new Error('Timed out waiting for browser /__report'));
        }
      }, 27000);
    });
  });
}

async function runTests() {
  console.log('=== P2 PWA Manifest, Service Worker Offline Startup, Update & Recovery Verification ===\n');

  const distDir = path.resolve(process.cwd(), 'dist');

  // 1. Static Build & Manifest Verification
  console.log('1. Verifying Web App Manifest, Icons, index.html links, and built Service Worker...');
  const manifestPath = path.resolve(distDir, 'manifest.webmanifest');
  assert(fs.existsSync(manifestPath), 'dist/manifest.webmanifest exists');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert(
    manifest.name === 'Our Life Planner' &&
      manifest.display === 'standalone' &&
      manifest.start_url === '/' &&
      Array.isArray(manifest.icons) &&
      manifest.icons.length >= 2,
    'manifest.webmanifest defines standalone display, start_url "/", and app icons'
  );

  for (const icon of manifest.icons) {
    const iconFile = path.resolve(distDir, `.${icon.src}`);
    assert(fs.existsSync(iconFile), `Referenced manifest icon ${icon.src} exists in dist/`);
  }

  const distIndexHtml = fs.readFileSync(path.resolve(distDir, 'index.html'), 'utf-8');
  assert(
    distIndexHtml.includes('rel="manifest"') &&
      distIndexHtml.includes('href="/manifest.webmanifest"'),
    'dist/index.html includes <link rel="manifest" href="/manifest.webmanifest">'
  );

  const builtSwPath = path.resolve(distDir, 'sw.js');
  assert(fs.existsSync(builtSwPath), 'dist/sw.js exists');
  const builtSw = fs.readFileSync(builtSwPath, 'utf-8');
  assert(
    !builtSw.includes('__OLP_SW_CACHE_VERSION__') &&
      builtSw.includes('/assets/index-') &&
      builtSw.includes('.js') &&
      builtSw.includes('.css'),
    'dist/sw.js has build-stamped CACHE_VERSION and hashed /assets/*.js and /assets/*.css in PRECACHE_ASSETS'
  );

  // 2. End-to-End Headless Browser Verification of Offline Startup, Caching, Updates & Recovery
  console.log('\n2. Running headless browser E2E test (SW registration, precache, true offline startup, cache recovery & update)...');
  const report = await runBrowserPwaE2ETest();
  if (report.error) {
    console.error('  Browser test error:', report.error);
  }

  assert(!report.error, 'Headless browser PWA lifecycle test completed without error');
  assert(
    Boolean(report.phase1SwRegistered && report.phase1SwControlled),
    'Service Worker registers, activates, and controls the page on initial load'
  );
  assert(
    report.phase1OfflineMode === 'sw_cached_ready' &&
      Boolean(report.phase1BannerText?.includes('Offline App Shell Cached & Ready')),
    `PwaInstallModal verifies and displays "Offline App Shell Cached & Ready" (mode=${report.phase1OfflineMode})`
  );
  assert(
    Array.isArray(report.phase1CachedPaths) &&
      report.phase1CachedPaths.includes('/index.html') &&
      report.phase1CachedPaths.some((p) => p.startsWith('/assets/') && p.endsWith('.js')) &&
      report.phase1CachedPaths.some((p) => p.startsWith('/assets/') && p.endsWith('.css')),
    `CacheStorage contains /index.html and hashed JS/CSS bundles (${report.phase1CachedPaths?.length} cached paths)`
  );
  assert(
    Boolean(report.phase2OfflineBootSucceeded && report.phase2TaskTitleFound),
    'App starts and renders full planner UI from Service Worker cache when server rejects all network requests (true offline startup)'
  );
  assert(
    report.phase2NetworkAssetHitsDuringOffline === 0,
    `Hashed JS/CSS assets were served 100% from Service Worker cache during offline startup (network asset hits: ${report.phase2NetworkAssetHitsDuringOffline})`
  );
  assert(
    report.phase3AfterDeleteMode === 'sw_installing' &&
      report.phase3AfterRepairMode === 'sw_cached_ready' &&
      (report.phase3AfterRepairCachedCount || 0) >= 5 &&
      Boolean(report.phase3TaskPreservedAfterRepair),
    `Cache corruption/deletion is detected (${report.phase3AfterDeleteMode}) and "Verify & repair offline cache" restores full shell (${report.phase3AfterRepairCachedCount} assets) while preserving localStorage data`
  );
  assert(
    Boolean(report.phase3UpdateDetected) &&
      Boolean(report.phase3UpdatedCacheName?.endsWith('-v2')),
    `Service Worker update is detected and "Apply Update" activates the new version (${report.phase3UpdatedCacheName})`
  );

  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
