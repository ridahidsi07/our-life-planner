import React, { useState, useEffect, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
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
import { TaskItem } from '../../types/planner';

export const FocusModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    tasks,
    toggleTaskCompletion,
    rescheduleTask,
    todayDate,
  } = usePlanner();

  const isOpen = activeModal === 'focus_mode';
  const { dialogRef } = useDialogAccessibility(isOpen, () => setActiveModal(null));

  // Find next pending task (not completed, not archived)
  const pendingTasks = useMemo(() => {
    return tasks.filter((t) => !t.isArchived && t.status !== 'completed');
  }, [tasks]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);

  // Current task
  const currentTask: TaskItem | undefined = pendingTasks[currentIndex] || pendingTasks[0];

  // Timer countdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerSeconds]);

  // Format timer
  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  const handleStartBreak = () => {
    setIsBreak(true);
    setTimerSeconds(5 * 60);
    setIsTimerRunning(true);
  };

  const handleResetFocusTimer = () => {
    setIsBreak(false);
    setTimerSeconds(25 * 60);
    setIsTimerRunning(false);
  };

  const handleCompleteTask = () => {
    if (currentTask) {
      toggleTaskCompletion(currentTask.id);
    }
    // Advance or stay at 0
    if (currentIndex >= pendingTasks.length - 1) {
      setCurrentIndex(0);
    }
  };

  const handleDeferTomorrow = () => {
    if (currentTask) {
      const parts = todayDate.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      d.setDate(d.getDate() + 1);
      const tomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      rescheduleTask(currentTask.id, tomorrow);
    }
  };

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
        className="bg-white dark:bg-[#152238] rounded-3xl max-w-xl w-full p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative z-10 flex flex-col items-center text-center outline-none"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={() => setActiveModal(null)}
          aria-label="Close focus view"
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#087F83] dark:text-[#38D0C5] text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Distraction-Free Focus View</span>
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
          <div className="text-5xl md:text-6xl font-mono font-bold text-[#071A3A] dark:text-[#EDF4FF] tracking-wider mb-3">
            {formatTimer(timerSeconds)}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                isTimerRunning
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200'
                  : 'bg-[#087F83] text-white hover:bg-[#06676A]'
              }`}
            >
              {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isTimerRunning ? 'Pause' : 'Start Timer'}</span>
            </button>
            <button
              onClick={handleResetFocusTimer}
              aria-label="Reset timer to 25 minutes"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleStartBreak}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>5m Break</span>
            </button>
          </div>
        </div>

        {/* Task Card */}
        {currentTask ? (
          <div className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 mb-6 text-left">
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
            onClick={handleCompleteTask}
            disabled={!currentTask}
            className="w-full py-3 px-4 rounded-xl bg-[#087F83] text-white font-semibold text-sm hover:bg-[#06676A] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Done · Next Action</span>
          </button>

          <button
            onClick={handleDeferTomorrow}
            disabled={!currentTask}
            className="w-full py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-[#071A3A] dark:text-[#EDF4FF] font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>Reschedule for Tomorrow</span>
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between w-full text-xs text-[#526782] dark:text-[#A8B8CE]">
          <span>
            {pendingTasks.length} task{pendingTasks.length === 1 ? '' : 's'} remaining
          </span>
          <button
            onClick={() => setActiveModal(null)}
            className="hover:underline cursor-pointer font-medium"
          >
            Return to dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
