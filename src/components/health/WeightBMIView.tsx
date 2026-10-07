import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import {
  Scale,
  Plus,
  TrendingDown,
  TrendingUp,
  Minus,
  Info,
  Calendar,
  Clock,
  Trash2,
  Check,
  RotateCcw,
} from 'lucide-react';
import { WeightProfile, WeightRecord } from '../../types/planner';
import {
  calculateBMI,
  convertKgToLb,
  convertLbToKg,
  convertCmToInches,
  convertInchesToCm,
} from '../../utils/calculations';

export const WeightBMIView: React.FC = () => {
  const {
    weightProfiles,
    selectedProfileId,
    setSelectedProfileId,
    weightRecords,
    addWeightProfile,
    addWeightRecord,
    deleteWeightRecord,
    settings,
    updateSettings,
    currentDate,
  } = usePlanner();

  // Active unit mode ('kg' or 'lb') synced with user settings
  const [unitMode, setUnitMode] = useState<'kg' | 'lb'>(() => settings.weightUnit || 'kg');

  // Selected profile
  const selectedProfile =
    weightProfiles.find((p) => p.id === selectedProfileId) || weightProfiles[0];

  // Records for this profile sorted newest first
  const profileRecords = useMemo(() => {
    return weightRecords
      .filter((r) => r.profileId === selectedProfile?.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [weightRecords, selectedProfile]);

  const latestRecord = profileRecords.length > 0 ? profileRecords[0] : null;
  const previousRecord = profileRecords.length > 1 ? profileRecords[1] : null;

  const latestWeightKg = latestRecord ? latestRecord.weightKg : 72.0;
  const previousWeightKg = previousRecord ? previousRecord.weightKg : 72.4;
  const weightChangeKg = Math.round((latestWeightKg - previousWeightKg) * 10) / 10;

  // BMI calculated via CDC guidance: kg / (height_m ^ 2)
  const currentHeightCm = latestRecord?.recordedHeightCm || selectedProfile?.heightCm || 180;
  const currentBmi = calculateBMI(latestWeightKg, currentHeightCm);

  // Canonical draft weight (in physical kg). Defaults to latest recorded weight or standard 72.0 kg
  const [canonicalDraftKg, setCanonicalDraftKg] = useState<number | null>(() => 72.0);

  // Text draft input displayed to the user
  const [inputWeightStr, setInputWeightStr] = useState<string>(() => {
    const initialUnit = settings.weightUnit || 'kg';
    return initialUnit === 'lb' ? convertKgToLb(72.0).toFixed(1) : '72.0';
  });

  const [inputHeight, setInputHeight] = useState<number>(180);
  const [inputDate, setInputDate] = useState<string>(currentDate);
  const [inputTime, setInputTime] = useState<string>('07:00');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Keep refs to avoid stale closures in effects and event handlers
  const unitModeRef = useRef(unitMode);
  unitModeRef.current = unitMode;
  const inputWeightStrRef = useRef(inputWeightStr);
  inputWeightStrRef.current = inputWeightStr;
  const canonicalDraftKgRef = useRef(canonicalDraftKg);
  canonicalDraftKgRef.current = canonicalDraftKg;

  // Handle unit switching: converts the draft weight value between kg and lb
  const handleUnitModeChange = (newUnit: 'kg' | 'lb') => {
    const currentUnit = unitModeRef.current;
    if (newUnit === currentUnit) return;

    const currentStr = inputWeightStrRef.current;
    if (currentStr.trim() !== '') {
      const val = parseFloat(currentStr);
      if (!isNaN(val) && val > 0) {
        if (newUnit === 'lb') {
          // Switching from kg to lb
          const convertedLb = convertKgToLb(val);
          setInputWeightStr(convertedLb.toFixed(1));
          setCanonicalDraftKg(Math.round(val * 10) / 10);
        } else {
          // Switching from lb to kg
          const convertedKg = convertLbToKg(val);
          setInputWeightStr(convertedKg.toFixed(1));
          setCanonicalDraftKg(convertedKg);
        }
      } else {
        // Clear invalid draft and explicitly require re-entry
        setInputWeightStr('');
        setCanonicalDraftKg(null);
      }
    } else {
      // Input was empty, keep empty requiring explicit re-entry
      setInputWeightStr('');
      setCanonicalDraftKg(null);
    }

    setUnitMode(newUnit);
    updateSettings({ weightUnit: newUnit });
  };

  // Sync with global settings if updated from Settings view
  useEffect(() => {
    if (settings.weightUnit && settings.weightUnit !== unitModeRef.current) {
      handleUnitModeChange(settings.weightUnit);
    }
  }, [settings.weightUnit]);

  // Handle manual typing in the weight input field
  const handleDraftInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setInputWeightStr(rawVal);

    if (rawVal.trim() === '') {
      setCanonicalDraftKg(null);
    } else {
      const parsed = parseFloat(rawVal);
      if (!isNaN(parsed) && parsed > 0) {
        if (unitMode === 'kg') {
          setCanonicalDraftKg(Math.round(parsed * 10) / 10);
        } else {
          setCanonicalDraftKg(convertLbToKg(parsed));
        }
      } else {
        setCanonicalDraftKg(null);
      }
    }
  };

  // Clear draft action (explicit re-entry)
  const handleClearDraft = () => {
    setInputWeightStr('');
    setCanonicalDraftKg(null);
  };

  // Prefill draft from the profile's latest recorded measurement
  const handlePrefillLatest = () => {
    const baseKg = latestRecord ? latestRecord.weightKg : 72.0;
    setCanonicalDraftKg(baseKg);
    if (unitMode === 'kg') {
      setInputWeightStr(baseKg.toFixed(1));
    } else {
      setInputWeightStr(convertKgToLb(baseKg).toFixed(1));
    }
  };

  // Display conversions for current metrics
  const displayedLatestWeight =
    unitMode === 'kg' ? latestWeightKg : convertKgToLb(latestWeightKg);
  const displayedPreviousWeight =
    unitMode === 'kg' ? previousWeightKg : convertKgToLb(previousWeightKg);
  const displayedWeightChange =
    unitMode === 'kg'
      ? weightChangeKg
      : Math.round((displayedLatestWeight - displayedPreviousWeight) * 10) / 10;

  // Add Profile Modal state
  const [isAddProfileModalOpen, setIsAddProfileModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileHeight, setNewProfileHeight] = useState<number>(175);
  const [newProfileColor, setNewProfileColor] = useState('#087F83');

  const handleSaveMeasurement = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(inputWeightStr);
    if (!selectedProfile || isNaN(val) || val <= 0) return;

    // Use canonical physical weight in kg
    const normalizedKg =
      canonicalDraftKg !== null
        ? canonicalDraftKg
        : unitMode === 'kg'
        ? Math.round(val * 10) / 10
        : convertLbToKg(val);

    const normalizedCm = inputHeight > 0 ? inputHeight : undefined;

    addWeightRecord({
      profileId: selectedProfile.id,
      date: inputDate,
      time: inputTime,
      weightKg: normalizedKg,
      recordedHeightCm: normalizedCm,
    });

    const formattedSavedVal =
      unitMode === 'kg' ? `${normalizedKg} kg` : `${convertKgToLb(normalizedKg)} lb`;
    setSaveSuccessMessage(`Recorded ${formattedSavedVal} for ${selectedProfile.name}`);
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;

    const success = addWeightProfile({
      name: newProfileName.trim(),
      heightCm: newProfileHeight > 0 ? newProfileHeight : undefined,
      avatarColor: newProfileColor,
    });

    if (success) {
      setIsAddProfileModalOpen(false);
      setNewProfileName('');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Weight & BMI
          </h2>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            Track your weight, monitor progress, and automatically convert draft measurements between kg and lb.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Unit Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-[#526782]">
            <button
              type="button"
              onClick={() => handleUnitModeChange('kg')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                unitMode === 'kg'
                  ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                  : 'hover:text-[#071A3A] dark:hover:text-[#EDF4FF]'
              }`}
            >
              kg (Metric)
            </button>
            <button
              type="button"
              onClick={() => handleUnitModeChange('lb')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                unitMode === 'lb'
                  ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                  : 'hover:text-[#071A3A] dark:hover:text-[#EDF4FF]'
              }`}
            >
              lb (Imperial)
            </button>
          </div>
        </div>
      </div>

      {/* Profiles Bar (Up to 8 named profiles) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[#526782]">
          Profiles ({weightProfiles.length} of 8):
        </span>
        {weightProfiles.map((p) => {
          const isSelected = selectedProfile?.id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedProfileId(p.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#087F83] text-white border-[#087F83] shadow-2xs'
                  : 'bg-white dark:bg-[#152238] text-[#526782] border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div
                className="w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center font-bold"
                style={{ backgroundColor: p.avatarColor }}
              >
                {p.name.charAt(0)}
              </div>
              <span>{p.name}</span>
            </button>
          );
        })}

        {weightProfiles.length < 8 && (
          <button
            onClick={() => setIsAddProfileModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-[#087F83] hover:bg-teal-50/50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add profile</span>
          </button>
        )}
      </div>

      {/* 3 Metric Cards Row (Board 16) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Current Weight */}
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="text-xs text-[#526782]">Current weight</div>
          <div className="text-3xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
            {displayedLatestWeight} {unitMode}
          </div>
          <div
            className={`text-xs font-semibold flex items-center gap-1 mt-1.5 ${
              displayedWeightChange < 0
                ? 'text-emerald-600'
                : displayedWeightChange > 0
                ? 'text-amber-600'
                : 'text-slate-500'
            }`}
          >
            {displayedWeightChange < 0 ? (
              <TrendingDown className="w-3.5 h-3.5" />
            ) : displayedWeightChange > 0 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
            <span>
              {displayedWeightChange > 0 ? `+${displayedWeightChange}` : displayedWeightChange}{' '}
              {unitMode} since {previousRecord?.date || '28 Sep 2026'}
            </span>
          </div>
        </div>

        {/* Height */}
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="text-xs text-[#526782]">Height</div>
          <div className="text-3xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
            {currentHeightCm} cm
            <span className="text-xs font-normal text-[#526782] ml-1.5">
              ({convertCmToInches(currentHeightCm)} in)
            </span>
          </div>
          <div className="text-[11px] text-[#526782] mt-1.5">
            Saved with your measurements
          </div>
        </div>

        {/* BMI */}
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#526782]">BMI</span>
            <div className="group relative cursor-pointer">
              <Info className="w-3.5 h-3.5 text-[#526782]" />
              <div className="hidden group-hover:block absolute right-0 top-5 w-48 p-2 rounded-lg bg-black text-white text-[10px] z-20 shadow-lg">
                Calculated as kg/m² per CDC guidance. Numeric metric only; no medical diagnosis labels.
              </div>
            </div>
          </div>
          <div className="text-3xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
            {currentBmi || '–'}
          </div>
          <div className="text-[11px] text-[#526782] mt-1.5">
            {latestRecord?.date || currentDate}
          </div>
        </div>
      </div>

      {/* Main 2-Column Area: Weight Trend Chart (7 cols) & Add Measurement (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trend Chart (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Weight trend ({unitMode})
            </h3>
            <span className="text-xs text-[#526782]">Recent history ({unitMode})</span>
          </div>

          {/* Sparkline / Step Line Chart */}
          {profileRecords.length > 0 ? (
            <div className="h-44 pt-6 flex items-end justify-between border-b border-l border-slate-200 dark:border-slate-700 px-4">
              {profileRecords.slice(0, 7).reverse().map((r) => {
                const convertedValues = profileRecords.slice(0, 7).map((p) =>
                  unitMode === 'kg' ? p.weightKg : convertKgToLb(p.weightKg)
                );
                const minW = Math.min(...convertedValues);
                const maxW = Math.max(...convertedValues);
                const span = maxW > minW ? maxW - minW : 4;
                const rVal = unitMode === 'kg' ? r.weightKg : convertKgToLb(r.weightKg);
                const hPct = Math.min(100, Math.max(15, ((rVal - minW) / span) * 85 + 15));

                return (
                  <div key={r.id} className="flex flex-col items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-[#087F83] dark:text-[#38D0C5]">
                      {rVal}
                    </span>
                    <div
                      className="w-3.5 rounded-full bg-[#087F83] dark:bg-[#38D0C5] transition-all"
                      style={{ height: `${hPct}px` }}
                      title={`${rVal} ${unitMode} on ${r.date}`}
                    />
                    <span className="text-[10px] text-[#526782]">{r.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-[#526782] border border-dashed rounded-xl">
              No measurements logged yet for {selectedProfile?.name}. Record your first entry below.
            </div>
          )}

          {/* Recent Records Table */}
          <div>
            <h4 className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] uppercase tracking-wider mb-2">
              Recent measurements
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
              {profileRecords.map((r) => {
                const displayedVal =
                  unitMode === 'kg' ? r.weightKg : convertKgToLb(r.weightKg);
                return (
                  <div key={r.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                        {r.date}
                      </span>
                      <span className="text-[11px] text-[#526782] ml-2">
                        {r.time || '07:00'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                        {displayedVal} {unitMode}
                      </span>
                      <span className="text-[#526782]">
                        BMI {calculateBMI(r.weightKg, r.recordedHeightCm || currentHeightCm)}
                      </span>
                      <button
                        onClick={() => deleteWeightRecord(r.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Delete measurement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Add Measurement Form (5 cols) (Board 16) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Add measurement
            </h3>
            {/* Quick Prefill Button */}
            <button
              type="button"
              onClick={handlePrefillLatest}
              className="text-[11px] text-[#087F83] dark:text-[#38D0C5] hover:underline flex items-center gap-1 cursor-pointer"
              title="Reset draft to latest measurement"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Use latest ({displayedLatestWeight} {unitMode})</span>
            </button>
          </div>

          {saveSuccessMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}

          <form onSubmit={handleSaveMeasurement} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Profile
              </label>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium cursor-pointer"
              >
                {weightProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                  Weight ({unitMode}) *
                </label>
                {/* Unit Switcher directly beside label */}
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-[#526782] text-[10px]">Switch unit:</span>
                  <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => handleUnitModeChange('kg')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        unitMode === 'kg'
                          ? 'bg-[#087F83] text-white shadow-2xs'
                          : 'text-[#526782] hover:text-[#071A3A]'
                      }`}
                    >
                      kg
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUnitModeChange('lb')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        unitMode === 'lb'
                          ? 'bg-[#087F83] text-white shadow-2xs'
                          : 'text-[#526782] hover:text-[#071A3A]'
                      }`}
                    >
                      lb
                    </button>
                  </div>
                </div>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  required
                  value={inputWeightStr}
                  onChange={handleDraftInputChange}
                  placeholder={unitMode === 'kg' ? 'e.g. 72.0' : 'e.g. 158.7'}
                  className="w-full px-3 py-2 pr-16 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#087F83]"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-[#526782]">
                  <span className="font-semibold">{unitMode}</span>
                  {inputWeightStr && (
                    <button
                      type="button"
                      onClick={handleClearDraft}
                      className="text-slate-400 hover:text-rose-600 text-[10px] underline cursor-pointer ml-1"
                      title="Clear draft and require re-entry"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-[#526782]">
                <span>
                  {canonicalDraftKg !== null
                    ? `Canonical: ${canonicalDraftKg.toFixed(1)} kg (${convertKgToLb(canonicalDraftKg).toFixed(1)} lb)`
                    : 'Clear draft explicitly requires re-entry'}
                </span>
                {canonicalDraftKg !== null && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Auto-converts on unit change
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Height (cm) (Optional)
              </label>
              <input
                type="number"
                min="50"
                value={inputHeight}
                onChange={(e) => setInputHeight(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
              />
              <span className="text-[10px] text-[#526782] mt-0.5 block">
                Height is saved with each measurement for accurate BMI calculation.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={inputDate}
                  onChange={(e) => setInputDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={inputTime}
                  onChange={(e) => setInputTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer shadow-xs transition-colors"
            >
              Save measurement
            </button>
          </form>
        </div>
      </div>

      {/* Add Profile Modal */}
      <Modal
        isOpen={isAddProfileModalOpen}
        onClose={() => setIsAddProfileModalOpen(false)}
        title="Add profile"
        subtitle="Track weight and BMI for up to 8 individuals"
      >
        <form onSubmit={handleCreateProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Profile name *
            </label>
            <input
              type="text"
              required
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="e.g. Alex, Sam"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Height (cm)
            </label>
            <input
              type="number"
              min="50"
              value={newProfileHeight}
              onChange={(e) => setNewProfileHeight(parseInt(e.target.value) || 170)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Avatar color
            </label>
            <div className="flex gap-2">
              {['#087F83', '#FF7B78', '#8B7CF6', '#10B981', '#F59E0B'].map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setNewProfileColor(c)}
                  className={`w-7 h-7 rounded-full border-2 cursor-pointer ${
                    newProfileColor === c ? 'border-black' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddProfileModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer"
            >
              Create profile
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
