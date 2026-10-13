import React, { useState, useEffect, useRef } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import { Logo } from '../ui/Logo';
import {
  Download,
  Sparkles,
  Check,
  ArrowRight,
  CheckCircle2,
  Flame,
  Globe,
  ShieldAlert,
  Database,
} from 'lucide-react';
import { EditionType } from '../../types/planner';
import {
  AVAILABLE_CURRENCIES,
  AVAILABLE_TIMEZONES,
  getCurrencySymbol,
} from '../../utils/formatters';
import {
  MODULE_REGISTRY,
  STARTER_ENABLED_MODULES,
  DEFAULT_ENABLED_MODULES,
  migrateEnabledTools,
  isModuleOrToolEnabled,
  toggleModuleEnabledInList,
} from '../../utils/moduleRegistry';
import { detectBrowserTimeZone } from '../../utils/sampleData';

export const SetupWizardModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    settings,
    updateSettings,
    loadSampleData,
    startEmptyPlanner,
    exportBackup,
    addTask,
    addRoutine,
    tasks,
    routines,
    transactions,
    bills,
    habits,
    goals,
    todayDate,
  } = usePlanner();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const isRerun = Boolean(settings.hasCompletedSetup);
  const existingRecordCount =
    tasks.length +
    routines.length +
    transactions.length +
    bills.length +
    habits.length +
    goals.length;

  // Step 1: Profile & Locale
  const [edition, setEdition] = useState<EditionType>(settings.edition || 'online');
  const [ownerName, setOwnerName] = useState(
    settings.hasCompletedSetup ? settings.ownerName || '' : ''
  );
  const [weekStart, setWeekStart] = useState(settings.weekStartsOn || 'Monday');
  const [timeZone, setTimeZone] = useState(
    settings.hasCompletedSetup
      ? settings.timeZone || detectBrowserTimeZone()
      : detectBrowserTimeZone()
  );
  const [currency, setCurrency] = useState(settings.currency || 'USD');

  // Step 2: Tools & Starting Data — offer focused starter set on first-time setup (LP-20)
  const [enabledTools, setEnabledTools] = useState<string[]>(() =>
    settings.hasCompletedSetup
      ? migrateEnabledTools(settings.enabledTools)
      : [...STARTER_ENABLED_MODULES]
  );
  const hasCustomizedToolsRef = useRef(false);
  const [hasCustomizedTools, setHasCustomizedTools] = useState(false);
  const [startChoice, setStartChoice] = useState<'keep' | 'sample' | 'empty'>(() =>
    settings.hasCompletedSetup ? 'keep' : 'empty'
  );
  const [confirmDestructiveChange, setConfirmDestructiveChange] = useState(false);

  // Step 3: First Task & Routine (empty by default when starting empty)
  const [firstTaskTitle, setFirstTaskTitle] = useState('');
  const [firstTaskCategory, setFirstTaskCategory] = useState('Personal');
  const [firstRoutineTitle, setFirstRoutineTitle] = useState('');
  const [firstRoutineCategory, setFirstRoutineCategory] = useState('Health');

  useEffect(() => {
    if (activeModal === 'setup') {
      setStep(1);
      const rerun = Boolean(settings.hasCompletedSetup);
      setEnabledTools(
        rerun ? migrateEnabledTools(settings.enabledTools) : [...STARTER_ENABLED_MODULES]
      );
      hasCustomizedToolsRef.current = false;
      setHasCustomizedTools(false);
      setStartChoice(rerun ? 'keep' : 'empty');
      setConfirmDestructiveChange(false);
      setFirstTaskTitle('');
      setFirstRoutineTitle('');
      if (rerun) {
        setOwnerName(settings.ownerName || '');
        setTimeZone(settings.timeZone || detectBrowserTimeZone());
        setCurrency(settings.currency || 'USD');
      }
    }
  }, [activeModal, settings.enabledTools, settings.hasCompletedSetup, settings.ownerName, settings.timeZone, settings.currency]);

  const handleSelectStartChoice = (choice: 'keep' | 'sample' | 'empty') => {
    setStartChoice(choice);
    setConfirmDestructiveChange(false);
    if (!hasCustomizedToolsRef.current) {
      if (choice === 'empty') {
        setEnabledTools([...STARTER_ENABLED_MODULES]);
      } else if (choice === 'sample') {
        setEnabledTools([...DEFAULT_ENABLED_MODULES]);
      }
    }
    if (choice === 'empty' || choice === 'keep') {
      setFirstTaskTitle('');
      setFirstRoutineTitle('');
    } else if (choice === 'sample' && !isRerun) {
      setFirstTaskTitle('Plan tomorrow’s top priorities');
      setFirstRoutineTitle('Morning hydration & stretch');
    }
  };

  const toggleTool = (toolId: string) => {
    hasCustomizedToolsRef.current = true;
    setHasCustomizedTools(true);
    setEnabledTools((prev) => toggleModuleEnabledInList(prev, toolId));
  };

  const handleExportBeforeChange = () => {
    const data = exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `our-life-planner-pre-setup-backup-${todayDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const requiresDestructiveConfirmation =
    isRerun && existingRecordCount > 0 && (startChoice === 'sample' || startChoice === 'empty');

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requiresDestructiveConfirmation && !confirmDestructiveChange) {
      return;
    }
    setStep(3);
  };

  const handleCompleteSetup = () => {
    if (requiresDestructiveConfirmation && !confirmDestructiveChange) {
      return;
    }

    const finalOwnerName = ownerName.trim() || 'Me';
    const finalCurrencySymbol = getCurrencySymbol(currency);

    if (startChoice === 'empty') {
      startEmptyPlanner({
        ownerName: finalOwnerName,
        edition,
        weekStartsOn: weekStart,
        timeZone,
        currency,
        currencySymbol: finalCurrencySymbol,
        enabledTools,
        hasCompletedSetup: true,
        isSampleDataActive: false,
      });
    } else if (startChoice === 'sample') {
      loadSampleData();
      updateSettings({
        ownerName: finalOwnerName,
        edition,
        weekStartsOn: weekStart,
        timeZone,
        currency,
        currencySymbol: finalCurrencySymbol,
        enabledTools,
        hasCompletedSetup: true,
        isSampleDataActive: true,
      });
    } else {
      // 'keep' — preserve all existing records and budget settings
      updateSettings({
        ownerName: finalOwnerName,
        edition,
        weekStartsOn: weekStart,
        timeZone,
        currency,
        currencySymbol: finalCurrencySymbol,
        enabledTools,
        hasCompletedSetup: true,
      });
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
        assignedTo: finalOwnerName,
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
        assignedTo: finalOwnerName,
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
            {step === 1 && (isRerun ? 'Update Planner Setup' : 'Welcome to Our Life Planner')}
            {step === 2 && 'Personalize Your Workspace'}
            {step === 3 && 'Start Your Planning Momentum'}
          </h2>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE] mt-1 max-w-md mx-auto">
            {step === 1 && 'Set your name, edition, timezone, and local currency.'}
            {step === 2 && 'Choose the planning modules you want to see and select your data mode.'}
            {step === 3 && 'Optionally add a starter task or daily routine before launching.'}
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
                <Globe className="w-5 h-5 text-[#087F83] mb-2" />
                <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Web Browser Mode
                </div>
                <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] mt-0.5">
                  Runs in your browser with local storage and optional online account sync.
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
                  placeholder="e.g. Alex"
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
            <div role="group" aria-labelledby="setup-modules-label">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div>
                  <span id="setup-modules-label" className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] block">
                    Select Modules to Enable ({enabledTools.length} of {MODULE_REGISTRY.length})
                  </span>
                  <span className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                    Start simple with core daily tools, or enable additional life areas anytime in Settings.
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="setup-preset-starter"
                    onClick={() => {
                      hasCustomizedToolsRef.current = true;
                      setHasCustomizedTools(true);
                      setEnabledTools([...STARTER_ENABLED_MODULES]);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                      enabledTools.length === STARTER_ENABLED_MODULES.length &&
                      STARTER_ENABLED_MODULES.every((id) => enabledTools.includes(id))
                        ? 'bg-[#087F83] text-white border-[#087F83]'
                        : 'bg-slate-50 dark:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] border-slate-200 dark:border-slate-700 hover:border-[#087F83]'
                    }`}
                  >
                    Core Starter (5)
                  </button>
                  <button
                    type="button"
                    data-testid="setup-preset-all"
                    onClick={() => {
                      hasCustomizedToolsRef.current = true;
                      setHasCustomizedTools(true);
                      setEnabledTools([...DEFAULT_ENABLED_MODULES]);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                      enabledTools.length === DEFAULT_ENABLED_MODULES.length
                        ? 'bg-[#087F83] text-white border-[#087F83]'
                        : 'bg-slate-50 dark:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] border-slate-200 dark:border-slate-700 hover:border-[#087F83]'
                    }`}
                  >
                    All Modules (10)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {MODULE_REGISTRY.map((t) => {
                  const isChecked = isModuleOrToolEnabled(t.id, enabledTools);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="checkbox"
                      data-testid={`setup-module-checkbox-${t.id}`}
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
            <div className="space-y-3">
              <span id="setup-starting-content-label" className="block text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                Choose Starting Content
              </span>
              <div
                role="radiogroup"
                aria-labelledby="setup-starting-content-label"
                className={`grid grid-cols-1 ${isRerun ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}
              >
                {isRerun && (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={startChoice === 'keep'}
                    onClick={() => handleSelectStartChoice('keep')}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                      startChoice === 'keep'
                        ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Database className="w-5 h-5 text-emerald-600 mb-1.5" />
                    <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                      Keep Existing Data
                    </div>
                    <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] mt-0.5">
                      Preserve all your current tasks, routines, and records ({existingRecordCount} items).
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  role="radio"
                  data-testid="setup-preset-sample"
                  aria-checked={startChoice === 'sample'}
                  onClick={() => handleSelectStartChoice('sample')}
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
                    Explore realistic sample tasks, habits, meals, and budget. Clearly labeled and easily cleared anytime.
                  </div>
                </button>

                <button
                  type="button"
                  role="radio"
                  data-testid="setup-preset-empty"
                  aria-checked={startChoice === 'empty'}
                  onClick={() => handleSelectStartChoice('empty')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                    startChoice === 'empty'
                      ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Check className="w-5 h-5 text-slate-400 mb-1.5" />
                  <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                    Start Empty {!isRerun ? '(Recommended)' : ''}
                  </div>
                  <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] mt-0.5">
                    Begin clean with zero pre-filled sample items or demo budgets. Your own records only.
                  </div>
                </button>
              </div>

              {requiresDestructiveConfirmation && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">
                          {startChoice === 'sample'
                            ? 'Replacing existing planner records with demo data'
                            : 'Clearing existing planner records to start empty'}
                        </div>
                        <div className="text-[11px] opacity-90 mt-0.5">
                          You currently have {existingRecordCount} records in your planner. A recovery snapshot will be saved automatically, or you can export a backup first.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportBeforeChange}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-[11px] font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 shrink-0 cursor-pointer"
                    >
                      Export Backup
                    </button>
                  </div>

                  <label
                    htmlFor="setup-confirm-destructive"
                    className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200 cursor-pointer"
                  >
                    <input
                      id="setup-confirm-destructive"
                      type="checkbox"
                      checked={confirmDestructiveChange}
                      onChange={(e) => setConfirmDestructiveChange(e.target.checked)}
                      className="rounded border-amber-400 text-[#087F83] focus:ring-[#087F83]"
                    />
                    <span>
                      I understand this will {startChoice === 'sample' ? 'replace' : 'clear'} my current planner entries
                    </span>
                  </label>
                </div>
              )}
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
                disabled={requiresDestructiveConfirmation && !confirmDestructiveChange}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#087F83] disabled:opacity-50 text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer shadow-xs transition-colors"
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
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-[11px] text-[#526782] dark:text-[#A8B8CE] leading-relaxed">
              Items added here are scheduled for today and will immediately appear in your <strong>Next Up</strong> commitment on Today. Everything is stored privately and locally in your browser immediately upon launch.
            </div>

            <div className="p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/60 space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs text-[#087F83] dark:text-[#38D0C5]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Your First Task (Optional)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  aria-label="First task title"
                  value={firstTaskTitle}
                  onChange={(e) => setFirstTaskTitle(e.target.value)}
                  placeholder="Leave blank to skip, or enter a task title"
                  className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium focus:outline-none focus:border-[#087F83]"
                />
                <select
                  aria-label="First task category"
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
                <span>Your First Daily Routine (Optional)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  aria-label="First routine title"
                  value={firstRoutineTitle}
                  onChange={(e) => setFirstRoutineTitle(e.target.value)}
                  placeholder="Leave blank to skip, or enter a routine title"
                  className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium focus:outline-none focus:border-[#087F83]"
                />
                <select
                  aria-label="First routine category"
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

