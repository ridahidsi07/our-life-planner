import React from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { useFocusSession } from '../../context/FocusContext';
import { useDialogAccessibility } from '../ui/Modal';
import {
  X,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Calendar,
  Sparkles,
  Coffee,
} from 'lucide-react';

export const FocusModal: React.FC = () => {
  const { activeModal, setActiveModal } = usePlanner();
  const {
    formattedTimer,
    isRunning,
    isBreak,
    toggleTimer,
    resetTimer,
    startBreak,
    currentTask,
    pendingTasks,
    completeTask,
    deferTaskTomorrow,
  } = useFocusSession();

  const isOpen = activeModal === 'focus_mode';
  const { dialogRef } = useDialogAccessibility(isOpen, () => setActiveModal(null));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071A3A]/70 backdrop-blur-md animate-in fade-in">
      <div
        className="fixed inset-0"
        onClick={() => setActiveModal(null)}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="focus-title"
        tabIndex={-1}
        className="bg-white dark:bg-[#152238] rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative z-10 flex flex-col items-center text-center outline-none"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={() => setActiveModal(null)}
          aria-label="Close Focus Mode"
          className="absolute top-4 right-4 min-w-[44px] min-h-[44px] p-2.5 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#087F83] dark:text-[#38D0C5] text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Focus Mode</span>
        </div>

        <h2 id="focus-title" className="text-xl md:text-2xl font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
          {isBreak ? 'Rest & Recharge' : 'One Next Action'}
        </h2>
        <p className="text-xs text-[#526782] dark:text-[#A8B8CE] max-w-sm mb-6">
          {isBreak
            ? 'Step away from your screen, stretch, take a sip of water.'
            : 'Clear away everything else. Give this single commitment your undivided momentum.'}
        </p>

        {/* Timer Box */}
        <div className="mb-6 flex flex-col items-center">
          <div
            aria-live="off"
            aria-label={`Focus timer ${formattedTimer}`}
            data-testid="focus-modal-timer-display"
            className="text-5xl md:text-6xl font-mono font-bold text-[#071A3A] dark:text-[#EDF4FF] tracking-wider mb-3 tabular-nums"
          >
            {formattedTimer}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              data-testid="focus-modal-toggle-btn"
              onClick={toggleTimer}
              aria-pressed={isRunning}
              className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                isRunning
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 hover:text-amber-950 dark:bg-amber-950/90 dark:text-amber-200 dark:border-amber-700/80 dark:hover:bg-amber-900 dark:hover:text-amber-100'
                  : 'bg-[#087F83] text-white border border-transparent hover:bg-[#06676A] dark:bg-[#38D0C5] dark:text-[#071A3A] dark:hover:bg-[#2BB5AB]'
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isRunning ? 'Pause' : 'Start Timer'}</span>
            </button>
            <button
              type="button"
              data-testid="focus-modal-reset-btn"
              onClick={resetTimer}
              aria-label="Reset timer to 25 minutes"
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              data-testid="focus-modal-break-btn"
              onClick={startBreak}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Coffee className="w-4 h-4" />
              <span>5m Break</span>
            </button>
          </div>
        </div>

        {/* Task Card */}
        {currentTask ? (
          <div
            data-testid="focus-modal-task-card"
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 mb-6 text-left"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#087F83] dark:text-[#38D0C5]">
                {currentTask.category}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium capitalize">
                {currentTask.priority} priority
              </span>
            </div>

            <div className="text-lg md:text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-2">
              {currentTask.title}
            </div>

            {currentTask.description && (
              <p className="text-xs text-[#526782] dark:text-[#A8B8CE] mb-3 whitespace-pre-wrap">
                {currentTask.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-[#526782] dark:text-[#A8B8CE] pt-2 border-t border-slate-200 dark:border-slate-700">
              {currentTask.scheduledStart ? (
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  {currentTask.scheduledStart}
                </span>
              ) : currentTask.isAllDay ? (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  All day
                </span>
              ) : null}
              {currentTask.assignedTo && (
                <span>Assigned: {currentTask.assignedTo}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 rounded-2xl p-6 mb-6">
            <CheckCircle2 className="w-8 h-8 text-[#087F83] dark:text-[#38D0C5] mx-auto mb-2" />
            <div className="font-bold text-sm text-[#071A3A] dark:text-[#EDF4FF]">
              All pending tasks complete!
            </div>
            <p className="text-xs text-[#526782] dark:text-[#A8B8CE] mt-1">
              Your task backlog is clear for now. Great work!
            </p>
          </div>
        )}

        {/* Action Controls */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="focus-modal-complete-task-btn"
            onClick={completeTask}
            disabled={!currentTask}
            className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-[#087F83] text-white font-semibold text-sm hover:bg-[#06676A] dark:bg-[#38D0C5] dark:text-[#071A3A] dark:hover:bg-[#2BB5AB] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Done · Next Action</span>
          </button>

          <button
            type="button"
            data-testid="focus-modal-defer-task-btn"
            onClick={deferTaskTomorrow}
            disabled={!currentTask}
            className="w-full min-h-[44px] py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-[#071A3A] dark:text-[#EDF4FF] font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Reschedule for Tomorrow</span>
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between w-full text-xs text-[#526782] dark:text-[#A8B8CE]">
          <span>
            {pendingTasks.length} task{pendingTasks.length === 1 ? '' : 's'} remaining
          </span>
          <button
            type="button"
            onClick={() => setActiveModal(null)}
            className="min-h-[44px] px-2 flex items-center hover:underline cursor-pointer font-medium text-[#071A3A] dark:text-[#EDF4FF]"
          >
            Return to dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
