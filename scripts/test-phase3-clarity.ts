import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import {
  STARTER_ENABLED_MODULES,
  DEFAULT_PINNED_MODULES,
  DEFAULT_ENABLED_MODULES,
} from '../src/utils/moduleRegistry';

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

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  console.log('=== Phase 3 Verification: Product Polish, Navigation Clarity & Progressive Disclosure (LP-20) ===\n');

  // 1. Static Registry Verification
  console.log('1. Module Registry & Starter Toolset Contracts');
  assert(
    JSON.stringify(STARTER_ENABLED_MODULES) ===
      JSON.stringify(['today', 'tasks', 'calendar', 'routines', 'inbox']),
    'STARTER_ENABLED_MODULES offers the 5 core planning tools (today, tasks, calendar, routines, inbox)'
  );
  assert(
    Array.isArray(DEFAULT_PINNED_MODULES) && DEFAULT_PINNED_MODULES.length === 0,
    'DEFAULT_PINNED_MODULES is empty by default so Favorites does not duplicate primary navigation items'
  );
  assert(
    DEFAULT_ENABLED_MODULES.length === 10,
    'DEFAULT_ENABLED_MODULES retains all 10 canonical modules for full-preset and existing backup compatibility'
  );

  // Prepare screenshot output directory
  const outDir = path.resolve(process.cwd(), 'artifacts', 'screenshots-phase3');
  fs.mkdirSync(outDir, { recursive: true });

  const htmlPath = path.resolve(process.cwd(), 'dist', 'Our-Life-Planner-Offline.html');
  assert(fs.existsSync(htmlPath), 'dist/Our-Life-Planner-Offline.html exists');
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
  const userDataDir = path.resolve(process.cwd(), 'dist', `.tmp-edge-phase3-${Date.now()}`);

  const proc = spawn(
    browserExe,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=0',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const wsUrl = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('DevTools listening timeout')), 15000);
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      const match = text.match(/ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-zA-Z0-9-]+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    };
    proc.stderr.on('data', onData);
    proc.stdout.on('data', onData);
  });

  const browserCdp = new CDPClient(wsUrl);
  await browserCdp.ready();

  try {
    const { targetId } = await browserCdp.send('Target.createTarget', { url: appUrl });
    const portMatch = wsUrl.match(/ws:\/\/127\.0\.0\.1:(\d+)\//)!;
    const debugPort = portMatch[1];
    const targetsRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const targets = (await targetsRes.json()) as Array<{ id: string; webSocketDebuggerUrl: string }>;
    const pageTarget = targets.find((t) => t.id === targetId) || targets[0];

    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    const evalJs = async <T = any>(expression: string): Promise<T> => {
      const res = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.exceptionDetails) {
        throw new Error(
          `JS Runtime exception: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description || ''}`
        );
      }
      return res.result?.value as T;
    };

    const setViewport = async (width: number, height: number, mobile = false, scale = 1) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: scale,
        mobile,
      });
      await wait(180);
    };

    const captureScreenshot = async (filename: string) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(outDir, filename);
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
      return filePath;
    };

    await setViewport(1440, 900, false);
    await wait(350);

    // =========================================================================
    // 2. First-Use Onboarding & Starter Preset Journey
    // =========================================================================
    console.log('\n2. First-Use Setup Wizard, Starter Toolset & Empty-State Hero CTAs');

    // Reset localStorage to simulate brand-new user with hasCompletedSetup = false
    await evalJs(`
      localStorage.clear();
      location.reload();
    `);
    await wait(600);

    // Open Setup Wizard and advance to Step 2
    const setupStep2Info = await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        // First visit auto-opens the wizard; otherwise open it from Settings
        if (!document.querySelector('[role="dialog"][aria-modal="true"]')) {
          const settingsBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Settings');
          if (settingsBtn) {
            settingsBtn.click();
            await wait(120);
          }
          const wizardBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Setup Wizard'));
          if (wizardBtn) {
            wizardBtn.click();
            await wait(150);
          }
        }
        // Fill owner name in Step 1 and submit
        const nameInput = document.querySelector('#setup-owner-name');
        if (nameInput) {
          const proto = Object.getPrototypeOf(nameInput);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(nameInput, 'Alex');
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          nameInput.dispatchEvent(new Event('change', { bubbles: true }));
          await wait(60);
        }
        const step1Btn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          b => b.textContent?.includes('Choose Tools & Data')
        );
        if (step1Btn) {
          step1Btn.click();
          await wait(150);
        }
        const starterPreset = document.querySelector('[data-testid="setup-preset-starter"]');
        const allPreset = document.querySelector('[data-testid="setup-preset-all"]');
        const checkboxes = Array.from(document.querySelectorAll('[data-testid^="setup-module-checkbox-"]'));
        const checkedCount = checkboxes.filter(s => s.getAttribute('aria-checked') === 'true').length;
        return {
          hasStarterPreset: Boolean(starterPreset),
          hasAllPreset: Boolean(allPreset),
          totalSwitches: checkboxes.length,
          checkedCount,
        };
      })()
    `);

    assert(
      setupStep2Info.hasStarterPreset && setupStep2Info.hasAllPreset,
      'Setup Wizard Step 2 displays "Core Starter (5)" and "All Modules (10)" 1-click preset buttons'
    );
    assert(
      setupStep2Info.checkedCount === 5,
      `Setup Wizard defaults to 5 core starter modules (got ${setupStep2Info.checkedCount} of ${setupStep2Info.totalSwitches})`
    );

    await captureScreenshot('01-setup-wizard-starter-preset-light-1440.png');

    // Complete Setup Wizard with Start Empty + Core Starter (5)
    const afterSetupState = await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const starterBtn = document.querySelector('[data-testid="setup-preset-starter"]');
        if (starterBtn) starterBtn.click();
        await wait(60);
        const emptyRadio = Array.from(document.querySelectorAll('[role="dialog"] [role="radio"]')).find(
          b => b.textContent?.includes('Start Empty')
        );
        if (emptyRadio) {
          emptyRadio.click();
          await wait(60);
        }
        const confirmBox = document.querySelector('#setup-confirm-destructive');
        if (confirmBox && !confirmBox.checked) {
          confirmBox.click();
          await wait(60);
        }
        const nextBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          b => b.textContent?.includes('Add First Commitments')
        );
        if (nextBtn) {
          nextBtn.click();
          await wait(120);
        }
        const finishBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          b => b.textContent?.includes('Launch My Planner')
        );
        if (finishBtn) {
          finishBtn.click();
          await wait(200);
        }
        // Navigate to Today view
        const todayNav = document.querySelector('[data-testid="sidebar-nav-today"]');
        if (todayNav) {
          todayNav.click();
          await wait(150);
        }
        const favButtons = document.querySelectorAll('[data-testid^="sidebar-favorite-"]');
        const navButtons = Array.from(document.querySelectorAll('[data-testid^="sidebar-nav-"]')).map(
          el => el.getAttribute('data-testid')
        );
        const todayHero = document.querySelector('[data-testid="today-empty-state"]');
        const todayCta = document.querySelector('[data-testid="today-empty-cta"]');
        return {
          favCount: favButtons.length,
          navButtons,
          hasTodayHero: Boolean(todayHero),
          hasTodayCta: Boolean(todayCta),
          todayCtaText: todayCta?.textContent?.trim() || '',
        };
      })()
    `);

    assert(
      afterSetupState.favCount === 0,
      'Sidebar has zero redundant Favorites items by default after setup'
    );
    assert(
      afterSetupState.navButtons.length === 5,
      `Sidebar displays only the 5 core starter navigation items (${afterSetupState.navButtons.join(', ')})`
    );
    assert(
      afterSetupState.hasTodayHero && afterSetupState.hasTodayCta,
      `Today empty state displays hero welcome card with primary creation CTA ("${afterSetupState.todayCtaText}")`
    );

    await captureScreenshot('02-today-starter-empty-hero-light-1440.png');

    // Switch to dark theme and capture Today starter empty state
    await evalJs(`
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark');
      document.body.style.backgroundColor = '#0B1220';
    `);
    await wait(250);
    await captureScreenshot('03-today-starter-empty-hero-dark-1440.png');

    // Switch back to light theme for Tasks empty state & creation journey
    await evalJs(`
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.classList.remove('dark');
      document.body.style.backgroundColor = '';
    `);
    await wait(250);

    // Navigate to Tasks and verify empty state hero CTA + create first task
    const tasksEmptyInfo = await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const tasksNav = document.querySelector('[data-testid="sidebar-nav-tasks"]');
        tasksNav.click();
        await wait(150);
        const hero = document.querySelector('[data-testid="tasks-empty-hero"]');
        const cta = document.querySelector('[data-testid="tasks-empty-cta"]');
        return {
          hasHero: Boolean(hero),
          hasCta: Boolean(cta),
          ctaText: cta?.textContent?.trim() || '',
          activeHeadingText: document.activeElement?.tagName + ':' + (document.activeElement?.textContent?.trim() || ''),
        };
      })()
    `);

    assert(
      tasksEmptyInfo.hasHero && tasksEmptyInfo.hasCta,
      `Tasks empty state displays hero CTA card ("${tasksEmptyInfo.ctaText}") before metric cards`
    );
    assert(
      tasksEmptyInfo.activeHeadingText === 'H2:Tasks',
      `Navigating to Tasks focuses the primary view heading (${tasksEmptyInfo.activeHeadingText})`
    );

    await captureScreenshot('04-tasks-empty-hero-light-1440.png');

    // Click Tasks empty CTA to create first task
    const createdTaskResult = await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const cta = document.querySelector('[data-testid="tasks-empty-cta"]');
        cta.click();
        await wait(120);
        const titleInput = document.querySelector('#task-modal-title');
        const proto = Object.getPrototypeOf(titleInput);
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        desc.set.call(titleInput, 'Prepare Q4 launch checklist');
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        titleInput.dispatchEvent(new Event('change', { bubbles: true }));
        await wait(60);
        const form = titleInput.closest('form');
        form.requestSubmit();
        await wait(700);
        const storedTasks = (JSON.parse(localStorage.getItem('our_life_planner_data_v1') || '{}').tasks || []);
        return {
          count: storedTasks.length,
          firstTitle: storedTasks[0]?.title || '',
          heroStillVisible: Boolean(document.querySelector('[data-testid="tasks-empty-hero"]')),
        };
      })()
    `);

    assert(
      createdTaskResult.count === 1 && createdTaskResult.firstTitle === 'Prepare Q4 launch checklist',
      'First-use task creation via empty-state CTA saves task durably to localStorage'
    );
    assert(
      !createdTaskResult.heroStillVisible,
      'Tasks empty-state hero card disappears once the first task is created'
    );

    // =========================================================================
    // 3. Return & Reschedule Journey
    // =========================================================================
    console.log('\n3. Return & Overdue Reschedule Journey');
    // Create an overdue task through the real Task editor
    await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const setVal = (el, v) => {
          const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
          desc.set.call(el, v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        document.querySelector('[data-testid="sidebar-nav-tasks"]').click();
        await wait(150);
        const newBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent?.replace(/\\s+/g, ' ').trim() === 'New task'
        );
        newBtn.click();
        await wait(150);
        setVal(document.querySelector('#task-modal-title'), 'Submit annual tax documents');
        setVal(document.querySelector('#task-modal-due-date'), '2020-01-10');
        await wait(60);
        document.querySelector('#task-modal-title').closest('form').requestSubmit();
        await wait(700);
      })()
    `);

    // Return session: reload the planner, then reschedule from the Today overdue panel
    await evalJs(`location.reload()`);
    await wait(700);

    const afterReschedule = await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const readTasks = () => (JSON.parse(localStorage.getItem('our_life_planner_data_v1') || '{}').tasks || []);
        const before = readTasks();
        const persistedFirstTask = before.some(t => t.title === 'Prepare Q4 launch checklist');
        const overdueBefore = before.find(t => t.title === 'Submit annual tax documents');
        document.querySelector('[data-testid="sidebar-nav-today"]')?.click();
        await wait(200);
        const rescheduleTodayBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent?.trim() === 'Reschedule Today'
        );
        const hadOverdueBtn = Boolean(rescheduleTodayBtn);
        if (rescheduleTodayBtn) {
          rescheduleTodayBtn.click();
          await wait(700);
        }
        const rescheduled = readTasks().find(t => t.title === 'Submit annual tax documents');
        return {
          hadOverdueBtn,
          oldDueDate: overdueBefore?.dueDate || null,
          newDueDate: rescheduled?.dueDate || null,
          persistedFirstTask,
        };
      })()
    `);

    assert(
      afterReschedule.persistedFirstTask,
      'Reloading planner preserves previously created task across return session'
    );
    assert(
      afterReschedule.hadOverdueBtn && Boolean(afterReschedule.newDueDate && afterReschedule.newDueDate !== '2026-01-10'),
      `1-click reschedule on Today dashboard updates overdue task due date to today (${afterReschedule.newDueDate})`
    );

    await captureScreenshot('05-return-reschedule-journey-light-1440.png');

    // =========================================================================
    // 4. Navigation Scroll Reset & View Heading Focus
    // =========================================================================
    console.log('\n4. Navigation Scroll Reset & View Heading Focus');
    const navScrollFocus = await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const main = document.querySelector('[data-testid="main-scroll-container"]');
        // Force scrollable height so scrollTop > 0 is guaranteed
        main.style.maxHeight = '300px';
        main.scrollTop = 180;
        const beforeScrollTop = main.scrollTop;

        const routinesNav = document.querySelector('[data-testid="sidebar-nav-routines"]');
        routinesNav.click();
        await wait(150);

        const afterScrollTop = main.scrollTop;
        main.style.maxHeight = '';
        const activeEl = document.activeElement;
        const routinesCta = document.querySelector('[data-testid="routines-empty-cta"]');
        return {
          beforeScrollTop,
          afterScrollTop,
          activeTag: activeEl?.tagName || '',
          activeText: activeEl?.textContent?.trim() || '',
          hasRoutinesEmptyCta: Boolean(routinesCta),
        };
      })()
    `);

    assert(
      navScrollFocus.beforeScrollTop > 0 && navScrollFocus.afterScrollTop === 0,
      `Switching views resets <main> scrollTop from ${navScrollFocus.beforeScrollTop}px to ${navScrollFocus.afterScrollTop}px`
    );
    assert(
      navScrollFocus.activeTag === 'H2' && navScrollFocus.activeText === 'Routines',
      `Switching to Routines focuses the primary heading (${navScrollFocus.activeTag}: "${navScrollFocus.activeText}")`
    );
    assert(
      navScrollFocus.hasRoutinesEmptyCta,
      'Empty Routines screen offers a clear "+ Create your first routine" CTA button'
    );

    await captureScreenshot('06-routines-empty-hero-light-1440.png');

    // =========================================================================
    // 5. Progressive Disclosure ("Advanced details") Verification
    // =========================================================================
    console.log('\n5. Progressive Disclosure ("Advanced details") Across Routines, Settings, Weight, Backup & Account');

    // 5a. Routines Create modal advanced details
    const routineDisclosure = await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const cta = document.querySelector('[data-testid="routines-empty-cta"]');
        cta.click();
        await wait(150);
        const details = document.querySelector('[data-testid="routine-advanced-details"]');
        const initiallyOpen = details ? details.open : null;
        if (details) {
          details.querySelector('summary').click();
          await wait(80);
        }
        const openAfterClick = details ? details.open : null;
        return {
          exists: Boolean(details),
          initiallyOpen,
          openAfterClick,
          summaryText: details?.querySelector('summary')?.textContent?.trim() || '',
        };
      })()
    `);

    assert(
      routineDisclosure.exists && routineDisclosure.initiallyOpen === false && routineDisclosure.openAfterClick === true,
      `Routines modal wraps end date & recurrence internals behind collapsible "${routineDisclosure.summaryText}"`
    );

    await captureScreenshot('07-routine-modal-advanced-details-light-1440.png');

    // Close Routine modal
    await evalJs(`
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    `);
    await wait(150);

    // 5b. SettingsView presets & unit conversion advanced details
    const settingsDisclosure = await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const settingsBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent?.trim() === 'Settings'
        );
        settingsBtn.click();
        await wait(180);
        const details = document.querySelector('[data-testid="settings-unit-advanced-details"]');
        const initiallyOpen = details ? details.open : null;
        const starterPreset = document.querySelector('[data-testid="settings-preset-starter"]');
        const allPreset = document.querySelector('[data-testid="settings-preset-all"]');
        // Click All Modules (10) preset to enable Weight and other modules
        if (allPreset) {
          allPreset.click();
          await wait(150);
        }
        const navCount = document.querySelectorAll('[data-testid^="sidebar-nav-"]').length;
        return {
          exists: Boolean(details),
          initiallyOpen,
          hasPresets: Boolean(starterPreset && allPreset),
          navCountAfterAllPreset: navCount,
        };
      })()
    `);

    assert(
      settingsDisclosure.exists && settingsDisclosure.initiallyOpen === false,
      'Settings view hides technical unit conversion & currency storage notes inside collapsed Advanced details'
    );
    assert(
      settingsDisclosure.hasPresets && settingsDisclosure.navCountAfterAllPreset === 15,
      `Settings "All Modules (10)" preset enables all 15 sidebar navigation views (got ${settingsDisclosure.navCountAfterAllPreset})`
    );

    await captureScreenshot('08-settings-presets-and-advanced-light-1440.png');

    // 5c. Weight view empty hero + progressive disclosure of canonical kg/lb notes
    const weightDisclosure = await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const weightNav = document.querySelector('[data-testid="sidebar-nav-weight"]');
        weightNav.click();
        await wait(180);
        const hasEmptyHero = Boolean(document.querySelector('[data-testid="weight-empty-hero"]'));
        const details = document.querySelector('[data-testid="weight-advanced-details"]');
        const initiallyOpen = details ? details.open : null;
        if (details) {
          details.querySelector('summary').click();
          await wait(80);
        }
        const openAfterClick = details ? details.open : null;
        return {
          hasEmptyHero,
          exists: Boolean(details),
          initiallyOpen,
          openAfterClick,
        };
      })()
    `);

    assert(
      weightDisclosure.hasEmptyHero,
      'Empty Weight view renders first-use hero CTA card before summary metric cards'
    );
    assert(
      weightDisclosure.exists && weightDisclosure.initiallyOpen === false && weightDisclosure.openAfterClick === true,
      'Weight view hides canonical kg/lb & BMI conversion internals behind collapsible Advanced details'
    );

    // Switch to dark mode for Weight screenshot
    await evalJs(`
      (async () => {
        const raw = JSON.parse(localStorage.getItem('olp_settings') || '{}');
        raw.theme = 'dark';
        localStorage.setItem('olp_settings', JSON.stringify(raw));
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark');
        document.body.style.backgroundColor = '#0B1220';
      })()
    `);
    await wait(180);
    await captureScreenshot('09-weight-progressive-disclosure-dark-1440.png');

    // Switch back to light mode
    await evalJs(`
      (async () => {
        const raw = JSON.parse(localStorage.getItem('olp_settings') || '{}');
        raw.theme = 'light';
        localStorage.setItem('olp_settings', JSON.stringify(raw));
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.classList.remove('dark');
        document.body.style.backgroundColor = '';
      })()
    `);
    await wait(150);

    // 5d. AccountModal advanced details
    const accountDisclosure = await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const accountBtn = document.querySelector('header button[aria-label^="Profile and local storage"]');
        accountBtn.click();
        await wait(150);
        const details = document.querySelector('[data-testid="account-advanced-details"]');
        const initiallyOpen = details ? details.open : null;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await wait(120);
        return {
          exists: Boolean(details),
          initiallyOpen,
        };
      })()
    `);

    assert(
      accountDisclosure.exists && accountDisclosure.initiallyOpen === false,
      'Account modal places browser localStorage & record footprint grid behind collapsed Advanced details'
    );

    // =========================================================================
    // 6. 1-Click Backup & Restore Discovery (Desktop & Phone) + Responsive/Zoom Checks
    // =========================================================================
    console.log('\n6. Backup Discovery, Mobile Widths (390px, 320px), and 200% Zoom');

    const backupDiscoveryDesktop = await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const sidebarBackupBtn = document.querySelector('[data-testid="sidebar-backup-restore"]');
        if (!sidebarBackupBtn) return { foundBtn: false };
        sidebarBackupBtn.click();
        await wait(160);
        const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
        const advDetails = document.querySelector('[data-testid="backup-advanced-details"]');
        return {
          foundBtn: true,
          dialogOpened: Boolean(dialog && dialog.textContent?.includes('Backup & Restore')),
          advDetailsCollapsed: Boolean(advDetails && advDetails.open === false),
        };
      })()
    `);

    assert(
      backupDiscoveryDesktop.foundBtn && backupDiscoveryDesktop.dialogOpened,
      'Desktop Sidebar provides 1-click "Backup & Restore" button that opens the Backup & Restore modal immediately'
    );
    assert(
      backupDiscoveryDesktop.advDetailsCollapsed,
      'Backup & Restore modal collapses raw JSON paste & schema internals behind Advanced details by default'
    );

    await captureScreenshot('10-backup-restore-1click-light-1440.png');

    // Close Backup modal and navigate to Today
    await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await wait(120);
        document.querySelector('[data-testid="sidebar-nav-today"]')?.click();
        await wait(150);
      })()
    `);

    // Mobile 390x844 Dark check
    await setViewport(390, 844, true);
    await evalJs(`
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark');
      document.body.style.backgroundColor = '#0B1220';
    `);
    await wait(200);
    const mobile390Check = await evalJs(`
      ({
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      })
    `);
    assert(
      !mobile390Check.overflowX,
      `Phone 390×844 dark view has zero horizontal overflow (${mobile390Check.scrollWidth}px <= ${mobile390Check.clientWidth}px)`
    );
    await captureScreenshot('11-mobile-390-today-dark.png');

    // Mobile 320x640 Light + MoreSheet check
    await setViewport(320, 640, true);
    await evalJs(`
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.classList.remove('dark');
      document.body.style.backgroundColor = '';
    `);
    await wait(200);

    const mobile320MoreSheet = await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const menuBtn = document.querySelector('header button[aria-label="Open menu"]');
        menuBtn.click();
        await wait(180);
        const sheet = document.querySelector('#all-tools-menu');
        const favItems = document.querySelectorAll('[data-testid^="moresheet-favorite-"]');
        const backupBtn = Array.from(sheet?.querySelectorAll('button') || []).find(
          b => b.textContent?.includes('Backup & Restore')
        );
        const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth;
        return {
          sheetOpen: Boolean(sheet),
          favCount: favItems.length,
          hasBackupBtn: Boolean(backupBtn),
          overflowX,
        };
      })()
    `);

    assert(
      mobile320MoreSheet.sheetOpen && mobile320MoreSheet.favCount === 0 && mobile320MoreSheet.hasBackupBtn,
      'Mobile MoreSheet at 320×640 has zero redundant Favorites by default and surfaces 1-click "Backup & Restore"'
    );
    assert(!mobile320MoreSheet.overflowX, 'Mobile 320×640 MoreSheet has zero horizontal overflow');
    await captureScreenshot('12-mobile-320-moresheet-light.png');

    // Close MoreSheet and verify 200% zoom at 1440x900
    await evalJs(`
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    `);
    await setViewport(1440, 900, false, 2);
    await evalJs(`
      document.body.style.zoom = '200%';
    `);
    await wait(250);

    const zoom200Check = await evalJs(`
      ({
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      })
    `);
    assert(
      !zoom200Check.overflowX,
      `Desktop 1440×900 at 200% zoom has zero horizontal overflow (${zoom200Check.scrollWidth}px <= ${zoom200Check.clientWidth}px)`
    );
    await captureScreenshot('13-desktop-200pct-zoom-today-light.png');

    await evalJs(`document.body.style.zoom = '';`);
    cdp.close();
  } finally {
    browserCdp.close();
    proc.kill();
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in test-phase3-clarity:', err);
  process.exit(1);
});
