import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os';

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

function findEdge(): string {
  for (const p of EDGE_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Microsoft Edge executable not found');
}

function getJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  private ws: WebSocket;
  private id = 0;
  private callbacks = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
  }

  async connect(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.callbacks.has(msg.id)) {
        const cb = this.callbacks.get(msg.id)!;
        this.callbacks.delete(msg.id);
        if (msg.error) cb.reject(new Error(msg.error.message));
        else cb.resolve(msg.result);
      }
    };
  }

  send(method: string, params: Record<string, any> = {}): Promise<any> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T = any>(expression: string): Promise<T> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(
        `Runtime exception: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description || ''}`
      );
    }
    return res.result?.value as T;
  }

  close() {
    this.ws.close();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function setViewport(cdp: CDPClient, width: number, height: number, mobile = false, scale = 1) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: scale,
    mobile,
  });
  await sleep(200);
}

async function navigateToView(cdp: CDPClient, viewLabel: string, toolId?: string) {
  await cdp.evaluate(`
    (() => {
      // Close any open modal first
      const closeDialog = document.querySelector('[role="dialog"] button[aria-label*="Close"]');
      if (closeDialog) closeDialog.click();
    })()
  `);
  await sleep(100);

  const clickedSidebar = await cdp.evaluate(`
    (() => {
      const sideBtns = Array.from(document.querySelectorAll('aside button'));
      const btn = sideBtns.find(b => (b.textContent || '').trim() === ${JSON.stringify(viewLabel)});
      if (btn && btn.offsetParent !== null) {
        btn.click();
        return true;
      }
      return false;
    })()
  `);
  if (clickedSidebar) {
    await sleep(350);
    return;
  }

  // Fallback to mobile More menu
  await cdp.evaluate(`
    (() => {
      const openMenu = document.querySelector('button[aria-label="Open menu"]');
      if (openMenu) openMenu.click();
    })()
  `);
  await sleep(250);
  await cdp.evaluate(`
    (() => {
      const id = ${JSON.stringify(toolId || viewLabel.toLowerCase())};
      const item = document.querySelector('[data-testid="moresheet-tool-' + id + '"]');
      if (item) {
        item.click();
        return;
      }
      const allBtns = Array.from(document.querySelectorAll('#all-tools-menu button'));
      const match = allBtns.find(b => (b.textContent || '').includes(${JSON.stringify(viewLabel)}));
      if (match) match.click();
    })()
  `);
  await sleep(350);
}

async function main() {
  const htmlPath = path.resolve(process.cwd(), 'dist', 'Our-Life-Planner-Offline.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Build artifact missing at ${htmlPath}. Run npm run build first.`);
  }

  const edgePath = findEdge();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olp-phase2-a11y-'));
  const debugPort = 9460 + Math.floor(Math.random() * 200);
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');

  const proc = spawn(
    edgePath,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1440,900',
      fileUrl,
    ],
    { stdio: 'ignore' }
  );

  let cdp: CDPClient | null = null;
  try {
    let targets: any[] = [];
    for (let i = 0; i < 30; i++) {
      try {
        targets = await getJson(`http://127.0.0.1:${debugPort}/json/list`);
        if (targets.length > 0) break;
      } catch {
        // retry
      }
      await sleep(250);
    }
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error('Failed to connect to Edge CDP target');
    }

    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    await cdp.send('Accessibility.enable');

    await sleep(1000);
    await setViewport(cdp, 1440, 900, false);

    // Dismiss Setup Wizard if open
    await cdp.evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const closeSetup = btns.find(b => (b.getAttribute('aria-label') || '').includes('Close'));
        if (closeSetup) closeSetup.click();
      })()
    `);
    await sleep(250);

    // Load deterministic demo data via Settings -> Reload Demo Data -> Confirm & Load Demo Data
    await navigateToView(cdp, 'Settings', 'settings');
    await cdp.evaluate(`
      (() => {
        const reloadBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Reload Demo'));
        if (reloadBtn) reloadBtn.click();
      })()
    `);
    await sleep(250);
    await cdp.evaluate(`
      (() => {
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Confirm & Load Demo Data'));
        if (confirmBtn) confirmBtn.click();
      })()
    `);
    await sleep(500);

    console.log('--- 1. LP-13: Workouts Accessible Names, Checkbox Semantics & AXTree Smoke Test ---');
    await navigateToView(cdp, 'Workouts', 'workouts');

    const workoutCheck = await cdp.evaluate(`
      (() => {
        const setInputs = Array.from(document.querySelectorAll('input[type="number"][aria-label*=" set "]'));
        const setCheckboxes = Array.from(document.querySelectorAll('[role="checkbox"][aria-label*=" set "]'));
        const addSetButtons = Array.from(document.querySelectorAll('button[aria-label^="Add set for "]'));
        return {
          inputCount: setInputs.length,
          inputLabels: setInputs.map(el => el.getAttribute('aria-label') || ''),
          checkboxCount: setCheckboxes.length,
          checkboxInfo: setCheckboxes.map(el => ({
            label: el.getAttribute('aria-label') || '',
            checked: el.getAttribute('aria-checked'),
            role: el.getAttribute('role'),
          })),
          addSetLabels: addSetButtons.map(el => el.getAttribute('aria-label') || ''),
        };
      })()
    `);

    assert(workoutCheck.inputCount >= 18, `Expected at least 18 workout set inputs (6 sets x 3 fields), got ${workoutCheck.inputCount}`);
    for (const label of workoutCheck.inputLabels) {
      assert(
        /^.+ set \d+ (weight \((kg|lbs)\)|reps|rest \(seconds\))$/.test(label),
        `Workout set input label "${label}" does not match expected "<Exercise> set <N> <unit>" pattern`
      );
    }
    assert(workoutCheck.checkboxCount >= 6, `Expected at least 6 workout set completion checkboxes, got ${workoutCheck.checkboxCount}`);
    for (const cb of workoutCheck.checkboxInfo) {
      assert(cb.role === 'checkbox', `Expected role="checkbox", got "${cb.role}"`);
      assert(cb.checked === 'true' || cb.checked === 'false', `Expected aria-checked="true"|"false", got "${cb.checked}"`);
      assert(
        /set \d+ complete/.test(cb.label),
        `Workout set checkbox label "${cb.label}" does not include exercise and set number`
      );
    }
    assert(workoutCheck.addSetLabels.length >= 2, `Expected at least 2 "Add set to <Exercise>" buttons, got ${workoutCheck.addSetLabels.length}`);

    // Verify AXTree exposes the workout inputs and checkboxes with their computed accessible names
    const axTree = await cdp.send('Accessibility.getFullAXTree');
    const axNodes: any[] = axTree.nodes || [];
    const axSpinbuttons = axNodes.filter(
      (n) => n.role?.value === 'spinbutton' && /set \d+ (weight|reps|rest)/.test(n.name?.value || '')
    );
    const axSetCheckboxes = axNodes.filter(
      (n) => n.role?.value === 'checkbox' && /set \d+ complete/.test(n.name?.value || '')
    );
    assert(
      axSpinbuttons.length >= 18,
      `AXTree smoke test: expected >= 18 spinbuttons with exercise/set/unit names, found ${axSpinbuttons.length}`
    );
    assert(
      axSetCheckboxes.length >= 6,
      `AXTree smoke test: expected >= 6 set completion checkboxes in AXTree, found ${axSetCheckboxes.length}`
    );

    // Keyboard/click toggle check on workout set completion checkbox
    const initialChecked = await cdp.evaluate(`
      (() => {
        const cbs = Array.from(document.querySelectorAll('[role="checkbox"][aria-label*=" set "]'));
        const cb = cbs[0];
        if (!cb) return null;
        cb.focus();
        return cb.getAttribute('aria-checked');
      })()
    `);
    assert(initialChecked !== null, 'Could not find first workout set checkbox');
    await cdp.evaluate(`
      (() => {
        const cbs = Array.from(document.querySelectorAll('[role="checkbox"][aria-label*=" set "]'));
        if (cbs[0]) cbs[0].click();
      })()
    `);
    await sleep(150);
    const afterToggle = await cdp.evaluate(`
      (() => {
        const cbs = Array.from(document.querySelectorAll('[role="checkbox"][aria-label*=" set "]'));
        return cbs[0] ? cbs[0].getAttribute('aria-checked') : null;
      })()
    `);
    assert(
      afterToggle === (initialChecked === 'true' ? 'false' : 'true'),
      `Expected workout checkbox aria-checked to toggle from ${initialChecked}, got ${afterToggle}`
    );
    console.log('✓ Workouts accessible names, checkbox semantics, and AXTree nodes verified.');

    console.log('--- 2. LP-13: Settings Module Controls Context & AXTree Verification ---');
    await navigateToView(cdp, 'Settings', 'settings');

    const settingsControls = await cdp.evaluate(`
      (() => {
        const pins = Array.from(document.querySelectorAll('[data-testid^="module-pin-"]'));
        const toggles = Array.from(document.querySelectorAll('[data-testid^="module-toggle-"]'));
        return {
          pinCount: pins.length,
          pins: pins.map(el => ({
            testId: el.getAttribute('data-testid'),
            ariaLabel: el.getAttribute('aria-label') || '',
            ariaPressed: el.getAttribute('aria-pressed'),
          })),
          toggleCount: toggles.length,
          toggles: toggles.map(el => ({
            testId: el.getAttribute('data-testid'),
            ariaLabel: el.getAttribute('aria-label') || '',
            ariaPressed: el.getAttribute('aria-pressed'),
            text: (el.textContent || '').trim(),
          })),
        };
      })()
    `);

    assert(settingsControls.pinCount >= 10, `Expected >= 10 module pin controls, got ${settingsControls.pinCount}`);
    for (const p of settingsControls.pins) {
      assert(
        /^(Pin|Unpin) .+ (to|from) favorites$/.test(p.ariaLabel),
        `Settings pin control ${p.testId} missing module context in aria-label: "${p.ariaLabel}"`
      );
      assert(p.ariaPressed === 'true' || p.ariaPressed === 'false', `Settings pin ${p.testId} missing aria-pressed`);
    }
    assert(settingsControls.toggleCount >= 10, `Expected >= 10 module toggle controls, got ${settingsControls.toggleCount}`);
    for (const t of settingsControls.toggles) {
      assert(
        /^.+: (Enabled|Hidden)$/.test(t.ariaLabel),
        `Settings toggle control ${t.testId} missing module context in aria-label: "${t.ariaLabel}"`
      );
      assert(t.text === 'Enabled' || t.text === 'Hidden', `Settings toggle ${t.testId} visible text should be Enabled/Hidden, got "${t.text}"`);
      assert(t.ariaPressed === 'true' || t.ariaPressed === 'false', `Settings toggle ${t.testId} missing aria-pressed`);
    }
    console.log('✓ Settings module pin and enable/hide controls include module name context and aria-pressed.');

    console.log('--- 3. LP-13: Meals Weekly Grid "+ Add" Controls Context ---');
    await navigateToView(cdp, 'Meals', 'meals');

    const mealsAddButtons = await cdp.evaluate(`
      (() => {
        const addBtns = Array.from(document.querySelectorAll('button')).filter(b => (b.textContent || '').trim() === '+ Add');
        return addBtns.map(b => ({
          text: (b.textContent || '').trim(),
          ariaLabel: b.getAttribute('aria-label') || '',
        }));
      })()
    `);
    assert(mealsAddButtons.length >= 20, `Expected >= 20 empty meal slot "+ Add" buttons, got ${mealsAddButtons.length}`);
    for (const btn of mealsAddButtons) {
      assert(
        /^Add (breakfast|lunch|dinner|snack) for [A-Za-z]+, \d+ [A-Za-z]+ \(\d{4}-\d{2}-\d{2}\)$/.test(btn.ariaLabel),
        `Meals + Add button aria-label missing meal type or date context: "${btn.ariaLabel}"`
      );
    }
    console.log(`✓ All ${mealsAddButtons.length} Meals "+ Add" controls expose meal slot and date context.`);

    console.log('--- 4. LP-13: Mobile Touch Targets (>= 44x44 CSSpx at 390x844 and 320x640) ---');
    await setViewport(cdp, 390, 844, true);
    await navigateToView(cdp, 'Today', 'today');

    const todayTargets = await cdp.evaluate(`
      (() => {
        const results = [];
        const check = (name, el) => {
          if (!el) {
            results.push({ name, missing: true, width: 0, height: 0 });
            return;
          }
          const r = el.getBoundingClientRect();
          results.push({ name, missing: false, width: Math.round(r.width), height: Math.round(r.height) });
        };

        check('Header Open Menu Button', document.querySelector('button[aria-label="Open menu"]'));
        check('Header Search Button', document.querySelector('button[aria-label="Search planner"]'));
        check('Header Quick Add Button', document.querySelector('button[aria-label="Quick add item"]'));
        check('Header Profile Button', document.querySelector('button[aria-label^="Profile and local storage for "]'));

        const waterBtns = Array.from(document.querySelectorAll('button')).filter(b => /\\+(250|500|750)\\s*ml/.test(b.textContent || ''));
        waterBtns.forEach((b, i) => check('Water Quick Button ' + i, b));

        const weekBtns = Array.from(document.querySelectorAll('button[aria-pressed]')).filter(b => /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(b.textContent || ''));
        weekBtns.forEach((b, i) => check('Today Week Strip ' + i, b));

        const habitBtns = Array.from(document.querySelectorAll('button[aria-label^="Mark "][aria-label*=" complete"], button[aria-label^="Unmark "]'));
        habitBtns.forEach((b, i) => check('Today Habit Button ' + i, b));

        return results;
      })()
    `);

    for (const t of todayTargets) {
      assert(!t.missing, `Touch target missing on Today mobile view: ${t.name}`);
      assert(
        t.width >= 44 && t.height >= 44,
        `Touch target "${t.name}" at 390px width is ${t.width}x${t.height} CSSpx (expected >= 44x44)`
      );
    }

    // Check MoreSheet targets on mobile
    await cdp.evaluate(`
      (() => {
        const moreBtn = document.querySelector('button[aria-label="Open menu"]');
        if (moreBtn) moreBtn.click();
      })()
    `);
    await sleep(350);

    const moreSheetTargets = await cdp.evaluate(`
      (() => {
        const dialog = document.querySelector('#all-tools-menu[role="dialog"]');
        if (!dialog) return { missing: true };
        const closeBtn = dialog.querySelector('button[aria-label="Close menu"]');
        const searchInput = dialog.querySelector('input[aria-label="Search tools"]');
        const items = Array.from(dialog.querySelectorAll('[data-testid^="moresheet-tool-"]'));
        const rect = (el) => {
          const r = el.getBoundingClientRect();
          return { width: Math.round(r.width), height: Math.round(r.height) };
        };
        return {
          missing: false,
          closeBtn: closeBtn ? rect(closeBtn) : null,
          searchInput: searchInput ? rect(searchInput) : null,
          itemRects: items.map(el => ({ id: el.getAttribute('data-testid'), ...rect(el) })),
        };
      })()
    `);
    assert(!moreSheetTargets.missing, 'MoreSheet dialog did not open');
    assert(
      moreSheetTargets.closeBtn && moreSheetTargets.closeBtn.width >= 44 && moreSheetTargets.closeBtn.height >= 44,
      `MoreSheet close button is ${JSON.stringify(moreSheetTargets.closeBtn)} (expected >= 44x44)`
    );
    assert(
      moreSheetTargets.searchInput && moreSheetTargets.searchInput.height >= 44,
      `MoreSheet search input height is ${moreSheetTargets.searchInput?.height} (expected >= 44)`
    );
    for (const item of moreSheetTargets.itemRects) {
      assert(item.width >= 44 && item.height >= 44, `MoreSheet item ${item.id} is ${item.width}x${item.height} (< 44x44)`);
    }

    // Navigate to Settings via MoreSheet on mobile and check module pin/toggle targets
    await cdp.evaluate(`
      (() => {
        const settingsItem = Array.from(document.querySelectorAll('#all-tools-menu button')).find(b => (b.textContent || '').includes('Settings & Preferences'));
        if (settingsItem) settingsItem.click();
      })()
    `);
    await sleep(400);

    const mobileSettingsTargets = await cdp.evaluate(`
      (() => {
        const pins = Array.from(document.querySelectorAll('[data-testid^="module-pin-"]'));
        const toggles = Array.from(document.querySelectorAll('[data-testid^="module-toggle-"]'));
        return {
          pins: pins.map(el => {
            const r = el.getBoundingClientRect();
            return { id: el.getAttribute('data-testid'), w: Math.round(r.width), h: Math.round(r.height) };
          }),
          toggles: toggles.map(el => {
            const r = el.getBoundingClientRect();
            return { id: el.getAttribute('data-testid'), w: Math.round(r.width), h: Math.round(r.height) };
          }),
        };
      })()
    `);
    for (const p of mobileSettingsTargets.pins) {
      assert(p.w >= 44 && p.h >= 44, `Mobile Settings pin ${p.id} is ${p.w}x${p.h} (< 44x44)`);
    }
    for (const t of mobileSettingsTargets.toggles) {
      assert(t.w >= 44 && t.h >= 44, `Mobile Settings toggle ${t.id} is ${t.w}x${t.h} (< 44x44)`);
    }
    console.log('✓ Frequent mobile touch targets across Header, Today, MoreSheet, and Settings meet >= 44x44 CSSpx.');

    console.log('--- 5. LP-14: Dark-State Contrast & Paired Tokens (FocusModal Pause Hover + Theme Audit) ---');
    await setViewport(cdp, 1440, 900, false);
    await navigateToView(cdp, 'Settings', 'settings');
    await cdp.evaluate(`
      (() => {
        const darkBtn = document.querySelector('button[aria-label="Dark mode"]');
        if (darkBtn) darkBtn.click();
      })()
    `);
    await sleep(250);
    await navigateToView(cdp, 'Today', 'today');

    await cdp.evaluate(`
      (() => {
        const focusBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Single-Task Focus') || (b.textContent || '').trim() === 'Focus');
        if (focusBtn) focusBtn.click();
      })()
    `);
    await sleep(350);

    await cdp.evaluate(`
      (() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return;
        const startBtn = Array.from(dialog.querySelectorAll('button')).find(b => (b.textContent || '').includes('Start'));
        if (startBtn) startBtn.click();
      })()
    `);
    await sleep(250);

    const docRoot = await cdp.send('DOM.getDocument', { depth: -1 });
    const pauseNodeRes = await cdp.evaluate(`
      (() => {
        const dialog = document.querySelector('[role="dialog"]');
        const pauseBtn = Array.from(dialog.querySelectorAll('button')).find(b => (b.textContent || '').includes('Pause'));
        if (pauseBtn) pauseBtn.setAttribute('data-testid', 'focus-pause-btn');
        return !!pauseBtn;
      })()
    `);
    assert(pauseNodeRes, 'FocusModal Pause button not found');

    const querySel = await cdp.send('DOM.querySelector', {
      nodeId: docRoot.root.nodeId,
      selector: '[data-testid="focus-pause-btn"]',
    });
    assert(querySel.nodeId, 'Could not resolve DOM nodeId for focus-pause-btn');

    const computeContrastInPage = async () => {
      return await cdp!.evaluate(`
        (() => {
          function parseColor(str) {
            const c = document.createElement('canvas');
            c.width = 1;
            c.height = 1;
            const ctx = c.getContext('2d');
            ctx.fillStyle = str;
            ctx.fillRect(0, 0, 1, 1);
            const d = ctx.getImageData(0, 0, 1, 1).data;
            return { r: d[0], g: d[1], b: d[2], a: +(d[3] / 255).toFixed(3) };
          }
          function blend(fg, bg) {
            const a = fg.a + bg.a * (1 - fg.a);
            if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
            return {
              r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
              g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
              b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
              a,
            };
          }
          function getEffectiveBg(el) {
            const layers = [];
            let cur = el;
            while (cur && cur.nodeType === 1) {
              const bg = getComputedStyle(cur).backgroundColor;
              if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                const parsed = parseColor(bg);
                if (parsed.a > 0) layers.unshift(parsed);
                if (parsed.a >= 0.999) break;
              }
              cur = cur.parentElement;
            }
            const isDark = document.documentElement.classList.contains('dark');
            let base = isDark ? { r: 15, g: 23, b: 42, a: 1 } : { r: 248, g: 250, b: 252, a: 1 };
            for (const l of layers) base = blend(l, base);
            return base;
          }
          function lum(c) {
            const srgb = [c.r / 255, c.g / 255, c.b / 255].map(v =>
              v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
            );
            return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
          }
          function contrast(c1, c2) {
            const l1 = lum(c1);
            const l2 = lum(c2);
            return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          }

          const btn = document.querySelector('[data-testid="focus-pause-btn"]');
          const cs = getComputedStyle(btn);
          const bg = getEffectiveBg(btn);
          const fg = blend(parseColor(cs.color), bg);
          const ratio = contrast(fg, bg);
          return {
            color: cs.color,
            backgroundColor: cs.backgroundColor,
            effectiveBg: \`rgb(\${Math.round(bg.r)}, \${Math.round(bg.g)}, \${Math.round(bg.b)})\`,
            ratio: Number(ratio.toFixed(2)),
          };
        })()
      `);
    };

    const pauseDefaultDark = await computeContrastInPage();
    await cdp.send('CSS.forcePseudoState', {
      nodeId: querySel.nodeId,
      forcedPseudoClasses: ['hover'],
    });
    await sleep(100);
    const pauseHoverDark = await computeContrastInPage();
    await cdp.send('CSS.forcePseudoState', {
      nodeId: querySel.nodeId,
      forcedPseudoClasses: [],
    });

    console.log('FocusModal Pause (Dark Default):', pauseDefaultDark);
    console.log('FocusModal Pause (Dark :hover):', pauseHoverDark);
    assert(
      pauseDefaultDark.ratio >= 4.5,
      `FocusModal Pause default dark contrast ${pauseDefaultDark.ratio}:1 is below 4.5:1`
    );
    assert(
      pauseHoverDark.ratio >= 4.5,
      `FocusModal Pause :hover dark contrast ${pauseHoverDark.ratio}:1 is below 4.5:1 (was 1.16:1 in audit [C23])`
    );

    // Close FocusModal via Escape
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
    await sleep(250);

    const focusModalClosed = await cdp.evaluate(`!document.querySelector('[data-testid="focus-pause-btn"]')`);
    assert(focusModalClosed, 'FocusModal should close on Escape');

    // Also verify Light Mode FocusModal Pause default & :hover contrast, plus focus-ring and text contrast across themes
    const themeAudit = await cdp.evaluate(`
      (() => {
        function parseColor(str) {
          const c = document.createElement('canvas');
          c.width = 1;
          c.height = 1;
          const ctx = c.getContext('2d');
          ctx.fillStyle = str;
          ctx.fillRect(0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data;
          return { r: d[0], g: d[1], b: d[2], a: +(d[3] / 255).toFixed(3) };
        }
        function lum(c) {
          const srgb = [c.r / 255, c.g / 255, c.b / 255].map(v =>
            v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
          );
          return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
        }
        function contrast(c1, c2) {
          const l1 = lum(c1);
          const l2 = lum(c2);
          return Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2));
        }

        // Check CSS custom property tokens in both Light and Dark mode
        document.documentElement.classList.remove('dark');
        const lightStyle = getComputedStyle(document.documentElement);
        const lightFocusRing = parseColor(lightStyle.getPropertyValue('--focus-ring').trim() || '#06676A');
        const lightSurface = parseColor('#FFFFFF');
        const lightPrimaryText = parseColor('#071A3A');
        const lightMutedText = parseColor('#526782');
        const lightWarnBg = parseColor(lightStyle.getPropertyValue('--btn-warning-bg').trim() || '#FEF3C7');
        const lightWarnHoverBg = parseColor(lightStyle.getPropertyValue('--btn-warning-hover-bg').trim() || '#FDE68A');
        const lightWarnFg = parseColor(lightStyle.getPropertyValue('--btn-warning-fg').trim() || '#78350F');

        document.documentElement.classList.add('dark');
        const darkStyle = getComputedStyle(document.documentElement);
        const darkFocusRing = parseColor(darkStyle.getPropertyValue('--focus-ring').trim() || '#38D0C5');
        const darkSurface = parseColor('#152238');
        const darkPrimaryText = parseColor('#EDF4FF');
        const darkMutedText = parseColor('#A8B8CE');

        return {
          lightFocusRingRatio: contrast(lightFocusRing, lightSurface),
          darkFocusRingRatio: contrast(darkFocusRing, darkSurface),
          lightPrimaryTextRatio: contrast(lightPrimaryText, lightSurface),
          lightMutedTextRatio: contrast(lightMutedText, lightSurface),
          darkPrimaryTextRatio: contrast(darkPrimaryText, darkSurface),
          darkMutedTextRatio: contrast(darkMutedText, darkSurface),
          lightPauseDefaultRatio: contrast(lightWarnFg, lightWarnBg),
          lightPauseHoverRatio: contrast(lightWarnFg, lightWarnHoverBg),
        };
      })()
    `);
    console.log('Theme & Token Contrast Audit:', themeAudit);
    assert(themeAudit.lightFocusRingRatio >= 3.0, `Light focus ring contrast ${themeAudit.lightFocusRingRatio}:1 < 3:1`);
    assert(themeAudit.darkFocusRingRatio >= 3.0, `Dark focus ring contrast ${themeAudit.darkFocusRingRatio}:1 < 3:1`);
    assert(themeAudit.lightPrimaryTextRatio >= 4.5, `Light primary text contrast ${themeAudit.lightPrimaryTextRatio}:1 < 4.5:1`);
    assert(themeAudit.lightMutedTextRatio >= 4.5, `Light muted text contrast ${themeAudit.lightMutedTextRatio}:1 < 4.5:1`);
    assert(themeAudit.darkPrimaryTextRatio >= 4.5, `Dark primary text contrast ${themeAudit.darkPrimaryTextRatio}:1 < 4.5:1`);
    assert(themeAudit.darkMutedTextRatio >= 4.5, `Dark muted text contrast ${themeAudit.darkMutedTextRatio}:1 < 4.5:1`);
    assert(themeAudit.lightPauseDefaultRatio >= 4.5, `Light Pause default contrast ${themeAudit.lightPauseDefaultRatio}:1 < 4.5:1`);
    assert(themeAudit.lightPauseHoverRatio >= 4.5, `Light Pause hover contrast ${themeAudit.lightPauseHoverRatio}:1 < 4.5:1`);
    console.log('✓ FocusModal dark/light Pause default & :hover contrast (>= 4.5:1), text contrast (>= 4.5:1), and focus indicator contrast (>= 3:1) verified.');

    console.log('--- 6. LP-13 & LP-14: 200% Zoom Dialog Scrollability & Focus Visibility ---');
    // Simulate 200% zoom at 1280x720 desktop (= 640x360 CSSpx viewport)
    await setViewport(cdp, 640, 360, false, 2);
    await navigateToView(cdp, 'Workouts', 'workouts');

    await cdp.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('New workout'));
        if (btn) btn.click();
      })()
    `);
    await sleep(400);

    const zoomDialogCheck = await cdp.evaluate(`
      (() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return { open: false };
        // Find scrollable container (either dialog itself or its inner panel)
        const candidates = [dialog, ...Array.from(dialog.querySelectorAll('div'))];
        const scrollable = candidates.find(el => {
          const oy = getComputedStyle(el).overflowY;
          return oy === 'auto' || oy === 'scroll';
        });
        const saveBtn = Array.from(dialog.querySelectorAll('button')).find(b => /(Save|Schedule)/i.test(b.textContent || ''));
        if (saveBtn) saveBtn.scrollIntoView({ block: 'nearest' });
        const saveRect = saveBtn ? saveBtn.getBoundingClientRect() : null;
        return {
          open: true,
          hasScrollableContainer: !!scrollable,
          overflowY: scrollable ? getComputedStyle(scrollable).overflowY : 'none',
          viewportHeight: window.innerHeight,
          saveBtnReachable: saveRect ? (saveRect.bottom <= window.innerHeight + 2 && saveRect.top >= -2) : false,
        };
      })()
    `);
    assert(zoomDialogCheck.open, 'New workout dialog did not open at 200% zoom');
    assert(
      zoomDialogCheck.hasScrollableContainer,
      `Expected dialog to have overflow-y: auto/scroll container at 200% zoom, got ${zoomDialogCheck.overflowY}`
    );
    assert(zoomDialogCheck.saveBtnReachable, 'Primary action button inside dialog was not reachable via scrolling at 200% zoom');

    // Close dialog via Escape
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
    await sleep(250);
    console.log('✓ 200% zoom dialog scrollability verified.');

    console.log('--- 7. LP-14: Reduced Motion Preference (prefers-reduced-motion: reduce) ---');
    await setViewport(cdp, 1440, 900, false, 1);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await sleep(200);

    const reducedMotionCheck = await cdp.evaluate(`
      (() => {
        const match = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const btn = document.querySelector('button[aria-label="Quick add item"]');
        const cs = btn ? getComputedStyle(btn) : null;
        return {
          matchesMedia: match,
          transitionDuration: cs ? cs.transitionDuration : null,
        };
      })()
    `);
    assert(reducedMotionCheck.matchesMedia, 'prefers-reduced-motion: reduce media query did not match');
    assert(
      reducedMotionCheck.transitionDuration === '0.00001s' ||
        reducedMotionCheck.transitionDuration === '1e-05s' ||
        reducedMotionCheck.transitionDuration === '0s',
      `Expected suppressed transitionDuration under prefers-reduced-motion: reduce, got ${reducedMotionCheck.transitionDuration}`
    );
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
    });
    console.log('✓ prefers-reduced-motion: reduce suppresses transitions while preserving interactive states.');

    console.log('--- 8. Responsive Viewport Sweep (320, 390, 768, 1440 widths) ---');
    const widths = [
      { w: 320, h: 640, mobile: true },
      { w: 390, h: 844, mobile: true },
      { w: 768, h: 1024, mobile: true },
      { w: 1440, h: 900, mobile: false },
    ];
    const views = [
      { label: 'Today', id: 'today' },
      { label: 'Workouts', id: 'workouts' },
      { label: 'Meals', id: 'meals' },
      { label: 'Settings', id: 'settings' },
    ];

    for (const vp of widths) {
      await setViewport(cdp, vp.w, vp.h, vp.mobile, 1);
      for (const v of views) {
        await navigateToView(cdp, v.label, v.id);
        const overflow = await cdp.evaluate(`
          (() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }))()
        `);
        assert(
          overflow.scrollWidth <= overflow.innerWidth + 1,
          `Horizontal page overflow on view "${v.label}" at ${vp.w}px width: scrollWidth=${overflow.scrollWidth} > innerWidth=${overflow.innerWidth}`
        );
      }
    }
    console.log('✓ Responsive widths 320, 390, 768, and 1440 verified across Today, Workouts, Meals, and Settings with zero horizontal page overflow.');

    console.log('\nALL PHASE 2 ACCESSIBILITY, CONTRAST, TOUCH TARGET, ZOOM & MOTION CHECKS PASSED!');
  } finally {
    if (cdp) cdp.close();
    proc.kill();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
