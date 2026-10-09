import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import { Logo } from '../ui/Logo';
import {
  Cloud,
  Download,
  Sparkles,
  Check,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Calendar,
  Flame,
  Globe,
  Sliders,
} from 'lucide-react';
import { EditionType } from '../../types/planner';
import {
  AVAILABLE_CURRENCIES,
  AVAILABLE_TIMEZONES,
  getCurrencySymbol,
} from '../../utils/formatters';

const DEFAULT_TOOLS = [
  { id: 'today', name: 'Today & Next Up', desc: 'Unified daily schedule & capture', category: 'core' },
  { id: 'tasks', name: 'Tasks & Projects', desc: 'Prioritized actions & all-day backlog', category: 'core' },
  { id: 'calendar', name: 'Calendar Schedule', desc: 'Visual month & week time-blocks', category: 'core' },
  { id: 'routines', name: 'Recurring Routines', desc: 'Daily, weekly & forgiving rituals', category: 'core' },
  { id: 'habits', name: 'Habit Consistency', desc: 'Daily rhythm & streak tracker', category: 'growth' },
  { id: 'goals', name: 'Milestone Goals', desc: 'Long-term goals with step breakdowns', category: 'growth' },
  { id: 'inbox', name: 'Brain Dump Inbox', desc: 'Quick capture before triaging', category: 'growth' },
  { id: 'money', name: 'Money & Budgets', desc: 'Cash flow, bills, savings pots & debts', category: 'life' },
  { id: 'food', name: 'Meals & Groceries', desc: 'Weekly menu planning & smart list', category: 'life' },
  { id: 'body', name: 'Health & Hydration', desc: 'Workouts, weight metrics & water log', category: 'life' },
];

export const SetupWizardModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    settings,
    updateSettings,
    loadSampleData,
    resetAllData,
    addTask,
    addRoutine,
    todayDate,
  } = usePlanner();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Profile & Locale
  const [edition, setEdition] = useState<EditionType>(settings.edition || 'online');
  const [ownerName, setOwnerName] = useState(settings.ownerName || '');
  const [weekStart, setWeekStart] = useState(settings.weekStartsOn || 'Monday');
  const [timeZone, setTimeZone] = useState(settings.timeZone || 'Africa/Casablanca');
  const [currency, setCurrency] = useState(settings.currency || 'MAD');

  // Step 2: Tools & Starting Data
  const [enabledTools, setEnabledTools] = useState<string[]>(
    settings.enabledTools || DEFAULT_TOOLS.map((t) => t.id)
  );
  const [startChoice, setStartChoice] = useState<'sample' | 'empty'>('sample');

  // Step 3: First Task & Routine
  const [firstTaskTitle, setFirstTaskTitle] = useState('Plan tomorrow’s top priorities');
  const [firstTaskCategory, setFirstTaskCategory] = useState('Personal');
  const [firstRoutineTitle, setFirstRoutineTitle] = useState('Morning hydration & stretch');
  const [firstRoutineCategory, setFirstRoutineCategory] = useState('Health');

  const toggleTool = (toolId: string) => {
    setEnabledTools((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId]
    );
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(3);
  };

  const handleCompleteSetup = () => {
    const finalCurrencySymbol = getCurrencySymbol(currency);
    updateSettings({
      ownerName: ownerName.trim() || 'Planner User',
      edition,
      weekStartsOn: weekStart,
      timeZone,
      currency,
      currencySymbol: finalCurrencySymbol,
      enabledTools,
      hasCompletedSetup: true,
      isSampleDataActive: startChoice === 'sample',
    });

    if (startChoice === 'sample') {
      loadSampleData();
    } else {
      resetAllData();
    }

    // Add first task if entered
    if (firstTaskTitle.trim()) {
      addTask({
        title: firstTaskTitle.trim(),
        category: firstTaskCategory,
        priority: 'high',
        status: 'not_started',
        dueDate: todayDate,
        isAllDay: true,
        assignedTo: ownerName.trim() || 'Me',
      });
    }

    // Add first routine if entered
    if (firstRoutineTitle.trim()) {
      addRoutine({
        title: firstRoutineTitle.trim(),
        category: firstRoutineCategory,
        interval: 'daily',
        priority: 'medium',
        isPaused: false,
        startDate: todayDate,
        startTime: '08:00',
        assignedTo: ownerName.trim() || 'Me',
      });
    }

    setActiveModal(null);
  };

  return (
    <Modal
      isOpen={activeModal === 'setup'}
      onClose={() => setActiveModal(null)}
      title=""
      ariaLabel="Setup Wizard"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 pt-2">
        {/* Step dots */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step
                  ? 'w-8 bg-[#087F83]'
                  : s < step
                  ? 'w-4 bg-teal-400'
                  : 'w-4 bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        <div className="text-center">
          <Logo size={40} showText={true} className="justify-center mb-2" />
          <h2 className="text-xl md:text-2xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            {step === 1 && 'Welcome to Our Life Planner'}
            {step === 2 && 'Personalize Your Workspace'}
            {step === 3 && 'Start Your Planning Momentum'}
          </h2>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE] mt-1 max-w-md mx-auto">
            {step === 1 && 'Set your name, edition, timezone, and local currency.'}
            {step === 2 && 'Choose the planning modules you want to see and select your starting data.'}
            {step === 3 && 'Create your very first task and daily routine to start off strong.'}
          </p>
        </div>

        {/* STEP 1: Profile & Locale */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-5">
            {/* Edition Selection */}
            <div role="radiogroup" aria-label="Planner edition" className="grid grid-cols-2 gap-3">
              <button
                type="button"
                role="radio"
                aria-checked={edition === 'online'}
                onClick={() => setEdition('online')}
                className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                  edition === 'online'
                    ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <Cloud className="w-5 h-5 text-[#087F83] mb-2" />
                <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Online Planner
                </div>
                <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] mt-0.5">
                  Synchronize seamlessly across all your devices.
                </div>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={edition === 'downloaded'}
                onClick={() => setEdition('downloaded')}
                className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                  edition === 'downloaded'
                    ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <Download className="w-5 h-5 text-blue-600 mb-2" />
                <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Independent Download
                </div>
                <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] mt-0.5">
                  Runs 100% locally. Zero server account required.
                </div>
              </button>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="setup-owner-name"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                >
                  Your Name *
                </label>
                <input
                  id="setup-owner-name"
                  type="text"
                  required
                  aria-label="Your name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Rida"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium focus:outline-none focus:border-[#087F83]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="setup-currency"
                    className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                  >
                    Currency
                  </label>
                  <select
                    id="setup-currency"
                    aria-label="Currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium focus:outline-none focus:border-[#087F83]"
                  >
                    {AVAILABLE_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol}) – {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="setup-timezone"
                    className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                  >
                    Timezone & Locale
                  </label>
                  <select
                    id="setup-timezone"
                    aria-label="Timezone and locale"
                    value={timeZone}
                    onChange={(e) => setTimeZone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium focus:outline-none focus:border-[#087F83]"
                  >
                    {AVAILABLE_TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="setup-week-start"
                    className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                  >
                    Week Starts On
                  </label>
                  <select
                    id="setup-week-start"
                    aria-label="Week starts on"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium focus:outline-none focus:border-[#087F83]"
                  >
                    <option value="Monday">Monday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer shadow-xs transition-colors"
              >
                <span>Choose Tools & Data</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Tool Selection & Start Choice */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Select Modules to Enable
                </label>
                <span className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                  (You can customize this anytime in Settings)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {DEFAULT_TOOLS.map((t) => {
                  const isChecked = enabledTools.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="checkbox"
                      aria-checked={isChecked}
                      onClick={() => toggleTool(t.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-colors cursor-pointer ${
                        isChecked
                          ? 'border-[#087F83] bg-teal-50/40 dark:bg-teal-950/20'
                          : 'border-slate-200 dark:border-slate-700 opacity-60'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 ${
                          isChecked ? 'bg-[#087F83] text-white' : 'border border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] truncate">
                          {t.name}
                        </div>
                        <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] truncate">
                          {t.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Starting Dataset */}
            <div>
              <label className="block text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-2">
                Choose Starting Content
              </label>
              <div role="radiogroup" aria-label="Starting dataset choice" className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  role="radio"
                  aria-checked={startChoice === 'sample'}
                  onClick={() => setStartChoice('sample')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                    startChoice === 'sample'
                      ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Sparkles className="w-5 h-5 text-[#087F83] mb-1.5" />
                  <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                    Try Demo Data
                  </div>
                  <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] mt-0.5">
                    Explore realistic sample tasks, habits, meals, and budget.
                  </div>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={startChoice === 'empty'}
                  onClick={() => setStartChoice('empty')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                    startChoice === 'empty'
                      ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Check className="w-5 h-5 text-slate-400 mb-1.5" />
                  <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                    Start Empty
                  </div>
                  <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] mt-0.5">
                    Begin clean with zero pre-filled sample items.
                  </div>
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer shadow-xs transition-colors"
              >
                <span>Add First Commitments</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Create First Task and Routine */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/60 space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs text-[#087F83] dark:text-[#38D0C5]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Your First Task</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={firstTaskTitle}
                  onChange={(e) => setFirstTaskTitle(e.target.value)}
                  placeholder="Task title"
                  className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium focus:outline-none focus:border-[#087F83]"
                />
                <select
                  value={firstTaskCategory}
                  onChange={(e) => setFirstTaskCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium focus:outline-none focus:border-[#087F83]"
                >
                  <option value="Personal">Personal</option>
                  <option value="Work">Work</option>
                  <option value="Home">Home</option>
                  <option value="Finance">Finance</option>
                </select>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/60 space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs text-indigo-600 dark:text-indigo-400">
                <Flame className="w-4 h-4" />
                <span>Your First Daily Routine</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={firstRoutineTitle}
                  onChange={(e) => setFirstRoutineTitle(e.target.value)}
                  placeholder="Routine title"
                  className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium focus:outline-none focus:border-[#087F83]"
                />
                <select
                  value={firstRoutineCategory}
                  onChange={(e) => setFirstRoutineCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium focus:outline-none focus:border-[#087F83]"
                >
                  <option value="Health">Health</option>
                  <option value="Morning">Morning</option>
                  <option value="Evening">Evening</option>
                  <option value="Productivity">Productivity</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCompleteSetup}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer shadow-xs transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>Launch My Planner</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
