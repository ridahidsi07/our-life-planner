import {
  computeInsights,
  getTaskCompletionDate,
  InsightsRange,
} from '../src/utils/insightsMetrics';
import { TaskItem } from '../src/types/planner';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
  }
}

console.log('================================================================');
console.log('INDEPENDENT REVIEW CORRECTION PASS (R1–R8) REGRESSION TEST SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// R1: Truthful Completion Analytics
// -----------------------------------------------------------------------------
console.log('--- R1: Truthful Completion Analytics ---');

// 1. Missing completedAt timestamp must not infer dueDate or createdAt
const taskWithoutCompletedAt: TaskItem = {
  id: 'task-no-completed-at',
  title: 'Old task without timestamp',
  category: 'Career',
  status: 'completed',
  createdAt: '2026-09-01T10:00:00Z',
  dueDate: '2026-10-14',
  completedAt: undefined,
};

const dateFromMissing = getTaskCompletionDate(taskWithoutCompletedAt, 'Africa/Casablanca');
assert(
  dateFromMissing === null,
  'R1.1: Missing completedAt returns null, does not fall back to dueDate or createdAt'
);

// 2. Invalid completedAt string returns null
const taskWithInvalidDate: TaskItem = {
  id: 'task-invalid-date',
  title: 'Task with corrupted date',
  category: 'Career',
  status: 'completed',
  createdAt: '2026-09-01T10:00:00Z',
  dueDate: '2026-10-14',
  completedAt: 'invalid-iso-string',
};
const dateFromInvalid = getTaskCompletionDate(taskWithInvalidDate, 'Africa/Casablanca');
assert(
  dateFromInvalid === null,
  'R1.2: Invalid completedAt returns null'
);

// 3. Timezone boundary test: 2026-10-13T23:30:00Z in Africa/Casablanca (UTC+1) is 2026-10-14 00:30
const taskCasablancaMidnight: TaskItem = {
  id: 'task-casa-midnight',
  title: 'Task completed at UTC midnight boundary',
  category: 'Career',
  status: 'completed',
  createdAt: '2026-10-01T10:00:00Z',
  completedAt: '2026-10-13T23:30:00Z',
};
const casaDate = getTaskCompletionDate(taskCasablancaMidnight, 'Africa/Casablanca');
assert(
  casaDate === '2026-10-14',
  'R1.3: 2026-10-13T23:30:00Z in Africa/Casablanca maps to 2026-10-14',
  `Got: ${casaDate}`
);

// 4. Tasks with unknown history are counted in unknownHistoryCount and excluded from throughput
const metricsWithUnknown = computeInsights(
  [taskWithoutCompletedAt, taskWithInvalidDate],
  '2026-10-15',
  '30D',
  'Africa/Casablanca'
);
assert(
  metricsWithUnknown.unknownHistoryCount === 2,
  'R1.4: Tasks with unknown history count toward unknownHistoryCount',
  `Got: ${metricsWithUnknown.unknownHistoryCount}`
);
assert(
  metricsWithUnknown.completedCount === 0,
  'R1.5: Tasks with unknown history are excluded from dated throughput completedCount',
  `Got: ${metricsWithUnknown.completedCount}`
);

// 5. Zero eligible records in period returns onTimeRate: null, not 100%
assert(
  metricsWithUnknown.onTimeRate === null,
  'R1.6: Zero eligible completed tasks in period returns onTimeRate: null (not 100%)',
  `Got: ${metricsWithUnknown.onTimeRate}`
);

// 6. Task without due date is included in throughput but does not skew onTimeRate
const taskNoDueDate: TaskItem = {
  id: 'task-no-due',
  title: 'Task with no due date',
  category: 'Personal',
  status: 'completed',
  createdAt: '2026-10-10T10:00:00Z',
  completedAt: '2026-10-12T14:00:00Z',
};
const metricsWithNoDue = computeInsights(
  [taskNoDueDate],
  '2026-10-15',
  '30D',
  'Africa/Casablanca'
);
assert(
  metricsWithNoDue.completedCount === 1,
  'R1.7: Completed task without due date counts in completedCount'
);
assert(
  metricsWithNoDue.onTimeRate === null,
  'R1.8: Task without due date does not count in onTimeRate (rate is null with 0 due-date completions)',
  `Got: ${metricsWithNoDue.onTimeRate}`
);

// 7. Reopening a task removes it from completion metrics
const reopenedTask: TaskItem = {
  ...taskNoDueDate,
  status: 'in_progress',
  completedAt: undefined,
};
const metricsReopened = computeInsights(
  [reopenedTask],
  '2026-10-15',
  '30D',
  'Africa/Casablanca'
);
assert(
  metricsReopened.completedCount === 0 && metricsReopened.unknownHistoryCount === 0,
  'R1.9: Reopening task (status in_progress, completedAt undefined) removes it from completion metrics'
);

// 8. 7, 30, and 90 day ranges filter correctly
const task8DaysAgo: TaskItem = {
  id: 'task-8-days',
  title: 'Task 8 days ago',
  category: 'Career',
  status: 'completed',
  createdAt: '2026-10-01T10:00:00Z',
  completedAt: '2026-10-07T12:00:00Z',
};
const metrics7Days = computeInsights([task8DaysAgo], '2026-10-15', '7D', 'UTC');
const metrics30Days = computeInsights([task8DaysAgo], '2026-10-15', '30D', 'UTC');
const metrics90Days = computeInsights([task8DaysAgo], '2026-10-15', '90D', 'UTC');
assert(
  metrics7Days.completedCount === 0,
  'R1.10: Task from 8 days ago is excluded from 7-day range'
);
assert(
  metrics30Days.completedCount === 1,
  'R1.11: Task from 8 days ago is included in 30-day range'
);
assert(
  metrics90Days.completedCount === 1,
  'R1.12: Task from 8 days ago is included in 90-day range'
);

console.log('\n--- R2: Custom Category Aggregation ---');

// 9. Three tasks in custom category produce count 3 and 100%
const customTasks: TaskItem[] = [
  { id: 't1', title: 'Task 1', category: 'Custom', status: 'not_started', createdAt: '2026-10-01' },
  { id: 't2', title: 'Task 2', category: 'Custom', status: 'in_progress', createdAt: '2026-10-01' },
  { id: 't3', title: 'Task 3', category: 'Custom', status: 'completed', createdAt: '2026-10-01' },
];
const customMetrics = computeInsights(customTasks, '2026-10-15', '30D', 'UTC');
const customCat = customMetrics.categoryDistribution['Custom'];
assert(
  customCat !== undefined && customCat.count === 3 && customCat.percentage === 100,
  'R2.1: Three tasks in "Custom" category produce count: 3 and percentage: 100%',
  `Got count=${customCat?.count}, pct=${customCat?.percentage}`
);

// 10. Repeated custom categories and mixed standard categories
const mixedTasks: TaskItem[] = [
  { id: 't1', title: 'Task 1', category: 'Side Project', status: 'not_started', createdAt: '2026-10-01' },
  { id: 't2', title: 'Task 2', category: 'Side Project', status: 'not_started', createdAt: '2026-10-01' },
  { id: 't3', title: 'Task 3', category: 'Career', status: 'not_started', createdAt: '2026-10-01' },
  { id: 't4', title: 'Task 4', category: 'Personal', status: 'not_started', createdAt: '2026-10-01' },
];
const mixedMetrics = computeInsights(mixedTasks, '2026-10-15', '30D', 'UTC');
const sideProjectCat = mixedMetrics.categoryDistribution['Side Project'];
assert(
  sideProjectCat !== undefined && sideProjectCat.count === 2 && sideProjectCat.percentage === 50,
  'R2.2: Repeated custom category "Side Project" produces count: 2 and 50%',
  `Got count=${sideProjectCat?.count}, pct=${sideProjectCat?.percentage}`
);

// 11. Missing category gracefully defaults to 'Other'
const missingCatTask: TaskItem = {
  id: 't-no-cat',
  title: 'No category',
  category: '' as any,
  status: 'not_started',
  createdAt: '2026-10-01',
};
const missingCatMetrics = computeInsights([missingCatTask], '2026-10-15', '30D', 'UTC');
const fallbackCat = missingCatMetrics.categoryDistribution['Other'];
assert(
  fallbackCat !== undefined && fallbackCat.count === 1,
  'R2.3: Task with empty category defaults to "Other"',
  `Got: ${JSON.stringify(fallbackCat)}`
);

// 12. Archived tasks are excluded from category distribution
const archivedTask: TaskItem = {
  id: 't-archived',
  title: 'Archived task',
  category: 'Custom',
  status: 'not_started',
  createdAt: '2026-10-01',
  isArchived: true,
};
const metricsWithArchived = computeInsights(
  [...customTasks, archivedTask],
  '2026-10-15',
  '30D',
  'UTC'
);
const customCatAfterArchived = metricsWithArchived.categoryDistribution['Custom'];
assert(
  customCatAfterArchived?.count === 3,
  'R2.4: Archived tasks are excluded from active category distribution (count remains 3)'
);

console.log('\n--- R3: Scope & Disclosure Across Views ---');

// 13. Verify TasksView passes filteredTasks and filter disclosure props to TasksInsightsView
const tasksViewPath = path.resolve(process.cwd(), 'src', 'components', 'tasks', 'TasksView.tsx');
const tasksViewContent = fs.readFileSync(tasksViewPath, 'utf-8');

assert(
  tasksViewContent.includes('<TasksInsightsView') &&
  tasksViewContent.includes('tasks={filteredTasks}') &&
  tasksViewContent.includes('allTasksCount={tasks.length}'),
  'R3.1: TasksView passes filteredTasks and allTasksCount to TasksInsightsView'
);

// 14. Verify TasksInsightsView displays filter disclosure banner with clear button
const insightsViewPath = path.resolve(process.cwd(), 'src', 'components', 'tasks', 'TasksInsightsView.tsx');
const insightsViewContent = fs.readFileSync(insightsViewPath, 'utf-8');

assert(
  insightsViewContent.includes('data-testid="insights-filter-disclosure"') &&
  insightsViewContent.includes('Clear active filters'),
  'R3.2: TasksInsightsView has data-testid="insights-filter-disclosure" and Clear active filters button'
);

// 15. Verify TasksInsightsView displays unknown history notice
assert(
  insightsViewContent.includes('data-testid="insights-unknown-history-notice"') &&
  insightsViewContent.includes('unknownHistoryCount'),
  'R3.3: TasksInsightsView has data-testid="insights-unknown-history-notice" when unknownHistoryCount > 0'
);

console.log('\n--- R4: Calendar Month Events, Agenda & Upcoming Reconciliation ---');

const calendarViewPath = path.resolve(process.cwd(), 'src', 'components', 'calendar', 'CalendarView.tsx');
const calendarViewContent = fs.readFileSync(calendarViewPath, 'utf-8');

// 16. Month events map includes meals and goals
assert(
  calendarViewContent.includes('filters.meals') &&
  calendarViewContent.includes('plannedMeals.forEach') &&
  calendarViewContent.includes('filters.goals') &&
  calendarViewContent.includes('goals.forEach'),
  'R4.1: Calendar monthEventsMap registers meals and goals based on active filters'
);

// 17. Upcoming items includes routines, goals, and meals
assert(
  calendarViewContent.includes("type: 'Routine'") &&
  calendarViewContent.includes("type: 'Goal'") &&
  calendarViewContent.includes("type: 'Meal'"),
  'R4.2: Calendar upcomingItems includes routines, goals, and meals'
);

// 18. "Tomorrow" relative label is strictly day + 1
assert(
  calendarViewContent.includes('shiftCalendarDate(currentDate, 1)') &&
  calendarViewContent.includes('isTomorrow') &&
  calendarViewContent.includes("'Tomorrow'"),
  'R4.3: "Tomorrow" relative label is strictly applied only to tomorrow (day +1)'
);

// 19. Cell accessible label matches exact event count
assert(
  calendarViewContent.includes('cellEventsCount') &&
  calendarViewContent.includes('monthEventsMap.get(cell.dateStr)') &&
  calendarViewContent.includes('cellEventsCount === 1'),
  'R4.4: Accessible month cell label matches exact count of events for that day'
);

console.log('\n--- R5: Role-Based Accent Tokens ---');

// 20. Verify var(--accent) usage in primary views
const checkAccentUsage = (filePath: string, fileName: string) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  assert(
    content.includes('var(--accent'),
    `R5: ${fileName} uses var(--accent) tokens`
  );
};

checkAccentUsage(path.resolve(process.cwd(), 'src', 'components', 'tasks', 'TasksThroughputChart.tsx'), 'TasksThroughputChart');
checkAccentUsage(path.resolve(process.cwd(), 'src', 'components', 'tasks', 'TasksInsightsView.tsx'), 'TasksInsightsView');
checkAccentUsage(path.resolve(process.cwd(), 'src', 'components', 'tasks', 'TasksView.tsx'), 'TasksView');
checkAccentUsage(path.resolve(process.cwd(), 'src', 'components', 'modals', 'QuickAddModal.tsx'), 'QuickAddModal');
checkAccentUsage(path.resolve(process.cwd(), 'src', 'components', 'calendar', 'CalendarView.tsx'), 'CalendarView');
checkAccentUsage(path.resolve(process.cwd(), 'src', 'components', 'today', 'TodayDashboard.tsx'), 'TodayDashboard');
checkAccentUsage(path.resolve(process.cwd(), 'src', 'components', 'money', 'BudgetBillsView.tsx'), 'BudgetBillsView');
checkAccentUsage(path.resolve(process.cwd(), 'src', 'components', 'ui', 'RingProgress.tsx'), 'RingProgress');
checkAccentUsage(path.resolve(process.cwd(), 'src', 'components', 'ui', 'SegmentedControl.tsx'), 'SegmentedControl');
checkAccentUsage(path.resolve(process.cwd(), 'src', 'components', 'ui', 'FilterEmptyState.tsx'), 'FilterEmptyState');

console.log('\n--- R6: 320px Responsive Layouts ---');

// 21. QuickAddModal category grid uses responsive cols (grid-cols-3 sm:grid-cols-6)
const quickAddPath = path.resolve(process.cwd(), 'src', 'components', 'modals', 'QuickAddModal.tsx');
const quickAddContent = fs.readFileSync(quickAddPath, 'utf-8');
assert(
  quickAddContent.includes('grid-cols-3 sm:grid-cols-6'),
  'R6.1: QuickAddModal category picker uses grid-cols-3 sm:grid-cols-6 for 320px screens'
);

// 22. TasksView toolbar container uses flex-wrap and responsive sizing
assert(
  tasksViewContent.includes('flex flex-wrap items-center justify-between sm:justify-end gap-2.5 w-full md:w-auto'),
  'R6.2: TasksView toolbar container wraps cleanly without clipping on 320px viewports'
);

console.log('\n--- R7: Compact Focus Available in Core Starter Preset ---');

// 23. TodayDashboard hasRightWidgets includes isFocusVisible
const todayDashboardPath = path.resolve(process.cwd(), 'src', 'components', 'today', 'TodayDashboard.tsx');
const todayContent = fs.readFileSync(todayDashboardPath, 'utf-8');
assert(
  todayContent.includes('hasRightWidgets') &&
  todayContent.includes('isFocusVisible') &&
  todayContent.includes('isHabitsVisible || isWaterVisible || isMoneyVisible || isGoalsVisible || isHealthVisible || isFocusVisible'),
  'R7.1: TodayDashboard hasRightWidgets includes isFocusVisible'
);
assert(
  todayContent.includes('data-testid="today-compact-focus-card"'),
  'R7.2: TodayDashboard renders data-testid="today-compact-focus-card"'
);

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`CORRECTION PASS REGRESSION RESULTS: ${passed} passed, ${failed} failed`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
