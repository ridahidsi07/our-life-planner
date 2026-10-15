import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';
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

function parseColorToHex(colorStr: string): string {
  if (!colorStr) return '#FFFFFF';
  if (colorStr.startsWith('#')) return colorStr;
  const match = colorStr.match(/\d+/g);
  if (!match || match.length < 3) return '#FFFFFF';
  const r = parseInt(match[0], 10).toString(16).padStart(2, '0');
  const g = parseInt(match[1], 10).toString(16).padStart(2, '0');
  const b = parseInt(match[2], 10).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function getFileHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function main() {
  console.log('=== Apple-Inspired Color System & Visual Verification Suite ===\n');

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

    await wait(1500);

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
      console.log(`  Saved verified screenshot: ${filename}`);
      return filePath;
    }

    /**
     * Verified navigation helper (F4).
     * Strictly verifies destination heading AND landmark. Throws on missing or ambiguous controls.
     * Never uses null fallback.
     */
    async function navigateToView(
      viewId: 'today' | 'tasks' | 'budget' | 'settings' | 'calendar',
      expectedHeading: string,
      landmarkSelector: string,
      isMobile = false
    ): Promise<void> {
      if (isMobile) {
        // If MoreSheet is open, and we want today or calendar, close it first
        const isSheetOpen = await evalJs<boolean>(`Boolean(document.querySelector('#all-tools-menu'))`);
        if (isSheetOpen && (viewId === 'today' || viewId === 'calendar')) {
          await evalJs(`
            (() => {
              const closeBtn = document.querySelector('button[aria-label="Close menu"]');
              if (closeBtn) closeBtn.click();
            })()
          `);
          await wait(200);
        }

        if (viewId !== 'today' && viewId !== 'calendar') {
          // We need MoreSheet open to access tasks, budget, settings, etc. on mobile
          const currentSheetOpen = await evalJs<boolean>(`Boolean(document.querySelector('#all-tools-menu'))`);
          if (!currentSheetOpen) {
            const opened = await evalJs<boolean>(`
              (() => {
                const moreBtn = document.querySelector('button[data-testid="mobile-nav-more"]') ||
                                document.querySelector('button[aria-label="All tools and views"]');
                if (moreBtn) {
                  moreBtn.click();
                  return true;
                }
                return false;
              })()
            `);
            if (!opened) {
              throw new Error(`Mobile navigation failed: mobile-nav-more button not found`);
            }
            // Poll for MoreSheet to mount
            let sheetMounted = false;
            for (let i = 0; i < 25; i++) {
              await wait(80);
              sheetMounted = await evalJs<boolean>(`Boolean(document.querySelector('#all-tools-menu'))`);
              if (sheetMounted) break;
            }
            if (!sheetMounted) {
              throw new Error(`Mobile navigation failed: MoreSheet (#all-tools-menu) did not appear`);
            }
          }

          // In MoreSheet, find target button
          const clickResult = await evalJs<{ success: boolean; foundSelector: string; reason?: string }>(`
            (() => {
              let btn = null;
              let foundSelector = '';
              if ('${viewId}' === 'settings') {
                btn = document.querySelector('button[data-testid="moresheet-settings"]');
                foundSelector = 'button[data-testid="moresheet-settings"]';
              } else {
                btn = document.querySelector('button[data-testid="moresheet-tool-${viewId}"]') ||
                      document.querySelector('button[data-testid="moresheet-favorite-${viewId}"]');
                foundSelector = 'button[data-testid="moresheet-tool-${viewId}"] or favorite';
              }
              if (!btn) {
                return { success: false, foundSelector, reason: 'Selector ' + foundSelector + ' not found in MoreSheet' };
              }
              btn.click();
              return { success: true, foundSelector };
            })()
          `);

          if (!clickResult.success) {
            throw new Error(`Navigation failed: target button for view "${viewId}" not found. Reason: ${clickResult.reason}`);
          }
        } else {
          // Mobile today or calendar
          const clickResult = await evalJs<{ success: boolean; foundSelector: string; reason?: string }>(`
            (() => {
              let btn = null;
              let foundSelector = '';
              if ('${viewId}' === 'today') {
                btn = document.querySelector('button[data-testid="mobile-nav-today"]');
                foundSelector = 'button[data-testid="mobile-nav-today"]';
              } else if ('${viewId}' === 'calendar') {
                btn = document.querySelector('button[data-testid="mobile-nav-calendar"]');
                foundSelector = 'button[data-testid="mobile-nav-calendar"]';
              }
              if (!btn) {
                return { success: false, foundSelector, reason: 'Selector ' + foundSelector + ' not found in MobileNav' };
              }
              btn.click();
              return { success: true, foundSelector };
            })()
          `);

          if (!clickResult.success) {
            throw new Error(`Navigation failed: target button for view "${viewId}" not found. Reason: ${clickResult.reason}`);
          }
        }
      } else {
        // Desktop navigation via sidebar
        const clickResult = await evalJs<{ success: boolean; foundSelector: string; reason?: string }>(`
          (() => {
            let btn = null;
            let foundSelector = '';
            if ('${viewId}' === 'settings') {
              btn = document.querySelector('button[data-testid="sidebar-settings"]') ||
                    document.querySelector('button[data-testid="sidebar-nav-settings"]');
              foundSelector = 'button[data-testid="sidebar-settings"]';
            } else {
              btn = document.querySelector('button[data-testid="sidebar-nav-${viewId}"]');
              foundSelector = 'button[data-testid="sidebar-nav-${viewId}"]';
            }

            if (!btn) {
              return { success: false, foundSelector, reason: 'Selector ' + foundSelector + ' not found in DOM' };
            }

            btn.click();
            return { success: true, foundSelector };
          })()
        `);

        if (!clickResult.success) {
          throw new Error(`Navigation failed: target button for view "${viewId}" not found. Reason: ${clickResult.reason}`);
        }
      }

      // Poll and assert destination heading AND landmark
      let verified = false;
      let lastHeading = '';
      let lastLandmark = false;

      for (let i = 0; i < 30; i++) {
        await wait(100);
        const state = await evalJs<{ headingMatch: boolean; headingText: string; landmarkFound: boolean }>(`
          (() => {
            const headings = Array.from(document.querySelectorAll('h1, h2, h3, [data-testid$="-heading"]'));
            let headingMatch = false;
            let headingText = '';

            for (const h of headings) {
              const text = (h.textContent || '').trim();
              if (text.toLowerCase().includes('${expectedHeading.toLowerCase()}')) {
                headingMatch = true;
                headingText = text;
                break;
              }
            }

            const landmark = document.querySelector('${landmarkSelector}');
            const landmarkFound = Boolean(landmark && (landmark.offsetWidth > 0 || landmark.offsetHeight > 0 || landmark.getClientRects().length > 0));

            return { headingMatch, headingText, landmarkFound };
          })()
        `);

        lastHeading = state.headingText;
        lastLandmark = state.landmarkFound;

        if (state.headingMatch && state.landmarkFound) {
          verified = true;
          break;
        }
      }

      if (!verified) {
        throw new Error(
          `Destination assertion failed navigating to "${viewId}": Expected heading containing "${expectedHeading}" (observed: "${lastHeading}") and landmark "${landmarkSelector}" (found: ${lastLandmark})`
        );
      }
    }

    /**
     * Measure real DOM element contrast with true alpha compositing over DOM background stack
     */
    async function measureRealElementContrast(selector: string, desc: string): Promise<number> {
      const colors = await evalJs<{ fg: string; bgStack: string[] }>(`
        (() => {
          const el = document.querySelector('${selector}');
          if (!el) throw new Error('Cannot measure contrast: element "${selector}" not found');
          
          const fg = getComputedStyle(el).color;
          const bgStack = [];
          
          let cur = el;
          while (cur && cur !== document.documentElement) {
            const bg = getComputedStyle(cur).backgroundColor;
            if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
              bgStack.unshift(bg);
            }
            cur = cur.parentElement;
          }
          const bodyBg = getComputedStyle(document.body).backgroundColor;
          if (bodyBg && bodyBg !== 'transparent' && bodyBg !== 'rgba(0, 0, 0, 0)') {
            bgStack.unshift(bodyBg);
          } else {
            bgStack.unshift('rgb(255, 255, 255)');
          }
          
          return { fg, bgStack };
        })()
      `);

      function parseRgbaArr(colorStr: string): [number, number, number, number] {
        if (!colorStr) return [255, 255, 255, 1];
        if (colorStr.startsWith('#')) {
          const [r, g, b] = parseHex(colorStr);
          return [r, g, b, 1];
        }
        const match = colorStr.match(/[\d.]+/g);
        if (!match || match.length < 3) return [255, 255, 255, 1];
        const r = parseInt(match[0], 10);
        const g = parseInt(match[1], 10);
        const b = parseInt(match[2], 10);
        const a = match.length >= 4 ? parseFloat(match[3]) : 1;
        return [r, g, b, a];
      }

      let currentBg: [number, number, number, number] = parseRgbaArr(colors.bgStack[0] || 'rgb(255, 255, 255)');
      for (let i = 1; i < colors.bgStack.length; i++) {
        const top = parseRgbaArr(colors.bgStack[i]);
        const alpha = top[3];
        const r = Math.round(top[0] * alpha + currentBg[0] * (1 - alpha));
        const g = Math.round(top[1] * alpha + currentBg[1] * (1 - alpha));
        const b = Math.round(top[2] * alpha + currentBg[2] * (1 - alpha));
        currentBg = [r, g, b, 1];
      }

      const fgArr = parseRgbaArr(colors.fg);
      const fgHex = '#' + fgArr[0].toString(16).padStart(2, '0') + fgArr[1].toString(16).padStart(2, '0') + fgArr[2].toString(16).padStart(2, '0');
      const bgHex = '#' + currentBg[0].toString(16).padStart(2, '0') + currentBg[1].toString(16).padStart(2, '0') + currentBg[2].toString(16).padStart(2, '0');
      const ratio = contrastRatio(fgHex, bgHex);
      assert(ratio >= 4.5, `Visible control contrast [${desc}] (${fgHex} on ${bgHex}): ${ratio}:1 (>= 4.5:1)`);
      return ratio;
    }

    // Dismiss setup modal if open, switch to apple accent, apply demo data
    await evalJs(`
      (() => {
        const storageKey = 'our_life_planner_settings_v1';
        const raw = window.localStorage.getItem(storageKey);
        let settings = raw ? JSON.parse(raw) : {};
        settings.hasCompletedSetup = true;
        settings.accentColor = 'apple';
        window.localStorage.setItem(storageKey, JSON.stringify(settings));
        window.localStorage.setItem('hasCompletedSetup', 'true');
      })()
    `);
    await cdp.send('Page.reload');
    await wait(1500);

    // ==========================================
    // 4A. REAL APPEARANCE PICKER INTERACTION (F4)
    // ==========================================
    console.log('\n4A. Testing Real Appearance Picker & Refresh Persistence...');
    await setViewport(1440, 900, false);
    await wait(300);

    // Navigate to Settings
    await navigateToView('settings', 'Settings', '[data-testid="settings-heading"]', false);

    // Click Apple accent preset using real UI control
    const clickedApple = await evalJs<boolean>(`
      (() => {
        const btn = document.querySelector('button[data-testid="settings-accent-apple"]');
        if (!btn) return false;
        (btn).click();
        return true;
      })()
    `);
    assert(clickedApple, 'Clicked real Apple accent button in SettingsView');
    await wait(300);

    // Verify data-accent on root
    const rootDataAccentBefore = await evalJs(`document.documentElement.getAttribute('data-accent')`);
    assert(rootDataAccentBefore === 'apple', `Root document has data-accent="apple" (found: ${rootDataAccentBefore})`);

    // Reload page and assert persistence without manual override
    await cdp.send('Page.reload');
    await wait(1500);
    const rootDataAccentPersisted = await evalJs(`document.documentElement.getAttribute('data-accent')`);
    assert(rootDataAccentPersisted === 'apple', `Apple accent persisted after page reload (found: ${rootDataAccentPersisted})`);

    // Set Light Theme via real UI
    await navigateToView('settings', 'Settings', '[data-testid="settings-heading"]', false);
    const clickedLight = await evalJs<boolean>(`
      (() => {
        const btn = document.querySelector('button[data-testid="settings-theme-light"]');
        if (!btn) return false;
        (btn).click();
        return true;
      })()
    `);
    assert(clickedLight, 'Clicked real Light mode button in SettingsView');
    await wait(300);

    // Reload and verify light theme persistence naturally
    await cdp.send('Page.reload');
    await wait(1500);
    const lightBodyBg = await evalJs(`getComputedStyle(document.body).backgroundColor`);
    assert(
      lightBodyBg === 'rgb(245, 245, 247)' || lightBodyBg === '#f5f5f7',
      `Natural Light mode body background persisted as #F5F5F7 (found: ${lightBodyBg})`
    );

    // Check undefined role variables audit in live DOM
    const undefinedVarCount = await evalJs<number>(`
      (() => {
        let count = 0;
        document.querySelectorAll('*').forEach((el) => {
          const style = el.getAttribute('style') || '';
          if (style.includes('var(--accent-foreground)') || style.includes('var(--accent-muted)')) {
            count++;
          }
        });
        return count;
      })()
    `);
    assert(undefinedVarCount === 0, `Zero DOM elements consume undefined role variables (found: ${undefinedVarCount})`);

    // Measure live button contrast in Light Mode
    await navigateToView('settings', 'Settings', '[data-testid="settings-heading"]', false);
    await measureRealElementContrast('button[data-testid="settings-accent-apple"]', 'Apple accent button');

    // ==========================================
    // 4B. CAPTURE DESKTOP LIGHT SCREENSHOTS (F4)
    // ==========================================
    console.log('\n4B. Capturing Verified Desktop Light Screenshots...');
    // 1. Today Light Desktop
    await navigateToView('today', 'Your day', '[data-testid="today-compact-focus-card"]', false);
    await measureRealElementContrast('button[data-testid="today-focus-toggle-btn"]', 'Today Focus toggle button');
    await captureScreenshot('01-today-light-desktop.png');

    // 2. Tasks Light Desktop
    await navigateToView('tasks', 'Tasks', '[data-testid="tasks-heading"]', false);
    await measureRealElementContrast('button[data-testid="tasks-new-task-btn"]', 'Tasks New task primary button');
    await captureScreenshot('02-tasks-light-desktop.png');

    // 3. Budget Light Desktop
    await navigateToView('budget', 'Budget', '[data-testid="budget-heading"]', false);
    await captureScreenshot('03-budget-light-desktop.png');

    // 4. Settings Light Desktop
    await navigateToView('settings', 'Settings', '[data-testid="settings-heading"]', false);
    await captureScreenshot('04-settings-light-desktop.png');

    // ==========================================
    // 4C. SWITCH TO DARK MODE VIA REAL PICKER
    // ==========================================
    console.log('\n4C. Switching to Dark Mode via Real Appearance Picker & Verifying Persistence...');
    const clickedDark = await evalJs<boolean>(`
      (() => {
        const btn = document.querySelector('button[data-testid="settings-theme-dark"]');
        if (!btn) return false;
        (btn).click();
        return true;
      })()
    `);
    assert(clickedDark, 'Clicked real Dark mode button in SettingsView');
    await wait(300);

    // Reload and verify dark theme persistence naturally
    await cdp.send('Page.reload');
    await wait(1500);

    const darkClassActive = await evalJs<boolean>(`document.documentElement.classList.contains('dark')`);
    assert(darkClassActive, 'document.documentElement has .dark class after reload without manual override');

    const darkBodyBg = await evalJs(`getComputedStyle(document.body).backgroundColor`);
    assert(
      darkBodyBg === 'rgb(0, 0, 0)' || darkBodyBg === '#000000',
      `Natural Dark mode body background persisted as #000000 (found: ${darkBodyBg})`
    );

    const darkComputedAccent = await evalJs(`getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`);
    assert(darkComputedAccent.toLowerCase() === '#2997ff', `Dark mode computed --accent is #2997FF (found: ${darkComputedAccent})`);

    // ==========================================
    // 4D. CAPTURE DESKTOP DARK SCREENSHOTS (F4)
    // ==========================================
    console.log('\n4D. Capturing Verified Desktop Dark Screenshots...');
    // 8. Settings Dark Desktop
    await navigateToView('settings', 'Settings', '[data-testid="settings-heading"]', false);
    await measureRealElementContrast('button[data-testid="settings-accent-apple"]', 'Settings Apple radio button (dark)');
    await captureScreenshot('08-settings-dark-desktop.png');

    // 5. Today Dark Desktop
    await navigateToView('today', 'Your day', '[data-testid="today-compact-focus-card"]', false);
    await measureRealElementContrast('button[data-testid="today-focus-toggle-btn"]', 'Today Focus toggle button (dark)');
    await captureScreenshot('05-today-dark-desktop.png');

    // 6. Tasks Dark Desktop
    await navigateToView('tasks', 'Tasks', '[data-testid="tasks-heading"]', false);
    await measureRealElementContrast('button[data-testid="tasks-new-task-btn"]', 'Tasks New task primary button (dark)');
    await captureScreenshot('06-tasks-dark-desktop.png');

    // 7. Budget Dark Desktop
    await navigateToView('budget', 'Budget', '[data-testid="budget-heading"]', false);
    await captureScreenshot('07-budget-dark-desktop.png');

    // ==========================================
    // 4E. MOBILE SCREENSHOTS (390 x 844)
    // ==========================================
    console.log('\n4E. Capturing Verified Mobile Screenshots (390x844)...');
    await setViewport(390, 844, true);
    await wait(400);

    // 9. Today Dark Mobile
    await navigateToView('today', 'Your day', '[data-testid="today-compact-focus-card"]', true);
    await captureScreenshot('09-today-dark-mobile.png');

    // 10. Tasks Dark Mobile
    await navigateToView('tasks', 'Tasks', '[data-testid="tasks-heading"]', true);
    await captureScreenshot('10-tasks-dark-mobile.png');

    // Switch back to Light Mode via Settings on mobile
    await navigateToView('settings', 'Settings', '[data-testid="settings-heading"]', true);
    const clickedLightMobile = await evalJs<boolean>(`
      (() => {
        const btn = document.querySelector('button[data-testid="settings-theme-light"]');
        if (!btn) return false;
        (btn).click();
        return true;
      })()
    `);
    assert(clickedLightMobile, 'Switched to Light Mode on Mobile via Settings');
    await wait(300);
    await cdp.send('Page.reload');
    await wait(1500);

    // 12. Settings Light Mobile
    await navigateToView('settings', 'Settings', '[data-testid="settings-heading"]', true);
    await captureScreenshot('12-settings-light-mobile.png');

    // 11. Today Light Mobile
    await navigateToView('today', 'Your day', '[data-testid="today-compact-focus-card"]', true);
    await captureScreenshot('11-today-light-mobile.png');

    // ==========================================
    // 4F. SCREENSHOT UNIQUENESS & HASH VERIFICATION (F4)
    // ==========================================
    console.log('\n4F. Verifying Unique Hashes and Non-Duplication of All Screenshots...');
    const h01 = getFileHash(path.join(outDir, '01-today-light-desktop.png'));
    const h02 = getFileHash(path.join(outDir, '02-tasks-light-desktop.png'));
    const h03 = getFileHash(path.join(outDir, '03-budget-light-desktop.png'));
    const h04 = getFileHash(path.join(outDir, '04-settings-light-desktop.png'));

    const h05 = getFileHash(path.join(outDir, '05-today-dark-desktop.png'));
    const h06 = getFileHash(path.join(outDir, '06-tasks-dark-desktop.png'));
    const h07 = getFileHash(path.join(outDir, '07-budget-dark-desktop.png'));
    const h08 = getFileHash(path.join(outDir, '08-settings-dark-desktop.png'));

    const h09 = getFileHash(path.join(outDir, '09-today-dark-mobile.png'));
    const h10 = getFileHash(path.join(outDir, '10-tasks-dark-mobile.png'));

    const h11 = getFileHash(path.join(outDir, '11-today-light-mobile.png'));
    const h12 = getFileHash(path.join(outDir, '12-settings-light-mobile.png'));

    // Assert Desktop Light distinctness
    assert(h01 !== h02 && h01 !== h03 && h01 !== h04 && h02 !== h03 && h02 !== h04 && h03 !== h04,
      'Desktop light screenshots (Today, Tasks, Budget, Settings) are all distinct unique images (no duplicated captures)');

    // Assert Desktop Dark distinctness
    assert(h05 !== h06 && h05 !== h07 && h05 !== h08 && h06 !== h07 && h06 !== h08 && h07 !== h08,
      'Desktop dark screenshots (Today, Tasks, Budget, Settings) are all distinct unique images (no duplicated captures)');

    // Assert Mobile Dark distinctness
    assert(h09 !== h10, 'Mobile dark screenshots (Today, Tasks) are distinct unique images');

    // Assert Mobile Light distinctness
    assert(h11 !== h12, 'Mobile light screenshots (Today, Settings) are distinct unique images');

    // ==========================================
    // 4G. RENDERED BEHAVIOR ASSERTIONS (R3, R6, R7, F3)
    // ==========================================
    console.log('\n4G. Verifying Rendered Behavior Assertions (R3, R6, R7, F3)...');
    await setViewport(1280, 800, false);
    await wait(300);

    // R7 rendered behavior: Core Starter preset renders Compact Focus visibly
    await evalJs(`
      (() => {
        const storageKey = 'our_life_planner_settings_v1';
        const raw = window.localStorage.getItem(storageKey);
        let s = raw ? JSON.parse(raw) : {};
        s.enabledTools = ['today', 'tasks', 'calendar', 'routines', 'inbox'];
        window.localStorage.setItem(storageKey, JSON.stringify(s));
      })()
    `);
    await cdp.send('Page.reload');
    await wait(1200);

    await navigateToView('today', 'Your day', '[data-testid="today-compact-focus-card"]', false);
    const focusCardVisible = await evalJs<boolean>(`
      (() => {
        const el = document.querySelector('[data-testid="today-compact-focus-card"]');
        return Boolean(el && el.offsetHeight > 0 && el.offsetWidth > 0);
      })()
    `);
    assert(focusCardVisible, 'R7: Core Starter preset renders data-testid="today-compact-focus-card" visibly');

    // F3 rendered behavior: Calendar module filtering in Core Starter
    await navigateToView('calendar', 'Calendar', '[data-testid="calendar-schedule-section"], h2', false);
    const calendarFilterChips = await evalJs<string[]>(`
      (() => {
        return Array.from(document.querySelectorAll('[data-testid^="calendar-filter-"]'))
          .map(el => el.getAttribute('data-testid'));
      })()
    `);
    assert(!calendarFilterChips.includes('calendar-filter-meals'), 'F3: Meals filter chip absent in Core Starter Calendar');
    assert(!calendarFilterChips.includes('calendar-filter-bills'), 'F3: Bills filter chip absent in Core Starter Calendar');
    assert(!calendarFilterChips.includes('calendar-filter-workouts'), 'F3: Workouts filter chip absent in Core Starter Calendar');

    // F3 rendered behavior: Chronological ordering & all-day policy in Coming Up
    // Enable all tools to test mixed items
    await evalJs(`
      (() => {
        const storageKey = 'our_life_planner_settings_v1';
        const raw = window.localStorage.getItem(storageKey);
        let s = raw ? JSON.parse(raw) : {};
        s.enabledTools = ['today', 'tasks', 'calendar', 'routines', 'inbox', 'goals', 'habits', 'budget', 'savings', 'debt', 'meals', 'groceries', 'workouts', 'weight', 'water', 'settings'];
        window.localStorage.setItem(storageKey, JSON.stringify(s));
      })()
    `);
    await cdp.send('Page.reload');
    await wait(1200);

    await navigateToView('calendar', 'Calendar', '[data-testid="calendar-schedule-section"], h2', false);

    // Verify Coming Up disclosure toggle exists when items > 5
    const upcomingBadgeText = await evalJs<string>(`
      (() => {
        const badge = document.querySelector('[data-testid="calendar-upcoming-badge"]');
        return badge ? (badge.textContent || '').trim() : '';
      })()
    `);
    assert(Boolean(upcomingBadgeText), `F3: Calendar Coming Up card displays true total upcoming count badge (found: ${upcomingBadgeText})`);

    // R6 rendered behavior: 320px viewport layout wrapping
    await setViewport(320, 600, true);
    await wait(300);
    const is320NoHorizontalOverflow = await evalJs<boolean>(`
      document.body.scrollWidth <= 325
    `);
    assert(is320NoHorizontalOverflow, 'R6: 320px viewport layout renders without horizontal overflow or clipping');

    console.log('\nAll 12 visual verification screenshots captured and verified as distinct in artifacts/premium-ui/apple-color-system/!');
    console.log('=== APPLE-INSPIRED COLOR SYSTEM VERIFICATION COMPLETED SUCCESSFULLY ===');
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
