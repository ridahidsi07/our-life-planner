import fs from 'fs';
import path from 'path';
import http from 'http';
import { execFile } from 'child_process';
import {
  getReviewedWeekRange,
  shiftWeekDate,
  calculateWeeklyReviewMetrics,
} from '../src/utils/weeklyReview';
import {
  SAMPLE_TASKS,
  SAMPLE_WORKOUTS,
  SAMPLE_HABITS,
  INITIAL_SETTINGS,
  SAMPLE_ROUTINES,
  SAMPLE_GOALS,
  SAMPLE_BRAIN_DUMP,
  SAMPLE_TRANSACTIONS,
  SAMPLE_BILLS,
  SAMPLE_SAVINGS_POTS,
  SAMPLE_DEBTS,
  SAMPLE_RECIPES,
  SAMPLE_PLANNED_MEALS,
  SAMPLE_GROCERIES,
  SAMPLE_WEIGHT_PROFILES,
  SAMPLE_WEIGHT_RECORDS,
  SAMPLE_HYDRATION_LOG,
  SAMPLE_HYDRATION_TARGETS,
  SAMPLE_CALENDAR_EVENTS,
} from '../src/utils/sampleData';
import { validateBackupData } from '../src/utils/backupValidator';
import { reconcilePlannerData } from '../src/utils/storageCoordinator';
import { PlannerBackupData } from '../src/types/planner';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
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

function createBaseBackup(): PlannerBackupData {
  return {
    version: '1.0.0',
    exportedAt: '2026-10-05T12:00:00.000Z',
    revision: 1,
    settings: { ...INITIAL_SETTINGS },
    tasks: [...SAMPLE_TASKS],
    routines: [...SAMPLE_ROUTINES],
    goals: [...SAMPLE_GOALS],
    habits: [...SAMPLE_HABITS],
    inbox: [...SAMPLE_BRAIN_DUMP],
    transactions: [...SAMPLE_TRANSACTIONS],
    bills: [...SAMPLE_BILLS],
    savingsPots: [...SAMPLE_SAVINGS_POTS],
    debts: [...SAMPLE_DEBTS],
    recipes: [...SAMPLE_RECIPES],
    plannedMeals: [...SAMPLE_PLANNED_MEALS],
    groceries: [...SAMPLE_GROCERIES],
    workouts: [...SAMPLE_WORKOUTS],
    weightProfiles: [...SAMPLE_WEIGHT_PROFILES],
    weightRecords: [...SAMPLE_WEIGHT_RECORDS],
    hydrationEntries: [...SAMPLE_HYDRATION_LOG],
    hydrationTargets: [...SAMPLE_HYDRATION_TARGETS],
    calendarEvents: [...SAMPLE_CALENDAR_EVENTS],
    weeklyReviews: [],
  };
}

interface BrowserWeeklyReviewReport {
  dateRangeText: string | null;
  oct5WeekCompletedTasksText: string | null;
  oct5WeekCompletedWorkoutsText: string | null;
  prevWeekDateRangeText: string | null;
  prevWeekCompletedTasksText: string | null;
  prevWeekCompletedWorkoutsText: string | null;
  reflectionAfterReload: string | null;
  savedBadgeVisibleAfterReload: boolean;
  intentionsAfterReload: string[];
  linkedTaskBadgesCountAfterReload: number;
  storedWeeklyReviewsCount: number;
  storedWeeklyReviewReflection: string | null;
  storedLinkedTasksInNextWeekCount: number;
  storedLinkedTaskTitles: string[];
   storedLinkedTaskDueDates: string[];
  error?: string;
}

async function runBrowserReproductionTest(): Promise<BrowserWeeklyReviewReport> {
  const browserExe = findBrowserExecutable();
  if (!browserExe) {
    throw new Error('No headless browser (Edge or Chrome) found on system.');
  }

  const standalonePath = path.resolve(process.cwd(), 'dist', 'Our-Life-Planner-Offline.html');
  if (!fs.existsSync(standalonePath)) {
    throw new Error(`Offline bundle not found at ${standalonePath}. Run npm run build first.`);
  }

  const rawHtml = fs.readFileSync(standalonePath, 'utf-8');

  const testHarnessScript = `
<script type="module">
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function runTest() {
    const phase = new URLSearchParams(window.location.search).get('phase') || '1';

    if (phase === '1') {
      // Seed localStorage so setup modal is skipped and current date's week is deterministic
      localStorage.clear();
      const seededSettings = {
        ownerName: 'Alex & Jordan',
        partnerName: 'Jordan',
        householdType: 'couple',
        currency: 'USD',
        currencySymbol: '$',
        weekStartsOn: 'Monday',
        timeFormat: '12h',
        theme: 'light',
        hasCompletedSetup: true,
        isSampleDataActive: true,
        edition: 'online',
      };
      localStorage.setItem('our_life_planner_settings_v1', JSON.stringify(seededSettings));
      window.location.replace('/?phase=2');
      return;
    }

    if (phase === '2') {
      const report = {
        dateRangeText: null,
        oct5WeekCompletedTasksText: null,
        oct5WeekCompletedWorkoutsText: null,
        prevWeekDateRangeText: null,
        prevWeekCompletedTasksText: null,
        prevWeekCompletedWorkoutsText: null,
      };

      try {
        // Wait for app to mount
        for (let i = 0; i < 40; i++) {
          const btn = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent && b.textContent.includes('Weekly Review')
          );
          if (btn) break;
          await wait(100);
        }

        // Open Weekly Review modal
        const weeklyBtn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent && b.textContent.includes('Weekly Review')
        );
        if (!weeklyBtn) throw new Error('Weekly Review button not found');
        weeklyBtn.click();
        await wait(120);

        const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (!dialog) throw new Error('Weekly Review dialog did not open');

        // Navigate to the sample week 2026-10-05 .. 2026-10-11 if todayDate is different
        const rangeEl = dialog.querySelector('[data-testid="weekly-review-date-range"]');
        const prevWeekBtn = dialog.querySelector('button[aria-label="Review previous week"]');
        if (!prevWeekBtn) throw new Error('Review previous week button not found');
        for (let step = 0; step < 10; step++) {
          const txt = rangeEl ? rangeEl.textContent || '' : '';
          if (txt.includes('2026-10-05')) break;
          prevWeekBtn.click();
          await wait(80);
        }
        report.dateRangeText = rangeEl ? rangeEl.textContent.trim() : null;

        const tasksCountEl = dialog.querySelector('[data-testid="weekly-review-completed-tasks-count"]');
        const workoutsCountEl = dialog.querySelector('[data-testid="weekly-review-completed-workouts-count"]');
        report.oct5WeekCompletedTasksText = tasksCountEl ? tasksCountEl.textContent.trim() : null;
        report.oct5WeekCompletedWorkoutsText = workoutsCountEl ? workoutsCountEl.textContent.trim() : null;

        // Test switching to previous week (2026-09-28 to 2026-10-04)
        prevWeekBtn.click();
        await wait(100);

        report.prevWeekDateRangeText = rangeEl ? rangeEl.textContent.trim() : null;
        report.prevWeekCompletedTasksText = tasksCountEl ? tasksCountEl.textContent.trim() : null;
        report.prevWeekCompletedWorkoutsText = workoutsCountEl ? workoutsCountEl.textContent.trim() : null;

        // Switch back to target week (2026-10-05 to 2026-10-11)
        const nextWeekBtn = dialog.querySelector('button[aria-label="Review next week"]');
        if (!nextWeekBtn) throw new Error('Review next week button not found');
        nextWeekBtn.click();
        await wait(100);

        // Step 1: Enter reflection
        const reflectionTextarea = dialog.querySelector('#weekly-review-reflection');
        if (!reflectionTextarea) throw new Error('#weekly-review-reflection not found');
        reflectionTextarea.focus();
        setNativeValue(
          reflectionTextarea,
          'Completed the Q4 budget plan and stayed consistent with morning hydration.'
        );
        await wait(80);

        const clickNextStep = () => {
          const btn = Array.from(dialog.querySelectorAll('button')).find(
            (b) => b.textContent && b.textContent.includes('Next Step')
          );
          if (!btn) throw new Error('Next Step button not found');
          btn.click();
        };

        // Advance Step 1 -> Step 2 -> Step 3 -> Step 4
        clickNextStep();
        await wait(80);
        clickNextStep();
        await wait(80);
        clickNextStep();
        await wait(80);

        // Step 4: Enter 3 priorities for next week
        const priorities = [
          'Finalize household tax documents',
          'Schedule dentist appointment',
          'Prep 3 healthy dinners',
        ];
        for (let idx = 0; idx < 3; idx++) {
          const input = dialog.querySelector('#weekly-review-intention-' + idx);
          if (!input) throw new Error('Intention input ' + idx + ' not found');
          input.focus();
          setNativeValue(input, priorities[idx]);
          await wait(60);
        }

        // Complete Review
        const completeBtn = Array.from(dialog.querySelectorAll('button')).find(
          (b) => b.textContent && b.textContent.includes('Complete Review')
        );
        if (!completeBtn) throw new Error('Complete Review button not found');
        completeBtn.click();
        await wait(250);

        // Save phase 2 metrics in sessionStorage and perform a real browser reload to phase 3
        sessionStorage.setItem('weekly_review_phase2_report', JSON.stringify(report));
        window.location.replace('/?phase=3');
        return;
      } catch (err) {
        await fetch('/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: err && err.message ? err.message : String(err) }),
        });
        return;
      }
    }

    if (phase === '3') {
      const phase2Report = JSON.parse(sessionStorage.getItem('weekly_review_phase2_report') || '{}');
      const finalReport = {
        ...phase2Report,
        reflectionAfterReload: null,
        savedBadgeVisibleAfterReload: false,
        intentionsAfterReload: [],
        linkedTaskBadgesCountAfterReload: 0,
        storedWeeklyReviewsCount: 0,
        storedWeeklyReviewReflection: null,
        storedLinkedTasksInNextWeekCount: 0,
        storedLinkedTaskTitles: [],
        storedLinkedTaskDueDates: [],
      };

      try {
        for (let i = 0; i < 40; i++) {
          const btn = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent && b.textContent.includes('Weekly Review')
          );
          if (btn) break;
          await wait(100);
        }

        // Reopen Weekly Review after reload
        const weeklyBtn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent && b.textContent.includes('Weekly Review')
        );
        if (!weeklyBtn) throw new Error('Weekly Review button not found after reload');
        weeklyBtn.click();
        await wait(150);

        const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (!dialog) throw new Error('Weekly Review dialog did not reopen after reload');

        const rangeEl3 = dialog.querySelector('[data-testid="weekly-review-date-range"]');
        const prevWeekBtn3 = dialog.querySelector('button[aria-label="Review previous week"]');
        for (let step = 0; step < 10; step++) {
          const txt = rangeEl3 ? rangeEl3.textContent || '' : '';
          if (txt.includes('2026-10-05')) break;
          if (prevWeekBtn3) {
            prevWeekBtn3.click();
            await wait(80);
          }
        }

        const reflectionTextarea = dialog.querySelector('#weekly-review-reflection');
        finalReport.reflectionAfterReload = reflectionTextarea ? reflectionTextarea.value : null;
        finalReport.savedBadgeVisibleAfterReload = Boolean(
          dialog.querySelector('[data-testid="weekly-review-saved-badge"]')
        );

        const clickNextStep = () => {
          const btn = Array.from(dialog.querySelectorAll('button')).find(
            (b) => b.textContent && b.textContent.includes('Next Step')
          );
          if (!btn) throw new Error('Next Step button not found after reload');
          btn.click();
        };

        // Advance to Step 4 to verify retained intentions and linked task badges
        clickNextStep();
        await wait(70);
        clickNextStep();
        await wait(70);
        clickNextStep();
        await wait(100);

        for (let idx = 0; idx < 3; idx++) {
          const input = dialog.querySelector('#weekly-review-intention-' + idx);
          finalReport.intentionsAfterReload.push(input ? input.value : '');
          if (dialog.querySelector('[data-testid="weekly-review-linked-task-badge-' + idx + '"]')) {
            finalReport.linkedTaskBadgesCountAfterReload++;
          }
        }

        // Inspect localStorage data
        const rawData = localStorage.getItem('our_life_planner_data_v1');
        if (rawData) {
          const parsed = JSON.parse(rawData);
          const reviews = Array.isArray(parsed.weeklyReviews) ? parsed.weeklyReviews : [];
          finalReport.storedWeeklyReviewsCount = reviews.length;
          if (reviews[0]) {
            finalReport.storedWeeklyReviewReflection = reviews[0].reflection;
            const linkIds = Object.values(reviews[0].linkedTaskIds || {});
            const linkedTasks = (parsed.tasks || []).filter((t) => linkIds.includes(t.id));
            finalReport.storedLinkedTasksInNextWeekCount = linkedTasks.length;
            finalReport.storedLinkedTaskTitles = linkedTasks.map((t) => t.title);
            finalReport.storedLinkedTaskDueDates = linkedTasks.map((t) => t.dueDate);
          }
        }
      } catch (err) {
        finalReport.error = err && err.message ? err.message : String(err);
      }

      await fetch('/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalReport),
      });
    }
  }

  setTimeout(runTest, 200);
</script>
<img src="/hold-until-complete.gif" style="display:none" />
`;

  const strippedHtml = rawHtml.replace(/<meta[^>]+Content-Security-Policy[^>]*>/gi, '');
  const lastBodyIdx = strippedHtml.lastIndexOf('</body>');
  const instrumentedHtml =
    strippedHtml.slice(0, lastBodyIdx) +
    testHarnessScript +
    '\n</body>' +
    strippedHtml.slice(lastBodyIdx + '</body>'.length);

  return new Promise<BrowserWeeklyReviewReport>((resolve, reject) => {
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
              const parsed = JSON.parse(body) as BrowserWeeklyReviewReport;
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
      const url = `http://127.0.0.1:${addr.port}/?phase=1`;
      const userDataDir = path.resolve(
        process.cwd(),
        'dist',
        `.tmp-edge-weekly-review-${Date.now()}`
      );

      const child = execFile(
        browserExe,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          `--user-data-dir=${userDataDir}`,
          '--virtual-time-budget=25000',
          '--dump-dom',
          url,
        ],
        { timeout: 30000, maxBuffer: 10 * 1024 * 1024 },
        (err) => {
          setTimeout(() => {
            try {
              fs.rmSync(userDataDir, { recursive: true, force: true });
            } catch {
              // ignore cleanup errors
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
          reject(new Error('Timed out waiting for browser weekly review report'));
        }
      }, 28000);
    });
  });
}

async function main() {
  console.log('=== P2 Weekly Review Persistence & Week-Scoped Metrics Verification Suite ===\n');

  // 1. Unit tests for Reviewed Week Range & Week-Scoped Metrics
  console.log('1. Testing Reviewed Week Date Range & Week-Scoped Metrics...');
  const oct5Week = getReviewedWeekRange('2026-10-10', 'Monday');
  assert(oct5Week.weekStartDate === '2026-10-05', 'Week start for 2026-10-10 (Monday start) is 2026-10-05');
  assert(oct5Week.weekEndDate === '2026-10-11', 'Week end for 2026-10-10 (Monday start) is 2026-10-11');
  assert(oct5Week.nextWeekStartDate === '2026-10-12', 'Next week start date is 2026-10-12');
  assert(oct5Week.nextWeekEndDate === '2026-10-18', 'Next week end date is 2026-10-18');
  assert(oct5Week.label.includes('Oct 5') && oct5Week.label.includes('Oct 11'), 'Formatted week label includes Oct 5 and Oct 11');

  const oct5Metrics = calculateWeeklyReviewMetrics({
    tasks: SAMPLE_TASKS,
    workouts: SAMPLE_WORKOUTS,
    habits: SAMPLE_HABITS,
    weekStartDate: oct5Week.weekStartDate,
    weekEndDate: oct5Week.weekEndDate,
  });

  const cumulativeCompletedTasks = SAMPLE_TASKS.filter((t) => t.status === 'completed').length;
  const cumulativeCompletedWorkouts = SAMPLE_WORKOUTS.filter((w) => w.isCompleted).length;

  assert(
    cumulativeCompletedTasks === 3 && oct5Metrics.completedTasksCount === 1,
    `Week 2026-10-05..2026-10-11 scopes completed tasks to 1 ('Plan the week') instead of cumulative ${cumulativeCompletedTasks}`
  );
  assert(
    cumulativeCompletedWorkouts === 4 && oct5Metrics.completedWorkoutsCount === 0,
    `Week 2026-10-05..2026-10-11 scopes completed non-rest workouts to 0 instead of cumulative ${cumulativeCompletedWorkouts}`
  );
  assert(
    oct5Metrics.totalHabitCheckInsCount === 2,
    'Week 2026-10-05..2026-10-11 counts only habit check-ins recorded on 2026-10-05 (2 check-ins across h-1 and h-2, excluding 27 earlier check-ins)'
  );

  const prevWeekStart = shiftWeekDate(oct5Week.weekStartDate, -1);
  const prevWeek = getReviewedWeekRange(prevWeekStart, 'Monday');
  assert(prevWeek.weekStartDate === '2026-09-28' && prevWeek.weekEndDate === '2026-10-04', 'Previous week range is 2026-09-28 to 2026-10-04');

  const prevWeekMetrics = calculateWeeklyReviewMetrics({
    tasks: SAMPLE_TASKS,
    workouts: SAMPLE_WORKOUTS,
    habits: SAMPLE_HABITS,
    weekStartDate: prevWeek.weekStartDate,
    weekEndDate: prevWeek.weekEndDate,
  });
  assert(
    prevWeekMetrics.completedTasksCount === 2,
    'Previous week 2026-09-28..2026-10-04 scopes completed tasks to 2 (t-6 on Oct 4, t-7 on Oct 1)'
  );
  assert(
    prevWeekMetrics.completedWorkoutsCount === 1,
    'Previous week 2026-09-28..2026-10-04 scopes completed workouts to 1 (wo-prev-1 on Oct 2)'
  );
  assert(
    prevWeekMetrics.totalHabitCheckInsCount === 20,
    'Previous week 2026-09-28..2026-10-04 scopes habit check-ins to 20 (7+6+3+4 in that week)'
  );

  // 2. Backup Validation & 3-Way Tab Reconciliation
  console.log('\n2. Testing Backup Validation & Multi-Tab Reconciliation for weeklyReviews...');
  const backupWithReview = createBaseBackup();
  backupWithReview.weeklyReviews = [
    {
      id: 'wrv-2026-10-05',
      weekStartDate: '2026-10-05',
      weekEndDate: '2026-10-11',
      reflection: 'Consistent sleep and meal prep.',
      intentions: ['Priority A', 'Priority B', 'Priority C'],
      linkedTaskIds: { 0: 't-1' },
      completedTasksCount: 1,
      completedWorkoutsCount: 0,
      habitCheckInsCount: 4,
      completedAt: '2026-10-10T20:00:00.000Z',
      updatedAt: '2026-10-10T20:00:00.000Z',
    },
  ];
  const validRes = validateBackupData(backupWithReview);
  assert(validRes.isValid && validRes.data?.weeklyReviews?.length === 1, 'validateBackupData accepts valid weeklyReviews array and preserves it in normalizedData');

  const invalidBackup = createBaseBackup() as any;
  invalidBackup.weeklyReviews = [{ id: 'bad', weekStartDate: 'not-a-date', weekEndDate: '2026-10-11', reflection: 123, intentions: 'bad' }];
  const invalidRes = validateBackupData(invalidBackup);
  assert(!invalidRes.isValid && invalidRes.errors.some((e) => e.includes('weeklyReviews')), 'validateBackupData rejects malformed weeklyReviews entries');

  // Reconcile two tabs adding different weekly reviews
  const baseSnap = createBaseBackup();
  const localSnap = createBaseBackup();
  localSnap.weeklyReviews = [backupWithReview.weeklyReviews[0]];
  const storedSnap = createBaseBackup();
  storedSnap.weeklyReviews = [
    {
      id: 'wrv-2026-09-28',
      weekStartDate: '2026-09-28',
      weekEndDate: '2026-10-04',
      reflection: 'Previous week reflection from Tab B',
      intentions: ['Prev 1', 'Prev 2', 'Prev 3'],
      completedTasksCount: 2,
      completedWorkoutsCount: 1,
      habitCheckInsCount: 21,
      updatedAt: '2026-10-04T20:00:00.000Z',
    },
  ];
  const reconciled = reconcilePlannerData(baseSnap, localSnap, storedSnap);
  assert(
    reconciled.mergedData.weeklyReviews?.length === 2,
    'reconcilePlannerData preserves weeklyReviews from both tabs during 3-way merge'
  );

  // 3. End-to-End Headless Browser Reproduction Test
  console.log('\n3. Running End-to-End Headless Browser Reproduction (Enter reflection -> Advance -> Enter priorities -> Complete Review -> Reload -> Reopen)...');
  const browserReport = await runBrowserReproductionTest();

  if (browserReport.error) {
    console.error('Browser test error:', browserReport.error);
  }

  assert(!browserReport.error, 'Headless browser test completed without runtime errors');
  assert(
    Boolean(
      browserReport.dateRangeText &&
        browserReport.dateRangeText.includes('2026-10-05 to 2026-10-11')
    ),
    `Weekly Review displays exact reviewed date range (${browserReport.dateRangeText})`
  );
  assert(
    browserReport.oct5WeekCompletedTasksText === '1' &&
      browserReport.oct5WeekCompletedWorkoutsText === '0',
    `Step 1 displays week-scoped counts (Tasks=${browserReport.oct5WeekCompletedTasksText}, Workouts=${browserReport.oct5WeekCompletedWorkoutsText}) instead of cumulative totals`
  );
  assert(
    Boolean(
      browserReport.prevWeekDateRangeText &&
        browserReport.prevWeekDateRangeText.includes('2026-09-28 to 2026-10-04') &&
        browserReport.prevWeekCompletedTasksText === '2' &&
        browserReport.prevWeekCompletedWorkoutsText === '1'
    ),
    `Navigating to previous week (2026-09-28 to 2026-10-04) updates metrics to that week (Tasks=${browserReport.prevWeekCompletedTasksText}, Workouts=${browserReport.prevWeekCompletedWorkoutsText})`
  );
  assert(
    browserReport.reflectionAfterReload ===
      'Completed the Q4 budget plan and stayed consistent with morning hydration.',
    'Reflection writing is retained after completing review, reloading the browser, and reopening Weekly Review'
  );
  assert(
    browserReport.savedBadgeVisibleAfterReload === true,
    'Saved Review badge is displayed when reopening a completed weekly review'
  );
  assert(
    browserReport.intentionsAfterReload.length === 3 &&
      browserReport.intentionsAfterReload[0] === 'Finalize household tax documents' &&
      browserReport.intentionsAfterReload[1] === 'Schedule dentist appointment' &&
      browserReport.intentionsAfterReload[2] === 'Prep 3 healthy dinners',
    'All 3 next-week priorities are retained after reloading the browser and reopening Weekly Review'
  );
  assert(
    browserReport.linkedTaskBadgesCountAfterReload === 3 &&
      browserReport.storedLinkedTasksInNextWeekCount === 3 &&
      browserReport.storedLinkedTaskDueDates.every((d) => d === '2026-10-12'),
    'Next-week priorities are turned into linked tasks due on 2026-10-12 (nextWeekStartDate) and remain linked after reload'
  );

  console.log(`\n========================================`);
  console.log(`Weekly Review Verification: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error in test-weekly-review:', err);
  process.exit(1);
});
