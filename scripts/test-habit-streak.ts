import fs from 'fs';
import path from 'path';
import http from 'http';
import { execFile } from 'child_process';
import { calculateHabitStreak } from '../src/utils/calculations';
import {
  INITIAL_SETTINGS,
  SAMPLE_BILLS,
  SAMPLE_BRAIN_DUMP,
  SAMPLE_CALENDAR_EVENTS,
  SAMPLE_DEBTS,
  SAMPLE_GOALS,
  SAMPLE_GROCERIES,
  SAMPLE_HYDRATION_LOG,
  SAMPLE_HYDRATION_TARGETS,
  SAMPLE_PLANNED_MEALS,
  SAMPLE_RECIPES,
  SAMPLE_ROUTINES,
  SAMPLE_SAVINGS_POTS,
  SAMPLE_TASKS,
  SAMPLE_TRANSACTIONS,
  SAMPLE_WEIGHT_PROFILES,
  SAMPLE_WEIGHT_RECORDS,
  SAMPLE_WORKOUTS,
} from '../src/utils/sampleData';
import { HabitItem } from '../src/types/planner';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failed++;
  }
}

function findBrowserExecutable(): string | null {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

interface BrowserHabitStreakReport {
  selectedTitle?: string;
  currentStreakText?: string;
  bestStreakText?: string;
  overallBestCardText?: string;
  error?: string;
}

async function runBrowserHabitStreakTest(): Promise<BrowserHabitStreakReport> {
  const browserExe = findBrowserExecutable();
  if (!browserExe) {
    throw new Error('No headless browser (Edge or Chrome) found on system.');
  }

  const standalonePath = path.resolve(process.cwd(), 'dist', 'Our-Life-Planner-Offline.html');
  if (!fs.existsSync(standalonePath)) {
    throw new Error(`Offline bundle not found at ${standalonePath}. Run npm run build first.`);
  }

  const rawHtml = fs.readFileSync(standalonePath, 'utf-8');

  const reproHabits: HabitItem[] = [
    {
      id: 'h-repro-weekly',
      title: 'Weekly Deep Clean',
      frequencyType: 'weekly',
      weeklyTargetDays: 1,
      effectiveDate: '2026-01-01',
      checkedDates: ['2026-01-05', '2026-01-19'],
    },
  ];

  const seedData = {
    version: '1.0.0' as const,
    exportedAt: '2026-01-19T12:00:00Z',
    settings: { ...INITIAL_SETTINGS, hasCompletedSetup: true },
    tasks: SAMPLE_TASKS,
    routines: SAMPLE_ROUTINES,
    goals: SAMPLE_GOALS,
    habits: reproHabits,
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
  };

  const testHarnessScript = `
<script type="module">
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function runTest() {
    const phase = new URLSearchParams(window.location.search).get('phase') || '1';
    if (phase === '1') {
      localStorage.clear();
      localStorage.setItem('our_life_planner_settings_v1', ${JSON.stringify(
        JSON.stringify({ ...INITIAL_SETTINGS, hasCompletedSetup: true })
      )});
      localStorage.setItem('our_life_planner_data_v1', ${JSON.stringify(
        JSON.stringify(seedData)
      )});
      window.location.replace('/?phase=2');
      return;
    }

    const report = {};

    try {
      await wait(450);

      // Navigate to Habits view
      const navButtons = Array.from(document.querySelectorAll('aside button'));
      const habitsBtn = navButtons.find((b) => (b.textContent || '').includes('Habits'));
      if (!habitsBtn) throw new Error('Habits sidebar button not found');
      habitsBtn.click();
      await wait(300);

      // Inspect Selected Habit Detail Card metric pills
      const metricLabels = Array.from(document.querySelectorAll('div.text-center'));
      for (const card of metricLabels) {
        const label = card.querySelector('div.text-\\\\[11px\\\\]');
        const val = card.querySelector('div.text-xl.font-bold.font-mono');
        if (label && val) {
          const lText = (label.textContent || '').trim();
          const vText = (val.textContent || '').trim();
          if (lText === 'Current streak') report.currentStreakText = vText;
          if (lText === 'Best streak') report.bestStreakText = vText;
        }
      }

      // Also check top Best streak summary card
      const topCards = Array.from(document.querySelectorAll('div.rounded-2xl.p-4'));
      for (const tc of topCards) {
        if ((tc.textContent || '').includes('Best streak')) {
          const valEl = tc.querySelector('div.text-xl.font-bold.font-mono');
          if (valEl) {
            report.overallBestCardText = (valEl.textContent || '').trim();
          }
        }
      }
    } catch (err) {
      report.error = err && err.message ? err.message : String(err);
    }

    await fetch('/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
  }

  setTimeout(runTest, 200);
</script>
<img src="/hold-until-complete.gif" style="display:none" />
`;

  const strippedHtml = rawHtml
    .replace(/<meta[^>]+Content-Security-Policy[^>]*>/gi, '')
    .replace(/<script id="olp-preloaded-bundle">[\s\S]*?<\/script>/, '');
  const lastBodyIdx = strippedHtml.lastIndexOf('</body>');
  const instrumentedHtml =
    strippedHtml.slice(0, lastBodyIdx) +
    testHarnessScript +
    '\n</body>' +
    strippedHtml.slice(lastBodyIdx + '</body>'.length);

  return new Promise<BrowserHabitStreakReport>((resolve, reject) => {
    let holdResponses: http.ServerResponse[] = [];
    let resolved = false;

    const server = http.createServer((req, res) => {
      if (req.url === '/' || req.url?.startsWith('/?')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(instrumentedHtml);
        return;
      }
      if (req.url === '/hold-until-complete.gif') {
        holdResponses.push(res);
        return;
      }
      if (req.url === '/report' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
          for (const hr of holdResponses) {
            try {
              hr.writeHead(204);
              hr.end();
            } catch {
              // ignore
            }
          }
          holdResponses = [];
          if (!resolved) {
            resolved = true;
            try {
              const parsed = JSON.parse(body) as BrowserHabitStreakReport;
              server.close();
              resolve(parsed);
            } catch (e) {
              server.close();
              reject(e);
            }
          }
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('Could not bind local server'));
        return;
      }
      const url = `http://127.0.0.1:${addr.port}/`;
      const userDataDir = path.resolve(
        process.cwd(),
        'dist',
        `.tmp-edge-habit-streak-${Date.now()}`
      );

      const child = execFile(
        browserExe,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          `--user-data-dir=${userDataDir}`,
          '--virtual-time-budget=20000',
          '--dump-dom',
          url,
        ],
        { timeout: 25000, maxBuffer: 10 * 1024 * 1024 },
        (err) => {
          setTimeout(() => {
            try {
              fs.rmSync(userDataDir, { recursive: true, force: true });
            } catch {
              // ignore
            }
          }, 500);
          if (!resolved) {
            resolved = true;
            server.close();
            reject(err || new Error('Browser exited before posting /report'));
          }
        }
      );

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            child.kill();
          } catch {
            // ignore
          }
          server.close();
          reject(new Error('Timed out waiting for browser /report'));
        }
      }, 24000);
    });
  });
}

async function runTests() {
  console.log('=== P2 Weekly Habit Best Streak Consecutive-Week Verification ===\n');

  // 1. Exact User Reproduction Case:
  // Weekly habit requiring 1 check-in, completed on Jan 5, 2026 and Jan 19, 2026,
  // with no completion in the intervening week (Jan 12–18, 2026).
  console.log('1. Testing exact user reproduction case (Jan 5 and Jan 19, 2026 with missed week between)...');
  const reproHabit: HabitItem = {
    id: 'h-repro',
    title: 'Weekly Reflection',
    frequencyType: 'weekly',
    weeklyTargetDays: 1,
    effectiveDate: '2026-01-01',
    checkedDates: ['2026-01-05', '2026-01-19'],
  };

  const reproOnJan19 = calculateHabitStreak(reproHabit, '2026-01-19');
  assert(
    reproOnJan19.currentStreak === 1,
    `Current streak on 2026-01-19 is 1 (got ${reproOnJan19.currentStreak})`
  );
  assert(
    reproOnJan19.bestStreak === 1,
    `Best streak on 2026-01-19 is 1 and does NOT bridge empty intervening week of Jan 12 (got ${reproOnJan19.bestStreak})`
  );

  const reproOnOct10 = calculateHabitStreak(reproHabit, '2026-10-10');
  assert(
    reproOnOct10.currentStreak === 0 && reproOnOct10.bestStreak === 1,
    `Evaluated later in the year (2026-10-10), currentStreak is 0 and bestStreak remains 1 (got current=${reproOnOct10.currentStreak}, best=${reproOnOct10.bestStreak})`
  );

  // 2. Consecutive Calendar Weeks Succeeding
  console.log('\n2. Testing consecutive calendar weeks & multi-segment history...');
  const multiSegmentHabit: HabitItem = {
    id: 'h-multi',
    title: 'Strength Training 2x/wk',
    frequencyType: 'weekly',
    weeklyTargetDays: 2,
    effectiveDate: '2026-01-01',
    checkedDates: [
      // Segment 1: 3 consecutive weeks (Jan 5, Jan 12, Jan 19)
      '2026-01-05', '2026-01-07',
      '2026-01-13', '2026-01-15',
      '2026-01-20', '2026-01-23',
      // Intervening week Jan 26 is completely empty (0 check-ins)
      // Segment 2: 2 consecutive weeks (Feb 2, Feb 9)
      '2026-02-02', '2026-02-05',
      '2026-02-10', '2026-02-12',
    ],
  };

  const multiResult = calculateHabitStreak(multiSegmentHabit, '2026-02-12');
  assert(
    multiResult.currentStreak === 2,
    `Current streak after 2 consecutive February weeks is 2 (got ${multiResult.currentStreak})`
  );
  assert(
    multiResult.bestStreak === 3,
    `Best streak across history (3 weeks, gap, 2 weeks) is 3, not 5 (got ${multiResult.bestStreak})`
  );

  // 3. Partial (below-target) intervening week breaks streak
  console.log('\n3. Testing partial (below-target) intervening week and unfinished current week...');
  const partialWeekHabit: HabitItem = {
    id: 'h-partial',
    title: 'Get outside 3x/wk',
    frequencyType: 'weekly',
    weeklyTargetDays: 3,
    effectiveDate: '2026-01-01',
    checkedDates: [
      // Week 1 (Jan 5): 3 check-ins -> met
      '2026-01-05', '2026-01-06', '2026-01-07',
      // Week 2 (Jan 12): 2 check-ins -> below target (3)
      '2026-01-12', '2026-01-14',
      // Week 3 (Jan 19): 3 check-ins -> met
      '2026-01-19', '2026-01-21', '2026-01-22',
    ],
  };
  const partialResult = calculateHabitStreak(partialWeekHabit, '2026-01-22');
  assert(
    partialResult.currentStreak === 1 && partialResult.bestStreak === 1,
    `Partial intervening week (2/3 days) breaks streak: current=1, best=1 (got current=${partialResult.currentStreak}, best=${partialResult.bestStreak})`
  );

  // Unfinished current week preserves prior consecutive week streak
  const unfinishedCurrentResult = calculateHabitStreak(multiSegmentHabit, '2026-02-17'); // Tuesday of week Feb 16
  assert(
    unfinishedCurrentResult.currentStreak === 2 && unfinishedCurrentResult.bestStreak === 3,
    `Unfinished current week (Feb 17) preserves prior 2-week currentStreak and 3-week bestStreak (got current=${unfinishedCurrentResult.currentStreak}, best=${unfinishedCurrentResult.bestStreak})`
  );

  // 4. Year boundary consecutive weeks (Dec 2025 -> Jan 2026)
  console.log('\n4. Testing year-boundary consecutive weeks (Dec 2025 -> Jan 2026)...');
  const yearBoundaryHabit: HabitItem = {
    id: 'h-year',
    title: 'Weekly Budget Check',
    frequencyType: 'weekly',
    weeklyTargetDays: 1,
    effectiveDate: '2025-12-01',
    checkedDates: [
      '2025-12-23', // Week of Mon 2025-12-22
      '2025-12-31', // Week of Mon 2025-12-29
      '2026-01-06', // Week of Mon 2026-01-05
    ],
  };
  const yearBoundaryResult = calculateHabitStreak(yearBoundaryHabit, '2026-01-06');
  assert(
    yearBoundaryResult.currentStreak === 3 && yearBoundaryResult.bestStreak === 3,
    `3 consecutive weeks across 2025->2026 year boundary yield current=3, best=3 (got current=${yearBoundaryResult.currentStreak}, best=${yearBoundaryResult.bestStreak})`
  );

  // 5. Headless Browser E2E Verification
  console.log('\n5. Running headless browser E2E verification in HabitsView...');
  const browserReport = await runBrowserHabitStreakTest();
  if (browserReport.error) {
    console.error('  Browser test error:', browserReport.error);
  }
  assert(!browserReport.error, 'Headless browser HabitsView test ran without error');
  assert(
    browserReport.bestStreakText === '1 weeks',
    `HabitsView detail card renders Best streak as "1 weeks" for Jan 5 + Jan 19 habit (got "${browserReport.bestStreakText}")`
  );
  assert(
    browserReport.overallBestCardText === '1-week',
    `HabitsView summary card renders Best streak as "1-week" (got "${browserReport.overallBestCardText}")`
  );

  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
