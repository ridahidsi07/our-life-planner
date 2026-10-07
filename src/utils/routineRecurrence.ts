import { RoutineItem } from '../types/planner';

/**
 * Checks if a year is a leap year (Gregorian).
 */
export function isLeapYear(year: number): number | boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns number of days in a given month (1-indexed month: 1=Jan, 12=Dec).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Parses YYYY-MM-DD safely in UTC to prevent timezone shifts.
 */
export function parseIsoDate(dateStr: string): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
} {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  return {
    year: y,
    month: m,
    day: d,
    dayOfWeek: utcDate.getUTCDay(),
  };
}

/**
 * Calculates absolute day difference (dateB - dateA) in days.
 */
export function getDiffDays(dateA: string, dateB: string): number {
  const [y1, m1, d1] = dateA.split('-').map(Number);
  const [y2, m2, d2] = dateB.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

/**
 * Formats ISO date to friendly display (e.g. "10 Apr 2028").
 */
export function formatFriendlyDate(dateStr: string): string {
  try {
    const { year, month, day } = parseIsoDate(dateStr);
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Returns human-readable summary of recurrence rule.
 */
export function formatRecurrenceRule(routine: RoutineItem): string {
  const interval = routine.interval;
  const count = routine.customEveryCount || 1;
  const unit = routine.customUnit || 'weeks';
  const weekdays = routine.weekdays && routine.weekdays.length > 0 ? routine.weekdays : [];

  if (interval === 'daily') {
    return count > 1 ? `Every ${count} days` : 'Daily';
  }

  if (interval === 'weekly') {
    const dayStr = weekdays.length > 0
      ? weekdays.map((d) => WEEKDAY_NAMES[d]).join(', ')
      : WEEKDAY_NAMES[parseIsoDate(routine.startDate).dayOfWeek];
    return count > 1 ? `Every ${count} wks on ${dayStr}` : `Weekly on ${dayStr}`;
  }

  if (interval === 'monthly') {
    const { day } = parseIsoDate(routine.startDate);
    const suffix =
      day === 1 || day === 21 || day === 31
        ? 'st'
        : day === 2 || day === 22
        ? 'nd'
        : day === 3 || day === 23
        ? 'rd'
        : 'th';
    return count > 1 ? `Every ${count} mos on ${day}${suffix}` : `Monthly on ${day}${suffix}`;
  }

  if (interval === 'yearly') {
    const { month, day } = parseIsoDate(routine.startDate);
    const isLeapAnchor = month === 2 && day === 29;
    const base = isLeapAnchor ? 'Yearly on Feb 29 (leap)' : `Yearly on ${formatFriendlyDate(routine.startDate).split(' ').slice(0, 2).join(' ')}`;
    return count > 1 ? `Every ${count} yrs (${base})` : base;
  }

  if (interval === 'custom') {
    if (unit === 'days') {
      return `Every ${count} day${count > 1 ? 's' : ''}`;
    }
    if (unit === 'weeks') {
      const dayStr = weekdays.length > 0
        ? ` on ${weekdays.map((d) => WEEKDAY_NAMES[d]).join(', ')}`
        : '';
      return `Every ${count} week${count > 1 ? 's' : ''}${dayStr}`;
    }
    if (unit === 'months') {
      const { day } = parseIsoDate(routine.startDate);
      return `Every ${count} month${count > 1 ? 's' : ''} on day ${day}`;
    }
    if (unit === 'years') {
      const { month, day } = parseIsoDate(routine.startDate);
      const isLeapAnchor = month === 2 && day === 29;
      return `Every ${count} year${count > 1 ? 's' : ''}${isLeapAnchor ? ' (Feb 29 anchor)' : ''}`;
    }
    return `Every ${count} ${unit}`;
  }

  return 'Custom';
}

/**
 * Determines whether a routine is scheduled on targetDateStr (YYYY-MM-DD).
 */
export function isRoutineActiveOnDate(
  routine: RoutineItem,
  targetDateStr: string,
  options?: {
    includePaused?: boolean;
    includeSkipped?: boolean;
  }
): boolean {
  // 1. Paused check
  if (routine.isPaused && !options?.includePaused) {
    return false;
  }

  // 2. Start date check (cannot occur before startDate)
  if (targetDateStr < routine.startDate) {
    return false;
  }

  // 3. End date check (cannot occur after endDate if defined)
  if (routine.endDate && targetDateStr > routine.endDate) {
    return false;
  }

  // 4. Single-occurrence exception checks
  if (routine.exceptions && routine.exceptions[targetDateStr]) {
    const ex = routine.exceptions[targetDateStr];
    if ((ex as any).isDeleted) {
      return false;
    }
  }

  // 5. Skipped dates check
  if (!options?.includeSkipped && routine.skippedDates && routine.skippedDates.includes(targetDateStr)) {
    return false;
  }

  const { year: ty, month: tm, day: td, dayOfWeek: tDow } = parseIsoDate(targetDateStr);
  const { year: sy, month: sm, day: sd, dayOfWeek: sDow } = parseIsoDate(routine.startDate);
  const diffDays = getDiffDays(routine.startDate, targetDateStr);
  if (diffDays < 0) return false;

  const interval = routine.interval;

  if (interval === 'daily') {
    const count = routine.customEveryCount && routine.customEveryCount > 1 ? routine.customEveryCount : 1;
    return diffDays % count === 0;
  }

  if (interval === 'weekly') {
    const count = routine.customEveryCount && routine.customEveryCount > 1 ? routine.customEveryCount : 1;
    const weekdays = routine.weekdays && routine.weekdays.length > 0 ? routine.weekdays : [sDow];
    if (!weekdays.includes(tDow)) {
      return false;
    }
    if (count === 1) {
      return true;
    }
    // Calculate week difference from anchor start week
    const sMonOffset = sDow === 0 ? 6 : sDow - 1;
    const tMonOffset = tDow === 0 ? 6 : tDow - 1;
    const diffWeeks = Math.floor((diffDays + sMonOffset - tMonOffset) / 7);
    if (diffWeeks < 0) return false;
    return diffWeeks % count === 0;
  }

  if (interval === 'monthly') {
    const count = routine.customEveryCount && routine.customEveryCount > 1 ? routine.customEveryCount : 1;
    const diffMonths = (ty - sy) * 12 + (tm - sm);
    if (diffMonths < 0) return false;
    if (diffMonths % count !== 0) return false;

    // Handle month-end clamping (e.g. day 31 in a 30-day or Feb month)
    const maxDays = getDaysInMonth(ty, tm);
    const effectiveDay = Math.min(sd, maxDays);
    return td === effectiveDay;
  }

  if (interval === 'yearly') {
    const count = routine.customEveryCount && routine.customEveryCount > 1 ? routine.customEveryCount : 1;
    const diffYears = ty - sy;
    if (diffYears < 0) return false;
    if (diffYears % count !== 0) return false;
    if (tm !== sm) return false;

    // Leap day anchor handling
    if (sm === 2 && sd === 29) {
      const expectedDay = isLeapYear(ty) ? 29 : 28;
      return td === expectedDay;
    }

    const maxDays = getDaysInMonth(ty, tm);
    const effectiveDay = Math.min(sd, maxDays);
    return td === effectiveDay;
  }

  if (interval === 'custom') {
    const count = routine.customEveryCount && routine.customEveryCount > 1 ? routine.customEveryCount : 1;
    const unit = routine.customUnit || 'weeks';

    if (unit === 'days') {
      return diffDays % count === 0;
    }

    if (unit === 'weeks') {
      const weekdays = routine.weekdays && routine.weekdays.length > 0 ? routine.weekdays : [sDow];
      if (!weekdays.includes(tDow)) {
        return false;
      }
      if (count === 1) {
        return true;
      }
      const sMonOffset = sDow === 0 ? 6 : sDow - 1;
      const tMonOffset = tDow === 0 ? 6 : tDow - 1;
      const diffWeeks = Math.floor((diffDays + sMonOffset - tMonOffset) / 7);
      if (diffWeeks < 0) return false;
      return diffWeeks % count === 0;
    }

    if (unit === 'months') {
      const diffMonths = (ty - sy) * 12 + (tm - sm);
      if (diffMonths < 0 || diffMonths % count !== 0) return false;
      const maxDays = getDaysInMonth(ty, tm);
      const effectiveDay = Math.min(sd, maxDays);
      return td === effectiveDay;
    }

    if (unit === 'years') {
      const diffYears = ty - sy;
      if (diffYears < 0 || diffYears % count !== 0) return false;
      if (tm !== sm) return false;
      if (sm === 2 && sd === 29) {
        const expectedDay = isLeapYear(ty) ? 29 : 28;
        return td === expectedDay;
      }
      const maxDays = getDaysInMonth(ty, tm);
      const effectiveDay = Math.min(sd, maxDays);
      return td === effectiveDay;
    }
  }

  return false;
}

/**
 * Returns merged occurrence metadata for a specific date (incorporating exceptions if any).
 */
export function getRoutineOccurrence(
  routine: RoutineItem,
  dateStr: string
): RoutineItem {
  if (routine.exceptions && routine.exceptions[dateStr]) {
    return {
      ...routine,
      ...routine.exceptions[dateStr],
    };
  }
  return routine;
}

/**
 * Computes next N upcoming occurrence dates starting from fromDateStr.
 */
export function getNextOccurrences(
  routine: RoutineItem,
  fromDateStr: string,
  count = 3,
  maxDaysScan = 365 * 10
): string[] {
  const occurrences: string[] = [];
  const startScanDate = fromDateStr < routine.startDate ? routine.startDate : fromDateStr;

  const [y, m, d] = startScanDate.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));

  let dayStep = 1;
  // Performance optimization for yearly or custom year intervals
  if (routine.interval === 'yearly' || (routine.interval === 'custom' && routine.customUnit === 'years')) {
    dayStep = 1; // Can still scan or step
  }

  for (let i = 0; i < maxDaysScan && occurrences.length < count; i += dayStep) {
    const curIso = cur.toISOString().split('T')[0];
    if (isRoutineActiveOnDate(routine, curIso, { includePaused: true })) {
      occurrences.push(curIso);
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return occurrences;
}

/**
 * Returns the date string for the day immediately before dateStr.
 */
export function getDayBefore(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  cur.setUTCDate(cur.getUTCDate() - 1);
  return cur.toISOString().split('T')[0];
}

/**
 * Returns the date string for the day immediately after dateStr.
 */
export function getDayAfter(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  cur.setUTCDate(cur.getUTCDate() + 1);
  return cur.toISOString().split('T')[0];
}
