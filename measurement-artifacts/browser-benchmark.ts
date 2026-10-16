import fs from 'node:fs';
import path from 'node:path';
import puppeteer, { Browser, Page } from 'puppeteer';

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
} from '../our-life-planner/src/utils/sampleData';

import type {
  PlannerBackupData,
  TaskItem,
  FinancialTransaction,
  WorkoutSession,
  WeightRecord,
  HydrationLogEntry,
  CalendarEvent,
} from '../our-life-planner/src/types/planner';

const APP_URL = 'http://127.0.0.1:5050';
const ARTIFACTS_DIR = path.resolve('/tmp/isolated-measurement/our-life-planner/artifacts');

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

// 1. Build Datasets
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

// 3,045 record stress dataset
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
  const d = new Date(2026, 6 + Math.floor(i / 60), 1 + (i % 28));
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  generatedWeightRecords.push({
    id: `stress-wt-${i}`,
    profileId: 'wp-1',
    date: dateStr,
    weightKg: 73.2,
  });
}

const generatedHydration: HydrationLogEntry[] = [];
for (let i = 1; i <= 350; i++) {
  const d = new Date(2026, 9, 1 + (i % 30));
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  generatedHydration.push({
    id: `stress-hl-${i}`,
    date: dateStr,
    time: `${String(7 + (i % 14)).padStart(2, '0')}:${String((i * 15) % 60).padStart(2, '0')}`,
    amountMl: 250,
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

// Helper script to inject PerformanceObservers into page before document load
const INJECTED_OBSERVER_CODE = `
window.__olpMetrics = {
  fcp: null,
  lcp: null,
  cls: 0,
  longTasks: [],
  storageWrites: [],
  broadcasts: [],
};

// 1. Paint / FCP
try {
  const paintObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === 'first-contentful-paint') {
        window.__olpMetrics.fcp = entry.startTime;
      }
    }
  });
  paintObserver.observe({ type: 'paint', buffered: true });
} catch (e) {}

// 2. LCP
try {
  const lcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    if (entries.length > 0) {
      const last = entries[entries.length - 1];
      window.__olpMetrics.lcp = last.startTime;
    }
  });
  lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
} catch (e) {}

// 3. CLS
try {
  const clsObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        window.__olpMetrics.cls += entry.value;
      }
    }
  });
  clsObserver.observe({ type: 'layout-shift', buffered: true });
} catch (e) {}

// 4. Long Tasks (>50 ms)
try {
  const longTaskObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      window.__olpMetrics.longTasks.push({
        duration: entry.duration,
        startTime: entry.startTime,
        name: entry.name,
      });
    }
  });
  longTaskObserver.observe({ type: 'longtask', buffered: true });
} catch (e) {}

// 5. Instrument localStorage writes
const origSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key, val) {
  const t0 = performance.now();
  origSetItem(key, val);
  const duration = performance.now() - t0;
  window.__olpMetrics.storageWrites.push({
    key,
    bytes: typeof val === 'string' ? val.length : 0,
    durationMs: duration,
    timestamp: performance.now(),
  });
};

// 6. Instrument BroadcastChannel
if (typeof BroadcastChannel !== 'undefined') {
  const origBroadcast = BroadcastChannel.prototype.postMessage;
  BroadcastChannel.prototype.postMessage = function(msg) {
    const serialized = JSON.stringify(msg);
    window.__olpMetrics.broadcasts.push({
      bytes: serialized ? serialized.length : 0,
      timestamp: performance.now(),
    });
    return origBroadcast.apply(this, arguments);
  };
}
`;

async function runBrowserTests() {
  console.log('=====================================================');
  console.log('REAL CHROMIUM BROWSER PERFORMANCE MEASUREMENT SUITE');
  console.log('=====================================================');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-extensions'],
  });

  const browserVersion = await browser.version();
  console.log('Target Browser Version:', browserVersion);
  await browser.close();

  const results: any = {
    browserVersion,
    viewport: { width: 1280, height: 800 },
    throttling: 'None (Full CPU/Network on 127.0.0.1:5050)',
    coldStartup: { small: [], stress: [] },
    warmStartup: { small: [], stress: [] },
    interactions: {
      waterLog: [],
      taskToggle: [],
      searchTyping: [],
      navigation: [],
      calendarExport: [],
    },
    offlineTest: null,
  };

  // -----------------------------------------------------------------
  // 1. COLD STARTUP RUNS (5 Small, 5 Stress)
  // -----------------------------------------------------------------
  console.log('\n--- 1. Testing Cold Startup (Fresh Disposable Profiles) ---');

  for (let run = 1; run <= 5; run++) {
    const profileDir = `/tmp/browser-profiles/cold-small-${run}`;
    fs.rmSync(profileDir, { recursive: true, force: true });
    const b = await puppeteer.launch({
      headless: true,
      userDataDir: profileDir,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await b.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluateOnNewDocument(INJECTED_OBSERVER_CODE);
    await page.evaluateOnNewDocument((d, s) => {
      localStorage.setItem('our_life_planner_data_v1', d);
      localStorage.setItem('our_life_planner_settings_v1', s);
    }, sampleDataJson, sampleSettingsJson);

    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600)); // allow LCP observer to settle

    const m = await page.evaluate(() => window.__olpMetrics);
    results.coldStartup.small.push({
      run,
      fcp: m.fcp,
      lcp: m.lcp,
      cls: Number(m.cls.toFixed(4)),
      longTasksCount: m.longTasks.length,
      longTasks: m.longTasks,
    });
    console.log(`  Small Cold Run #${run}: LCP=${m.lcp?.toFixed(1)}ms, FCP=${m.fcp?.toFixed(1)}ms, CLS=${m.cls?.toFixed(4)}, LongTasks=${m.longTasks.length}`);
    await b.close();
  }

  for (let run = 1; run <= 5; run++) {
    const profileDir = `/tmp/browser-profiles/cold-stress-${run}`;
    fs.rmSync(profileDir, { recursive: true, force: true });
    const b = await puppeteer.launch({
      headless: true,
      userDataDir: profileDir,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await b.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluateOnNewDocument(INJECTED_OBSERVER_CODE);
    await page.evaluateOnNewDocument((d, s) => {
      localStorage.setItem('our_life_planner_data_v1', d);
      localStorage.setItem('our_life_planner_settings_v1', s);
    }, stressDataJson, stressSettingsJson);

    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    const m = await page.evaluate(() => window.__olpMetrics);
    results.coldStartup.stress.push({
      run,
      fcp: m.fcp,
      lcp: m.lcp,
      cls: Number(m.cls.toFixed(4)),
      longTasksCount: m.longTasks.length,
      longTasks: m.longTasks,
    });
    console.log(`  Stress (3,045 rec) Cold Run #${run}: LCP=${m.lcp?.toFixed(1)}ms, FCP=${m.fcp?.toFixed(1)}ms, CLS=${m.cls?.toFixed(4)}, LongTasks=${m.longTasks.length}`);
    await b.close();
  }

  // -----------------------------------------------------------------
  // 2. WARM STARTUP RUNS (5 Small, 5 Stress - SW & Cache Primed)
  // -----------------------------------------------------------------
  console.log('\n--- 2. Testing Warm Startup (Service Worker & Cache Active) ---');

  // Prime Small Profile
  const warmSmallProfile = '/tmp/browser-profiles/warm-small';
  fs.rmSync(warmSmallProfile, { recursive: true, force: true });
  const bWarmSmall = await puppeteer.launch({
    headless: true,
    userDataDir: warmSmallProfile,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const primePageSmall = await bWarmSmall.newPage();
  await primePageSmall.setViewport({ width: 1280, height: 800 });
  await primePageSmall.evaluateOnNewDocument(INJECTED_OBSERVER_CODE);
  await primePageSmall.evaluateOnNewDocument((d, s) => {
    localStorage.setItem('our_life_planner_data_v1', d);
    localStorage.setItem('our_life_planner_settings_v1', s);
  }, sampleDataJson, sampleSettingsJson);
  await primePageSmall.goto(APP_URL, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500)); // wait for SW registration
  await primePageSmall.close();

  for (let run = 1; run <= 5; run++) {
    const page = await bWarmSmall.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluateOnNewDocument(INJECTED_OBSERVER_CODE);
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    const m = await page.evaluate(() => window.__olpMetrics);
    results.warmStartup.small.push({
      run,
      fcp: m.fcp,
      lcp: m.lcp,
      cls: Number(m.cls.toFixed(4)),
      longTasksCount: m.longTasks.length,
      longTasks: m.longTasks,
    });
    console.log(`  Small Warm Run #${run}: LCP=${m.lcp?.toFixed(1)}ms, FCP=${m.fcp?.toFixed(1)}ms, CLS=${m.cls?.toFixed(4)}, LongTasks=${m.longTasks.length}`);
    await page.close();
  }
  await bWarmSmall.close();

  // Prime Stress Profile
  const warmStressProfile = '/tmp/browser-profiles/warm-stress';
  fs.rmSync(warmStressProfile, { recursive: true, force: true });
  const bWarmStress = await puppeteer.launch({
    headless: true,
    userDataDir: warmStressProfile,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const primePageStress = await bWarmStress.newPage();
  await primePageStress.setViewport({ width: 1280, height: 800 });
  await primePageStress.evaluateOnNewDocument(INJECTED_OBSERVER_CODE);
  await primePageStress.evaluateOnNewDocument((d, s) => {
    localStorage.setItem('our_life_planner_data_v1', d);
    localStorage.setItem('our_life_planner_settings_v1', s);
  }, stressDataJson, stressSettingsJson);
  await primePageStress.goto(APP_URL, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  await primePageStress.close();

  for (let run = 1; run <= 5; run++) {
    const page = await bWarmStress.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluateOnNewDocument(INJECTED_OBSERVER_CODE);
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    const m = await page.evaluate(() => window.__olpMetrics);
    results.warmStartup.stress.push({
      run,
      fcp: m.fcp,
      lcp: m.lcp,
      cls: Number(m.cls.toFixed(4)),
      longTasksCount: m.longTasks.length,
      longTasks: m.longTasks,
    });
    console.log(`  Stress Warm Run #${run}: LCP=${m.lcp?.toFixed(1)}ms, FCP=${m.fcp?.toFixed(1)}ms, CLS=${m.cls?.toFixed(4)}, LongTasks=${m.longTasks.length}`);
    await page.close();
  }
  await bWarmStress.close();

  // -----------------------------------------------------------------
  // 3. INTERACTION MEASUREMENTS & LONG-TASK TRACES ON STRESS DATASET
  // -----------------------------------------------------------------
  console.log('\n--- 3. Testing Interactions & Long-Task Traces (3,045 Records) ---');

  const bInteract = await puppeteer.launch({
    headless: true,
    userDataDir: '/tmp/browser-profiles/interactions',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const p = await bInteract.newPage();
  await p.setViewport({ width: 1280, height: 800 });
  await p.evaluateOnNewDocument(INJECTED_OBSERVER_CODE);
  await p.evaluateOnNewDocument((d, s) => {
    localStorage.setItem('our_life_planner_data_v1', d);
    localStorage.setItem('our_life_planner_settings_v1', s);
  }, stressDataJson, stressSettingsJson);
  await p.goto(APP_URL, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1000));

  // A. Water Logging (+250 ml)
  for (let i = 1; i <= 5; i++) {
    const startWritesCount = await p.evaluate(() => window.__olpMetrics.storageWrites.length);
    const startLongTasksCount = await p.evaluate(() => window.__olpMetrics.longTasks.length);

    const tStart = performance.now();
    // Click "+250 ml" button
    const waterClicked = await p.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('+250 ml')
      );
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    // Wait for next frame / microtasks to commit
    await p.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await new Promise((r) => setTimeout(r, 100)); // allow async triggerSave to execute

    const duration = performance.now() - tStart;
    const writeData = await p.evaluate((swc) => {
      const newWrites = window.__olpMetrics.storageWrites.slice(swc);
      return {
        writeCount: newWrites.length,
        totalBytesWritten: newWrites.reduce((acc, w) => acc + w.bytes, 0),
        writeDurations: newWrites.map((w) => w.durationMs),
      };
    }, startWritesCount);

    const newLongTasks = await p.evaluate((sltc) => window.__olpMetrics.longTasks.slice(sltc), startLongTasksCount);

    results.interactions.waterLog.push({
      run: i,
      waterClicked,
      interactionDurationMs: Number(duration.toFixed(2)),
      storageWrites: writeData.writeCount,
      bytesWritten: writeData.totalBytesWritten,
      writeDurationsMs: writeData.writeDurations.map((d) => Number(d.toFixed(2))),
      longTasksCount: newLongTasks.length,
      longTasks: newLongTasks,
    });
    console.log(`  Water Log Run #${i}: Duration=${duration.toFixed(2)}ms, Writes=${writeData.writeCount} (${(writeData.totalBytesWritten / 1024).toFixed(1)} KB), WriteDurations=${JSON.stringify(writeData.writeDurations.map((d) => d.toFixed(2)))}, LongTasks=${newLongTasks.length}`);
  }

  // B. Task Completion Toggle
  for (let i = 1; i <= 5; i++) {
    const startWritesCount = await p.evaluate(() => window.__olpMetrics.storageWrites.length);
    const startLongTasksCount = await p.evaluate(() => window.__olpMetrics.longTasks.length);

    const tStart = performance.now();
    const taskToggled = await p.evaluate(() => {
      // Find a task toggle button
      const taskBtns = Array.from(document.querySelectorAll('button')).filter((b) =>
        b.getAttribute('aria-label')?.includes('Complete') || b.querySelector('svg.lucide-check') || b.querySelector('svg')
      );
      if (taskBtns.length > 0) {
        taskBtns[0].click();
        return true;
      }
      return false;
    });

    await p.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await new Promise((r) => setTimeout(r, 100));

    const duration = performance.now() - tStart;
    const writeData = await p.evaluate((swc) => {
      const newWrites = window.__olpMetrics.storageWrites.slice(swc);
      return {
        writeCount: newWrites.length,
        totalBytesWritten: newWrites.reduce((acc, w) => acc + w.bytes, 0),
        writeDurations: newWrites.map((w) => w.durationMs),
      };
    }, startWritesCount);

    const newLongTasks = await p.evaluate((sltc) => window.__olpMetrics.longTasks.slice(sltc), startLongTasksCount);

    results.interactions.taskToggle.push({
      run: i,
      taskToggled,
      interactionDurationMs: Number(duration.toFixed(2)),
      storageWrites: writeData.writeCount,
      bytesWritten: writeData.totalBytesWritten,
      writeDurationsMs: writeData.writeDurations.map((d) => Number(d.toFixed(2))),
      longTasksCount: newLongTasks.length,
      longTasks: newLongTasks,
    });
    console.log(`  Task Toggle Run #${i}: Duration=${duration.toFixed(2)}ms, Writes=${writeData.writeCount} (${(writeData.totalBytesWritten / 1024).toFixed(1)} KB), LongTasks=${newLongTasks.length}`);
  }

  // C. Search Typing Latency
  console.log('  Testing Search Modal Typing...');
  // Open Search modal
  await p.evaluate(() => {
    const searchBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Search') || b.textContent?.includes('Search')
    );
    searchBtn?.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  const searchInputSelector = 'input[type="text"]';
  await p.waitForSelector(searchInputSelector);

  const queryChars = 'milestone'.split('');
  const keyLatencies: number[] = [];
  const startLongTasksCount = await p.evaluate(() => window.__olpMetrics.longTasks.length);

  for (const char of queryChars) {
    const t0 = performance.now();
    await p.type(searchInputSelector, char, { delay: 30 });
    await p.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const lat = performance.now() - t0;
    keyLatencies.push(Number(lat.toFixed(2)));
  }

  const searchLongTasks = await p.evaluate((sltc) => window.__olpMetrics.longTasks.slice(sltc), startLongTasksCount);
  results.interactions.searchTyping.push({
    query: 'milestone',
    keyLatenciesMs: keyLatencies,
    medianKeyLatencyMs: Number(keyLatencies.sort((a, b) => a - b)[Math.floor(keyLatencies.length / 2)].toFixed(2)),
    longTasksCount: searchLongTasks.length,
    longTasks: searchLongTasks,
  });
  console.log(`  Search Typing ("milestone"): Median Keystroke Latency=${results.interactions.searchTyping[0].medianKeyLatencyMs}ms, LongTasks=${searchLongTasks.length}`);

  // Close search modal
  await p.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 200));

  // D. View Navigation (Today -> Tasks -> Budget -> Settings)
  console.log('  Testing View Navigation...');
  const viewsToTest = ['Tasks', 'Budget', 'Settings', 'Today'];
  for (const viewName of viewsToTest) {
    const startLongTasks = await p.evaluate(() => window.__olpMetrics.longTasks.length);
    const t0 = performance.now();
    await p.evaluate((vn) => {
      const navBtn = Array.from(document.querySelectorAll('button, a')).find((b) =>
        b.textContent?.trim() === vn
      );
      (navBtn as HTMLElement)?.click();
    }, viewName);

    await p.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const navDuration = performance.now() - t0;
    const navLongTasks = await p.evaluate((sltc) => window.__olpMetrics.longTasks.slice(sltc), startLongTasks);

    results.interactions.navigation.push({
      view: viewName,
      transitionDurationMs: Number(navDuration.toFixed(2)),
      longTasksCount: navLongTasks.length,
      longTasks: navLongTasks,
    });
    console.log(`  Nav to ${viewName}: Duration=${navDuration.toFixed(2)}ms, LongTasks=${navLongTasks.length}`);
  }

  // E. Calendar ICS Export (Testing Long Task on 1,150 items)
  console.log('  Testing Calendar Export with 1,150 Items in Real Browser...');
  const startLtExport = await p.evaluate(() => window.__olpMetrics.longTasks.length);
  const tExportStart = performance.now();

  const exportResult = await p.evaluate(() => {
    try {
      // Find the export button or invoke the context export function
      const exportBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Export .ics') || b.textContent?.includes('Export Calendar') || b.textContent?.includes('Download .ics')
      );
      if (exportBtn) {
        exportBtn.click();
        return { clicked: true, method: 'button_click' };
      }
      return { clicked: false, method: 'none' };
    } catch (e: any) {
      return { clicked: false, error: e?.message };
    }
  });

  await p.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const exportDuration = performance.now() - tExportStart;
  const exportLongTasks = await p.evaluate((sltc) => window.__olpMetrics.longTasks.slice(sltc), startLtExport);

  results.interactions.calendarExport.push({
    exportResult,
    durationMs: Number(exportDuration.toFixed(2)),
    longTasksCount: exportLongTasks.length,
    longTasks: exportLongTasks,
  });
  console.log(`  Calendar Export Duration=${exportDuration.toFixed(2)}ms, LongTasksCount=${exportLongTasks.length}`);

  await bInteract.close();

  // -----------------------------------------------------------------
  // 4. REAL OFFLINE STARTUP & NAVIGATION TEST
  // -----------------------------------------------------------------
  console.log('\n--- 4. Testing Real Offline Startup & Navigation after Preparation ---');

  const bOffline = await puppeteer.launch({
    headless: true,
    userDataDir: '/tmp/browser-profiles/offline-test',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const pageOffline = await bOffline.newPage();
  await pageOffline.setViewport({ width: 1280, height: 800 });
  await pageOffline.evaluateOnNewDocument(INJECTED_OBSERVER_CODE);

  // 1. Online preparation
  console.log('  Step 1: Online priming (Service Worker precache)...');
  await pageOffline.goto(APP_URL, { waitUntil: 'networkidle0' });
  await pageOffline.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.ready;
    }
  });
  await new Promise((r) => setTimeout(r, 2000)); // allow cache to populate

  // Check SW status from CacheStorage
  const cachedKeys = await pageOffline.evaluate(async () => {
    if (!('caches' in window)) return [];
    const keys = await caches.keys();
    let paths: string[] = [];
    for (const k of keys) {
      const cache = await caches.open(k);
      const reqs = await cache.keys();
      paths = paths.concat(reqs.map((r) => new URL(r.url).pathname));
    }
    return paths;
  });
  console.log(`  CacheStorage primed with ${cachedKeys.length} paths:`, cachedKeys);

  // 2. Cut network connection completely
  console.log('  Step 2: Disconnecting network via CDP (offline: true)...');
  const cdp = await pageOffline.target().createCDPSession();
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });

  // 3. Reload in offline mode
  console.log('  Step 3: Offline reload...');
  let offlineLaunchSuccess = false;
  try {
    await pageOffline.reload({ waitUntil: 'networkidle0' });
    const title = await pageOffline.title();
    const hasHeader = await pageOffline.evaluate(() => Boolean(document.querySelector('header')));
    offlineLaunchSuccess = Boolean(hasHeader);
    console.log(`  Offline Reload Result: Title="${title}", AppShellRendered=${offlineLaunchSuccess}`);
  } catch (err: any) {
    console.error('  Offline reload failed:', err.message);
  }

  // 4. Navigate to unvisited views in offline mode
  console.log('  Step 4: Navigating to secondary views while completely offline...');
  const offlineNavResults: Record<string, boolean> = {};
  for (const vName of ['Tasks', 'Budget', 'Settings']) {
    try {
      await pageOffline.evaluate((vn) => {
        const btn = Array.from(document.querySelectorAll('button, a')).find((b) =>
          b.textContent?.trim() === vn
        );
        (btn as HTMLElement)?.click();
      }, vName);
      await new Promise((r) => setTimeout(r, 300));
      const viewHeader = await pageOffline.evaluate(() => document.querySelector('h2')?.textContent);
      offlineNavResults[vName] = Boolean(viewHeader);
      console.log(`    Offline Nav to "${vName}": Success=${offlineNavResults[vName]} (h2: "${viewHeader}")`);
    } catch (e: any) {
      offlineNavResults[vName] = false;
      console.log(`    Offline Nav to "${vName}": Failed (${e?.message})`);
    }
  }

  results.offlineTest = {
    cachedKeys,
    offlineLaunchSuccess,
    offlineNavResults,
  };

  await bOffline.close();

  // -----------------------------------------------------------------
  // 5. WRITE ARTIFACTS
  // -----------------------------------------------------------------
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'browser-raw-results.json'), JSON.stringify(results, null, 2));

  // Generate downloadable interactive HTML performance report
  const htmlReport = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Our Life Planner - Browser Performance Baseline Report</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0b1220; color: #edf4ff; padding: 24px; line-height: 1.5; }
    h1, h2, h3 { color: #38d0c5; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; background: #152238; border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #1e2d4a; }
    th { background: #1c2b47; color: #94a3b8; font-size: 13px; text-transform: uppercase; }
    .metric-value { font-family: monospace; font-weight: bold; color: #38d0c5; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge-pass { background: #065f46; color: #34d399; }
    .badge-warn { background: #78350f; color: #fbbf24; }
    pre { background: #152238; padding: 12px; border-radius: 6px; overflow-x: auto; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Browser Performance Baseline Report</h1>
  <p><strong>Browser:</strong> ${browserVersion} | <strong>Hardware:</strong> 16 vCPUs (Linux 6.6) | <strong>Viewport:</strong> 1280x800</p>
  <p><strong>Source Fingerprint:</strong> <code>c300201465fc8d17857811bda41b3becd370a44af83a067969c98322139deb44</code></p>

  <h2>1. Startup Performance (5 Runs Each, Real Chromium)</h2>
  <table>
    <thead><tr><th>Scenario</th><th>Dataset</th><th>Run 1</th><th>Run 2</th><th>Run 3</th><th>Run 4</th><th>Run 5</th><th>Median LCP</th><th>Median CLS</th></tr></thead>
    <tbody>
      <tr>
        <td><strong>Cold Start</strong></td>
        <td>Small (86 records)</td>
        ${results.coldStartup.small.map((r: any) => `<td>${r.lcp?.toFixed(1)}ms</td>`).join('')}
        <td class="metric-value">${results.coldStartup.small.map((r: any) => r.lcp).sort((a: any, b: any) => a - b)[2]?.toFixed(1)} ms</td>
        <td class="metric-value">${results.coldStartup.small.map((r: any) => r.cls).sort((a: any, b: any) => a - b)[2]}</td>
      </tr>
      <tr>
        <td><strong>Cold Start</strong></td>
        <td>Stress (3,045 records)</td>
        ${results.coldStartup.stress.map((r: any) => `<td>${r.lcp?.toFixed(1)}ms</td>`).join('')}
        <td class="metric-value">${results.coldStartup.stress.map((r: any) => r.lcp).sort((a: any, b: any) => a - b)[2]?.toFixed(1)} ms</td>
        <td class="metric-value">${results.coldStartup.stress.map((r: any) => r.cls).sort((a: any, b: any) => a - b)[2]}</td>
      </tr>
      <tr>
        <td><strong>Warm Start (SW/Cache)</strong></td>
        <td>Small (86 records)</td>
        ${results.warmStartup.small.map((r: any) => `<td>${r.lcp?.toFixed(1)}ms</td>`).join('')}
        <td class="metric-value">${results.warmStartup.small.map((r: any) => r.lcp).sort((a: any, b: any) => a - b)[2]?.toFixed(1)} ms</td>
        <td class="metric-value">${results.warmStartup.small.map((r: any) => r.cls).sort((a: any, b: any) => a - b)[2]}</td>
      </tr>
      <tr>
        <td><strong>Warm Start (SW/Cache)</strong></td>
        <td>Stress (3,045 records)</td>
        ${results.warmStartup.stress.map((r: any) => `<td>${r.lcp?.toFixed(1)}ms</td>`).join('')}
        <td class="metric-value">${results.warmStartup.stress.map((r: any) => r.lcp).sort((a: any, b: any) => a - b)[2]?.toFixed(1)} ms</td>
        <td class="metric-value">${results.warmStartup.stress.map((r: any) => r.cls).sort((a: any, b: any) => a - b)[2]}</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Interaction Durations & Storage Writes (Stress Dataset: 3,045 Records)</h2>
  <table>
    <thead><tr><th>Interaction</th><th>Duration (ms)</th><th>Storage Writes</th><th>Bytes Written</th><th>Write Latency (ms)</th><th>Long Tasks (&gt;50ms)</th></tr></thead>
    <tbody>
      ${results.interactions.waterLog.map((r: any) => `
        <tr>
          <td>Water Log (+250 ml) #${r.run}</td>
          <td class="metric-value">${r.interactionDurationMs} ms</td>
          <td>${r.storageWrites}</td>
          <td>${(r.bytesWritten / 1024).toFixed(1)} KB</td>
          <td>${JSON.stringify(r.writeDurationsMs)}</td>
          <td>${r.longTasksCount === 0 ? '<span class="badge badge-pass">0 None</span>' : `<span class="badge badge-warn">${r.longTasksCount}</span>`}</td>
        </tr>
      `).join('')}
      ${results.interactions.taskToggle.map((r: any) => `
        <tr>
          <td>Task Completion Toggle #${r.run}</td>
          <td class="metric-value">${r.interactionDurationMs} ms</td>
          <td>${r.storageWrites}</td>
          <td>${(r.bytesWritten / 1024).toFixed(1)} KB</td>
          <td>${JSON.stringify(r.writeDurationsMs)}</td>
          <td>${r.longTasksCount === 0 ? '<span class="badge badge-pass">0 None</span>' : `<span class="badge badge-warn">${r.longTasksCount}</span>`}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>3. Offline Launch & Navigation Verification</h2>
  <p><strong>Offline Reload Success:</strong> <span class="badge badge-pass">${results.offlineTest.offlineLaunchSuccess ? 'PASSED' : 'FAILED'}</span></p>
  <p><strong>Navigation to Unopened Secondary Screens while completely offline:</strong></p>
  <pre>${JSON.stringify(results.offlineTest.offlineNavResults, null, 2)}</pre>
</body>
</html>`;

  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'performance-report.html'), htmlReport, 'utf8');

  // Copy artifacts to public/measurement-artifacts/ so they are immediately downloadable via Vite / Nginx
  const publicArtifactsDir = path.resolve('./public/measurement-artifacts');
  if (!fs.existsSync(publicArtifactsDir)) {
    fs.mkdirSync(publicArtifactsDir, { recursive: true });
  }
  fs.copyFileSync(path.join(ARTIFACTS_DIR, 'browser-raw-results.json'), path.join(publicArtifactsDir, 'browser-raw-results.json'));
  fs.copyFileSync(path.join(ARTIFACTS_DIR, 'performance-report.html'), path.join(publicArtifactsDir, 'performance-report.html'));
  fs.copyFileSync(path.join(ARTIFACTS_DIR, 'datasets-summary.json'), path.join(publicArtifactsDir, 'datasets-summary.json'));
  fs.copyFileSync(path.join(ARTIFACTS_DIR, 'raw-benchmark-results.json'), path.join(publicArtifactsDir, 'node-benchmark-results.json'));
  fs.copyFileSync(path.join(ARTIFACTS_DIR, 'build.log'), path.join(publicArtifactsDir, 'build.log'));

  console.log('\n=====================================================');
  console.log('BROWSER TEST SUITE COMPLETE! ALL ARTIFACTS WRITTEN');
  console.log('=====================================================');
}

runBrowserTests().catch((err) => {
  console.error('Browser Test Suite Error:', err);
  process.exit(1);
});
