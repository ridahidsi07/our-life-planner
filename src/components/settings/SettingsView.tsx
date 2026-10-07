import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  Download,
  Upload,
  Database,
  Trash2,
  HelpCircle,
  Mail,
  User,
  ShieldAlert,
  AlertTriangle,
  Check,
  RotateCcw,
} from 'lucide-react';
import { EditionType } from '../../types/planner';
import { getCurrencySymbol } from '../../utils/formatters';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    removeSampleData,
    resetAllData,
    setActiveModal,
  } = usePlanner();

  // Reset confirmation modal state
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');

  // Form states
  const [name, setName] = useState(settings.ownerName);
  const [weekStart, setWeekStart] = useState(settings.weekStartsOn);
  const [timeZone, setTimeZone] = useState(settings.timeZone);
  const [currency, setCurrency] = useState(settings.currency);
  const [weightUnit, setWeightUnit] = useState(settings.weightUnit);
  const [heightUnit, setHeightUnit] = useState(settings.heightUnit);
  const [waterUnit, setWaterUnit] = useState(settings.waterUnit);
  const [edition, setEdition] = useState<EditionType>(settings.edition);

  const [savedFeedback, setSavedFeedback] = useState(false);

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      ownerName: name.trim() || 'Owner',
      weekStartsOn: weekStart,
      timeZone,
      currency,
      currencySymbol: getCurrencySymbol(currency),
      weightUnit,
      heightUnit,
      waterUnit,
      edition,
    });
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateSettings({ theme });
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const handleConfirmReset = () => {
    if (resetConfirmInput.trim().toUpperCase() === 'RESET') {
      resetAllData();
      setIsResetConfirmOpen(false);
      setResetConfirmInput('');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex items-center justify-between shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Settings
          </h2>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            Personalize your experience and manage planner storage.
          </p>
        </div>

        {savedFeedback && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>Preferences saved</span>
          </div>
        )}
      </div>

      {/* 1. General Preferences Form (Board 25) */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
          <User className="w-4 h-4 text-[#087F83]" />
          <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            General preferences
          </h3>
        </div>

        <form onSubmit={handleSaveGeneral} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Owner name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Week starts on
              </label>
              <select
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
              >
                <option value="Monday">Monday</option>
                <option value="Sunday">Sunday</option>
              </select>
              <span className="text-[10px] text-[#526782] mt-1 block">
                Controls whether calendar grids, workout weeks, meal planners, and habit strips begin on Monday or Sunday.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Timezone
              </label>
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
              >
                <option value="Europe/London">Europe/London (GMT+1)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
              </select>
              <span className="text-[10px] text-[#526782] mt-1 block">
                Display & denomination setting only. Formats all budgets, bills, savings pots, and financial ledgers with {getCurrencySymbol(currency)} without altering or converting existing nominal figures.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Weight unit
              </label>
              <select
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
              >
                <option value="kg">kg (Metric)</option>
                <option value="lb">lb (Imperial)</option>
              </select>
              <span className="text-[10px] text-[#526782] mt-1 block">
                Weights are stored canonically in kg and automatically converted to your selected unit across charts, history, and draft inputs.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Height unit
              </label>
              <select
                value={heightUnit}
                onChange={(e) => setHeightUnit(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
              >
                <option value="cm">cm</option>
                <option value="in">in</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Water unit
              </label>
              <select
                value={waterUnit}
                onChange={(e) => setWaterUnit(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
              >
                <option value="ml">ml</option>
                <option value="oz">oz</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer shadow-xs"
            >
              Save preferences
            </button>
          </div>
        </form>
      </div>

      {/* 2. Appearance (Board 25) */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
          Appearance
        </h3>
        <p className="text-xs text-[#526782]">
          Choose how Our Life Planner looks across light and dark modes.
        </p>

        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'light', label: 'Light', icon: Sun },
            { id: 'dark', label: 'Dark', icon: Moon },
            { id: 'system', label: 'System', icon: Monitor },
          ].map((theme) => {
            const Icon = theme.icon;
            const isSelected = settings.theme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme.id as any)}
                className={`p-3.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#087F83] bg-teal-50 dark:bg-teal-950/40 text-[#087F83] dark:text-[#38D0C5]'
                    : 'border-slate-200 dark:border-slate-700 text-[#526782] hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{theme.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Edition Mode & Downloadable HTML (Board 24 & Section 2) */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
          Product Edition & Offline Independence
        </h3>
        <p className="text-xs text-[#526782]">
          Your purchase grants both an online synchronized edition and an independent standalone download.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            onClick={() => updateSettings({ edition: 'online' })}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              settings.edition === 'online'
                ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Online Edition
            </div>
            <div className="text-[11px] text-[#526782] mt-0.5">
              Syncs across your devices with local offline cache.
            </div>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-700">
              Active account
            </span>
          </div>

          <div
            onClick={() => updateSettings({ edition: 'downloaded' })}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              settings.edition === 'downloaded'
                ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Downloaded Offline Edition
            </div>
            <div className="text-[11px] text-[#526782] mt-0.5">
              100% independent. Works without an account or internet.
            </div>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 text-blue-700">
              Self-contained
            </span>
          </div>
        </div>

        <button
          onClick={() => setActiveModal('download_offline')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#087F83]" />
          <span>Get independent downloadable HTML bundle</span>
        </button>
      </div>

      {/* 4. Data, Backup & Reset (Board 25 & 27) */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
          Data & Backup
        </h3>
        <p className="text-xs text-[#526782]">
          Export versioned JSON backups or restore data safely.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setActiveModal('backup_restore')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
          >
            <Database className="w-4 h-4 text-[#087F83]" />
            <span>Backup & Restore Manager</span>
          </button>

          {settings.isSampleDataActive && (
            <button
              onClick={removeSampleData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Remove sample data (keeps your records)</span>
            </button>
          )}

          <button
            onClick={() => setIsResetConfirmOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-300 text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset all planner data</span>
          </button>
        </div>
      </div>

      {/* 5. Guide & Support Entry Points (Board 25 & 28) */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
          Guide & Support
        </h3>
        <p className="text-xs text-[#526782]">
          In-app tutorials, getting-started instructions and contact assistance.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setActiveModal('guide')}
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                User Guide
              </div>
              <div className="text-[11px] text-[#526782]">
                Detailed walkthrough of all 15 tools
              </div>
            </div>
            <HelpCircle className="w-4 h-4 text-[#087F83]" />
          </button>

          <button
            onClick={() => alert('Support Contact: support@ourlifeplanner.app\nAvailable Monday to Friday.')}
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                Get Support
              </div>
              <div className="text-[11px] text-[#526782]">
                Troubleshooting & contact details
              </div>
            </div>
            <Mail className="w-4 h-4 text-[#087F83]" />
          </button>
        </div>
      </div>

      {/* Full Reset Modal Safeguard (Section 4 & Board 27) */}
      <Modal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        title="Delete all planner data?"
        subtitle="This action will permanently delete all your records on this device."
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 text-rose-800 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Destructive Action:</span>
              <span>
                All tasks, routines, meals, financial ledgers, and logs will be permanently erased. Please export a backup first if you want to keep a copy.
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Type <span className="font-mono font-bold text-rose-600">RESET</span> to confirm:
            </label>
            <input
              type="text"
              value={resetConfirmInput}
              onChange={(e) => setResetConfirmInput(e.target.value)}
              placeholder="RESET"
              className="w-full px-3 py-2 rounded-xl border border-rose-300 text-xs font-mono font-bold focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsResetConfirmOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReset}
              disabled={resetConfirmInput.trim().toUpperCase() !== 'RESET'}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
            >
              Reset planner
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
