import React, { useState, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { getCurrencySymbol } from '../../utils/formatters';
import { RingProgress } from '../ui/RingProgress';
import { Modal } from '../ui/Modal';
import { FilterEmptyState } from '../ui/FilterEmptyState';
import {
  Wallet,
  Plus,
  Check,
  RotateCcw,
  AlertCircle,
  Calendar,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Settings2,
  Trash2,
  Edit2,
  Sliders,
  DollarSign,
  PiggyBank,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { BillItem, FinancialTransaction, BillOccurrence, BudgetPeriodType } from '../../types/planner';
import { getBudgetPeriodAllocations } from '../../utils/calculations';

const CATEGORY_COLORS: Record<string, { bg: string; dot: string; text: string }> = {
  Food: { bg: 'bg-teal-500', dot: 'bg-teal-500', text: 'text-teal-600' },
  Transport: { bg: 'bg-blue-500', dot: 'bg-blue-500', text: 'text-blue-600' },
  Home: { bg: 'bg-amber-500', dot: 'bg-amber-500', text: 'text-amber-600' },
  Personal: { bg: 'bg-purple-500', dot: 'bg-purple-500', text: 'text-purple-600' },
  Health: { bg: 'bg-rose-500', dot: 'bg-rose-500', text: 'text-rose-600' },
  Entertainment: { bg: 'bg-indigo-500', dot: 'bg-indigo-500', text: 'text-indigo-600' },
  Savings: { bg: 'bg-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-600' },
};

const FALLBACK_PALETTE = [
  { bg: 'bg-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  { bg: 'bg-cyan-500', dot: 'bg-cyan-500', text: 'text-cyan-600' },
  { bg: 'bg-pink-500', dot: 'bg-pink-500', text: 'text-pink-600' },
  { bg: 'bg-violet-500', dot: 'bg-violet-500', text: 'text-violet-600' },
];

function getCategoryColor(category: string, idx: number) {
  if (CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }
  return FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

export const BudgetBillsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    cashFlow,
    budgetPeriodRange,
    navigateBudgetPeriod,
    resetBudgetPeriodToCurrent,
    bills,
    markBillPaid,
    unpayBill,
    deleteBill,
    updateBill,
    addBill,
    transactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    currentDate,
  } = usePlanner();

  const currencySymbol = settings.currencySymbol || getCurrencySymbol(settings.currency) || '$';

  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'bills'>('overview');
  const [txPeriodFilter, setTxPeriodFilter] = useState<'active' | 'all'>('active');

  // Mark Paid Modal state for occurrences
  const [payingOccurrence, setPayingOccurrence] = useState<BillOccurrence | null>(null);
  const [actualPaidAmount, setActualPaidAmount] = useState<number>(0);
  const [paidDate, setPaidDate] = useState<string>(currentDate);

  // Unpay Confirm Modal for occurrences
  const [unpayingOccurrence, setUnpayingOccurrence] = useState<BillOccurrence | null>(null);

  // Add / Edit Transaction Modal state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinancialTransaction | null>(null);
  const [txType, setTxType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [txAmount, setTxAmount] = useState<number>(35);
  const [txCategory, setTxCategory] = useState('Food');
  const [txDate, setTxDate] = useState(currentDate);
  const [txNote, setTxNote] = useState('');

  // Add / Edit Bill Modal state
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<BillItem | null>(null);
  const [billTitle, setBillTitle] = useState('');
  const [billCategory, setBillCategory] = useState('Home');
  const [billPlannedAmt, setBillPlannedAmt] = useState<number>(50);
  const [billDueDate, setBillDueDate] = useState(currentDate);
  const [billRepeat, setBillRepeat] = useState<'monthly' | 'none'>('monthly');

  // Edit Budget Plan & Allocations Modal state
  const [isBudgetPlanModalOpen, setIsBudgetPlanModalOpen] = useState(false);
  const [planOpeningBalance, setPlanOpeningBalance] = useState<number>(100);
  const [planPlannedIncome, setPlanPlannedIncome] = useState<number>(1200);
  const [planPlannedSavings, setPlanPlannedSavings] = useState<number>(250);
  const [planPeriodType, setPlanPeriodType] = useState<BudgetPeriodType>('monthly');
  const [planCustomStartDate, setPlanCustomStartDate] = useState<string>('');
  const [planCustomEndDate, setPlanCustomEndDate] = useState<string>('');
  const [planCategoryLimits, setPlanCategoryLimits] = useState<Record<string, number>>({
    Food: 250,
    Transport: 100,
    Home: 200,
    Personal: 150,
  });
  const [newCatName, setNewCatName] = useState('');
  const [newCatLimit, setNewCatLimit] = useState<number>(100);

  // Dynamic category calculations derived from period allocations
  const categoryLimitsMap = useMemo(() => {
    const alloc = getBudgetPeriodAllocations(settings, budgetPeriodRange);
    return alloc.categoryLimits;
  }, [settings, budgetPeriodRange]);

  // Actual spent per category within the active budget period
  const categorySpentMap = useMemo(() => {
    return cashFlow.periodCategorySpent || {};
  }, [cashFlow.periodCategorySpent]);

  // Unified list of categories (union of configured limits and actual recorded spending)
  const categoryRows = useMemo(() => {
    const allCatNames = Array.from(
      new Set([...Object.keys(categoryLimitsMap), ...Object.keys(categorySpentMap)])
    );

    // Order: standard primary categories first, then alphabetically
    const priority = ['Food', 'Transport', 'Home', 'Personal'];
    allCatNames.sort((a, b) => {
      const ia = priority.indexOf(a);
      const ib = priority.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    return allCatNames.map((name) => {
      const limit = categoryLimitsMap[name] || 0;
      const spent = categorySpentMap[name] || 0;
      const remaining = Math.round((limit - spent) * 100) / 100;
      const isOver = remaining < 0;
      const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 100;
      return {
        name,
        limit,
        spent,
        remaining,
        isOver,
        pct,
      };
    });
  }, [categoryLimitsMap, categorySpentMap]);

  // Total limits and total spent derived from the unified ledger
  const totalLimits = useMemo(
    () => Object.values(categoryLimitsMap).reduce((s, v) => s + v, 0),
    [categoryLimitsMap]
  );
  const totalSpent = useMemo(
    () => Math.round(Object.values(categorySpentMap).reduce((s, v) => s + v, 0) * 100) / 100,
    [categorySpentMap]
  );
  const totalRemaining = Math.round((totalLimits - totalSpent) * 100) / 100;

  // Categories with positive spending for the chart breakdown
  const chartCategories = useMemo(() => {
    return categoryRows.filter((c) => c.spent > 0);
  }, [categoryRows]);

  const displayedTransactions = useMemo(() => {
    if (txPeriodFilter === 'all') return transactions;
    return transactions.filter(
      (t) => t.date >= budgetPeriodRange.startDate && t.date <= budgetPeriodRange.endDate
    );
  }, [transactions, txPeriodFilter, budgetPeriodRange]);

  const openMarkPaid = (occ: BillOccurrence) => {
    setPayingOccurrence(occ);
    setActualPaidAmount(occ.plannedAmount);
    setPaidDate(currentDate);
  };

  const confirmMarkPaid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingOccurrence) return;
    markBillPaid(payingOccurrence.billId, actualPaidAmount, paidDate, payingOccurrence.dueDate);
    setPayingOccurrence(null);
  };

  const confirmUnpay = () => {
    if (!unpayingOccurrence) return;
    unpayBill(unpayingOccurrence.billId, unpayingOccurrence.dueDate);
    setUnpayingOccurrence(null);
  };

  // Transaction handlers
  const openAddTransaction = () => {
    setEditingTx(null);
    setTxType('expense');
    setTxAmount(35);
    setTxCategory('Food');
    setTxDate(currentDate);
    setTxNote('');
    setIsTxModalOpen(true);
  };

  const openEditTransaction = (tx: FinancialTransaction) => {
    setEditingTx(tx);
    setTxType(tx.type);
    setTxAmount(tx.amount);
    setTxCategory(tx.category);
    setTxDate(tx.date);
    setTxNote(tx.note || '');
    setIsTxModalOpen(true);
  };

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (txAmount <= 0) return;

    if (editingTx) {
      updateTransaction(editingTx.id, {
        type: txType,
        amount: txAmount,
        category: txCategory,
        date: txDate,
        note: txNote || undefined,
      });
    } else {
      addTransaction({
        type: txType,
        amount: txAmount,
        category: txCategory,
        date: txDate,
        note: txNote || undefined,
      });
    }
    setIsTxModalOpen(false);
    setEditingTx(null);
    setTxNote('');
  };

  // Bill handlers
  const openAddBill = () => {
    setEditingBill(null);
    setBillTitle('');
    setBillCategory('Home');
    setBillPlannedAmt(50);
    setBillDueDate(currentDate);
    setBillRepeat('monthly');
    setIsBillModalOpen(true);
  };

  const openEditBill = (b: BillItem) => {
    setEditingBill(b);
    setBillTitle(b.title);
    setBillCategory(b.category);
    setBillPlannedAmt(b.plannedAmount);
    setBillDueDate(b.dueDate);
    setBillRepeat(b.repeatInterval === 'monthly' ? 'monthly' : 'none');
    setIsBillModalOpen(true);
  };

  const handleSaveBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billTitle.trim() || billPlannedAmt <= 0) return;

    if (editingBill) {
      updateBill(editingBill.id, {
        title: billTitle.trim(),
        category: billCategory,
        plannedAmount: billPlannedAmt,
        dueDate: billDueDate,
        repeatInterval: billRepeat,
      });
    } else {
      addBill({
        title: billTitle.trim(),
        category: billCategory,
        plannedAmount: billPlannedAmt,
        dueDate: billDueDate,
        repeatInterval: billRepeat,
      });
    }
    setIsBillModalOpen(false);
    setEditingBill(null);
    setBillTitle('');
  };

  // Budget plan editing handlers
  const openBudgetPlanModal = () => {
    const curType = settings.budgetPeriodType ?? 'monthly';
    setPlanOpeningBalance(settings.budgetOpeningBalance ?? 100);
    setPlanPeriodType(curType);
    setPlanCustomStartDate(settings.budgetStartDate ?? '');
    setPlanCustomEndDate(settings.budgetEndDate ?? '');

    const alloc = getBudgetPeriodAllocations(settings, budgetPeriodRange);
    setPlanPlannedIncome(alloc.plannedIncome);
    setPlanPlannedSavings(alloc.plannedSavings);
    setPlanCategoryLimits({ ...alloc.categoryLimits });

    setNewCatName('');
    setNewCatLimit(100);
    setIsBudgetPlanModalOpen(true);
  };

  const handlePeriodTypeChange = (newType: BudgetPeriodType) => {
    setPlanPeriodType(newType);
    if (settings.budgetPeriodAllocations && settings.budgetPeriodAllocations[newType]) {
      const a = settings.budgetPeriodAllocations[newType]!;
      setPlanPlannedIncome(a.plannedIncome ?? 1200);
      setPlanPlannedSavings(a.plannedSavings ?? 250);
      setPlanCategoryLimits(a.categoryLimits ?? { Food: 250, Transport: 100, Home: 200, Personal: 150 });
    } else {
      const baseInc = settings.budgetPlannedIncome ?? 1200;
      const baseSav = settings.budgetPlannedSavings ?? 250;
      const baseLim = settings.budgetCategoryLimits ?? { Food: 250, Transport: 100, Home: 200, Personal: 150 };
      let ratio = 1.0;
      if (newType === 'weekly') ratio = 7 / 30.4167;
      else if (newType === 'paycheck') ratio = 14 / 30.4167;
      setPlanPlannedIncome(Math.round(baseInc * ratio));
      setPlanPlannedSavings(Math.round(baseSav * ratio));
      const scaled: Record<string, number> = {};
      for (const [k, v] of Object.entries(baseLim)) {
        scaled[k] = Math.round(v * ratio);
      }
      setPlanCategoryLimits(scaled);
    }
  };

  const handleSaveBudgetPlan = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedAllocations = {
      ...(settings.budgetPeriodAllocations || {}),
      [planPeriodType]: {
        plannedIncome: planPlannedIncome,
        plannedSavings: planPlannedSavings,
        categoryLimits: planCategoryLimits,
      },
    };
    updateSettings({
      budgetOpeningBalance: planOpeningBalance,
      budgetPlannedIncome: planPlannedIncome,
      budgetPlannedSavings: planPlannedSavings,
      budgetPeriodType: planPeriodType,
      budgetCategoryLimits: planCategoryLimits,
      budgetPeriodAllocations: updatedAllocations,
      budgetStartDate: planPeriodType === 'custom' ? planCustomStartDate : settings.budgetStartDate,
      budgetEndDate: planPeriodType === 'custom' ? planCustomEndDate : settings.budgetEndDate,
    });
    setIsBudgetPlanModalOpen(false);
  };

  const handleAddCategoryLimit = () => {
    if (!newCatName.trim()) return;
    setPlanCategoryLimits((prev) => ({
      ...prev,
      [newCatName.trim()]: newCatLimit,
    }));
    setNewCatName('');
    setNewCatLimit(100);
  };

  const handleDeleteCategoryLimit = (name: string) => {
    setPlanCategoryLimits((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h2 data-testid="budget-heading" className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Budget & Bills
            </h2>
            <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              {budgetPeriodRange.label} · {budgetPeriodRange.subLabel}
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold text-[#526782] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => navigateBudgetPeriod('prev')}
              className="p-1 rounded-lg hover:bg-white dark:hover:bg-[#152238] hover:text-[var(--accent)] transition-colors cursor-pointer"
              title="Previous budget period"
              aria-label="Previous budget period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetBudgetPeriodToCurrent}
              className="px-2 py-0.5 rounded-lg hover:bg-white dark:hover:bg-[#152238] hover:text-[var(--accent)] transition-colors cursor-pointer text-[11px]"
              title="Return to current period"
            >
              Current
            </button>
            <button
              type="button"
              onClick={() => navigateBudgetPeriod('next')}
              className="p-1 rounded-lg hover:bg-white dark:hover:bg-[#152238] hover:text-[var(--accent)] transition-colors cursor-pointer"
              title="Next budget period"
              aria-label="Next budget period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-[#526782]">
            {(['overview', 'transactions', 'bills'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-colors cursor-pointer ${
                  activeTab === t
                    ? 'bg-white dark:bg-[#152238] text-[var(--accent)] shadow-xs'
                    : ''
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openBudgetPlanModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
            title="Edit opening balance, planned income, savings and category limits"
            aria-label="Edit budget plan: configure opening balance, planned income, savings and category limits"
          >
            <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Edit budget plan</span>
          </button>

          <button
            onClick={openAddTransaction}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add transaction</span>
          </button>
        </div>
      </div>

      {/* First-Use Empty State Hero CTA */}
      {transactions.length === 0 && bills.length === 0 && (
        <div
          data-testid="budget-empty-hero"
          className="bg-white dark:bg-[#152238] rounded-2xl p-6 border-2 border-dashed border-[var(--accent)]/35 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              No budget transactions or recurring bills yet
            </h2>
            <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              Record your first spending transaction or configure your monthly budget plan to start tracking cash flow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="budget-empty-cta"
              onClick={openAddTransaction}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add your first transaction</span>
            </button>
            <button
              type="button"
              onClick={openBudgetPlanModal}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] text-xs font-semibold transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Set up budget plan</span>
            </button>
          </div>
        </div>
      )}

      {/* Top 4 Key Metric Cards (Board 10) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Left to spend */}
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="text-xs text-[#526782] dark:text-[#A8B8CE] font-medium">
            Left to spend ({budgetPeriodRange.label})
          </div>
          <div className="text-3xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
            {currencySymbol}{cashFlow.leftToSpend.toFixed(0)}
          </div>
          <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE] mt-1.5 leading-snug">
            {transactions.length === 0 && bills.length === 0 && (settings.budgetPlannedIncome ?? 0) === 0 ? (
              <span className="text-slate-400 dark:text-slate-500">Unconfigured budget · Add income or plan limits</span>
            ) : (
              `${currencySymbol}${cashFlow.actualBalance.toFixed(0)} balance − ${currencySymbol}${cashFlow.unpaidBills.toFixed(0)} bills − ${currencySymbol}${cashFlow.plannedSavingsDue.toFixed(0)} savings`
            )}
          </div>
        </div>

        {/* Actual balance */}
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="text-xs text-[#526782] dark:text-[#A8B8CE] font-medium">
            Actual balance
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--accent)] mt-1">
            {currencySymbol}{cashFlow.actualBalance.toFixed(0)}
          </div>
          <div className="text-[11px] text-[#526782] mt-1.5">
            {transactions.length === 0 && (settings.budgetOpeningBalance ?? 0) === 0 ? (
              <span className="text-slate-400 dark:text-slate-500">No transactions or opening balance logged</span>
            ) : (
              'Posted spending ledger'
            )}
          </div>
        </div>

        {/* Unpaid planned bills */}
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="text-xs text-[#526782] dark:text-[#A8B8CE] font-medium">
            Unpaid planned bills
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
            {currencySymbol}{cashFlow.unpaidBills.toFixed(0)}
          </div>
          <div className="text-[11px] text-[#526782] mt-1.5">
            {cashFlow.overdueOccurrences.length > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                Due this period + overdue
              </span>
            ) : (
              'Due this period'
            )}
          </div>
        </div>

        {/* Planned savings still due */}
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="text-xs text-[#526782] dark:text-[#A8B8CE] font-medium">
            Planned savings still due
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            {currencySymbol}{cashFlow.plannedSavingsDue.toFixed(0)}
          </div>
          <div className="text-[11px] text-[#526782] mt-1.5">
            Period target: {currencySymbol}{cashFlow.plannedSavingsTotal.toFixed(0)}
          </div>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Cash Flow Calculation Banner */}
          <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-[#526782] uppercase tracking-wider">
                {budgetPeriodRange.subLabel}: Cash flow summary
              </h3>
              <button
                onClick={openBudgetPlanModal}
                className="text-[11px] font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit plan parameters</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-xs">
              <button
                type="button"
                onClick={openBudgetPlanModal}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center"
                title="Click to edit opening balance"
                aria-label={`Opening balance: ${currencySymbol}${cashFlow.openingBalance.toFixed(0)}. Click to edit budget plan.`}
              >
                <span className="text-[#526782] dark:text-[#A8B8CE] block text-[10px] flex items-center justify-center gap-1">
                  <span>Opening balance</span>
                  <Edit2 className="w-2.5 h-2.5 opacity-60" />
                </span>
                <span className="text-base font-bold font-mono mt-0.5 block text-[#071A3A] dark:text-[#EDF4FF]">
                  {currencySymbol}{cashFlow.openingBalance.toFixed(0)}
                </span>
              </button>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                <span className="opacity-80 block text-[10px]">+ Actual income</span>
                <span className="text-base font-bold font-mono mt-0.5 block">
                  {currencySymbol}{cashFlow.actualIncome.toFixed(0)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300">
                <span className="opacity-80 block text-[10px]">− Actual expenses</span>
                <span className="text-base font-bold font-mono mt-0.5 block">
                  {currencySymbol}{cashFlow.actualExpenses.toFixed(0)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300">
                <span className="opacity-80 block text-[10px]">− Savings transfers</span>
                <span className="text-base font-bold font-mono mt-0.5 block">
                  {currencySymbol}{cashFlow.savingsTransfers.toFixed(0)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <span className="opacity-80 block text-[10px]">= Current balance</span>
                <span className="text-base font-bold font-mono mt-0.5 block">
                  {currencySymbol}{cashFlow.actualBalance.toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          {/* 2-Column Grid: Category Limits & Spending Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Category limits (7 cols) - Strictly dynamic from ledger */}
            <div className="lg:col-span-7 bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
                <div>
                  <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                    Category limits
                  </h3>
                  <span className="text-xs text-[#526782]">{budgetPeriodRange.subLabel} allocations</span>
                </div>

                <button
                  onClick={openBudgetPlanModal}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3 text-[var(--accent)]" />
                  <span>Edit limits</span>
                </button>
              </div>

              <div className="space-y-3.5">
                {categoryRows.map((cat, idx) => {
                  const color = getCategoryColor(cat.name, idx);

                  return (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#071A3A] dark:text-[#EDF4FF] flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                          <span>{cat.name}</span>
                        </span>
                        <div className="space-x-3 font-mono">
                          <span className="text-[#526782]">
                            Limit: {currencySymbol}{cat.limit}
                          </span>
                          <span className="text-[#526782]">
                            Spent: {currencySymbol}{cat.spent}
                          </span>
                          <span
                            className={`font-semibold ${
                              cat.isOver ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'
                            }`}
                          >
                            {cat.isOver
                              ? `-${currencySymbol}${Math.abs(cat.remaining)} over`
                              : `${currencySymbol}${cat.remaining} left`}
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            cat.isOver ? 'bg-rose-500' : color.bg
                          }`}
                          style={{ width: `${cat.pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Footer Totals calculated directly from ledger */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs font-bold font-mono">
                <span>Total (limits): {currencySymbol}{totalLimits.toFixed(0)}</span>
                <span>Spent: {currencySymbol}{totalSpent.toFixed(0)}</span>
                <span className={totalRemaining >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {totalRemaining >= 0
                    ? `${currencySymbol}${totalRemaining.toFixed(0)} remaining`
                    : `-${currencySymbol}${Math.abs(totalRemaining).toFixed(0)} over`}
                </span>
              </div>
            </div>

            {/* Spending by Category & Unallocated Budget (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Dynamic Spending by Category Card */}
              <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
                <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-3">
                  Spending by category
                </h3>

                <div className="flex items-center gap-6 my-4">
                  <RingProgress
                    progress={totalLimits > 0 ? Math.min(100, Math.round((totalSpent / totalLimits) * 100)) : 100}
                    size={84}
                    strokeWidth={8}
                    color="var(--accent)"
                  >
                    <div className="text-center font-mono">
                      <span className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] block leading-none">
                        {currencySymbol}{totalSpent.toFixed(0)}
                      </span>
                      <span className="text-[9px] text-[#526782] block leading-none mt-0.5">
                        total
                      </span>
                    </div>
                  </RingProgress>

                  <div className="space-y-1.5 flex-1 text-xs max-h-36 overflow-y-auto">
                    {chartCategories.length === 0 ? (
                      <span className="text-xs text-[#526782]">No expenses recorded yet.</span>
                    ) : (
                      chartCategories.map((cat, idx) => {
                        const color = getCategoryColor(cat.name, idx);
                        const pctOfTotal = totalSpent > 0 ? Math.round((cat.spent / totalSpent) * 100) : 0;

                        return (
                          <div key={cat.name} className="flex justify-between items-center">
                            <span className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                              <span>{cat.name}</span>
                            </span>
                            <span className="font-mono font-semibold">
                              {currencySymbol}{cat.spent.toFixed(0)} ({pctOfTotal}%)
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Accessible tabular alternative to category spending chart */}
                <table data-testid="budget-accessible-chart-table" className="sr-only">
                  <caption>Spending and budget allocations by category</caption>
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      <th scope="col">Budget Limit</th>
                      <th scope="col">Amount Spent</th>
                      <th scope="col">Remaining</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryRows.map((cat) => (
                      <tr key={cat.name}>
                        <td>{cat.name}</td>
                        <td>{currencySymbol}{cat.limit}</td>
                        <td>{currencySymbol}{cat.spent}</td>
                        <td>{currencySymbol}{cat.remaining}</td>
                        <td>{cat.isOver ? 'Over budget' : 'Within budget'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Unallocated Budget Card (fully dynamic) */}
              <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-[#526782] font-semibold">
                    Unallocated budget
                  </div>
                  <button
                    onClick={openBudgetPlanModal}
                    className="text-[10px] font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    Adjust plan
                  </button>
                </div>
                <div className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
                  {currencySymbol}{cashFlow.unallocatedBudget.toFixed(0)}
                </div>
                <div className="text-[11px] text-[#526782] mt-1 leading-relaxed">
                  From: {currencySymbol}{cashFlow.openingBalance.toFixed(0)} opening + {currencySymbol}{cashFlow.plannedIncome.toFixed(0)} planned income − {currencySymbol}{cashFlow.categoryLimitsTotal.toFixed(0)} category limits − {currencySymbol}{cashFlow.plannedSavingsTotal.toFixed(0)} planned savings
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A] gap-3">
            <div>
              <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                Transactions ledger
              </h3>
              <p className="text-xs text-[#526782]">
                Posted income, expenses, and savings transfers
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-[#526782]">
                <button
                  type="button"
                  onClick={() => setTxPeriodFilter('active')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    txPeriodFilter === 'active'
                      ? 'bg-white dark:bg-[#152238] text-[var(--accent)] shadow-xs font-semibold'
                      : ''
                  }`}
                >
                  This period ({displayedTransactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTxPeriodFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    txPeriodFilter === 'all'
                      ? 'bg-white dark:bg-[#152238] text-[var(--accent)] shadow-xs font-semibold'
                      : ''
                  }`}
                >
                  All time ({transactions.length})
                </button>
              </div>

              <button
                onClick={openAddTransaction}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add entry</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {displayedTransactions.length === 0 ? (
              transactions.length > 0 && txPeriodFilter === 'active' ? (
                <FilterEmptyState
                  title="No transactions for this budget period"
                  description="You have transactions recorded in other periods. Switch to 'All time' to view all transactions."
                  clearLabel="View all transactions"
                  onClearFilters={() => setTxPeriodFilter('all')}
                />
              ) : (
                <div className="py-8 text-center text-xs text-[#526782] dark:text-[#A8B8CE]">
                  No transactions recorded yet.
                </div>
              )
            ) : (
              displayedTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        tx.type === 'income'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : tx.type === 'transfer'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '⇄' : '−'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                          {tx.category}
                        </span>
                        {tx.linkedBillId && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-semibold">
                            Bill linked
                          </span>
                        )}
                        {tx.linkedPotId && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold">
                            Savings transfer
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#526782] font-mono">
                        {tx.date} {tx.note && `· ${tx.note}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`font-mono font-bold text-xs ${
                        tx.type === 'income'
                          ? 'text-emerald-600'
                          : tx.type === 'transfer'
                          ? 'text-blue-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {currencySymbol}{tx.amount.toFixed(2)}
                    </span>

                    <button
                      type="button"
                      onClick={() => openEditTransaction(tx)}
                      className="p-1 rounded-md text-slate-400 hover:text-[var(--accent)] cursor-pointer"
                      title="Edit transaction"
                      aria-label={`Edit transaction: ${tx.category} ${currencySymbol}${tx.amount.toFixed(2)}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteTransaction(tx.id)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Delete transaction"
                      aria-label={`Delete transaction: ${tx.category} ${currencySymbol}${tx.amount.toFixed(2)}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bills Tab */}
      {(activeTab === 'overview' || activeTab === 'bills') && (
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
            <div>
              <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                Bills for {budgetPeriodRange.label}
              </h3>
              <p className="text-xs text-[#526782]">
                Period commitments and overdue obligations ({budgetPeriodRange.subLabel})
              </p>
            </div>

            <button
              onClick={openAddBill}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add bill</span>
            </button>
          </div>

          {/* Overdue Bills Section */}
          {cashFlow.overdueOccurrences.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    {cashFlow.overdueOccurrences.length} Overdue Bill{cashFlow.overdueOccurrences.length > 1 ? 's' : ''} ({currencySymbol}{cashFlow.overdueOccurrences.reduce((s, o) => s + o.plannedAmount, 0).toFixed(0)})
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                  Carried Over
                </span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/80">
                These bills were due before this period and remain unpaid. They are included in your unpaid bills total.
              </p>
              <div className="divide-y divide-amber-200/60 dark:divide-amber-800/40">
                {cashFlow.overdueOccurrences.map((occ) => (
                  <div key={occ.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                          {occ.title}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-200/60 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                          {occ.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-400 font-mono mt-0.5">
                        Due: {occ.dueDate} · Overdue
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        {currencySymbol}{occ.plannedAmount.toFixed(0)}
                      </span>
                      <button
                        type="button"
                        onClick={() => openMarkPaid(occ)}
                        className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
                      >
                        Pay overdue
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {cashFlow.periodOccurrences.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#526782]">
                No bills scheduled for this period ({budgetPeriodRange.label}).
              </div>
            ) : (
              cashFlow.periodOccurrences.map((occ) => {
                const parentBill = bills.find((b) => b.id === occ.billId);
                return (
                  <div
                    key={occ.id}
                    className="py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                          {occ.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-[#526782]">
                          {occ.category}
                        </span>
                        {occ.repeatInterval && occ.repeatInterval !== 'none' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                            {occ.repeatInterval}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#526782] mt-0.5 font-mono">
                        Due: {occ.dueDate}{' '}
                        {occ.isPaid && (
                          <span className="text-emerald-600 font-semibold ml-2">
                            · Paid {currencySymbol}{occ.actualPaidAmount} on {occ.paidDate}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]">
                        {currencySymbol}{occ.plannedAmount.toFixed(0)}
                      </span>

                      {occ.isPaid ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                            Paid
                          </span>
                          <button
                            type="button"
                            onClick={() => setUnpayingOccurrence(occ)}
                            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-[#526782] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            aria-label={`Unpay bill "${occ.title}"`}
                            title="Unpay bill (reverse expense)"
                          >
                            Unpay
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openMarkPaid(occ)}
                          className="px-3 py-1 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold cursor-pointer shadow-xs"
                          aria-label={`Mark bill "${occ.title}" as paid`}
                        >
                          Mark paid
                        </button>
                      )}

                      {parentBill && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditBill(parentBill)}
                            className="p-1 rounded-md text-slate-400 hover:text-[var(--accent)] cursor-pointer"
                            aria-label={`Edit bill "${occ.title}"`}
                            title="Edit bill"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteBill(parentBill.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 cursor-pointer"
                            aria-label={`Delete bill "${occ.title}"`}
                            title="Delete bill"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Edit Budget Plan & Category Allocations Modal */}
      <Modal
        isOpen={isBudgetPlanModalOpen}
        onClose={() => setIsBudgetPlanModalOpen(false)}
        title="Edit Budget Plan & Allocations"
        subtitle="Configure opening balance, planned income, savings and category limits"
      >
        <form onSubmit={handleSaveBudgetPlan} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="budget-plan-opening-balance"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Opening Balance ({currencySymbol})
              </label>
              <input
                id="budget-plan-opening-balance"
                type="number"
                step="0.01"
                required
                value={planOpeningBalance}
                onChange={(e) => setPlanOpeningBalance(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-semibold"
              />
            </div>

            <div>
              <label
                htmlFor="budget-plan-planned-income"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Planned Income ({currencySymbol})
              </label>
              <input
                id="budget-plan-planned-income"
                type="number"
                step="0.01"
                required
                value={planPlannedIncome}
                onChange={(e) => setPlanPlannedIncome(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-semibold"
              />
            </div>

            <div>
              <label
                htmlFor="budget-plan-planned-savings"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Planned Savings ({currencySymbol})
              </label>
              <input
                id="budget-plan-planned-savings"
                type="number"
                step="0.01"
                required
                value={planPlannedSavings}
                onChange={(e) => setPlanPlannedSavings(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-semibold"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="budget-plan-period-cadence"
              className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
            >
              Budget Period Cadence
            </label>
            <select
              id="budget-plan-period-cadence"
              value={planPeriodType}
              onChange={(e) => handlePeriodTypeChange(e.target.value as BudgetPeriodType)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="paycheck">Paycheck-to-paycheck</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {planPeriodType === 'custom' && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div>
                <label
                  htmlFor="budget-plan-start-date"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                >
                  Start Date
                </label>
                <input
                  id="budget-plan-start-date"
                  type="date"
                  required
                  value={planCustomStartDate}
                  onChange={(e) => setPlanCustomStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono bg-white dark:bg-[#152238]"
                />
              </div>
              <div>
                <label
                  htmlFor="budget-plan-end-date"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                >
                  End Date
                </label>
                <input
                  id="budget-plan-end-date"
                  type="date"
                  required
                  value={planCustomEndDate}
                  onChange={(e) => setPlanCustomEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono bg-white dark:bg-[#152238]"
                />
              </div>
            </div>
          )}

          {/* Category Limits / Allocations Editor */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                Category Budget Allocations (Limits)
              </span>
              <span className="text-[11px] font-mono font-semibold text-[var(--accent)]">
                Total: {currencySymbol}{Object.values(planCategoryLimits).reduce((a, b) => a + b, 0)}
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {Object.entries(planCategoryLimits).map(([cat, limit]) => (
                <div
                  key={cat}
                  className="flex items-center justify-between gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60"
                >
                  <span className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] flex-1">
                    {cat}
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#526782] font-mono">{currencySymbol}</span>
                    <input
                      type="number"
                      aria-label={`Budget limit for ${cat}`}
                      step="1"
                      min="0"
                      value={limit}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setPlanCategoryLimits((prev) => ({
                          ...prev,
                          [cat]: val,
                        }));
                      }}
                      className="w-24 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold text-right"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteCategoryLimit(cat)}
                      className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 cursor-pointer"
                      title="Remove category allocation"
                      aria-label={`Remove category allocation for ${cat}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add new category allocation inline */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                aria-label="New category name"
                placeholder="New category (e.g. Health)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
              />
              <input
                type="number"
                aria-label="New category limit"
                min="0"
                value={newCatLimit}
                onChange={(e) => setNewCatLimit(parseFloat(e.target.value) || 0)}
                className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleAddCategoryLimit}
                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-xs font-semibold cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          {/* Live Unallocated Calculation Preview */}
          <div className="p-3 rounded-xl bg-[var(--accent-subtle)] border border-[var(--border-color)] text-xs text-[var(--accent)] flex items-center justify-between">
            <span>Projected Unallocated Budget:</span>
            <span className="font-bold font-mono text-sm">
              {currencySymbol}
              {(
                planOpeningBalance +
                planPlannedIncome -
                Object.values(planCategoryLimits).reduce((a, b) => a + b, 0) -
                planPlannedSavings
              ).toFixed(0)}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsBudgetPlanModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover-bg)] text-[var(--btn-primary-fg)] text-xs font-semibold cursor-pointer"
            >
              Save budget plan
            </button>
          </div>
        </form>
      </Modal>

      {/* Mark Bill Paid Modal */}
      <Modal
        isOpen={!!payingOccurrence}
        onClose={() => setPayingOccurrence(null)}
        title="Mark bill as paid"
        subtitle="Mark a planned bill occurrence as paid. Creates one linked expense in your ledger."
      >
        {payingOccurrence && (
          <form onSubmit={confirmMarkPaid} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs">
              <span className="font-semibold text-[#071A3A] dark:text-[#EDF4FF] block">
                {payingOccurrence.title}
              </span>
              <span className="text-[#526782]">
                Category: {payingOccurrence.category} · Planned: {currencySymbol}{payingOccurrence.plannedAmount.toFixed(2)} · Due: {payingOccurrence.dueDate}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="mark-paid-actual-amount"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                >
                  Actual amount *
                </label>
                <input
                  id="mark-paid-actual-amount"
                  type="number"
                  step="0.01"
                  required
                  value={actualPaidAmount}
                  onChange={(e) => setActualPaidAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-semibold"
                />
              </div>

              <div>
                <label
                  htmlFor="mark-paid-payment-date"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                >
                  Payment date *
                </label>
                <input
                  id="mark-paid-payment-date"
                  type="date"
                  required
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--accent-subtle)] border border-[var(--border-color)] text-xs text-[var(--accent)] flex items-start gap-2">
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Creates a single linked expense under {payingOccurrence.category}. Your actual balance and {payingOccurrence.category} spending update together.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayingOccurrence(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover-bg)] text-[var(--btn-primary-fg)] text-xs font-semibold cursor-pointer"
              >
                Mark paid
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Unpay Confirmation Modal */}
      <Modal
        isOpen={!!unpayingOccurrence}
        onClose={() => setUnpayingOccurrence(null)}
        title="Unpay this bill?"
        subtitle="Reverse the linked expense transaction"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#526782] leading-relaxed">
            Reversing this paid bill ({unpayingOccurrence?.title} due {unpayingOccurrence?.dueDate}) will delete its linked expense from your transactions ledger and restore it as an unpaid obligation. Category spending and balances adjust automatically.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setUnpayingOccurrence(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
            >
              Cancel
            </button>
            <button
              onClick={confirmUnpay}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
            >
              Unpay bill
            </button>
          </div>
        </div>
      </Modal>

      {/* Add / Edit Transaction Modal */}
      <Modal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setEditingTx(null);
        }}
        title={editingTx ? 'Edit transaction' : 'Add transaction'}
        subtitle="Record or modify income, expenses, and savings transfers"
      >
        <form onSubmit={handleSaveTransaction} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(['expense', 'income', 'transfer'] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setTxType(t)}
                className={`py-2 rounded-xl text-xs font-semibold capitalize border cursor-pointer ${
                  txType === t
                    ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] border-[var(--btn-primary-bg)]'
                    : 'border-slate-200 dark:border-slate-700 text-[#526782]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="tx-modal-amount"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Amount ({currencySymbol}) *
              </label>
              <input
                id="tx-modal-amount"
                type="number"
                step="0.01"
                required
                value={txAmount}
                onChange={(e) => setTxAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-semibold"
              />
            </div>

            <div>
              <label
                htmlFor="tx-modal-category"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Category
              </label>
              <select
                id="tx-modal-category"
                value={txCategory}
                onChange={(e) => setTxCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
              >
                <option value="Food">Food</option>
                <option value="Transport">Transport</option>
                <option value="Home">Home</option>
                <option value="Personal">Personal</option>
                <option value="Salary">Salary</option>
                <option value="Savings">Savings</option>
                <option value="Health">Health</option>
                <option value="Entertainment">Entertainment</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="tx-modal-date"
              className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
            >
              Date
            </label>
            <input
              id="tx-modal-date"
              type="date"
              required
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
            />
          </div>

          <div>
            <label
              htmlFor="tx-modal-note"
              className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
            >
              Note (optional)
            </label>
            <input
              id="tx-modal-note"
              type="text"
              value={txNote}
              onChange={(e) => setTxNote(e.target.value)}
              placeholder="e.g. Weekly market groceries"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsTxModalOpen(false);
                setEditingTx(null);
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover-bg)] text-[var(--btn-primary-fg)] text-xs font-semibold cursor-pointer"
            >
              {editingTx ? 'Update transaction' : 'Save transaction'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Bill Modal */}
      <Modal
        isOpen={isBillModalOpen}
        onClose={() => {
          setIsBillModalOpen(false);
          setEditingBill(null);
        }}
        title={editingBill ? 'Edit planned bill' : 'Add planned bill'}
        subtitle="Schedule recurring or one-off commitments"
      >
        <form onSubmit={handleSaveBill} className="space-y-4">
          <div>
            <label
              htmlFor="bill-modal-title"
              className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
            >
              Bill title *
            </label>
            <input
              id="bill-modal-title"
              type="text"
              required
              value={billTitle}
              onChange={(e) => setBillTitle(e.target.value)}
              placeholder="e.g. Electricity, Water"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="bill-modal-planned-amount"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Planned amount ({currencySymbol}) *
              </label>
              <input
                id="bill-modal-planned-amount"
                type="number"
                step="0.01"
                required
                value={billPlannedAmt}
                onChange={(e) => setBillPlannedAmt(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-semibold"
              />
            </div>

            <div>
              <label
                htmlFor="bill-modal-category"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Category
              </label>
              <select
                id="bill-modal-category"
                value={billCategory}
                onChange={(e) => setBillCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
              >
                <option value="Home">Home</option>
                <option value="Personal">Personal</option>
                <option value="Transport">Transport</option>
                <option value="Food">Food</option>
                <option value="Health">Health</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="bill-modal-due-date"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Due date
              </label>
              <input
                id="bill-modal-due-date"
                type="date"
                required
                value={billDueDate}
                onChange={(e) => setBillDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
            </div>

            <div>
              <label
                htmlFor="bill-modal-repeat"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Repeat interval
              </label>
              <select
                id="bill-modal-repeat"
                value={billRepeat}
                onChange={(e) => setBillRepeat(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
              >
                <option value="monthly">Monthly</option>
                <option value="none">One-off</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsBillModalOpen(false);
                setEditingBill(null);
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover-bg)] text-[var(--btn-primary-fg)] text-xs font-semibold cursor-pointer"
            >
              {editingBill ? 'Update bill' : 'Save bill'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
