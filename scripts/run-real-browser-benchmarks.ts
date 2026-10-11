import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import child_process from 'node:child_process';
import express from 'express';

import {
  SAMPLE_TASKS,
  SAMPLE_ROUTINES,
  SAMPLE_GOALS,
  SAMPLE_HABITS,
  SAMPLE_BRAIN_DUMP,
  SAMPLE_TRANSACTIONS,
  SAMPLE_BILLS,
  SAMPLE_SAVINGS_POTS,
  SAMPLE_DEBTS,
  SAMPLE_RECIPES,
  SAMPLE_PLANNED_MEALS,
  SAMPLE_GROCERIES,
  SAMPLE_WORKOUTS,
  SAMPLE_WEIGHT_PROFILES,
  SAMPLE_WEIGHT_RECORDS,
  SAMPLE_HYDRATION_LOG,
  SAMPLE_HYDRATION_TARGETS,
  SAMPLE_CALENDAR_EVENTS,
  INITIAL_SETTINGS,
} from '../src/utils/sampleData';

import type {
  PlannerBackupData,
  TaskItem,
  FinancialTransaction,
  WorkoutSession,
  WeightRecord,
  HydrationLogEntry,
  CalendarEvent,
} from '../src/types/planner';

const PORT = 5059;
const APP_URL = `http://127.0.0.1:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// 1. Build Full Sample Backup
const fullSampleBackup: PlannerBackupData = {
  version: '1.0.0',
  exportedAt: new Date().toISOString(),
  revision: 1,
  settings: INITIAL_SETTINGS,
  tasks: SAMPLE_TASKS,
  routines: SAMPLE_ROUTINES,
  goals: SAMPLE_GOALS,
  habits: SAMPLE_HABITS,
  inbox: SAMPLE_BRAIN_DUMP,
  transactions: SAMPLE_TRANSACTIONS,
  bills: SAMPLE_BILLS,
  savingsPots: SAMPLE_SAVINGS_POTS,
  debts: SAMPLE_DEBTS,
  recipes: SAMPLE_RECIPES,
  plannedMeals: SAMPLE_PLANNED_MEALS,
  groceries: SAMPLE_GROCERIES,
  workouts: SAMPLE_WORKOUTS,
  weightProfiles: SAMPLE_WEIGHT_PROFILES,
  weightRecords: SAMPLE_WEIGHT_RECORDS,
  hydrationEntries: SAMPLE_HYDRATION_LOG,
  hydrationTargets: SAMPLE_HYDRATION_TARGETS,
  calendarEvents: SAMPLE_CALENDAR_EVENTS,
  weeklyReviews: [],
};

// 2. Build Stress Backup (1,000 tasks, 1,000 transactions, 3,045 records total)
const generatedTasks: TaskItem[] = [];
for (let i = 1; i <= 1000; i++) {
  const d = new Date(2026, 9, 1 + (i % 60));
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  generatedTasks.push({
    id: `stress-task-${i}`,
    title: `Task #${i}: Project milestone and deliverable review`,
    description: `Detailed task description #${i} with notes.`,
    category: 'Work',
    assignedTo: 'Rida',
    priority: i % 5 === 0 ? 'urgent' : i % 3 === 0 ? 'high' : 'medium',
    status: i % 4 === 0 ? 'completed' : 'not_started',
    dueDate: dateStr,
    createdAt: '2026-09-01T00:00:00.000Z',
  });
}

const generatedTransactions: FinancialTransaction[] = [...SAMPLE_TRANSACTIONS];
for (let i = 1; i <= 1000 - SAMPLE_TRANSACTIONS.length; i++) {
  const d = new Date(2026, 8 + (i % 3), 1 + (i % 28));
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  generatedTransactions.push({
    id: `stress-tx-${i}`,
    type: i % 5 === 0 ? 'income' : 'expense',
    category: i % 2 === 0 ? 'Groceries' : 'Utilities',
    amount: 35.75 + (i % 100),
    date: dateStr,
    note: `Automated transaction item #${i}`,
    linkedBillId: i % 50 === 0 ? 'b-1' : undefined,
  });
}

const generatedWorkouts: WorkoutSession[] = [];
for (let i = 1; i <= 250; i++) {
  const d = new Date(2026, 8 + (i % 3), 1 + (i % 28));
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  generatedWorkouts.push({
    id: `stress-wo-${i}`,
    date: dateStr,
    title: `Workout Session #${i} - Strength`,
    durationMinutes: 50,
    muscleGroups: ['Chest', 'Shoulders'],
    isCompleted: true,
    exercises: [
      {
        id: `ex-1-${i}`,
        name: 'Barbell Bench Press',
        sets: [
          { setNumber: 1, reps: 10, restSeconds: 60, isCompleted: true, weightKg: 65, weightUnit: 'kg' },
        ],
      },
    ],
  });
}

const generatedWeightRecords: WeightRecord[] = [];
for (let i = 1; i <= 250; i++) {
  const d = new Date(2026, 8 + (i % 3), 1 + (i % 28));
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  generatedWeightRecords.push({
    id: `stress-wr-${i}`,
    profileId: 'wp-1',
    date: dateStr,
    weightKg: 72.5 + (i % 20) * 0.1,
    unit: 'kg',
  });
}

const generatedHydration: HydrationLogEntry[] = [];
for (let i = 1; i <= 350; i++) {
  const d = new Date(2026, 8 + (i % 3), 1 + (i % 28));
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  generatedHydration.push({
    id: `stress-hy-${i}`,
    date: dateStr,
    amountMl: 250,
    time: '10:00',
  });
}

const generatedEvents: CalendarEvent[] = [];
for (let i = 1; i <= 150; i++) {
  const d = new Date(2026, 9, 1 + (i % 30));
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  generatedEvents.push({
    id: `stress-ce-${i}`,
    title: `Calendar Event #${i}: Project sync`,
    date: dateStr,
    isAllDay: false,
    type: 'event',
    category: 'Work',
  });
}

const stressBackup: PlannerBackupData = {
  version: '1.0.0',
  exportedAt: new Date().toISOString(),
  revision: 100,
  settings: INITIAL_SETTINGS,
  tasks: generatedTasks,
  routines: SAMPLE_ROUTINES,
  goals: SAMPLE_GOALS,
  habits: SAMPLE_HABITS,
  inbox: SAMPLE_BRAIN_DUMP,
  transactions: generatedTransactions,
  bills: SAMPLE_BILLS,
  savingsPots: SAMPLE_SAVINGS_POTS,
  debts: SAMPLE_DEBTS,
  recipes: SAMPLE_RECIPES,
  plannedMeals: SAMPLE_PLANNED_MEALS,
  groceries: SAMPLE_GROCERIES,
  workouts: generatedWorkouts,
  weightProfiles: SAMPLE_WEIGHT_PROFILES,
  weightRecords: generatedWeightRecords,
  hydrationEntries: generatedHydration,
  hydrationTargets: SAMPLE_HYDRATION_TARGETS,
  calendarEvents: generatedEvents,
  weeklyReviews: [],
};

const sampleDataJson = JSON.stringify(fullSampleBackup);
const sampleSettingsJson = JSON.stringify(fullSampleBackup.settings);
const stressDataJson = JSON.stringify(stressBackup);
const stressSettingsJson = JSON.stringify(stressBackup.settings);

// Chrome Client helper
class ChromeSession {
  private proc: child_process.ChildProcess | null = null;
  private profileDir: string;
  private ws: WebSocket | null = null;
  private msgId = 1;
  private pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

  constructor() {
    this.profileDir = path.join(os.tmpdir(), `chrome-bench-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  }

  async start(extraFlags: string[] = []) {
    this.proc = child_process.spawn(CHROME_PATH, [
      '--headless=new',
      '--remote-debugging-port=9222',
      `--user-data-dir=${this.profileDir}`,
      '--no-sandbox',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      ...extraFlags,
      'about:blank',
    ]);

    // Wait for CDP to respond
    let connected = false;
    for (let attempts = 0; attempts < 30; attempts++) {
      await new Promise((r) => setTimeout(r, 100));
      try {
        const res = await fetch('http://127.0.0.1:9222/json/version');
        if (res.ok) {
          connected = true;
          break;
        }
      } catch (e) {}
    }
    if (!connected) throw new Error('Chrome failed to start CDP');

    // Create a target
    const putRes = await fetch('http://127.0.0.1:9222/json/new', { method: 'PUT' });
    const target = await putRes.json();
    this.ws = new WebSocket(target.webSocketDebuggerUrl);

    await new Promise((resolve) => {
      this.ws!.onopen = resolve;
    });

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data.toString());
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      } catch (e) {}
    };

    // Enable Page and Runtime
    await this.send('Page.enable');
    await this.send('Runtime.enable');
  }

  send(method: string, params: any = {}): Promise<any> {
    const id = this.msgId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression: string): Promise<any> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${res.exceptionDetails.text} (${JSON.stringify(res.exceptionDetails)})`);
    }
    return res.result?.value;
  }

  async close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    if (this.proc) {
      this.proc.kill('SIGKILL');
      await new Promise((r) => setTimeout(r, 600));
    }
    try {
      fs.rmSync(this.profileDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

// Injected observer code for longtasks, storage writes, and paint timings
const INJECTED_OBSERVER = `
window.__olpMetrics = {
  longTasks: [],
  storageWrites: [],
};
try {
  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      window.__olpMetrics.longTasks.push({
        duration: entry.duration,
        startTime: entry.startTime,
        name: entry.name,
      });
    }
  });
  obs.observe({ type: 'longtask', buffered: true });
} catch (e) {}

const origSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key, val) {
  const t0 = performance.now();
  origSetItem(key, val);
  const dur = performance.now() - t0;
  window.__olpMetrics.storageWrites.push({
    key,
    bytes: typeof val === 'string' ? val.length : 0,
    durationMs: dur,
    timestamp: performance.now(),
  });
};
`;

async function runBenchmarkSuite() {
  console.log('=====================================================');
  console.log('STARTING FOCUSED PERFORMANCE VERIFICATION & SUITE');
  console.log('=====================================================');

  // Start express server
  const app = express();
  app.use(express.static('dist'));
  const server = app.listen(PORT, '127.0.0.1');
  console.log(`Express server serving dist/ on ${APP_URL}`);

  try {
    // -------------------------------------------------------------
    // PART 1: Task Completion & Persistence Verification Across Reload
    // -------------------------------------------------------------
    console.log('\n--- 1. Task Completion & Persistence Verification Across Reload ---');
    {
      const session = new ChromeSession();
      await session.start();

      // Seed stress dataset into localStorage
      await session.send('Page.addScriptToEvaluateOnNewDocument', { source: INJECTED_OBSERVER });
      const seedScriptId = await session.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `
          localStorage.setItem('our_life_planner_data_v1', ${JSON.stringify(stressDataJson)});
          localStorage.setItem('our_life_planner_settings_v1', ${JSON.stringify(stressSettingsJson)});
        `,
      });

      await session.send('Page.navigate', { url: APP_URL });
      await new Promise((r) => setTimeout(r, 1200));

      // Check initial task state
      const initialTaskStatus = await session.evaluate(`
        (() => {
          const raw = localStorage.getItem('our_life_planner_data_v1');
          const data = JSON.parse(raw);
          const t1 = data.tasks.find(t => t.id === 'stress-task-1');
          return t1 ? t1.status : 'not_found';
        })()
      `);
      console.log(`  Initial stress-task-1 status in storage: ${initialTaskStatus}`);

      // Click Tasks navigation tab
      await session.evaluate(`
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Tasks'));
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 600));

      // Clear recorded storage writes before toggle
      await session.evaluate(`window.__olpMetrics.storageWrites = [];`);

      // Toggle first task completion
      const toggleResult = await session.evaluate(`
        (() => {
          const chk = document.querySelector('table tbody tr button[role="checkbox"]');
          if (chk) {
            chk.click();
            return { clicked: true, ariaChecked: chk.getAttribute('aria-checked') };
          }
          return { clicked: false };
        })()
      `);
      console.log(`  Toggle button clicked:`, toggleResult);

      // Wait for React state commit and auto-save (triggerSave) to finish
      await new Promise((r) => setTimeout(r, 500));

      const writesRecorded = await session.evaluate(`window.__olpMetrics.storageWrites`);
      console.log(`  Storage writes recorded during task toggle: ${writesRecorded.length}`);
      if (writesRecorded.length > 0) {
        console.log(`    Wrote key: ${writesRecorded[0].key}, bytes: ${writesRecorded[0].bytes}, duration: ${writesRecorded[0].durationMs.toFixed(2)}ms`);
      }

      const statusAfterToggle = await session.evaluate(`
        (() => {
          const raw = localStorage.getItem('our_life_planner_data_v1');
          const data = JSON.parse(raw);
          const t1 = data.tasks.find(t => t.id === 'stress-task-1');
          return t1 ? t1.status : 'not_found';
        })()
      `);
      console.log(`  Status in storage after toggle: ${statusAfterToggle}`);

      // Remove seed script identifier before reload so reload tests actual localStorage persistence
      await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seedScriptId.identifier });

      // Now RELOAD the page
      console.log('  Reloading page to verify persistence...');
      await session.send('Page.navigate', { url: APP_URL });
      await new Promise((r) => setTimeout(r, 1200));

      // Navigate back to Tasks
      await session.evaluate(`
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Tasks'));
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 600));

      const statusAfterReload = await session.evaluate(`
        (() => {
          const raw = localStorage.getItem('our_life_planner_data_v1');
          const data = JSON.parse(raw);
          const t1 = data.tasks.find(t => t.id === 'stress-task-1');
          const chk = document.querySelector('table tbody tr button[role="checkbox"]');
          return {
            storedStatus: t1 ? t1.status : 'not_found',
            domAriaChecked: chk ? chk.getAttribute('aria-checked') : 'no_dom',
          };
        })()
      `);
      console.log(`  Verification after reload:`, statusAfterReload);

      await session.close();
    }

    // -------------------------------------------------------------
    // PART 2: Desktop Benchmarks (5 repetitions each)
    // -------------------------------------------------------------
    console.log('\n--- 2. Desktop Benchmarks (5 repetitions, Unthrottled, 1280x800) ---');
    const desktopResults: any = {
      sample: { tasksNav: [], searchKeyLatency: [] },
      stress: { tasksNav: [], searchKeyLatency: [] },
    };

    // Desktop Stress Runs
    for (let run = 1; run <= 5; run++) {
      const session = new ChromeSession();
      await session.start();
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 800,
        deviceScaleFactor: 1,
        mobile: false,
      });

      await session.send('Page.addScriptToEvaluateOnNewDocument', { source: INJECTED_OBSERVER });
      await session.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `
          localStorage.setItem('our_life_planner_data_v1', ${JSON.stringify(stressDataJson)});
          localStorage.setItem('our_life_planner_settings_v1', ${JSON.stringify(stressSettingsJson)});
        `,
      });

      await session.send('Page.navigate', { url: APP_URL });
      await new Promise((r) => setTimeout(r, 1200));

      // Measure Tasks navigation
      await session.evaluate(`window.__olpMetrics.longTasks = [];`);
      const navMetrics = await session.evaluate(`
        new Promise((resolve) => {
          const t0 = performance.now();
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Tasks'));
          btn.click();
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const dur = performance.now() - t0;
              const domRows = document.querySelectorAll('table tbody tr').length;
              resolve({ durationMs: dur, domRows, longTasks: window.__olpMetrics.longTasks });
            });
          });
        })
      `);
      desktopResults.stress.tasksNav.push(navMetrics);
      console.log(`  Desktop Stress Run #${run} Tasks Nav: ${navMetrics.durationMs.toFixed(1)}ms, DOM Rows: ${navMetrics.domRows}, LongTasks: ${navMetrics.longTasks.length}`);

      // Measure Search Typing
      // Open search modal
      await session.evaluate(`
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') && b.getAttribute('aria-label').includes('Search'));
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 300));

      await session.evaluate(`window.__olpMetrics.longTasks = [];`);
      const searchMetrics = await session.evaluate(`
        new Promise((resolve) => {
          const input = document.querySelector('input[placeholder*="search" i], input[placeholder*="Search" i]');
          if (!input) return resolve({ error: 'input_not_found' });
          const chars = 'milestone'.split('');
          const latencies = [];
          let idx = 0;

          function typeNext() {
            if (idx >= chars.length) {
              const items = document.querySelectorAll('div[aria-live="polite"] button[aria-selected]').length;
              const showMore = !!Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('more'));
              return resolve({
                latencies,
                renderedItems: items,
                hasShowMoreButton: showMore,
                longTasks: window.__olpMetrics.longTasks
              });
            }
            const char = chars[idx++];
            const t0 = performance.now();
            input.value += char;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                latencies.push(Number((performance.now() - t0).toFixed(1)));
                setTimeout(typeNext, 20);
              });
            });
          }
          typeNext();
        })
      `);
      desktopResults.stress.searchKeyLatency.push(searchMetrics);
      const medianKey = searchMetrics.latencies ? searchMetrics.latencies.slice().sort((a: number, b: number) => a - b)[Math.floor(searchMetrics.latencies.length / 2)] : 0;
      console.log(`  Desktop Stress Run #${run} Search: Median Key Latency: ${medianKey}ms, LongTasks: ${searchMetrics.longTasks?.length}`);

      await session.close();
    }

    // Desktop Sample Runs
    for (let run = 1; run <= 5; run++) {
      const session = new ChromeSession();
      await session.start();
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 800,
        deviceScaleFactor: 1,
        mobile: false,
      });

      await session.send('Page.addScriptToEvaluateOnNewDocument', { source: INJECTED_OBSERVER });
      await session.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `
          localStorage.setItem('our_life_planner_data_v1', ${JSON.stringify(sampleDataJson)});
          localStorage.setItem('our_life_planner_settings_v1', ${JSON.stringify(sampleSettingsJson)});
        `,
      });

      await session.send('Page.navigate', { url: APP_URL });
      await new Promise((r) => setTimeout(r, 1200));

      // Measure Tasks navigation
      await session.evaluate(`window.__olpMetrics.longTasks = [];`);
      const navMetrics = await session.evaluate(`
        new Promise((resolve) => {
          const t0 = performance.now();
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Tasks'));
          btn.click();
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const dur = performance.now() - t0;
              const domRows = document.querySelectorAll('table tbody tr').length;
              resolve({ durationMs: dur, domRows, longTasks: window.__olpMetrics.longTasks });
            });
          });
        })
      `);
      desktopResults.sample.tasksNav.push(navMetrics);

      // Open Search modal
      await session.evaluate(`
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') && b.getAttribute('aria-label').includes('Search'));
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 300));

      await session.evaluate(`window.__olpMetrics.longTasks = [];`);
      const searchMetrics = await session.evaluate(`
        new Promise((resolve) => {
          const input = document.querySelector('input[placeholder*="search" i], input[placeholder*="Search" i]');
          if (!input) return resolve({ error: 'input_not_found' });
          const chars = 'milestone'.split('');
          const latencies = [];
          let idx = 0;

          function typeNext() {
            if (idx >= chars.length) {
              return resolve({ latencies, longTasks: window.__olpMetrics.longTasks });
            }
            const char = chars[idx++];
            const t0 = performance.now();
            input.value += char;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                latencies.push(Number((performance.now() - t0).toFixed(1)));
                setTimeout(typeNext, 20);
              });
            });
          }
          typeNext();
        })
      `);
      desktopResults.sample.searchKeyLatency.push(searchMetrics);
      await session.close();
    }

    // -------------------------------------------------------------
    // PART 3: Simulated Mobile Benchmarks (4x CPU slowdown, 390x844)
    // -------------------------------------------------------------
    console.log('\n--- 3. Simulated Mobile Benchmarks (4x CPU slowdown, Viewport 390x844) ---');
    const mobileResults: any = {
      sample: { tasksNav: [], searchKeyLatency: [] },
      stress: { tasksNav: [], searchKeyLatency: [] },
    };

    // Mobile Stress Runs
    for (let run = 1; run <= 5; run++) {
      const session = new ChromeSession();
      await session.start();
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        mobile: true,
      });
      await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });

      await session.send('Page.addScriptToEvaluateOnNewDocument', { source: INJECTED_OBSERVER });
      await session.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `
          localStorage.setItem('our_life_planner_data_v1', ${JSON.stringify(stressDataJson)});
          localStorage.setItem('our_life_planner_settings_v1', ${JSON.stringify(stressSettingsJson)});
        `,
      });

      await session.send('Page.navigate', { url: APP_URL });
      await new Promise((r) => setTimeout(r, 1500));

      // Mobile Tasks navigation via bottom nav
      await session.evaluate(`window.__olpMetrics.longTasks = [];`);
      const navMetrics = await session.evaluate(`
        new Promise((resolve) => {
          const t0 = performance.now();
          const btn = Array.from(document.querySelectorAll('nav button, button')).find(b => b.textContent && b.textContent.includes('Tasks'));
          btn.click();
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const dur = performance.now() - t0;
              const cards = document.querySelectorAll('div.md\\\\:hidden > div.p-3').length;
              resolve({ durationMs: dur, renderedCards: cards, longTasks: window.__olpMetrics.longTasks });
            });
          });
        })
      `);
      mobileResults.stress.tasksNav.push(navMetrics);
      console.log(`  Simulated Mobile Stress Run #${run} Tasks Nav: ${navMetrics.durationMs.toFixed(1)}ms, Cards: ${navMetrics.renderedCards}, LongTasks: ${navMetrics.longTasks.length}`);

      // Open Search modal on mobile
      await session.evaluate(`
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') && b.getAttribute('aria-label').includes('Search'));
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 500));

      await session.evaluate(`window.__olpMetrics.longTasks = [];`);
      const searchMetrics = await session.evaluate(`
        new Promise((resolve) => {
          const input = document.querySelector('input[placeholder*="search" i], input[placeholder*="Search" i]');
          if (!input) return resolve({ error: 'input_not_found' });
          const chars = 'milestone'.split('');
          const latencies = [];
          let idx = 0;

          function typeNext() {
            if (idx >= chars.length) {
              return resolve({ latencies, longTasks: window.__olpMetrics.longTasks });
            }
            const char = chars[idx++];
            const t0 = performance.now();
            input.value += char;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                latencies.push(Number((performance.now() - t0).toFixed(1)));
                setTimeout(typeNext, 30);
              });
            });
          }
          typeNext();
        })
      `);
      mobileResults.stress.searchKeyLatency.push(searchMetrics);
      const medianKey = searchMetrics.latencies ? searchMetrics.latencies.slice().sort((a: number, b: number) => a - b)[Math.floor(searchMetrics.latencies.length / 2)] : 0;
      console.log(`  Simulated Mobile Stress Run #${run} Search: Median Key Latency: ${medianKey}ms, LongTasks: ${searchMetrics.longTasks?.length}`);

      await session.close();
    }

    // Mobile Sample Runs
    for (let run = 1; run <= 5; run++) {
      const session = new ChromeSession();
      await session.start();
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        mobile: true,
      });
      await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });

      await session.send('Page.addScriptToEvaluateOnNewDocument', { source: INJECTED_OBSERVER });
      await session.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `
          localStorage.setItem('our_life_planner_data_v1', ${JSON.stringify(sampleDataJson)});
          localStorage.setItem('our_life_planner_settings_v1', ${JSON.stringify(sampleSettingsJson)});
        `,
      });

      await session.send('Page.navigate', { url: APP_URL });
      await new Promise((r) => setTimeout(r, 1500));

      await session.evaluate(`window.__olpMetrics.longTasks = [];`);
      const navMetrics = await session.evaluate(`
        new Promise((resolve) => {
          const t0 = performance.now();
          const btn = Array.from(document.querySelectorAll('nav button, button')).find(b => b.textContent && b.textContent.includes('Tasks'));
          btn.click();
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve({ durationMs: performance.now() - t0, longTasks: window.__olpMetrics.longTasks });
            });
          });
        })
      `);
      mobileResults.sample.tasksNav.push(navMetrics);

      await session.evaluate(`
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') && b.getAttribute('aria-label').includes('Search'));
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 500));

      await session.evaluate(`window.__olpMetrics.longTasks = [];`);
      const searchMetrics = await session.evaluate(`
        new Promise((resolve) => {
          const input = document.querySelector('input[placeholder*="search" i], input[placeholder*="Search" i]');
          if (!input) return resolve({ error: 'input_not_found' });
          const chars = 'milestone'.split('');
          const latencies = [];
          let idx = 0;

          function typeNext() {
            if (idx >= chars.length) {
              return resolve({ latencies, longTasks: window.__olpMetrics.longTasks });
            }
            const char = chars[idx++];
            const t0 = performance.now();
            input.value += char;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                latencies.push(Number((performance.now() - t0).toFixed(1)));
                setTimeout(typeNext, 30);
              });
            });
          }
          typeNext();
        })
      `);
      mobileResults.sample.searchKeyLatency.push(searchMetrics);
      await session.close();
    }

    // Save benchmark output artifacts
    const finalReport = {
      executedAt: new Date().toISOString(),
      platform: {
        os: 'Windows 10 / 11 x64',
        hardware: `${os.cpus().length} CPUs (${os.cpus()[0]?.model}), ${(os.totalmem() / 1e9).toFixed(1)} GB RAM`,
        browser: 'Chrome 154 (CDP headless)',
      },
      datasets: {
        sampleRecords: 86,
        stressRecords: 3045,
        stressTasks: 1000,
      },
      desktopResults,
      mobileResults,
    };

    fs.writeFileSync('artifacts/benchmark-real-browser-results.json', JSON.stringify(finalReport, null, 2), 'utf-8');
    fs.writeFileSync('public/measurement-artifacts/benchmark-real-browser-results.json', JSON.stringify(finalReport, null, 2), 'utf-8');
    console.log('\n✅ Successfully wrote artifacts/benchmark-real-browser-results.json');
  } finally {
    server.close();
    console.log('Server stopped.');
  }
}

runBenchmarkSuite().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
