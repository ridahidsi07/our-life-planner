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
} from 'lucide-react';
import { EditionType } from '../../types/planner';
import {
  AVAILABLE_CURRENCIES,
  AVAILABLE_TIMEZONES,
  getCurrencySymbol,
} from '../../utils/formatters';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    removeSampleData,
    loadSampleData,
    resetAllData,
    setActiveModal,
    addHouseholdMember,
    removeHouseholdMember,
    toggleToolEnabled,
    toggleToolPinned,
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

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateSettings({ theme });
    applyThemeToDocument(theme);
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A] gap-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#087F83]" />
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              General preferences & Account
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setActiveModal('account')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-[#087F83] dark:text-[#38D0C5] hover:bg-teal-100 text-xs font-semibold cursor-pointer transition-colors self-start sm:self-auto"
          >
            <span>Manage Account & Cloud Sync</span>
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
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
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
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
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
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
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
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
              >
                {AVAILABLE_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) – {c.label}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-[#526782] dark:text-[#A8B8CE] mt-1 block leading-relaxed">
                <strong>Display &amp; denomination setting only:</strong> Updates the currency symbol ({getCurrencySymbol(currency)}) and code ({currency}) displayed across your budget, bills, transactions, and savings pots. Existing figures are retained nominally (no automatic currency or exchange-rate conversion is performed).
              </span>
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
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
              >
                <option value="kg">kg (Metric)</option>
                <option value="lb">lb (Imperial)</option>
              </select>
              <span className="text-[10px] text-[#526782] dark:text-[#A8B8CE] mt-1 block">
                Weights are stored canonically in kg and automatically converted to your selected unit across charts, history, and draft inputs.
              </span>
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
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
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
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
              >
                <option value="ml">ml</option>
                <option value="oz">oz</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            {savedFeedback && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>Preferences saved</span>
              </div>
            )}
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer shadow-xs"
            >
              Save preferences
            </button>
          </div>
        </form>
      </div>

      {/* Household Members Manager */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
          <Users className="w-4 h-4 text-[#087F83]" />
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
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            placeholder="Member name (e.g. Sarah, Alex)"
            className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium focus:outline-none focus:border-[#087F83]"
          />
          <div className="flex items-center gap-1.5">
            {['#087F83', '#3B82F6', '#8B5CF6', '#F59E0B', '#F43F5E', '#10B981'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewMemberColor(c)}
                aria-label={`Select color ${c}`}
                className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                  newMemberColor === c ? 'scale-125 ring-2 ring-offset-2 ring-[#087F83]' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
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
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] disabled:opacity-50 cursor-pointer shadow-xs transition-colors"
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
                className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                <span className="text-[#071A3A] dark:text-[#EDF4FF]">{m.name}</span>
                <button
                  type="button"
                  onClick={() => removeHouseholdMember(m.id)}
                  aria-label={`Remove household member ${m.name}`}
                  className="p-1 rounded-md text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tool Customization & Pinned Favorites */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
          <SlidersHorizontal className="w-4 h-4 text-[#087F83]" />
          <div>
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Module Customization & Pinned Favorites
            </h3>
            <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              Hide tools you don't use to keep navigation calm, and pin your daily favorites to the top.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { id: 'today', name: 'Today & Next Up', desc: 'Unified daily schedule & capture' },
            { id: 'tasks', name: 'Tasks & Projects', desc: 'Prioritized actions & all-day backlog' },
            { id: 'calendar', name: 'Calendar Schedule', desc: 'Visual month & week time-blocks' },
            { id: 'routines', name: 'Recurring Routines', desc: 'Daily, weekly & forgiving rituals' },
            { id: 'habits', name: 'Habit Consistency', desc: 'Daily rhythm & streak tracker' },
            { id: 'goals', name: 'Milestone Goals', desc: 'Long-term goals with step breakdowns' },
            { id: 'inbox', name: 'Brain Dump Inbox', desc: 'Quick capture before triaging' },
            { id: 'money', name: 'Money & Budgets', desc: 'Cash flow, bills, savings pots & debts' },
            { id: 'food', name: 'Meals & Groceries', desc: 'Weekly menu planning & smart list' },
            { id: 'body', name: 'Health & Hydration', desc: 'Workouts, weight metrics & water log' },
          ].map((tool) => {
            const isEnabled = !(settings.enabledTools) || settings.enabledTools.includes(tool.id);
            const isPinned = (settings.pinnedTools || []).includes(tool.id);
            return (
              <div
                key={tool.id}
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
                    onClick={() => toggleToolPinned(tool.id)}
                    aria-pressed={isPinned}
                    className={`p-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      isPinned
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50'
                    }`}
                    title={isPinned ? 'Unpin favorite' : 'Pin to favorites'}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleToolEnabled(tool.id)}
                    aria-pressed={isEnabled}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                      isEnabled
                        ? 'bg-teal-50 text-[#087F83] dark:bg-teal-950/60 dark:text-[#38D0C5]'
                        : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
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
          <SlidersHorizontal className="w-4 h-4 text-[#087F83]" />
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
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-xs font-medium cursor-pointer"
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
                  className="w-4 h-4 rounded text-[#087F83] focus:ring-[#087F83]"
                />
                <span className="text-[#071A3A] dark:text-[#EDF4FF]">{sec.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 2. Appearance (Board 25) */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
          Appearance
        </h3>
        <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
          Choose how Our Life Planner looks across light and dark modes.
        </p>

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
                aria-checked={isSelected}
                aria-label={`${theme.label} mode`}
                onClick={() => handleThemeChange(theme.id as any)}
                className={`p-3.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#087F83] bg-teal-50 dark:bg-teal-950/40 text-[#087F83] dark:text-[#38D0C5]'
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

      {/* 3. Edition Mode & Downloadable HTML (Board 24 & Section 2) */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
          Product Edition & Offline Independence
        </h3>
        <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
          Your purchase grants both an online synchronized edition and an independent standalone download.
        </p>

        <div role="radiogroup" aria-label="Product edition preference" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            role="radio"
            aria-checked={settings.edition === 'online'}
            aria-label="Online Edition: Syncs across your devices with local offline cache"
            onClick={() => updateSettings({ edition: 'online' })}
            className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
              settings.edition === 'online'
                ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Online Edition
            </div>
            <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE] mt-0.5">
              Syncs across your devices with local offline cache.
            </div>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              Active account
            </span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={settings.edition === 'downloaded'}
            aria-label="Downloaded Offline Edition: 100% independent. Works without an account or internet"
            onClick={() => updateSettings({ edition: 'downloaded' })}
            className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
              settings.edition === 'downloaded'
                ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Downloaded Offline Edition
            </div>
            <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE] mt-0.5">
              100% independent. Works without an account or internet.
            </div>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              Self-contained
            </span>
          </button>
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
        <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
          Export versioned JSON backups or restore data safely.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setActiveModal('backup_restore')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer"
          >
            <Database className="w-4 h-4 text-[#087F83]" />
            <span>Backup & Restore Manager</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('setup')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#087F83]" />
            <span>Re-run Setup Wizard</span>
          </button>

          {settings.isSampleDataActive ? (
            <button
              type="button"
              onClick={removeSampleData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-300 dark:border-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Remove sample data (keeps your records)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={loadSampleData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-teal-300 dark:border-teal-800 text-xs font-semibold text-[#087F83] dark:text-[#38D0C5] hover:bg-teal-50 dark:hover:bg-teal-950/40 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Demo / Sample Data</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
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
            <HelpCircle className="w-4 h-4 text-[#087F83]" />
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('support')}
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                Get Support Desk
              </div>
              <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                Troubleshooting, email & in-app desk
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
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div>
              <span className="font-bold block">Destructive Action:</span>
              <span>
                All tasks, routines, meals, financial ledgers, and logs will be permanently erased. Please export a backup first if you want to keep a copy.
              </span>
            </div>
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
