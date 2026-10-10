import { HabitItem, TaskItem, WorkoutSession } from '../types/planner';
import { getWeekDaysForDate } from './formatters';

export interface ReviewedWeekRange {
  weekStartDate: string; // YYYY-MM-DD
  weekEndDate: string; // YYYY-MM-DD
  label: string; // e.g. "Oct 5 – Oct 11, 2026"
  shortLabel: string; // e.g. "Oct 5 – Oct 11"
  nextWeekStartDate: string; // YYYY-MM-DD
  nextWeekEndDate: string; // YYYY-MM-DD
  nextWeekLabel: string; // e.g. "Oct 12 – Oct 18, 2026"
}

export interface WeeklyReviewMetrics {
  completedTasks: TaskItem[];
  completedTasksCount: number;
  completedWorkouts: WorkoutSession[];
  completedWorkoutsCount: number;
  habitCheckInsByHabitId: Record<string, number>;
  totalHabitCheckInsCount: number;
}

function parseYmd(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatWeekRangeLabel(
  startDateStr: string,
  endDateStr: string
): { label: string; shortLabel: string } {
  const start = parseYmd(startDateStr);
  const end = parseYmd(endDateStr);

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  const shortLabel =
    startMonth === endMonth
      ? `${startMonth} ${startDay} – ${endDay}`
      : `${startMonth} ${startDay} – ${endMonth} ${endDay}`;

  const label =
    startYear === endYear
      ? `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${endYear}`
      : `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`;

  return { label, shortLabel };
}

export function shiftWeekDate(dateStr: string, deltaWeeks: number): string {
  const d = parseYmd(dateStr);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return toYmd(d);
}

export function getReviewedWeekRange(
  referenceDate: string,
  weekStartsOn: 'Monday' | 'Sunday' = 'Monday'
): ReviewedWeekRange {
  const weekDays = getWeekDaysForDate(referenceDate, weekStartsOn);
  const weekStartDate = weekDays[0].dateStr;
  const weekEndDate = weekDays[6].dateStr;
  const { label, shortLabel } = formatWeekRangeLabel(weekStartDate, weekEndDate);

  const nextStart = parseYmd(weekStartDate);
  nextStart.setDate(nextStart.getDate() + 7);
  const nextEnd = parseYmd(weekEndDate);
  nextEnd.setDate(nextEnd.getDate() + 7);

  const nextWeekStartDate = toYmd(nextStart);
  const nextWeekEndDate = toYmd(nextEnd);
  const { label: nextWeekLabel } = formatWeekRangeLabel(nextWeekStartDate, nextWeekEndDate);

  return {
    weekStartDate,
    weekEndDate,
    label,
    shortLabel,
    nextWeekStartDate,
    nextWeekEndDate,
    nextWeekLabel,
  };
}

/**
 * Determines whether a task was completed within the specified [weekStartDate, weekEndDate] window.
 * Uses the YYYY-MM-DD portion of completedAt when available, falling back to dueDate.
 */
export function isTaskCompletedInWeek(
  task: TaskItem,
  weekStartDate: string,
  weekEndDate: string
): boolean {
  if (task.status !== 'completed' || task.isArchived) return false;
  const completedYmd =
    typeof task.completedAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(task.completedAt)
      ? task.completedAt.slice(0, 10)
      : undefined;
  const effectiveDate = completedYmd || task.dueDate;
  if (!effectiveDate) return false;
  return effectiveDate >= weekStartDate && effectiveDate <= weekEndDate;
}

/**
 * Determines whether a non-rest workout session was completed within [weekStartDate, weekEndDate].
 */
export function isWorkoutCompletedInWeek(
  workout: WorkoutSession,
  weekStartDate: string,
  weekEndDate: string
): boolean {
  if (!workout.isCompleted || workout.isRestDay) return false;
  return workout.date >= weekStartDate && workout.date <= weekEndDate;
}

/**
 * Counts how many check-ins a habit recorded within [weekStartDate, weekEndDate].
 */
export function countHabitCheckInsInWeek(
  habit: HabitItem,
  weekStartDate: string,
  weekEndDate: string
): number {
  if (!Array.isArray(habit.checkedDates)) return 0;
  return habit.checkedDates.filter((d) => d >= weekStartDate && d <= weekEndDate).length;
}

export function calculateWeeklyReviewMetrics(params: {
  tasks: TaskItem[];
  workouts: WorkoutSession[];
  habits: HabitItem[];
  weekStartDate: string;
  weekEndDate: string;
}): WeeklyReviewMetrics {
  const { tasks, workouts, habits, weekStartDate, weekEndDate } = params;

  const completedTasks = tasks.filter((t) =>
    isTaskCompletedInWeek(t, weekStartDate, weekEndDate)
  );
  const completedWorkouts = workouts.filter((w) =>
    isWorkoutCompletedInWeek(w, weekStartDate, weekEndDate)
  );

  const habitCheckInsByHabitId: Record<string, number> = {};
  let totalHabitCheckInsCount = 0;

  for (const h of habits) {
    const count = countHabitCheckInsInWeek(h, weekStartDate, weekEndDate);
    habitCheckInsByHabitId[h.id] = count;
    totalHabitCheckInsCount += count;
  }

  return {
    completedTasks,
    completedTasksCount: completedTasks.length,
    completedWorkouts,
    completedWorkoutsCount: completedWorkouts.length,
    habitCheckInsByHabitId,
    totalHabitCheckInsCount,
  };
}
