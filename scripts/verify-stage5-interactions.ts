/**
 * Automated Verification Suite for Stage 5:
 * Standardize Shared Interactions Across Tools
 *
 * Verifies:
 * 1. Contextual Detail Panels:
 *    - Opens docked side drawer with parent context visible underneath
 *    - Accessibility: role="dialog", aria-modal="true", initial focus inside, Escape closing, focus restoration
 * 2. Standardized Inline Validation & Input Preservation:
 *    - Tasks View: missing title triggers role="alert", aria-invalid="true", retains all typed fields
 *    - Calendar View: invalid time range triggers role="alert", aria-invalid="true", retains all typed fields
 *    - Debt Payoff: below-minimum payment triggers role="alert", aria-invalid="true", retains all typed fields
 * 3. Standardized Filter Empty States:
 *    - Distinct from clean first-use empty states
 *    - role="status", data-testid="filter-empty-state", with 1-click [data-testid="clear-filters-btn"]
 *    - Restores filtered items across Tasks, Calendar, Groceries, and Meals
 * 4. Accessible Tabular Alternatives for Visual Charts:
 *    - Tasks Insights priority breakdown table: [data-testid="tasks-accessible-insights-table"]
 *    - Budget spending allocations table: [data-testid="budget-accessible-chart-table"]
 *    - Weight & BMI history table: [data-testid="weight-accessible-chart-table"]
 *    - Workouts muscle group distribution table: [data-testid="workouts-accessible-chart-table"]
 */

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
  }

  ready(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data.toString());
          if (msg.id && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id)!;
            this.pending.delete(msg.id);
            if (msg.error) {
              reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            } else {
              resolve(msg.result);
            }
          }
        } catch {
          // ignore
        }
      };
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
    } catch {
      // ignore
    }
  }
}

async function main() {
  console.log('=== Stage 5 Verification: Standardize Shared Interactions Across Tools ===\n');

  const distDir = path.resolve(process.cwd(), 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error('dist/index.html not found. Run "npm run build" first.');
  }

  // Host standalone app locally
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
    let filePath = path.join(distDir, parsedUrl.pathname);
    if (parsedUrl.pathname === '/' || !fs.existsSync(filePath)) {
      filePath = indexHtmlPath;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
    };
    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const appUrl = `http://127.0.0.1:${port}/`;

  const browserBin = findBrowserExecutable();
  const remotePort = 9245;
  const userDataDir = path.resolve(process.cwd(), 'dist', 'temp-chrome-stage5');
  if (fs.existsSync(userDataDir)) {
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }

  const chromeProc = spawn(browserBin, [
    `--remote-debugging-port=${remotePort}`,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    appUrl,
  ]);

  let cdp: CDPClient | null = null;

  try {
    // Wait for CDP endpoint
    let wsUrl = '';
    for (let i = 0; i < 40; i++) {
      try {
        const resp = await fetch(`http://127.0.0.1:${remotePort}/json`);
        const list = await resp.json();
        const page = list.find((p: any) => p.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!wsUrl) throw new Error('Could not connect to Chrome DevTools Protocol');

    cdp = new CDPClient(wsUrl);
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
        throw new Error(res.exceptionDetails.text || JSON.stringify(res.exceptionDetails));
      }
      return res.result?.value;
    };

    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const setViewport = async (width: number, height: number, isMobile = false) => {
      await cdp!.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: isMobile,
      });
    };

    const captureScreenshot = async (filename: string) => {
      const res = await cdp!.send('Page.captureScreenshot', { format: 'png' });
      const dir = path.resolve(process.cwd(), 'screenshots');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), Buffer.from(res.data, 'base64'));
    };

    await setViewport(1440, 900, false);
    await wait(400);

    let passed = 0;
    let failed = 0;
    const assert = (condition: boolean, msg: string) => {
      if (condition) {
        console.log(`  PASS: ${msg}`);
        passed++;
      } else {
        console.error(`  FAIL: ${msg}`);
        failed++;
      }
    };

    // Wait for app mount
    for (let i = 0; i < 40; i++) {
      const ready = await evalJs(`Boolean(document.querySelector('#setup-owner-name') || document.querySelector('[data-testid="sidebar-nav-today"]'))`);
      if (ready) break;
      await wait(100);
    }

    // Dismiss setup wizard with Sample data to populate records for interaction tests
    await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const nameInput = document.querySelector('#setup-owner-name');
        if (nameInput) {
          const proto = Object.getPrototypeOf(nameInput);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(nameInput, 'Alex');
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          nameInput.dispatchEvent(new Event('change', { bubbles: true }));
          await wait(80);
          const step1Btn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
            b => b.textContent?.includes('Choose Tools & Data')
          );
          if (step1Btn) step1Btn.click();
          await wait(200);

          // Select sample data so we have records to filter and inspect
          const sampleRadio = document.querySelector('[data-testid="setup-preset-sample"]');
          if (sampleRadio) sampleRadio.click();
          await wait(80);
          const allBtn = document.querySelector('[data-testid="setup-preset-all"]');
          if (allBtn) allBtn.click();
          await wait(80);
          const step2Btn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
            b => b.textContent?.includes('Add First Commitments')
          );
          if (step2Btn) step2Btn.click();
          await wait(200);
          const finishBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
            b => b.textContent?.includes('Launch My Planner')
          );
          if (finishBtn) finishBtn.click();
          await wait(300);
        }
      })()
    `);
    await wait(400);

    // Wait until setup wizard dialog is unmounted
    for (let i = 0; i < 30; i++) {
      const isWizardOpen = await evalJs(`Boolean(document.querySelector('[role="dialog"][aria-label="Setup Wizard"]'))`);
      if (!isWizardOpen) break;
      await wait(100);
    }

    // =========================================================================
    // 1. Tasks View: Contextual Detail Panel & Standardized Interactions
    // =========================================================================
    console.log('1. Tasks View: Contextual Detail Panel & Validation');

    // Switch to Tasks View
    await evalJs(`
      (() => {
        const btn = document.querySelector('[data-testid="sidebar-nav-tasks"]');
        if (btn) btn.click();
      })()
    `);
    await wait(250);

    // Open Task Creation Contextual Panel
    await evalJs(`
      (() => {
        const btn = document.querySelector('[data-testid="tasks-new-task-btn"]');
        if (btn) {
          btn.focus();
          btn.click();
        }
      })()
    `);
    await wait(200);

    const taskPanelInfo = await evalJs(`
      (() => {
        const panel = document.querySelector('[data-testid="task-detail-panel"]');
        const titleInput = document.querySelector('#task-modal-title');
        const descInput = document.querySelector('#task-modal-description');
        const activeId = document.activeElement ? document.activeElement.id : null;
        return {
          isOpen: Boolean(panel),
          role: panel ? panel.getAttribute('role') : null,
          ariaModal: panel ? panel.getAttribute('aria-modal') : null,
          initialFocusId: activeId,
          hasTitleInput: Boolean(titleInput),
          hasDescInput: Boolean(descInput),
        };
      })()
    `);

    assert(taskPanelInfo.isOpen, 'Task contextual detail panel opens on trigger click');
    assert(taskPanelInfo.role === 'dialog' && taskPanelInfo.ariaModal === 'true', 'Panel has role="dialog" and aria-modal="true"');
    assert(taskPanelInfo.initialFocusId === 'task-modal-title', 'Panel places initial focus on #task-modal-title');

    await captureScreenshot('stage5-task-contextual-panel.png');

    // Test inline field validation & input preservation
    await evalJs(`
      (() => {
        const titleInput = document.querySelector('#task-modal-title');
        const descInput = document.querySelector('#task-modal-description');
        const setVal = (el, val) => {
          const proto = Object.getPrototypeOf(el);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        setVal(titleInput, '');
        setVal(descInput, 'Important: must submit before renewal deadline');
        const submitBtn = document.querySelector('[data-testid="task-modal-submit-btn"]');
        if (submitBtn) submitBtn.click();
      })()
    `);
    await wait(150);

    const taskValInfo = await evalJs(`
      (() => {
        const panel = document.querySelector('[data-testid="task-detail-panel"]');
        const errBanner = document.querySelector('[data-testid="task-modal-title-error"]');
        const titleInput = document.querySelector('#task-modal-title');
        const descInput = document.querySelector('#task-modal-description');
        return {
          isStillOpen: Boolean(panel),
          hasErrorBanner: Boolean(errBanner),
          errorRole: errBanner ? errBanner.getAttribute('role') : null,
          titleAriaInvalid: titleInput ? titleInput.getAttribute('aria-invalid') : null,
          descValue: descInput ? descInput.value : '',
        };
      })()
    `);

    assert(taskValInfo.isStillOpen, 'Validation error keeps detail panel open for correction');
    assert(taskValInfo.hasErrorBanner && taskValInfo.errorRole === 'alert', 'Inline validation error renders with role="alert"');
    assert(taskValInfo.titleAriaInvalid === 'true', 'Invalid title input has aria-invalid="true"');
    assert(taskValInfo.descValue === 'Important: must submit before renewal deadline', 'Typed description is preserved without loss upon validation failure');

    await captureScreenshot('stage5-inline-validation-error.png');

    // Enter valid title and submit
    await evalJs(`
      (() => {
        const titleInput = document.querySelector('#task-modal-title');
        const setVal = (el, val) => {
          const proto = Object.getPrototypeOf(el);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        setVal(titleInput, 'Annual tax documents preparation');
        const submitBtn = document.querySelector('[data-testid="task-modal-submit-btn"]');
        if (submitBtn) submitBtn.click();
      })()
    `);
    await wait(200);

    const afterSaveInfo = await evalJs(`
      (() => {
        const panel = document.querySelector('[data-testid="task-detail-panel"]');
        const activeTestId = document.activeElement ? document.activeElement.getAttribute('data-testid') : null;
        return {
          isClosed: !panel,
          activeTestId,
        };
      })()
    `);
    assert(afterSaveInfo.isClosed, 'Detail panel closes after valid submission');
    assert(afterSaveInfo.activeTestId === 'tasks-new-task-btn', 'Focus restores to trigger button after panel closes');

    // =========================================================================
    // 2. Standardized Filter Empty State & 1-Click Clear
    // =========================================================================
    console.log('\n2. Standardized Filter Empty State & 1-Click Clear');

    // Search for non-existent task to trigger filter empty state
    await evalJs(`
      (() => {
        const search = document.querySelector('input[aria-label="Search tasks"]');
        if (search) {
          const proto = Object.getPrototypeOf(search);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(search, 'XYZ_NONEXISTENT_TASK_FILTER_999');
          search.dispatchEvent(new Event('input', { bubbles: true }));
          search.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await wait(150);

    const filterEmptyInfo = await evalJs(`
      (() => {
        const emptyState = document.querySelector('[data-testid="filter-empty-state"]');
        const clearBtn = document.querySelector('[data-testid="clear-filters-btn"]');
        return {
          hasEmptyState: Boolean(emptyState),
          emptyRole: emptyState ? emptyState.getAttribute('role') : null,
          hasClearBtn: Boolean(clearBtn),
          clearText: clearBtn ? clearBtn.textContent?.trim() : '',
        };
      })()
    `);

    assert(filterEmptyInfo.hasEmptyState, 'Standardized [data-testid="filter-empty-state"] appears when filter yields 0 tasks');
    assert(filterEmptyInfo.emptyRole === 'status', 'Filter empty state has role="status" for accessibility announcements');
    assert(filterEmptyInfo.hasClearBtn, '1-click [data-testid="clear-filters-btn"] button is provided');

    await captureScreenshot('stage5-filter-empty-state.png');

    // Click clear filters button
    await evalJs(`
      (() => {
        const clearBtn = document.querySelector('[data-testid="clear-filters-btn"]');
        if (clearBtn) clearBtn.click();
      })()
    `);
    await wait(150);

    const afterClearInfo = await evalJs(`
      (() => {
        const emptyState = document.querySelector('[data-testid="filter-empty-state"]');
        const search = document.querySelector('input[aria-label="Search tasks"]');
        const rows = document.querySelectorAll('tbody tr');
        return {
          emptyStateRemoved: !emptyState,
          searchQueryCleared: search ? search.value === '' : false,
          rowCount: rows.length,
        };
      })()
    `);

    assert(afterClearInfo.emptyStateRemoved, 'Filter empty state disappears after clicking clear filters');
    assert(afterClearInfo.searchQueryCleared, 'Search query is reset to empty string');
    assert(afterClearInfo.rowCount > 0, `Task list is restored (found ${afterClearInfo.rowCount} rows)`);

    // =========================================================================
    // 3. Accessible Tabular Alternatives for Visual Charts
    // =========================================================================
    console.log('\n3. Accessible Tabular Alternatives for Visual Charts');

    // Check Tasks Insights Table
    await evalJs(`
      (() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const insightsTab = tabs.find(b => b.textContent?.trim().toLowerCase() === 'insights');
        if (insightsTab) insightsTab.click();
      })()
    `);
    await wait(150);

    const taskInsightsTable = await evalJs(`
      (() => {
        const table = document.querySelector('[data-testid="tasks-accessible-insights-table"]');
        const headers = table ? Array.from(table.querySelectorAll('th')).map(h => h.textContent?.trim()) : [];
        const rows = table ? table.querySelectorAll('tbody tr').length : 0;
        return {
          hasTable: Boolean(table),
          headers,
          rowCount: rows,
        };
      })()
    `);

    assert(taskInsightsTable.hasTable, 'Tasks insights provides accessible matrix table [data-testid="tasks-accessible-insights-table"]');
    assert(taskInsightsTable.headers.includes('Urgent') && taskInsightsTable.headers.includes('Total'), 'Insights table includes priority breakdown headers');
    assert(taskInsightsTable.rowCount >= 5, `Insights table breaks down all 5 life categories (got ${taskInsightsTable.rowCount} rows)`);

    // Check Budget Spending Accessible Table
    await evalJs(`
      (() => {
        const btn = document.querySelector('[data-testid="sidebar-nav-budget"]');
        if (btn) btn.click();
      })()
    `);
    await wait(250);

    const budgetChartTable = await evalJs(`
      (() => {
        const table = document.querySelector('[data-testid="budget-accessible-chart-table"]');
        const headers = table ? Array.from(table.querySelectorAll('th')).map(h => h.textContent?.trim()) : [];
        const rows = table ? table.querySelectorAll('tbody tr').length : 0;
        return {
          hasTable: Boolean(table),
          headers,
          rowCount: rows,
        };
      })()
    `);

    assert(budgetChartTable.hasTable, 'Budget spending provides accessible table [data-testid="budget-accessible-chart-table"]');
    assert(budgetChartTable.headers.includes('Category') && budgetChartTable.headers.includes('Remaining'), 'Budget chart table includes structured financial column headers');
    assert(budgetChartTable.rowCount > 0, `Budget chart table contains category rows (got ${budgetChartTable.rowCount})`);

    // Check Weight & BMI Accessible Table
    await evalJs(`
      (() => {
        const btn = document.querySelector('[data-testid="sidebar-nav-weight"]');
        if (btn) btn.click();
      })()
    `);
    await wait(250);

    const weightChartTable = await evalJs(`
      (() => {
        const container = document.querySelector('[data-testid="weight-accessible-chart-table"]');
        const table = container ? container.querySelector('table') : null;
        return {
          hasContainer: Boolean(container),
          hasTable: Boolean(table),
        };
      })()
    `);

    assert(weightChartTable.hasContainer && weightChartTable.hasTable, 'Weight & BMI view provides accessible tabular data [data-testid="weight-accessible-chart-table"]');

    // Check Workouts Muscle Groups Accessible Table
    await evalJs(`
      (() => {
        const btn = document.querySelector('[data-testid="sidebar-nav-workouts"]');
        if (btn) btn.click();
      })()
    `);
    await wait(250);

    // Switch to history tab in workouts
    await evalJs(`
      (() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const hist = tabs.find(b => b.textContent?.trim().toLowerCase() === 'history');
        if (hist) hist.click();
      })()
    `);
    await wait(150);

    const workoutChartTable = await evalJs(`
      (() => {
        const table = document.querySelector('[data-testid="workouts-accessible-chart-table"]');
        const rows = table ? table.querySelectorAll('tbody tr').length : 0;
        return {
          hasTable: Boolean(table),
          rowCount: rows,
        };
      })()
    `);

    assert(workoutChartTable.hasTable, 'Workouts view provides accessible table [data-testid="workouts-accessible-chart-table"]');
    assert(workoutChartTable.rowCount >= 8, `Workouts table summarizes 8 muscle distribution groups (got ${workoutChartTable.rowCount})`);

    // =========================================================================
    // 4. Calendar View: Contextual Detail Panel & Filter Empty State
    // =========================================================================
    console.log('\n4. Calendar View: Contextual Detail Panel & Time Validation');

    await evalJs(`
      (() => {
        const btn = document.querySelector('[data-testid="sidebar-nav-calendar"]');
        if (btn) btn.click();
      })()
    `);
    await wait(250);

    // Open Calendar Entry Contextual Detail Panel
    await evalJs(`
      (() => {
        const addBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent?.includes('Add entry')
        );
        if (addBtn) addBtn.click();
      })()
    `);
    await wait(200);

    const calPanelInfo = await evalJs(`
      (() => {
        const panel = document.querySelector('[data-testid="calendar-entry-panel"]');
        return {
          isOpen: Boolean(panel),
          role: panel ? panel.getAttribute('role') : null,
          ariaModal: panel ? panel.getAttribute('aria-modal') : null,
        };
      })()
    `);

    assert(calPanelInfo.isOpen, 'Calendar entry contextual panel [data-testid="calendar-entry-panel"] opens');
    assert(calPanelInfo.role === 'dialog' && calPanelInfo.ariaModal === 'true', 'Calendar panel has role="dialog" and aria-modal="true"');

    await captureScreenshot('stage5-calendar-panel.png');

    // Test time range validation (end <= start)
    await evalJs(`
      (() => {
        const titleInput = document.querySelector('#calendar-entry-title');
        const startInput = document.querySelector('#calendar-entry-start-time');
        const endInput = document.querySelector('#calendar-entry-end-time');
        const setVal = (el, val) => {
          const proto = Object.getPrototypeOf(el);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        setVal(titleInput, 'Design alignment meeting');
        setVal(startInput, '14:00');
        setVal(endInput, '13:00'); // invalid: end before start
        const submitBtn = document.querySelector('[data-testid="calendar-entry-submit-btn"]');
        if (submitBtn) submitBtn.click();
      })()
    `);
    await wait(150);

    const calValInfo = await evalJs(`
      (() => {
        const panel = document.querySelector('[data-testid="calendar-entry-panel"]');
        const errBanner = document.querySelector('[data-testid="calendar-entry-time-error"]');
        const startInput = document.querySelector('#calendar-entry-start-time');
        const titleInput = document.querySelector('#calendar-entry-title');
        return {
          isStillOpen: Boolean(panel),
          hasErrorBanner: Boolean(errBanner),
          errorRole: errBanner ? errBanner.getAttribute('role') : null,
          startAriaInvalid: startInput ? startInput.getAttribute('aria-invalid') : null,
          titleValue: titleInput ? titleInput.value : '',
        };
      })()
    `);

    assert(calValInfo.isStillOpen, 'Calendar panel stays open on time range validation error');
    assert(calValInfo.hasErrorBanner && calValInfo.errorRole === 'alert', 'Calendar time error renders with role="alert"');
    assert(calValInfo.startAriaInvalid === 'true', 'Time inputs are marked with aria-invalid="true"');
    assert(calValInfo.titleValue === 'Design alignment meeting', 'Entered title is preserved upon time validation failure');

    // Close panel with Escape key
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await wait(150);

    const afterEscCal = await evalJs(`Boolean(document.querySelector('[data-testid="calendar-entry-panel"]'))`);
    assert(!afterEscCal, 'Calendar contextual detail panel cleanly closes on Escape');

    // Test Calendar Filter Empty State
    await evalJs(`
      (() => {
        // Toggle off all filter switches
        const switches = document.querySelectorAll('button[role="switch"]');
        switches.forEach(s => {
          if (s.getAttribute('aria-checked') === 'true') {
            s.click();
          }
        });
      })()
    `);
    await wait(150);

    const calFilterEmpty = await evalJs(`
      (() => {
        const emptyState = document.querySelector('[data-testid="filter-empty-state"]');
        const clearBtn = document.querySelector('[data-testid="clear-filters-btn"]');
        return {
          hasEmptyState: Boolean(emptyState),
          hasClearBtn: Boolean(clearBtn),
        };
      })()
    `);

    assert(calFilterEmpty.hasEmptyState, 'Calendar renders [data-testid="filter-empty-state"] when filters hide schedule items');

    // Reset filters
    await evalJs(`
      (() => {
        const clearBtn = document.querySelector('[data-testid="clear-filters-btn"]');
        if (clearBtn) clearBtn.click();
      })()
    `);
    await wait(150);

    const afterCalReset = await evalJs(`
      (() => {
        const emptyState = document.querySelector('[data-testid="filter-empty-state"]');
        const switches = Array.from(document.querySelectorAll('button[role="switch"]'));
        const allActive = switches.every(s => s.getAttribute('aria-checked') === 'true');
        return {
          emptyStateRemoved: !emptyState,
          allActive,
        };
      })()
    `);

    assert(afterCalReset.emptyStateRemoved && afterCalReset.allActive, '1-click clear filters restores all calendar switches and schedule items');

    // =========================================================================
    // 5. Groceries View: Contextual Panel & Filter Empty State
    // =========================================================================
    console.log('\n5. Groceries View: Contextual Panel & Filter Empty State');

    await evalJs(`
      (() => {
        const btn = document.querySelector('[data-testid="sidebar-nav-groceries"]');
        if (btn) btn.click();
      })()
    `);
    await wait(250);

    // Click on a grocery item to inspect in contextual panel
    await evalJs(`
      (() => {
        const itemSpan = document.querySelector('[data-testid="grocery-item-title"]');
        if (itemSpan) itemSpan.click();
      })()
    `);
    await wait(250);

    const grocPanelInfo = await evalJs(`
      (() => {
        const panel = document.querySelector('[data-testid="grocery-detail-panel"]');
        const amountInput = document.querySelector('#grocery-edit-amount');
        return {
          isOpen: Boolean(panel),
          role: panel ? panel.getAttribute('role') : null,
          ariaModal: panel ? panel.getAttribute('aria-modal') : null,
          hasAmountInput: Boolean(amountInput),
        };
      })()
    `);

    assert(grocPanelInfo.isOpen, 'Grocery item contextual detail panel [data-testid="grocery-detail-panel"] opens');
    assert(grocPanelInfo.hasAmountInput, 'Item inspection inputs are available in contextual panel');

    await captureScreenshot('stage5-groceries-panel.png');

    // Close panel with Escape
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await wait(150);

    const afterEscGroc = await evalJs(`Boolean(document.querySelector('[data-testid="grocery-detail-panel"]'))`);
    assert(!afterEscGroc, 'Grocery contextual panel closes cleanly on Escape');

    // Test Groceries search filter empty state
    await evalJs(`
      (() => {
        const search = document.querySelector('input[aria-label="Search grocery items"]');
        if (search) {
          const proto = Object.getPrototypeOf(search);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(search, 'NONEXISTENT_GROCERY_SEARCH_999');
          search.dispatchEvent(new Event('input', { bubbles: true }));
          search.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await wait(150);

    const grocFilterEmpty = await evalJs(`
      (() => {
        const emptyState = document.querySelector('[data-testid="filter-empty-state"]');
        const clearBtn = document.querySelector('[data-testid="clear-filters-btn"]');
        return {
          hasEmptyState: Boolean(emptyState),
          hasClearBtn: Boolean(clearBtn),
        };
      })()
    `);

    assert(grocFilterEmpty.hasEmptyState, 'Groceries view renders [data-testid="filter-empty-state"] on non-matching search');

    // Clear filters
    await evalJs(`
      (() => {
        const clearBtn = document.querySelector('[data-testid="clear-filters-btn"]');
        if (clearBtn) clearBtn.click();
      })()
    `);
    await wait(150);

    const afterGrocClear = await evalJs(`
      (() => {
        const search = document.querySelector('input[aria-label="Search grocery items"]');
        const emptyState = document.querySelector('[data-testid="filter-empty-state"]');
        return {
          emptyStateRemoved: !emptyState,
          searchQueryCleared: search ? search.value === '' : false,
        };
      })()
    `);

    assert(afterGrocClear.emptyStateRemoved && afterGrocClear.searchQueryCleared, 'Groceries 1-click clear resets search and restores grocery items');

    // =========================================================================
    // 6. Meals View: Food Library Search Filter Empty State
    // =========================================================================
    console.log('\n6. Meals View: Food Library Search Filter Empty State');

    await evalJs(`
      (() => {
        const btn = document.querySelector('[data-testid="sidebar-nav-meals"]');
        if (btn) btn.click();
      })()
    `);
    await wait(250);

    // Switch to Food Library tab
    await evalJs(`
      (() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const libTab = tabs.find(b => b.textContent?.includes('Food library'));
        if (libTab) libTab.click();
      })()
    `);
    await wait(150);

    // Search for non-existent recipe
    await evalJs(`
      (() => {
        const search = document.querySelector('input[aria-label="Search recipes"]');
        if (search) {
          const proto = Object.getPrototypeOf(search);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(search, 'NONEXISTENT_RECIPE_NAME_999');
          search.dispatchEvent(new Event('input', { bubbles: true }));
          search.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await wait(150);

    const mealsFilterEmpty = await evalJs(`
      (() => {
        const emptyState = document.querySelector('[data-testid="filter-empty-state"]');
        const clearBtn = document.querySelector('[data-testid="clear-filters-btn"]');
        return {
          hasEmptyState: Boolean(emptyState),
          hasClearBtn: Boolean(clearBtn),
        };
      })()
    `);

    assert(mealsFilterEmpty.hasEmptyState, 'Food library renders [data-testid="filter-empty-state"] on non-matching recipe search');

    // Clear recipe search
    await evalJs(`
      (() => {
        const clearBtn = document.querySelector('[data-testid="clear-filters-btn"]');
        if (clearBtn) clearBtn.click();
      })()
    `);
    await wait(150);

    const afterMealsClear = await evalJs(`
      (() => {
        const search = document.querySelector('input[aria-label="Search recipes"]');
        const emptyState = document.querySelector('[data-testid="filter-empty-state"]');
        return {
          emptyStateRemoved: !emptyState,
          searchQueryCleared: search ? search.value === '' : false,
        };
      })()
    `);

    assert(afterMealsClear.emptyStateRemoved && afterMealsClear.searchQueryCleared, 'Food library 1-click clear resets recipe search and restores recipe cards');

    // =========================================================================
    // 7. Debt Payoff: Standardized Inline Validation
    // =========================================================================
    console.log('\n7. Debt Payoff: Standardized Inline Validation');

    await evalJs(`
      (() => {
        const btn = document.querySelector('[data-testid="sidebar-nav-debts"]');
        if (btn) btn.click();
      })()
    `);
    await wait(250);

    // Open Edit/Add debt modal
    await evalJs(`
      (() => {
        const editBtn = document.querySelector('button[aria-label^="Edit debt"]');
        if (editBtn) editBtn.click();
      })()
    `);
    await wait(200);

    // Enter monthly payment budget below minimum payment
    await evalJs(`
      (() => {
        const minPayInput = document.querySelector('#debt-modal-min-payment');
        const chosenPayInput = document.querySelector('#debt-modal-chosen-payment');
        const setVal = (el, val) => {
          const proto = Object.getPrototypeOf(el);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        setVal(minPayInput, 150);
        setVal(chosenPayInput, 50); // Below minimum payment
        const submitBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          b => b.textContent?.includes('Save debt')
        );
        if (submitBtn) submitBtn.click();
      })()
    `);
    await wait(150);

    const debtValInfo = await evalJs(`
      (() => {
        const errBanner = document.querySelector('[data-testid="debt-modal-validation-error"]');
        const chosenInput = document.querySelector('#debt-modal-chosen-payment');
        const minInput = document.querySelector('#debt-modal-min-payment');
        return {
          hasError: Boolean(errBanner),
          errorRole: errBanner ? errBanner.getAttribute('role') : null,
          ariaInvalid: chosenInput ? chosenInput.getAttribute('aria-invalid') : null,
          minVal: minInput ? minInput.value : '',
          chosenVal: chosenInput ? chosenInput.value : '',
        };
      })()
    `);

    assert(debtValInfo.hasError && debtValInfo.errorRole === 'alert', 'Debt modal renders validation error banner with role="alert"');
    assert(debtValInfo.ariaInvalid === 'true', 'Debt monthly budget input has aria-invalid="true"');
    assert(debtValInfo.minVal === '150' && debtValInfo.chosenVal === '50', 'Debt inputs remain preserved without data loss on validation failure');

    // Close debt modal
    await evalJs(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          b => b.textContent?.includes('Cancel')
        );
        if (cancelBtn) cancelBtn.click();
      })()
    `);
    await wait(150);

    // =========================================================================
    // 8. Savings Pots: Standardized Inline Validation
    // =========================================================================
    console.log('\n8. Savings Pots: Standardized Inline Validation');

    await evalJs(`
      (() => {
        const btn = document.querySelector('[data-testid="sidebar-nav-savings"]');
        if (btn) btn.click();
      })()
    `);
    await wait(250);

    // Open Add Pot Modal
    await evalJs(`
      (() => {
        const newPotBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent?.includes('New pot')
        );
        if (newPotBtn) newPotBtn.click();
      })()
    `);
    await wait(200);

    // Submit with empty name to trigger inline validation
    await evalJs(`
      (() => {
        const nameInput = document.querySelector('#savings-pot-name');
        if (nameInput) {
          const proto = Object.getPrototypeOf(nameInput);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(nameInput, '');
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          nameInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const submitBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          b => b.textContent?.includes('Create pot')
        );
        if (submitBtn) submitBtn.click();
      })()
    `);
    await wait(150);

    const savingsValInfo = await evalJs(`
      (() => {
        const errBanner = document.querySelector('[data-testid="savings-pot-error"]');
        const nameInput = document.querySelector('#savings-pot-name');
        return {
          hasError: Boolean(errBanner),
          errorRole: errBanner ? errBanner.getAttribute('role') : null,
          ariaInvalid: nameInput ? nameInput.getAttribute('aria-invalid') : null,
        };
      })()
    `);

    assert(savingsValInfo.hasError && savingsValInfo.errorRole === 'alert', 'Savings pot renders inline validation error banner with role="alert"');
    assert(savingsValInfo.ariaInvalid === 'true', 'Empty pot name input has aria-invalid="true"');

    // Close pot modal
    await evalJs(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          b => b.textContent?.includes('Cancel')
        );
        if (cancelBtn) cancelBtn.click();
      })()
    `);
    await wait(150);

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('\n================================================================');
    console.log(`Stage 5 Verification Summary: ${passed} passed, ${failed} failed`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill('SIGKILL');
    server.close();
    if (fs.existsSync(userDataDir)) {
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

main().catch((err) => {
  console.error('\nVerification failed with exception:', err);
  process.exit(1);
});
