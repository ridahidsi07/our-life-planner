import { TaskItem, Priority } from '../types/planner';
import { getRealTodayDate } from './recurrence';

export type InsightsRange = '7D' | '30D' | '90D';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  daysCount: number;
}

export interface DailyThroughputPoint {
  date: string;       // YYYY-MM-DD
  label: string;      // short label e.g. "Oct 12" or "Mon 12"
  thisPeriodCount: number;
  previousPeriodCount: number;
  prevDate: string;   // YYYY-MM-DD of equivalent previous day
}

export interface MetricComparison {
  currentValue: number | null;
  previousValue: number | null;
  delta: number | null;
  percentChange: number | null; // null if previous was 0 or either is null
  formattedChange: string;
  isPositive: boolean;
  isNegative: boolean;
  isNeutral: boolean;
}

export interface InsightsSummary {
  range: InsightsRange;
  currentRange: DateRange;
  previousRange: DateRange;
  completedTasks: TaskItem[];
  completedCount: number;
  previousCompletedCount: number;
  completedMetric: MetricComparison;
  dailyVelocity: number;
  previousVelocity: number;
  velocityMetric: MetricComparison;
  onTimeRate: number | null; // percentage 0-100 or null if no eligible completions in period
  previousOnTimeRate: number | null;
  onTimeMetric: MetricComparison;
  eligibleOnTimeCount: number;
  activeBacklogCount: number;
  urgentHighBacklogCount: number;
  overdueBacklogCount: number;
  unknownHistoryCount: number;
  throughputPoints: DailyThroughputPoint[];
  maxDailyCount: number;
  categoryDistribution: Record<string, { count: number; percentage: number; color: string }>;
  statusCounts: {
    not_started: number;
    in_progress: number;
    on_hold: number;
    completed: number;
  };
}

export const CATEGORY_COLORS: Record<string, string> = {
  Personal: '#087F83',      // Deep Teal
  Career: '#3B82F6',        // Blue
  Health: '#10B981',        // Emerald
  Finances: '#F59E0B',      // Amber
  Relationships: '#8B5CF6', // Purple
  Other: '#64748B',         // Slate
};

/**
 * Format a Date object to YYYY-MM-DD
 */
export function formatDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Add or subtract days from an ISO date string
 */
export function addDaysToIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return formatDateIso(date);
}

/**
 * Get the date range boundaries for a given range (7D, 30D, 90D)
 */
export function getInsightsRanges(currentDate: string, range: InsightsRange): {
  currentRange: DateRange;
  previousRange: DateRange;
} {
  const daysCount = range === '7D' ? 7 : range === '30D' ? 30 : 90;

  // Current period ends on currentDate (inclusive) and goes back (daysCount - 1) days
  const currentStart = addDaysToIso(currentDate, -(daysCount - 1));
  const currentEnd = currentDate;

  // Previous period ends on the day before currentStart and goes back (daysCount - 1) days
  const prevEnd = addDaysToIso(currentStart, -1);
  const prevStart = addDaysToIso(prevEnd, -(daysCount - 1));

  return {
    currentRange: { startDate: currentStart, endDate: currentEnd, daysCount },
    previousRange: { startDate: prevStart, endDate: prevEnd, daysCount },
  };
}

/**
 * Extract completion date (YYYY-MM-DD) from a task.
 * Note: Never infers from dueDate or createdAt. Only valid completedAt timestamps
 * are interpreted in the configured timezone.
 */
export function getTaskCompletionDate(task: TaskItem, timeZone?: string): string | null {
  if (task.status !== 'completed') return null;
  if (!task.completedAt || typeof task.completedAt !== 'string') return null;

  const parsed = new Date(task.completedAt);
  if (isNaN(parsed.getTime())) return null;

  return getRealTodayDate(timeZone, parsed);
}

/**
 * Calculate metric comparison between two periods
 */
export function calculateComparison(
  current: number | null,
  previous: number | null,
  formatAsPercentage = false
): MetricComparison {
  if (current === null || previous === null) {
    return {
      currentValue: current,
      previousValue: previous,
      delta: null,
      percentChange: null,
      formattedChange: '—',
      isPositive: false,
      isNegative: false,
      isNeutral: true,
    };
  }

  const delta = current - previous;
  let percentChange: number | null = null;

  if (previous > 0) {
    percentChange = Math.round(((current - previous) / previous) * 100);
  }

  let formattedChange = '–';
  if (previous === 0 && current === 0) {
    formattedChange = '0.0%';
  } else if (previous === 0 && current > 0) {
    formattedChange = `+${current}${formatAsPercentage ? '%' : ''}`;
  } else if (percentChange !== null) {
    const sign = percentChange > 0 ? '+' : '';
    formattedChange = `${sign}${percentChange}%`;
  }

  return {
    currentValue: current,
    previousValue: previous,
    delta,
    percentChange,
    formattedChange,
    isPositive: delta > 0,
    isNegative: delta < 0,
    isNeutral: delta === 0,
  };
}

/**
 * Generate throughput daily series and summary analytics
 */
export function computeInsights(
  tasks: TaskItem[],
  currentDate: string,
  range: InsightsRange = '30D',
  timeZone?: string
): InsightsSummary {
  const { currentRange, previousRange } = getInsightsRanges(currentDate, range);

  // Active non-archived tasks
  const activeTasks = tasks.filter((t) => !t.isArchived);

  // Count legacy or invalid completion records with unknown history
  const unknownHistoryCount = activeTasks.filter(
    (t) => t.status === 'completed' && !getTaskCompletionDate(t, timeZone)
  ).length;

  // Identify completed tasks in current period using valid completedAt
  const completedInCurrent = activeTasks.filter((t) => {
    const compDate = getTaskCompletionDate(t, timeZone);
    return compDate !== null && compDate >= currentRange.startDate && compDate <= currentRange.endDate;
  });

  // Completed tasks in previous period using valid completedAt
  const completedInPrevious = activeTasks.filter((t) => {
    const compDate = getTaskCompletionDate(t, timeZone);
    return compDate !== null && compDate >= previousRange.startDate && compDate <= previousRange.endDate;
  });

  const completedCount = completedInCurrent.length;
  const previousCompletedCount = completedInPrevious.length;
  const completedMetric = calculateComparison(completedCount, previousCompletedCount);

  // Velocity (tasks per day)
  const dailyVelocity = parseFloat((completedCount / currentRange.daysCount).toFixed(2));
  const previousVelocity = parseFloat((previousCompletedCount / previousRange.daysCount).toFixed(2));
  const velocityMetric = calculateComparison(dailyVelocity, previousVelocity);

  // On-time completion rate:
  // Of completed tasks in period that have a dueDate, was compDate <= dueDate?
  const completedWithDue = completedInCurrent.filter((t) => Boolean(t.dueDate));
  const onTimeCount = completedWithDue.filter((t) => {
    const compDate = getTaskCompletionDate(t, timeZone);
    return compDate !== null && t.dueDate && compDate <= t.dueDate;
  }).length;

  // If no eligible completed tasks with due dates in period, rate is null (unavailable), not 100%
  const onTimeRate =
    completedWithDue.length > 0 ? Math.round((onTimeCount / completedWithDue.length) * 100) : null;

  const prevCompletedWithDue = completedInPrevious.filter((t) => Boolean(t.dueDate));
  const prevOnTimeCount = prevCompletedWithDue.filter((t) => {
    const compDate = getTaskCompletionDate(t, timeZone);
    return compDate !== null && t.dueDate && compDate <= t.dueDate;
  }).length;

  const previousOnTimeRate =
    prevCompletedWithDue.length > 0
      ? Math.round((prevOnTimeCount / prevCompletedWithDue.length) * 100)
      : null;

  const onTimeMetric = calculateComparison(onTimeRate, previousOnTimeRate, true);

  // Active backlog (all open non-completed tasks regardless of date)
  const openTasks = activeTasks.filter((t) => t.status !== 'completed');
  const activeBacklogCount = openTasks.length;
  const urgentHighBacklogCount = openTasks.filter(
    (t) => t.priority === 'urgent' || t.priority === 'high'
  ).length;
  const overdueBacklogCount = openTasks.filter(
    (t) => t.dueDate && t.dueDate < currentDate
  ).length;

  // Build daily throughput series for each day in current range
  // and pair with equivalent day in previous range
  const throughputPoints: DailyThroughputPoint[] = [];
  let maxDailyCount = 1; // minimum ceiling so chart has scale

  for (let i = 0; i < currentRange.daysCount; i++) {
    const thisDate = addDaysToIso(currentRange.startDate, i);
    const prevDate = addDaysToIso(previousRange.startDate, i);

    const thisCount = completedInCurrent.filter(
      (t) => getTaskCompletionDate(t, timeZone) === thisDate
    ).length;
    const prevCount = completedInPrevious.filter(
      (t) => getTaskCompletionDate(t, timeZone) === prevDate
    ).length;

    if (thisCount > maxDailyCount) maxDailyCount = thisCount;
    if (prevCount > maxDailyCount) maxDailyCount = prevCount;

    // Format human readable label (e.g. "Oct 12")
    const [y, m, d] = thisDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const monthShort = dateObj.toLocaleDateString('en-US', { month: 'short' });
    const label = `${monthShort} ${d}`;

    throughputPoints.push({
      date: thisDate,
      label,
      thisPeriodCount: thisCount,
      previousPeriodCount: prevCount,
      prevDate,
    });
  }

  // Category distribution of all active tasks (R2 fix)
  // Aggregate every eligible task exactly once, supporting custom/imported strings
  const standardCategories = ['Personal', 'Career', 'Health', 'Finances', 'Relationships'];
  const categoryCounts: Record<string, number> = {};
  for (const cat of standardCategories) {
    categoryCounts[cat] = 0;
  }
  for (const t of activeTasks) {
    const cat = t.category && t.category.trim() ? t.category.trim() : 'Other';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  const totalCatTasks = activeTasks.length;
  const categoryDistribution: Record<string, { count: number; percentage: number; color: string }> = {};

  for (const [cat, count] of Object.entries(categoryCounts)) {
    // Retain standard categories (for matrix table) and custom categories with count > 0
    if (count > 0 || standardCategories.includes(cat)) {
      categoryDistribution[cat] = {
        count,
        percentage: totalCatTasks > 0 ? Math.round((count / totalCatTasks) * 100) : 0,
        color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other,
      };
    }
  }

  // Stored Status Counts
  const statusCounts = {
    not_started: activeTasks.filter((t) => t.status === 'not_started').length,
    in_progress: activeTasks.filter((t) => t.status === 'in_progress').length,
    on_hold: activeTasks.filter((t) => t.status === 'on_hold').length,
    completed: activeTasks.filter((t) => t.status === 'completed').length,
  };

  return {
    range,
    currentRange,
    previousRange,
    completedTasks: completedInCurrent,
    completedCount,
    previousCompletedCount,
    completedMetric,
    dailyVelocity,
    previousVelocity,
    velocityMetric,
    onTimeRate,
    previousOnTimeRate,
    onTimeMetric,
    eligibleOnTimeCount: completedWithDue.length,
    activeBacklogCount,
    urgentHighBacklogCount,
    overdueBacklogCount,
    unknownHistoryCount,
    throughputPoints,
    maxDailyCount,
    categoryDistribution,
    statusCounts,
  };
}
