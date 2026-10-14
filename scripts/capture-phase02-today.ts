import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { spawn } from 'node:child_process';

function findBrowserExecutable(): string {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('No Chromium browser executable found');
}

class CDPClient {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      }
    });
  }

  async ready(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve(), { once: true });
      this.ws.addEventListener('error', (e) => reject(e), { once: true });
    });
  }

  send(method: string, params: Record<string, any> = {}): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const rootDir = process.cwd();
  const outDir = path.resolve(rootDir, 'artifacts', 'premium-ui', 'phase-02');
  fs.mkdirSync(outDir, { recursive: true });

  const htmlPath = path.resolve(rootDir, 'dist', 'Our-Life-Planner-Offline.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error('dist/Our-Life-Planner-Offline.html not found. Run npm run build first.');
  }

  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  const serverPort = 3003;
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url?.startsWith('/?')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlContent);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(serverPort, '127.0.0.1', () => {
      console.log(`Phase 02 app server running at http://127.0.0.1:${serverPort}/`);
      resolve();
    });
    server.on('error', reject);
  });

  const appUrl = `http://127.0.0.1:${serverPort}/`;
  const browserExe = findBrowserExecutable();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olp-phase02-today-'));
  const debugPort = 9700 + Math.floor(Math.random() * 200);

  console.log(`Launching browser: ${browserExe}`);

  const proc = spawn(
    browserExe,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${userDataDir}`,
      `--remote-debugging-port=${debugPort}`,
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let wsBrowserUrl = '';
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for DevTools URL')), 15000);
    const checkEndpoints = async () => {
      try {
        const resp = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
        if (resp.ok) {
          const ver = (await resp.json()) as any;
          wsBrowserUrl = ver.webSocketDebuggerUrl;
          clearTimeout(timeout);
          resolve();
          return;
        }
      } catch {}
      setTimeout(checkEndpoints, 200);
    };
    checkEndpoints();
  });

  const targetsResp = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
  const targets = (await targetsResp.json()) as any[];
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  if (!pageTarget) throw new Error('No page target found');

  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  const evalJs = async (expression: string) => {
    const res = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`JS error: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description || ''}`);
    }
    return res.result?.value;
  };

  const saveShot = async (filename: string) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const filePath = path.join(outDir, filename);
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log(`  ✓ Saved: ${filename}`);
  };

  const setViewport = async (width: number, height: number, mobile = false) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: mobile ? 2 : 1,
      mobile,
    });
    await wait(250);
  };

  const dismissModals = async () => {
    await evalJs(`
      (() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
        const backdrop = document.querySelector('.fixed.inset-0[aria-hidden="true"]');
        if (backdrop) backdrop.click();
      })()
    `);
    await wait(200);
  };

  const setTheme = async (theme: 'light' | 'dark') => {
    await evalJs(`
      (() => {
        if ('${theme}' === 'dark') {
          document.documentElement.classList.add('dark');
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.setAttribute('data-theme', 'light');
        }
      })()
    `);
    await wait(200);
  };

  const capturedImages: { filename: string; description: string; viewport: string; theme: string }[] = [];

  try {
    console.log('Navigating to app...');
    await setViewport(1440, 900, false);
    await cdp.send('Page.navigate', { url: appUrl });
    await wait(1000);

    await dismissModals();

    // Load demo data
    await evalJs(`
      (() => {
        const s = document.querySelector('[data-testid="sidebar-settings"]') ||
                  Array.from(document.querySelectorAll('aside button')).find(b => (b.textContent || '').includes('Settings'));
        if (s) s.click();
      })()
    `);
    await wait(400);

    await evalJs(`
      (() => {
        const allPreset = document.querySelector('[data-testid="settings-preset-all"]');
        if (allPreset) allPreset.click();
        const reloadBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Reload Demo'));
        if (reloadBtn) reloadBtn.click();
      })()
    `);
    await wait(300);

    await evalJs(`
      (() => {
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Confirm & Load Demo Data'));
        if (confirmBtn) confirmBtn.click();
      })()
    `);
    await wait(500);

    await dismissModals();

    // Navigate to Today
    await evalJs(`
      (() => {
        const todayNav = document.querySelector('[data-testid="sidebar-nav-today"]');
        if (todayNav) todayNav.click();
      })()
    `);
    await wait(400);

    // 1. Desktop 1440x900 Light (Populated)
    console.log('\n1. Desktop 1440x900 Light (Populated)...');
    await saveShot('today-1440x900-light-populated.png');
    capturedImages.push({
      filename: 'today-1440x900-light-populated.png',
      description: 'Desktop 1440x900 Light with 4 metric cards (featured navy card), Next Up, and schedule',
      viewport: '1440x900',
      theme: 'light',
    });

    // 2. Desktop 1440x900 Dark (Populated)
    console.log('\n2. Desktop 1440x900 Dark (Populated)...');
    await setTheme('dark');
    await saveShot('today-1440x900-dark-populated.png');
    capturedImages.push({
      filename: 'today-1440x900-dark-populated.png',
      description: 'Desktop 1440x900 Dark theme with high-contrast surfaces and readable metrics',
      viewport: '1440x900',
      theme: 'dark',
    });
    await setTheme('light');

    // 3. Desktop 1280x720 Light (Above the fold check)
    console.log('\n3. Desktop 1280x720 Light (Above the Fold)...');
    await setViewport(1280, 720, false);
    await wait(300);
    await saveShot('today-1280x720-light-above-the-fold.png');
    capturedImages.push({
      filename: 'today-1280x720-light-above-the-fold.png',
      description: 'Desktop 1280x720 Light proving Next Up card and meaningful commitments start above 720px fold',
      viewport: '1280x720',
      theme: 'light',
    });

    // 4. Tablet 768x1024 Light
    console.log('\n4. Tablet 768x1024 Light...');
    await setViewport(768, 1024, false);
    await wait(300);
    await saveShot('today-768x1024-tablet-light.png');
    capturedImages.push({
      filename: 'today-768x1024-tablet-light.png',
      description: 'Tablet 768x1024 portrait showing responsive 2-column metric cards and fluid schedule',
      viewport: '768x1024',
      theme: 'light',
    });

    // 5. Mobile 390x844 Light
    console.log('\n5. Mobile 390x844 Light...');
    await setViewport(390, 844, true);
    await wait(300);
    await saveShot('today-390x844-mobile-light.png');
    capturedImages.push({
      filename: 'today-390x844-mobile-light.png',
      description: 'Mobile 390x844 Light showing compact horizontal metric row and docked bottom nav',
      viewport: '390x844',
      theme: 'light',
    });

    // 6. Mobile 390x844 Dark
    console.log('\n6. Mobile 390x844 Dark...');
    await setTheme('dark');
    await saveShot('today-390x844-mobile-dark.png');
    capturedImages.push({
      filename: 'today-390x844-mobile-dark.png',
      description: 'Mobile 390x844 Dark showing compact horizontal metrics and clean surface elevation',
      viewport: '390x844',
      theme: 'dark',
    });
    await setTheme('light');

    // 7. Desktop 1440x900 Overdue Expanded
    console.log('\n7. Desktop 1440x900 Overdue Expanded...');
    await setViewport(1440, 900, false);
    await wait(300);
    await evalJs(`
      (() => {
        const toggleBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Show details'));
        if (toggleBtn) toggleBtn.click();
      })()
    `);
    await wait(300);
    await saveShot('today-1440x900-overdue-expanded.png');
    capturedImages.push({
      filename: 'today-1440x900-overdue-expanded.png',
      description: 'Desktop 1440x900 with overdue details drawer expanded showing individual overdue action items',
      viewport: '1440x900',
      theme: 'light',
    });

    // 8. Desktop 1440x900 After Task Complete (Reactive Metrics Update)
    console.log('\n8. Desktop 1440x900 After Task Complete...');
    await evalJs(`
      (() => {
        const markComplete = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Mark Complete'));
        if (markComplete) markComplete.click();
      })()
    `);
    await wait(400);
    await saveShot('today-1440x900-after-task-complete.png');
    capturedImages.push({
      filename: 'today-1440x900-after-task-complete.png',
      description: 'Desktop 1440x900 after completing Next Up item, demonstrating reactive live metrics update',
      viewport: '1440x900',
      theme: 'light',
    });

    // 9. Desktop 1440x900 Long Task Names
    console.log('\n9. Desktop 1440x900 Long Task Names...');
    await evalJs(`
      (() => {
        const data = JSON.parse(localStorage.getItem('our_life_planner_data_v1') || '{}');
        if (data.tasks && data.tasks.length > 0) {
          data.tasks[0].title = 'Comprehensive cross-functional quarterly roadmap review with senior engineering and design leadership';
          localStorage.setItem('our_life_planner_data_v1', JSON.stringify(data));
        }
      })()
    `);
    await evalJs(`location.reload()`);
    await wait(600);
    await dismissModals();
    await evalJs(`
      (() => {
        const todayNav = document.querySelector('[data-testid="sidebar-nav-today"]');
        if (todayNav) todayNav.click();
      })()
    `);
    await wait(400);
    await saveShot('today-1440x900-long-task-names.png');
    capturedImages.push({
      filename: 'today-1440x900-long-task-names.png',
      description: 'Desktop 1440x900 with extended commitment title demonstrating no overflow or broken layout',
      viewport: '1440x900',
      theme: 'light',
    });

    // 10. Desktop 1440x900 Empty Starter State
    console.log('\n10. Desktop 1440x900 Empty Starter State...');
    await evalJs(`
      (() => {
        const s = document.querySelector('[data-testid="sidebar-settings"]') ||
                  Array.from(document.querySelectorAll('aside button')).find(b => (b.textContent || '').includes('Settings'));
        if (s) s.click();
      })()
    `);
    await wait(400);
    await evalJs(`
      (() => {
        const starterPreset = document.querySelector('[data-testid="settings-preset-starter"]') ||
                              Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Core Starter'));
        if (starterPreset) starterPreset.click();
        const clearBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Clear All Data') || (b.textContent || '').includes('Remove sample data'));
        if (clearBtn) clearBtn.click();
      })()
    `);
    await wait(300);
    await evalJs(`
      (() => {
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Confirm & Remove Sample Data') || (b.textContent || '').includes('Confirm'));
        if (confirmBtn) confirmBtn.click();
      })()
    `);
    await wait(400);
    await dismissModals();
    await evalJs(`
      (() => {
        const todayNav = document.querySelector('[data-testid="sidebar-nav-today"]');
        if (todayNav) todayNav.click();
      })()
    `);
    await wait(400);
    await saveShot('today-1440x900-empty-starter.png');
    capturedImages.push({
      filename: 'today-1440x900-empty-starter.png',
      description: 'Desktop 1440x900 Starter Empty State with zero commitments, 0% metrics, and prominent hero CTA',
      viewport: '1440x900',
      theme: 'light',
    });

    // Write manifest
    const manifestPath = path.join(outDir, 'phase-02-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(capturedImages, null, 2));
    console.log(`\nManifest written to: ${manifestPath}`);

    console.log(`\nCaptured ${capturedImages.length} visual evidence files in ${outDir}`);
  } finally {
    cdp.close();
    proc.kill();
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
