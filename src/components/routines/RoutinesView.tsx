import React, { useState, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import {
  Sparkles,
  Plus,
  Check,
  Pause,
  Play,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  AlertCircle,
  Info,
  CalendarDays,
  History,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { RoutineItem, Priority, RoutineInterval } from '../../types/planner';
import {
  formatRecurrenceRule,
  isRoutineActiveOnDate,
  getNextOccurrences,
  formatFriendlyDate,
  parseIsoDate,
} from '../../utils/routineRecurrence';

export const RoutinesView: React.FC = () => {
  const {
    routines,
    addRoutine,
    updateRoutineWithScope,
    deleteRoutine,
    toggleRoutineCompletion,
    skipRoutineOccurrence,
    unskipRoutineOccurrence,
    toggleRoutinePause,
    currentDate,
    todayDate,
    settings,
  } = usePlanner();

  const [activeTab, setActiveTab] = useState<'active' | 'paused' | 'history'>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutineItem | null>(null);
  const [inspectingRoutine, setInspectingRoutine] = useState<RoutineItem | null>(null);

  // Form states
  const [modalTitle, setModalTitle] = useState('');
  const [modalCategory, setModalCategory] = useState('Personal');
  const [modalAssigned, setModalAssigned] = useState(() => settings.ownerName || 'Me');
  const [modalPriority, setModalPriority] = useState<Priority>('medium');
  const [modalInterval, setModalInterval] = useState<RoutineInterval>('daily');
  const [modalCustomCount, setModalCustomCount] = useState(1);
  const [modalCustomUnit, setModalCustomUnit] = useState<'days' | 'weeks' | 'months' | 'years'>('weeks');
  const [modalWeekdays, setModalWeekdays] = useState<number[]>([1]); // Monday default
  const [modalStartDate, setModalStartDate] = useState(currentDate);
  const [modalHasEndDate, setModalHasEndDate] = useState(false);
  const [modalEndDate, setModalEndDate] = useState('');
  const [modalStartTime, setModalStartTime] = useState('07:30');
  const [modalNotes, setModalNotes] = useState('');
  const [modalUpdateScope, setModalUpdateScope] = useState<'this' | 'future'>('future');
  const [modalOccurrenceDate, setModalOccurrenceDate] = useState(currentDate);
  const [modalIsPaused, setModalIsPaused] = useState(false);

  const openCreateModal = () => {
    setEditingRoutine(null);
    setModalTitle('');
    setModalCategory('Personal');
    setModalAssigned(settings.ownerName || 'Me');
    setModalPriority('medium');
    setModalInterval('daily');
    setModalCustomCount(1);
    setModalCustomUnit('weeks');
    setModalWeekdays([parseIsoDate(currentDate).dayOfWeek]);
    setModalStartDate(currentDate);
    setModalHasEndDate(false);
    setModalEndDate('');
    setModalStartTime('07:30');
    setModalNotes('');
    setModalUpdateScope('future');
    setModalOccurrenceDate(currentDate);
    setModalIsPaused(false);
    setIsModalOpen(true);
  };

  const openEditModal = (routine: RoutineItem, specificOccurrenceDate?: string) => {
    setEditingRoutine(routine);
    setModalTitle(routine.title);
    setModalCategory(routine.category);
    setModalAssigned(routine.assignedTo);
    setModalPriority(routine.priority);
    setModalInterval(routine.interval);
    setModalCustomCount(routine.customEveryCount || 1);
    setModalCustomUnit(routine.customUnit || 'weeks');
    setModalWeekdays(
      routine.weekdays && routine.weekdays.length > 0
        ? routine.weekdays
        : [parseIsoDate(routine.startDate).dayOfWeek]
    );
    setModalStartDate(routine.startDate);
    setModalHasEndDate(!!routine.endDate);
    setModalEndDate(routine.endDate || '');
    setModalStartTime(routine.startTime || '07:30');
    setModalNotes(routine.notes || '');
    setModalUpdateScope('future');
    setModalOccurrenceDate(specificOccurrenceDate || currentDate);
    setModalIsPaused(routine.isPaused);
    setIsModalOpen(true);
  };

  const handleSaveRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) return;

    const routinePayload = {
      title: modalTitle.trim(),
      category: modalCategory,
      assignedTo: modalAssigned,
      priority: modalPriority,
      interval: modalInterval,
      customEveryCount: modalInterval === 'custom' || modalCustomCount > 1 ? modalCustomCount : undefined,
      customUnit: modalInterval === 'custom' ? modalCustomUnit : undefined,
      weekdays:
        modalInterval === 'weekly' || (modalInterval === 'custom' && modalCustomUnit === 'weeks')
          ? modalWeekdays
          : undefined,
      startDate: modalStartDate,
      endDate: modalHasEndDate && modalEndDate ? modalEndDate : undefined,
      startTime: modalStartTime,
      notes: modalNotes,
      isPaused: modalIsPaused,
    };

    if (editingRoutine) {
      updateRoutineWithScope(
        editingRoutine.id,
        modalOccurrenceDate,
        modalUpdateScope,
        routinePayload
      );
    } else {
      addRoutine(routinePayload);
    }
    setIsModalOpen(false);
  };

  // Toggle weekday selection
  const toggleWeekday = (dayNum: number) => {
    setModalWeekdays((prev) =>
      prev.includes(dayNum)
        ? prev.length > 1
          ? prev.filter((d) => d !== dayNum)
          : prev
        : [...prev, dayNum]
    );
  };

  const activeRoutines = routines.filter((r) => !r.isPaused);
  const pausedRoutines = routines.filter((r) => r.isPaused);

  // Yesterday date calculation for overdue routine check
  const yesterdayDateStr = useMemo(() => {
    const parts = todayDate.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, [todayDate]);

  const formattedYesterday = useMemo(() => {
    try {
      const parts = yesterdayDateStr.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return yesterdayDateStr;
    }
  }, [yesterdayDateStr]);

  // Dynamic overdue check: any routine that was active yesterday, unpaused, not completed, and not skipped
  const overdueRoutine = useMemo(() => {
    return routines.find(
      (r) =>
        !r.isPaused &&
        isRoutineActiveOnDate(r, yesterdayDateStr) &&
        !r.completedDates.includes(yesterdayDateStr) &&
        !r.skippedDates.includes(yesterdayDateStr)
    );
  }, [routines, yesterdayDateStr]);

  // Live preview description for the editor
  const previewRuleDescription = useMemo(() => {
    const tempRoutine: RoutineItem = {
      id: 'temp',
      title: modalTitle || 'Routine',
      category: modalCategory,
      assignedTo: modalAssigned,
      priority: modalPriority,
      interval: modalInterval,
      customEveryCount: modalCustomCount,
      customUnit: modalCustomUnit,
      weekdays: modalWeekdays,
      startDate: modalStartDate,
      endDate: modalHasEndDate ? modalEndDate : undefined,
      isPaused: modalIsPaused,
      completedDates: [],
      skippedDates: [],
    };
    return formatRecurrenceRule(tempRoutine);
  }, [
    modalTitle,
    modalCategory,
    modalAssigned,
    modalPriority,
    modalInterval,
    modalCustomCount,
    modalCustomUnit,
    modalWeekdays,
    modalStartDate,
    modalHasEndDate,
    modalEndDate,
    modalIsPaused,
  ]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Routines
          </h2>
          <p className="text-xs sm:text-sm text-[#526782] dark:text-[#A8B8CE]">
            Build steady daily, weekly, and seasonal routines that fit your schedule.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-[#526782]">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                  : ''
              }`}
            >
              Active ({activeRoutines.length})
            </button>
            <button
              onClick={() => setActiveTab('paused')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'paused'
                  ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                  : ''
              }`}
            >
              Paused ({pausedRoutines.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                  : ''
              }`}
            >
              History
            </button>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New routine</span>
          </button>
        </div>
      </div>

      {/* Overdue Routine Alert Banner */}
      {overdueRoutine && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-[#071A3A] dark:text-[#EDF4FF]">
                {overdueRoutine.title}
              </div>
              <div className="text-xs text-rose-600 dark:text-rose-400">
                Was due: {formattedYesterday} · 1 day overdue
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleRoutineCompletion(overdueRoutine.id, yesterdayDateStr)}
              className="px-3.5 py-1.5 rounded-xl bg-[#071A3A] dark:bg-rose-700 text-white text-xs font-semibold hover:bg-black cursor-pointer"
            >
              Complete
            </button>
            <button
              onClick={() => skipRoutineOccurrence(overdueRoutine.id, yesterdayDateStr)}
              className="px-3.5 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 cursor-pointer"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Routine Cards List (Active or Paused) */}
      {activeTab !== 'history' && (
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs divide-y divide-slate-100 dark:divide-slate-800">
          {(activeTab === 'active' ? activeRoutines : pausedRoutines).length === 0 ? (
            <div data-testid="routines-empty-state" className="py-10 text-center space-y-3">
              <div className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                {activeTab === 'active' ? 'No active routines yet' : 'No paused routines'}
              </div>
              <p className="text-xs sm:text-sm text-[#526782] dark:text-[#A8B8CE] max-w-md mx-auto">
                {activeTab === 'active'
                  ? 'Add a recurring daily or weekly routine—like morning prep, evening tidy, or weekly review—to keep your days steady.'
                  : 'Paused routines will appear here whenever you take a break from a recurring schedule.'}
              </p>
              {activeTab === 'active' && (
                <div className="pt-1">
                  <button
                    type="button"
                    data-testid="routines-empty-cta"
                    onClick={openCreateModal}
                    className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create your first routine</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            (activeTab === 'active' ? activeRoutines : pausedRoutines).map((routine) => {
              const isScheduledToday = isRoutineActiveOnDate(routine, currentDate, { includePaused: true });
              const isDoneToday = routine.completedDates.includes(currentDate);
              const isStartsInFuture = routine.startDate > currentDate;
              const nextOccurrences = getNextOccurrences(routine, currentDate, 1);
              const nextDateStr = nextOccurrences[0];

              return (
                <div
                  key={routine.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 px-3 rounded-xl transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    {/* Toggle button if scheduled today */}
                    {isScheduledToday ? (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isDoneToday}
                        aria-label={`Mark routine "${routine.title}" as ${isDoneToday ? 'incomplete' : 'complete'}`}
                        onClick={() => toggleRoutineCompletion(routine.id, currentDate)}
                        title={isDoneToday ? 'Completed today (click to undo)' : 'Click to complete for today'}
                        className={`w-5 h-5 mt-0.5 sm:mt-0 rounded-full flex items-center justify-center cursor-pointer micro-checkbox shrink-0 ${
                          isDoneToday
                            ? 'bg-[#087F83] text-white'
                            : 'border border-slate-300 dark:border-slate-600 hover:border-[#087F83]'
                        }`}
                      >
                        {isDoneToday && <Check className="w-3.5 h-3.5 stroke-[3] motion-check-pop" />}
                      </button>
                    ) : (
                      <div
                        className="w-5 h-5 mt-0.5 sm:mt-0 rounded-full border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0 text-[10px] text-slate-400"
                        title={
                          isStartsInFuture
                            ? `Starts in future on ${formatFriendlyDate(routine.startDate)}`
                            : 'Not scheduled for current date'
                        }
                      >
                        ·
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                          {routine.title}
                        </span>

                        {/* Recurrence Rule Badge */}
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50">
                          {formatRecurrenceRule(routine)}
                        </span>

                        {/* Future start indicator */}
                        {isStartsInFuture && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/60">
                            Starts {formatFriendlyDate(routine.startDate)}
                          </span>
                        )}

                        {/* End date indicator if specified */}
                        {routine.endDate && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            Until {formatFriendlyDate(routine.endDate)}
                          </span>
                        )}

                        {routine.isPaused && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            Paused
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#526782] dark:text-[#A8B8CE]">
                        {routine.startTime && (
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {routine.startTime}
                          </span>
                        )}
                        <span>{routine.category}</span>
                        {isScheduledToday && isDoneToday && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            ✓ Done today
                          </span>
                        )}
                        {isScheduledToday && !isDoneToday && (
                          <span className="text-[#087F83] dark:text-[#38D0C5] font-medium">
                            Scheduled today
                          </span>
                        )}
                        {!isScheduledToday && nextDateStr && (
                          <span className="text-slate-400">
                            Next occurrence: {formatFriendlyDate(nextDateStr)}
                          </span>
                        )}
                        {routine.completedDates.length > 0 && (
                          <span>· {routine.completedDates.length} completed</span>
                        )}
                        {routine.skippedDates.length > 0 && (
                          <span>· {routine.skippedDates.length} skipped</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                    {/* Inspect rule */}
                    <button
                      type="button"
                      onClick={() => setInspectingRoutine(routine)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#087F83] dark:text-[#38D0C5] cursor-pointer"
                      title="Inspect recurrence rule"
                      aria-label={`Inspect recurrence rule for "${routine.title}"`}
                    >
                      <Info className="w-4 h-4" />
                    </button>

                    {/* Pause / Resume */}
                    <button
                      type="button"
                      onClick={() => toggleRoutinePause(routine.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#526782] dark:text-[#A8B8CE] cursor-pointer"
                      title={routine.isPaused ? 'Resume routine' : 'Pause routine'}
                      aria-label={`${routine.isPaused ? 'Resume' : 'Pause'} routine "${routine.title}"`}
                    >
                      {routine.isPaused ? (
                        <Play className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Pause className="w-4 h-4" />
                      )}
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => openEditModal(routine)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#526782] dark:text-[#A8B8CE] cursor-pointer"
                      title="Edit routine"
                      aria-label={`Edit routine "${routine.title}"`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => deleteRoutine(routine.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 cursor-pointer"
                      title="Delete routine"
                      aria-label={`Delete routine "${routine.title}"`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Routine Completion & Skip History
          </h3>
          <p className="text-xs text-[#526782]">
            Review all logged completions, skipped occurrences, and series overrides.
          </p>

          <div className="space-y-3 pt-2">
            {routines.every((r) => r.completedDates.length === 0 && r.skippedDates.length === 0) ? (
              <div className="py-8 text-center text-xs text-[#526782]">
                No history recorded yet. Complete or skip routines to see entries here.
              </div>
            ) : (
              routines.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-xs text-[#071A3A] dark:text-[#EDF4FF]">
                        {r.title}
                      </div>
                      <div className="text-[10px] text-[#526782]">{formatRecurrenceRule(r)}</div>
                    </div>
                    <span className="text-[11px] font-mono text-[#087F83]">
                      {r.completedDates.length} completed · {r.skippedDates.length} skipped
                    </span>
                  </div>

                  {r.completedDates.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-500 mr-1 self-center">Completed:</span>
                      {r.completedDates.map((d) => (
                        <span
                          key={d}
                          className="px-2 py-0.5 rounded-md text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono border border-emerald-200/60"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}

                  {r.skippedDates.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 items-center">
                      <span className="text-[10px] text-slate-500 mr-1">Skipped:</span>
                      {r.skippedDates.map((d) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-mono border border-rose-200/60"
                        >
                          <span>{d}</span>
                          <button
                            type="button"
                            onClick={() => unskipRoutineOccurrence(r.id, d)}
                            className="text-rose-500 hover:text-rose-700 ml-1 cursor-pointer font-bold"
                            title="Unskip occurrence"
                            aria-label={`Unskip occurrence on ${d} for "${r.title}"`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Recurrence Rule Inspector Modal */}
      {inspectingRoutine && (
        <Modal
          isOpen={!!inspectingRoutine}
          onClose={() => setInspectingRoutine(null)}
          title={`Recurrence Details · ${inspectingRoutine.title}`}
          subtitle="Detailed inspection of recurrence rules, custom intervals, leap dates and upcoming dates"
        >
          <div className="space-y-4">
            {/* Rule Summary Card */}
            <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Repeat Rule
                </span>
                <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-[#087F83] text-white">
                  {formatRecurrenceRule(inspectingRoutine)}
                </span>
              </div>
              <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
                {inspectingRoutine.interval === 'custom'
                  ? `Custom interval: Every ${inspectingRoutine.customEveryCount || 1} ${inspectingRoutine.customUnit || 'weeks'}`
                  : inspectingRoutine.interval === 'weekly'
                  ? 'Weekly cadence'
                  : inspectingRoutine.interval === 'monthly'
                  ? 'Monthly recurrence anchored to start day'
                  : inspectingRoutine.interval === 'yearly'
                  ? 'Yearly recurrence anchored to start month & day'
                  : 'Daily repeat'}
              </p>
            </div>

            {/* Parameter grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                  Start Date
                </span>
                <span className="font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  {formatFriendlyDate(inspectingRoutine.startDate)} ({inspectingRoutine.startDate})
                </span>
                {inspectingRoutine.startDate > currentDate && (
                  <span className="text-amber-600 dark:text-amber-400 block text-[10px]">
                    ★ In future (will not appear before this date)
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                  End Date
                </span>
                <span className="font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  {inspectingRoutine.endDate
                    ? `${formatFriendlyDate(inspectingRoutine.endDate)} (${inspectingRoutine.endDate})`
                    : 'No end date (indefinite)'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                  Status & Priority
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      inspectingRoutine.isPaused
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {inspectingRoutine.isPaused ? 'Paused' : 'Active'}
                  </span>
                  <span className="capitalize font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                    {inspectingRoutine.priority}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                  Time & Category
                </span>
                <span className="font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  {inspectingRoutine.startTime || '07:30'} · {inspectingRoutine.category}
                </span>
              </div>
            </div>

            {/* Next 5 Upcoming Occurrences */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] block">
                Next Upcoming Occurrences
              </span>
              <div className="space-y-1.5">
                {getNextOccurrences(inspectingRoutine, currentDate, 5).map((dateStr, idx) => (
                  <div
                    key={dateStr}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 font-mono"
                  >
                    <span className="flex items-center gap-2 text-[#071A3A] dark:text-[#EDF4FF]">
                      <span className="text-slate-400 font-sans text-[10px]">#{idx + 1}</span>
                      <span>{dateStr}</span>
                      <span className="text-slate-500 font-sans text-[11px]">
                        ({formatFriendlyDate(dateStr)})
                      </span>
                    </span>
                    <span className="text-[10px] text-[#087F83] font-sans font-semibold">
                      {dateStr === currentDate ? 'Today' : idx === 0 ? 'Next' : 'Upcoming'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <details className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 px-3.5 py-2.5 text-xs">
              <summary className="font-semibold text-[#526782] dark:text-[#A8B8CE] cursor-pointer select-none">
                Advanced details: Recurrence rule &amp; leap-year behavior
              </summary>
              <div className="mt-2 space-y-1.5 text-[11px] text-[#526782] dark:text-[#A8B8CE] leading-relaxed">
                <p>
                  <strong>Active rule:</strong> {formatRecurrenceRule(inspectingRoutine)} (starts {inspectingRoutine.startDate}{inspectingRoutine.endDate ? `, ends ${inspectingRoutine.endDate}` : ''}).
                </p>
                {inspectingRoutine.startDate.endsWith('-02-29') ? (
                  <p>
                    <strong>Leap Date Recurrence Active (Feb 29 anchor):</strong> In leap years (2024, 2028, 2032), this routine occurs on Feb 29. In standard years (2025, 2026, 2027), it shifts to Feb 28 so occurrences are never dropped.
                  </p>
                ) : (
                  <p>
                    Completion and skip records are tracked per calendar date without altering future scheduled occurrences.
                  </p>
                )}
              </div>
            </details>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  const toEdit = inspectingRoutine;
                  setInspectingRoutine(null);
                  openEditModal(toEdit);
                }}
                className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit routine</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectingRoutine(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Routine Modal (Create / Edit) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRoutine ? 'Edit routine' : 'Create routine'}
        subtitle="Set your routine name, schedule, and preferred time"
      >
        <form onSubmit={handleSaveRoutine} className="space-y-4">
          <div>
            <label
              htmlFor="routine-modal-title"
              className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
            >
              Routine name *
            </label>
            <input
              id="routine-modal-title"
              type="text"
              required
              value={modalTitle}
              onChange={(e) => setModalTitle(e.target.value)}
              placeholder="e.g. Morning routine, Water plants, Renew passport"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs focus:ring-2 focus:ring-[#087F83]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="routine-modal-category"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Category
              </label>
              <select
                id="routine-modal-category"
                value={modalCategory}
                onChange={(e) => setModalCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
              >
                <option value="Personal">Personal</option>
                <option value="Finances">Finances</option>
                <option value="Relationships">Relationships</option>
                <option value="Health">Health</option>
                <option value="Career">Career</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="routine-modal-priority"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Priority
              </label>
              <select
                id="routine-modal-priority"
                value={modalPriority}
                onChange={(e) => setModalPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Repeat Rule Selection (All 5 options: Daily, Weekly, Monthly, Yearly, Custom) */}
          <div role="group" aria-labelledby="routine-repeat-interval-label">
            <div className="flex items-center justify-between mb-1">
              <span
                id="routine-repeat-interval-label"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF]"
              >
                Repeat interval *
              </span>
              <span className="text-[10px] font-semibold text-[#087F83] dark:text-[#38D0C5]">
                {previewRuleDescription}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map((int) => (
                <button
                  type="button"
                  key={int}
                  onClick={() => setModalInterval(int)}
                  className={`py-2 rounded-xl text-xs font-semibold capitalize border transition-colors cursor-pointer ${
                    modalInterval === int
                      ? 'bg-[#087F83] text-white border-[#087F83] shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 text-[#526782] hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {int}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Interval Controls */}
          {modalInterval === 'custom' && (
            <div className="p-3 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-900/60 space-y-3">
              <span className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] block">
                Custom Interval Rule
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="routine-custom-count"
                    className="block text-[10px] font-semibold text-[#526782] mb-1"
                  >
                    Repeat every
                  </label>
                  <input
                    id="routine-custom-count"
                    type="number"
                    min="1"
                    max="100"
                    value={modalCustomCount}
                    onChange={(e) => setModalCustomCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-semibold"
                  />
                </div>
                <div>
                  <label
                    htmlFor="routine-custom-unit"
                    className="block text-[10px] font-semibold text-[#526782] mb-1"
                  >
                    Unit
                  </label>
                  <select
                    id="routine-custom-unit"
                    value={modalCustomUnit}
                    onChange={(e) => setModalCustomUnit(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-semibold"
                  >
                    <option value="days">Day(s)</option>
                    <option value="weeks">Week(s)</option>
                    <option value="months">Month(s)</option>
                    <option value="years">Year(s)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Weekday selection for Weekly or Custom Weeks */}
          {(modalInterval === 'weekly' || (modalInterval === 'custom' && modalCustomUnit === 'weeks')) && (
            <div role="group" aria-labelledby="routine-weekdays-label">
              <span
                id="routine-weekdays-label"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Repeat on weekdays
              </span>
              <div className="flex gap-1.5">
                {(settings.weekStartsOn === 'Sunday'
                  ? [
                      { num: 0, label: 'Sun' },
                      { num: 1, label: 'Mon' },
                      { num: 2, label: 'Tue' },
                      { num: 3, label: 'Wed' },
                      { num: 4, label: 'Thu' },
                      { num: 5, label: 'Fri' },
                      { num: 6, label: 'Sat' },
                    ]
                  : [
                      { num: 1, label: 'Mon' },
                      { num: 2, label: 'Tue' },
                      { num: 3, label: 'Wed' },
                      { num: 4, label: 'Thu' },
                      { num: 5, label: 'Fri' },
                      { num: 6, label: 'Sat' },
                      { num: 0, label: 'Sun' },
                    ]
                ).map((d) => (
                  <button
                    type="button"
                    key={d.num}
                    onClick={() => toggleWeekday(d.num)}
                    className={`flex-1 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      modalWeekdays.includes(d.num)
                        ? 'bg-[#087F83] text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-[#526782] hover:bg-slate-200'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Start and Start Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="routine-start-date"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Start date *
              </label>
              <input
                id="routine-start-date"
                type="date"
                required
                value={modalStartDate}
                onChange={(e) => setModalStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="routine-start-time"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Start time
              </label>
              <input
                id="routine-start-time"
                type="time"
                value={modalStartTime}
                onChange={(e) => setModalStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
              />
            </div>
          </div>

          <details
            data-testid="routine-advanced-details"
            className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 px-3.5 py-2.5 text-xs"
          >
            <summary className="font-semibold text-[#526782] dark:text-[#A8B8CE] cursor-pointer select-none">
              Advanced details: End date, series scope &amp; recurrence rules
            </summary>
            <div className="mt-3 space-y-3">
              {/* Optional End Date */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modalHasEndDate}
                    onChange={(e) => setModalHasEndDate(e.target.checked)}
                  />
                  <span>Set end date (stop repeating)</span>
                </label>

                {modalHasEndDate && (
                  <input
                    type="date"
                    aria-label="Routine end date"
                    min={modalStartDate}
                    value={modalEndDate}
                    onChange={(e) => setModalEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
                  />
                )}
              </div>

              {/* Update scope for editing existing routines */}
              {editingRoutine && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                      Update scope
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Target date: {modalOccurrenceDate}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="scope"
                        className="mt-0.5"
                        checked={modalUpdateScope === 'this'}
                        onChange={() => setModalUpdateScope('this')}
                      />
                      <div>
                        <span className="font-semibold text-[#071A3A] dark:text-[#EDF4FF] block">
                          This occurrence only
                        </span>
                        <span className="text-[11px] text-[#526782]">
                          Customizes only the occurrence on {modalOccurrenceDate}. The rest of the series remains unchanged.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="scope"
                        className="mt-0.5"
                        checked={modalUpdateScope === 'future'}
                        onChange={() => setModalUpdateScope('future')}
                      />
                      <div>
                        <span className="font-semibold text-[#071A3A] dark:text-[#EDF4FF] block">
                          This and future occurrences
                        </span>
                        <span className="text-[11px] text-[#526782]">
                          Applies these changes from {modalOccurrenceDate} onward while preserving past occurrences.
                        </span>
                      </div>
                    </label>
                  </div>

                  {modalUpdateScope === 'this' && (
                    <div className="pt-1">
                      <label
                        htmlFor="routine-occurrence-date"
                        className="block text-[10px] font-semibold text-[#526782] mb-1"
                      >
                        Occurrence date to modify:
                      </label>
                      <input
                        id="routine-occurrence-date"
                        type="date"
                        value={modalOccurrenceDate}
                        onChange={(e) => setModalOccurrenceDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900"
                      />
                    </div>
                  )}
                </div>
              )}

              <p className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">
                Schedule summary: <strong>{previewRuleDescription}</strong>. Leap-day anchors (Feb 29) shift to Feb 28 in non-leap years automatically.
              </p>
            </div>
          </details>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer">
              <input
                type="checkbox"
                checked={modalIsPaused}
                onChange={(e) => setModalIsPaused(e.target.checked)}
              />
              <span>Pause routine</span>
            </label>

            <div className="flex gap-2">
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
                Save routine
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
