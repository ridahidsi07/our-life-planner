import {
  BillItem,
  BillOccurrence,
  FinancialTransaction,
  UserSettings,
  BudgetPeriodType,
} from '../types/planner';
import { CashFlowCalculation } from './calculations';

export interface BudgetPeriodRange {
  periodType: BudgetPeriodType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;     // e.g. "October 1 – 31, 2026" or "Oct 5 – 11, 2026"
  subLabel: string;  // e.g. "Monthly budget plan" or "Weekly budget plan"
  daysInPeriod: number;
}

export function padZero(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = padZero(d.getMonth() + 1);
  const day = padZero(d.getDate());
  return `${y}-${m}-${day}`;
}

export function parseDateStr(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateStr(d);
}

export function diffInDays(startStr: string, endStr: string): number {
  const s = parseDateStr(startStr);
  const e = parseDateStr(endStr);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Computes the start and end dates and human-readable label for a given budget period cadence.
 */
export function getBudgetPeriodRange(options: {
  referenceDate: string;
  periodType?: BudgetPeriodType;
  weekStartsOn?: 'Monday' | 'Sunday';
  customStartDate?: string;
  customEndDate?: string;
}): BudgetPeriodRange {
  const periodType = options.periodType || 'monthly';
  const ref = options.referenceDate;
  const [y, m, d] = ref.split('-').map(Number);

  if (periodType === 'weekly') {
    const weekStartsOn = options.weekStartsOn || 'Monday';
    const refDate = parseDateStr(ref);
    const dayOfWeek = refDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    let diff: number;
    if (weekStartsOn === 'Sunday') {
      diff = dayOfWeek;
    } else {
      diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    }
    const startObj = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - diff);
    const endObj = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate() + 6);
    const startDate = formatDateStr(startObj);
    const endDate = formatDateStr(endObj);

    const startMonth = startObj.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endObj.toLocaleDateString('en-US', { month: 'short' });
    const startYear = startObj.getFullYear();
    const endYear = endObj.getFullYear();

    let label = '';
    if (startYear === endYear) {
      if (startObj.getMonth() === endObj.getMonth()) {
        label = `${startMonth} ${startObj.getDate()} – ${endObj.getDate()}, ${startYear}`;
      } else {
        label = `${startMonth} ${startObj.getDate()} – ${endMonth} ${endObj.getDate()}, ${startYear}`;
      }
    } else {
      label = `${startMonth} ${startObj.getDate()}, ${startYear} – ${endMonth} ${endObj.getDate()}, ${endYear}`;
    }

    return {
      periodType: 'weekly',
      startDate,
      endDate,
      label,
      subLabel: 'Weekly budget plan',
      daysInPeriod: 7,
    };
  }

  if (periodType === 'paycheck') {
    if (options.customStartDate) {
      const anchor = parseDateStr(options.customStartDate);
      const refDate = parseDateStr(ref);
      const diffDays = Math.floor((refDate.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
      const cycleIndex = Math.floor(diffDays / 14);
      const startObj = new Date(anchor.getTime() + cycleIndex * 14 * 86400000);
      const endObj = new Date(startObj.getTime() + 13 * 86400000);
      const startDate = formatDateStr(startObj);
      const endDate = formatDateStr(endObj);
      const sMonth = startObj.toLocaleDateString('en-US', { month: 'short' });
      const eMonth = endObj.toLocaleDateString('en-US', { month: 'short' });
      const label = `${sMonth} ${startObj.getDate()} – ${eMonth} ${endObj.getDate()}, ${endObj.getFullYear()}`;
      return {
        periodType: 'paycheck',
        startDate,
        endDate,
        label,
        subLabel: 'Paycheck budget plan',
        daysInPeriod: 14,
      };
    } else {
      // Semi-monthly: 1st–15th or 16th–last day of month
      const daysInMonth = getDaysInMonth(y, m);
      const monthShort = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
      if (d <= 15) {
        return {
          periodType: 'paycheck',
          startDate: `${y}-${padZero(m)}-01`,
          endDate: `${y}-${padZero(m)}-15`,
          label: `${monthShort} 1 – 15, ${y}`,
          subLabel: 'Paycheck budget plan (1st half)',
          daysInPeriod: 15,
        };
      } else {
        return {
          periodType: 'paycheck',
          startDate: `${y}-${padZero(m)}-16`,
          endDate: `${y}-${padZero(m)}-${padZero(daysInMonth)}`,
          label: `${monthShort} 16 – ${daysInMonth}, ${y}`,
          subLabel: 'Paycheck budget plan (2nd half)',
          daysInPeriod: daysInMonth - 15,
        };
      }
    }
  }

  if (periodType === 'custom') {
    if (options.customStartDate && options.customEndDate) {
      const sObj = parseDateStr(options.customStartDate);
      const eObj = parseDateStr(options.customEndDate);
      const sMonth = sObj.toLocaleDateString('en-US', { month: 'short' });
      const eMonth = eObj.toLocaleDateString('en-US', { month: 'short' });
      const label = `${sMonth} ${sObj.getDate()} – ${eMonth} ${eObj.getDate()}, ${eObj.getFullYear()}`;
      return {
        periodType: 'custom',
        startDate: options.customStartDate,
        endDate: options.customEndDate,
        label,
        subLabel: 'Custom budget plan',
        daysInPeriod: diffInDays(options.customStartDate, options.customEndDate),
      };
    }
  }

  // Default: monthly
  const daysInMonth = getDaysInMonth(y, m);
  const monthLong = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });
  const startDate = `${y}-${padZero(m)}-01`;
  const endDate = `${y}-${padZero(m)}-${padZero(daysInMonth)}`;
  return {
    periodType: 'monthly',
    startDate,
    endDate,
    label: `${monthLong} 1 – ${daysInMonth}, ${y}`,
    subLabel: 'Monthly budget plan',
    daysInPeriod: daysInMonth,
  };
}

/**
 * Navigate to previous or next period based on the current period type.
 */
export function navigateBudgetPeriod(
  currentRange: BudgetPeriodRange,
  direction: 'prev' | 'next',
  weekStartsOn?: 'Monday' | 'Sunday'
): BudgetPeriodRange {
  const dir = direction === 'next' ? 1 : -1;
  if (currentRange.periodType === 'weekly') {
    const shift = dir * 7;
    const targetRef = addDays(currentRange.startDate, shift);
    return getBudgetPeriodRange({
      referenceDate: targetRef,
      periodType: 'weekly',
      weekStartsOn,
    });
  }

  if (currentRange.periodType === 'monthly') {
    const [y, m] = currentRange.startDate.split('-').map(Number);
    const targetDate = new Date(y, m - 1 + dir, 1);
    const ref = formatDateStr(targetDate);
    return getBudgetPeriodRange({
      referenceDate: ref,
      periodType: 'monthly',
    });
  }

  if (currentRange.periodType === 'paycheck') {
    const [y, m, d] = currentRange.startDate.split('-').map(Number);
    if (d === 1) {
      if (direction === 'next') {
        return getBudgetPeriodRange({
          referenceDate: `${y}-${padZero(m)}-16`,
          periodType: 'paycheck',
        });
      } else {
        const prevMonth = new Date(y, m - 2, 1);
        const pmY = prevMonth.getFullYear();
        const pmM = prevMonth.getMonth() + 1;
        return getBudgetPeriodRange({
          referenceDate: `${pmY}-${padZero(pmM)}-16`,
          periodType: 'paycheck',
        });
      }
    } else {
      if (direction === 'next') {
        const nextMonth = new Date(y, m, 1);
        const nmY = nextMonth.getFullYear();
        const nmM = nextMonth.getMonth() + 1;
        return getBudgetPeriodRange({
          referenceDate: `${nmY}-${padZero(nmM)}-01`,
          periodType: 'paycheck',
        });
      } else {
        return getBudgetPeriodRange({
          referenceDate: `${y}-${padZero(m)}-01`,
          periodType: 'paycheck',
        });
      }
    }
  }

  if (currentRange.periodType === 'custom') {
    const days = currentRange.daysInPeriod;
    const s = addDays(currentRange.startDate, dir * days);
    const e = addDays(currentRange.endDate, dir * days);
    return getBudgetPeriodRange({
      referenceDate: s,
      periodType: 'custom',
      customStartDate: s,
      customEndDate: e,
    });
  }

  return currentRange;
}

/**
 * Returns allocations (planned income, planned savings, category limits)
 * scaled or tailored to the selected budget period cadence.
 */
export function getBudgetPeriodAllocations(
  settings: UserSettings,
  periodRange: BudgetPeriodRange
): {
  plannedIncome: number;
  plannedSavings: number;
  categoryLimits: Record<string, number>;
  categoryLimitsTotal: number;
} {
  const baseIncome = settings.budgetPlannedIncome ?? 1200;
  const baseSavings = settings.budgetPlannedSavings ?? 250;
  const baseLimits = settings.budgetCategoryLimits ?? {
    Food: 250,
    Transport: 100,
    Home: 200,
    Personal: 150,
  };

  const periodType = periodRange.periodType;

  // 1. Check for explicit period allocation configuration
  if (settings.budgetPeriodAllocations && settings.budgetPeriodAllocations[periodType]) {
    const alloc = settings.budgetPeriodAllocations[periodType]!;
    const plannedIncome = alloc.plannedIncome ?? baseIncome;
    const plannedSavings = alloc.plannedSavings ?? baseSavings;
    const categoryLimits = alloc.categoryLimits ?? baseLimits;
    const categoryLimitsTotal = Object.values(categoryLimits).reduce((a, b) => a + b, 0);
    return {
      plannedIncome,
      plannedSavings,
      categoryLimits,
      categoryLimitsTotal,
    };
  }

  // 2. Monthly base values
  if (periodType === 'monthly') {
    const categoryLimitsTotal = Object.values(baseLimits).reduce((a, b) => a + b, 0);
    return {
      plannedIncome: baseIncome,
      plannedSavings: baseSavings,
      categoryLimits: baseLimits,
      categoryLimitsTotal,
    };
  }

  // 3. Proportional scaling for weekly, paycheck, or custom periods
  let ratio = 1.0;
  if (periodType === 'weekly') {
    ratio = 7 / 30.4167;
  } else if (periodType === 'paycheck') {
    ratio = periodRange.daysInPeriod / 30.4167;
  } else if (periodType === 'custom') {
    ratio = periodRange.daysInPeriod / 30.4167;
  }

  const categoryLimits: Record<string, number> = {};
  for (const [cat, lim] of Object.entries(baseLimits)) {
    categoryLimits[cat] = Math.round(lim * ratio);
  }
  const categoryLimitsTotal = Object.values(categoryLimits).reduce((a, b) => a + b, 0);

  return {
    plannedIncome: Math.round(baseIncome * ratio),
    plannedSavings: Math.round(baseSavings * ratio),
    categoryLimits,
    categoryLimitsTotal,
  };
}

/**
 * Generates bill occurrences for a given budget period, identifying
 * current period obligations, payments made, and overdue bills.
 */
export function generateBillOccurrences(params: {
  bills: BillItem[];
  transactions: FinancialTransaction[];
  periodRange: BudgetPeriodRange;
  referenceDate: string;
}): {
  periodOccurrences: BillOccurrence[];
  overdueOccurrences: BillOccurrence[];
  unpaidPeriodTotal: number;
  unpaidOverdueTotal: number;
  totalUnpaidObligations: number;
} {
  const { bills, transactions, periodRange, referenceDate } = params;
  const periodOccurrences: BillOccurrence[] = [];
  const overdueOccurrences: BillOccurrence[] = [];

  for (const bill of bills) {
    const repeat = bill.repeatInterval || 'none';

    if (repeat === 'none') {
      const isPaid =
        bill.isPaid ||
        Boolean(bill.paidOccurrences?.[bill.dueDate]) ||
        transactions.some((t) => t.linkedBillId === bill.id);

      const paidRecord = bill.paidOccurrences?.[bill.dueDate];
      const actualPaidAmount = paidRecord?.actualPaidAmount ?? bill.actualPaidAmount;
      const paidDate = paidRecord?.paidDate ?? bill.paidDate;
      const linkedExpenseId = paidRecord?.linkedExpenseId ?? bill.linkedExpenseId;

      const isOverdue = !isPaid && bill.dueDate < referenceDate;
      const occ: BillOccurrence = {
        id: bill.id,
        billId: bill.id,
        title: bill.title,
        category: bill.category,
        plannedAmount: bill.plannedAmount,
        dueDate: bill.dueDate,
        repeatInterval: 'none',
        isPaid,
        actualPaidAmount,
        paidDate,
        linkedExpenseId,
        isOverdue,
        status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'unpaid',
      };

      if (bill.dueDate >= periodRange.startDate && bill.dueDate <= periodRange.endDate) {
        periodOccurrences.push(occ);
      } else if (bill.dueDate < periodRange.startDate && !isPaid) {
        overdueOccurrences.push(occ);
      }
      continue;
    }

    if (repeat === 'monthly') {
      const [startYear, startMonth] = periodRange.startDate.split('-').map(Number);
      const [endYear, endMonth] = periodRange.endDate.split('-').map(Number);
      const startDay = parseInt(bill.dueDate.split('-')[2]);

      let curY = startYear;
      let curM = startMonth;
      while (curY < endYear || (curY === endYear && curM <= endMonth)) {
        const daysInCurMonth = getDaysInMonth(curY, curM);
        const day = Math.min(startDay, daysInCurMonth);
        const occDate = `${curY}-${padZero(curM)}-${padZero(day)}`;

        // Only generate occurrence if on or after the bill's creation/first dueDate
        if (occDate >= bill.dueDate.slice(0, 7) + '-01') {
          if (occDate >= periodRange.startDate && occDate <= periodRange.endDate) {
            const paidRecord = bill.paidOccurrences?.[occDate];
            const isBaseDueDate = bill.dueDate === occDate;
            const isTxPaid = transactions.some(
              (t) =>
                t.linkedBillId === bill.id &&
                t.date.startsWith(`${curY}-${padZero(curM)}`)
            );
            const isPaid =
              Boolean(paidRecord) ||
              (isBaseDueDate && bill.isPaid) ||
              isTxPaid;

            const actualPaidAmount =
              paidRecord?.actualPaidAmount ??
              (isBaseDueDate ? bill.actualPaidAmount : undefined) ??
              (isPaid ? bill.plannedAmount : undefined);
            const paidDate =
              paidRecord?.paidDate ??
              (isBaseDueDate ? bill.paidDate : undefined);
            const linkedExpenseId =
              paidRecord?.linkedExpenseId ??
              (isBaseDueDate ? bill.linkedExpenseId : undefined);

            const isOverdue = !isPaid && occDate < referenceDate;
            periodOccurrences.push({
              id: `${bill.id}:${occDate}`,
              billId: bill.id,
              title: bill.title,
              category: bill.category,
              plannedAmount: bill.plannedAmount,
              dueDate: occDate,
              repeatInterval: 'monthly',
              isPaid,
              actualPaidAmount,
              paidDate,
              linkedExpenseId,
              isOverdue,
              status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'unpaid',
            });
          }
        }

        curM++;
        if (curM > 12) {
          curM = 1;
          curY++;
        }
      }

      // Check for overdue occurrences in previous months (up to 3 months prior to period start)
      let prevM = startMonth - 1;
      let prevY = startYear;
      if (prevM < 1) {
        prevM = 12;
        prevY--;
      }
      for (let i = 0; i < 3; i++) {
        const daysInPrevMonth = getDaysInMonth(prevY, prevM);
        const day = Math.min(startDay, daysInPrevMonth);
        const prevOccDate = `${prevY}-${padZero(prevM)}-${padZero(day)}`;

        // Only consider if bill was already active by this date
        if (prevOccDate >= bill.dueDate.slice(0, 7) + '-01') {
          const paidRecord = bill.paidOccurrences?.[prevOccDate];
          const isBaseDueDate = bill.dueDate === prevOccDate;
          const isTxPaid = transactions.some(
            (t) =>
              t.linkedBillId === bill.id &&
              t.date.startsWith(`${prevY}-${padZero(prevM)}`)
          );
          const isPaid =
            Boolean(paidRecord) ||
            (isBaseDueDate && bill.isPaid) ||
            isTxPaid;

          if (!isPaid && prevOccDate < periodRange.startDate) {
            overdueOccurrences.push({
              id: `${bill.id}:${prevOccDate}`,
              billId: bill.id,
              title: bill.title,
              category: bill.category,
              plannedAmount: bill.plannedAmount,
              dueDate: prevOccDate,
              repeatInterval: 'monthly',
              isPaid: false,
              isOverdue: true,
              status: 'overdue',
            });
          }
        }

        prevM--;
        if (prevM < 1) {
          prevM = 12;
          prevY--;
        }
      }
      continue;
    }

    if (repeat === 'weekly') {
      const anchor = parseDateStr(bill.dueDate);
      const startP = parseDateStr(periodRange.startDate);
      const diffDays = Math.floor((startP.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
      const firstWeekIndex = Math.max(0, Math.floor(diffDays / 7) - 2);

      for (let w = firstWeekIndex; w < firstWeekIndex + 25; w++) {
        const occDateObj = new Date(anchor.getTime() + w * 7 * 86400000);
        const occDate = formatDateStr(occDateObj);

        if (occDate > periodRange.endDate && occDate > referenceDate) {
          break;
        }

        const isPaid =
          Boolean(bill.paidOccurrences?.[occDate]) ||
          (bill.dueDate === occDate && bill.isPaid) ||
          transactions.some((t) => t.linkedBillId === bill.id && t.date === occDate);

        const paidRecord = bill.paidOccurrences?.[occDate];
        const actualPaidAmount = paidRecord?.actualPaidAmount ?? (bill.dueDate === occDate ? bill.actualPaidAmount : undefined);
        const paidDate = paidRecord?.paidDate ?? (bill.dueDate === occDate ? bill.paidDate : undefined);
        const linkedExpenseId = paidRecord?.linkedExpenseId ?? (bill.dueDate === occDate ? bill.linkedExpenseId : undefined);

        const isOverdue = !isPaid && occDate < referenceDate;

        if (occDate >= periodRange.startDate && occDate <= periodRange.endDate) {
          periodOccurrences.push({
            id: `${bill.id}:${occDate}`,
            billId: bill.id,
            title: bill.title,
            category: bill.category,
            plannedAmount: bill.plannedAmount,
            dueDate: occDate,
            repeatInterval: 'weekly',
            isPaid,
            actualPaidAmount,
            paidDate,
            linkedExpenseId,
            isOverdue,
            status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'unpaid',
          });
        } else if (occDate < periodRange.startDate && !isPaid) {
          overdueOccurrences.push({
            id: `${bill.id}:${occDate}`,
            billId: bill.id,
            title: bill.title,
            category: bill.category,
            plannedAmount: bill.plannedAmount,
            dueDate: occDate,
            repeatInterval: 'weekly',
            isPaid: false,
            isOverdue: true,
            status: 'overdue',
          });
        }
      }
      continue;
    }

    if (repeat === 'yearly') {
      const [, anchorMonth, anchorDay] = bill.dueDate.split('-').map(Number);
      const [startYear] = periodRange.startDate.split('-').map(Number);
      const [endYear] = periodRange.endDate.split('-').map(Number);

      for (let y = startYear; y <= endYear; y++) {
        const occDate = `${y}-${padZero(anchorMonth)}-${padZero(anchorDay)}`;
        if (occDate >= periodRange.startDate && occDate <= periodRange.endDate) {
          const isPaid =
            Boolean(bill.paidOccurrences?.[occDate]) ||
            (bill.dueDate === occDate && bill.isPaid) ||
            transactions.some((t) => t.linkedBillId === bill.id && t.date.startsWith(`${y}-`));

          const paidRecord = bill.paidOccurrences?.[occDate];
          const actualPaidAmount = paidRecord?.actualPaidAmount ?? (bill.dueDate === occDate ? bill.actualPaidAmount : undefined);
          const paidDate = paidRecord?.paidDate ?? (bill.dueDate === occDate ? bill.paidDate : undefined);
          const linkedExpenseId = paidRecord?.linkedExpenseId ?? (bill.dueDate === occDate ? bill.linkedExpenseId : undefined);
          const isOverdue = !isPaid && occDate < referenceDate;

          periodOccurrences.push({
            id: `${bill.id}:${occDate}`,
            billId: bill.id,
            title: bill.title,
            category: bill.category,
            plannedAmount: bill.plannedAmount,
            dueDate: occDate,
            repeatInterval: 'yearly',
            isPaid,
            actualPaidAmount,
            paidDate,
            linkedExpenseId,
            isOverdue,
            status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'unpaid',
          });
        }
      }
      continue;
    }
  }

  const unpaidPeriodTotal = periodOccurrences
    .filter((o) => !o.isPaid)
    .reduce((sum, o) => sum + o.plannedAmount, 0);

  const unpaidOverdueTotal = overdueOccurrences
    .reduce((sum, o) => sum + o.plannedAmount, 0);

  const totalUnpaidObligations = Math.round((unpaidPeriodTotal + unpaidOverdueTotal) * 100) / 100;

  return {
    periodOccurrences,
    overdueOccurrences,
    unpaidPeriodTotal: Math.round(unpaidPeriodTotal * 100) / 100,
    unpaidOverdueTotal: Math.round(unpaidOverdueTotal * 100) / 100,
    totalUnpaidObligations,
  };
}

/**
 * Calculates comprehensive period cash flow, cleanly separating cumulative
 * running account balance from spending activity within the active budget period.
 */
export function calculatePeriodCashFlow(params: {
  settings: UserSettings;
  transactions: FinancialTransaction[];
  bills: BillItem[];
  periodRange: BudgetPeriodRange;
  referenceDate: string;
}): CashFlowCalculation & {
  periodRange: BudgetPeriodRange;
  periodIncome: number;
  periodExpenses: number;
  periodSavingsTransfers: number;
  periodCategorySpent: Record<string, number>;
  periodOccurrences: BillOccurrence[];
  overdueOccurrences: BillOccurrence[];
  allActualIncome: number;
  allActualExpenses: number;
  allSavingsTransfers: number;
} {
  const { settings, transactions, bills, periodRange, referenceDate } = params;

  // 1. Cumulative Account Balance: all-time actual income, expenses, and savings transfers
  const openingBalance = settings.budgetOpeningBalance ?? 100.0;
  const allActualIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const allActualExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const allSavingsTransfers = transactions
    .filter((t) => t.type === 'transfer' && t.linkedPotId)
    .reduce((sum, t) => sum + t.amount, 0);

  const actualBalance =
    openingBalance + allActualIncome - allActualExpenses - allSavingsTransfers;

  // 2. Period-scoped transactions
  const periodTxList = transactions.filter(
    (t) => t.date >= periodRange.startDate && t.date <= periodRange.endDate
  );

  const periodIncome = periodTxList
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const periodExpenses = periodTxList
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const periodSavingsTransfers = periodTxList
    .filter((t) => t.type === 'transfer' && t.linkedPotId)
    .reduce((sum, t) => sum + t.amount, 0);

  const periodCategorySpent: Record<string, number> = {};
  periodTxList
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const cat = t.category || 'Other';
      periodCategorySpent[cat] =
        Math.round(((periodCategorySpent[cat] || 0) + t.amount) * 100) / 100;
    });

  // 3. Bill occurrences and obligations
  const billResults = generateBillOccurrences({
    bills,
    transactions,
    periodRange,
    referenceDate,
  });

  const unpaidBills = billResults.totalUnpaidObligations;

  // 4. Period allocations
  const alloc = getBudgetPeriodAllocations(settings, periodRange);
  const totalPlannedSavings = alloc.plannedSavings;
  const plannedSavingsStillDue = Math.max(0, totalPlannedSavings - periodSavingsTransfers);
  const plannedIncome = alloc.plannedIncome;
  const categoryLimitsTotal = alloc.categoryLimitsTotal;

  // 5. Left to spend: from cumulative spending balance minus unpaid obligations & savings due
  const leftToSpend = actualBalance - unpaidBills - plannedSavingsStillDue;

  // 6. Unallocated budget for the period
  const unallocatedBudget =
    openingBalance + plannedIncome - categoryLimitsTotal - totalPlannedSavings;

  return {
    openingBalance: Math.round(openingBalance * 100) / 100,
    actualIncome: Math.round(periodIncome * 100) / 100,
    actualExpenses: Math.round(periodExpenses * 100) / 100,
    savingsTransfers: Math.round(periodSavingsTransfers * 100) / 100,
    actualBalance: Math.round(actualBalance * 100) / 100,
    unpaidBills: Math.round(unpaidBills * 100) / 100,
    plannedSavingsDue: Math.round(plannedSavingsStillDue * 100) / 100,
    leftToSpend: Math.round(leftToSpend * 100) / 100,
    plannedIncome: Math.round(plannedIncome * 100) / 100,
    categoryLimitsTotal: Math.round(categoryLimitsTotal * 100) / 100,
    plannedSavingsTotal: Math.round(totalPlannedSavings * 100) / 100,
    unallocatedBudget: Math.round(unallocatedBudget * 100) / 100,
    // Extra period fields
    periodRange,
    periodIncome: Math.round(periodIncome * 100) / 100,
    periodExpenses: Math.round(periodExpenses * 100) / 100,
    periodSavingsTransfers: Math.round(periodSavingsTransfers * 100) / 100,
    periodCategorySpent,
    periodOccurrences: billResults.periodOccurrences,
    overdueOccurrences: billResults.overdueOccurrences,
    allActualIncome: Math.round(allActualIncome * 100) / 100,
    allActualExpenses: Math.round(allActualExpenses * 100) / 100,
    allSavingsTransfers: Math.round(allSavingsTransfers * 100) / 100,
  };
}
