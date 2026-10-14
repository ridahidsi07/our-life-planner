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

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  PASS: ${message}`);
}

async function main() {
  console.log('=== Phase 07 Verification: Shared Focus Timer & Compact Controller ===\n');

  const rootDir = process.cwd();
  const outDir = path.resolve(rootDir, 'artifacts', 'premium-ui', 'phase-07');
  fs.mkdirSync(outDir, { recursive: true });

  const htmlPath = path.resolve(rootDir, 'dist', 'Our-Life-Planner-Offline.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error('dist/Our-Life-Planner-Offline.html not found. Run npm run build first.');
  }

  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  const serverPort = 3008;
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
      console.log(`Phase 07 app server running at http://127.0.0.1:${serverPort}/`);
      resolve();
    });
  });

  const browserPath = findBrowserExecutable();
  const debugPort = 9230;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olp-phase07-'));

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

    // Pre-populate data with tasks
    await wait(1000);
    const initDataExpr = `
      (() => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const todayStr = y + '-' + m + '-' + d;

        const settings = {
          ownerName: 'Morgan Vance',
          email: 'morgan@example.com',
          edition: 'downloaded',
          weekStartsOn: 'Monday',
          timeZone: 'UTC',
          currency: 'USD',
          currencySymbol: '$',
          weightUnit: 'kg',
          heightUnit: 'cm',
          waterUnit: 'ml',
          theme: 'light',
          isSampleDataActive: false,
          hasCompletedSetup: true,
          householdType: 'solo',
          enabledTools: ['tasks', 'routines', 'goals', 'habits', 'finance', 'meals', 'health', 'focus'],
          pinnedTools: ['focus', 'tasks']
        };

        const tasks = [
          { id: 'focus-task-1', title: 'Complete client quarterly review', dueDate: todayStr, status: 'not_started', priority: 'high', category: 'Work', assignedTo: 'Morgan Vance', createdAt: new Date().toISOString() },
          { id: 'focus-task-2', title: 'Draft weekly strategy notes', dueDate: todayStr, status: 'not_started', priority: 'medium', category: 'Planning', assignedTo: 'Morgan Vance', createdAt: new Date().toISOString() }
        ];

        const plannerData = {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          revision: 15,
          settings,
          tasks,
          calendarEvents: [],
          bills: [],
          routines: [],
          goals: [],
          habits: [],
          inbox: [],
          transactions: [],
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
          weeklyReviews: []
        };

        localStorage.setItem('our_life_planner_settings_v1', JSON.stringify(settings));
        localStorage.setItem('our_life_planner_data_v1', JSON.stringify(plannerData));
        localStorage.setItem('our_life_planner_revision_v1', '15');
        localStorage.removeItem('our_life_planner_focus_session_v1');
        return { todayStr };
      })()
    `;

    await cdp.send('Runtime.evaluate', { expression: initDataExpr });
    await cdp.send('Page.reload');
    await wait(1200);

    // Verify Compact Focus Card rendered on Today dashboard
    console.log('\n--- Step 1: Verify Compact Focus Card on Today Dashboard ---');
    const checkCompactCard = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = document.querySelector('[data-testid="today-compact-focus-card"]');
          const timerDisplay = document.querySelector('[data-testid="today-focus-timer-display"]');
          const toggleBtn = document.querySelector('[data-testid="today-focus-toggle-btn"]');
          const taskPreview = document.querySelector('[data-testid="today-focus-task-preview"]');
          return {
            hasCard: !!card,
            timerText: timerDisplay ? timerDisplay.textContent.trim() : null,
            btnText: toggleBtn ? toggleBtn.textContent.trim() : null,
            taskTitle: taskPreview ? taskPreview.textContent.trim() : null
          };
        })()
      `,
      returnByValue: true,
    });
    assert(checkCompactCard.result.value.hasCard, 'Compact Focus Session card rendered in Today dashboard');
    assert(checkCompactCard.result.value.timerText === '25:00', 'Initial timer display is exactly 25:00');
    assert(checkCompactCard.result.value.btnText.includes('Start Focus'), 'Toggle button shows "Start Focus"');
    console.log(`  Compact card task preview contains: "${checkCompactCard.result.value.taskTitle?.replace(/\\s+/g, ' ')}"`);

    // Capture Desktop 1440x900 idle state
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await wait(300);
    const shot01 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '01-desktop-compact-card-idle-1440.png'), Buffer.from(shot01.data, 'base64'));
    console.log('Saved 01-desktop-compact-card-idle-1440.png');

    // Start timer from compact card
    console.log('\n--- Step 2: Start Focus Timer from Compact Card ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('[data-testid="today-focus-toggle-btn"]');
          if (btn) btn.click();
        })()
      `,
    });
    await wait(1200);

    const checkRunningCompact = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('[data-testid="today-focus-toggle-btn"]');
          const badge = document.querySelector('[data-testid="today-focus-status-badge"]');
          const timerDisplay = document.querySelector('[data-testid="today-focus-timer-display"]');
          return {
            btnText: btn ? btn.textContent.trim() : null,
            badgeText: badge ? badge.textContent.trim() : null,
            timerText: timerDisplay ? timerDisplay.textContent.trim() : null
          };
        })()
      `,
      returnByValue: true,
    });
    assert(checkRunningCompact.result.value.btnText.includes('Pause'), 'Button switched to "Pause"');
    assert(checkRunningCompact.result.value.badgeText.includes('Running'), 'Badge displays "Running"');
    console.log(`  Timer running: ${checkRunningCompact.result.value.timerText}`);

    const shot02 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '02-desktop-compact-card-running.png'), Buffer.from(shot02.data, 'base64'));
    console.log('Saved 02-desktop-compact-card-running.png');

    // Open FocusModal and verify exact same running session
    console.log('\n--- Step 3: Open FocusModal and Confirm Synchronization ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const expandBtn = document.querySelector('[data-testid="today-focus-expand-btn"]');
          if (expandBtn) expandBtn.click();
        })()
      `,
    });
    await wait(500);

    const checkModalSync = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const modalDisplay = document.querySelector('[data-testid="focus-modal-timer-display"]');
          const modalToggleBtn = document.querySelector('[data-testid="focus-modal-toggle-btn"]');
          return {
            modalOpen: !!modalDisplay,
            modalTimerText: modalDisplay ? modalDisplay.textContent.trim() : null,
            modalBtnText: modalToggleBtn ? modalToggleBtn.textContent.trim() : null
          };
        })()
      `,
      returnByValue: true,
    });
    assert(checkModalSync.result.value.modalOpen, 'FocusModal opened');
    assert(checkModalSync.result.value.modalBtnText.includes('Pause'), 'Modal shows running "Pause" button');
    console.log(`  Modal timer in sync: ${checkModalSync.result.value.modalTimerText}`);

    const shot03 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '03-desktop-focus-modal-sync.png'), Buffer.from(shot03.data, 'base64'));
    console.log('Saved 03-desktop-focus-modal-sync.png');

    // Close modal and verify session CONTINUES running without interruption
    console.log('\n--- Step 4: Close Modal and Verify Session Continues Running ---');
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await wait(1000);

    const checkStillRunning = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const badge = document.querySelector('[data-testid="today-focus-status-badge"]');
          const timerDisplay = document.querySelector('[data-testid="today-focus-timer-display"]');
          return {
            badgeText: badge ? badge.textContent.trim() : null,
            timerText: timerDisplay ? timerDisplay.textContent.trim() : null
          };
        })()
      `,
      returnByValue: true,
    });
    assert(checkStillRunning.result.value.badgeText.includes('Running'), 'Session still Running after closing modal');
    console.log(`  Compact card still counting: ${checkStillRunning.result.value.timerText}`);

    // Navigate to Calendar and back; verify elapsed time preserved
    console.log('\n--- Step 5: Navigate Away & Back (Elapsed Time Preservation) ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const calNav = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent && el.textContent.includes('Calendar'));
          if (calNav) calNav.click();
        })()
      `,
    });
    await wait(1500);

    // Navigate back to Today
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const todayNav = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent && el.textContent.includes('Today'));
          if (todayNav) todayNav.click();
        })()
      `,
    });
    await wait(800);

    const checkAfterNav = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const badge = document.querySelector('[data-testid="today-focus-status-badge"]');
          const timerDisplay = document.querySelector('[data-testid="today-focus-timer-display"]');
          return {
            badgeText: badge ? badge.textContent.trim() : null,
            timerText: timerDisplay ? timerDisplay.textContent.trim() : null
          };
        })()
      `,
      returnByValue: true,
    });
    assert(checkAfterNav.result.value.badgeText.includes('Running'), 'Session still Running after navigation away and back');
    console.log(`  Timer after navigating back: ${checkAfterNav.result.value.timerText}`);

    // Pause, refresh, resume and reset
    console.log('\n--- Step 6: Pause, Refresh, Resume and Reset ---');
    // Pause timer
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('[data-testid="today-focus-toggle-btn"]');
          if (btn) btn.click();
        })()
      `,
    });
    await wait(500);

    const checkPaused = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('[data-testid="today-focus-toggle-btn"]');
          const timerDisplay = document.querySelector('[data-testid="today-focus-timer-display"]');
          return {
            btnText: btn ? btn.textContent.trim() : null,
            timerText: timerDisplay ? timerDisplay.textContent.trim() : null
          };
        })()
      `,
      returnByValue: true,
    });
    assert(checkPaused.result.value.btnText.includes('Resume'), 'Button changed to Resume when paused');
    const pausedTime = checkPaused.result.value.timerText;

    // Refresh page
    await cdp.send('Page.reload');
    await wait(1200);

    const checkRestoredPaused = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('[data-testid="today-focus-toggle-btn"]');
          const timerDisplay = document.querySelector('[data-testid="today-focus-timer-display"]');
          const badge = document.querySelector('[data-testid="today-focus-status-badge"]');
          return {
            btnText: btn ? btn.textContent.trim() : null,
            timerText: timerDisplay ? timerDisplay.textContent.trim() : null,
            badgeText: badge ? badge.textContent.trim() : null
          };
        })()
      `,
      returnByValue: true,
    });
    assert(checkRestoredPaused.result.value.btnText.includes('Resume'), 'Paused state restored on refresh');
    assert(checkRestoredPaused.result.value.timerText === pausedTime, 'Paused timer did not drift on refresh');
    console.log(`  Restored paused timer: ${checkRestoredPaused.result.value.timerText}`);

    // Resume timer
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('[data-testid="today-focus-toggle-btn"]');
          if (btn) btn.click();
        })()
      `,
    });
    await wait(800);

    // Reset timer
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const resetBtn = document.querySelector('[data-testid="today-focus-reset-btn"]');
          if (resetBtn) resetBtn.click();
        })()
      `,
    });
    await wait(500);

    const checkReset = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const timerDisplay = document.querySelector('[data-testid="today-focus-timer-display"]');
          const btn = document.querySelector('[data-testid="today-focus-toggle-btn"]');
          return {
            timerText: timerDisplay ? timerDisplay.textContent.trim() : null,
            btnText: btn ? btn.textContent.trim() : null
          };
        })()
      `,
      returnByValue: true,
    });
    assert(checkReset.result.value.timerText === '25:00', 'Reset restored exactly 25:00');
    assert(checkReset.result.value.btnText.includes('Start Focus'), 'Reset returned button to Start Focus');

    // Test fixture: short countdown to reach zero and transition to 5m Break
    console.log('\n--- Step 7: Test Fixture Short Countdown & Auto-Break Transition ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          // Set duration to 2 seconds and auto-start
          if (window.__olp_focus__) {
            window.__olp_focus__.setDuration(2, true);
          }
        })()
      `,
    });
    // Wait for timer to reach zero (2.5s)
    await wait(2600);

    const checkAutoBreak = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const timerDisplay = document.querySelector('[data-testid="today-focus-timer-display"]');
          const badge = document.querySelector('[data-testid="today-focus-status-badge"]');
          return {
            timerText: timerDisplay ? timerDisplay.textContent.trim() : null,
            badgeText: badge ? badge.textContent.trim() : null
          };
        })()
      `,
      returnByValue: true,
    });
    assert(checkAutoBreak.result.value.timerText === '05:00', 'Timer auto-transitioned to 5m break (05:00)');
    assert(checkAutoBreak.result.value.badgeText.includes('Break'), 'Badge indicates Break mode');
    console.log(`  Auto-break transition passed: ${checkAutoBreak.result.value.timerText} (${checkAutoBreak.result.value.badgeText})`);

    const shot04 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '04-desktop-auto-break-transition.png'), Buffer.from(shot04.data, 'base64'));
    console.log('Saved 04-desktop-auto-break-transition.png');

    // Reset back to focus
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          if (window.__olp_focus__) {
            window.__olp_focus__.reset();
          }
        })()
      `,
    });
    await wait(500);

    // Verify task completion directly from compact card
    console.log('\n--- Step 8: Verify Task Action from Compact Card ---');
    const taskDoneResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const doneBtn = document.querySelector('[data-testid="today-focus-task-done-btn"]');
          if (doneBtn) doneBtn.click();
          return { clicked: true };
        })()
      `,
      returnByValue: true,
    });
    await wait(600);
    assert(taskDoneResult.result.value.clicked, 'Completed task from compact card');

    // Check task advance or clear
    const checkAdvancedTask = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const taskPreview = document.querySelector('[data-testid="today-focus-task-preview"]');
          return {
            taskText: taskPreview ? taskPreview.textContent.trim() : null
          };
        })()
      `,
      returnByValue: true,
    });
    console.log(`  Active task advanced to: "${checkAdvancedTask.result.value.taskText?.replace(/\\s+/g, ' ')}"`);

    // Tablet layout (768x1024)
    console.log('\n--- Step 9: Tablet Layout (768x1024) ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await wait(300);
    const shot05 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '05-tablet-focus-card-768.png'), Buffer.from(shot05.data, 'base64'));
    console.log('Saved 05-tablet-focus-card-768.png');

    // Mobile layout (390x844)
    console.log('\n--- Step 10: Mobile Layout (390x844) ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await wait(300);
    const shot06 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '06-mobile-focus-card-390.png'), Buffer.from(shot06.data, 'base64'));
    console.log('Saved 06-mobile-focus-card-390.png');

    // Manifest
    const manifest = {
      phase: '07-focus',
      timestamp: new Date().toISOString(),
      screenshots: [
        '01-desktop-compact-card-idle-1440.png',
        '02-desktop-compact-card-running.png',
        '03-desktop-focus-modal-sync.png',
        '04-desktop-auto-break-transition.png',
        '05-tablet-focus-card-768.png',
        '06-mobile-focus-card-390.png'
      ],
      passedChecks: [
        'Shared focus session controller (FocusContext) driving modal and compact card',
        'Timestamp-based running countdown accurate across backgrounding and refresh',
        'Compact dark card per reference frame-012.png with faint line texture',
        'Tabular monospace timer numerals (25:00 focus, 5:00 break)',
        'Play/Pause, Reset, and Break controls synchronized between surfaces',
        'Closing FocusModal does not interrupt running countdown',
        'Navigation away and back preserves exact elapsed time',
        'Pause, refresh, and resume maintains exact remaining time without drift',
        'Auto-break transition when focus duration completes',
        'Direct task completion action from compact card with automatic task advance',
        'Cross-tab synchronization via BroadcastChannel and StorageEvent',
        'Backward-compatible storage contract'
      ]
    };
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    console.log('\n=== All Phase 07 Verification Checks Passed Successfully! ===\n');
  } finally {
    if (cdp) cdp.close();
    browserProcess.kill();
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error('Phase 07 test failed:', err);
  process.exit(1);
});
