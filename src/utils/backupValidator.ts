import {
  PlannerBackupData,
  UserSettings,
  Priority,
  TaskStatus,
  RoutineInterval,
  BudgetPeriodType,
} from '../types/planner';
import { getCurrencySymbol } from './formatters';
import { migrateEnabledTools, migratePinnedTools } from './moduleRegistry';
import {
  STORAGE_KEY_DATA,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_REVISION,
  getStoredRevision,
} from './storageCoordinator';

export const STORAGE_KEY_PRE_RESTORE_SNAPSHOT = 'our_life_planner_pre_restore_snapshot_v1';

export const REQUIRED_BACKUP_ARRAY_KEYS = [
  'tasks',
  'routines',
  'goals',
  'habits',
  'inbox',
  'transactions',
  'bills',
  'savingsPots',
  'debts',
  'recipes',
  'plannedMeals',
  'groceries',
  'workouts',
  'weightProfiles',
  'weightRecords',
  'hydrationEntries',
  'hydrationTargets',
  'calendarEvents',
] as const;

export type BackupArrayKey = (typeof REQUIRED_BACKUP_ARRAY_KEYS)[number];

export interface BackupValidationSummary {
  ownerName: string;
  exportedAt: string;
  totalRecords: number;
  counts: Record<BackupArrayKey, number>;
}

export interface BackupValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: PlannerBackupData;
  summary?: BackupValidationSummary;
}

export interface PreRestoreSnapshotInfo {
  savedAt: string;
  reason: string;
  ownerName: string;
  totalRecords: number;
  snapshot: PlannerBackupData;
}

export interface AtomicRestoreResult {
  success: boolean;
  errors: string[];
  restoredData?: PlannerBackupData;
  previousSnapshot?: PreRestoreSnapshotInfo;
  nextRevision?: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const VALID_PRIORITIES = new Set<Priority>(['urgent', 'high', 'medium', 'low', 'lowest']);
const VALID_TASK_STATUSES = new Set<TaskStatus>(['not_started', 'in_progress', 'on_hold', 'completed']);
const VALID_ROUTINE_INTERVALS = new Set<RoutineInterval>(['daily', 'weekly', 'monthly', 'yearly', 'custom']);
const VALID_BUDGET_PERIODS = new Set<BudgetPeriodType>(['monthly', 'weekly', 'paycheck', 'custom']);
const VALID_THEMES = new Set(['light', 'dark', 'system']);
const VALID_ACCENT_COLORS = new Set(['teal', 'ocean', 'plum', 'ember']);
const VALID_EDITIONS = new Set(['online', 'downloaded']);
const VALID_WEEK_STARTS = new Set(['Monday', 'Sunday']);
const VALID_WEIGHT_UNITS = new Set(['kg', 'lb']);
const VALID_HEIGHT_UNITS = new Set(['cm', 'in']);
const VALID_WATER_UNITS = new Set(['ml', 'oz']);

function isPlainObject(val: unknown): val is Record<string, any> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

function isNonNegativeNumber(val: unknown): val is number {
  return isFiniteNumber(val) && val >= 0;
}

function isPositiveNumber(val: unknown): val is number {
  return isFiniteNumber(val) && val > 0;
}

/**
 * Validates strict YYYY-MM-DD calendar date strings (including leap-year rules).
 */
export function isValidYMDDate(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2200) return false;
  if (month < 1 || month > 12) return false;
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= maxDay;
}

/**
 * Validates either a YYYY-MM-DD date string or an ISO-8601 timestamp string.
 */
export function isValidTimestampOrDate(val: unknown): val is string {
  if (typeof val !== 'string' || val.trim().length === 0) return false;
  if (isValidYMDDate(val)) return true;
  const parsed = Date.parse(val);
  return !Number.isNaN(parsed);
}

/**
 * Validates HH:mm 24-hour time string.
 */
export function isValidTimeHHMM(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(val);
}

/**
 * Validates the complete backup structure before rendering a preview or restoring.
 * Checks required top-level fields, settings, all 18 entity arrays, item shapes,
 * dates, amounts, duplicate IDs, and cross-entity relationships.
 */
export function validateBackupData(input: unknown): BackupValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(input)) {
    return {
      isValid: false,
      errors: ['Backup data must be a valid JSON object.'],
      warnings,
    };
  }

  // 1. Top-level metadata validation
  if (input.version !== '1.0.0') {
    errors.push(
      `Unsupported or missing backup version${input.version ? ` "${String(input.version)}"` : ''}. Expected version "1.0.0".`
    );
  }

  if (!isValidTimestampOrDate(input.exportedAt)) {
    errors.push('Missing or invalid "exportedAt" timestamp.');
  }

  if (
    input.revision !== undefined &&
    (!isFiniteNumber(input.revision) || input.revision < 0 || !Number.isInteger(input.revision))
  ) {
    errors.push('"revision" must be a non-negative integer when provided.');
  }

  // 2. Settings validation
  if (!isPlainObject(input.settings)) {
    errors.push('Missing or invalid "settings" object.');
  } else {
    const s = input.settings;
    if (!isNonEmptyString(s.ownerName)) {
      errors.push('settings.ownerName is required and must be a non-empty string.');
    }
    if (s.email !== undefined && typeof s.email !== 'string') {
      errors.push('settings.email must be a string.');
    }
    if (!VALID_EDITIONS.has(s.edition)) {
      errors.push('settings.edition must be "online" or "downloaded".');
    }
    if (!VALID_WEEK_STARTS.has(s.weekStartsOn)) {
      errors.push('settings.weekStartsOn must be "Monday" or "Sunday".');
    }
    if (!isNonEmptyString(s.timeZone)) {
      errors.push('settings.timeZone is required and must be a non-empty string.');
    }
    if (!isNonEmptyString(s.currency)) {
      errors.push('settings.currency is required and must be a non-empty string.');
    }
    if (!VALID_WEIGHT_UNITS.has(s.weightUnit)) {
      errors.push('settings.weightUnit must be "kg" or "lb".');
    }
    if (!VALID_HEIGHT_UNITS.has(s.heightUnit)) {
      errors.push('settings.heightUnit must be "cm" or "in".');
    }
    if (!VALID_WATER_UNITS.has(s.waterUnit)) {
      errors.push('settings.waterUnit must be "ml" or "oz".');
    }
    if (!VALID_THEMES.has(s.theme)) {
      errors.push('settings.theme must be "light", "dark", or "system".');
    }
    if (s.accentColor !== undefined && !VALID_ACCENT_COLORS.has(s.accentColor)) {
      warnings.push(`settings.accentColor ("${String(s.accentColor)}") is invalid; falling back to "teal".`);
    }
    if (typeof s.isSampleDataActive !== 'boolean') {
      errors.push('settings.isSampleDataActive must be a boolean.');
    }
    if (typeof s.hasCompletedSetup !== 'boolean') {
      errors.push('settings.hasCompletedSetup must be a boolean.');
    }
    if (s.budgetOpeningBalance !== undefined && !isFiniteNumber(s.budgetOpeningBalance)) {
      errors.push('settings.budgetOpeningBalance must be a finite number.');
    }
    if (s.budgetPlannedIncome !== undefined && !isNonNegativeNumber(s.budgetPlannedIncome)) {
      errors.push('settings.budgetPlannedIncome must be a non-negative number.');
    }
    if (s.budgetPlannedSavings !== undefined && !isNonNegativeNumber(s.budgetPlannedSavings)) {
      errors.push('settings.budgetPlannedSavings must be a non-negative number.');
    }
    if (s.budgetPeriodType !== undefined && !VALID_BUDGET_PERIODS.has(s.budgetPeriodType)) {
      errors.push('settings.budgetPeriodType must be "monthly", "weekly", "paycheck", or "custom".');
    }
    if (s.budgetStartDate !== undefined && !isValidYMDDate(s.budgetStartDate)) {
      errors.push('settings.budgetStartDate must be a valid YYYY-MM-DD date.');
    }
    if (s.budgetEndDate !== undefined && !isValidYMDDate(s.budgetEndDate)) {
      errors.push('settings.budgetEndDate must be a valid YYYY-MM-DD date.');
    }
    if (
      isValidYMDDate(s.budgetStartDate) &&
      isValidYMDDate(s.budgetEndDate) &&
      s.budgetStartDate > s.budgetEndDate
    ) {
      errors.push('settings.budgetStartDate cannot be after settings.budgetEndDate.');
    }
    if (s.budgetCategoryLimits !== undefined) {
      if (!isPlainObject(s.budgetCategoryLimits)) {
        errors.push('settings.budgetCategoryLimits must be an object.');
      } else {
        for (const [cat, limit] of Object.entries(s.budgetCategoryLimits)) {
          if (!isNonNegativeNumber(limit)) {
            errors.push(`settings.budgetCategoryLimits["${cat}"] must be a non-negative number.`);
          }
        }
      }
    }
    if (s.householdMembers !== undefined) {
      if (!Array.isArray(s.householdMembers)) {
        errors.push('settings.householdMembers must be an array.');
      } else {
        s.householdMembers.forEach((m: unknown, idx: number) => {
          if (!isPlainObject(m) || !isNonEmptyString(m.id) || !isNonEmptyString(m.name) || !isNonEmptyString(m.color)) {
            errors.push(`settings.householdMembers[${idx}] must have non-empty id, name, and color.`);
          }
        });
      }
    }
  }

  // 3. Check presence of all 18 required arrays
  for (const key of REQUIRED_BACKUP_ARRAY_KEYS) {
    if (!Array.isArray(input[key])) {
      errors.push(`Missing or invalid collection array: "${key}".`);
    }
  }

  // If fundamental top-level collections or settings are missing, return early before deep item checks
  if (errors.length > 0) {
    return { isValid: false, errors, warnings };
  }

  // Helper to check unique IDs per collection
  const collectUniqueIds = (items: any[], collectionName: string): Set<string> => {
    const ids = new Set<string>();
    items.forEach((item, idx) => {
      if (!isPlainObject(item) || !isNonEmptyString(item.id)) {
        errors.push(`${collectionName}[${idx}] is missing a valid string "id".`);
        return;
      }
      if (ids.has(item.id)) {
        errors.push(`${collectionName}[${idx}] has a duplicate id "${item.id}".`);
      }
      ids.add(item.id);
    });
    return ids;
  };

  // 4. Validate each collection's items, dates, and numeric amounts
  // 4.1 tasks
  const taskIds = collectUniqueIds(input.tasks, 'tasks');
  input.tasks.forEach((t: any, i: number) => {
    if (!isPlainObject(t)) return;
    if (!isNonEmptyString(t.title)) errors.push(`tasks[${i}].title must be a non-empty string.`);
    if (typeof t.category !== 'string') errors.push(`tasks[${i}].category must be a string.`);
    if (typeof t.assignedTo !== 'string') errors.push(`tasks[${i}].assignedTo must be a string.`);
    if (!VALID_PRIORITIES.has(t.priority)) errors.push(`tasks[${i}].priority is invalid.`);
    if (!VALID_TASK_STATUSES.has(t.status)) errors.push(`tasks[${i}].status is invalid.`);
    if (!isValidTimestampOrDate(t.createdAt)) errors.push(`tasks[${i}].createdAt must be a valid date or timestamp.`);
    if (t.dueDate !== undefined && t.dueDate !== '' && !isValidYMDDate(t.dueDate)) {
      errors.push(`tasks[${i}].dueDate ("${String(t.dueDate)}") must be a valid YYYY-MM-DD date.`);
    }
    if (t.completedAt !== undefined && !isValidTimestampOrDate(t.completedAt)) {
      errors.push(`tasks[${i}].completedAt must be a valid date or timestamp.`);
    }
  });

  // 4.2 routines
  collectUniqueIds(input.routines, 'routines');
  input.routines.forEach((r: any, i: number) => {
    if (!isPlainObject(r)) return;
    if (!isNonEmptyString(r.title)) errors.push(`routines[${i}].title must be a non-empty string.`);
    if (typeof r.category !== 'string') errors.push(`routines[${i}].category must be a string.`);
    if (typeof r.assignedTo !== 'string') errors.push(`routines[${i}].assignedTo must be a string.`);
    if (!VALID_PRIORITIES.has(r.priority)) errors.push(`routines[${i}].priority is invalid.`);
    if (!VALID_ROUTINE_INTERVALS.has(r.interval)) errors.push(`routines[${i}].interval is invalid.`);
    if (!isValidYMDDate(r.startDate)) errors.push(`routines[${i}].startDate must be a valid YYYY-MM-DD date.`);
    if (r.endDate !== undefined && r.endDate !== '' && !isValidYMDDate(r.endDate)) {
      errors.push(`routines[${i}].endDate must be a valid YYYY-MM-DD date.`);
    }
    if (isValidYMDDate(r.startDate) && isValidYMDDate(r.endDate) && r.startDate > r.endDate) {
      errors.push(`routines[${i}].startDate cannot be after endDate.`);
    }
    if (typeof r.isPaused !== 'boolean') errors.push(`routines[${i}].isPaused must be a boolean.`);
    if (!Array.isArray(r.completedDates) || !r.completedDates.every(isValidYMDDate)) {
      errors.push(`routines[${i}].completedDates must be an array of valid YYYY-MM-DD dates.`);
    }
    if (!Array.isArray(r.skippedDates) || !r.skippedDates.every(isValidYMDDate)) {
      errors.push(`routines[${i}].skippedDates must be an array of valid YYYY-MM-DD dates.`);
    }
    if (r.forgivenDates !== undefined && (!Array.isArray(r.forgivenDates) || !r.forgivenDates.every(isValidYMDDate))) {
      errors.push(`routines[${i}].forgivenDates must be an array of valid YYYY-MM-DD dates.`);
    }
    if (r.customEveryCount !== undefined && (!isPositiveNumber(r.customEveryCount) || !Number.isInteger(r.customEveryCount))) {
      errors.push(`routines[${i}].customEveryCount must be a positive integer.`);
    }
  });

  // 4.3 goals
  collectUniqueIds(input.goals, 'goals');
  input.goals.forEach((g: any, i: number) => {
    if (!isPlainObject(g)) return;
    if (!isNonEmptyString(g.title)) errors.push(`goals[${i}].title must be a non-empty string.`);
    if (!isNonEmptyString(g.category)) errors.push(`goals[${i}].category must be a non-empty string.`);
    if (!VALID_TASK_STATUSES.has(g.status)) errors.push(`goals[${i}].status is invalid.`);
    if (!isValidTimestampOrDate(g.createdAt)) errors.push(`goals[${i}].createdAt must be a valid date or timestamp.`);
    if (g.deadline !== undefined && g.deadline !== '' && !isValidYMDDate(g.deadline)) {
      errors.push(`goals[${i}].deadline must be a valid YYYY-MM-DD date.`);
    }
    if (!Array.isArray(g.steps)) {
      errors.push(`goals[${i}].steps must be an array.`);
    } else {
      g.steps.forEach((st: any, sIdx: number) => {
        if (!isPlainObject(st) || !isNonEmptyString(st.id) || !isNonEmptyString(st.title) || typeof st.isCompleted !== 'boolean') {
          errors.push(`goals[${i}].steps[${sIdx}] must have valid id, title, and boolean isCompleted.`);
        }
      });
    }
  });

  // 4.4 habits
  collectUniqueIds(input.habits, 'habits');
  input.habits.forEach((h: any, i: number) => {
    if (!isPlainObject(h)) return;
    if (!isNonEmptyString(h.title)) errors.push(`habits[${i}].title must be a non-empty string.`);
    if (h.frequencyType !== 'daily' && h.frequencyType !== 'weekly') {
      errors.push(`habits[${i}].frequencyType must be "daily" or "weekly".`);
    }
    if (
      h.weeklyTargetDays !== undefined &&
      (!isFiniteNumber(h.weeklyTargetDays) || h.weeklyTargetDays < 1 || h.weeklyTargetDays > 7)
    ) {
      errors.push(`habits[${i}].weeklyTargetDays must be between 1 and 7.`);
    }
    if (!isValidYMDDate(h.effectiveDate)) {
      errors.push(`habits[${i}].effectiveDate must be a valid YYYY-MM-DD date.`);
    }
    if (!Array.isArray(h.checkedDates) || !h.checkedDates.every(isValidYMDDate)) {
      errors.push(`habits[${i}].checkedDates must be an array of valid YYYY-MM-DD dates.`);
    }
  });

  // 4.5 inbox
  collectUniqueIds(input.inbox, 'inbox');
  input.inbox.forEach((item: any, i: number) => {
    if (!isPlainObject(item)) return;
    if (!isNonEmptyString(item.text)) errors.push(`inbox[${i}].text must be a non-empty string.`);
    if (!isValidTimestampOrDate(item.createdAt)) errors.push(`inbox[${i}].createdAt must be a valid date or timestamp.`);
  });

  // 4.6 transactions
  const txIds = collectUniqueIds(input.transactions, 'transactions');
  input.transactions.forEach((tx: any, i: number) => {
    if (!isPlainObject(tx)) return;
    if (tx.type !== 'income' && tx.type !== 'expense' && tx.type !== 'transfer') {
      errors.push(`transactions[${i}].type must be "income", "expense", or "transfer".`);
    }
    if (!isNonNegativeNumber(tx.amount)) {
      errors.push(`transactions[${i}].amount must be a finite non-negative number.`);
    }
    if (!isNonEmptyString(tx.category)) {
      errors.push(`transactions[${i}].category must be a non-empty string.`);
    }
    if (!isValidYMDDate(tx.date)) {
      errors.push(`transactions[${i}].date ("${String(tx.date)}") must be a valid YYYY-MM-DD date.`);
    }
  });

  // 4.7 bills
  const billIds = collectUniqueIds(input.bills, 'bills');
  input.bills.forEach((b: any, i: number) => {
    if (!isPlainObject(b)) return;
    if (!isNonEmptyString(b.title)) errors.push(`bills[${i}].title must be a non-empty string.`);
    if (!isNonEmptyString(b.category)) errors.push(`bills[${i}].category must be a non-empty string.`);
    if (!isNonNegativeNumber(b.plannedAmount)) {
      errors.push(`bills[${i}].plannedAmount must be a finite non-negative number.`);
    }
    if (!isValidYMDDate(b.dueDate)) {
      errors.push(`bills[${i}].dueDate ("${String(b.dueDate)}") must be a valid YYYY-MM-DD date.`);
    }
    if (typeof b.isPaid !== 'boolean') {
      errors.push(`bills[${i}].isPaid must be a boolean.`);
    }
    if (
      b.repeatInterval !== undefined &&
      !['none', 'monthly', 'weekly', 'yearly'].includes(b.repeatInterval)
    ) {
      errors.push(`bills[${i}].repeatInterval is invalid.`);
    }
    if (b.actualPaidAmount !== undefined && !isNonNegativeNumber(b.actualPaidAmount)) {
      errors.push(`bills[${i}].actualPaidAmount must be a finite non-negative number.`);
    }
    if (b.paidDate !== undefined && !isValidYMDDate(b.paidDate)) {
      errors.push(`bills[${i}].paidDate must be a valid YYYY-MM-DD date.`);
    }
    if (b.paidOccurrences !== undefined) {
      if (!isPlainObject(b.paidOccurrences)) {
        errors.push(`bills[${i}].paidOccurrences must be an object.`);
      } else {
        for (const [occDate, occRec] of Object.entries(b.paidOccurrences)) {
          if (!isValidYMDDate(occDate)) {
            errors.push(`bills[${i}].paidOccurrences key "${occDate}" must be a valid YYYY-MM-DD date.`);
          }
          if (
            !isPlainObject(occRec) ||
            !isNonNegativeNumber(occRec.actualPaidAmount) ||
            !isValidYMDDate(occRec.paidDate)
          ) {
            errors.push(
              `bills[${i}].paidOccurrences["${occDate}"] must have a non-negative actualPaidAmount and valid paidDate.`
            );
          }
        }
      }
    }
  });

  // 4.8 savingsPots
  const potIds = collectUniqueIds(input.savingsPots, 'savingsPots');
  input.savingsPots.forEach((p: any, i: number) => {
    if (!isPlainObject(p)) return;
    if (!isNonEmptyString(p.name)) errors.push(`savingsPots[${i}].name must be a non-empty string.`);
    if (!isNonNegativeNumber(p.targetAmount)) {
      errors.push(`savingsPots[${i}].targetAmount must be a finite non-negative number.`);
    }
    if (!isValidYMDDate(p.targetDate)) {
      errors.push(`savingsPots[${i}].targetDate must be a valid YYYY-MM-DD date.`);
    }
    if (!isNonNegativeNumber(p.openingBalance)) {
      errors.push(`savingsPots[${i}].openingBalance must be a finite non-negative number.`);
    }
    if (!isValidYMDDate(p.openingDate)) {
      errors.push(`savingsPots[${i}].openingDate must be a valid YYYY-MM-DD date.`);
    }
    if (!Array.isArray(p.deposits)) {
      errors.push(`savingsPots[${i}].deposits must be an array.`);
    } else {
      p.deposits.forEach((dep: any, dIdx: number) => {
        if (!isPlainObject(dep) || !isNonEmptyString(dep.id)) {
          errors.push(`savingsPots[${i}].deposits[${dIdx}] must have a valid string id.`);
          return;
        }
        if (!isNonNegativeNumber(dep.amount)) {
          errors.push(`savingsPots[${i}].deposits[${dIdx}].amount must be a finite non-negative number.`);
        }
        if (!isValidYMDDate(dep.date)) {
          errors.push(`savingsPots[${i}].deposits[${dIdx}].date must be a valid YYYY-MM-DD date.`);
        }
        if (dep.source !== 'spending_balance' && dep.source !== 'outside') {
          errors.push(`savingsPots[${i}].deposits[${dIdx}].source must be "spending_balance" or "outside".`);
        }
      });
    }
  });

  // 4.9 debts
  collectUniqueIds(input.debts, 'debts');
  input.debts.forEach((d: any, i: number) => {
    if (!isPlainObject(d)) return;
    if (!isNonEmptyString(d.name)) errors.push(`debts[${i}].name must be a non-empty string.`);
    if (!isNonNegativeNumber(d.originalBalance)) {
      errors.push(`debts[${i}].originalBalance must be a finite non-negative number.`);
    }
    if (!isNonNegativeNumber(d.currentBalance)) {
      errors.push(`debts[${i}].currentBalance must be a finite non-negative number.`);
    }
    if (!isNonNegativeNumber(d.annualInterestRate)) {
      errors.push(`debts[${i}].annualInterestRate must be a finite non-negative number.`);
    }
    if (!isNonNegativeNumber(d.minimumMonthlyPayment)) {
      errors.push(`debts[${i}].minimumMonthlyPayment must be a finite non-negative number.`);
    }
    if (d.chosenMonthlyPayment !== undefined && !isNonNegativeNumber(d.chosenMonthlyPayment)) {
      errors.push(`debts[${i}].chosenMonthlyPayment must be a finite non-negative number.`);
    }
  });

  // 4.10 recipes
  const recipeIds = collectUniqueIds(input.recipes, 'recipes');
  input.recipes.forEach((r: any, i: number) => {
    if (!isPlainObject(r)) return;
    if (!isNonEmptyString(r.title)) errors.push(`recipes[${i}].title must be a non-empty string.`);
    if (!isNonEmptyString(r.category)) errors.push(`recipes[${i}].category must be a non-empty string.`);
    if (!isPositiveNumber(r.baseServings)) {
      errors.push(`recipes[${i}].baseServings must be a positive number.`);
    }
    if (!isNonNegativeNumber(r.prepTimeMinutes)) {
      errors.push(`recipes[${i}].prepTimeMinutes must be a non-negative number.`);
    }
    if (!isNonNegativeNumber(r.cookTimeMinutes)) {
      errors.push(`recipes[${i}].cookTimeMinutes must be a non-negative number.`);
    }
    if (!Array.isArray(r.ingredients)) {
      errors.push(`recipes[${i}].ingredients must be an array.`);
    } else {
      r.ingredients.forEach((ing: any, ingIdx: number) => {
        if (
          !isPlainObject(ing) ||
          !isNonEmptyString(ing.name) ||
          !isNonNegativeNumber(ing.amount) ||
          !isNonEmptyString(ing.unit)
        ) {
          errors.push(`recipes[${i}].ingredients[${ingIdx}] must have valid name, non-negative amount, and unit.`);
        }
      });
    }
  });

  // 4.11 plannedMeals
  collectUniqueIds(input.plannedMeals, 'plannedMeals');
  input.plannedMeals.forEach((m: any, i: number) => {
    if (!isPlainObject(m)) return;
    if (!isValidYMDDate(m.date)) errors.push(`plannedMeals[${i}].date must be a valid YYYY-MM-DD date.`);
    if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(m.mealType)) {
      errors.push(`plannedMeals[${i}].mealType must be "breakfast", "lunch", "dinner", or "snack".`);
    }
    if (!isNonEmptyString(m.recipeTitle)) errors.push(`plannedMeals[${i}].recipeTitle must be a non-empty string.`);
    if (!isPositiveNumber(m.plannedServings)) {
      errors.push(`plannedMeals[${i}].plannedServings must be a positive number.`);
    }
    if (!isPositiveNumber(m.baseServings)) {
      errors.push(`plannedMeals[${i}].baseServings must be a positive number.`);
    }
    if (typeof m.isConsumed !== 'boolean') {
      errors.push(`plannedMeals[${i}].isConsumed must be a boolean.`);
    }
    if (!Array.isArray(m.ingredientsSnapshot)) {
      errors.push(`plannedMeals[${i}].ingredientsSnapshot must be an array.`);
    } else {
      m.ingredientsSnapshot.forEach((ing: any, ingIdx: number) => {
        if (
          !isPlainObject(ing) ||
          !isNonEmptyString(ing.name) ||
          !isNonNegativeNumber(ing.amount) ||
          !isNonEmptyString(ing.unit)
        ) {
          errors.push(`plannedMeals[${i}].ingredientsSnapshot[${ingIdx}] must have valid name, amount, and unit.`);
        }
      });
    }
  });

  // 4.12 groceries
  collectUniqueIds(input.groceries, 'groceries');
  input.groceries.forEach((g: any, i: number) => {
    if (!isPlainObject(g)) return;
    if (!isNonEmptyString(g.name)) errors.push(`groceries[${i}].name must be a non-empty string.`);
    if (!isNonNegativeNumber(g.amount)) errors.push(`groceries[${i}].amount must be a non-negative number.`);
    if (!isNonEmptyString(g.unit)) errors.push(`groceries[${i}].unit must be a non-empty string.`);
    if (!isNonEmptyString(g.category)) errors.push(`groceries[${i}].category must be a non-empty string.`);
    if (typeof g.isPurchased !== 'boolean') errors.push(`groceries[${i}].isPurchased must be a boolean.`);
    if (g.sourceType !== 'generated' && g.sourceType !== 'manual') {
      errors.push(`groceries[${i}].sourceType must be "generated" or "manual".`);
    }
  });

  // 4.13 workouts
  collectUniqueIds(input.workouts, 'workouts');
  input.workouts.forEach((w: any, i: number) => {
    if (!isPlainObject(w)) return;
    if (!isNonEmptyString(w.title)) errors.push(`workouts[${i}].title must be a non-empty string.`);
    if (!isValidYMDDate(w.date)) errors.push(`workouts[${i}].date must be a valid YYYY-MM-DD date.`);
    if (!isNonNegativeNumber(w.durationMinutes)) {
      errors.push(`workouts[${i}].durationMinutes must be a non-negative number.`);
    }
    if (!Array.isArray(w.muscleGroups)) {
      errors.push(`workouts[${i}].muscleGroups must be an array.`);
    }
    if (typeof w.isCompleted !== 'boolean') {
      errors.push(`workouts[${i}].isCompleted must be a boolean.`);
    }
    if (!Array.isArray(w.exercises)) {
      errors.push(`workouts[${i}].exercises must be an array.`);
    } else {
      w.exercises.forEach((ex: any, exIdx: number) => {
        if (!isPlainObject(ex) || !isNonEmptyString(ex.id) || !isNonEmptyString(ex.name)) {
          errors.push(`workouts[${i}].exercises[${exIdx}] must have valid id and name.`);
          return;
        }
        if (!Array.isArray(ex.sets)) {
          errors.push(`workouts[${i}].exercises[${exIdx}].sets must be an array.`);
        } else {
          ex.sets.forEach((st: any, sIdx: number) => {
            if (
              !isPlainObject(st) ||
              !isPositiveNumber(st.setNumber) ||
              !isNonNegativeNumber(st.reps) ||
              !isNonNegativeNumber(st.restSeconds) ||
              typeof st.isCompleted !== 'boolean'
            ) {
              errors.push(`workouts[${i}].exercises[${exIdx}].sets[${sIdx}] has invalid set properties.`);
            }
          });
        }
      });
    }
  });

  // 4.14 weightProfiles
  const weightProfileIds = collectUniqueIds(input.weightProfiles, 'weightProfiles');
  input.weightProfiles.forEach((wp: any, i: number) => {
    if (!isPlainObject(wp)) return;
    if (!isNonEmptyString(wp.name)) errors.push(`weightProfiles[${i}].name must be a non-empty string.`);
    if (!isNonEmptyString(wp.avatarColor)) errors.push(`weightProfiles[${i}].avatarColor must be a non-empty string.`);
    if (wp.heightCm !== undefined && !isPositiveNumber(wp.heightCm)) {
      errors.push(`weightProfiles[${i}].heightCm must be a positive number.`);
    }
  });

  // 4.15 weightRecords
  collectUniqueIds(input.weightRecords, 'weightRecords');
  input.weightRecords.forEach((wr: any, i: number) => {
    if (!isPlainObject(wr)) return;
    if (!isNonEmptyString(wr.profileId)) {
      errors.push(`weightRecords[${i}].profileId must be a non-empty string.`);
    }
    if (!isValidYMDDate(wr.date)) {
      errors.push(`weightRecords[${i}].date must be a valid YYYY-MM-DD date.`);
    }
    if (!isPositiveNumber(wr.weightKg)) {
      errors.push(`weightRecords[${i}].weightKg must be a positive number.`);
    }
    if (wr.recordedHeightCm !== undefined && !isPositiveNumber(wr.recordedHeightCm)) {
      errors.push(`weightRecords[${i}].recordedHeightCm must be a positive number.`);
    }
  });

  // 4.16 hydrationEntries
  collectUniqueIds(input.hydrationEntries, 'hydrationEntries');
  input.hydrationEntries.forEach((he: any, i: number) => {
    if (!isPlainObject(he)) return;
    if (!isValidYMDDate(he.date)) errors.push(`hydrationEntries[${i}].date must be a valid YYYY-MM-DD date.`);
    if (!isNonEmptyString(he.time)) errors.push(`hydrationEntries[${i}].time must be a non-empty string.`);
    if (!isPositiveNumber(he.amountMl)) {
      errors.push(`hydrationEntries[${i}].amountMl must be a positive number.`);
    }
  });

  // 4.17 hydrationTargets
  input.hydrationTargets.forEach((ht: any, i: number) => {
    if (!isPlainObject(ht)) {
      errors.push(`hydrationTargets[${i}] must be an object.`);
      return;
    }
    if (!isValidYMDDate(ht.date)) errors.push(`hydrationTargets[${i}].date must be a valid YYYY-MM-DD date.`);
    if (!isPositiveNumber(ht.targetMl)) {
      errors.push(`hydrationTargets[${i}].targetMl must be a positive number.`);
    }
  });

  // 4.18 calendarEvents
  collectUniqueIds(input.calendarEvents, 'calendarEvents');
  input.calendarEvents.forEach((ce: any, i: number) => {
    if (!isPlainObject(ce)) return;
    if (!isNonEmptyString(ce.title)) errors.push(`calendarEvents[${i}].title must be a non-empty string.`);
    if (!isValidYMDDate(ce.date)) errors.push(`calendarEvents[${i}].date must be a valid YYYY-MM-DD date.`);
    if (typeof ce.isAllDay !== 'boolean') errors.push(`calendarEvents[${i}].isAllDay must be a boolean.`);
    if (!['birthday', 'event', 'free_time'].includes(ce.type)) {
      errors.push(`calendarEvents[${i}].type must be "birthday", "event", or "free_time".`);
    }
  });

  // 4.19 weeklyReviews (optional for backwards compatibility with older 1.0.0 backups)
  if (input.weeklyReviews !== undefined) {
    if (!Array.isArray(input.weeklyReviews)) {
      errors.push('Field "weeklyReviews" must be an array when provided.');
    } else {
      collectUniqueIds(input.weeklyReviews, 'weeklyReviews');
      input.weeklyReviews.forEach((wr: any, i: number) => {
        if (!isPlainObject(wr)) return;
        if (!isValidYMDDate(wr.weekStartDate)) {
          errors.push(`weeklyReviews[${i}].weekStartDate must be a valid YYYY-MM-DD date.`);
        }
        if (!isValidYMDDate(wr.weekEndDate)) {
          errors.push(`weeklyReviews[${i}].weekEndDate must be a valid YYYY-MM-DD date.`);
        }
        if (typeof wr.reflection !== 'string') {
          errors.push(`weeklyReviews[${i}].reflection must be a string.`);
        }
        if (!Array.isArray(wr.intentions) || !wr.intentions.every((it: any) => typeof it === 'string')) {
          errors.push(`weeklyReviews[${i}].intentions must be an array of strings.`);
        }
      });
    }
  }

  // 5. Cross-Entity Relationship Validation
  const householdMemberIds = new Set<string>(
    Array.isArray(input.settings.householdMembers)
      ? input.settings.householdMembers
          .filter((m: any) => isPlainObject(m) && isNonEmptyString(m.id))
          .map((m: any) => m.id)
      : []
  );

  // 5.1 weightRecords -> weightProfiles
  input.weightRecords.forEach((wr: any, i: number) => {
    if (isPlainObject(wr) && isNonEmptyString(wr.profileId) && !weightProfileIds.has(wr.profileId)) {
      errors.push(
        `weightRecords[${i}] ("${wr.id}") references non-existent weightProfileId "${wr.profileId}".`
      );
    }
  });

  // 5.2 transactions -> bills & savingsPots
  input.transactions.forEach((tx: any, i: number) => {
    if (!isPlainObject(tx)) return;
    if (tx.linkedBillId !== undefined && tx.linkedBillId !== '' && !billIds.has(tx.linkedBillId)) {
      errors.push(
        `transactions[${i}] ("${tx.id}") references non-existent linkedBillId "${tx.linkedBillId}".`
      );
    }
    if (tx.linkedPotId !== undefined && tx.linkedPotId !== '' && !potIds.has(tx.linkedPotId)) {
      errors.push(
        `transactions[${i}] ("${tx.id}") references non-existent linkedPotId "${tx.linkedPotId}".`
      );
    }
  });

  // 5.3 bills -> transactions
  input.bills.forEach((b: any, i: number) => {
    if (!isPlainObject(b)) return;
    if (b.linkedExpenseId !== undefined && b.linkedExpenseId !== '' && !txIds.has(b.linkedExpenseId)) {
      errors.push(
        `bills[${i}] ("${b.id}") references non-existent linkedExpenseId "${b.linkedExpenseId}".`
      );
    }
    if (isPlainObject(b.paidOccurrences)) {
      for (const [occDate, occRec] of Object.entries(b.paidOccurrences)) {
        if (
          isPlainObject(occRec) &&
          occRec.linkedExpenseId !== undefined &&
          occRec.linkedExpenseId !== '' &&
          !txIds.has(occRec.linkedExpenseId)
        ) {
          errors.push(
            `bills[${i}].paidOccurrences["${occDate}"] references non-existent linkedExpenseId "${occRec.linkedExpenseId}".`
          );
        }
      }
    }
  });

  // 5.4 savingsPots.deposits -> transactions
  input.savingsPots.forEach((p: any, i: number) => {
    if (!isPlainObject(p) || !Array.isArray(p.deposits)) return;
    p.deposits.forEach((dep: any, dIdx: number) => {
      if (
        isPlainObject(dep) &&
        dep.linkedTransferId !== undefined &&
        dep.linkedTransferId !== '' &&
        !txIds.has(dep.linkedTransferId)
      ) {
        errors.push(
          `savingsPots[${i}].deposits[${dIdx}] references non-existent linkedTransferId "${dep.linkedTransferId}".`
        );
      }
    });
  });

  // 5.5 plannedMeals -> recipes
  input.plannedMeals.forEach((m: any, i: number) => {
    if (
      isPlainObject(m) &&
      m.recipeId !== undefined &&
      m.recipeId !== '' &&
      !recipeIds.has(m.recipeId)
    ) {
      errors.push(
        `plannedMeals[${i}] ("${m.id}") references non-existent recipeId "${m.recipeId}".`
      );
    }
  });

  // 5.6 tasks & routines -> householdMembers
  if (householdMemberIds.size > 0) {
    input.tasks.forEach((t: any, i: number) => {
      if (
        isPlainObject(t) &&
        t.assignedMemberId !== undefined &&
        t.assignedMemberId !== '' &&
        !householdMemberIds.has(t.assignedMemberId)
      ) {
        errors.push(
          `tasks[${i}] ("${t.id}") references non-existent assignedMemberId "${t.assignedMemberId}".`
        );
      }
    });
    input.routines.forEach((r: any, i: number) => {
      if (
        isPlainObject(r) &&
        r.assignedMemberId !== undefined &&
        r.assignedMemberId !== '' &&
        !householdMemberIds.has(r.assignedMemberId)
      ) {
        errors.push(
          `routines[${i}] ("${r.id}") references non-existent assignedMemberId "${r.assignedMemberId}".`
        );
      }
    });
  }

  // Silence unused variable warning for taskIds
  void taskIds;

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  // Build normalized data clone with guaranteed currencySymbol and migrated module IDs
  const normalizedSettings: UserSettings = {
    ...(input.settings as UserSettings),
    ownerName: String(input.settings.ownerName).trim(),
    currencySymbol: getCurrencySymbol(input.settings.currency),
    accentColor:
      input.settings.accentColor && VALID_ACCENT_COLORS.has(input.settings.accentColor)
        ? input.settings.accentColor
        : 'teal',
    ...(Array.isArray(input.settings.enabledTools)
      ? { enabledTools: migrateEnabledTools(input.settings.enabledTools) }
      : {}),
    ...(Array.isArray(input.settings.pinnedTools)
      ? { pinnedTools: migratePinnedTools(input.settings.pinnedTools) }
      : {}),
  };

  const normalizedData: PlannerBackupData = {
    version: '1.0.0',
    exportedAt: input.exportedAt,
    ...(input.revision !== undefined ? { revision: input.revision } : {}),
    settings: normalizedSettings,
    tasks: input.tasks,
    routines: input.routines,
    goals: input.goals,
    habits: input.habits,
    inbox: input.inbox,
    transactions: input.transactions,
    bills: input.bills,
    savingsPots: input.savingsPots,
    debts: input.debts,
    recipes: input.recipes,
    plannedMeals: input.plannedMeals,
    groceries: input.groceries,
    workouts: input.workouts,
    weightProfiles: input.weightProfiles,
    weightRecords: input.weightRecords,
    hydrationEntries: input.hydrationEntries,
    hydrationTargets: input.hydrationTargets,
    calendarEvents: input.calendarEvents,
    weeklyReviews: Array.isArray(input.weeklyReviews) ? input.weeklyReviews : [],
  };

  const counts = {} as Record<BackupArrayKey, number>;
  let totalRecords = 0;
  for (const key of REQUIRED_BACKUP_ARRAY_KEYS) {
    const len = normalizedData[key].length;
    counts[key] = len;
    totalRecords += len;
  }

  return {
    isValid: true,
    errors: [],
    warnings,
    data: normalizedData,
    summary: {
      ownerName: normalizedSettings.ownerName,
      exportedAt: normalizedData.exportedAt,
      totalRecords,
      counts,
    },
  };
}

/**
 * Parses a raw JSON string and validates the full backup structure.
 */
export function parseAndValidateBackupJson(rawJson: string): BackupValidationResult {
  if (typeof rawJson !== 'string' || rawJson.trim().length === 0) {
    return {
      isValid: false,
      errors: ['Please provide non-empty backup JSON content.'],
      warnings: [],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson.trim());
  } catch {
    return {
      isValid: false,
      errors: ['Could not parse backup content as valid JSON.'],
      warnings: [],
    };
  }

  return validateBackupData(parsed);
}

function getDefaultStorage(): StorageLike | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return null;
}

/**
 * Reads the currently retained pre-restore snapshot from storage, if available and valid.
 */
export function getPreRestoreSnapshot(
  storage: Pick<StorageLike, 'getItem'> | null = getDefaultStorage()
): PreRestoreSnapshotInfo | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY_PRE_RESTORE_SNAPSHOT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed) || !isValidTimestampOrDate(parsed.savedAt)) {
      return null;
    }
    const validation = validateBackupData(parsed.snapshot);
    if (!validation.isValid || !validation.data || !validation.summary) {
      return null;
    }
    return {
      savedAt: parsed.savedAt,
      reason: typeof parsed.reason === 'string' ? parsed.reason : 'Pre-restore automatic safety snapshot',
      ownerName: validation.summary.ownerName,
      totalRecords: validation.summary.totalRecords,
      snapshot: validation.data,
    };
  } catch {
    return null;
  }
}

/**
 * Saves a recoverable pre-action snapshot of current planner data before destructive operations
 * (such as Reload Demo, Reset All Data, or Setup Wizard overwrite).
 */
export function savePreRestoreSnapshot(
  snapshot: PlannerBackupData,
  revision: number,
  reason = 'Automatic pre-action safety snapshot',
  storage: StorageLike | null = getDefaultStorage()
): PreRestoreSnapshotInfo | null {
  try {
    const clone = JSON.parse(JSON.stringify(snapshot)) as PlannerBackupData;
    clone.revision = revision;
    const savedAt = new Date().toISOString();
    let totalRecords = 0;
    for (const key of REQUIRED_BACKUP_ARRAY_KEYS) {
      totalRecords += Array.isArray(clone[key]) ? clone[key].length : 0;
    }
    const info: PreRestoreSnapshotInfo = {
      savedAt,
      reason,
      ownerName: clone.settings?.ownerName || 'Owner',
      totalRecords,
      snapshot: clone,
    };
    if (storage) {
      storage.setItem(
        STORAGE_KEY_PRE_RESTORE_SNAPSHOT,
        JSON.stringify({
          savedAt: info.savedAt,
          reason: info.reason,
          snapshot: info.snapshot,
        })
      );
    }
    return info;
  } catch {
    return null;
  }
}

/**
 * Atomically validates and restores a backup into storage while retaining a recoverable
 * snapshot of the previous planner state. Rolls back all storage keys if any write fails.
 */
export function atomicRestoreBackup(options: {
  incomingBackup: unknown;
  currentSnapshot: PlannerBackupData;
  currentRevision: number;
  reason?: string;
  storage?: StorageLike | null;
}): AtomicRestoreResult {
  const {
    incomingBackup,
    currentSnapshot,
    currentRevision,
    reason = 'Automatic snapshot before backup restore',
    storage = getDefaultStorage(),
  } = options;

  // Step 1: Validate incoming backup completely before mutating anything
  const validation = validateBackupData(incomingBackup);
  if (!validation.isValid || !validation.data) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  // Step 2: Prepare deep clone of incoming data and previous snapshot
  let restoredClone: PlannerBackupData;
  let currentClone: PlannerBackupData;
  try {
    restoredClone = JSON.parse(JSON.stringify(validation.data));
    currentClone = JSON.parse(JSON.stringify(currentSnapshot));
  } catch {
    return {
      success: false,
      errors: ['Failed to serialize backup payload for atomic restore.'],
    };
  }

  const storedRev = storage ? getStoredRevision() : currentRevision;
  const nextRevision = Math.max(storedRev, currentRevision, restoredClone.revision || 0) + 1;
  restoredClone.revision = nextRevision;

  const savedAt = new Date().toISOString();
  let prevTotalRecords = 0;
  for (const key of REQUIRED_BACKUP_ARRAY_KEYS) {
    prevTotalRecords += Array.isArray(currentClone[key]) ? currentClone[key].length : 0;
  }

  const previousSnapshotInfo: PreRestoreSnapshotInfo = {
    savedAt,
    reason,
    ownerName: currentClone.settings?.ownerName || 'Owner',
    totalRecords: prevTotalRecords,
    snapshot: currentClone,
  };

  // Step 3: Perform transactional storage write with rollback on failure
  if (storage) {
    const prevRawData = storage.getItem(STORAGE_KEY_DATA);
    const prevRawSettings = storage.getItem(STORAGE_KEY_SETTINGS);
    const prevRawRevision = storage.getItem(STORAGE_KEY_REVISION);
    const prevRawPreRestore = storage.getItem(STORAGE_KEY_PRE_RESTORE_SNAPSHOT);

    try {
      const serializedPreRestore = JSON.stringify({
        savedAt: previousSnapshotInfo.savedAt,
        reason: previousSnapshotInfo.reason,
        snapshot: previousSnapshotInfo.snapshot,
      });
      const serializedData = JSON.stringify(restoredClone);
      const serializedSettings = JSON.stringify(restoredClone.settings);
      const serializedRevision = String(nextRevision);

      storage.setItem(STORAGE_KEY_PRE_RESTORE_SNAPSHOT, serializedPreRestore);
      storage.setItem(STORAGE_KEY_DATA, serializedData);
      storage.setItem(STORAGE_KEY_SETTINGS, serializedSettings);
      storage.setItem(STORAGE_KEY_REVISION, serializedRevision);
    } catch (err) {
      // Roll back storage keys to exact pre-restore state
      try {
        if (prevRawPreRestore !== null) {
          storage.setItem(STORAGE_KEY_PRE_RESTORE_SNAPSHOT, prevRawPreRestore);
        } else {
          storage.removeItem(STORAGE_KEY_PRE_RESTORE_SNAPSHOT);
        }
        if (prevRawData !== null) {
          storage.setItem(STORAGE_KEY_DATA, prevRawData);
        } else {
          storage.removeItem(STORAGE_KEY_DATA);
        }
        if (prevRawSettings !== null) {
          storage.setItem(STORAGE_KEY_SETTINGS, prevRawSettings);
        } else {
          storage.removeItem(STORAGE_KEY_SETTINGS);
        }
        if (prevRawRevision !== null) {
          storage.setItem(STORAGE_KEY_REVISION, prevRawRevision);
        } else {
          storage.removeItem(STORAGE_KEY_REVISION);
        }
      } catch {
        // Ignore secondary rollback errors
      }
      return {
        success: false,
        errors: [
          `Could not write backup to local storage (${err instanceof Error ? err.message : 'storage error'}). Your previous planner data was preserved.`,
        ],
      };
    }
  }

  return {
    success: true,
    errors: [],
    restoredData: restoredClone,
    previousSnapshot: previousSnapshotInfo,
    nextRevision,
  };
}

/**
 * Restores the retained pre-restore snapshot back into active storage atomically.
 */
export function rollbackPreRestoreSnapshot(options: {
  currentSnapshot: PlannerBackupData;
  currentRevision: number;
  storage?: StorageLike | null;
}): AtomicRestoreResult {
  const { currentSnapshot, currentRevision, storage = getDefaultStorage() } = options;
  const existingPreRestore = getPreRestoreSnapshot(storage);
  if (!existingPreRestore) {
    return {
      success: false,
      errors: ['No recoverable previous snapshot was found in local storage.'],
    };
  }

  return atomicRestoreBackup({
    incomingBackup: existingPreRestore.snapshot,
    currentSnapshot,
    currentRevision,
    reason: 'Snapshot saved before rolling back to previous planner state',
    storage,
  });
}
