import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
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
  const phase = process.argv[2] === 'after' ? 'after' : 'before';
  const outDir = path.resolve(process.cwd(), 'artifacts', 'screenshots-phase2', phase);
  fs.mkdirSync(outDir, { recursive: true });

  const htmlPath = path.resolve(process.cwd(), 'dist', 'Our-Life-Planner-Offline.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error('dist/Our-Life-Planner-Offline.html not found. Run npm run build first.');
  }
  const htmlContent = fs
    .readFileSync(htmlPath, 'utf-8')
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, '')
    .replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/gi, '');

  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url?.startsWith('/?')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlContent);
      return;
    }
    res.writeHead(204);
    res.end();
  });

  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as any).port;
  const appUrl = `http://127.0.0.1:${port}/`;

  const browserExe = findBrowserExecutable();
  const userDataDir = path.resolve(process.cwd(), 'dist', `.tmp-edge-shots-${phase}-${Date.now()}`);

  const proc = spawn(
    browserExe,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=0',
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let wsBrowserUrl = '';
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for DevTools URL')), 15000);
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      const match = text.match(/ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-zA-Z0-9-]+/);
      if (match) {
        wsBrowserUrl = match[0];
        clearTimeout(timeout);
        resolve();
      }
    };
    proc.stderr.on('data', onData);
    proc.stdout.on('data', onData);
  });

  const debugPort = Number(wsBrowserUrl.match(/127\.0\.0\.1:(\d+)/)![1]);
  const targetsResp = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
  const targets = (await targetsResp.json()) as any[];
  const pageTarget = targets.find((t) => t.type === 'page');
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
      throw new Error(`JS error: ${res.exceptionDetails.text}`);
    }
    return res.result?.value;
  };

  const saveShot = async (filename: string) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const filePath = path.join(outDir, filename);
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log(`  Saved ${phase}/${filename}`);
  };

  try {
    // Load app with demo data active so Workouts, Tasks, Meals, Water, etc. have rich content
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send('Page.navigate', { url: appUrl });
    await wait(600);

    // Ensure sample data is loaded and setup is complete
    await evalJs(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const closeSetup = btns.find(b => (b.getAttribute('aria-label') || '').includes('Close'));
        if (closeSetup) closeSetup.click();
      })()
    `);
    await wait(200);

    // Switch to Settings -> Reload Demo Data if needed so we have workouts & tasks
    await evalJs(`
      (() => {
        const settingsBtn = Array.from(document.querySelectorAll('aside button')).find(b => (b.textContent || '').trim() === 'Settings');
        if (settingsBtn) settingsBtn.click();
      })()
    `);
    await wait(250);
    await evalJs(`
      (() => {
        const reloadBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Reload Demo'));
        if (reloadBtn) reloadBtn.click();
      })()
    `);
    await wait(200);
    await evalJs(`
      (() => {
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Confirm & Load Demo Data'));
        if (confirmBtn) confirmBtn.click();
      })()
    `);
    await wait(300);

    // 1. Dark Mode Focus Modal -> Start Timer -> Hover over Pause button
    await evalJs(`
      (() => {
        const darkRadio = document.querySelector('button[aria-label="Dark mode"]');
        if (darkRadio) darkRadio.click();
        const todayBtn = Array.from(document.querySelectorAll('aside button')).find(b => (b.textContent || '').trim() === 'Today');
        if (todayBtn) todayBtn.click();
      })()
    `);
    await wait(250);
    await evalJs(`
      (() => {
        const focusBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Single-Task Focus') || (b.textContent || '').trim() === 'Focus');
        if (focusBtn) focusBtn.click();
      })()
    `);
    await wait(250);
    await evalJs(`
      (() => {
        const startBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(b => (b.textContent || '').includes('Start Timer'));
        if (startBtn) startBtn.click();
      })()
    `);
    await wait(250);

    const pauseRect = await evalJs(`
      (() => {
        const pauseBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(b => (b.textContent || '').includes('Pause'));
        if (!pauseBtn) return null;
        const r = pauseBtn.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      })()
    `);
    if (pauseRect) {
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: pauseRect.x,
        y: pauseRect.y,
      });
      await wait(200);
    }
    await saveShot('01-focus-dark-pause-hover.png');

    // Close Focus Modal
    await evalJs(`
      (() => {
        const closeBtn = document.querySelector('button[aria-label="Close focus view"]');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await wait(200);

    // Switch back to Light Mode for desktop views
    await evalJs(`
      (() => {
        const settingsBtn = Array.from(document.querySelectorAll('aside button')).find(b => (b.textContent || '').trim() === 'Settings');
        if (settingsBtn) settingsBtn.click();
      })()
    `);
    await wait(200);
    await evalJs(`
      (() => {
        const lightRadio = document.querySelector('button[aria-label="Light mode"]');
        if (lightRadio) lightRadio.click();
      })()
    `);
    await wait(200);

    // 2. Workouts View (1440x900)
    await evalJs(`
      (() => {
        const btn = Array.from(document.querySelectorAll('aside button')).find(b => (b.textContent || '').trim() === 'Workouts');
        if (btn) btn.click();
      })()
    `);
    await wait(300);
    await saveShot('02-workouts-sets-desktop.png');

    // 3. Meals View (1440x900)
    await evalJs(`
      (() => {
        const btn = Array.from(document.querySelectorAll('aside button')).find(b => (b.textContent || '').trim() === 'Meals');
        if (btn) btn.click();
      })()
    `);
    await wait(300);
    await saveShot('03-meals-weekly-desktop.png');

    // 4. Settings View at 390x844 (Mobile)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await evalJs(`
      (() => {
        const settingsBtn = Array.from(document.querySelectorAll('aside button')).find(b => (b.textContent || '').trim() === 'Settings');
        if (settingsBtn) settingsBtn.click();
      })()
    `);
    await wait(250);
    await evalJs(`
      (() => {
        const modCard = document.querySelector('[data-testid="module-card-today"]');
        if (modCard) modCard.scrollIntoView({ block: 'center' });
      })()
    `);
    await wait(200);
    await saveShot('04-settings-mobile-390.png');

    // 5. Today Dashboard at 390x844 in Dark Mode
    await evalJs(`
      (() => {
        const darkRadio = document.querySelector('button[aria-label="Dark mode"]');
        if (darkRadio) darkRadio.click();
        const todayBtn = document.querySelector('[data-testid="mobile-nav-today"]');
        if (todayBtn) todayBtn.click();
        window.scrollTo(0, 0);
      })()
    `);
    await wait(300);
    await saveShot('05-today-mobile-390-dark.png');

    // 6. Today Dashboard at 320x640 (Narrow Mobile)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 320,
      height: 640,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await wait(250);
    await saveShot('06-today-mobile-320.png');

    // 7. 200% Zoom Dialog Scrollability (1440x900 with pageScaleFactor / CSS zoom 2)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 720,
      height: 450,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await evalJs(`
      (() => {
        const quickAddBtn = document.querySelector('button[aria-label="Quick add item"]');
        if (quickAddBtn) quickAddBtn.click();
      })()
    `);
    await wait(250);
    await saveShot('07-dialog-200-zoom.png');
  } finally {
    cdp.close();
    proc.kill();
    server.close();
    setTimeout(() => {
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch {}
    }, 500);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
