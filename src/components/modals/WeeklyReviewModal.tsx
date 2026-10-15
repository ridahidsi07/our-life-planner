import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { useDialogAccessibility, focusFirstDialogElement } from '../ui/Modal';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Archive,
  Flame,
  Award,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  History,
} from 'lucide-react';
import { getCurrencySymbol } from '../../utils/formatters';
import {
  getReviewedWeekRange,
  shiftWeekDate,
  calculateWeeklyReviewMetrics,
} from '../../utils/weeklyReview';

export const WeeklyReviewModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    tasks,
    addTask,
    updateTask,
    rescheduleTask,
    archiveTask,
    habits,
    cashFlow,
    settings,
    todayDate,
    currentDate,
    workouts,
    weeklyReviews,
    saveWeeklyReview,
  } = usePlanner();

  const isOpen = activeModal === 'weekly_review';
  const { dialogRef } = useDialogAccessibility(isOpen, () => setActiveModal(null));

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedRefDate, setSelectedRefDate] = useState<string>(() => currentDate || todayDate);
  const [reflection, setReflection] = useState('');
  const [intentions, setIntentions] = useState<string[]>(['', '', '']);
  const [linkedTaskIds, setLinkedTaskIds] = useState<Record<number, string>>({});
  const [createTasksOnComplete, setCreateTasksOnComplete] = useState<boolean>(true);

  const currencySymbol = settings.currencySymbol || getCurrencySymbol(settings.currency) || '$';

  // Exact reviewed week date range (respects settings.weekStartsOn)
  const reviewedWeek = useMemo(() => {
    return getReviewedWeekRange(selectedRefDate || currentDate || todayDate, settings.weekStartsOn || 'monday');
  }, [selectedRefDate, currentDate, todayDate, settings.weekStartsOn]);

  // Existing saved review for this reviewed week
  const existingReview = useMemo(() => {
    return weeklyReviews.find((r) => r.weekStartDate === reviewedWeek.weekStartDate) || null;
  }, [weeklyReviews, reviewedWeek.weekStartDate]);

  // Week-scoped metrics (restricted to reviewedWeek.weekStartDate .. reviewedWeek.weekEndDate)
  const weekMetrics = useMemo(() => {
    return calculateWeeklyReviewMetrics({
      tasks,
      workouts,
      habits,
      weekStartDate: reviewedWeek.weekStartDate,
      weekEndDate: reviewedWeek.weekEndDate,
    });
  }, [tasks, workouts, habits, reviewedWeek.weekStartDate, reviewedWeek.weekEndDate]);

  const completedTasksCount = weekMetrics.completedTasksCount;
  const completedWorkoutsCount = weekMetrics.completedWorkoutsCount;

  // Hydrate form state when modal opens or when switching to a different reviewed week
  const loadedWeekKeyRef = useRef<string | null>(null);
  const wasOpenRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      loadedWeekKeyRef.current = null;
      return;
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      setStep(1);
      setSelectedRefDate(currentDate || todayDate);
    }
  }, [isOpen, currentDate, todayDate]);

  useEffect(() => {
    if (!isOpen) return;
    if (loadedWeekKeyRef.current === reviewedWeek.weekStartDate) return;

    loadedWeekKeyRef.current = reviewedWeek.weekStartDate;
    if (existingReview) {
      setReflection(existingReview.reflection || '');
      const paddedIntentions = [
        existingReview.intentions?.[0] || '',
        existingReview.intentions?.[1] || '',
        existingReview.intentions?.[2] || '',
      ];
      setIntentions(paddedIntentions);
      setLinkedTaskIds(existingReview.linkedTaskIds || {});
    } else {
      setReflection('');
      setIntentions(['', '', '']);
      setLinkedTaskIds({});
    }
  }, [isOpen, reviewedWeek.weekStartDate, existingReview]);

  // Overdue tasks relative to reviewed week end / today
  const overdueTasks = useMemo(() => {
    return tasks.filter((t) => !t.isArchived && t.status !== 'completed' && t.dueDate && t.dueDate < todayDate);
  }, [tasks, todayDate]);

  // Next week's start date for rescheduling or linked priority tasks
  const nextWeekStartDate = reviewedWeek.nextWeekStartDate;

  // Persist current draft/review to PlannerContext & localStorage
  const persistReviewDraft = (options?: {
    nextReflection?: string;
    nextIntentions?: string[];
    nextLinkedTaskIds?: Record<number, string>;
    markCompleted?: boolean;
  }) => {
    const refl = options?.nextReflection !== undefined ? options.nextReflection : reflection;
    const ints = options?.nextIntentions !== undefined ? options.nextIntentions : intentions;
    const links = options?.nextLinkedTaskIds !== undefined ? options.nextLinkedTaskIds : linkedTaskIds;
    const hasContent =
      refl.trim().length > 0 ||
      ints.some((i) => i.trim().length > 0) ||
      Boolean(existingReview) ||
      Boolean(options?.markCompleted);

    if (!hasContent) return;

    saveWeeklyReview({
      id: existingReview?.id,
      weekStartDate: reviewedWeek.weekStartDate,
      weekEndDate: reviewedWeek.weekEndDate,
      reflection: refl,
      intentions: ints,
      linkedTaskIds: links,
      completedTasksCount: weekMetrics.completedTasksCount,
      completedWorkoutsCount: weekMetrics.completedWorkoutsCount,
      habitCheckInsCount: weekMetrics.totalHabitCheckInsCount,
      completedAt: options?.markCompleted
        ? new Date().toISOString()
        : existingReview?.completedAt,
    });
  };

  // Convert a single priority intention into a linked next-week TaskItem (or update existing linked task)
  const syncIntentionToTask = (
    idx: number,
    intentionText: string,
    currentLinks: Record<number, string>
  ): Record<number, string> => {
    const trimmed = intentionText.trim();
    if (!trimmed) return currentLinks;

    const existingTaskId = currentLinks[idx];
    const existingTask = existingTaskId ? tasks.find((t) => t.id === existingTaskId) : undefined;

    if (existingTask) {
      if (existingTask.title !== trimmed || existingTask.dueDate !== nextWeekStartDate) {
        updateTask(existingTask.id, {
          title: trimmed,
          dueDate: existingTask.dueDate || nextWeekStartDate,
        });
      }
      return currentLinks;
    }

    const newTaskId = addTask({
      title: trimmed,
      description: `Weekly Review Priority #${idx + 1} (from review of ${reviewedWeek.weekStartDate} to ${reviewedWeek.weekEndDate})`,
      dueDate: nextWeekStartDate,
      priority: idx === 0 ? 'high' : 'medium',
      status: 'not_started',
      category: 'Personal',
      assignedTo: settings.ownerName || 'Me',
      isAllDay: true,
    });

    return {
      ...currentLinks,
      [idx]: newTaskId,
    };
  };

  const handleLinkSinglePriority = (idx: number) => {
    const updatedLinks = syncIntentionToTask(idx, intentions[idx], linkedTaskIds);
    setLinkedTaskIds(updatedLinks);
    persistReviewDraft({ nextLinkedTaskIds: updatedLinks });
  };

  const handleCompleteReview = () => {
    let updatedLinks = { ...linkedTaskIds };
    if (createTasksOnComplete) {
      [0, 1, 2].forEach((idx) => {
        if (intentions[idx]?.trim()) {
          updatedLinks = syncIntentionToTask(idx, intentions[idx], updatedLinks);
        }
      });
      setLinkedTaskIds(updatedLinks);
    }

    persistReviewDraft({
      nextReflection: reflection,
      nextIntentions: intentions,
      nextLinkedTaskIds: updatedLinks,
      markCompleted: true,
    });

    setActiveModal(null);
  };

  const handleSwitchWeek = (newRefDate: string) => {
    persistReviewDraft();
    loadedWeekKeyRef.current = null;
    setSelectedRefDate(newRefDate);
  };

  // Keep focus inside the dialog if a step transition unmounts the previously focused control
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    if (!dialogRef.current.contains(document.activeElement)) {
      focusFirstDialogElement(dialogRef.current);
    }
  }, [isOpen, step, dialogRef]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071A3A]/70 backdrop-blur-md animate-in fade-in">
      <div
        className="fixed inset-0"
        onClick={() => {
          persistReviewDraft();
          setActiveModal(null);
        }}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        tabIndex={-1}
        className="bg-white dark:bg-[#152238] rounded-3xl max-w-2xl w-full p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative z-10 flex flex-col outline-none"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            persistReviewDraft();
            setActiveModal(null);
          }}
          aria-label="Close weekly review"
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-5">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-[var(--accent)]' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Header & Reviewed Week Date Range Bar */}
        <div className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pr-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Weekly Review · Step {step} of 4</span>
            </div>

            {/* Exact Reviewed Week Range Selector */}
            <div
              data-testid="weekly-review-date-range"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs text-[#071A3A] dark:text-[#EDF4FF]"
            >
              <button
                type="button"
                onClick={() => handleSwitchWeek(shiftWeekDate(reviewedWeek.weekStartDate, -1))}
                aria-label="Review previous week"
                title="Previous week"
                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <Calendar className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
              <span className="font-semibold">
                {reviewedWeek.label}
              </span>
              <span className="text-[11px] font-mono text-[#526782] dark:text-[#A8B8CE]">
                ({reviewedWeek.weekStartDate} to {reviewedWeek.weekEndDate})
              </span>
              <button
                type="button"
                onClick={() => handleSwitchWeek(shiftWeekDate(reviewedWeek.weekStartDate, 1))}
                aria-label="Review next week"
                title="Next week"
                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <h2 id="review-title" className="text-xl md:text-2xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              {step === 1 && 'Celebrate Your Accomplishments'}
              {step === 2 && 'Triage Overdue & Loose Ends'}
              {step === 3 && 'Habits & Financial Check-in'}
              {step === 4 && 'Set Next Week’s Intentions'}
            </h2>
            {existingReview?.completedAt && (
              <span
                data-testid="weekly-review-saved-badge"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold shrink-0"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Saved Review</span>
              </span>
            )}
          </div>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE] mt-0.5">
            {step === 1 &&
              `Reflect on what went well during ${reviewedWeek.label} (${reviewedWeek.weekStartDate} – ${reviewedWeek.weekEndDate}).`}
            {step === 2 && 'Keep your planning loop dependable: clear, reschedule, or archive lingering items.'}
            {step === 3 && `A check of your consistency during ${reviewedWeek.shortLabel} and current spending balance.`}
            {step === 4 &&
              `Define the 3 major priorities for next week (${reviewedWeek.nextWeekLabel}: ${reviewedWeek.nextWeekStartDate} – ${reviewedWeek.nextWeekEndDate}).`}
          </p>
        </div>

        {/* Body per Step */}
        <div className="flex-1 overflow-y-auto max-h-[52vh] pr-1 space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div
                  data-testid="weekly-review-tasks-metric"
                  className="p-4 rounded-2xl bg-[var(--accent-soft)] border border-[var(--border-color)] text-center"
                >
                  <Award className="w-6 h-6 text-[var(--accent)] mx-auto mb-1" />
                  <div
                    data-testid="weekly-review-completed-tasks-count"
                    className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]"
                  >
                    {completedTasksCount}
                  </div>
                  <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">Tasks Completed</div>
                  <div className="text-[10px] text-[var(--accent)] font-medium mt-0.5">
                    {reviewedWeek.shortLabel}
                  </div>
                </div>

                <div
                  data-testid="weekly-review-workouts-metric"
                  className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 text-center"
                >
                  <CheckCircle2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mx-auto mb-1" />
                  <div
                    data-testid="weekly-review-completed-workouts-count"
                    className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]"
                  >
                    {completedWorkoutsCount}
                  </div>
                  <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">Workouts Logged</div>
                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                    {reviewedWeek.shortLabel}
                  </div>
                </div>

                <div
                  data-testid="weekly-review-habits-metric"
                  className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-center col-span-2 sm:col-span-1"
                >
                  <Flame className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto mb-1" />
                  <div
                    data-testid="weekly-review-habit-checkins-count"
                    className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]"
                  >
                    {weekMetrics.totalHabitCheckInsCount}
                  </div>
                  <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">Habit Check-Ins</div>
                  <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium mt-0.5">
                    Across {habits.length} habits in {reviewedWeek.shortLabel}
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="weekly-review-reflection"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1.5"
                >
                  Personal Reflections & Wins ({reviewedWeek.shortLabel})
                </label>
                <textarea
                  id="weekly-review-reflection"
                  value={reflection}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setReflection(nextVal);
                    persistReviewDraft({ nextReflection: nextVal });
                  }}
                  placeholder="What worked well this week? What gave you energy or peace of mind?"
                  rows={4}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-[#071A3A] dark:text-[#EDF4FF] focus:outline-none focus:border-[var(--focus-ring)]"
                />
              </div>

              {/* Saved Reviews History Strip */}
              {weeklyReviews.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] mb-2">
                    <History className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>Saved Weekly Reviews ({weeklyReviews.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {weeklyReviews.slice(0, 6).map((rev) => {
                      const isCurrent = rev.weekStartDate === reviewedWeek.weekStartDate;
                      return (
                        <button
                          key={rev.id}
                          type="button"
                          onClick={() => handleSwitchWeek(rev.weekStartDate)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] font-semibold'
                              : 'bg-white dark:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] border border-slate-200 dark:border-slate-700 hover:border-[var(--accent)]'
                          }`}
                        >
                          {rev.weekStartDate} – {rev.weekEndDate}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {overdueTasks.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[var(--accent-soft)] border border-[var(--border-color)] text-center">
                  <CheckCircle2 className="w-8 h-8 text-[var(--status-success-text)] mx-auto mb-2" />
                  <div className="font-bold text-sm text-[#071A3A] dark:text-[#EDF4FF]">
                    Zero overdue tasks!
                  </div>
                  <p className="text-xs text-[#526782] dark:text-[#A8B8CE] mt-1">
                    Your backlog is completely up-to-date.
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-xs text-[#526782] dark:text-[#A8B8CE] flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span>{overdueTasks.length} task(s) missed their original due date:</span>
                  </div>

                  <div className="space-y-2">
                    {overdueTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-semibold text-xs text-[#071A3A] dark:text-[#EDF4FF]">
                            {t.title}
                          </div>
                          <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                            Originally due {t.dueDate} · {t.category}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => rescheduleTask(t.id, todayDate)}
                            className="px-2.5 py-1 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent-soft-hover)] text-[11px] font-semibold cursor-pointer"
                          >
                            Today
                          </button>
                          <button
                            type="button"
                            onClick={() => rescheduleTask(t.id, nextWeekStartDate)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-[11px] font-semibold cursor-pointer"
                          >
                            Next Week
                          </button>
                          <button
                            type="button"
                            onClick={() => archiveTask(t.id)}
                            aria-label={`Archive task ${t.title}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                            title="Archive"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                    Money Check-In
                  </span>
                  <span className="text-xs font-mono font-bold text-[var(--accent)]">
                    {currencySymbol}{cashFlow.leftToSpend.toFixed(0)} left to spend
                  </span>
                </div>
                <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
                  Current balance is {currencySymbol}{cashFlow.actualBalance.toFixed(0)}. Keep spending within your planned allocations.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                    Active Habits ({reviewedWeek.shortLabel})
                  </span>
                  <span className="text-[11px] font-mono text-[var(--accent)]">
                    {weekMetrics.totalHabitCheckInsCount} check-ins this week
                  </span>
                </div>
                <div className="space-y-2">
                  {habits.map((h) => {
                    const weekCount = weekMetrics.habitCheckInsByHabitId[h.id] ?? 0;
                    return (
                      <div key={h.id} className="flex items-center justify-between text-xs">
                        <span className="text-[#071A3A] dark:text-[#EDF4FF] font-medium">{h.title}</span>
                        <span className="text-[#526782] dark:text-[#A8B8CE] font-mono text-[11px]">
                          {weekCount} this week ({h.checkedDates.length} total)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3" role="group" aria-labelledby="weekly-review-intentions-heading">
              <div className="flex items-center justify-between gap-2">
                <span
                  id="weekly-review-intentions-heading"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF]"
                >
                  Top 3 Intentions for Next Week ({reviewedWeek.nextWeekLabel})
                </span>
                <span className="text-[11px] font-mono text-[#526782] dark:text-[#A8B8CE]">
                  Due {nextWeekStartDate}
                </span>
              </div>

              {[0, 1, 2].map((idx) => {
                const linkedTaskId = linkedTaskIds[idx];
                const linkedTask = linkedTaskId ? tasks.find((t) => t.id === linkedTaskId) : undefined;
                const hasText = Boolean(intentions[idx]?.trim());

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={`weekly-review-intention-${idx}`}
                        className="w-6 h-6 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-xs flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        <span>{idx + 1}</span>
                        <span className="sr-only">Intention {idx + 1} for next week</span>
                      </label>
                      <input
                        id={`weekly-review-intention-${idx}`}
                        type="text"
                        aria-label={`Priority #${idx + 1} intention for next week`}
                        value={intentions[idx]}
                        onChange={(e) => {
                          const updated = [...intentions];
                          updated[idx] = e.target.value;
                          setIntentions(updated);
                          persistReviewDraft({ nextIntentions: updated });
                        }}
                        placeholder={`Priority #${idx + 1}`}
                        className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-[#071A3A] dark:text-[#EDF4FF] focus:outline-none focus:border-[var(--focus-ring)]"
                      />
                      {linkedTask ? (
                        <span
                          data-testid={`weekly-review-linked-task-badge-${idx}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold shrink-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Linked Task</span>
                        </span>
                      ) : (
                        hasText && (
                          <button
                            type="button"
                            data-testid={`weekly-review-link-task-btn-${idx}`}
                            onClick={() => handleLinkSinglePriority(idx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[var(--accent-soft)] border border-[var(--border-color)] text-[var(--accent)] hover:bg-[var(--accent-soft-hover)] text-[11px] font-semibold shrink-0 cursor-pointer"
                          >
                            <ListTodo className="w-3.5 h-3.5" />
                            <span>Add Task</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Option to turn all entered priorities into linked next-week tasks on Complete Review */}
              <div className="pt-2">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--accent-soft)] border border-[var(--border-color)]">
                  <input
                    id="weekly-review-create-linked-tasks"
                    type="checkbox"
                    checked={createTasksOnComplete}
                    onChange={(e) => setCreateTasksOnComplete(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--focus-ring)] cursor-pointer"
                  />
                  <label
                    htmlFor="weekly-review-create-linked-tasks"
                    className="text-xs text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer select-none"
                  >
                    <span className="font-semibold block">
                      Turn priorities into linked tasks for next week ({nextWeekStartDate})
                    </span>
                    <span className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                      Completing this review saves your reflection & intentions and creates Top-3 tasks for next week.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => {
                persistReviewDraft();
                setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => {
                persistReviewDraft();
                setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
              }}
              className="px-5 py-2.5 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCompleteReview}
              className="px-5 py-2.5 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete Review</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
