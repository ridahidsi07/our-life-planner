import React, { useState, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { RingProgress } from '../ui/RingProgress';
import { Modal } from '../ui/Modal';
import {
  PiggyBank,
  Plus,
  ArrowRight,
  TrendingUp,
  Calendar,
  Check,
  Edit2,
  Trash2,
  Wallet,
} from 'lucide-react';
import { SavingsPot } from '../../types/planner';

export const SavingsPotsView: React.FC = () => {
  const {
    savingsPots,
    addSavingsPot,
    updateSavingsPot,
    deleteSavingsPot,
    addSavingsDeposit,
    currentDate,
  } = usePlanner();

  const [selectedPotId, setSelectedPotId] = useState<string>(
    savingsPots.length > 0 ? savingsPots[0].id : ''
  );

  // Add Pot Modal
  const [isAddPotModalOpen, setIsAddPotModalOpen] = useState(false);
  const [potName, setPotName] = useState('');
  const [potTargetAmt, setPotTargetAmt] = useState<number>(1000);
  const [potTargetDate, setPotTargetDate] = useState('2027-03-31');
  const [potOpeningBal, setPotOpeningBal] = useState<number>(200);

  // Add Deposit Modal
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depAmount, setDepAmount] = useState<number>(50);
  const [depDate, setDepDate] = useState(currentDate);
  const [depSource, setDepSource] = useState<'spending_balance' | 'outside'>('spending_balance');

  const selectedPot =
    savingsPots.find((p) => p.id === selectedPotId) ||
    (savingsPots.length > 0 ? savingsPots[0] : null);

  // Combined calculations (Section 6 fixture: total saved / total target)
  const combinedMetrics = useMemo(() => {
    let totalSaved = 0;
    let totalTarget = 0;
    let completedCount = 0;

    savingsPots.forEach((p) => {
      const depositsSum = p.deposits.reduce((sum, d) => sum + d.amount, 0);
      const currentBal = p.openingBalance + depositsSum;
      totalSaved += currentBal;
      totalTarget += p.targetAmount;
      if (currentBal >= p.targetAmount) completedCount++;
    });

    const progressPct =
      totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
    const remaining = Math.max(0, totalTarget - totalSaved);

    return {
      totalSaved,
      totalTarget,
      progressPct,
      completedCount,
      remaining,
    };
  }, [savingsPots]);

  // Selected pot metrics
  const selectedPotMetrics = useMemo(() => {
    if (!selectedPot) return { totalDeposits: 0, currentBalance: 0, remaining: 0, progress: 0 };
    const totalDeposits = selectedPot.deposits.reduce((sum, d) => sum + d.amount, 0);
    const currentBalance = selectedPot.openingBalance + totalDeposits;
    const remaining = Math.max(0, selectedPot.targetAmount - currentBalance);
    const progress = Math.min(100, Math.round((currentBalance / selectedPot.targetAmount) * 100));
    return { totalDeposits, currentBalance, remaining, progress };
  }, [selectedPot]);

  const handleCreatePot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!potName.trim() || potTargetAmt <= 0) return;
    addSavingsPot({
      name: potName.trim(),
      targetAmount: potTargetAmt,
      targetDate: potTargetDate,
      openingBalance: potOpeningBal,
      openingDate: currentDate,
    });
    setIsAddPotModalOpen(false);
    setPotName('');
  };

  const handleSaveDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPot || depAmount <= 0) return;
    addSavingsDeposit(selectedPot.id, depAmount, depDate, depSource);
    setIsDepositModalOpen(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Savings
          </h2>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            Build the life you want, one step at a time.
          </p>
        </div>

        <button
          onClick={() => setIsAddPotModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New pot</span>
        </button>
      </div>

      {/* Top Metric Cards Row (Board 11) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total saved */}
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">Total saved</div>
          <div className="text-3xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
            ${combinedMetrics.totalSaved.toFixed(0)}
          </div>
          <div className="text-xs font-mono text-[#526782] mt-1">
            of ${combinedMetrics.totalTarget.toFixed(0)} target
          </div>
        </div>

        {/* Progress Ring */}
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs flex items-center gap-4">
          <RingProgress
            progress={combinedMetrics.progressPct}
            size={56}
            strokeWidth={5}
            color="#087F83"
          >
            <span className="text-sm font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]">
              {combinedMetrics.progressPct}%
            </span>
          </RingProgress>
          <div>
            <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Combined progress
            </div>
            <div className="text-xs text-[#526782]">
              All savings goals
            </div>
          </div>
        </div>

        {/* Pots Complete */}
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="text-xs text-[#526782]">Pots complete</div>
          <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
            {combinedMetrics.completedCount} of {savingsPots.length}
          </div>
          <div className="text-xs text-[#526782] mt-1">
            targets achieved
          </div>
        </div>

        {/* Total remaining */}
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="text-xs text-[#526782]">Total remaining</div>
          <div className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
            ${combinedMetrics.remaining.toFixed(0)}
          </div>
          <div className="text-xs text-[#526782] mt-1">
            to reach all targets
          </div>
        </div>
      </div>

      {/* Main 2-Column Area: Pots Cards (5 cols) & Selected Pot Detail (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pots list (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-bold text-[#526782] uppercase tracking-wider mb-2">
            Your savings pots
          </div>

          {savingsPots.map((pot) => {
            const depositsSum = pot.deposits.reduce((sum, d) => sum + d.amount, 0);
            const currentBal = pot.openingBalance + depositsSum;
            const pct = Math.min(100, Math.round((currentBal / pot.targetAmount) * 100));
            const isSelected = selectedPot?.id === pot.id;
            const isComplete = currentBal >= pot.targetAmount;

            return (
              <div
                key={pot.id}
                onClick={() => setSelectedPotId(pot.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer bg-white dark:bg-[#152238] shadow-2xs ${
                  isSelected
                    ? 'border-[#087F83] ring-1 ring-[#087F83]'
                    : 'border-[#E2E8F0] dark:border-[#1E2D4A] hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                      {pot.name}
                    </h3>
                    <div className="text-xs font-mono text-[#526782] mt-0.5">
                      ${currentBal.toFixed(0)} of ${pot.targetAmount.toFixed(0)}
                    </div>
                  </div>

                  <span className="text-xs font-bold font-mono text-[#087F83] dark:text-[#38D0C5]">
                    {pct}%
                  </span>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden my-3">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isComplete ? 'bg-emerald-500' : 'bg-[#087F83] dark:bg-[#38D0C5]'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#526782]">
                  <span>Target {pot.targetDate}</span>
                  {isComplete ? (
                    <span className="text-emerald-600 font-semibold">Complete</span>
                  ) : (
                    <span>${(pot.targetAmount - currentBal).toFixed(0)} remaining</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Pot Detail & Transaction History (7 cols) */}
        <div className="lg:col-span-7">
          {selectedPot ? (
            <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-6">
              {/* Pot Header & Actions */}
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
                <div>
                  <h3 className="text-lg font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                    {selectedPot.name}
                  </h3>
                  <p className="text-xs text-[#526782]">
                    Target date: {selectedPot.targetDate}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsDepositModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add deposit</span>
                  </button>
                  <button
                    onClick={() => deleteSavingsPot(selectedPot.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600"
                    title="Delete pot"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Pot Progress Summary (Board 11) */}
              <div className="flex items-center gap-6">
                <RingProgress
                  progress={selectedPotMetrics.progress}
                  size={72}
                  strokeWidth={7}
                  color="#087F83"
                >
                  <span className="text-xs font-bold font-mono">
                    {selectedPotMetrics.progress}%
                  </span>
                </RingProgress>

                <div>
                  <div className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]">
                    ${selectedPotMetrics.currentBalance.toFixed(0)}
                  </div>
                  <div className="text-xs text-[#526782]">
                    of ${selectedPot.targetAmount.toFixed(0)} · ${selectedPotMetrics.remaining.toFixed(0)} remaining
                  </div>
                </div>
              </div>

              {/* 3 Metric Stats */}
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[#526782] block text-[10px]">Opening balance</span>
                  <span className="text-sm font-bold font-mono mt-0.5 block">
                    ${selectedPot.openingBalance.toFixed(0)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[#526782] block text-[10px]">Total deposits</span>
                  <span className="text-sm font-bold font-mono mt-0.5 block">
                    ${selectedPotMetrics.totalDeposits.toFixed(0)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#087F83]/10 text-[#087F83] dark:text-[#38D0C5]">
                  <span className="opacity-80 block text-[10px]">Current balance</span>
                  <span className="text-sm font-bold font-mono mt-0.5 block">
                    ${selectedPotMetrics.currentBalance.toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Transaction History for this pot */}
              <div>
                <h4 className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] uppercase tracking-wider mb-3">
                  Transaction history
                </h4>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {/* Opening record */}
                  <div className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                        Opening balance
                      </div>
                      <div className="text-[10px] text-[#526782]">
                        {selectedPot.openingDate} · Initial amount for this pot
                      </div>
                    </div>
                    <span className="font-mono font-bold">
                      ${selectedPot.openingBalance.toFixed(0)}
                    </span>
                  </div>

                  {/* Deposits */}
                  {selectedPot.deposits.map((dep) => (
                    <div key={dep.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                          Deposit
                        </div>
                        <div className="text-[10px] text-[#526782]">
                          {dep.date} ·{' '}
                          {dep.source === 'spending_balance'
                            ? 'From Planner spending balance'
                            : 'From Money outside planner'}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-emerald-600">
                        +${dep.amount.toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#152238] rounded-2xl p-8 border border-[#E2E8F0] dark:border-[#1E2D4A] text-center text-xs text-[#526782]">
              Select a savings pot to view details and add deposits.
            </div>
          )}
        </div>
      </div>

      {/* Add Deposit Modal (Board 11) */}
      <Modal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        title="Add deposit"
        subtitle={`Add money to your ${selectedPot?.name}. Helps you reach your goal faster.`}
      >
        <form onSubmit={handleSaveDeposit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Amount *
              </label>
              <input
                type="number"
                step="1"
                min="1"
                required
                value={depAmount}
                onChange={(e) => setDepAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={depDate}
                onChange={(e) => setDepDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
              Source *
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="source"
                  className="mt-0.5"
                  checked={depSource === 'spending_balance'}
                  onChange={() => setDepSource('spending_balance')}
                />
                <div>
                  <span className="text-xs font-semibold block text-[#071A3A] dark:text-[#EDF4FF]">
                    Planner spending balance
                  </span>
                  <span className="text-[11px] text-[#526782]">
                    This reduces your spending balance by ${depAmount} (creates linked transfer).
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="source"
                  className="mt-0.5"
                  checked={depSource === 'outside'}
                  onChange={() => setDepSource('outside')}
                />
                <div>
                  <span className="text-xs font-semibold block text-[#071A3A] dark:text-[#EDF4FF]">
                    Money outside planner
                  </span>
                  <span className="text-[11px] text-[#526782]">
                    Add money from outside your planner (e.g. external bank account or cash).
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsDepositModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A]"
            >
              Save deposit
            </button>
          </div>
        </form>
      </Modal>

      {/* Add New Pot Modal */}
      <Modal
        isOpen={isAddPotModalOpen}
        onClose={() => setIsAddPotModalOpen(false)}
        title="Create savings pot"
        subtitle="Set a target and track your savings"
      >
        <form onSubmit={handleCreatePot} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Pot name *
            </label>
            <input
              type="text"
              required
              value={potName}
              onChange={(e) => setPotName(e.target.value)}
              placeholder="e.g. Emergency fund, Holiday"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Target amount *
              </label>
              <input
                type="number"
                min="1"
                required
                value={potTargetAmt}
                onChange={(e) => setPotTargetAmt(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Target date
              </label>
              <input
                type="date"
                required
                value={potTargetDate}
                onChange={(e) => setPotTargetDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Opening balance
            </label>
            <input
              type="number"
              min="0"
              value={potOpeningBal}
              onChange={(e) => setPotOpeningBal(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
            />
            <p className="text-[10px] text-[#526782] mt-0.5">
              Opening savings do not reduce your current spending balance.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddPotModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A]"
            >
              Create pot
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
