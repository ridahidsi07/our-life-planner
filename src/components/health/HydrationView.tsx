import React, { useState, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { RingProgress } from '../ui/RingProgress';
import { Modal } from '../ui/Modal';
import { getCurrentTimeStr } from '../../utils/formatters';
import {
  Droplet,
  Plus,
  RotateCcw,
  Check,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  TrendingUp,
} from 'lucide-react';

export const HydrationView: React.FC = () => {
  const {
    currentDate,
    setCurrentDate,
    hydrationEntries,
    hydrationTargets,
    addWaterLog,
    undoLastWaterLog,
    deleteWaterLog,
    updateWaterTarget,
  } = usePlanner();

  const formattedDateStr = useMemo(() => {
    try {
      const parts = currentDate.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return currentDate;
    }
  }, [currentDate]);

  // Target input
  const currentTargetMl = useMemo(() => {
    const found = hydrationTargets.find((t) => t.date <= currentDate);
    return found ? found.targetMl : 2000;
  }, [hydrationTargets, currentDate]);

  const [targetInput, setTargetInput] = useState<number>(currentTargetMl);

  // Custom add drink modal
  const [isAddDrinkModalOpen, setIsAddDrinkModalOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState<number>(250);
  const [customTime, setCustomTime] = useState<string>(() => getCurrentTimeStr());

  // Today entries
  const todayEntries = useMemo(() => {
    return hydrationEntries
      .filter((e) => e.date === currentDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [hydrationEntries, currentDate]);

  // Running total calculation
  const entriesWithRunning = useMemo(() => {
    let running = 0;
    return todayEntries.map((e) => {
      running += e.amountMl;
      return {
        ...e,
        runningTotal: running,
      };
    });
  }, [todayEntries]);

  const totalIntakeToday = todayEntries.reduce((sum, e) => sum + e.amountMl, 0);
  const remainingToday = Math.max(0, currentTargetMl - totalIntakeToday);
  const progressPct =
    currentTargetMl > 0 ? Math.min(100, Math.round((totalIntakeToday / currentTargetMl) * 100)) : 0;
  const latestTime =
    todayEntries.length > 0 ? todayEntries[todayEntries.length - 1].time : null;

  // 7-day history entries (timezone-safe local date calculation)
  const past7Days = useMemo(() => {
    const [year, month, day] = currentDate.split('-').map(Number);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(year, month - 1, day - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const sum = hydrationEntries
        .filter((e) => e.date === iso)
        .reduce((s, e) => s + e.amountMl, 0);
      days.push({
        iso,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        intakeMl: sum,
        intakeL: Math.round((sum / 1000) * 100) / 100,
        isToday: iso === currentDate,
      });
    }
    return days;
  }, [currentDate, hydrationEntries]);

  const weeklyAverageL = useMemo(() => {
    const totalMl = past7Days.reduce((sum, d) => sum + d.intakeMl, 0);
    return Math.round((totalMl / 7 / 1000) * 100) / 100;
  }, [past7Days]);

  const handleSaveTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetInput > 0) {
      updateWaterTarget(targetInput);
    }
  };

  const handleCustomAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (customAmount > 0) {
      addWaterLog(customAmount, customTime);
      setIsAddDrinkModalOpen(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Water — Track Your Hydration
          </h2>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            {formattedDateStr} · Daily water targets and hydration log
          </p>
        </div>

        <button
          onClick={() => {
            setCustomTime(getCurrentTimeStr());
            setIsAddDrinkModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover-bg)] text-[var(--btn-primary-fg)] font-semibold text-xs transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add drink</span>
        </button>
      </div>

      {/* Week Strip Intake Row (Board 17) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs overflow-x-auto">
        <div className="min-w-[600px] flex items-center justify-between gap-2 text-center text-xs">
          <span className="font-bold text-slate-500 dark:text-slate-400 text-xs px-2 shrink-0">Last 7 days:</span>
          {past7Days.map((d) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => setCurrentDate(d.iso)}
              aria-label={`Select date ${d.dayName} ${d.dayNum}`}
              className={`flex-1 p-2.5 rounded-xl border transition-all cursor-pointer ${
                d.isToday
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]'
                  : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] uppercase">{d.dayName}</div>
              <div className="font-bold text-[#071A3A] dark:text-[#EDF4FF]">{d.dayNum}</div>
              <div className="font-mono text-xs font-semibold text-[var(--accent)] mt-1">
                {d.intakeL} L
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main 2-Column Area: Today's Progress (7 cols) & Edit Target (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Today's Progress Card (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
            <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Today's progress
            </h3>
            <span className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              {latestTime ? `Last drink ${latestTime}` : 'No drinks logged yet'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-8 py-2">
            <RingProgress
              progress={progressPct}
              size={110}
              strokeWidth={9}
              color="var(--accent)"
            >
              <div className="text-center font-mono">
                <span className="text-lg font-bold text-[#071A3A] dark:text-[#EDF4FF] block leading-none">
                  {(totalIntakeToday / 1000).toFixed(2)} L
                </span>
                <span className="text-xs text-[#526782] block leading-none mt-1">
                  of {(currentTargetMl / 1000).toFixed(0)} L
                </span>
              </div>
            </RingProgress>

            <div className="space-y-1 text-center sm:text-left">
              <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider">
                {progressPct}% completed
              </span>
              <div className="text-3xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]">
                {remainingToday} ml
              </div>
              <div className="text-xs text-[#526782]">
                remaining of your {currentTargetMl} ml target
              </div>
            </div>
          </div>

          {/* Quick Buttons Row */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => addWaterLog(250)}
              className="flex-1 py-2 rounded-xl bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]/80 text-[var(--accent)] text-xs font-bold cursor-pointer transition-colors"
            >
              +250 ml
            </button>
            <button
              type="button"
              onClick={() => addWaterLog(500)}
              className="flex-1 py-2 rounded-xl bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]/80 text-[var(--accent)] text-xs font-bold cursor-pointer transition-colors"
            >
              +500 ml
            </button>
            <button
              type="button"
              onClick={() => addWaterLog(750)}
              className="flex-1 py-2 rounded-xl bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]/80 text-[var(--accent)] text-xs font-bold cursor-pointer transition-colors"
            >
              +750 ml
            </button>
            <button
              onClick={undoLastWaterLog}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-[#526782] text-xs font-medium cursor-pointer"
            >
              Undo last drink
            </button>
          </div>
        </div>

        {/* Edit Daily Target (5 cols) (Board 17) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
          <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Edit daily target
          </h3>
          <p className="text-xs text-[#526782]">
            Applies to today and future days. Past history retains recorded targets.
          </p>

          <form onSubmit={handleSaveTarget} className="space-y-4">
            <div>
              <label
                htmlFor="hydration-daily-target-amount"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Amount (ml)
              </label>
              <input
                id="hydration-daily-target-amount"
                type="number"
                step="50"
                min="500"
                value={targetInput}
                onChange={(e) => setTargetInput(parseInt(e.target.value) || 2000)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-bold"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] text-xs font-semibold hover:bg-[var(--btn-primary-hover-bg)] cursor-pointer shadow-xs"
            >
              Save target
            </button>
          </form>

          {/* Over-target preview card (Board 17) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs flex items-center gap-3">
            <RingProgress progress={100} size={36} strokeWidth={4} color="var(--accent)">
              <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
            </RingProgress>
            <div>
              <span className="font-semibold text-[#071A3A] dark:text-[#EDF4FF] block">
                Target achievement
              </span>
              <span className="text-[11px] text-[#526782]">
                Ring stays capped at 100% when exceeding target; excess is reported separately.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Drinks Log Table & 7-Day History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Drinks Log (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Today's drinks
            </h3>
            <button
              type="button"
              onClick={() => {
                setCustomTime(getCurrentTimeStr());
                setIsAddDrinkModalOpen(true);
              }}
              className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
            >
              + Add drink
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-[#E2E8F0] dark:border-[#1E2D4A] text-[#526782]">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Total</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {entriesWithRunning.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#526782] dark:text-[#A8B8CE]">
                      No drinks logged yet for this day.
                    </td>
                  </tr>
                ) : (
                  entriesWithRunning.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3">{entry.time}</td>
                      <td className="py-2.5 px-3 font-bold text-[var(--accent)]">
                        {entry.amountMl} ml
                      </td>
                      <td className="py-2.5 px-3 text-[#526782] dark:text-[#A8B8CE]">
                        {entry.runningTotal} ml
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => deleteWaterLog(entry.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Delete log"
                          aria-label={`Delete water log for ${entry.time} (${entry.amountMl} ml)`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 7-Day History Chart & Streaks (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-5">
          <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            7-day history
          </h3>

          <div className="h-32 flex items-end justify-between border-b border-l border-slate-200 dark:border-slate-700 px-3">
            {past7Days.map((d) => {
              const hPct = Math.min(100, Math.max(10, (d.intakeMl / 2500) * 100));
              return (
                <div key={d.iso} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-mono text-[var(--accent)]">
                    {d.intakeL}
                  </span>
                  <div
                    className="w-4 rounded-t-xs bg-[var(--accent)] transition-all"
                    style={{ height: `${hPct}px` }}
                  />
                  <span className="text-[9px] text-[#526782]">{d.dayName}</span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs pt-2">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-[10px] text-[#526782] block">Current streak</span>
              <span className="text-base font-bold font-mono text-orange-600 mt-0.5 block">
                2 days
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-[10px] text-[#526782] block">Best streak</span>
              <span className="text-base font-bold font-mono text-emerald-600 mt-0.5 block">
                6 days
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">7-day average</span>
              <span className="text-base font-bold font-mono text-[var(--accent)] mt-0.5 block">
                {weeklyAverageL} L
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Drink Modal */}
      <Modal
        isOpen={isAddDrinkModalOpen}
        onClose={() => setIsAddDrinkModalOpen(false)}
        title="Add water intake"
        subtitle="Record water intake for today"
      >
        <form onSubmit={handleCustomAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="hydration-modal-amount"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Amount (ml) *
              </label>
              <input
                id="hydration-modal-amount"
                type="number"
                step="50"
                min="10"
                required
                value={customAmount}
                onChange={(e) => setCustomAmount(parseInt(e.target.value) || 250)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label
                htmlFor="hydration-modal-time"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Time
              </label>
              <input
                id="hydration-modal-time"
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddDrinkModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] text-xs font-semibold hover:bg-[var(--btn-primary-hover-bg)] cursor-pointer"
            >
              Add drink
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
