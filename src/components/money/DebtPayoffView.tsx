import React, { useState, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { getCurrencySymbol } from '../../utils/formatters';
import { RingProgress } from '../ui/RingProgress';
import { Modal } from '../ui/Modal';
import {
  TrendingDown,
  Plus,
  ArrowRight,
  Zap,
  Calendar,
  AlertCircle,
  Edit2,
  Trash2,
  DollarSign,
} from 'lucide-react';
import { DebtItem, DebtStrategy } from '../../types/planner';
import { simulateDebtPayoff } from '../../utils/calculations';

export const DebtPayoffView: React.FC = () => {
  const { settings, debts, addDebt, updateDebt, deleteDebt, currentDate } = usePlanner();

  const currencySymbol = settings.currencySymbol || getCurrencySymbol(settings.currency) || '$';

  const [strategy, setStrategy] = useState<DebtStrategy>('snowball');
  const [basePayment, setBasePayment] = useState<number>(100);
  const [extraPayment, setExtraPayment] = useState<number>(100);
  const [startDateStr, setStartDateStr] = useState<string>(currentDate);

  // Edit / Add Debt modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtItem | null>(null);
  const [debtName, setDebtName] = useState('');
  const [debtOrigBal, setDebtOrigBal] = useState<number>(1333.33);
  const [debtCurBal, setDebtCurBal] = useState<number>(1000.0);
  const [debtRate, setDebtRate] = useState<number>(12.0);
  const [debtMinPay, setDebtMinPay] = useState<number>(100.0);
  const [debtChosenPay, setDebtChosenPay] = useState<number>(100.0);
  const [validationError, setValidationError] = useState('');

  const openCreateModal = () => {
    setEditingDebt(null);
    setDebtName('');
    setDebtOrigBal(1000);
    setDebtCurBal(1000);
    setDebtRate(12);
    setDebtMinPay(100);
    setDebtChosenPay(100);
    setValidationError('');
    setIsModalOpen(true);
  };

  const openEditModal = (d: DebtItem) => {
    setEditingDebt(d);
    setDebtName(d.name);
    setDebtOrigBal(d.originalBalance);
    setDebtCurBal(d.currentBalance);
    setDebtRate(d.annualInterestRate);
    setDebtMinPay(d.minimumMonthlyPayment);
    setDebtChosenPay(d.chosenMonthlyPayment || d.minimumMonthlyPayment);
    setValidationError('');
    setIsModalOpen(true);
  };

  const handleSaveDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtName.trim() || debtCurBal <= 0) return;

    if (debtChosenPay < debtMinPay) {
      setValidationError(
        `Your ${currencySymbol}${debtChosenPay} monthly budget is below the ${currencySymbol}${debtMinPay} minimum.`
      );
      return;
    }

    if (editingDebt) {
      updateDebt(editingDebt.id, {
        name: debtName.trim(),
        originalBalance: debtOrigBal,
        currentBalance: debtCurBal,
        annualInterestRate: debtRate,
        minimumMonthlyPayment: debtMinPay,
        chosenMonthlyPayment: debtChosenPay,
      });
    } else {
      addDebt({
        name: debtName.trim(),
        originalBalance: debtOrigBal,
        currentBalance: debtCurBal,
        annualInterestRate: debtRate,
        minimumMonthlyPayment: debtMinPay,
        chosenMonthlyPayment: debtChosenPay,
      });
    }
    setIsModalOpen(false);
  };

  // Run Baseline and With-Extra simulations (Section 6 Fixture)
  const baselineSim = useMemo(() => {
    return simulateDebtPayoff(debts, strategy, startDateStr, basePayment, 0);
  }, [debts, strategy, startDateStr, basePayment]);

  const extraSim = useMemo(() => {
    return simulateDebtPayoff(debts, strategy, startDateStr, basePayment, extraPayment);
  }, [debts, strategy, startDateStr, basePayment, extraPayment]);

  const monthsSaved = Math.max(0, baselineSim.totalMonths - extraSim.totalMonths);
  const interestSaved = Math.max(
    0,
    Math.round((baselineSim.totalInterestPaid - extraSim.totalInterestPaid) * 100) / 100
  );

  // Overall repayment progress
  const overallMetrics = useMemo(() => {
    let origSum = 0;
    let curSum = 0;
    debts.forEach((d) => {
      origSum += d.originalBalance;
      curSum += d.currentBalance;
    });

    const repaid = Math.max(0, origSum - curSum);
    const pct = origSum > 0 ? Math.min(100, Math.round((repaid / origSum) * 100)) : 0;
    return { origSum, curSum, repaid, pct };
  }, [debts]);

  const primaryDebt = debts.length > 0 ? debts[0] : null;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Debt Payoff & Scenarios
          </h2>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            Simulate repayment strategies. Scenarios do not alter actual posted balances.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add debt</span>
        </button>
      </div>

      {/* Main 2-Column Area: Current Debts (7 cols) & Summary (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Debts Table / List (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-3">
              Current debts
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {debts.map((debt) => {
                const repaid = Math.max(0, debt.originalBalance - debt.currentBalance);
                const pct =
                  debt.originalBalance > 0
                    ? Math.round((repaid / debt.originalBalance) * 100)
                    : 0;

                return (
                  <div
                    key={debt.id}
                    className="py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-xl"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                          {debt.name}
                        </span>
                        <span className="text-xs font-mono font-semibold text-emerald-600">
                          {pct}% repaid
                        </span>
                      </div>
                      <div className="text-xs text-[#526782] font-mono mt-0.5">
                        Current: {currencySymbol}{debt.currentBalance.toFixed(2)} · Original: {currencySymbol}{debt.originalBalance.toFixed(2)} · Rate: {debt.annualInterestRate}%
                      </div>
                      <div className="text-[11px] text-[#526782] mt-0.5 font-mono">
                        Min payment: {currencySymbol}{debt.minimumMonthlyPayment}/mo · Chosen: {currencySymbol}{debt.chosenMonthlyPayment || debt.minimumMonthlyPayment}/mo
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(debt)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-[#526782]"
                        title="Edit debt"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteDebt(debt.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600"
                        title="Delete debt"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Debt Summary Card (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Debt summary
            </h3>

            <div className="flex items-center gap-5">
              <RingProgress
                progress={overallMetrics.pct}
                size={64}
                strokeWidth={6}
                color="#087F83"
              >
                <span className="text-xs font-bold font-mono">
                  {overallMetrics.pct}%
                </span>
              </RingProgress>

              <div>
                <div className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]">
                  {currencySymbol}{overallMetrics.curSum.toFixed(2)}
                </div>
                <div className="text-xs text-[#526782]">
                  current balance of {currencySymbol}{overallMetrics.origSum.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex justify-between">
                <span className="text-[#526782]">Original balance</span>
                <span className="font-mono font-semibold">{currencySymbol}{overallMetrics.origSum.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#526782]">Current balance</span>
                <span className="font-mono font-semibold">{currencySymbol}{overallMetrics.curSum.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#526782]">Amount repaid</span>
                <span className="font-mono font-bold text-emerald-600">
                  {currencySymbol}{overallMetrics.repaid.toFixed(2)} ({overallMetrics.pct}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payoff Forecast & Scenarios (Board 12) */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
          <div>
            <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Payoff forecast
            </h3>
            <p className="text-xs text-[#526782]">
              Compare payoff dates and interest under different monthly payments
            </p>
          </div>

          {/* Strategy Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-[#526782]">
            <button
              onClick={() => setStrategy('snowball')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                strategy === 'snowball'
                  ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                  : ''
              }`}
            >
              Snowball (smallest first)
            </button>
            <button
              onClick={() => setStrategy('avalanche')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                strategy === 'avalanche'
                  ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                  : ''
              }`}
            >
              Avalanche (highest rate)
            </button>
          </div>
        </div>

        {/* Inputs Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Start date
            </label>
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Base monthly payment
            </label>
            <input
              type="number"
              step="10"
              value={basePayment}
              onChange={(e) => setBasePayment(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Extra monthly payment
            </label>
            <input
              type="number"
              step="10"
              value={extraPayment}
              onChange={(e) => setExtraPayment(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-semibold"
            />
          </div>
        </div>

        {/* Comparison Cards & Savings Highlight (Board 12) */}
        {baselineSim.isPayable && extraSim.isPayable ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Baseline */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-[#526782] uppercase">
                Baseline ({currencySymbol}{basePayment} / mo)
              </span>
              <div className="text-xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
                {baselineSim.totalMonths} payments
              </div>
              <div className="text-xs text-[#526782] mt-1 space-y-0.5">
                <div>Payoff date: {baselineSim.payoffDate}</div>
                <div>Total interest: {currencySymbol}{baselineSim.totalInterestPaid.toFixed(2)}</div>
              </div>
            </div>

            {/* With Extra */}
            <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800">
              <span className="text-[11px] font-bold text-[#087F83] dark:text-[#38D0C5] uppercase">
                With extra ({currencySymbol}{basePayment + extraPayment} / mo)
              </span>
              <div className="text-xl font-bold font-mono text-[#087F83] dark:text-[#38D0C5] mt-1">
                {extraSim.totalMonths} payments
              </div>
              <div className="text-xs text-[#526782] dark:text-[#A8B8CE] mt-1 space-y-0.5">
                <div>Payoff date: {extraSim.payoffDate}</div>
                <div>Total interest: {currencySymbol}{extraSim.totalInterestPaid.toFixed(2)}</div>
              </div>
            </div>

            {/* You'll Save Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-teal-500 to-[#087F83] text-white flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-100 uppercase">
                <Zap className="w-4 h-4 text-amber-300" />
                <span>You'll save</span>
              </div>
              <div className="my-2">
                <div className="text-2xl font-bold">
                  {monthsSaved} months
                </div>
                <div className="text-xs opacity-90">sooner</div>
              </div>
              <div className="text-sm font-bold font-mono text-teal-100">
                {currencySymbol}{interestSaved.toFixed(2)} in interest
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>
              {baselineSim.unpayableReason || extraSim.unpayableReason || 'Cannot compute payoff scenario with current inputs.'}
            </span>
          </div>
        )}

        {/* Projected balance chart visual breakdown */}
        <div className="pt-2">
          <div className="flex justify-between items-center text-xs mb-3">
            <span className="font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
              Projected balance trajectory
            </span>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>{currencySymbol}{basePayment}/mo ({baselineSim.totalMonths} payments)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                <span>{currencySymbol}{basePayment + extraPayment}/mo ({extraSim.totalMonths} payments)</span>
              </span>
            </div>
          </div>

          <div className="h-32 flex items-end gap-2 border-b border-l border-slate-200 dark:border-slate-700 p-2">
            {extraSim.timeline.slice(0, 12).map((pt, idx) => {
              const maxBal = 1000;
              const hPct = Math.max(5, (pt.totalBalance / maxBal) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-[#087F83] rounded-t-xs transition-all"
                    style={{ height: `${hPct}%` }}
                    title={`${pt.dateStr}: ${currencySymbol}${pt.totalBalance}`}
                  />
                  <span className="text-[9px] text-[#526782]">{idx}m</span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-[#526782] italic mt-3">
            These are estimates based on constant interest rate and monthly compounding, with no fees or new borrowing.
          </p>
        </div>
      </div>

      {/* Edit / Add Debt Modal (Board 22, Part C) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDebt ? 'Edit debt' : 'Add debt'}
        subtitle="Update your debt details, interest rate and monthly payment"
      >
        <form onSubmit={handleSaveDebt} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Debt name *
            </label>
            <input
              type="text"
              required
              value={debtName}
              onChange={(e) => setDebtName(e.target.value)}
              placeholder="e.g. Personal loan, Credit card"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Original balance ({currencySymbol})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={debtOrigBal}
                onChange={(e) => setDebtOrigBal(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Current balance ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={debtCurBal}
                onChange={(e) => setDebtCurBal(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Annual interest rate (%) *
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={debtRate}
                onChange={(e) => setDebtRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Minimum monthly payment ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="1"
                min="1"
                required
                value={debtMinPay}
                onChange={(e) => setDebtMinPay(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Your monthly payment budget ({currencySymbol}) *
            </label>
            <input
              type="number"
              step="1"
              min="1"
              required
              value={debtChosenPay}
              onChange={(e) => setDebtChosenPay(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-bold"
            />
          </div>

          {validationError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A]"
            >
              Save debt
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
