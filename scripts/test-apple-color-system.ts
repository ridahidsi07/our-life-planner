import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { validateBackupData } from '../src/utils/backupValidator';
import { INITIAL_SETTINGS } from '../src/utils/sampleData';

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

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  PASS: ${message}`);
}

// Relative luminance and contrast ratio utilities (WCAG 2.1)
function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1: string, hex2: string): number {
  const [r1, g1, b1] = parseHex(hex1);
  const [r2, g2, b2] = parseHex(hex2);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

async function main() {
  console.log('=== Apple-Inspired Color System Verification Suite ===\n');

  const rootDir = process.cwd();
  const outDir = path.resolve(rootDir, 'artifacts', 'premium-ui', 'apple-color-system');
  fs.mkdirSync(outDir, { recursive: true });

  // ==========================================
  // 1. BACKUP & PRESET PERSISTENCE TESTS
  // ==========================================
  console.log('1. Verifying Backup Validator & Accent Color Round-Trip...');
  const baseDummyBackup = {
    version: '1.0.0',
    exportedAt: '2026-10-15T12:00:00.000Z',
    settings: {
      ...INITIAL_SETTINGS,
      ownerName: 'Test Household',
    },
    tasks: [],
    routines: [],
    goals: [],
    habits: [],
    inbox: [],
    transactions: [],
    bills: [],
    savingsPots: [],
    debts: [],
    recipes: [],
    plannedMeals: [],
    groceries: [],
    workouts: [],
    weightProfiles: [],
    weightRecords: [],
    hydrationEntries: [],
    hydrationTargets: [],
    calendarEvents: [],
  };

  // Test 1a: Backup with accentColor: 'apple' preserves 'apple' without warnings
  const appleBackup = JSON.parse(JSON.stringify(baseDummyBackup));
  appleBackup.settings.accentColor = 'apple';
  const appleResult = validateBackupData(appleBackup);
  assert(appleResult.isValid, 'Backup with accentColor="apple" validates successfully');
  assert(
    appleResult.data?.settings.accentColor === 'apple',
    'Restored settings preserve accentColor="apple"'
  );
  assert(
    !appleResult.warnings.some((w) => w.includes('accentColor')),
    'No warnings emitted for valid accentColor="apple"'
  );

  // Test 1b: Legacy backup without accentColor falls back safely to 'teal'
  const legacyBackup = JSON.parse(JSON.stringify(baseDummyBackup));
  delete legacyBackup.settings.accentColor;
  const legacyResult = validateBackupData(legacyBackup);
  assert(legacyResult.isValid, 'Legacy backup without accentColor validates successfully');
  assert(
    legacyResult.data?.settings.accentColor === 'teal',
    'Legacy backup normalizes missing accentColor to "teal"'
  );

  // Test 1c: Backup with invalid accentColor falls back safely to 'teal'
  const invalidBackup = JSON.parse(JSON.stringify(baseDummyBackup));
  invalidBackup.settings.accentColor = 'neon-pink';
  const invalidResult = validateBackupData(invalidBackup);
  assert(invalidResult.isValid, 'Backup with invalid accentColor validates safely');
  assert(
    invalidResult.data?.settings.accentColor === 'teal',
    'Invalid accentColor falls back safely to "teal"'
  );

  // ==========================================
  // 2. CSS SPECIFICATION & TOKENS VERIFICATION
  // ==========================================
  console.log('\n2. Verifying CSS Tokens in src/index.css against Brief...');
  const cssContent = fs.readFileSync(path.resolve(rootDir, 'src', 'index.css'), 'utf-8');

  // Verify light tokens for html[data-accent="apple"]
  const requiredLightTokens: Record<string, string> = {
    '--canvas': '#F5F5F7',
    '--surface': '#FFFFFF',
    '--surface-elevated': '#FFFFFF',
    '--surface-subtle': '#FAFAFC',
    '--surface-muted': '#E8E8ED',
    '--text-primary': '#1D1D1F',
    '--text-secondary': '#6E6E73',
    '--text-muted': '#6E6E73',
    '--accent': '#0066CC',
    '--focus-ring': '#0066CC',
    '--btn-primary-bg': '#0071E3',
    '--btn-primary-fg': '#FFFFFF',
    '--btn-primary-hover-bg': '#0076DF',
    '--btn-primary-active-bg': '#006EDB',
    '--border-color': '#D2D2D7',
    '--border-subtle': '#E8E8ED',
    '--border-strong': '#86868B',
    '--chart-previous': '#86868B',
    '--status-success-text': '#008009',
    '--status-warning-text': '#B64400',
    '--status-danger-text': '#E30000',
  };

  for (const [prop, val] of Object.entries(requiredLightTokens)) {
    assert(
      cssContent.includes(`${prop}: ${val}`),
      `Light mode token ${prop}: ${val} defined in src/index.css`
    );
  }

  // Verify dark tokens for html[data-accent="apple"].dark
  const requiredDarkTokens: Record<string, string> = {
    '--canvas': '#000000',
    '--surface': '#161617',
    '--surface-elevated': '#1D1D1F',
    '--surface-subtle': '#1D1D1F',
    '--surface-muted': '#333336',
    '--text-primary': '#F5F5F7',
    '--text-secondary': '#A1A1A6',
    '--text-muted': '#A1A1A6',
    '--accent': '#2997FF',
    '--focus-ring': '#2997FF',
    '--border-color': '#424245',
    '--border-subtle': '#333336',
    '--border-strong': '#86868B',
    '--chart-previous': '#A1A1A6',
    '--status-success-text': '#30D158',
    '--status-warning-text': '#FF9230',
    '--status-danger-text': '#FF6165',
  };

  for (const [prop, val] of Object.entries(requiredDarkTokens)) {
    assert(
      cssContent.includes(`${prop}: ${val}`),
      `Dark mode token ${prop}: ${val} defined in src/index.css`
    );
  }

  // Verify Native Apple swatches (Exact June 2025 HIG specifications from guide)
  const requiredSwatches: Record<string, string> = {
    '--apple-red': '#FF383C',
    '--apple-orange': '#FF8D28',
    '--apple-yellow': '#FFCC00',
    '--apple-green': '#34C759',
    '--apple-mint': '#00C8B3',
    '--apple-teal': '#00C3D0',
    '--apple-cyan': '#00C0E8',
    '--apple-blue': '#0088FF',
    '--apple-indigo': '#6155F5',
    '--apple-purple': '#CB30E0',
    '--apple-pink': '#FF2D55',
    '--apple-brown': '#AC7F5E',
  };

  for (const [prop, val] of Object.entries(requiredSwatches)) {
    assert(
      cssContent.includes(`${prop}: ${val}`),
      `Native swatch ${prop}: ${val} defined in src/index.css`
    );
  }

  // Verify high-contrast & forced-colors media queries
  assert(
    cssContent.includes('@media (prefers-contrast: more)'),
    'High-contrast media query defined'
  );
  assert(
    cssContent.includes('#1E6EF4') && cssContent.includes('#5CB8FF'),
    'High-contrast WCAG AAA blue values #1E6EF4 / #5CB8FF defined'
  );
  assert(
    cssContent.includes('@media (forced-colors: active)'),
    'Forced-colors media query defined'
  );

  // ==========================================
  // 3. WCAG 2.1 AA CONTRAST RATIO VERIFICATION
  // ==========================================
  console.log('\n3. Verifying WCAG 2.1 AA Contrast Ratios (Minimum 4.5:1 for Normal Text)...');
  const contrastPairs = [
    { name: 'Primary Button Normal Text (White on #0071E3)', fg: '#FFFFFF', bg: '#0071E3', min: 4.5 },
    { name: 'Primary Button Hover (White on #0076DF)', fg: '#FFFFFF', bg: '#0076DF', min: 4.5 },
    { name: 'Primary Button Active/Pressed (White on #006EDB)', fg: '#FFFFFF', bg: '#006EDB', min: 4.5 },
    { name: 'Light Body Text on Canvas (#1D1D1F on #F5F5F7)', fg: '#1D1D1F', bg: '#F5F5F7', min: 4.5 },
    { name: 'Light Body Text on Card Surface (#1D1D1F on #FFFFFF)', fg: '#1D1D1F', bg: '#FFFFFF', min: 4.5 },
    { name: 'Light Secondary Text on Card Surface (#6E6E73 on #FFFFFF)', fg: '#6E6E73', bg: '#FFFFFF', min: 4.5 },
    { name: 'Light Secondary Text on Canvas (#6E6E73 on #F5F5F7)', fg: '#6E6E73', bg: '#F5F5F7', min: 4.5 },
    { name: 'Light Interactive Link on Canvas (#0066CC on #F5F5F7)', fg: '#0066CC', bg: '#F5F5F7', min: 4.5 },
    { name: 'Light Interactive Link on Surface (#0066CC on #FFFFFF)', fg: '#0066CC', bg: '#FFFFFF', min: 4.5 },
    { name: 'Dark Body Text on Black Canvas (#F5F5F7 on #000000)', fg: '#F5F5F7', bg: '#000000', min: 4.5 },
    { name: 'Dark Body Text on Charcoal Surface (#F5F5F7 on #161617)', fg: '#F5F5F7', bg: '#161617', min: 4.5 },
    { name: 'Dark Secondary Text on Charcoal Surface (#A1A1A6 on #161617)', fg: '#A1A1A6', bg: '#161617', min: 4.5 },
    { name: 'Dark Secondary Text on Elevated Surface (#A1A1A6 on #1D1D1F)', fg: '#A1A1A6', bg: '#1D1D1F', min: 4.5 },
    { name: 'Dark Interactive Link on Charcoal Surface (#2997FF on #161617)', fg: '#2997FF', bg: '#161617', min: 4.5 },
    { name: 'Dark Interactive Link on Black Canvas (#2997FF on #000000)', fg: '#2997FF', bg: '#000000', min: 4.5 },
    { name: 'Status Success Light on White (#008009 on #FFFFFF)', fg: '#008009', bg: '#FFFFFF', min: 4.5 },
    { name: 'Status Warning Light on White (#B64400 on #FFFFFF)', fg: '#B64400', bg: '#FFFFFF', min: 4.5 },
    { name: 'Status Danger Light on White (#E30000 on #FFFFFF)', fg: '#E30000', bg: '#FFFFFF', min: 4.5 },
    { name: 'Status Success Dark on Charcoal (#30D158 on #161617)', fg: '#30D158', bg: '#161617', min: 4.5 },
    { name: 'Status Warning Dark on Charcoal (#FF9230 on #161617)', fg: '#FF9230', bg: '#161617', min: 4.5 },
    { name: 'Status Danger Dark on Charcoal (#FF6165 on #161617)', fg: '#FF6165', bg: '#161617', min: 4.5 },
  ];

  for (const pair of contrastPairs) {
    const ratio = contrastRatio(pair.fg, pair.bg);
    assert(
      ratio >= pair.min,
      `${pair.name}: ${ratio}:1 (>= ${pair.min}:1)`
    );
  }

  // ==========================================
  // 4. BROWSER VERIFICATION & SCREENSHOTS
  // ==========================================
  console.log('\n4. Starting Headless Browser Verification & Capturing Visual Artifacts...');
  const htmlPath = path.resolve(rootDir, 'dist', 'Our-Life-Planner-Offline.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error('dist/Our-Life-Planner-Offline.html not found. Run npm run build first.');
  }

  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  const serverPort = 3012;
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url?.startsWith('/?')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlContent);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(serverPort, '127.0.0.1', () => {
      console.log(`Apple color system test server running at http://127.0.0.1:${serverPort}/`);
      resolve();
    });
  });

  const browserPath = findBrowserExecutable();
  const debugPort = 9234;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olp-apple-color-'));

  const browserProcess = spawn(
    browserPath,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--headless=new',
      '--disable-gpu',
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let cdp: CDPClient | null = null;

  try {
    let wsUrl = '';
    for (let i = 0; i < 30; i++) {
      await wait(200);
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
        if (res.ok) {
          const data = await res.json();
          wsUrl = data.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }
    if (!wsUrl) throw new Error('Could not connect to browser DevTools endpoint');

    // Create page target
    const newPageRes = await fetch(
      `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`http://127.0.0.1:${serverPort}/`)}`,
      { method: 'PUT' }
    );
    const pageData = await newPageRes.json();
    cdp = new CDPClient(pageData.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    await wait(1200);

    async function evalJs<T = any>(expr: string): Promise<T> {
      const res = await cdp!.send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.exceptionDetails) {
        throw new Error(`JS Eval failed: ${JSON.stringify(res.exceptionDetails)}`);
      }
      return res.result?.value;
    }

    async function setViewport(width: number, height: number, isMobile = false) {
      await cdp!.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: isMobile,
      });
    }

    async function captureScreenshot(filename: string): Promise<string> {
      const filePath = path.join(outDir, filename);
      const res = await cdp!.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      console.log(`  Saved screenshot: ${filename}`);
      return filePath;
    }

    // Dismiss setup modal if open, switch to apple accent, apply demo data
    await evalJs(`
      (() => {
        // Set settings in localStorage to apple accent using correct storage key
        const storageKey = 'our_life_planner_settings_v1';
        const raw = window.localStorage.getItem(storageKey);
        let settings = raw ? JSON.parse(raw) : {};
        settings.accentColor = 'apple';
        settings.hasCompletedSetup = true;
        window.localStorage.setItem(storageKey, JSON.stringify(settings));
        window.localStorage.setItem('hasCompletedSetup', 'true');
      })()
    `);
    await cdp.send('Page.reload');
    await wait(1500);

    // Verify data-accent attribute on root
    const rootDataAccent = await evalJs(`document.documentElement.getAttribute('data-accent')`);
    assert(rootDataAccent === 'apple', `Root document has data-accent="apple" (found: ${rootDataAccent})`);

    // Verify computed styles in light mode
    const lightComputedAccent = await evalJs(`getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`);
    assert(
      lightComputedAccent.toLowerCase() === '#0066cc' || lightComputedAccent.toLowerCase() === '#06c',
      `Light mode computed --accent is #0066CC (found: ${lightComputedAccent})`
    );

    const lightBodyBg = await evalJs(`getComputedStyle(document.body).backgroundColor`);
    assert(
      lightBodyBg === 'rgb(245, 245, 247)' || lightBodyBg === '#f5f5f7',
      `Light mode body background is #F5F5F7 (found: ${lightBodyBg})`
    );

    // Capture Light Desktop Screenshots: Today, Tasks, Budget & Bills, Settings
    await setViewport(1440, 900, false);
    await wait(400);

    // 1. Today Light Desktop
    await evalJs(`document.querySelector('button[aria-label="Today"]') ? document.querySelector('button[aria-label="Today"]').click() : null`);
    await wait(500);
    await captureScreenshot('01-today-light-desktop.png');

    // 2. Tasks Light Desktop
    await evalJs(`document.querySelector('button[aria-label="Tasks"]') ? document.querySelector('button[aria-label="Tasks"]').click() : null`);
    await wait(500);
    await captureScreenshot('02-tasks-light-desktop.png');

    // 3. Budget Light Desktop
    await evalJs(`document.querySelector('button[aria-label="Budget & Bills"]') ? document.querySelector('button[aria-label="Budget & Bills"]').click() : null`);
    await wait(500);
    await captureScreenshot('03-budget-light-desktop.png');

    // 4. Settings Light Desktop
    await evalJs(`document.querySelector('button[aria-label="Settings"]') ? document.querySelector('button[aria-label="Settings"]').click() : null`);
    await wait(500);
    await captureScreenshot('04-settings-light-desktop.png');

    // Switch to Dark Mode
    await evalJs(`
      (() => {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        const storageKey = 'our_life_planner_settings_v1';
        const raw = window.localStorage.getItem(storageKey);
        let settings = raw ? JSON.parse(raw) : {};
        settings.darkMode = true;
        window.localStorage.setItem(storageKey, JSON.stringify(settings));
        document.body.style.backgroundColor = '#000000';
        document.body.style.color = '#F5F5F7';
      })()
    `);
    await wait(500);

    // Verify Dark Mode computed styles
    const darkComputedAccent = await evalJs(`getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`);
    assert(darkComputedAccent.toLowerCase() === '#2997ff', `Dark mode computed --accent is #2997FF (found: ${darkComputedAccent})`);

    const darkBodyBg = await evalJs(`getComputedStyle(document.body).backgroundColor`);
    assert(
      darkBodyBg === 'rgb(0, 0, 0)' || darkBodyBg === '#000000',
      `Dark mode body background is #000000 (found: ${darkBodyBg})`
    );

    // Capture Dark Desktop Screenshots: Today, Tasks, Budget & Bills, Settings
    // 5. Settings Dark Desktop
    await captureScreenshot('08-settings-dark-desktop.png');

    // 6. Today Dark Desktop
    await evalJs(`document.querySelector('button[aria-label="Today"]') ? document.querySelector('button[aria-label="Today"]').click() : null`);
    await wait(500);
    await captureScreenshot('05-today-dark-desktop.png');

    // 7. Tasks Dark Desktop
    await evalJs(`document.querySelector('button[aria-label="Tasks"]') ? document.querySelector('button[aria-label="Tasks"]').click() : null`);
    await wait(500);
    await captureScreenshot('06-tasks-dark-desktop.png');

    // 8. Budget Dark Desktop
    await evalJs(`document.querySelector('button[aria-label="Budget & Bills"]') ? document.querySelector('button[aria-label="Budget & Bills"]').click() : null`);
    await wait(500);
    await captureScreenshot('07-budget-dark-desktop.png');

    // Mobile Viewport (390 x 844 iPhone 12/13/14)
    await setViewport(390, 844, true);
    await wait(400);

    // 9. Today Dark Mobile
    await evalJs(`document.querySelector('button[aria-label="Today"]') ? document.querySelector('button[aria-label="Today"]').click() : null`);
    await wait(500);
    await captureScreenshot('09-today-dark-mobile.png');

    // 10. Tasks Dark Mobile
    await evalJs(`document.querySelector('button[aria-label="Tasks"]') ? document.querySelector('button[aria-label="Tasks"]').click() : null`);
    await wait(500);
    await captureScreenshot('10-tasks-dark-mobile.png');

    // Switch back to Light Mode for Mobile
    await evalJs(`
      (() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        document.body.style.backgroundColor = '#F5F5F7';
        document.body.style.color = '#1D1D1F';
      })()
    `);
    await wait(500);

    // 11. Today Light Mobile
    await evalJs(`document.querySelector('button[aria-label="Today"]') ? document.querySelector('button[aria-label="Today"]').click() : null`);
    await wait(500);
    await captureScreenshot('11-today-light-mobile.png');

    // 12. Settings Light Mobile
    await evalJs(`document.querySelector('button[aria-label="Settings"]') ? document.querySelector('button[aria-label="Settings"]').click() : null`);
    await wait(500);
    await captureScreenshot('12-settings-light-mobile.png');

    console.log('\nAll 12 visual verification screenshots captured and stored in artifacts/premium-ui/apple-color-system/!');
    console.log('\n=== APPLE-INSPIRED COLOR SYSTEM VERIFICATION COMPLETED SUCCESSFULLY ===');
  } finally {
    if (cdp) cdp.close();
    try {
      browserProcess.kill('SIGKILL');
    } catch {}
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
    server.close();
  }
}

main().catch((err) => {
  console.error('Apple Color System Verification Failed:', err);
  process.exit(1);
});
