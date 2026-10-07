import {
  isRoutineActiveOnDate,
  getRoutineOccurrence,
  getNextOccurrences,
  formatRecurrenceRule,
  isLeapYear,
  getDayBefore,
} from '../src/utils/routineRecurrence';
import { RoutineItem } from '../src/types/planner';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    passed++;
    console.log(`✓ PASS: ${testName}`);
  } else {
    failed++;
    console.error(`✗ FAIL: ${testName}`);
  }
}

console.log('=== RUNNING RECURRENCE UNIT TESTS ===\n');

// 1. Renew Passport (custom, every 5 years, start date 2028-04-10)
const renewPassport: RoutineItem = {
  id: 'r-7',
  title: 'Renew passport',
  category: 'Personal',
  assignedTo: 'Rida',
  priority: 'medium',
  interval: 'custom',
  customEveryCount: 5,
  customUnit: 'years',
  startDate: '2028-04-10',
  isPaused: false,
  completedDates: [],
  skippedDates: [],
};

assert(
  !isRoutineActiveOnDate(renewPassport, '2026-10-06'),
  'Renew passport does NOT appear on 2026-10-06 (before start date)'
);
assert(
  isRoutineActiveOnDate(renewPassport, '2028-04-10'),
  'Renew passport DOES appear on start date 2028-04-10'
);
assert(
  !isRoutineActiveOnDate(renewPassport, '2029-04-10'),
  'Renew passport does NOT appear on 2029-04-10 (1 year after)'
);
assert(
  isRoutineActiveOnDate(renewPassport, '2033-04-10'),
  'Renew passport DOES appear on 2033-04-10 (5 years after)'
);
assert(
  formatRecurrenceRule(renewPassport) === 'Every 5 years',
  'formatRecurrenceRule correctly displays "Every 5 years"'
);

// 2. Pay rent (monthly, start date 2026-08-01)
const payRent: RoutineItem = {
  id: 'r-3',
  title: 'Pay rent',
  category: 'Finances',
  assignedTo: 'Rida',
  priority: 'urgent',
  interval: 'monthly',
  startDate: '2026-08-01',
  isPaused: false,
  completedDates: ['2026-10-01'],
  skippedDates: [],
};

assert(
  !isRoutineActiveOnDate(payRent, '2026-10-06'),
  'Pay rent does NOT appear on unrelated date 2026-10-06'
);
assert(
  isRoutineActiveOnDate(payRent, '2026-10-01'),
  'Pay rent DOES appear on 2026-10-01 (1st of month)'
);
assert(
  isRoutineActiveOnDate(payRent, '2026-11-01'),
  'Pay rent DOES appear on 2026-11-01 (1st of next month)'
);

// 3. Birthday prep (yearly, leap anchor 2024-02-29)
const birthdayPrep: RoutineItem = {
  id: 'r-6',
  title: 'Birthday prep',
  category: 'Personal',
  assignedTo: 'Rida',
  priority: 'medium',
  interval: 'yearly',
  startDate: '2024-02-29',
  isPaused: false,
  completedDates: [],
  skippedDates: [],
};

assert(
  !isRoutineActiveOnDate(birthdayPrep, '2026-10-06'),
  'Birthday prep does NOT appear on 2026-10-06'
);
assert(
  isRoutineActiveOnDate(birthdayPrep, '2024-02-29'),
  'Birthday prep appears on leap day 2024-02-29 in leap year'
);
assert(
  isRoutineActiveOnDate(birthdayPrep, '2025-02-28'),
  'Birthday prep shifts cleanly to 2025-02-28 in non-leap year'
);
assert(
  isRoutineActiveOnDate(birthdayPrep, '2026-02-28'),
  'Birthday prep shifts cleanly to 2026-02-28 in non-leap year'
);
assert(
  isRoutineActiveOnDate(birthdayPrep, '2028-02-29'),
  'Birthday prep appears on 2028-02-29 in next leap year'
);
assert(
  !isRoutineActiveOnDate(birthdayPrep, '2028-02-28'),
  'Birthday prep does NOT appear on 2028-02-28 in a leap year (it is on Feb 29)'
);

// 4. Weekly routine on Tuesday (weekdays: [2])
const weeklyTuesdayRoutine: RoutineItem = {
  id: 'r-test-tue',
  title: 'Weekly team sync',
  category: 'Career',
  assignedTo: 'Rida',
  priority: 'high',
  interval: 'weekly',
  weekdays: [2], // Tuesday
  startDate: '2026-10-06', // Tuesday
  isPaused: false,
  completedDates: [],
  skippedDates: [],
};

assert(
  isRoutineActiveOnDate(weeklyTuesdayRoutine, '2026-10-06'),
  'Weekly Tuesday routine DOES appear on Tuesday 2026-10-06'
);
assert(
  !isRoutineActiveOnDate(weeklyTuesdayRoutine, '2026-10-09'),
  'Weekly Tuesday routine does NOT appear on Friday 2026-10-09'
);
assert(
  isRoutineActiveOnDate(weeklyTuesdayRoutine, '2026-10-13'),
  'Weekly Tuesday routine DOES appear on next Tuesday 2026-10-13'
);

// 5. Custom intervals (every 2 weeks on Friday)
const callParents: RoutineItem = {
  id: 'r-4',
  title: 'Call parents',
  category: 'Relationships',
  assignedTo: 'Rida',
  priority: 'medium',
  interval: 'custom',
  customEveryCount: 2,
  customUnit: 'weeks',
  startDate: '2026-09-18', // Friday
  isPaused: false,
  completedDates: [],
  skippedDates: [],
};

assert(
  !isRoutineActiveOnDate(callParents, '2026-10-06'),
  'Call parents does NOT appear on Tuesday 2026-10-06'
);
assert(
  isRoutineActiveOnDate(callParents, '2026-10-02'),
  'Call parents appears on 2026-10-02 (2 weeks after 2026-09-18)'
);
assert(
  !isRoutineActiveOnDate(callParents, '2026-10-09'),
  'Call parents does NOT appear on 2026-10-09 (1 week interval, odd week)'
);
assert(
  isRoutineActiveOnDate(callParents, '2026-10-16'),
  'Call parents appears on 2026-10-16 (4 weeks after start)'
);

// 6. Paused and skipped dates
const pausedRoutine: RoutineItem = {
  ...weeklyTuesdayRoutine,
  isPaused: true,
};
assert(
  !isRoutineActiveOnDate(pausedRoutine, '2026-10-06'),
  'Paused routine is NOT active on scheduled date'
);

const skippedRoutine: RoutineItem = {
  ...weeklyTuesdayRoutine,
  skippedDates: ['2026-10-06'],
};
assert(
  !isRoutineActiveOnDate(skippedRoutine, '2026-10-06'),
  'Skipped occurrence on 2026-10-06 is respected and not active'
);
assert(
  isRoutineActiveOnDate(skippedRoutine, '2026-10-13'),
  'Next occurrence of routine after skipped occurrence is still active'
);

// 7. Single-occurrence edit vs future edit
const baseSeries: RoutineItem = {
  id: 'series-1',
  title: 'Morning Yoga',
  category: 'Health',
  assignedTo: 'Rida',
  priority: 'medium',
  interval: 'daily',
  startDate: '2026-10-01',
  isPaused: false,
  completedDates: [],
  skippedDates: [],
  exceptions: {
    '2026-10-06': {
      title: 'Power Vinyasa Yoga (Extended)',
      startTime: '06:30',
    },
  },
};

const occ1 = getRoutineOccurrence(baseSeries, '2026-10-05');
assert(occ1.title === 'Morning Yoga', 'Non-overridden date has original title');

const occ2 = getRoutineOccurrence(baseSeries, '2026-10-06');
assert(
  occ2.title === 'Power Vinyasa Yoga (Extended)' && occ2.startTime === '06:30',
  'Single-occurrence override for 2026-10-06 has customized title and time'
);

const occ3 = getRoutineOccurrence(baseSeries, '2026-10-07');
assert(occ3.title === 'Morning Yoga', 'Subsequent date has original title intact');

// Future split test
const splitDate = '2026-10-06';
const dayBefore = getDayBefore(splitDate);
assert(dayBefore === '2026-10-05', 'Day before 2026-10-06 is correctly 2026-10-05');

console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
if (failed > 0) {
  process.exit(1);
}
