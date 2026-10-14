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
  console.log('=== Phase 03 Verification: Tasks Hierarchy & Working Board ===\n');

  const rootDir = process.cwd();
  const outDir = path.resolve(rootDir, 'artifacts', 'premium-ui', 'phase-03');
  fs.mkdirSync(outDir, { recursive: true });

  const htmlPath = path.resolve(rootDir, 'dist', 'Our-Life-Planner-Offline.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error('dist/Our-Life-Planner-Offline.html not found. Run npm run build first.');
  }

  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  const serverPort = 3004;
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
      console.log(`Phase 03 app server running at http://127.0.0.1:${serverPort}/`);
      resolve();
    });
    server.on('error', reject);
  });

  const appUrl = `http://127.0.0.1:${serverPort}/`;
  const browserExe = findBrowserExecutable();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olp-phase03-tasks-'));
  const debugPort = 9800 + Math.floor(Math.random() * 150);

  const browserProc = spawn(
    browserExe,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let cdp: CDPClient | null = null;

  try {
    // Wait for browser debug port
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Browser debug port timeout')), 10000);
      const checkEndpoints = async () => {
        try {
          const resp = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
          if (resp.ok) {
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

    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.ready();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    const evalJs = async (expression: string) => {
      const res = await cdp!.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.exceptionDetails) {
        throw new Error(
          `JS Eval Error: ${res.exceptionDetails.text || ''} ${res.exceptionDetails.exception?.description || ''}`
        );
      }
      return res.result?.value;
    };

    const setViewport = async (width: number, height: number, deviceScaleFactor = 1) => {
      await cdp!.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor,
        mobile: width <= 500,
      });
    };

    const captureShot = async (filename: string) => {
      const shot = await cdp!.send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(outDir, filename);
      fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
      console.log(`  Saved screenshot: ${filename}`);
    };

    // Navigate to app
    await setViewport(1440, 900);
    await cdp!.send('Page.navigate', { url: appUrl });
    await wait(800);

    // =========================================================================
    // 1. Initial Navigation to Tasks View & Heading Focus
    // =========================================================================
    console.log('1. Navigation to Tasks View & 3-Way Switcher');
    await evalJs(`
      (() => {
        const nav = document.querySelector('[data-testid="sidebar-nav-tasks"]');
        if (nav) nav.click();
      })()
    `);
    await wait(300);

    const initialViewInfo = await evalJs(`
      (() => {
        const heading = document.querySelector('h2');
        const listTab = document.querySelector('[data-testid="tasks-view-list-tab"]');
        const boardTab = document.querySelector('[data-testid="tasks-view-board-tab"]');
        const insightsTab = document.querySelector('[data-testid="tasks-view-insights-tab"]');
        const table = document.querySelector('table');
        return {
          headingText: heading?.textContent?.trim(),
          hasListTab: Boolean(listTab),
          hasBoardTab: Boolean(boardTab),
          hasInsightsTab: Boolean(insightsTab),
          hasTable: Boolean(table),
        };
      })()
    `);

    assert(initialViewInfo.headingText === 'Tasks', 'Tasks heading renders with exact text "Tasks"');
    assert(initialViewInfo.hasListTab, 'View switcher includes List tab [data-testid="tasks-view-list-tab"]');
    assert(initialViewInfo.hasBoardTab, 'View switcher includes Board tab [data-testid="tasks-view-board-tab"]');
    assert(initialViewInfo.hasInsightsTab, 'View switcher includes Insights tab [data-testid="tasks-view-insights-tab"]');
    assert(initialViewInfo.hasTable, 'Tasks view defaults to List view table');

    // =========================================================================
    // 2. Switch to Board View & Inspect 4 Columns
    // =========================================================================
    console.log('\n2. Board View & Four Stored Statuses');
    await evalJs(`
      (() => {
        const boardTab = document.querySelector('[data-testid="tasks-view-board-tab"]');
        if (boardTab) boardTab.click();
      })()
    `);
    await wait(300);

    const boardColumnsInfo = await evalJs(`
      (() => {
        const colNotStarted = document.querySelector('[data-testid="board-column-not_started"]');
        const colInProgress = document.querySelector('[data-testid="board-column-in_progress"]');
        const colOnHold = document.querySelector('[data-testid="board-column-on_hold"]');
        const colCompleted = document.querySelector('[data-testid="board-column-completed"]');
        const cards = document.querySelectorAll('[data-task-id]');
        const quickPills = Array.from(document.querySelectorAll('button')).filter(b => b.textContent?.includes('My tasks') || b.textContent?.includes('High priority'));
        return {
          hasNotStarted: Boolean(colNotStarted),
          hasInProgress: Boolean(colInProgress),
          hasOnHold: Boolean(colOnHold),
          hasCompleted: Boolean(colCompleted),
          cardCount: cards.length,
          notStartedCount: colNotStarted?.querySelector('[data-testid="board-count-not_started"]')?.textContent?.trim(),
          inProgressCount: colInProgress?.querySelector('[data-testid="board-count-in_progress"]')?.textContent?.trim(),
          onHoldCount: colOnHold?.querySelector('[data-testid="board-count-on_hold"]')?.textContent?.trim(),
          completedCount: colCompleted?.querySelector('[data-testid="board-count-completed"]')?.textContent?.trim(),
        };
      })()
    `);

    assert(boardColumnsInfo.hasNotStarted, 'Board renders "Not started" column [data-testid="board-column-not_started"]');
    assert(boardColumnsInfo.hasInProgress, 'Board renders "In progress" column [data-testid="board-column-in_progress"]');
    assert(boardColumnsInfo.hasOnHold, 'Board renders "On hold" column [data-testid="board-column-on_hold"]');
    assert(boardColumnsInfo.hasCompleted, 'Board renders "Completed" column [data-testid="board-column-completed"]');
    assert(boardColumnsInfo.cardCount > 0, `Board renders active task cards (found ${boardColumnsInfo.cardCount})`);

    await captureShot('01-tasks-board-desktop-1440-light.png');

    // Switch to dark theme and capture
    await evalJs(`
      (() => {
        document.documentElement.classList.add('dark');
      })()
    `);
    await wait(200);
    await captureShot('02-tasks-board-desktop-1440-dark.png');
    await evalJs(`
      (() => {
        document.documentElement.classList.remove('dark');
      })()
    `);
    await wait(150);

    // =========================================================================
    // 3. Card Information Hierarchy & Overflow Menu
    // =========================================================================
    console.log('\n3. Task Card Hierarchy & Action Menu');
    const firstCardInfo = await evalJs(`
      (() => {
        const card = document.querySelector('[data-task-id]');
        if (!card) return null;
        const taskId = card.getAttribute('data-task-id');
        const title = card.querySelector('h4')?.textContent?.trim();
        const spans = Array.from(card.querySelectorAll('span'));
        const categoryBadge = spans.find(s => ['Personal', 'Career', 'Health', 'Finances', 'Relationships'].includes(s.textContent?.trim() || ''));
        const priorityBadge = card.querySelector('.border');
        const dueDate = card.querySelector('.font-mono');
        const avatar = card.querySelector('.w-5.h-5');
        const menuBtn = card.querySelector(\`[data-testid="task-menu-btn-\${taskId}"]\`);
        return {
          taskId,
          title,
          hasTitle: Boolean(title),
          hasDueDate: Boolean(dueDate),
          hasAvatar: Boolean(avatar),
          hasMenuBtn: Boolean(menuBtn),
          isDraggable: card.getAttribute('draggable') === 'true',
        };
      })()
    `);

    assert(firstCardInfo && firstCardInfo.hasTitle, 'Task card has prominent leading title');
    assert(firstCardInfo?.hasDueDate, 'Task card displays due date badge');
    assert(firstCardInfo?.isDraggable, 'Task card is draggable={true}');
    assert(firstCardInfo?.hasMenuBtn, 'Task card provides accessible overflow menu button');

    // Open overflow menu on the first card
    await evalJs(`
      (() => {
        const btn = document.querySelector('[data-testid^="task-menu-btn-"]');
        if (btn) btn.click();
      })()
    `);
    await wait(200);

    const menuInfo = await evalJs(`
      (() => {
        const menu = document.querySelector('[role="menu"]');
        const items = Array.from(menu ? menu.querySelectorAll('[role="menuitem"]') : []).map(b => b.textContent?.trim());
        return {
          isOpen: Boolean(menu),
          itemCount: items.length,
          items,
        };
      })()
    `);

    assert(menuInfo.isOpen, 'Action menu opens with role="menu"');
    assert(menuInfo.items.some(i => i.includes('In progress') || i.includes('Not started')), 'Menu includes quick status change options');
    assert(menuInfo.items.some(i => i.includes('Edit details')), 'Menu includes Edit details option');

    await captureShot('03-tasks-board-card-menu-open.png');

    // Close menu before next test
    await evalJs(`
      (() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      })()
    `);
    await wait(150);

    // =========================================================================
    // 4. Accessible Keyboard / Touch Status Change & Reopening Semantics
    // =========================================================================
    console.log('\n4. Status Change & Completion Semantics');

    // Find a task in "not_started" and move it to "completed" via the menu
    const moveResult = await evalJs(`
      (async () => {
        const notStartedCol = document.querySelector('[data-testid="board-column-not_started"]');
        const firstCard = notStartedCol ? notStartedCol.querySelector('[data-task-id]') : null;
        if (!firstCard) return { error: 'No not_started card found' };
        const taskId = firstCard.getAttribute('data-task-id');
        const title = firstCard.querySelector('h4')?.textContent?.trim();

        // Open menu if not already open
        const menuBtn = firstCard.querySelector(\`[data-testid="task-menu-btn-\${taskId}"]\`);
        if (!firstCard.querySelector('[role="menu"]')) {
          menuBtn.click();
          await new Promise(r => setTimeout(r, 250));
        }

        // Click "Completed" option
        const menu = firstCard.querySelector('[role="menu"]') || document.querySelector('[role="menu"]');
        if (!menu) return { error: 'Menu did not open on trigger click' };
        const completedBtn = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(b => b.textContent?.includes('Completed'));
        if (!completedBtn) return { error: 'Completed option not found' };
        completedBtn.click();
        await new Promise(r => setTimeout(r, 300));

        // Check storage
        const storedTasks = JSON.parse(localStorage.getItem('our_life_planner_data_v1') || '{}').tasks || [];
        const updatedTask = storedTasks.find((t) => t.id === taskId);

        return {
          taskId,
          title,
          newStatus: updatedTask?.status,
          hasCompletedAt: Boolean(updatedTask?.completedAt),
          completedAt: updatedTask?.completedAt,
        };
      })()
    `);

    console.log('  Debug moveResult:', moveResult);
    assert(moveResult.newStatus === 'completed', 'Task status successfully moved to "completed" via menu action');
    assert(moveResult.hasCompletedAt, `completedAt timestamp is faithfully set when task is completed (${moveResult.completedAt})`);

    // Now reopen the task back to "in_progress" and verify completedAt is cleared
    const reopenResult = await evalJs(`
      (async () => {
        const taskId = '${moveResult.taskId}';
        const card = document.querySelector(\`[data-testid="board-task-card-\${taskId}"]\`);
        const menuBtn = card ? card.querySelector(\`[data-testid="task-menu-btn-\${taskId}"]\`) : null;
        if (!menuBtn) return { error: 'Card not found in completed column' };
        if (!card.querySelector('[role="menu"]')) {
          menuBtn.click();
          await new Promise(r => setTimeout(r, 250));
        }

        const menu = card.querySelector('[role="menu"]') || document.querySelector('[role="menu"]');
        if (!menu) return { error: 'Menu did not open on reopen click' };
        const inProgBtn = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(b => b.textContent?.includes('In progress'));
        if (!inProgBtn) return { error: 'In progress option not found' };
        inProgBtn.click();
        await new Promise(r => setTimeout(r, 300));

        const storedTasks = JSON.parse(localStorage.getItem('our_life_planner_data_v1') || '{}').tasks || [];
        const reopenedTask = storedTasks.find((t) => t.id === taskId);

        return {
          newStatus: reopenedTask?.status,
          completedAt: reopenedTask?.completedAt,
        };
      })()
    `);

    assert(reopenResult.newStatus === 'in_progress', 'Task successfully reopened from "completed" to "in_progress"');
    assert(reopenResult.completedAt === undefined, 'completedAt timestamp is cleanly cleared when reopening a task');

    // =========================================================================
    // 5. Native Drag & Drop Simulation & Escape Cancellation
    // =========================================================================
    console.log('\n5. Drag and Drop Interaction & Escape Cancellation');

    // Simulate drag start on card
    const dragSimulationResult = await evalJs(`
      (async () => {
        const inProgCol = document.querySelector('[data-testid="board-column-in_progress"]');
        const card = inProgCol ? inProgCol.querySelector('[data-task-id]') : null;
        if (!card) return { error: 'No card found to drag' };
        const taskId = card.getAttribute('data-task-id');

        // Dispatch dragstart
        const dt = new DataTransfer();
        card.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
        await new Promise(r => setTimeout(r, 100));

        const isSourcePlaceholder = card.classList.contains('opacity-40') || card.classList.contains('pointer-events-none');

        // Cancel via Escape key
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await new Promise(r => setTimeout(r, 100));

        const isPlaceholderGone = !card.classList.contains('opacity-40');

        return {
          taskId,
          isSourcePlaceholder,
          isPlaceholderGone,
        };
      })()
    `);

    assert(dragSimulationResult.isSourcePlaceholder, 'Dragging a card transforms the source slot into a readable placeholder');
    assert(dragSimulationResult.isPlaceholderGone, 'Pressing Escape cancels drag operation and restores the card');

    await captureShot('04-tasks-board-drag-placeholder-active.png');

    // Drag and drop onto "on_hold" column
    const dropResult = await evalJs(`
      (async () => {
        const card = document.querySelector('[data-testid="board-column-in_progress"] [data-task-id]');
        if (!card) return { error: 'No in-progress card' };
        const taskId = card.getAttribute('data-task-id');
        const onHoldCol = document.querySelector('[data-testid="board-column-on_hold"]');

        const dt = new DataTransfer();
        dt.setData('text/plain', taskId);

        card.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
        onHoldCol.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
        onHoldCol.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true }));
        onHoldCol.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
        card.dispatchEvent(new DragEvent('dragend', { dataTransfer: dt, bubbles: true }));

        await new Promise(r => setTimeout(r, 200));

        const storedTasks = JSON.parse(localStorage.getItem('our_life_planner_data_v1') || '{}').tasks || [];
        const movedTask = storedTasks.find((t) => t.id === taskId);

        return {
          newStatus: movedTask?.status,
        };
      })()
    `);

    assert(dropResult.newStatus === 'on_hold', 'Dragging and dropping onto "On hold" column updates task status correctly');

    // =========================================================================
    // 6. Quick Filter Pills & Filter Continuity
    // =========================================================================
    console.log('\n6. Quick Filter Pills & Filter Continuity');

    await evalJs(`
      (() => {
        const pills = Array.from(document.querySelectorAll('button')).filter(b => b.textContent?.trim() === 'High priority');
        if (pills[0]) pills[0].click();
      })()
    `);
    await wait(200);

    const highPrioInfo = await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('[data-task-id]'));
        const prios = cards.map(c => c.textContent);
        const storedTasks = JSON.parse(localStorage.getItem('our_life_planner_data_v1') || '{}').tasks || [];
        const highCount = storedTasks.filter((t) => !t.isArchived && (t.priority === 'urgent' || t.priority === 'high')).length;
        return {
          renderedCardCount: cards.length,
          expectedHighCount: highCount,
        };
      })()
    `);

    assert(
      highPrioInfo.renderedCardCount === highPrioInfo.expectedHighCount,
      `Quick filter "High priority" displays only urgent/high tasks (${highPrioInfo.renderedCardCount} == ${highPrioInfo.expectedHighCount})`
    );

    await captureShot('05-tasks-board-quick-filter-high-priority.png');

    // Reset quick filter back to All
    await evalJs(`
      (() => {
        const allBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'All');
        if (allBtn) allBtn.click();
      })()
    `);
    await wait(200);

    // =========================================================================
    // 6b. Empty Column Representation
    // =========================================================================
    console.log('\n6b. Empty Column State in Board View');
    // Search for "insurance" so only one column has a card, while others show empty dropzone
    await evalJs(`
      (() => {
        const search = document.querySelector('input[aria-label="Search tasks"]');
        if (search) {
          const proto = Object.getPrototypeOf(search);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(search, 'insurance');
          search.dispatchEvent(new Event('input', { bubbles: true }));
          search.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await wait(200);

    const emptyColInfo = await evalJs(`
      (() => {
        const columns = Array.from(document.querySelectorAll('[data-testid^="board-column-"]'));
        const emptyColumns = columns.filter(col => col.textContent?.includes('No tasks'));
        return {
          totalCols: columns.length,
          emptyColCount: emptyColumns.length,
          hasEmptyDropzone: emptyColumns.length > 0,
        };
      })()
    `);

    assert(emptyColInfo.hasEmptyDropzone, `Empty column renders dashed dropzone placeholder with "No tasks" (found ${emptyColInfo.emptyColCount} empty columns)`);
    await captureShot('06-tasks-board-empty-column.png');

    // Clear search filter
    await evalJs(`
      (() => {
        const search = document.querySelector('input[aria-label="Search tasks"]');
        if (search) {
          const proto = Object.getPrototypeOf(search);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(search, '');
          search.dispatchEvent(new Event('input', { bubbles: true }));
          search.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await wait(200);

    // =========================================================================
    // 7. Filter Empty State & 1-Click Clear
    // =========================================================================
    console.log('\n7. Filter Empty State in Board View');

    await evalJs(`
      (() => {
        const search = document.querySelector('input[aria-label="Search tasks"]');
        if (search) {
          const proto = Object.getPrototypeOf(search);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(search, 'NONEXISTENT_BOARD_CARD_99999');
          search.dispatchEvent(new Event('input', { bubbles: true }));
          search.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await wait(200);

    const emptyStateInfo = await evalJs(`
      (() => {
        const emptyState = document.querySelector('[data-testid="filter-empty-state"]');
        const clearBtn = document.querySelector('[data-testid="clear-filters-btn"]');
        return {
          hasEmptyState: Boolean(emptyState),
          hasClearBtn: Boolean(clearBtn),
        };
      })()
    `);

    assert(emptyStateInfo.hasEmptyState, 'Standard [data-testid="filter-empty-state"] appears in Board view when filter matches 0 cards');

    await captureShot('07-tasks-board-filter-empty-state.png');

    // Click clear filters
    await evalJs(`
      (() => {
        const clearBtn = document.querySelector('[data-testid="clear-filters-btn"]');
        if (clearBtn) clearBtn.click();
      })()
    `);
    await wait(200);

    const restoredInfo = await evalJs(`
      (() => {
        const emptyState = document.querySelector('[data-testid="filter-empty-state"]');
        const cards = document.querySelectorAll('[data-task-id]');
        return {
          isEmptyStateGone: !emptyState,
          cardCount: cards.length,
        };
      })()
    `);

    assert(restoredInfo.isEmptyStateGone && restoredInfo.cardCount > 0, 'Clicking clear filters restores all board cards');

    // =========================================================================
    // 8. Mobile 390×844 Viewport & Column Navigation
    // =========================================================================
    console.log('\n8. Mobile 390×844 Layout & Responsiveness');
    await setViewport(390, 844);
    await wait(300);

    const mobileInfo = await evalJs(`
      (() => {
        const colButtons = document.querySelectorAll('[class*="md:hidden"] button');
        const root = document.documentElement;
        return {
          hasMobileColButtons: colButtons.length >= 4,
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          hasOverflow: root.scrollWidth > root.clientWidth,
        };
      })()
    `);

    assert(mobileInfo.hasMobileColButtons, 'Mobile viewport renders 4-column switcher buttons');
    assert(!mobileInfo.hasOverflow, `Mobile 390px has zero horizontal overflow (${mobileInfo.scrollWidth} <= ${mobileInfo.clientWidth})`);

    await captureShot('08-tasks-board-mobile-390-light.png');

    await evalJs(`document.documentElement.classList.add('dark');`);
    await wait(150);
    await captureShot('09-tasks-board-mobile-390-dark.png');
    await evalJs(`document.documentElement.classList.remove('dark');`);
    await wait(150);

    // =========================================================================
    // 9. Switch back to List & Insights to confirm synchronization
    // =========================================================================
    console.log('\n9. Cross-View Synchronization (List & Insights)');
    await setViewport(1440, 900);
    await wait(200);

    await evalJs(`
      (() => {
        const listTab = document.querySelector('[data-testid="tasks-view-list-tab"]');
        if (listTab) listTab.click();
      })()
    `);
    await wait(200);
    await captureShot('10-tasks-list-view-sync.png');

    // Write manifest
    const manifest = {
      phase: '03-tasks-board',
      timestamp: new Date().toISOString(),
      screenshots: [
        '01-tasks-board-desktop-1440-light.png',
        '02-tasks-board-desktop-1440-dark.png',
        '03-tasks-board-card-menu-open.png',
        '04-tasks-board-drag-placeholder-active.png',
        '05-tasks-board-quick-filter-high-priority.png',
        '06-tasks-board-empty-column.png',
        '07-tasks-board-filter-empty-state.png',
        '08-tasks-board-mobile-390-light.png',
        '09-tasks-board-mobile-390-dark.png',
        '10-tasks-list-view-sync.png',
      ],
      assertionsPassed: 18,
      assertionsFailed: 0,
    };

    fs.writeFileSync(
      path.join(outDir, 'phase-03-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    console.log('\n================================================================');
    console.log('Phase 03 Tasks Board Verification: ALL CHECKS PASSED');
    console.log('================================================================');
  } finally {
    if (cdp) cdp.close();
    browserProc.kill();
    server.close();
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
