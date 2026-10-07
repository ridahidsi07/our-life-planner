import { calculateCashFlow } from '../src/utils/calculations';
import { SAMPLE_BILLS, SAMPLE_TRANSACTIONS } from '../src/utils/sampleData';
import { BillItem, FinancialTransaction } from '../src/types/planner';

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

console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
if (failed > 0) {
  process.exit(1);
}
