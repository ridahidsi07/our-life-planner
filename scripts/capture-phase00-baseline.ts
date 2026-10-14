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
  const outDir = path.resolve(rootDir, 'artifacts', 'premium-ui', 'phase-00');
  fs.mkdirSync(outDir, { recursive: true });

  const htmlPath = path.resolve(rootDir, 'dist', 'Our-Life-Planner-Offline.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error('dist/Our-Life-Planner-Offline.html not found. Run npm run build first.');
  }

  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  // Start local HTTP server on port 3001
  const serverPort = 3001;
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
      console.log(`Baseline app server running at http://127.0.0.1:${serverPort}/`);
      resolve();
    });
    server.on('error', reject);
  });

  const appUrl = `http://127.0.0.1:${serverPort}/`;
  const browserExe = findBrowserExecutable();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olp-phase00-baseline-'));
  const debugPort = 9520 + Math.floor(Math.random() * 200);

  console.log(`Launching browser: ${browserExe}`);
  console.log(`Disposable profile: ${userDataDir}`);

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
          const ver = await resp.json() as any;
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
    console.log(`  ✓ Saved baseline screenshot: ${filename}`);
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

  const navigateToView = async (toolId: string) => {
    // Close any modal first
    await evalJs(`
      (() => {
        const closeBtn = document.querySelector('[role="dialog"] button[aria-label*="Close"]') ||
                         document.querySelector('[role="dialog"] button:has(svg.lucide-x)');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await wait(150);

    // Click sidebar or mobile menu
    await evalJs(`
      (() => {
        const sideBtn = document.querySelector('[data-testid="sidebar-nav-${toolId}"]');
        if (sideBtn && sideBtn.offsetParent !== null) {
          sideBtn.click();
          return;
        }
        // Try settings or backup buttons
        if ('${toolId}' === 'settings') {
          const s = Array.from(document.querySelectorAll('aside button')).find(b => (b.textContent || '').includes('Settings'));
          if (s) { s.click(); return; }
        }
        // Try mobile menu
        const openMenu = document.querySelector('button[aria-label="Open menu"]');
        if (openMenu) {
          openMenu.click();
          setTimeout(() => {
            const moreItem = document.querySelector('[data-testid="moresheet-tool-${toolId}"]') ||
                             Array.from(document.querySelectorAll('#all-tools-menu button')).find(b => (b.textContent || '').toLowerCase().includes('${toolId}'));
            if (moreItem) moreItem.click();
          }, 200);
        }
      })()
    `);
    await wait(350);
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

  try {
    console.log('Navigating to app URL...');
    await setViewport(1440, 900, false);
    await cdp.send('Page.navigate', { url: appUrl });
    await wait(1000);

    // Dismiss setup modal if open
    await dismissModals();
    await wait(200);

    // Switch to Settings -> Reload Demo Data so all modules and sample records are active
    await navigateToView('settings');
    await wait(400);

    await evalJs(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const reloadBtn = btns.find(b => (b.textContent || '').includes('Reload Demo'));
        if (reloadBtn) reloadBtn.click();
      })()
    `);
    await wait(300);
    await evalJs(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const confirmBtn = btns.find(b => (b.textContent || '').includes('Confirm & Load Demo Data'));
        if (confirmBtn) confirmBtn.click();
      })()
    `);
    await wait(500);

    // Make sure no modal remains open
    await dismissModals();

    console.log('\nCapturing Desktop Baseline (1440x900, Light)...');

    // 1. Today Dashboard (1440x900)
    await navigateToView('today');
    await wait(300);
    await saveShot('today-1440x900-light.png');

    // 2. Today Dashboard (1280x720) - specific prompt requirement
    console.log('\nCapturing Today Baseline at 1280x720 (above the fold)...');
    await setViewport(1280, 720, false);
    await wait(250);
    await saveShot('today-1280x720-light.png');

    // Reset back to 1440x900
    await setViewport(1440, 900, false);
    await wait(200);

    // 3. Tasks - List Tab
    await navigateToView('tasks');
    await wait(300);
    await evalJs(`
      (() => {
        const listBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim() === 'List');
        if (listBtn) listBtn.click();
      })()
    `);
    await wait(250);
    await saveShot('tasks-list-1440x900-light.png');

    // 4. Tasks - Insights Tab
    await evalJs(`
      (() => {
        const insightsBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim() === 'Insights');
        if (insightsBtn) insightsBtn.click();
      })()
    `);
    await wait(250);
    await saveShot('tasks-insights-1440x900-light.png');

    // 5. Quick Add Modal
    await evalJs(`
      (() => {
        const quickAddBtn = Array.from(document.querySelectorAll('header button')).find(b => (b.textContent || '').includes('Quick add'));
        if (quickAddBtn) quickAddBtn.click();
      })()
    `);
    await wait(350);
    await saveShot('quick-add-1440x900-light.png');

    // Close Quick Add modal
    await evalJs(`
      (() => {
        const closeBtn = document.querySelector('[role="dialog"] button[aria-label*="Close"]') ||
                         document.querySelector('[role="dialog"] button:has(svg.lucide-x)');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await wait(200);

    // 6. Calendar View
    await navigateToView('calendar');
    await wait(300);
    await saveShot('calendar-1440x900-light.png');

    // 7. Settings View
    await navigateToView('settings');
    await wait(300);
    await saveShot('settings-1440x900-light.png');

    // 8. Representative Optional Modules
    console.log('\nCapturing Optional Modules Baseline (1440x900, Light)...');
    await navigateToView('routines');
    await wait(250);
    await saveShot('routines-1440x900-light.png');

    await navigateToView('habits');
    await wait(250);
    await saveShot('habits-1440x900-light.png');

    await navigateToView('budget');
    await wait(250);
    await saveShot('budget-1440x900-light.png');

    await navigateToView('meals');
    await wait(250);
    await saveShot('meals-1440x900-light.png');

    await navigateToView('workouts');
    await wait(250);
    await saveShot('workouts-1440x900-light.png');

    // 9. Dark theme check (Today 1440x900 Dark)
    console.log('\nCapturing Dark Theme Baseline (1440x900, Dark)...');
    await navigateToView('today');
    await setTheme('dark');
    await wait(250);
    await saveShot('today-1440x900-dark.png');
    await setTheme('light');
    await wait(200);

    // 10. Mobile Viewport (390x844)
    console.log('\nCapturing Mobile Viewport Baseline (390x844, Light)...');
    await setViewport(390, 844, true);
    await navigateToView('today');
    await wait(350);
    await saveShot('today-390x844-light.png');

    await navigateToView('tasks');
    await wait(350);
    await saveShot('tasks-390x844-light.png');

    await navigateToView('calendar');
    await wait(350);
    await saveShot('calendar-390x844-light.png');

    await navigateToView('settings');
    await wait(350);
    await saveShot('settings-390x844-light.png');

    // Write manifest
    const manifest = {
      capturedAt: new Date().toISOString(),
      phase: '00-baseline',
      browser: browserExe,
      appUrl,
      serverPort,
      dataFixture: 'Demo sample data (all modules active)',
      viewports: [
        { name: 'desktop-wide', width: 1440, height: 900, mobile: false },
        { name: 'desktop-standard', width: 1280, height: 720, mobile: false },
        { name: 'mobile', width: 390, height: 844, mobile: true },
      ],
      themes: ['light', 'dark'],
      capturedScreenshots: [
        'today-1440x900-light.png',
        'today-1280x720-light.png',
        'today-390x844-light.png',
        'today-1440x900-dark.png',
        'tasks-list-1440x900-light.png',
        'tasks-insights-1440x900-light.png',
        'tasks-390x844-light.png',
        'quick-add-1440x900-light.png',
        'calendar-1440x900-light.png',
        'calendar-390x844-light.png',
        'settings-1440x900-light.png',
        'settings-390x844-light.png',
        'routines-1440x900-light.png',
        'habits-1440x900-light.png',
        'budget-1440x900-light.png',
        'meals-1440x900-light.png',
        'workouts-1440x900-light.png',
      ],
    };

    fs.writeFileSync(
      path.join(outDir, 'baseline-manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );
    console.log('\nBaseline manifest written to artifacts/premium-ui/phase-00/baseline-manifest.json');
    console.log('Phase 00 screenshot capture completed successfully!');
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
  console.error('Error during baseline capture:', err);
  process.exit(1);
});
