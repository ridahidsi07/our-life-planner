import React, { useState, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { RingProgress } from '../ui/RingProgress';
import { Modal } from '../ui/Modal';
import {
  Flame,
  Plus,
  Check,
  Calendar,
  Sparkles,
  Award,
  Edit2,
  Trash2,
  TrendingUp,
  BarChart2,
} from 'lucide-react';
import { HabitItem } from '../../types/planner';
import { calculateHabitStreak } from '../../utils/calculations';
import { getWeekDaysForDate } from '../../utils/formatters';

export const HabitsView: React.FC = () => {
  const {
    habits,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleHabitCheck,
    currentDate,
    settings,
  } = usePlanner();

  const [activeTab, setActiveTab] = useState<'this_week' | 'month' | 'insights'>('this_week');
  const [selectedHabitId, setSelectedHabitId] = useState<string>(
    habits.length > 0 ? habits[0].id : ''
  );

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitItem | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalFreqType, setModalFreqType] = useState<'daily' | 'weekly'>('daily');
  const [modalWeeklyTarget, setModalWeeklyTarget] = useState(3);
  const [modalEffectiveDate, setModalEffectiveDate] = useState(currentDate);
  const [modalNote, setModalNote] = useState('');

  const openCreateModal = () => {
    setEditingHabit(null);
    setModalTitle('');
    setModalFreqType('daily');
    setModalWeeklyTarget(3);
    setModalEffectiveDate(currentDate);
    setModalNote('');
    setIsModalOpen(true);
  };

  const openEditModal = (h: HabitItem) => {
    setEditingHabit(h);
    setModalTitle(h.title);
    setModalFreqType(h.frequencyType);
    setModalWeeklyTarget(h.weeklyTargetDays || 3);
    setModalEffectiveDate(h.effectiveDate);
    setModalNote(h.personalNote || '');
    setIsModalOpen(true);
  };

  const handleSaveHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) return;

    if (editingHabit) {
      updateHabit(editingHabit.id, {
        title: modalTitle.trim(),
        frequencyType: modalFreqType,
        weeklyTargetDays: modalFreqType === 'weekly' ? modalWeeklyTarget : undefined,
        effectiveDate: modalEffectiveDate,
        personalNote: modalNote || undefined,
      });
    } else {
      addHabit({
        title: modalTitle.trim(),
        frequencyType: modalFreqType,
        weeklyTargetDays: modalFreqType === 'weekly' ? modalWeeklyTarget : undefined,
        effectiveDate: modalEffectiveDate,
        personalNote: modalNote || undefined,
      });
    }
    setIsModalOpen(false);
  };

  // Week days based on settings.weekStartsOn
  const weekDays = useMemo(() => {
    const list = getWeekDaysForDate(currentDate, settings.weekStartsOn);
    return list.map((d) => ({
      iso: d.dateStr,
      dayNum: d.dayNum,
      dayName: d.dayName,
      isToday: d.dateStr === currentDate,
    }));
  }, [currentDate, settings.weekStartsOn]);

  // Selected habit
  const selectedHabit =
    habits.find((h) => h.id === selectedHabitId) || (habits.length > 0 ? habits[0] : null);

  const selectedHabitStreak = selectedHabit
    ? calculateHabitStreak(selectedHabit, currentDate)
    : { currentStreak: 0, bestStreak: 0, isDaily: true };

  // Best overall streak and best current streak across all habits
  const overallBestHabit = useMemo(() => {
    let best = 0;
    let habitName = '';
    let isDaily = true;
    habits.forEach((h) => {
      const s = calculateHabitStreak(h, currentDate);
      if (s.bestStreak > best || (!habitName && habits.length > 0)) {
        best = s.bestStreak;
        habitName = h.title;
        isDaily = s.isDaily;
      }
    });
    return { best, habitName, isDaily };
  }, [habits, currentDate]);

  const overallCurrentHabit = useMemo(() => {
    let current = 0;
    let habitName = '';
    let isDaily = true;
    habits.forEach((h) => {
      const s = calculateHabitStreak(h, currentDate);
      if (s.currentStreak > current || (!habitName && habits.length > 0)) {
        current = s.currentStreak;
        habitName = h.title;
        isDaily = s.isDaily;
      }
    });
    return { current, habitName, isDaily };
  }, [habits, currentDate]);

  // Last 28 calendar dates ending at currentDate (oldest -> newest)
  const last28Dates = useMemo(() => {
    const [y, m, d] = currentDate.split('-').map(Number);
    const baseMs = Date.UTC(y || 2026, (m || 1) - 1, d || 1);
    return Array.from({ length: 28 }, (_, idx) => {
      const dt = new Date(baseMs - (27 - idx) * 86400000);
      const yr = dt.getUTCFullYear();
      const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const da = String(dt.getUTCDate()).padStart(2, '0');
      return `${yr}-${mo}-${da}`;
    });
  }, [currentDate]);

  // Weekly target card computation
  const weeklyTargetSummary = useMemo(() => {
    const weeklyHabits = habits.filter((h) => h.frequencyType === 'weekly');
    const targetHabit =
      selectedHabit?.frequencyType === 'weekly'
        ? selectedHabit
        : weeklyHabits[0] || null;
    if (!targetHabit) {
      return null;
    }
    const completedThisWeek = weekDays.filter((w) =>
      targetHabit.checkedDates.includes(w.iso)
    ).length;
    const targetDays = targetHabit.weeklyTargetDays || 3;
    return {
      completedThisWeek,
      targetDays,
      title: targetHabit.title,
    };
  }, [habits, selectedHabit, weekDays]);

  // 28-day insights metrics across all habits
  const insights28Days = useMemo(() => {
    const dateSet = new Set(last28Dates);
    let totalCheckIns = 0;
    habits.forEach((h) => {
      h.checkedDates.forEach((d) => {
        if (dateSet.has(d)) {
          totalCheckIns += 1;
        }
      });
    });
    const totalPossible = habits.length * 28;
    const coveragePct =
      totalPossible > 0 ? Math.round((totalCheckIns / totalPossible) * 100) : 0;
    return {
      totalCheckIns,
      totalPossible,
      coveragePct,
    };
  }, [habits, last28Dates]);

  const selectedHabitLast28Count = useMemo(() => {
    if (!selectedHabit) return 0;
    const checkedSet = new Set(selectedHabit.checkedDates);
    return last28Dates.filter((d) => checkedSet.has(d)).length;
  }, [selectedHabit, last28Dates]);

  const todayCompletedCount = habits.filter((h) =>
    h.checkedDates.includes(currentDate)
  ).length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Habits & Progress
          </h2>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            Build positive habits with simple and consistent tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-[#526782]">
            <button
              onClick={() => setActiveTab('this_week')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'this_week'
                  ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                  : ''
              }`}
            >
              This week
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'insights'
                  ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                  : ''
              }`}
            >
              Insights
            </button>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New habit</span>
          </button>
        </div>
      </div>

      {/* First-Use Empty State Hero CTA */}
      {habits.length === 0 && (
        <div
          data-testid="habits-empty-hero"
          className="bg-teal-50/70 dark:bg-teal-950/30 rounded-2xl p-6 border border-teal-200 dark:border-teal-800/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs"
        >
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Start your first daily habit
            </h3>
            <p className="text-xs sm:text-sm text-[#526782] dark:text-[#A8B8CE] max-w-xl">
              Pick one simple habit—like reading for 15 minutes, stretching, or drinking water—and check in as you go.
            </p>
          </div>
          <button
            type="button"
            data-testid="habits-empty-cta"
            onClick={openCreateModal}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create your first habit</span>
          </button>
        </div>
      )}

      {/* Top Metric Cards Row (Board 09) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Today's completion ring */}
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs flex items-center gap-4">
          <RingProgress
            progress={
              habits.length > 0
                ? Math.round((todayCompletedCount / habits.length) * 100)
                : 0
            }
            size={52}
            strokeWidth={5}
            color="#087F83"
          >
            <span className="text-xs font-bold font-mono">
              {todayCompletedCount}/{habits.length}
            </span>
          </RingProgress>
          <div>
            <div className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              {todayCompletedCount} of {habits.length}
            </div>
            <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              habits completed today
            </div>
          </div>
        </div>

        {/* Best streak */}
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="flex items-center gap-2 text-rose-500 mb-1">
            <Award className="w-4 h-4" />
            <span className="text-xs font-semibold text-[#526782]">Best streak</span>
          </div>
          <div className="text-xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]">
            {overallBestHabit.best}-{overallBestHabit.isDaily ? 'day' : 'week'}
          </div>
          <div className="text-[11px] text-[#526782] truncate">
            {overallBestHabit.habitName || 'No habits yet'}
          </div>
        </div>

        {/* Weekly target item */}
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-semibold text-[#526782]">Weekly target</span>
          </div>
          <div className="text-xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]">
            {weeklyTargetSummary
              ? `${weeklyTargetSummary.completedThisWeek} of ${weeklyTargetSummary.targetDays}`
              : 'No weekly habit'}
          </div>
          <div className="text-[11px] text-[#526782] truncate">
            {weeklyTargetSummary
              ? `${weeklyTargetSummary.title} (${weeklyTargetSummary.targetDays} days/week)`
              : habits.length > 0
              ? 'All active habits are daily'
              : 'No habits added yet'}
          </div>
        </div>

        {/* Current streaks summary */}
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-3.5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs text-[11px] space-y-1">
          <div className="font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
            Current streaks
          </div>
          {habits.length > 0 ? (
            habits.slice(0, 3).map((h) => {
              const s = calculateHabitStreak(h, currentDate);
              return (
                <div key={h.id} className="flex justify-between items-center text-[#526782]">
                  <span className="truncate pr-2">{h.title}</span>
                  <span className="font-mono font-semibold text-[#071A3A] dark:text-[#EDF4FF] shrink-0">
                    {s.currentStreak} {s.isDaily ? 'days' : 'weeks'}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-[#526782]">No habits tracked yet</div>
          )}
        </div>
      </div>

      {activeTab === 'this_week' && (
        <div className="space-y-6">
          {/* Weekly Grid (Board 09) */}
          <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs overflow-x-auto">
            <div className="min-w-[620px]">
              {/* Header row */}
              <div className="grid grid-cols-12 pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A] text-xs font-bold text-[#526782]">
                <div className="col-span-4">Habit</div>
                {weekDays.map((w) => (
                  <div key={w.iso} className="col-span-1 text-center">
                    <div>{w.dayName}</div>
                    <div className="text-[10px] opacity-70">{w.dayNum}</div>
                  </div>
                ))}
                <div className="col-span-1 text-right">This week</div>
              </div>

              {/* Habit Rows */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {habits.length === 0 && (
                  <div className="py-8 text-center text-xs text-[#526782]">
                    No habits created yet. Click &ldquo;New habit&rdquo; above to start tracking.
                  </div>
                )}
                {habits.map((habit) => {
                  const isSelected = selectedHabit?.id === habit.id;
                  const weekChecks = weekDays.filter((w) =>
                    habit.checkedDates.includes(w.iso)
                  ).length;
                  const targetDenominator =
                    habit.frequencyType === 'daily'
                      ? 7
                      : habit.weeklyTargetDays || 3;

                  return (
                    <div
                      key={habit.id}
                      onClick={() => setSelectedHabitId(habit.id)}
                      className={`grid grid-cols-12 items-center py-3.5 px-1 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-teal-50/40 dark:bg-teal-950/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="col-span-4 flex items-center gap-2.5">
                        <Flame
                          className={`w-4 h-4 shrink-0 ${
                            isSelected
                              ? 'text-[#087F83] dark:text-[#38D0C5]'
                              : 'text-slate-400'
                          }`}
                        />
                        <div className="truncate">
                          <div className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] truncate">
                            {habit.title}
                          </div>
                          <div className="text-[10px] text-[#526782]">
                            {habit.frequencyType === 'daily'
                              ? 'Daily'
                              : `${habit.weeklyTargetDays} days per week`}
                          </div>
                        </div>
                      </div>

                      {/* 7 Days check circles */}
                      {weekDays.map((w) => {
                        const isChecked = habit.checkedDates.includes(w.iso);
                        return (
                          <div key={w.iso} className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={isChecked}
                              aria-label={`${habit.title}, ${w.dayName} ${w.dayNum}: ${isChecked ? 'completed' : 'not completed'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleHabitCheck(habit.id, w.iso);
                              }}
                              className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer micro-checkbox ${
                                isChecked
                                  ? 'bg-[#087F83] text-white shadow-2xs'
                                  : 'border border-slate-300 dark:border-slate-600 hover:border-[#087F83]'
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3] motion-check-pop" />}
                            </button>
                          </div>
                        );
                      })}

                      <div className="col-span-1 text-right font-mono text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                        {weekChecks}/{targetDenominator}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selected Habit Detail Card (Board 09) */}
          {selectedHabit && (
            <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
                <div>
                  <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                    {selectedHabit.title}
                  </h3>
                  <p className="text-xs text-[#526782]">
                    {selectedHabit.frequencyType === 'daily'
                      ? 'Daily habit'
                      : `${selectedHabit.weeklyTargetDays} days/week target`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(selectedHabit)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 text-[#526782]"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteHabit(selectedHabit.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 cursor-pointer"
                    aria-label={`Delete habit "${selectedHabit.title}"`}
                    title="Delete habit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 3 Metric Pills */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-center">
                  <div className="text-[11px] text-[#526782]">Current streak</div>
                  <div className="text-xl font-bold font-mono text-[#087F83] dark:text-[#38D0C5] mt-1">
                    {selectedHabitStreak.currentStreak} {selectedHabitStreak.isDaily ? 'days' : 'weeks'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-center">
                  <div className="text-[11px] text-[#526782]">Best streak</div>
                  <div className="text-xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
                    {selectedHabitStreak.bestStreak} {selectedHabitStreak.isDaily ? 'days' : 'weeks'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-center">
                  <div className="text-[11px] text-[#526782]">Total check-ins</div>
                  <div className="text-xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
                    {selectedHabit.checkedDates.length} days
                  </div>
                </div>
              </div>

              {/* Last 28 Days Completion Bar Strip */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                    Last 28 days
                  </span>
                  <span className="text-[#526782] font-mono">
                    {selectedHabitLast28Count} of 28 days
                  </span>
                </div>
                <div className="flex gap-1 items-end h-10 pt-2">
                  {last28Dates.map((dateStr) => {
                    const isFilled = selectedHabit.checkedDates.includes(dateStr);
                    return (
                      <div
                        key={dateStr}
                        title={`${dateStr}: ${isFilled ? 'Completed' : 'Not completed'}`}
                        className={`flex-1 rounded-xs transition-all ${
                          isFilled
                            ? 'bg-[#8B7CF6] h-7'
                            : 'bg-slate-200 dark:bg-slate-700 h-2'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Personal Note / Affirmation */}
              {selectedHabit.personalNote && (
                <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/40 text-xs text-[#087F83] dark:text-[#38D0C5]">
                  <span className="font-semibold block text-[10px] uppercase tracking-wider mb-0.5">
                    My note
                  </span>
                  <p className="italic">“{selectedHabit.personalNote}”</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Insights Tab (Board 20) */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
              <div className="text-xs text-[#526782]">Total check-ins</div>
              <div className="text-2xl font-bold font-mono text-[#087F83] mt-1">
                {insights28Days.totalCheckIns}
              </div>
              <div className="text-[10px] text-[#526782]">in last 28 days</div>
            </div>

            <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
              <div className="text-xs text-[#526782]">Day coverage</div>
              <div className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
                {insights28Days.coveragePct}%
              </div>
              <div className="text-[10px] text-[#526782]">
                {insights28Days.totalCheckIns} of {insights28Days.totalPossible} days
              </div>
            </div>

            <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
              <div className="text-xs text-[#526782]">Current streak</div>
              <div className="text-2xl font-bold font-mono text-orange-600 mt-1">
                {overallCurrentHabit.current} {overallCurrentHabit.isDaily ? 'days' : 'weeks'}
              </div>
              <div className="text-[10px] text-[#526782] truncate">
                {overallCurrentHabit.habitName || 'No habits tracked'}
              </div>
            </div>

            <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
              <div className="text-xs text-[#526782]">Best streak</div>
              <div className="text-2xl font-bold font-mono text-rose-600 mt-1">
                {overallBestHabit.best} {overallBestHabit.isDaily ? 'days' : 'weeks'}
              </div>
              <div className="text-[10px] text-[#526782] truncate">
                {overallBestHabit.habitName || 'No habits tracked'}
              </div>
            </div>
          </div>

          {/* Leaderboard Table (Board 20) */}
          <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-3">
              Leaderboard by completion
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {habits.length === 0 ? (
                <div className="py-4 text-center text-[#526782]">
                  No habits to rank yet.
                </div>
              ) : (
                [...habits]
                  .sort((a, b) => b.checkedDates.length - a.checkedDates.length)
                  .map((h, idx) => (
                    <div key={h.id} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-5 font-mono font-bold text-[#526782]">
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                          {h.title}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-[#087F83] dark:text-[#38D0C5]">
                        {h.checkedDates.length} check-ins
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Habit Create / Edit Modal (Board 21) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingHabit ? 'Edit habit' : 'Create a habit'}
        subtitle="Build a positive habit with a simple and consistent plan"
      >
        <form onSubmit={handleSaveHabit} className="space-y-4">
          <div>
            <label
              htmlFor="habit-modal-title"
              className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
            >
              Habit name *
            </label>
            <input
              id="habit-modal-title"
              type="text"
              required
              value={modalTitle}
              onChange={(e) => setModalTitle(e.target.value)}
              placeholder="e.g. Read 20 minutes, Drink water"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs focus:ring-2 focus:ring-[#087F83]"
            />
          </div>

          <div role="group" aria-labelledby="habit-modal-frequency-label">
            <span
              id="habit-modal-frequency-label"
              className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
            >
              Frequency
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModalFreqType('daily')}
                className={`py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                  modalFreqType === 'daily'
                    ? 'bg-[#087F83] text-white border-[#087F83]'
                    : 'border-slate-200 dark:border-slate-700 text-[#526782]'
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setModalFreqType('weekly')}
                className={`py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                  modalFreqType === 'weekly'
                    ? 'bg-[#087F83] text-white border-[#087F83]'
                    : 'border-slate-200 dark:border-slate-700 text-[#526782]'
                }`}
              >
                Weekly target
              </button>
            </div>
          </div>

          {modalFreqType === 'weekly' && (
            <div>
              <label
                htmlFor="habit-modal-weekly-target"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Target days per week (1 - 7)
              </label>
              <input
                id="habit-modal-weekly-target"
                type="number"
                min={1}
                max={7}
                value={modalWeeklyTarget}
                onChange={(e) => setModalWeeklyTarget(parseInt(e.target.value) || 3)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="habit-modal-effective-date"
              className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
            >
              Effective date
            </label>
            <input
              id="habit-modal-effective-date"
              type="date"
              value={modalEffectiveDate}
              onChange={(e) => setModalEffectiveDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
            />
          </div>

          <div>
            <label
              htmlFor="habit-modal-note"
              className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
            >
              Personal note / Affirmation (optional)
            </label>
            <textarea
              id="habit-modal-note"
              rows={2}
              maxLength={300}
              value={modalNote}
              onChange={(e) => setModalNote(e.target.value)}
              placeholder="Why this habit matters to you…"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
            />
          </div>

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
              Save habit
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
