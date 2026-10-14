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
  const outDir = path.resolve(rootDir, 'artifacts', 'premium-ui', 'phase-01');
  fs.mkdirSync(outDir, { recursive: true });

  const htmlPath = path.resolve(rootDir, 'dist', 'Our-Life-Planner-Offline.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error('dist/Our-Life-Planner-Offline.html not found. Run npm run build first.');
  }

  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  const serverPort = 3002;
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
      console.log(`Phase 01 app server running at http://127.0.0.1:${serverPort}/`);
      resolve();
    });
    server.on('error', reject);
  });

  const appUrl = `http://127.0.0.1:${serverPort}/`;
  const browserExe = findBrowserExecutable();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olp-phase01-foundations-'));
  const debugPort = 9550 + Math.floor(Math.random() * 200);

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

  try {
    console.log('Navigating to app...');
    await setViewport(1440, 900, false);
    await cdp.send('Page.navigate', { url: appUrl });
    await wait(1000);

    await dismissModals();

    // Enable all modules and load demo data in Settings
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
    await wait(350);

    console.log('\n1. Capturing Desktop (1440x900 All Modules, Light)...');
    await saveShot('desktop-1440x900-all-modules-light.png');

    console.log('\n2. Capturing Desktop (1440x900 All Modules, Dark)...');
    await setTheme('dark');
    await wait(250);
    await saveShot('desktop-1440x900-all-modules-dark.png');
    await setTheme('light');
    await wait(200);

    console.log('\n3. Capturing Desktop at 1280x720 (Light)...');
    await setViewport(1280, 720, false);
    await wait(250);
    await saveShot('desktop-1280x720-light.png');

    // Reset to 1440x900
    await setViewport(1440, 900, false);
    await wait(200);

    console.log('\n4. Capturing Search Modal Open (1440x900)...');
    await evalJs(`
      (() => {
        const searchBtn = document.querySelector('button[aria-label="Search planner"]');
        if (searchBtn) searchBtn.click();
      })()
    `);
    await wait(350);
    await saveShot('search-modal-open-1440x900.png');
    await dismissModals();

    console.log('\n5. Capturing Quick Add Modal Open (1440x900)...');
    await evalJs(`
      (() => {
        const qaBtn = document.querySelector('[data-testid="header-quick-add"]');
        if (qaBtn) qaBtn.click();
      })()
    `);
    await wait(350);
    await saveShot('quick-add-open-1440x900.png');
    await dismissModals();

    console.log('\n6. Capturing Visible Keyboard Focus Indicator on Sidebar (1440x900)...');
    await evalJs(`
      (() => {
        const tasksBtn = document.querySelector('[data-testid="sidebar-nav-tasks"]');
        if (tasksBtn) tasksBtn.focus();
      })()
    `);
    await wait(200);
    await saveShot('keyboard-focus-sidebar-1440x900.png');

    console.log('\n7. Capturing Core-Only Navigation (1440x900)...');
    await evalJs(`
      (() => {
        const s = document.querySelector('[data-testid="sidebar-settings"]');
        if (s) s.click();
      })()
    `);
    await wait(350);
    await evalJs(`
      (() => {
        const starterPreset = document.querySelector('[data-testid="settings-preset-starter"]') ||
                              Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Core Starter'));
        if (starterPreset) starterPreset.click();
      })()
    `);
    await wait(300);
    await evalJs(`
      (() => {
        const todayNav = document.querySelector('[data-testid="sidebar-nav-today"]');
        if (todayNav) todayNav.click();
      })()
    `);
    await wait(350);
    await saveShot('desktop-1440x900-core-only.png');

    console.log('\n8. Capturing Mobile Viewport (390x844 Light & Dark)...');
    await setViewport(390, 844, true);
    await wait(300);
    await saveShot('mobile-390x844-light.png');

    await setTheme('dark');
    await wait(250);
    await saveShot('mobile-390x844-dark.png');
    await setTheme('light');

    // Write manifest
    const manifest = {
      capturedAt: new Date().toISOString(),
      phase: '01-foundations',
      browser: browserExe,
      appUrl,
      serverPort,
      evidence: [
        'desktop-1440x900-all-modules-light.png',
        'desktop-1440x900-all-modules-dark.png',
        'desktop-1280x720-light.png',
        'desktop-1440x900-core-only.png',
        'search-modal-open-1440x900.png',
        'quick-add-open-1440x900.png',
        'keyboard-focus-sidebar-1440x900.png',
        'mobile-390x844-light.png',
        'mobile-390x844-dark.png',
      ],
    };

    fs.writeFileSync(path.join(outDir, 'phase-01-manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
    console.log('\nPhase 01 evidence manifest created successfully!');
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
  console.error('Error during phase 01 capture:', err);
  process.exit(1);
});
