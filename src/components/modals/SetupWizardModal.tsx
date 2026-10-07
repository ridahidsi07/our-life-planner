import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import { Logo } from '../ui/Logo';
import { Cloud, Download, Sparkles, Check, ArrowRight } from 'lucide-react';
import { EditionType } from '../../types/planner';
import { getCurrencySymbol } from '../../utils/formatters';

export const SetupWizardModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    settings,
    updateSettings,
    loadSampleData,
    resetAllData,
  } = usePlanner();

  const [step, setStep] = useState<1 | 2>(1);
  const [edition, setEdition] = useState<EditionType>(settings.edition);
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  const [weekStart, setWeekStart] = useState(settings.weekStartsOn);
  const [timeZone, setTimeZone] = useState(settings.timeZone);
  const [currency, setCurrency] = useState(settings.currency);
  const [startChoice, setStartChoice] = useState<'sample' | 'empty'>('sample');

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleCompleteSetup = () => {
    updateSettings({
      ownerName: ownerName.trim() || 'Rida',
      edition,
      weekStartsOn: weekStart,
      timeZone,
      currency,
      currencySymbol: getCurrencySymbol(currency),
      hasCompletedSetup: true,
      isSampleDataActive: startChoice === 'sample',
    });

    if (startChoice === 'sample') {
      loadSampleData();
    } else {
      resetAllData();
    }

    setActiveModal(null);
  };

  return (
    <Modal
      isOpen={activeModal === 'setup'}
      onClose={() => setActiveModal(null)}
      title=""
      maxWidth="max-w-xl"
    >
      <div className="space-y-6 pt-2">
        <div className="text-center">
          <Logo size={42} showText={true} className="justify-center mb-3" />
          <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            {step === 1 ? 'Welcome to Our Life Planner' : 'How would you like to start?'}
          </h2>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE] mt-1">
            {step === 1
              ? 'Choose how you’d like to use your planner and configure defaults.'
              : 'Explore features with realistic sample data or begin with a clean slate.'}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1Submit} className="space-y-5">
            {/* Edition selection */}
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setEdition('online')}
                className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                  edition === 'online'
                    ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <Cloud className="w-5 h-5 text-[#087F83] mb-2" />
                <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Online planner
                </div>
                <div className="text-[10px] text-[#526782] mt-0.5">
                  Synchronize across your devices.
                </div>
              </div>

              <div
                onClick={() => setEdition('downloaded')}
                className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                  edition === 'downloaded'
                    ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <Download className="w-5 h-5 text-blue-600 mb-2" />
                <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Independent download
                </div>
                <div className="text-[10px] text-[#526782] mt-0.5">
                  No account or internet required.
                </div>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Your name *
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Rida"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                    Week starts on
                  </label>
                  <select
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium"
                  >
                    <option value="Monday">Monday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer shadow-xs"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            {/* Start Choice */}
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setStartChoice('sample')}
                className={`p-5 rounded-2xl border text-left cursor-pointer transition-all ${
                  startChoice === 'sample'
                    ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <Sparkles className="w-6 h-6 text-[#087F83] mb-2" />
                <div className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Try sample data
                </div>
                <div className="text-xs text-[#526782] mt-1 leading-snug">
                  Load realistic example tasks, routines, goals, budget, meals, workouts and logs.
                </div>
              </div>

              <div
                onClick={() => setStartChoice('empty')}
                className={`p-5 rounded-2xl border text-left cursor-pointer transition-all ${
                  startChoice === 'empty'
                    ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <Check className="w-6 h-6 text-slate-400 mb-2" />
                <div className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Start empty
                </div>
                <div className="text-xs text-[#526782] mt-1 leading-snug">
                  Begin with a clean slate and input your own records from scratch.
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-[11px] text-[#526782]">
              💡 <strong>Sample data can be removed anytime:</strong> When you add your own records, clicking “Remove sample data” in Settings will keep your personal records intact and only delete the samples.
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCompleteSetup}
                className="px-5 py-2.5 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer shadow-xs"
              >
                Enter planner
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
