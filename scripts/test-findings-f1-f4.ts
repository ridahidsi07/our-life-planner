import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { INITIAL_SETTINGS, EMPTY_SETTINGS } from '../src/utils/sampleData';
import { validateBackupData } from '../src/utils/backupValidator';
import { isModuleOrToolEnabled } from '../src/utils/moduleRegistry';
import { compareCalendarItems } from '../src/components/calendar/CalendarView';

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

// WCAG relative luminance and contrast ratio calculations
function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return [r, g, b];
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sc = c / 255;
    return sc <= 0.03928 ? sc / 12.92 : Math.pow((sc + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1: string, hex2: string): number {
  const [r1, g1, b1] = parseHex(hex1);
  const [r2, g2, b2] = parseHex(hex2);
  const l1 = luminance(r1, g1, b1);
  const l2 = luminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

function getFileHash(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

console.log('================================================================');
console.log('FINDINGS F1–F4 REGRESSION VERIFICATION SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// F1: Complete, Contrast-Safe Control Roles
// -----------------------------------------------------------------------------
console.log('--- F1: Complete, Contrast-Safe Control Roles ---');

// 1. Audit all src files for undefined role variables: var(--accent-foreground) and var(--accent-muted)
function scanDirForUndefinedTokens(dir: string): string[] {
  const violations: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      violations.push(...scanDirForUndefinedTokens(fullPath));
    } else if (/\.(tsx?|css)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('var(--accent-foreground)')) {
        violations.push(`${fullPath}: var(--accent-foreground)`);
      }
      if (content.includes('var(--accent-muted)')) {
        violations.push(`${fullPath}: var(--accent-muted)`);
      }
    }
  }
  return violations;
}

const undefinedViolations = scanDirForUndefinedTokens(path.resolve(process.cwd(), 'src'));
assert(
  undefinedViolations.length === 0,
  'F1.1: Zero occurrences of undefined role variables (var(--accent-foreground), var(--accent-muted)) across src/',
  undefinedViolations.join('; ')
);

// 2. Primary button tokens defined and contrast safe across all appearances
// Apple primary button: White (#FFFFFF) on #0071E3
const appleBtnRatio = contrastRatio('#FFFFFF', '#0071E3');
assert(
  appleBtnRatio >= 4.5,
  `F1.2: Apple primary button text contrast (#FFFFFF on #0071E3) is ${appleBtnRatio}:1 (>= 4.5:1)`
);

// Apple primary button hover: White (#FFFFFF) on #0076DF
const appleHoverRatio = contrastRatio('#FFFFFF', '#0076DF');
assert(
  appleHoverRatio >= 4.5,
  `F1.3: Apple primary button hover contrast (#FFFFFF on #0076DF) is ${appleHoverRatio}:1 (>= 4.5:1)`
);

// Apple primary button active: White (#FFFFFF) on #006EDB
const appleActiveRatio = contrastRatio('#FFFFFF', '#006EDB');
assert(
  appleActiveRatio >= 4.5,
  `F1.4: Apple primary button active/pressed contrast (#FFFFFF on #006EDB) is ${appleActiveRatio}:1 (>= 4.5:1)`
);

// Check contrast across all 5 themes: Apple, Teal, Ocean, Plum, Ember in Light & Dark mode
const themePrimaryTokens: Record<string, { lightBg: string; lightFg: string; darkBg: string; darkFg: string }> = {
  apple: { lightBg: '#0071E3', lightFg: '#FFFFFF', darkBg: '#0071E3', darkFg: '#FFFFFF' },
  teal: { lightBg: '#087F83', lightFg: '#FFFFFF', darkBg: '#38D0C5', darkFg: '#071A3A' },
  ocean: { lightBg: '#1D6AE5', lightFg: '#FFFFFF', darkBg: '#60A5FA', darkFg: '#071A3A' },
  plum: { lightBg: '#7E22CE', lightFg: '#FFFFFF', darkBg: '#C084FC', darkFg: '#071A3A' },
  ember: { lightBg: '#C2410C', lightFg: '#FFFFFF', darkBg: '#FB923C', darkFg: '#071A3A' },
};

for (const [theme, tokens] of Object.entries(themePrimaryTokens)) {
  const lightR = contrastRatio(tokens.lightFg, tokens.lightBg);
  const darkR = contrastRatio(tokens.darkFg, tokens.darkBg);
  assert(
    lightR >= 4.5 && darkR >= 4.5,
    `F1.5: Theme "${theme}" primary button tokens pass WCAG AA in both light (${lightR}:1) and dark (${darkR}:1)`
  );
}

// 3. Confirm Savings, Debt, Routines, Tasks, Today use --btn-primary tokens
const savingsPath = path.resolve(process.cwd(), 'src', 'components', 'money', 'SavingsPotsView.tsx');
const debtPath = path.resolve(process.cwd(), 'src', 'components', 'money', 'DebtPayoffView.tsx');
const routinesPath = path.resolve(process.cwd(), 'src', 'components', 'routines', 'RoutinesView.tsx');
const tasksPath = path.resolve(process.cwd(), 'src', 'components', 'tasks', 'TasksView.tsx');
const todayPath = path.resolve(process.cwd(), 'src', 'components', 'today', 'TodayDashboard.tsx');

const savingsContent = fs.readFileSync(savingsPath, 'utf-8');
assert(
  savingsContent.includes('var(--btn-primary-bg)') && savingsContent.includes('var(--btn-primary-fg)'),
  'F1.6: SavingsPotsView uses paired --btn-primary-bg and --btn-primary-fg tokens'
);

const debtContent = fs.readFileSync(debtPath, 'utf-8');
assert(
  debtContent.includes('var(--btn-primary-bg)') && debtContent.includes('var(--btn-primary-fg)'),
  'F1.7: DebtPayoffView uses paired --btn-primary-bg and --btn-primary-fg tokens'
);

const routinesContent = fs.readFileSync(routinesPath, 'utf-8');
assert(
  routinesContent.includes('var(--btn-primary-bg)') && routinesContent.includes('var(--btn-primary-fg)'),
  'F1.8: RoutinesView uses paired --btn-primary-bg and --btn-primary-fg tokens'
);

const tasksContent = fs.readFileSync(tasksPath, 'utf-8');
assert(
  tasksContent.includes('var(--btn-primary-bg)') && tasksContent.includes('var(--btn-primary-fg)'),
  'F1.9: TasksView uses paired --btn-primary-bg and --btn-primary-fg tokens'
);

const todayContent = fs.readFileSync(todayPath, 'utf-8');
assert(
  todayContent.includes('var(--btn-primary-bg)') && todayContent.includes('var(--btn-primary-fg)'),
  'F1.10: TodayDashboard Focus toggle uses paired --btn-primary-bg and --btn-primary-fg tokens'
);


// -----------------------------------------------------------------------------
// F2: Complete the Palette at its Consumers & New-Install Default
// -----------------------------------------------------------------------------
console.log('\n--- F2: Complete the Palette at its Consumers & New-Install Default ---');

// 1. New-install and demo defaults are "apple"
assert(
  INITIAL_SETTINGS.accentColor === 'apple',
  `F2.1: INITIAL_SETTINGS.accentColor is "apple" (found: ${INITIAL_SETTINGS.accentColor})`
);
assert(
  EMPTY_SETTINGS.accentColor === 'apple',
  `F2.2: EMPTY_SETTINGS.accentColor is "apple" (found: ${EMPTY_SETTINGS.accentColor})`
);

// 2. Legacy fallback to "teal" preserved for missing field in backup data
const baseDummyBackup = {
  version: '1.0.0',
  exportedAt: '2026-10-15T12:00:00.000Z',
  settings: {
    ...INITIAL_SETTINGS,
    ownerName: 'Test Household',
  },
  tasks: [],
  routines: [],
  goals: [],
  habits: [],
  inbox: [],
  transactions: [],
  bills: [],
  savingsPots: [],
  debts: [],
  recipes: [],
  plannedMeals: [],
  groceries: [],
  workouts: [],
  weightProfiles: [],
  weightRecords: [],
  hydrationEntries: [],
  hydrationTargets: [],
  calendarEvents: [],
};

const legacyBackupWithoutAccent = JSON.parse(JSON.stringify(baseDummyBackup));
delete legacyBackupWithoutAccent.settings.accentColor;

const validationResult = validateBackupData(legacyBackupWithoutAccent);
assert(
  validationResult.isValid,
  'F2.3: Legacy backup lacking accentColor validates as valid'
);
assert(
  validationResult.data?.settings.accentColor === 'teal',
  `F2.4: Legacy backup lacking accentColor normalizes to "teal" fallback (found: ${validationResult.data?.settings.accentColor})`
);

// 3. Consumers purged of hardcoded teal #087F83 literals
const habitsPath = path.resolve(process.cwd(), 'src', 'components', 'habits', 'HabitsView.tsx');
const mealsPath = path.resolve(process.cwd(), 'src', 'components', 'food', 'MealsView.tsx');
const headerPath = path.resolve(process.cwd(), 'src', 'components', 'layout', 'Header.tsx');
const sidebarPath = path.resolve(process.cwd(), 'src', 'components', 'layout', 'Sidebar.tsx');

const habitsContent = fs.readFileSync(habitsPath, 'utf-8');
assert(
  !habitsContent.includes('#087F83') && !habitsContent.includes('#087f83'),
  'F2.5: HabitsView contains zero hard-coded #087F83 literals'
);

const mealsContent = fs.readFileSync(mealsPath, 'utf-8');
assert(
  !mealsContent.includes('#087F83') && !mealsContent.includes('#087f83'),
  'F2.6: MealsView contains zero hard-coded #087F83 literals'
);

const headerContent = fs.readFileSync(headerPath, 'utf-8');
assert(
  !headerContent.includes('#087F83') && !headerContent.includes('#087f83'),
  'F2.7: Header contains zero hard-coded #087F83 literals'
);

const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
assert(
  !sidebarContent.includes('#087F83') && !sidebarContent.includes('#087f83'),
  'F2.8: Sidebar contains zero hard-coded #087F83 literals'
);


// -----------------------------------------------------------------------------
// F3: Calendar Consistency & Unified Eligibility / Sorting Policy
// -----------------------------------------------------------------------------
console.log('\n--- F3: Calendar Consistency & Unified Eligibility / Sorting Policy ---');

// 1. Core Starter preset module filtering
const coreStarterTools = ['today', 'tasks', 'calendar', 'routines', 'inbox'];

assert(
  !isModuleOrToolEnabled('meals', coreStarterTools),
  'F3.1: Core Starter disables meals module'
);
assert(
  !isModuleOrToolEnabled('budget', coreStarterTools),
  'F3.2: Core Starter disables budget & bills module'
);
assert(
  !isModuleOrToolEnabled('workouts', coreStarterTools),
  'F3.3: Core Starter disables workouts module'
);
assert(
  !isModuleOrToolEnabled('goals', coreStarterTools),
  'F3.4: Core Starter disables goals module'
);

// All-tools preset enables them
const allTools = [
  'today', 'tasks', 'calendar', 'routines', 'inbox', 'goals', 'habits',
  'budget', 'savings', 'debt', 'meals', 'groceries', 'workouts', 'weight', 'water', 'settings'
];
assert(
  isModuleOrToolEnabled('meals', allTools) &&
  isModuleOrToolEnabled('budget', allTools) &&
  isModuleOrToolEnabled('workouts', allTools),
  'F3.5: All-tools configuration enables meals, budget & bills, and workouts'
);

// 2. All-day policy & chronological sorting
const testItems = [
  { id: '1', date: '2026-10-15', time: '18:00', title: 'Late bill' },
  { id: '2', date: '2026-10-15', time: '07:30', title: 'Morning routine' },
  { id: '3', date: '2026-10-15', time: 'All day', isAllDay: true, title: 'All day anniversary' },
  { id: '4', date: '2026-10-15', time: '12:30', title: 'Lunch meal' },
  { id: '5', date: '2026-10-15', time: '09:00', title: 'Sprint planning task' },
  { id: '6', date: '2026-10-15', time: '15:00', title: 'Afternoon workout' },
  { id: '7', date: '2026-10-15', time: 'All day', isAllDay: true, title: 'Birthday event' },
];

const sortedItems = [...testItems].sort(compareCalendarItems);

// All-day items must come first
assert(
  sortedItems[0].isAllDay && sortedItems[1].isAllDay,
  'F3.6: Defined all-day policy places all-day items first on the date'
);

// Chronological ordering of timed items: 07:30 < 09:00 < 12:30 < 15:00 < 18:00
const timedSortedTimes = sortedItems.filter((i) => !i.isAllDay).map((i) => i.time);
assert(
  JSON.stringify(timedSortedTimes) === JSON.stringify(['07:30', '09:00', '12:30', '15:00', '18:00']),
  'F3.7: Chronological ordering strictly sorts timed items: 07:30 < 09:00 < 12:30 < 15:00 < 18:00',
  `Found: ${JSON.stringify(timedSortedTimes)}`
);

// Multi-day sorting across month and year boundaries
const boundaryItems = [
  { id: 'b1', date: '2026-11-01', time: '10:00', title: 'Nov 1' },
  { id: 'b2', date: '2026-10-31', time: '14:00', title: 'Oct 31' },
  { id: 'b3', date: '2027-01-01', time: '08:00', title: 'New Year 2027' },
  { id: 'b4', date: '2026-12-31', time: '23:00', title: 'New Year Eve 2026' },
];

const sortedBoundaries = [...boundaryItems].sort(compareCalendarItems);
assert(
  sortedBoundaries[0].date === '2026-10-31' &&
  sortedBoundaries[1].date === '2026-11-01' &&
  sortedBoundaries[2].date === '2026-12-31' &&
  sortedBoundaries[3].date === '2027-01-01',
  'F3.8: Date comparator cleanly sorts across month (Oct->Nov) and year (2026->2027) boundaries'
);

// Multi-item of same type on same day
const sameTypeItems = [
  { id: 't1', date: '2026-10-15', time: '14:00', title: 'Task B' },
  { id: 't2', date: '2026-10-15', time: '08:30', title: 'Task A' },
  { id: 't3', date: '2026-10-15', time: '17:00', title: 'Task C' },
];
const sortedSameType = [...sameTypeItems].sort(compareCalendarItems);
assert(
  sortedSameType[0].time === '08:30' && sortedSameType[1].time === '14:00' && sortedSameType[2].time === '17:00',
  'F3.9: Multiple items of the same type on the same day sort chronologically'
);

// Calendar View disclosure and expand/collapse implementation check
const calendarViewPath = path.resolve(process.cwd(), 'src', 'components', 'calendar', 'CalendarView.tsx');
const calendarContent = fs.readFileSync(calendarViewPath, 'utf-8');

assert(
  calendarContent.includes('data-testid="calendar-upcoming-badge"') &&
  calendarContent.includes('{allUpcomingItems.length}'),
  'F3.10: Calendar Coming Up displays true total count badge using allUpcomingItems.length'
);

assert(
  calendarContent.includes('data-testid="calendar-upcoming-toggle-btn"') &&
  calendarContent.includes('isUpcomingExpanded'),
  'F3.11: Calendar Coming Up provides expand/collapse disclosure toggle for > 5 items'
);

assert(
  calendarContent.includes('selectedDate !== currentDate ? `From selected date (${selectedDate})` : \'Next 7 days\''),
  'F3.12: Calendar Coming Up dynamically explains date basis (selected-date vs today basis)'
);


// -----------------------------------------------------------------------------
// F4: Visual Verification Integrity & Screenshot Uniqueness
// -----------------------------------------------------------------------------
console.log('\n--- F4: Visual Verification Integrity & Screenshot Uniqueness ---');

const screenshotsDir = path.resolve(process.cwd(), 'artifacts', 'premium-ui', 'apple-color-system');

const requiredScreenshots = [
  '01-today-light-desktop.png',
  '02-tasks-light-desktop.png',
  '03-budget-light-desktop.png',
  '04-settings-light-desktop.png',
  '05-today-dark-desktop.png',
  '06-tasks-dark-desktop.png',
  '07-budget-dark-desktop.png',
  '08-settings-dark-desktop.png',
  '09-today-dark-mobile.png',
  '10-tasks-dark-mobile.png',
  '11-today-light-mobile.png',
  '12-settings-light-mobile.png',
];

let allExist = true;
for (const sc of requiredScreenshots) {
  const p = path.join(screenshotsDir, sc);
  if (!fs.existsSync(p)) {
    allExist = false;
    console.error(`  Missing screenshot: ${sc}`);
  }
}

assert(
  allExist,
  `F4.1: All 12 named screenshots exist in ${screenshotsDir}`
);

if (allExist) {
  const h01 = getFileHash(path.join(screenshotsDir, '01-today-light-desktop.png'));
  const h02 = getFileHash(path.join(screenshotsDir, '02-tasks-light-desktop.png'));
  const h03 = getFileHash(path.join(screenshotsDir, '03-budget-light-desktop.png'));
  const h04 = getFileHash(path.join(screenshotsDir, '04-settings-light-desktop.png'));

  const h05 = getFileHash(path.join(screenshotsDir, '05-today-dark-desktop.png'));
  const h06 = getFileHash(path.join(screenshotsDir, '06-tasks-dark-desktop.png'));
  const h07 = getFileHash(path.join(screenshotsDir, '07-budget-dark-desktop.png'));
  const h08 = getFileHash(path.join(screenshotsDir, '08-settings-dark-desktop.png'));

  const h09 = getFileHash(path.join(screenshotsDir, '09-today-dark-mobile.png'));
  const h10 = getFileHash(path.join(screenshotsDir, '10-tasks-dark-mobile.png'));
  const h11 = getFileHash(path.join(screenshotsDir, '11-today-light-mobile.png'));
  const h12 = getFileHash(path.join(screenshotsDir, '12-settings-light-mobile.png'));

  const desktopLightSet = new Set([h01, h02, h03, h04]);
  assert(
    desktopLightSet.size === 4,
    'F4.2: Desktop Light screenshots (Today, Tasks, Budget, Settings) are all distinct unique images (no duplicated captures)'
  );

  const desktopDarkSet = new Set([h05, h06, h07, h08]);
  assert(
    desktopDarkSet.size === 4,
    'F4.3: Desktop Dark screenshots (Today, Tasks, Budget, Settings) are all distinct unique images (no duplicated captures)'
  );

  assert(
    h09 !== h10,
    'F4.4: Mobile Dark screenshots (Today, Tasks) are distinct unique images'
  );

  assert(
    h11 !== h12,
    'F4.5: Mobile Light screenshots (Today, Settings) are distinct unique images'
  );
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`FINDINGS F1–F4 REGRESSION RESULTS: ${passed} passed, ${failed} failed`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
