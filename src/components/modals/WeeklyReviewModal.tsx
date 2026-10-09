import React, { useState, useEffect, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import {
  X,
  CheckCircle2,
  Calendar,
  AlertCircle,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Archive,
  Flame,
  Award,
} from 'lucide-react';
import { getCurrencySymbol } from '../../utils/formatters';

export const WeeklyReviewModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    tasks,
    rescheduleTask,
    archiveTask,
    habits,
    cashFlow,
    settings,
    todayDate,
    workouts,
  } = usePlanner();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [reflection, setReflection] = useState('');
  const [intentions, setIntentions] = useState(['', '', '']);

  const currencySymbol = settings.currencySymbol || getCurrencySymbol(settings.currency) || '$';

  // Overdue tasks
  const overdueTasks = useMemo(() => {
    return tasks.filter((t) => !t.isArchived && t.status !== 'completed' && t.dueDate && t.dueDate < todayDate);
  }, [tasks, todayDate]);

  // Completed tasks count
  const completedTasksCount = useMemo(() => {
    return tasks.filter((t) => t.status === 'completed').length;
  }, [tasks]);

  // Completed workouts count
  const completedWorkoutsCount = useMemo(() => {
    return workouts.filter((w) => w.isCompleted).length;
  }, [workouts]);

  // Next week's Monday date
  const nextMondayDate = useMemo(() => {
    const parts = todayDate.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const day = d.getDay(); // 0 is Sun, 1 is Mon...
    const daysUntilNextMon = ((8 - day) % 7) || 7;
    d.setDate(d.getDate() + daysUntilNextMon);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [todayDate]);

  // Keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeModal === 'weekly_review') {
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, setActiveModal]);

  if (activeModal !== 'weekly_review') return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071A3A]/70 backdrop-blur-md animate-in fade-in"
    >
      <div className="bg-white dark:bg-[#152238] rounded-3xl max-w-2xl w-full p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative flex flex-col">
        {/* Close Button */}
        <button
          onClick={() => setActiveModal(null)}
          aria-label="Close weekly review"
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-[#087F83]' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#087F83] dark:text-[#38D0C5] text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Weekly Review · Step {step} of 4</span>
          </div>
          <h2 id="review-title" className="text-xl md:text-2xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            {step === 1 && 'Celebrate Your Accomplishments'}
            {step === 2 && 'Triage Overdue & Loose Ends'}
            {step === 3 && 'Habits & Financial Check-in'}
            {step === 4 && 'Set Next Week’s Intentions'}
          </h2>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            {step === 1 && 'Reflect on what went well this past cycle. Small wins compound into big change.'}
            {step === 2 && 'Keep your planning loop dependable: clear, reschedule, or archive lingering items.'}
            {step === 3 && 'A quick check of your consistency and spending balance.'}
            {step === 4 && 'Define the 3 major priorities that matter most for the upcoming week.'}
          </p>
        </div>

        {/* Body per Step */}
        <div className="flex-1 overflow-y-auto max-h-[50vh] pr-1 space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 text-center">
                  <Award className="w-6 h-6 text-[#087F83] dark:text-[#38D0C5] mx-auto mb-1" />
                  <div className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]">
                    {completedTasksCount}
                  </div>
                  <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">Tasks Completed</div>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 text-center">
                  <CheckCircle2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mx-auto mb-1" />
                  <div className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]">
                    {completedWorkoutsCount}
                  </div>
                  <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">Workouts Logged</div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-center col-span-2 sm:col-span-1">
                  <Flame className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto mb-1" />
                  <div className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]">
                    {habits.length}
                  </div>
                  <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">Habits Tracked</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1.5">
                  Personal Reflections & Wins
                </label>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder="What worked well this week? What gave you energy or peace of mind?"
                  rows={4}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-[#071A3A] dark:text-[#EDF4FF] focus:outline-none focus:border-[#087F83]"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {overdueTasks.length === 0 ? (
                <div className="p-6 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 text-center">
                  <CheckCircle2 className="w-8 h-8 text-[#087F83] dark:text-[#38D0C5] mx-auto mb-2" />
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
                            className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[#087F83] dark:text-[#38D0C5] hover:bg-teal-100 text-[11px] font-semibold cursor-pointer"
                          >
                            Today
                          </button>
                          <button
                            type="button"
                            onClick={() => rescheduleTask(t.id, nextMondayDate)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-[11px] font-semibold cursor-pointer"
                          >
                            Next Mon
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
                  <span className="text-xs font-mono font-bold text-[#087F83] dark:text-[#38D0C5]">
                    {currencySymbol}{cashFlow.leftToSpend.toFixed(0)} left to spend
                  </span>
                </div>
                <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
                  Current balance is {currencySymbol}{cashFlow.actualBalance.toFixed(0)}. Keep spending within your planned allocations.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <span className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] block mb-2">
                  Active Habits
                </span>
                <div className="space-y-2">
                  {habits.map((h) => (
                    <div key={h.id} className="flex items-center justify-between text-xs">
                      <span className="text-[#071A3A] dark:text-[#EDF4FF] font-medium">{h.title}</span>
                      <span className="text-[#526782] dark:text-[#A8B8CE] font-mono text-[11px]">
                        {h.checkedDates.length} check-ins recorded
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Top 3 Intentions for Next Week
              </label>
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#087F83] dark:text-[#38D0C5] font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={intentions[idx]}
                    onChange={(e) => {
                      const updated = [...intentions];
                      updated[idx] = e.target.value;
                      setIntentions(updated);
                    }}
                    placeholder={`Priority #${idx + 1}`}
                    className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-[#071A3A] dark:text-[#EDF4FF] focus:outline-none focus:border-[#087F83]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((prev) => (prev - 1) as any)}
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
              onClick={() => setStep((prev) => (prev + 1) as any)}
              className="px-5 py-2.5 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => setActiveModal(null)}
              className="px-5 py-2.5 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
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
