import { RoutineItem } from '../types/planner';

/**
 * Checks if a recurring routine is scheduled to occur on a specific date (YYYY-MM-DD).
 * Adheres strictly to Section 4 & Section 5 recurrence rules:
 * - Start date anchoring
 * - Pause suppression from pausedDate
 * - Day-of-week checks
 * - Month-end missing day rule (e.g. Jan 31 -> Feb 28/29)
 * - Leap year February 29 adjustment to Feb 28 in non-leap years
 */
export function isRoutineScheduledOnDate(routine: RoutineItem, dateStr: string): boolean {
  if (routine.startDate > dateStr) {
    return false;
  }

  // If paused and pause date is on or before this date, it's suppressed
  if (routine.isPaused) {
    if (routine.pausedDate && dateStr >= routine.pausedDate) {
      return false;
    }
    if (!routine.pausedDate) {
      return false;
    }
  }

  const [startYear, startMonth, startDay] = routine.startDate.split('-').map(Number);
  const [targetYear, targetMonth, targetDay] = dateStr.split('-').map(Number);

  const targetDateObj = new Date(targetYear, targetMonth - 1, targetDay);
  const startDateObj = new Date(startYear, startMonth - 1, startDay);

  const targetDayOfWeek = targetDateObj.getDay(); // 0 = Sunday, 1 = Monday, ...

  const interval = routine.interval;

  if (interval === 'daily') {
    if (routine.customEveryCount && routine.customEveryCount > 1) {
      const diffMs = targetDateObj.getTime() - startDateObj.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays % routine.customEveryCount === 0;
    }
    return true;
  }

  if (interval === 'weekly') {
    // If specific weekdays are specified
    if (routine.weekdays && routine.weekdays.length > 0) {
      if (!routine.weekdays.includes(targetDayOfWeek)) {
        return false;
      }
    } else {
      // Default to start date's weekday
      if (targetDayOfWeek !== startDateObj.getDay()) {
        return false;
      }
    }

    const customWeeks = routine.customEveryCount || 1;
    if (customWeeks > 1) {
      // Check week interval from start date
      const diffMs = targetDateObj.getTime() - startDateObj.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.floor(diffDays / 7);
      return diffWeeks >= 0 && diffWeeks % customWeeks === 0;
    }
    return true;
  }

  if (interval === 'monthly') {
    const customMonths = routine.customEveryCount || 1;
    const monthDiff = (targetYear - startYear) * 12 + (targetMonth - startMonth);
    if (monthDiff < 0 || monthDiff % customMonths !== 0) {
      return false;
    }

    // Days in target month
    const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    // If start day is greater than days in target month (e.g. 31st in a 30-day month or Feb)
    const effectiveDay = Math.min(startDay, daysInTargetMonth);
    return targetDay === effectiveDay;
  }

  if (interval === 'yearly') {
    const customYears = routine.customEveryCount || 1;
    const yearDiff = targetYear - startYear;
    if (yearDiff < 0 || yearDiff % customYears !== 0) {
      return false;
    }

    // Check month
    if (targetMonth !== startMonth) {
      return false;
    }

    // Check February 29 leap day adjustment
    if (startMonth === 2 && startDay === 29) {
      const isLeapYear = (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0;
      const expectedDay = isLeapYear ? 29 : 28;
      return targetDay === expectedDay;
    }

    return targetDay === startDay;
  }

  if (interval === 'custom') {
    const unit = routine.customUnit || 'weeks';
    const count = routine.customEveryCount || 1;

    if (unit === 'days') {
      const diffMs = targetDateObj.getTime() - startDateObj.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays % count === 0;
    }

    if (unit === 'weeks') {
      if (routine.weekdays && routine.weekdays.length > 0) {
        if (!routine.weekdays.includes(targetDayOfWeek)) return false;
      } else {
        if (targetDayOfWeek !== startDateObj.getDay()) return false;
      }
      const diffMs = targetDateObj.getTime() - startDateObj.getTime();
      const diffWeeks = Math.floor(Math.round(diffMs / (1000 * 60 * 60 * 24)) / 7);
      return diffWeeks >= 0 && diffWeeks % count === 0;
    }

    if (unit === 'months') {
      const monthDiff = (targetYear - startYear) * 12 + (targetMonth - startMonth);
      if (monthDiff < 0 || monthDiff % count !== 0) return false;
      const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
      const effectiveDay = Math.min(startDay, daysInTargetMonth);
      return targetDay === effectiveDay;
    }

    if (unit === 'years') {
      const yearDiff = targetYear - startYear;
      if (yearDiff < 0 || yearDiff % count !== 0) return false;
      if (targetMonth !== startMonth) return false;
      if (startMonth === 2 && startDay === 29) {
        const isLeapYear = (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0;
        return targetDay === (isLeapYear ? 29 : 28);
      }
      return targetDay === startDay;
    }
  }

  return false;
}
