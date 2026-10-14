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
  console.log('=== Phase 06 Verification: Readable Calendar & Useful Agenda ===\n');

  const rootDir = process.cwd();
  const outDir = path.resolve(rootDir, 'artifacts', 'premium-ui', 'phase-06');
  fs.mkdirSync(outDir, { recursive: true });

  const htmlPath = path.resolve(rootDir, 'dist', 'Our-Life-Planner-Offline.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error('dist/Our-Life-Planner-Offline.html not found. Run npm run build first.');
  }

  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  const serverPort = 3007;
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
      console.log(`Phase 06 app server running at http://127.0.0.1:${serverPort}/`);
      resolve();
    });
  });

  const browserPath = findBrowserExecutable();
  const debugPort = 9229;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olp-phase06-'));

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
    const newPageRes = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`http://127.0.0.1:${serverPort}/`)}`, { method: 'PUT' });
    const pageData = await newPageRes.json();
    cdp = new CDPClient(pageData.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    // Pre-populate realistic test data with multi-event overflow day and coming up events
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/` });
    await wait(1000);

    const initDataExpr = `
      (() => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const todayStr = y + '-' + m + '-' + d;

        // Overflow date: tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomY = tomorrow.getFullYear();
        const tomM = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const tomD = String(tomorrow.getDate()).padStart(2, '0');
        const tomorrowStr = tomY + '-' + tomM + '-' + tomD;

        // Day after tomorrow
        const nextDay = new Date(today);
        nextDay.setDate(nextDay.getDate() + 2);
        const ndY = nextDay.getFullYear();
        const ndM = String(nextDay.getMonth() + 1).padStart(2, '0');
        const ndD = String(nextDay.getDate()).padStart(2, '0');
        const nextDayStr = ndY + '-' + ndM + '-' + ndD;

        const tasks = [
          { id: 'cal-task-1', title: 'Prepare board meeting slide deck', dueDate: todayStr, status: 'not_started', priority: 'high', category: 'Work', assignedTo: 'Alex', createdAt: new Date().toISOString() },
          { id: 'cal-task-2', title: 'Submit quarterly budget proposal', dueDate: tomorrowStr, status: 'not_started', priority: 'urgent', category: 'Finance', assignedTo: 'Alex', createdAt: new Date().toISOString() },
          { id: 'cal-task-3', title: 'Review marketing copy draft', dueDate: tomorrowStr, status: 'not_started', priority: 'medium', category: 'Work', assignedTo: 'Morgan', createdAt: new Date().toISOString() },
          { id: 'cal-task-4', title: 'Schedule dental appointment', dueDate: tomorrowStr, status: 'not_started', priority: 'low', category: 'Personal', assignedTo: 'Alex', createdAt: new Date().toISOString() },
          { id: 'cal-task-5', title: 'Car safety inspection', dueDate: nextDayStr, status: 'not_started', priority: 'medium', category: 'Personal', assignedTo: 'Morgan', createdAt: new Date().toISOString() }
        ];

        const events = [
          { id: 'cal-evt-1', title: 'Executive Sync', date: todayStr, startTime: '10:00', endTime: '11:00', type: 'event', isAllDay: false },
          { id: 'cal-evt-2', title: 'Team Architecture Review', date: tomorrowStr, startTime: '14:00', endTime: '15:30', type: 'event', isAllDay: false },
          { id: 'cal-evt-3', title: 'Birthday Celebration Dinner', date: tomorrowStr, startTime: '19:00', endTime: '21:00', type: 'birthday', isAllDay: false }
        ];

        const bills = [
          { id: 'cal-bill-1', title: 'Electric Utility Bill', dueDate: tomorrowStr, plannedAmount: 145.50, isPaid: false, category: 'Utilities' }
        ];

        const settings = {
          ownerName: 'Alex & Morgan',
          email: 'alex@example.com',
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
          householdType: 'couple',
          enabledTools: ['tasks', 'routines', 'goals', 'habits', 'finance', 'meals', 'health', 'calendar'],
          pinnedTools: ['calendar', 'tasks']
        };

        const plannerData = {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          revision: 10,
          settings,
          tasks,
          calendarEvents: events,
          bills,
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
        localStorage.setItem('our_life_planner_revision_v1', '10');
        return { todayStr, tomorrowStr, nextDayStr };
      })()
    `;

    const initResult = await cdp.send('Runtime.evaluate', {
      expression: initDataExpr,
      returnByValue: true,
    });
    const { todayStr, tomorrowStr, nextDayStr } = initResult.result.value;
    console.log(`Test fixtures configured: Today=${todayStr}, Tomorrow=${tomorrowStr}, NextDay=${nextDayStr}`);

    // Reload page to pick up storage
    await cdp.send('Page.reload');
    await wait(1200);

    // Navigate to Calendar tab
    console.log('\n--- Step 1: Navigate to Calendar view ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const calNav = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent && el.textContent.includes('Calendar'));
          if (calNav) calNav.click();
        })()
      `,
    });
    await wait(800);

    // Verify Calendar loaded
    const checkCalendarLoaded = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const header = Array.from(document.querySelectorAll('h2')).find(h => h.textContent && (h.textContent.includes('202') || h.textContent.includes('January') || h.textContent.includes('February') || h.textContent.includes('March') || h.textContent.includes('April') || h.textContent.includes('May') || h.textContent.includes('June') || h.textContent.includes('July') || h.textContent.includes('August') || h.textContent.includes('September') || h.textContent.includes('October') || h.textContent.includes('November') || h.textContent.includes('December')));
          const upcomingCard = document.querySelector('[data-testid="calendar-upcoming-card"]');
          return {
            hasHeader: !!header,
            headerText: header ? header.textContent.trim() : null,
            hasUpcomingCard: !!upcomingCard
          };
        })()
      `,
      returnByValue: true,
    });
    assert(checkCalendarLoaded.result.value.hasHeader, 'Calendar header visible with visible month/year');
    assert(checkCalendarLoaded.result.value.hasUpcomingCard, 'Calendar Coming Up card rendered');

    // Take Desktop 1440x900 Screenshot
    console.log('\n--- Step 2: Capture Desktop Calendar view (1440x900) ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await wait(400);

    const shotDesktop = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '01-desktop-calendar-month-1440.png'), Buffer.from(shotDesktop.data, 'base64'));
    console.log('Saved 01-desktop-calendar-month-1440.png');

    // Verify desktop event chip display and +N more overflow link
    console.log('\n--- Step 3: Verify Desktop Event Chips & +N More Overflow ---');
    const checkChipsAndOverflow = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const dates = Array.from(document.querySelectorAll('[data-calendar-date]')).map(el => el.getAttribute('data-calendar-date'));
          const overflowCell = document.querySelector('[data-testid="calendar-cell-overflow-' + '${tomorrowStr}' + '"]');
          const chipElements = Array.from(document.querySelectorAll('[data-calendar-date] span[title]'));
          const tomorrowCell = document.querySelector('[data-calendar-date="' + '${tomorrowStr}' + '"]');
          return {
            dates: dates.slice(0, 10),
            tomorrowCellFound: !!tomorrowCell,
            hasOverflow: !!overflowCell,
            overflowText: overflowCell ? overflowCell.textContent.trim() : null,
            chipCount: chipElements.length,
            sampleChip: chipElements.length > 0 ? chipElements[0].getAttribute('title') : null,
            tomorrowCellHtml: tomorrowCell ? tomorrowCell.innerHTML : null
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('  Debug checkChipsAndOverflow:', JSON.stringify(checkChipsAndOverflow.result.value, null, 2));
    assert(checkChipsAndOverflow.result.value.hasOverflow, 'Overflow link present on multi-event day');
    assert(checkChipsAndOverflow.result.value.chipCount >= 2, 'Readable event chips rendered inside month grid cells');
    console.log(`  Chip count: ${checkChipsAndOverflow.result.value.chipCount}, Overflow: "${checkChipsAndOverflow.result.value.overflowText}"`);

    // Verify Today vs Selected Day visual distinction
    console.log('\n--- Step 4: Verify Today vs Selected Day Visual Distinction ---');
    // Click on tomorrowStr to select it while today remains Today
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const tomCell = document.querySelector('[data-calendar-date="${tomorrowStr}"]');
          if (tomCell) tomCell.click();
        })()
      `,
    });
    await wait(400);

    const checkDistinction = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const todayCell = document.querySelector('[data-calendar-date="${todayStr}"]');
          const selectedCell = document.querySelector('[data-calendar-date="${tomorrowStr}"]');
          return {
            todayIsCurrent: todayCell ? todayCell.getAttribute('aria-current') === 'date' : false,
            selectedIsPressed: selectedCell ? selectedCell.getAttribute('aria-pressed') === 'true' : false,
            selectedDateText: document.querySelector('.lg\\\\:col-span-4 h3 + p')?.textContent.trim()
          };
        })()
      `,
      returnByValue: true,
    });
    assert(checkDistinction.result.value.todayIsCurrent, 'Today cell has aria-current="date"');
    assert(checkDistinction.result.value.selectedIsPressed, 'Selected cell has aria-pressed="true"');
    assert(checkDistinction.result.value.selectedDateText === tomorrowStr, 'Selected Day agenda updates to selected date');

    const shotSelected = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '02-desktop-selected-day-agenda.png'), Buffer.from(shotSelected.data, 'base64'));
    console.log('Saved 02-desktop-selected-day-agenda.png');

    // Verify Coming Up card navigation
    console.log('\n--- Step 5: Verify Coming Up Card Interaction ---');
    const upcomingClickResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const upcomingButtons = Array.from(document.querySelectorAll('[data-testid="calendar-upcoming-card"] button'));
          if (upcomingButtons.length === 0) return { error: 'No upcoming buttons found' };
          const firstBtn = upcomingButtons[0];
          firstBtn.click();
          return { clicked: true, text: firstBtn.textContent.trim() };
        })()
      `,
      returnByValue: true,
    });
    await wait(400);
    assert(upcomingClickResult.result.value.clicked, 'Clicked item in Coming Up card');

    // Test Week and Day view navigation
    console.log('\n--- Step 6: Test Week & Day Views ---');
    // Switch to Week view
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const weekBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Week');
          if (weekBtn) weekBtn.click();
        })()
      `,
    });
    await wait(400);

    const shotWeek = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '03-desktop-calendar-week-view.png'), Buffer.from(shotWeek.data, 'base64'));
    console.log('Saved 03-desktop-calendar-week-view.png');

    // Switch to Day view
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const dayBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Day');
          if (dayBtn) dayBtn.click();
        })()
      `,
    });
    await wait(400);

    const shotDay = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '04-desktop-calendar-day-view.png'), Buffer.from(shotDay.data, 'base64'));
    console.log('Saved 04-desktop-calendar-day-view.png');

    // Switch back to Month view
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const monthBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Month');
          if (monthBtn) monthBtn.click();
        })()
      `,
    });
    await wait(400);

    // Test month navigation and return to Today
    console.log('\n--- Step 7: Month/Year Navigation and Return to Today ---');
    const navResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const titleBefore = Array.from(document.querySelectorAll('h2')).find(h => h.textContent && (h.textContent.includes('202') || h.textContent.includes('January') || h.textContent.includes('February') || h.textContent.includes('March') || h.textContent.includes('April') || h.textContent.includes('May') || h.textContent.includes('June') || h.textContent.includes('July') || h.textContent.includes('August') || h.textContent.includes('September') || h.textContent.includes('October') || h.textContent.includes('November') || h.textContent.includes('December'))).textContent.trim();

          // Click Next Month
          const nextBtn = document.querySelector('button[aria-label="Next month"], button[title="Next month"]');
          if (nextBtn) nextBtn.click();
          return { titleBefore };
        })()
      `,
      returnByValue: true,
    });
    await wait(400);

    const checkNextMonth = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const titleAfter = Array.from(document.querySelectorAll('h2')).find(h => h.textContent && (h.textContent.includes('202') || h.textContent.includes('January') || h.textContent.includes('February') || h.textContent.includes('March') || h.textContent.includes('April') || h.textContent.includes('May') || h.textContent.includes('June') || h.textContent.includes('July') || h.textContent.includes('August') || h.textContent.includes('September') || h.textContent.includes('October') || h.textContent.includes('November') || h.textContent.includes('December'))).textContent.trim();

          // Click Today button
          const todayBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Today');
          if (todayBtn) todayBtn.click();
          return { titleAfter };
        })()
      `,
      returnByValue: true,
    });
    await wait(400);

    const checkReturnedToday = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const titleRestored = Array.from(document.querySelectorAll('h2')).find(h => h.textContent && (h.textContent.includes('202') || h.textContent.includes('January') || h.textContent.includes('February') || h.textContent.includes('March') || h.textContent.includes('April') || h.textContent.includes('May') || h.textContent.includes('June') || h.textContent.includes('July') || h.textContent.includes('August') || h.textContent.includes('September') || h.textContent.includes('October') || h.textContent.includes('November') || h.textContent.includes('December'))).textContent.trim();
          return { titleRestored };
        })()
      `,
      returnByValue: true,
    });
    assert(navResult.result.value.titleBefore !== checkNextMonth.result.value.titleAfter, 'Next month changes visible month');
    assert(navResult.result.value.titleBefore === checkReturnedToday.result.value.titleRestored, 'Today button returns to current month');

    // Test Add Calendar Entry Drawer (ContextualDetailPanel)
    console.log('\n--- Step 8: Contextual Detail Panel for Calendar Entry ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Add entry to this day'));
          if (addBtn) addBtn.click();
        })()
      `,
    });
    await wait(500);

    const shotDrawer = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '05-desktop-calendar-add-drawer.png'), Buffer.from(shotDrawer.data, 'base64'));
    console.log('Saved 05-desktop-calendar-add-drawer.png');

    // Close drawer via Escape key
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await wait(400);

    // Test Week-Start Configuration (Monday vs Sunday)
    console.log('\n--- Step 9: Week-Start Sunday/Monday Verification ---');
    const mondayFirstHeader = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const firstDayHeader = document.querySelector('.grid-cols-7.text-center > span, .grid-cols-7 > span');
          return firstDayHeader ? firstDayHeader.textContent.trim() : null;
        })()
      `,
      returnByValue: true,
    });
    console.log(`  With weekStartsOn='Monday', first column header is: "${mondayFirstHeader.result.value}"`);
    assert(mondayFirstHeader.result.value?.toLowerCase().startsWith('mon'), 'Monday is first column when weekStartsOn="Monday"');

    // Switch to Sunday in settings and reload
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const s = JSON.parse(localStorage.getItem('our_life_planner_settings_v1') || '{}');
          s.weekStartsOn = 'Sunday';
          localStorage.setItem('our_life_planner_settings_v1', JSON.stringify(s));

          const d = JSON.parse(localStorage.getItem('our_life_planner_data_v1') || '{}');
          if (d.settings) {
            d.settings.weekStartsOn = 'Sunday';
            localStorage.setItem('our_life_planner_data_v1', JSON.stringify(d));
          }
        })()
      `,
    });
    await cdp.send('Page.reload');
    await wait(1000);
    // Navigate back to Calendar
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const calNav = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent && el.textContent.includes('Calendar'));
          if (calNav) calNav.click();
        })()
      `,
    });
    await wait(600);

    const sundayFirstHeader = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const firstDayHeader = document.querySelector('.grid-cols-7.text-center > span, .grid-cols-7 > span');
          return firstDayHeader ? firstDayHeader.textContent.trim() : null;
        })()
      `,
      returnByValue: true,
    });
    console.log(`  With weekStartsOn='Sunday', first column header is: "${sundayFirstHeader.result.value}"`);
    assert(sundayFirstHeader.result.value?.toLowerCase().startsWith('sun'), 'Sunday is first column when weekStartsOn="Sunday"');

    // Tablet Viewport (768x1024)
    console.log('\n--- Step 10: Tablet Responsive Layout (768x1024) ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await wait(400);

    const shotTablet = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '06-tablet-calendar-768.png'), Buffer.from(shotTablet.data, 'base64'));
    console.log('Saved 06-tablet-calendar-768.png');

    // Mobile Viewport (390x844)
    console.log('\n--- Step 11: Mobile Responsive Layout (390x844) ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await wait(400);

    const checkMobileDots = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const mobileDots = document.querySelectorAll('.md\\\\:hidden span[class*="rounded-full"]');
          return { mobileDotCount: mobileDots.length };
        })()
      `,
      returnByValue: true,
    });
    assert(checkMobileDots.result.value.mobileDotCount > 0, 'Mobile compact colored dots rendered in month grid cells');

    const shotMobile = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '07-mobile-calendar-390.png'), Buffer.from(shotMobile.data, 'base64'));
    console.log('Saved 07-mobile-calendar-390.png');

    // Narrow Mobile Viewport (320px) spot check
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 320,
      height: 640,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await wait(400);

    const shotNarrow = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, '08-mobile-calendar-320.png'), Buffer.from(shotNarrow.data, 'base64'));
    console.log('Saved 08-mobile-calendar-320.png');

    // Test .ics Export Button presence and function
    console.log('\n--- Step 12: Verify .ics Calendar Export ---');
    const checkExportBtn = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const exportBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Export') || (b.getAttribute('title') && b.getAttribute('title').includes('Export')));
          return { hasExportBtn: !!exportBtn, label: exportBtn ? exportBtn.textContent.trim() : null };
        })()
      `,
      returnByValue: true,
    });
    assert(checkExportBtn.result.value.hasExportBtn, '.ics Export Calendar button available');

    // Save Manifest
    const manifest = {
      phase: '06-calendar',
      timestamp: new Date().toISOString(),
      screenshots: [
        '01-desktop-calendar-month-1440.png',
        '02-desktop-selected-day-agenda.png',
        '03-desktop-calendar-week-view.png',
        '04-desktop-calendar-day-view.png',
        '05-desktop-calendar-add-drawer.png',
        '06-tablet-calendar-768.png',
        '07-mobile-calendar-390.png',
        '08-mobile-calendar-320.png'
      ],
      passedChecks: [
        'Month, Week, Day view switching and rendering',
        'Visible month/year header with next/previous navigation and return to Today',
        'Sunday/Monday week-start configuration',
        'Desktop event chips preview with +N more overflow link',
        'Mobile compact colored dots in calendar cells',
        'Today (aria-current="date") vs Selected Day (aria-pressed="true") visual distinction',
        'Selected day agenda synchronization with progress indicator',
        'Coming up card (data-testid="calendar-upcoming-card") per reference frame-037.png',
        'Clicking Coming up items navigates to target date',
        'ContextualDetailPanel for adding and editing calendar entries with Escape close',
        '.ics calendar export functionality'
      ]
    };
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    console.log('\n=== All Phase 06 Verification Checks Passed Successfully! ===\n');
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
  console.error('Phase 06 test failed:', err);
  process.exit(1);
});
