import {
  calculateCashFlow,
  getBudgetPeriodRange,
  navigateBudgetPeriod,
  getBudgetPeriodAllocations,
  generateBillOccurrences,
  calculatePeriodCashFlow,
} from '../src/utils/calculations';
import { SAMPLE_BILLS, SAMPLE_TRANSACTIONS } from '../src/utils/sampleData';
import { BillItem, FinancialTransaction, UserSettings } from '../src/types/planner';

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

console.log('=== RUNNING BUDGET & CASH FLOW TESTS ===\n');

// Clone initial sample data
let transactions: FinancialTransaction[] = JSON.parse(JSON.stringify(SAMPLE_TRANSACTIONS));
let bills: BillItem[] = JSON.parse(JSON.stringify(SAMPLE_BILLS));
let openingBalance = 100.0;
let plannedIncome = 1200.0;
let totalPlannedSavings = 250.0;
let categoryLimits: Record<string, number> = {
  Food: 250,
  Transport: 100,
  Home: 200,
  Personal: 150,
};

function getCategorySpent(txs: FinancialTransaction[]): Record<string, number> {
  const map: Record<string, number> = {};
  txs.filter(t => t.type === 'expense').forEach(t => {
    map[t.category] = (map[t.category] || 0) + t.amount;
  });
  return map;
}

function computeCashFlow(txs: FinancialTransaction[], bls: BillItem[]) {
  const actualIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const actualExpenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const spendingToSavingsTransfers = txs.filter(t => t.type === 'transfer' && t.linkedPotId).reduce((s, t) => s + t.amount, 0);
  const unpaidBills = bls.filter(b => !b.isPaid).reduce((s, b) => s + b.plannedAmount, 0);
  const plannedSavingsStillDue = Math.max(0, totalPlannedSavings - spendingToSavingsTransfers);
  const categoryLimitsTotal = Object.values(categoryLimits).reduce((s, v) => s + v, 0);

  return calculateCashFlow({
    openingBalance,
    actualIncome,
    actualExpenses,
    spendingToSavingsTransfers,
    unpaidBills,
    plannedSavingsStillDue,
    plannedIncome,
    categoryLimitsTotal,
    totalPlannedSavings,
  });
}

// 1. Initial State Checks
let cf = computeCashFlow(transactions, bills);
let catSpent = getCategorySpent(transactions);

assert(cf.actualBalance === 500, 'Initial actual balance is $500');
assert(cf.unpaidBills === 100, 'Initial unpaid bills is $100');
assert(cf.actualExpenses === 400, 'Initial actual expenses is $400');
assert(cf.leftToSpend === 350, 'Initial left to spend is $350');
assert(catSpent['Home'] === 160, 'Initial Home category spending is $160');
assert(catSpent['Food'] === 120, 'Initial Food category spending is $120');
assert(catSpent['Transport'] === 120, 'Initial Transport category spending is $120');
assert(Object.values(catSpent).reduce((a, b) => a + b, 0) === 400, 'Initial category spending total matches actual expenses $400');

// 2. Mark $49 Internet bill paid
const internetBill = bills.find(b => b.title === 'Internet')!;
const linkedTxId = 'tx-paid-internet-test';
const paidTx: FinancialTransaction = {
  id: linkedTxId,
  type: 'expense',
  amount: 49.0,
  category: internetBill.category, // 'Home'
  date: '2026-10-06',
  note: 'Paid bill: Internet',
  linkedBillId: internetBill.id,
};
transactions = [paidTx, ...transactions];
bills = bills.map(b => b.id === internetBill.id ? { ...b, isPaid: true, actualPaidAmount: 49.0, paidDate: '2026-10-06', linkedExpenseId: linkedTxId } : b);

cf = computeCashFlow(transactions, bills);
catSpent = getCategorySpent(transactions);

assert(cf.actualBalance === 451, 'After payment: actual balance changes from $500 to $451');
assert(cf.unpaidBills === 51, 'After payment: unpaid bills changes from $100 to $51');
assert(cf.actualExpenses === 449, 'After payment: actual expenses changes from $400 to $449');
assert(cf.leftToSpend === 350, 'After payment: left to spend correctly stays $350');
assert(catSpent['Home'] === 209, 'After payment: Home category spending is $209 (160 + 49)');
assert(Object.values(catSpent).reduce((a, b) => a + b, 0) === 449, 'After payment: category total matches $449');

// 3. Unpay the bill
transactions = transactions.filter(t => t.id !== linkedTxId);
bills = bills.map(b => b.id === internetBill.id ? { ...b, isPaid: false, actualPaidAmount: undefined, paidDate: undefined, linkedExpenseId: undefined } : b);

cf = computeCashFlow(transactions, bills);
catSpent = getCategorySpent(transactions);

assert(cf.actualBalance === 500, 'After unpayment: actual balance restored to $500');
assert(cf.unpaidBills === 100, 'After unpayment: unpaid bills restored to $100');
assert(cf.actualExpenses === 400, 'After unpayment: actual expenses restored to $400');
assert(catSpent['Home'] === 160, 'After unpayment: Home category spending restored to $160');

// 4. Edit transaction
const groceryTx = transactions.find(t => t.id === 'tx-2')!; // $120 Food
transactions = transactions.map(t => t.id === groceryTx.id ? { ...t, amount: 150.0 } : t);
cf = computeCashFlow(transactions, bills);
catSpent = getCategorySpent(transactions);
assert(catSpent['Food'] === 150, 'After editing transaction: Food category spending updates to $150');
assert(cf.actualExpenses === 430, 'After editing transaction: actual expenses updates to $430');
assert(cf.actualBalance === 470, 'After editing transaction: actual balance updates to $470');

// 5. Savings transfer
const savingsTx: FinancialTransaction = {
  id: 'tx-transfer-test',
  type: 'transfer',
  amount: 50.0,
  category: 'Savings',
  date: '2026-10-06',
  note: 'Transfer into emergency pot',
  linkedPotId: 'pot-1',
};
transactions = [savingsTx, ...transactions];
cf = computeCashFlow(transactions, bills);
assert(cf.savingsTransfers === 250, 'After transfer: savings transfers is $250');
assert(cf.plannedSavingsDue === 0, 'After transfer: planned savings due drops to $0');
assert(cf.actualBalance === 420, 'After transfer: actual balance drops by $50 to $420');

// 6. Change opening balance and planned income/savings
openingBalance = 200.0;
plannedIncome = 1500.0;
totalPlannedSavings = 300.0;
cf = computeCashFlow(transactions, bills);
assert(cf.openingBalance === 200, 'Editable opening balance is reflected in cash flow');
assert(cf.plannedIncome === 1500, 'Editable planned income is reflected in cash flow');
assert(cf.unallocatedBudget === 200 + 1500 - 700 - 300, 'Unallocated budget updates dynamically from opening balance, planned income and savings');

// ============================================================================
// 7. Budget Period Range Calculations (Month boundaries, Leap years, Cadences)
// ============================================================================
console.log('\n--- 7. Budget Period Range Model Tests ---');

// 7.1 Monthly Range
const mRange = getBudgetPeriodRange({ referenceDate: '2026-10-05', periodType: 'monthly' });
assert(mRange.startDate === '2026-10-01', 'Monthly start date is 2026-10-01');
assert(mRange.endDate === '2026-10-31', 'Monthly end date is 2026-10-31');
assert(mRange.daysInPeriod === 31, 'October has 31 days');
assert(mRange.label === 'October 1 – 31, 2026', 'Monthly label is "October 1 – 31, 2026"');
assert(mRange.subLabel === 'Monthly budget plan', 'Monthly subLabel is "Monthly budget plan"');

// 7.2 Leap Year & Month Boundaries
const leapFeb = getBudgetPeriodRange({ referenceDate: '2024-02-15', periodType: 'monthly' });
assert(leapFeb.startDate === '2024-02-01', 'Leap Feb starts 2024-02-01');
assert(leapFeb.endDate === '2024-02-29', 'Leap Feb ends 2024-02-29 (29 days)');
assert(leapFeb.daysInPeriod === 29, 'Leap Feb days count is 29');

const nonLeapFeb = getBudgetPeriodRange({ referenceDate: '2025-02-10', periodType: 'monthly' });
assert(nonLeapFeb.endDate === '2025-02-28', 'Non-leap Feb ends 2025-02-28 (28 days)');

// 7.3 Weekly Range (Monday start vs Sunday start)
const wRangeMon = getBudgetPeriodRange({ referenceDate: '2026-10-05', periodType: 'weekly', weekStartsOn: 'Monday' });
assert(wRangeMon.startDate === '2026-10-05', 'Weekly (Mon) starting Oct 5 starts 2026-10-05');
assert(wRangeMon.endDate === '2026-10-11', 'Weekly (Mon) ends 2026-10-11');
assert(wRangeMon.daysInPeriod === 7, 'Weekly period has 7 days');

const wCrossMonth = getBudgetPeriodRange({ referenceDate: '2026-10-01', periodType: 'weekly', weekStartsOn: 'Monday' });
assert(wCrossMonth.startDate === '2026-09-28', 'Weekly (Mon) for Oct 1 crosses into Sep 28');
assert(wCrossMonth.endDate === '2026-10-04', 'Weekly (Mon) for Oct 1 ends Oct 4');

const wRangeSun = getBudgetPeriodRange({ referenceDate: '2026-10-05', periodType: 'weekly', weekStartsOn: 'Sunday' });
assert(wRangeSun.startDate === '2026-10-04', 'Weekly (Sun) starting Oct 5 starts Sunday 2026-10-04');
assert(wRangeSun.endDate === '2026-10-10', 'Weekly (Sun) ends Saturday 2026-10-10');

// 7.4 Paycheck Range (Semi-monthly 1-15 and 16-end)
const pay1 = getBudgetPeriodRange({ referenceDate: '2026-10-05', periodType: 'paycheck' });
assert(pay1.startDate === '2026-10-01' && pay1.endDate === '2026-10-15', 'Paycheck 1st half: Oct 1 – 15');
const pay2 = getBudgetPeriodRange({ referenceDate: '2026-10-20', periodType: 'paycheck' });
assert(pay2.startDate === '2026-10-16' && pay2.endDate === '2026-10-31', 'Paycheck 2nd half: Oct 16 – 31');

// 7.5 Custom Range
const custRange = getBudgetPeriodRange({
  referenceDate: '2026-10-05',
  periodType: 'custom',
  customStartDate: '2026-10-10',
  customEndDate: '2026-10-25',
});
assert(custRange.startDate === '2026-10-10', 'Custom period starts 2026-10-10');
assert(custRange.endDate === '2026-10-25', 'Custom period ends 2026-10-25');
assert(custRange.daysInPeriod === 16, 'Custom period spans 16 days inclusive');

// ============================================================================
// 8. Period Navigation Tests
// ============================================================================
console.log('\n--- 8. Period Navigation Tests ---');

const nextMonth = navigateBudgetPeriod(mRange, 'next');
assert(nextMonth.startDate === '2026-11-01' && nextMonth.endDate === '2026-11-30', 'Navigating next month reaches Nov 1 – 30');
const prevMonth = navigateBudgetPeriod(mRange, 'prev');
assert(prevMonth.startDate === '2026-09-01' && prevMonth.endDate === '2026-09-30', 'Navigating prev month reaches Sep 1 – 30');

const nextWeek = navigateBudgetPeriod(wRangeMon, 'next', 'Monday');
assert(nextWeek.startDate === '2026-10-12' && nextWeek.endDate === '2026-10-18', 'Navigating next week reaches Oct 12 – 18');
const prevWeek = navigateBudgetPeriod(wRangeMon, 'prev', 'Monday');
assert(prevWeek.startDate === '2026-09-28' && prevWeek.endDate === '2026-10-04', 'Navigating prev week reaches Sep 28 – Oct 4');

// ============================================================================
// 9. Period Spending Filter vs Cumulative Account Balance
// ============================================================================
console.log('\n--- 9. Period Spending Filter vs Cumulative Balance Tests ---');

const multiPeriodTxs: FinancialTransaction[] = [
  { id: 'tx-sep-1', type: 'expense', amount: 80.0, category: 'Food', date: '2026-09-25' },
  { id: 'tx-oct-inc', type: 'income', amount: 1000.0, category: 'Salary', date: '2026-10-01' },
  { id: 'tx-oct-exp1', type: 'expense', amount: 120.0, category: 'Food', date: '2026-10-02' },
  { id: 'tx-oct-exp2', type: 'expense', amount: 120.0, category: 'Transport', date: '2026-10-02' },
  { id: 'tx-oct-exp3', type: 'expense', amount: 95.0, category: 'Home', date: '2026-10-04' },
  { id: 'tx-oct-trans', type: 'transfer', amount: 200.0, category: 'Savings', date: '2026-10-03', linkedPotId: 'pot-1' },
  { id: 'tx-nov-1', type: 'expense', amount: 50.0, category: 'Personal', date: '2026-11-05' },
];

const testSettings: UserSettings = {
  ownerName: 'Test',
  email: 'test@example.com',
  edition: 'downloaded',
  weekStartsOn: 'Monday',
  timeZone: 'UTC',
  currency: 'USD',
  currencySymbol: '$',
  weightUnit: 'kg',
  heightUnit: 'cm',
  waterUnit: 'ml',
  theme: 'light',
  isSampleDataActive: false,
  hasCompletedSetup: true,
  budgetOpeningBalance: 100.0,
  budgetPlannedIncome: 1200.0,
  budgetPlannedSavings: 250.0,
  budgetCategoryLimits: { Food: 250, Transport: 100, Home: 200, Personal: 150 },
};

// 9.1 October Monthly View
const octCF = calculatePeriodCashFlow({
  settings: testSettings,
  transactions: multiPeriodTxs,
  bills: [],
  periodRange: mRange,
  referenceDate: '2026-10-05',
});

// Cumulative Balance = 100 + 1000 - (80 + 120 + 120 + 95 + 50) - 200 = 435
assert(octCF.actualBalance === 435, 'Cumulative actual balance is $435 across all posted transactions');
// October period expenses = 120 + 120 + 95 = 335 (excludes Sep $80 and Nov $50!)
assert(octCF.periodExpenses === 335, 'October period expenses is $335 (excludes Sep $80 and Nov $50)');
assert(octCF.actualExpenses === 335, 'CashFlow.actualExpenses alias matches period expenses $335');
assert(octCF.periodCategorySpent['Food'] === 120, 'October Food spending is $120 (excludes Sep $80)');

// 9.2 Weekly View: Week of Oct 5 – 11, 2026
const weeklyCF = calculatePeriodCashFlow({
  settings: { ...testSettings, budgetPeriodType: 'weekly' },
  transactions: multiPeriodTxs,
  bills: [],
  periodRange: wRangeMon, // Oct 5 – 11
  referenceDate: '2026-10-05',
});

assert(weeklyCF.actualBalance === 435, 'Weekly view preserves cumulative bank balance of $435');
assert(weeklyCF.periodExpenses === 0, 'Week Oct 5–11 has $0 expenses (Oct 1–4 expenses occurred in prior week)');
assert((weeklyCF.periodCategorySpent['Food'] || 0) === 0, 'Week Oct 5–11 Food spending is $0');

// ============================================================================
// 10. Period-Specific Allocations
// ============================================================================
console.log('\n--- 10. Period-Specific Allocations Tests ---');

// 10.1 Automatic scaling for weekly
const scaledAlloc = getBudgetPeriodAllocations(testSettings, wRangeMon);
assert(scaledAlloc.plannedIncome === Math.round(1200 * 7 / 30.4167), 'Weekly planned income automatically scaled from monthly base');
assert(scaledAlloc.plannedSavings === Math.round(250 * 7 / 30.4167), 'Weekly planned savings automatically scaled from monthly base');
assert(scaledAlloc.categoryLimits['Food'] === Math.round(250 * 7 / 30.4167), 'Weekly Food category limit automatically scaled (~$58)');

// 10.2 Explicit customized weekly allocation
const customWeeklySettings: UserSettings = {
  ...testSettings,
  budgetPeriodType: 'weekly',
  budgetPeriodAllocations: {
    weekly: {
      plannedIncome: 350,
      plannedSavings: 70,
      categoryLimits: { Food: 75, Transport: 30, Home: 50, Personal: 45 },
    },
  },
};

const explicitAlloc = getBudgetPeriodAllocations(customWeeklySettings, wRangeMon);
assert(explicitAlloc.plannedIncome === 350, 'Customized weekly planned income is $350');
assert(explicitAlloc.plannedSavings === 70, 'Customized weekly planned savings is $70');
assert(explicitAlloc.categoryLimits['Food'] === 75, 'Customized weekly Food category limit is $75');
assert(explicitAlloc.categoryLimitsTotal === 200, 'Customized weekly total category limits is $200');

// Monthly still retrieves base monthly numbers
const monthlyFromCustom = getBudgetPeriodAllocations(customWeeklySettings, mRange);
assert(monthlyFromCustom.plannedIncome === 1200, 'Base monthly planned income preserved when switching periods');
assert(monthlyFromCustom.categoryLimits['Food'] === 250, 'Base monthly Food category limit preserved');

// ============================================================================
// 11. Bill Recurrence & Occurrences Across Months
// ============================================================================
console.log('\n--- 11. Bill Recurrence Across Months Tests ---');

const recurringBill: BillItem = {
  id: 'b-rec-internet',
  title: 'High-speed Internet',
  category: 'Home',
  plannedAmount: 60.0,
  dueDate: '2026-10-08',
  repeatInterval: 'monthly',
  isPaid: false,
};

// In October
const octBillOccs = generateBillOccurrences({
  bills: [recurringBill],
  transactions: [],
  periodRange: mRange,
  referenceDate: '2026-10-05',
});
assert(octBillOccs.periodOccurrences.length === 1, 'October period has 1 occurrence of recurring bill');
assert(octBillOccs.periodOccurrences[0].dueDate === '2026-10-08', 'October occurrence due on 2026-10-08');
assert(!octBillOccs.periodOccurrences[0].isPaid, 'October occurrence is initially unpaid');

// Mark October occurrence paid via paidOccurrences
const paidInOctBill: BillItem = {
  ...recurringBill,
  paidOccurrences: {
    '2026-10-08': { actualPaidAmount: 60.0, paidDate: '2026-10-08', linkedExpenseId: 'tx-paid-oct' },
  },
};

// Check November period with October paid
const novBillOccs = generateBillOccurrences({
  bills: [paidInOctBill],
  transactions: [],
  periodRange: nextMonth, // November
  referenceDate: '2026-11-01',
});
assert(novBillOccs.periodOccurrences.length === 1, 'November period generates separate November occurrence');
assert(novBillOccs.periodOccurrences[0].dueDate === '2026-11-08', 'November occurrence due on 2026-11-08');
assert(!novBillOccs.periodOccurrences[0].isPaid, 'November occurrence is NOT paid despite October payment!');

// ============================================================================
// 12. Overdue Bills from Prior Periods
// ============================================================================
console.log('\n--- 12. Overdue Bills from Prior Periods Tests ---');

const sepBillUnpaid: BillItem = {
  id: 'b-overdue-sep',
  title: 'Water Utility (Sep)',
  category: 'Home',
  plannedAmount: 45.0,
  dueDate: '2026-09-20',
  repeatInterval: 'none',
  isPaid: false,
};

const octWithOverdue = generateBillOccurrences({
  bills: [sepBillUnpaid, recurringBill],
  transactions: [],
  periodRange: mRange, // October
  referenceDate: '2026-10-05',
});

assert(octWithOverdue.overdueOccurrences.length === 1, 'Detected 1 overdue bill from September');
assert(octWithOverdue.overdueOccurrences[0].title === 'Water Utility (Sep)', 'Overdue bill is Water Utility');
assert(octWithOverdue.unpaidOverdueTotal === 45, 'Unpaid overdue total is $45');
assert(octWithOverdue.totalUnpaidObligations === 45 + 60, 'Total unpaid obligations includes $45 overdue + $60 October bill ($105 total)');

const cashFlowWithOverdue = calculatePeriodCashFlow({
  settings: testSettings,
  transactions: [],
  bills: [sepBillUnpaid, recurringBill],
  periodRange: mRange,
  referenceDate: '2026-10-05',
});
assert(cashFlowWithOverdue.unpaidBills === 105, 'Period cash flow includes $105 total unpaid bills');
// Left to spend = opening(100) - unpaidBills(105) - plannedSavingsDue(250) = -255
assert(cashFlowWithOverdue.leftToSpend === -255, 'Left to spend properly factors in overdue bill obligation');

// ============================================================================
// 13. Payments Outside the Current Period
// ============================================================================
console.log('\n--- 13. Payments Outside the Current Period Tests ---');

// Early payment: bill due 2026-10-08 paid early on 2026-09-30
const earlyPaidBill: BillItem = {
  ...recurringBill,
  paidOccurrences: {
    '2026-10-08': { actualPaidAmount: 60.0, paidDate: '2026-09-30', linkedExpenseId: 'tx-early-paid' },
  },
};
const earlyPaidTx: FinancialTransaction = {
  id: 'tx-early-paid',
  type: 'expense',
  amount: 60.0,
  category: 'Home',
  date: '2026-09-30', // September!
  linkedBillId: earlyPaidBill.id,
};

const octEarlyPaidCF = calculatePeriodCashFlow({
  settings: testSettings,
  transactions: [earlyPaidTx],
  bills: [earlyPaidBill],
  periodRange: mRange, // October
  referenceDate: '2026-10-05',
});

assert(octEarlyPaidCF.periodExpenses === 0, 'Early payment on Sep 30 does not count as October expense');
assert(octEarlyPaidCF.unpaidBills === 0, 'Early paid October bill is not counted in October unpaid bills');
assert(octEarlyPaidCF.actualBalance === 40, 'Cumulative account balance reflects early payment: 100 - 60 = $40');

console.log(`\n=== ALL TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
if (failed > 0) {
  process.exit(1);
}
