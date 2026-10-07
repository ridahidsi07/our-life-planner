import { DebtItem, DebtStrategy, HabitItem, WorkoutSession } from '../types/planner';

/**
 * Section 6: Financial Calculations
 */

export interface CashFlowCalculation {
  openingBalance: number;
  actualIncome: number;
  actualExpenses: number;
  savingsTransfers: number;
  actualBalance: number;
  unpaidBills: number;
  plannedSavingsDue: number;
  leftToSpend: number;
  plannedIncome: number;
  categoryLimitsTotal: number;
  plannedSavingsTotal: number;
  unallocatedBudget: number;
}

export function calculateCashFlow(params: {
  openingBalance: number;
  actualIncome: number;
  actualExpenses: number;
  spendingToSavingsTransfers: number;
  unpaidBills: number;
  plannedSavingsStillDue: number;
  plannedIncome: number;
  categoryLimitsTotal: number;
  totalPlannedSavings: number;
}): CashFlowCalculation {
  // Actual spending balance = opening + actual income - actual expenses - spending transfers
  const actualBalance =
    params.openingBalance +
    params.actualIncome -
    params.actualExpenses -
    params.spendingToSavingsTransfers;

  // Left to spend = actual balance - unpaid bills - outstanding planned savings
  const leftToSpend =
    actualBalance - params.unpaidBills - params.plannedSavingsStillDue;

  // Unallocated budget = opening + planned income - category limits - planned savings
  const unallocatedBudget =
    params.openingBalance +
    params.plannedIncome -
    params.categoryLimitsTotal -
    params.totalPlannedSavings;

  return {
    openingBalance: Math.round(params.openingBalance * 100) / 100,
    actualIncome: Math.round(params.actualIncome * 100) / 100,
    actualExpenses: Math.round(params.actualExpenses * 100) / 100,
    savingsTransfers: Math.round(params.spendingToSavingsTransfers * 100) / 100,
    actualBalance: Math.round(actualBalance * 100) / 100,
    unpaidBills: Math.round(params.unpaidBills * 100) / 100,
    plannedSavingsDue: Math.round(params.plannedSavingsStillDue * 100) / 100,
    leftToSpend: Math.round(leftToSpend * 100) / 100,
    plannedIncome: Math.round(params.plannedIncome * 100) / 100,
    categoryLimitsTotal: Math.round(params.categoryLimitsTotal * 100) / 100,
    plannedSavingsTotal: Math.round(params.totalPlannedSavings * 100) / 100,
    unallocatedBudget: Math.round(unallocatedBudget * 100) / 100,
  };
}

/**
 * Section 6: Debt Repayment & Forecast Simulation
 */
export interface DebtMonthlyPoint {
  monthIndex: number;
  dateStr: string;
  totalBalance: number;
  individualBalances: Record<string, number>;
  totalInterestPaid: number;
}

export interface DebtForecastResult {
  isPayable: boolean;
  unpayableReason?: string;
  totalMonths: number;
  payoffDate: string;
  totalInterestPaid: number;
  finalPaymentAmount: number;
  timeline: DebtMonthlyPoint[];
}

export function simulateDebtPayoff(
  debts: DebtItem[],
  strategy: DebtStrategy,
  startDateStr: string, // YYYY-MM-DD
  baseMonthlyPayment: number,
  extraMonthlyPayment: number = 0
): DebtForecastResult {
  const activeDebts = debts.filter((d) => d.currentBalance > 0);
  if (activeDebts.length === 0) {
    return {
      isPayable: true,
      totalMonths: 0,
      payoffDate: startDateStr,
      totalInterestPaid: 0,
      finalPaymentAmount: 0,
      timeline: [
        {
          monthIndex: 0,
          dateStr: startDateStr,
          totalBalance: 0,
          individualBalances: {},
          totalInterestPaid: 0,
        },
      ],
    };
  }

  // Minimum required check across all debts
  const totalMinPayment = activeDebts.reduce((sum, d) => sum + d.minimumMonthlyPayment, 0);
  const totalMonthlyBudget = baseMonthlyPayment + extraMonthlyPayment;

  if (totalMonthlyBudget < totalMinPayment) {
    return {
      isPayable: false,
      unpayableReason: `Your $${totalMonthlyBudget} monthly budget is below the $${totalMinPayment} required minimum.`,
      totalMonths: 0,
      payoffDate: '',
      totalInterestPaid: 0,
      finalPaymentAmount: 0,
      timeline: [],
    };
  }

  // Deep clone debts for simulation
  interface SimDebt {
    id: string;
    name: string;
    balance: number;
    annualRate: number; // percentage
    minPayment: number;
    chosenPayment?: number;
    customOrderIndex?: number;
  }

  const simDebts: SimDebt[] = activeDebts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: d.currentBalance,
    annualRate: d.annualInterestRate,
    minPayment: d.minimumMonthlyPayment,
    chosenPayment: d.chosenMonthlyPayment,
    customOrderIndex: d.customOrderIndex ?? 0,
  }));

  // Initial first month interest check for single debt
  if (simDebts.length === 1) {
    const monthlyRate = simDebts[0].annualRate / 100 / 12;
    const firstMonthInterest = simDebts[0].balance * monthlyRate;
    if (totalMonthlyBudget <= firstMonthInterest && simDebts[0].annualRate > 0) {
      return {
        isPayable: false,
        unpayableReason: `Payment of $${totalMonthlyBudget}/month cannot cover the first month's interest of $${firstMonthInterest.toFixed(2)}.`,
        totalMonths: 0,
        payoffDate: '',
        totalInterestPaid: 0,
        finalPaymentAmount: 0,
        timeline: [],
      };
    }
  }

  const startDate = new Date(startDateStr);
  const timeline: DebtMonthlyPoint[] = [];

  const initialIndBalances: Record<string, number> = {};
  let totalBal = 0;
  for (const d of simDebts) {
    initialIndBalances[d.id] = d.balance;
    totalBal += d.balance;
  }
  timeline.push({
    monthIndex: 0,
    dateStr: startDateStr,
    totalBalance: Math.round(totalBal * 100) / 100,
    individualBalances: { ...initialIndBalances },
    totalInterestPaid: 0,
  });

  let totalInterest = 0;
  let months = 0;
  const maxMonths = 1200; // 100 years max
  let lastPaymentAmount = 0;

  while (months < maxMonths) {
    const remainingDebts = simDebts.filter((d) => d.balance > 0.001);
    if (remainingDebts.length === 0) break;

    months++;

    // 1. Accrue interest on opening monthly balance before payment
    for (const d of remainingDebts) {
      const monthlyRate = d.annualRate / 100 / 12;
      const accrued = Math.round(d.balance * monthlyRate * 100) / 100;
      d.balance += accrued;
      totalInterest += accrued;
    }

    // 2. Sort debts according to chosen strategy
    const sorted = [...remainingDebts].sort((a, b) => {
      if (strategy === 'snowball') {
        // smallest current balance first
        if (a.balance !== b.balance) return a.balance - b.balance;
        return b.annualRate - a.annualRate;
      } else if (strategy === 'avalanche') {
        // highest annual rate first
        if (a.annualRate !== b.annualRate) return b.annualRate - a.annualRate;
        return a.balance - b.balance;
      } else {
        // custom
        return (a.customOrderIndex ?? 0) - (b.customOrderIndex ?? 0);
      }
    });

    let availableBudget = totalMonthlyBudget;
    let actualPaidThisMonth = 0;

    // 3. First pay minimums on all debts
    for (const d of remainingDebts) {
      const needed = d.balance;
      const minToPay = Math.min(d.minPayment, needed);
      d.balance -= minToPay;
      availableBudget -= minToPay;
      actualPaidThisMonth += minToPay;
    }

    // 4. Direct all extra budget and freed payments to the target debt (first in sorted)
    for (const target of sorted) {
      if (availableBudget <= 0) break;
      if (target.balance > 0.001) {
        const canPay = Math.min(availableBudget, target.balance);
        target.balance -= canPay;
        availableBudget -= canPay;
        actualPaidThisMonth += canPay;
      }
    }

    lastPaymentAmount = actualPaidThisMonth;

    // Calculate current date string (month-end anchor / month step)
    const currentSimDate = new Date(startDate);
    currentSimDate.setMonth(startDate.getMonth() + months);
    const dateFormatted = currentSimDate.toISOString().split('T')[0];

    const currentBalances: Record<string, number> = {};
    let curTotal = 0;
    for (const d of simDebts) {
      const b = Math.max(0, Math.round(d.balance * 100) / 100);
      currentBalances[d.id] = b;
      curTotal += b;
    }

    timeline.push({
      monthIndex: months,
      dateStr: dateFormatted,
      totalBalance: Math.round(curTotal * 100) / 100,
      individualBalances: currentBalances,
      totalInterestPaid: Math.round(totalInterest * 100) / 100,
    });

    // Check if balance is growing unchecked
    if (curTotal > totalBal * 5 && months > 24) {
      return {
        isPayable: false,
        unpayableReason: 'No payoff within the model’s assumptions (debt balance is growing due to insufficient payment).',
        totalMonths: 0,
        payoffDate: '',
        totalInterestPaid: 0,
        finalPaymentAmount: 0,
        timeline: [],
      };
    }
  }

  if (months >= maxMonths) {
    return {
      isPayable: false,
      unpayableReason: 'No payoff within the model’s 1,200 month limit.',
      totalMonths: 0,
      payoffDate: '',
      totalInterestPaid: 0,
      finalPaymentAmount: 0,
      timeline: [],
    };
  }

  const payoffDate = new Date(startDate);
  payoffDate.setMonth(startDate.getMonth() + months);

  return {
    isPayable: true,
    totalMonths: months,
    payoffDate: payoffDate.toISOString().split('T')[0],
    totalInterestPaid: Math.round(totalInterest * 100) / 100,
    finalPaymentAmount: Math.round(lastPaymentAmount * 100) / 100,
    timeline,
  };
}

/**
 * Section 6: Habit Streaks
 */
export function calculateHabitStreak(
  habit: HabitItem,
  todayStr: string // YYYY-MM-DD
): {
  currentStreak: number;
  bestStreak: number;
  isDaily: boolean;
  isMetThisWeek?: boolean;
} {
  const checkSet = new Set(habit.checkedDates);

  if (habit.frequencyType === 'daily') {
    // Daily habit streak
    let best = 0;
    let temp = 0;

    // Sort dates
    const sortedDates = [...habit.checkedDates].sort();
    if (sortedDates.length > 0) {
      let prevDate: Date | null = null;
      for (const dStr of sortedDates) {
        const curDate = new Date(dStr);
        if (prevDate) {
          const diffDays = Math.round(
            (curDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diffDays === 1) {
            temp++;
          } else if (diffDays > 1) {
            temp = 1;
          }
        } else {
          temp = 1;
        }
        if (temp > best) best = temp;
        prevDate = curDate;
      }
    }

    // Current streak:
    // Today's unfinished check-in breaks the streak only after the day ends.
    // If today is checked, count backwards from today.
    // If today is NOT checked, count backwards from yesterday.
    let current = 0;
    const today = new Date(todayStr);

    let checkDay = new Date(today);
    if (!checkSet.has(todayStr)) {
      // Not completed today yet; streak is based on yesterday
      checkDay.setDate(checkDay.getDate() - 1);
    }

    while (true) {
      const dStr = checkDay.toISOString().split('T')[0];
      if (checkSet.has(dStr)) {
        current++;
        checkDay.setDate(checkDay.getDate() - 1);
      } else {
        break;
      }
    }

    if (current > best) best = current;

    return {
      currentStreak: current,
      bestStreak: best,
      isDaily: true,
    };
  } else {
    // Weekly frequency habit (e.g. 3 days/week)
    // Counts week streaks: a week succeeds when distinct check-in days reach weeklyTargetDays.
    // An unfinished current week neither breaks nor extends streak; reaching target adds that week once.
    const target = habit.weeklyTargetDays || 3;

    // Group check-in dates by week key (Monday-based)
    const weekMap: Record<string, Set<string>> = {};
    for (const dStr of habit.checkedDates) {
      const d = new Date(dStr);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const mon = new Date(d.setDate(diff));
      const key = mon.toISOString().split('T')[0];
      if (!weekMap[key]) weekMap[key] = new Set();
      weekMap[key].add(dStr);
    }

    // Check current week
    const now = new Date(todayStr);
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const currentMon = new Date(now.setDate(diff));
    const currentWeekKey = currentMon.toISOString().split('T')[0];

    const currentWeekCount = weekMap[currentWeekKey]?.size || 0;
    const isMetThisWeek = currentWeekCount >= target;

    // Count consecutive met weeks backwards
    let streak = 0;
    let bestStreak = 0;

    let probeWeek = new Date(currentMon);
    if (isMetThisWeek) {
      streak = 1;
      probeWeek.setDate(probeWeek.getDate() - 7);
    } else {
      // Unfinished current week: does not break streak from previous week
      probeWeek.setDate(probeWeek.getDate() - 7);
    }

    while (true) {
      const key = probeWeek.toISOString().split('T')[0];
      const count = weekMap[key]?.size || 0;
      if (count >= target) {
        streak++;
        probeWeek.setDate(probeWeek.getDate() - 7);
      } else {
        break;
      }
    }

    // Find best week streak across all history
    const allWeekKeys = Object.keys(weekMap).sort();
    let temp = 0;
    for (let i = 0; i < allWeekKeys.length; i++) {
      const count = weekMap[allWeekKeys[i]]?.size || 0;
      if (count >= target) {
        temp++;
        if (temp > bestStreak) bestStreak = temp;
      } else {
        temp = 0;
      }
    }
    if (streak > bestStreak) bestStreak = streak;

    return {
      currentStreak: streak,
      bestStreak,
      isDaily: false,
      isMetThisWeek,
    };
  }
}

/**
 * Section 6: Workout Volume
 * Strength volume = sum of (external weight * reps) across completed sets.
 */
export function calculateWorkoutVolume(session: WorkoutSession): number {
  let volume = 0;
  for (const ex of session.exercises) {
    for (const set of ex.sets) {
      if (set.isCompleted) {
        const weight = set.weightKg || (set.weightOriginal && set.weightUnit === 'kg' ? set.weightOriginal : 0);
        volume += weight * set.reps;
      }
    }
  }
  return Math.round(volume * 100) / 100;
}

/**
 * Section 6: Weight & BMI calculation
 * BMI = weight (kg) / (height (m) ^ 2)
 */
export function calculateBMI(weightKg: number, heightCm?: number): number | null {
  if (!heightCm || heightCm <= 0 || weightKg <= 0) return null;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
}

/**
 * Section 6: Unit Conversions (NIST Handbooks)
 */
export function convertKgToLb(kg: number): number {
  return Math.round((kg / 0.45359237) * 10) / 10;
}

export function convertLbToKg(lb: number): number {
  return Math.round(lb * 0.45359237 * 10) / 10;
}

export function convertCmToInches(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}

export function convertInchesToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}

export function convertMlToOz(ml: number): number {
  return Math.round((ml / 29.5735) * 10) / 10;
}

export function convertOzToMl(oz: number): number {
  return Math.round(oz * 29.5735);
}
