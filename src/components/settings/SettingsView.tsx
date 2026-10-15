import React, { useState, useEffect } from 'react';
import { usePlanner, applyThemeToDocument } from '../../context/PlannerContext';
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
  Sparkles,
  Users,
  Pin,
  Plus,
  SlidersHorizontal,
  Palette,
} from 'lucide-react';
import { EditionType, AccentColor } from '../../types/planner';
import { SegmentedControl, SegmentedControlOption } from '../ui/SegmentedControl';
import {
  AVAILABLE_CURRENCIES,
  AVAILABLE_TIMEZONES,
  getCurrencySymbol,
} from '../../utils/formatters';
import {
  MODULE_REGISTRY,
  STARTER_ENABLED_MODULES,
  DEFAULT_ENABLED_MODULES,
  isModuleOrToolEnabled,
  isModulePinnedRaw,
} from '../../utils/moduleRegistry';

type SettingsTab = 'all' | 'general' | 'appearance' | 'household' | 'modules' | 'data';

const SETTINGS_TABS: SegmentedControlOption<SettingsTab>[] = [
  { id: 'all', label: 'All Settings' },
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'household', label: 'Household', icon: Users },
  { id: 'modules', label: 'Modules', icon: Pin },
  { id: 'data', label: 'Data & Storage', icon: Database },
];

const ACCENT_OPTIONS: { id: AccentColor; name: string; color: string; desc: string }[] = [
  { id: 'apple', name: 'Apple-inspired', color: '#0071E3', desc: 'Calm neutral canvas with Apple website blue actions' },
  { id: 'teal', name: 'Teal', color: '#087F83', desc: 'Calm emerald-cyan mineral palette' },
  { id: 'ocean', name: 'Ocean', color: '#1D6AE5', desc: 'Deep nautical blue, focused & clear' },
  { id: 'plum', name: 'Plum', color: '#7E22CE', desc: 'Refined purple-violet, creative & thoughtful' },
  { id: 'ember', name: 'Ember', color: '#D97706', desc: 'Warm amber-orange, energetic & warm' },
];

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    removeSampleData,
    loadSampleData,
    resetAllData,
    eraseAllPlannerData,
    exportBackup,
    preRestoreSnapshot,
    rollbackLastRestore,
    tasks,
    routines,
    transactions,
    bills,
    habits,
    goals,
    calendarEvents,
    setActiveModal,
    addHouseholdMember,
    removeHouseholdMember,
    toggleToolEnabled,
    toggleToolPinned,
  } = usePlanner();

  // Reset confirmation modal state
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [resetScope, setResetScope] = useState<'full_erase' | 'clear_entries'>('full_erase');

  // Reload Demo confirmation modal state (LP-04)
  const [isReloadDemoConfirmOpen, setIsReloadDemoConfirmOpen] = useState(false);

  const totalCurrentRecords =
    tasks.length +
    routines.length +
    transactions.length +
    bills.length +
    habits.length +
    goals.length +
    calendarEvents.length;

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
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberColor, setNewMemberColor] = useState('#087F83');

  // Sync state when settings update
  useEffect(() => {
    setName(settings.ownerName);
    setWeekStart(settings.weekStartsOn);
    setTimeZone(settings.timeZone);
    setCurrency(settings.currency);
    setWeightUnit(settings.weightUnit);
    setHeightUnit(settings.heightUnit);
    setWaterUnit(settings.waterUnit);
    setEdition(settings.edition);
  }, [settings]);

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
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const [activeTab, setActiveTab] = useState<SettingsTab>('all');
  const currentAccent: AccentColor = settings.accentColor || 'teal';

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateSettings({ theme });
    applyThemeToDocument(theme, currentAccent);
  };

  const handleAccentChange = (accent: AccentColor) => {
    updateSettings({ accentColor: accent });
    applyThemeToDocument(settings.theme, accent);
  };

  const handleExportCurrentBackup = () => {
    const data = exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `our-life-planner-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConfirmReloadDemo = () => {
    loadSampleData();
    setIsReloadDemoConfirmOpen(false);
  };

  const handleConfirmReset = () => {
    if (resetConfirmInput.trim().toUpperCase() === 'RESET') {
      if (resetScope === 'full_erase') {
        eraseAllPlannerData();
      } else {
        resetAllData();
      }
      setIsResetConfirmOpen(false);
      setResetConfirmInput('');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex items-center justify-between shadow-2xs">
        <div>
          <h2 data-testid="settings-heading" className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
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

      {/* Local Section Navigation */}
      <div className="overflow-x-auto pb-1 -mt-2">
        <SegmentedControl<SettingsTab>
          options={SETTINGS_TABS}
          value={activeTab}
          onChange={(tab) => setActiveTab(tab)}
          ariaLabel="Settings sections"
          idPrefix="settings-section-tab"
        />
      </div>

      {/* 1. General Preferences Form (Board 25) */}
      {(activeTab === 'all' || activeTab === 'general') && (
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A] gap-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              General preferences & Account
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setActiveModal('account')}
            className="min-h-[44px] sm:min-h-9 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)] hover:opacity-90 text-xs font-semibold cursor-pointer transition-colors self-start sm:self-auto"
          >
            <span>Manage Profile & Local Storage</span>
          </button>
        </div>

        <form onSubmit={handleSaveGeneral} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="settings-owner-name"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Owner name
              </label>
              <input
                id="settings-owner-name"
                type="text"
                required
                aria-label="Owner name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] sm:min-h-9 px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-[#071A3A] dark:text-[#EDF4FF] text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="settings-week-start"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Week starts on
              </label>
              <select
                id="settings-week-start"
                aria-label="Week starts on"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value as any)}
                className="w-full min-h-[44px] sm:min-h-9 px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-[#071A3A] dark:text-[#EDF4FF] text-xs font-medium"
              >
                <option value="Monday">Monday</option>
                <option value="Sunday">Sunday</option>
              </select>
              <span className="text-[10px] text-[#526782] dark:text-[#A8B8CE] mt-1 block">
                Controls whether calendar grids, workout weeks, meal planners, and habit strips begin on Monday or Sunday.
              </span>
            </div>

            <div>
              <label
                htmlFor="settings-timezone"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Timezone
              </label>
              <select
                id="settings-timezone"
                aria-label="Timezone"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full min-h-[44px] sm:min-h-9 px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
              >
                {AVAILABLE_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="settings-currency"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Currency
              </label>
              <select
                id="settings-currency"
                aria-label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full min-h-[44px] sm:min-h-9 px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
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
                htmlFor="settings-weight-unit"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Weight unit
              </label>
              <select
                id="settings-weight-unit"
                aria-label="Weight unit"
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value as any)}
                className="w-full min-h-[44px] sm:min-h-9 px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
              >
                <option value="kg">kg (Metric)</option>
                <option value="lb">lb (Imperial)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="settings-height-unit"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Height unit
              </label>
              <select
                id="settings-height-unit"
                aria-label="Height unit"
                value={heightUnit}
                onChange={(e) => setHeightUnit(e.target.value as any)}
                className="w-full min-h-[44px] sm:min-h-9 px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
              >
                <option value="cm">cm</option>
                <option value="in">in</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="settings-water-unit"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Water unit
              </label>
              <select
                id="settings-water-unit"
                aria-label="Water unit"
                value={waterUnit}
                onChange={(e) => setWaterUnit(e.target.value as any)}
                className="w-full min-h-[44px] sm:min-h-9 px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
              >
                <option value="ml">ml</option>
                <option value="oz">oz</option>
              </select>
            </div>
          </div>

          <details
            data-testid="settings-unit-advanced-details"
            className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 px-3.5 py-2.5 text-xs"
          >
            <summary className="font-semibold text-[#526782] dark:text-[#A8B8CE] cursor-pointer select-none">
              Advanced details: Unit conversion &amp; currency behavior
            </summary>
            <div className="mt-2 space-y-1.5 text-[11px] text-[#526782] dark:text-[#A8B8CE] leading-relaxed">
              <p>
                <strong>Currency display ({getCurrencySymbol(currency)} / {currency}):</strong> Updates the symbol and code displayed across your budget, bills, transactions, and savings pots. Existing figures are retained nominally without exchange-rate conversion.
              </p>
              <p>
                <strong>Weight &amp; body units:</strong> Weight readings are stored canonically in kg and automatically converted to your selected unit ({weightUnit}) across charts, history, and draft inputs.
              </p>
            </div>
          </details>

          <div className="pt-2 flex items-center justify-end gap-3">
            {savedFeedback && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>Preferences saved</span>
              </div>
            )}
            <button
              type="submit"
              className="min-h-[44px] sm:min-h-9 px-4 py-2 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold cursor-pointer shadow-xs"
            >
              Save preferences
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Household Members Manager */}
      {(activeTab === 'all' || activeTab === 'household') && (
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
          <Users className="w-4 h-4 text-[var(--accent)]" />
          <div>
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Household Members & Assignees
            </h3>
            <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              Assign tasks, chores, and routines to specific household members with custom colors.
            </p>
          </div>
        </div>

        {/* Add Member Row */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            aria-label="New household member name"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            placeholder="Member name (e.g. Sarah, Alex)"
            className="flex-1 min-w-[180px] min-h-[44px] sm:min-h-9 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-[#071A3A] dark:text-[#EDF4FF] text-xs font-medium focus:outline-none focus:border-[var(--accent)]"
          />
          <div className="flex items-center gap-1">
            {['#087F83', '#3B82F6', '#8B5CF6', '#F59E0B', '#F43F5E', '#10B981'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewMemberColor(c)}
                aria-label={`Select color ${c}`}
                aria-pressed={newMemberColor === c}
                className="min-w-[44px] min-h-[44px] sm:min-w-8 sm:min-h-8 p-2 rounded-full flex items-center justify-center cursor-pointer"
              >
                <span
                  className={`w-6 h-6 rounded-full transition-transform ${
                    newMemberColor === c ? 'scale-125 ring-2 ring-offset-2 ring-[var(--accent)]' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (newMemberName.trim()) {
                addHouseholdMember(newMemberName, newMemberColor);
                setNewMemberName('');
              }
            }}
            disabled={!newMemberName.trim()}
            className="min-h-[44px] sm:min-h-9 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Member</span>
          </button>
        </div>

        {/* Existing Members */}
        <div className="flex flex-wrap gap-2 pt-2">
          {(!settings.householdMembers || settings.householdMembers.length === 0) ? (
            <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              No household members added yet. Tasks will be unassigned or assigned to you.
            </p>
          ) : (
            settings.householdMembers.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 pl-3 pr-1.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                <span className="text-[#071A3A] dark:text-[#EDF4FF]">{m.name}</span>
                <button
                  type="button"
                  onClick={() => removeHouseholdMember(m.id)}
                  aria-label={`Remove household member ${m.name}`}
                  className="min-w-[44px] min-h-[44px] sm:min-w-7 sm:min-h-7 p-1.5 rounded-md flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      )}

      {/* Modules: Tool Customization & Pinned Favorites */}
      {(activeTab === 'all' || activeTab === 'modules') && (
        <>
          <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[var(--accent)]" />
            <div>
              <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                Module Customization & Pinned Favorites
              </h3>
              <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
                Hide tools you don't use to keep navigation calm, and pin your daily favorites to the top.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="settings-preset-starter"
              onClick={() => updateSettings({ enabledTools: [...STARTER_ENABLED_MODULES] })}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] hover:border-[var(--accent)] cursor-pointer transition-colors"
            >
              Core Starter (5)
            </button>
            <button
              type="button"
              data-testid="settings-preset-all"
              onClick={() => updateSettings({ enabledTools: [...DEFAULT_ENABLED_MODULES] })}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] hover:border-[var(--accent)] cursor-pointer transition-colors"
            >
              All Modules (10)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODULE_REGISTRY.map((tool) => {
            const isEnabled = isModuleOrToolEnabled(tool.id, settings.enabledTools);
            const isPinned = isModulePinnedRaw(tool.id, settings.pinnedTools);
            return (
              <div
                key={tool.id}
                data-testid={`module-card-${tool.id}`}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between gap-3"
              >
                <div className="truncate">
                  <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] truncate">
                    {tool.name}
                  </div>
                  <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] truncate">
                    {tool.desc}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    data-testid={`module-pin-${tool.id}`}
                    onClick={() => toggleToolPinned(tool.id)}
                    aria-pressed={isPinned}
                    aria-label={
                      isPinned
                        ? `Unpin ${tool.name} from favorites`
                        : `Pin ${tool.name} to favorites`
                    }
                    className={`min-w-[44px] min-h-[44px] sm:min-w-8 sm:min-h-8 p-2 rounded-lg flex items-center justify-center text-xs font-semibold cursor-pointer transition-colors ${
                      isPinned
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700/70 dark:hover:bg-amber-900/80'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/70 border border-transparent'
                    }`}
                    title={
                      !isEnabled
                        ? `Module ${tool.name} is currently hidden (enable to show in Favorites)`
                        : isPinned
                        ? `Unpin ${tool.name} from favorites`
                        : `Pin ${tool.name} to favorites`
                    }
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    data-testid={`module-toggle-${tool.id}`}
                    onClick={() => toggleToolEnabled(tool.id)}
                    aria-pressed={isEnabled}
                    aria-label={`${tool.name}: ${isEnabled ? 'Enabled' : 'Hidden'}`}
                    className={`min-h-[44px] sm:min-h-8 px-3 py-1.5 rounded-lg flex items-center justify-center text-[11px] font-bold cursor-pointer transition-colors ${
                      isEnabled
                        ? 'bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--border-color)] hover:opacity-90'
                        : 'bg-slate-200 text-slate-700 border border-slate-300 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
                    }`}
                  >
                    {isEnabled ? 'Enabled' : 'Hidden'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today Screen Display & Calm Mode Defaults */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
          <SlidersHorizontal className="w-4 h-4 text-[var(--accent)]" />
          <div>
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Today Screen Widgets & Calm Layout
            </h3>
            <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              Configure which summary cards appear on your Today dashboard.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: 'finance', label: 'Money & Left to Spend Summary' },
            { key: 'health', label: 'Health, Workout & Weight Summary' },
            { key: 'habits', label: 'Daily Rhythm & Habits Strip' },
            { key: 'meals', label: 'Planned Meals on Today Schedule' },
          ].map((sec) => {
            const currentVal = settings.todayVisibleSections
              ? (settings.todayVisibleSections as any)[sec.key] !== false
              : true;
            return (
              <label
                key={sec.key}
                className="min-h-[44px] flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-xs font-medium cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={currentVal}
                  onChange={(e) => {
                    const next = {
                      ...(settings.todayVisibleSections || {}),
                      [sec.key]: e.target.checked,
                    };
                    updateSettings({ todayVisibleSections: next });
                  }}
                  className="w-4 h-4 rounded text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <span className="text-[#071A3A] dark:text-[#EDF4FF]">{sec.label}</span>
              </label>
            );
          })}
        </div>
      </div>
      </>
      )}

      {/* 2. Appearance & Accent Themes */}
      {(activeTab === 'all' || activeTab === 'appearance') && (
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Appearance &amp; Themes
            </h3>
            <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              Choose how Our Life Planner looks across light and dark modes, and select your preferred accent theme.
            </p>
          </div>

          <div className="space-y-2">
            <div className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
              Color Mode
            </div>
            <div role="radiogroup" aria-label="Theme preference" className="grid grid-cols-3 gap-3">
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
                    type="button"
                    role="radio"
                    data-testid={`settings-theme-${theme.id}`}
                    aria-checked={isSelected}
                    aria-label={`${theme.label} mode`}
                    onClick={() => handleThemeChange(theme.id as any)}
                    className={`min-h-[44px] p-3.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]'
                        : 'border-slate-200 dark:border-slate-700 text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{theme.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color Theme Radiogroup */}
          <div className="space-y-3 pt-4 border-t border-[#E2E8F0] dark:border-[#1E2D4A]">
            <div>
              <div className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                Accent Color Theme
              </div>
              <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                Coordinated light and dark roles for navigation, primary buttons, charts, and focus highlights.
              </p>
            </div>

            <div role="radiogroup" aria-label="Accent color theme" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACCENT_OPTIONS.map((accent) => {
                const isSelected = currentAccent === accent.id;
                return (
                  <button
                    key={accent.id}
                    type="button"
                    role="radio"
                    data-testid={`settings-accent-${accent.id}`}
                    aria-checked={isSelected}
                    aria-label={`${accent.name} accent theme: ${accent.desc}`}
                    onClick={() => handleAccentChange(accent.id)}
                    className={`min-h-[48px] p-3 rounded-xl border flex items-center gap-3 text-xs font-semibold cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[#071A3A] dark:text-[#EDF4FF]'
                        : 'border-slate-200 dark:border-slate-700 text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                    style={
                      isSelected
                        ? { borderColor: 'var(--accent)', backgroundColor: 'var(--accent-soft)' }
                        : undefined
                    }
                  >
                    <span
                      className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center shadow-xs transition-transform"
                      style={{ backgroundColor: accent.color }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <div className="text-left flex-1 truncate">
                      <div className="font-bold text-[#071A3A] dark:text-[#EDF4FF] truncate">{accent.name}</div>
                      <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] font-normal truncate">{accent.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Accent Tokens Preview */}
            <div className="mt-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-2">
              <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] flex items-center gap-2">
                <span>Theme tokens active ({currentAccent.toUpperCase()})</span>
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
                  style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
                >
                  Active badge
                </span>
              </div>
              <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                Semantic warning, error, and success indicators maintain strict meanings. Accent color tints interactive surfaces, active indicators, and charts.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                  style={{
                    backgroundColor: 'var(--btn-primary-bg)',
                    color: 'var(--btn-primary-fg)',
                  }}
                >
                  Primary button
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                  style={{
                    backgroundColor: 'var(--btn-tonal-bg)',
                    color: 'var(--btn-tonal-fg)',
                    borderColor: 'var(--btn-tonal-border)',
                  }}
                >
                  Tonal button
                </button>
                <div className="flex-1 min-w-[120px] h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full w-2/3" style={{ backgroundColor: 'var(--accent)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Edition Mode & Downloadable HTML (Board 24 & Section 2) */}
      {(activeTab === 'all' || activeTab === 'general') && (
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Product Edition & Offline Independence
          </h3>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            Choose how you interact with Our Life Planner: in your web browser with local storage, or as an independent downloadable HTML file.
          </p>

          <div role="radiogroup" aria-label="Product edition preference" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              role="radio"
              aria-checked={settings.edition === 'online'}
              aria-label="Web Browser Edition: Runs in your browser with private local device storage"
              onClick={() => updateSettings({ edition: 'online' })}
              className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                settings.edition === 'online'
                  ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                Web Browser Edition
              </div>
              <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE] mt-0.5">
                Runs in your web browser with private local browser storage.
              </div>
              <span className="inline-block mt-2 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                Local browser storage
              </span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={settings.edition === 'downloaded'}
              aria-label="Standalone Offline Bundle: 100% independent single-file HTML app"
              onClick={() => updateSettings({ edition: 'downloaded' })}
              className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                settings.edition === 'downloaded'
                  ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                Standalone Offline Bundle
              </div>
              <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE] mt-0.5">
                100% independent. Works without an internet connection.
              </div>
              <span className="inline-block mt-2 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                Self-contained file
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveModal('download_offline')}
            className="min-h-[44px] sm:min-h-9 flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4 text-[var(--accent)]" />
            <span>Get independent downloadable HTML bundle</span>
          </button>
        </div>
      )}

      {/* 4. Data, Backup & Reset (Board 25 & 27) */}
      {(activeTab === 'all' || activeTab === 'data') && (
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Data & Backup
          </h3>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            Export versioned JSON backups, restore data safely, or manage planner resets.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveModal('backup_restore')}
              className="min-h-[44px] sm:min-h-9 flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer"
            >
              <Database className="w-4 h-4 text-[var(--accent)]" />
              <span>Backup & Restore Manager</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('setup')}
              className="min-h-[44px] sm:min-h-9 flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[var(--accent)]" />
              <span>Re-run Setup Wizard</span>
            </button>

            {settings.isSampleDataActive ? (
              <button
                type="button"
                onClick={removeSampleData}
                className="min-h-[44px] sm:min-h-9 flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-300 dark:border-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove sample data (keeps your records)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsReloadDemoConfirmOpen(true)}
                className="min-h-[44px] sm:min-h-9 flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--accent)] text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-subtle)] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Demo / Sample Data</span>
              </button>
            )}

            {preRestoreSnapshot && (
              <button
                type="button"
                onClick={() => rollbackLastRestore()}
                className="min-h-[44px] sm:min-h-9 flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-300 dark:border-indigo-800 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                title={`Restore snapshot saved at ${preRestoreSnapshot.savedAt}`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Undo Last Restore / Demo Reload</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setResetScope('full_erase');
                setIsResetConfirmOpen(true);
              }}
              className="min-h-[44px] sm:min-h-9 flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset all planner data</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Guide & Support Entry Points (Board 25 & 28) */}
      {(activeTab === 'all' || activeTab === 'general') && (
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Guide & Support
          </h3>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            In-app tutorials, getting-started instructions and contact assistance.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setActiveModal('guide')}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  User Guide
                </div>
                <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                  Detailed walkthrough of all 15 tools
                </div>
              </div>
              <HelpCircle className="w-4 h-4 text-[var(--accent)]" />
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('support')}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Contact Support
                </div>
                <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                  Direct email contact, diagnostics &amp; recovery help
                </div>
              </div>
              <Mail className="w-4 h-4 text-[var(--accent)]" />
            </button>
          </div>
        </div>
      )}

      {/* Reload Demo Confirmation Modal Safeguard (LP-04) */}
      <Modal
        isOpen={isReloadDemoConfirmOpen}
        onClose={() => setIsReloadDemoConfirmOpen(false)}
        title="Reload Demo / Sample Data?"
        subtitle="Confirm before replacing your current planner items with demo fixtures."
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-bold block">Replace Current Entries with Demo Data:</span>
              <span>
                You currently have <strong>{totalCurrentRecords}</strong> active records ({tasks.length} tasks, {routines.length} routines, {transactions.length} transactions, {bills.length} bills, {habits.length} habits). Reloading demo data will replace these collections with the sample dataset. An automatic pre-restore recovery snapshot will be saved so you can undo this action.
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={handleExportCurrentBackup}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[var(--accent)] hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Current Backup First</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsReloadDemoConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-reload-demo-btn"
                onClick={handleConfirmReloadDemo}
                className="px-4 py-2 rounded-xl bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover-bg)] text-[var(--btn-primary-fg)] text-xs font-semibold cursor-pointer"
              >
                Confirm &amp; Load Demo Data
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Full Reset / Erase Modal Safeguard (LP-07) */}
      <Modal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        title="Reset or Erase Planner Data?"
        subtitle="Choose whether to clear planner entries only or perform a full device erase."
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div>
              <span className="font-bold block">Destructive Action:</span>
              <span>
                {resetScope === 'full_erase'
                  ? 'Full Device Erase permanently removes all planner collections, profile settings, cloud sessions, and recovery snapshots from this browser.'
                  : 'Clear Planner Entries removes all tasks, routines, meals, financial ledgers, and health logs while keeping your profile settings and saving a pre-restore recovery snapshot.'}
              </span>
            </div>
          </div>

          <div role="radiogroup" aria-label="Reset scope" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              role="radio"
              aria-checked={resetScope === 'full_erase'}
              onClick={() => setResetScope('full_erase')}
              className={`p-3 rounded-xl border text-left text-xs cursor-pointer ${
                resetScope === 'full_erase'
                  ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/30'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                Full Device Erase (All Data &amp; Snapshots)
              </div>
              <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE] mt-0.5">
                Clears all personal records, settings, cloud session, and recovery snapshots.
              </div>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={resetScope === 'clear_entries'}
              onClick={() => setResetScope('clear_entries')}
              className={`p-3 rounded-xl border text-left text-xs cursor-pointer ${
                resetScope === 'clear_entries'
                  ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                Clear Entries Only (Keep Settings)
              </div>
              <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE] mt-0.5">
                Empties all collections and budget numbers; keeps profile &amp; recovery snapshot.
              </div>
            </button>
          </div>

          <div>
            <label htmlFor="reset-confirm-input" className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Type <span className="font-mono font-bold text-rose-600 dark:text-rose-400">RESET</span> to confirm:
            </label>
            <input
              id="reset-confirm-input"
              type="text"
              aria-label="Type RESET to confirm deletion"
              value={resetConfirmInput}
              onChange={(e) => setResetConfirmInput(e.target.value)}
              placeholder="RESET"
              className="w-full px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-[#152238] text-xs font-mono font-bold text-[#071A3A] dark:text-[#EDF4FF] focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
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

