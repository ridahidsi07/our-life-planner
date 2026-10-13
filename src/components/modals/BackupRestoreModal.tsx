import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import {
  Download,
  AlertTriangle,
  Check,
  ShieldCheck,
  FileText,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { PlannerBackupData } from '../../types/planner';
import { parseAndValidateBackupJson } from '../../utils/backupValidator';

export const BackupRestoreModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    exportBackup,
    restoreBackup,
    preRestoreSnapshot,
    rollbackLastRestore,
    updateSettings,
  } = usePlanner();

  const [restorePreview, setRestorePreview] = useState<PlannerBackupData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [isPasteMode, setIsPasteMode] = useState(false);
  const [pastedJson, setPastedJson] = useState('');

  const clearFeedback = () => {
    setErrorMessage('');
    setValidationErrors([]);
    setSuccessMessage('');
  };

  const handleExport = () => {
    const data = exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planner-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 200);

    const nowFormatted = new Date().toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    updateSettings({ lastBackupDate: nowFormatted });
    setSuccessMessage('Backup downloaded to your device!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleCopyJson = async () => {
    const data = exportBackup();
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      const nowFormatted = new Date().toLocaleString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      updateSettings({ lastBackupDate: nowFormatted });
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearFeedback();
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawText = typeof event.target?.result === 'string' ? event.target.result : '';
      const result = parseAndValidateBackupJson(rawText);
      if (!result.isValid || !result.data) {
        setErrorMessage(
          'We could not validate this backup file. Your planner has not changed. Please select a complete, valid version 1.0.0 backup file.'
        );
        setValidationErrors(result.errors);
        setRestorePreview(null);
        return;
      }
      setRestorePreview(result.data);
    };
    reader.readAsText(file);
  };

  const handleParsePastedJson = () => {
    clearFeedback();
    if (!pastedJson.trim()) {
      setErrorMessage('Please paste backup JSON content.');
      setRestorePreview(null);
      return;
    }

    const result = parseAndValidateBackupJson(pastedJson);
    if (!result.isValid || !result.data) {
      setErrorMessage(
        'Invalid or incomplete backup data. Your planner has not changed. Please check the validation details below.'
      );
      setValidationErrors(result.errors);
      setRestorePreview(null);
      return;
    }

    setRestorePreview(result.data);
  };

  const handleConfirmRestore = () => {
    if (!restorePreview) return;
    clearFeedback();
    const ok = restoreBackup(restorePreview);
    if (ok) {
      setSuccessMessage(
        'Planner restored atomically! A recoverable snapshot of your previous planner was saved.'
      );
      setRestorePreview(null);
      setTimeout(() => {
        setSuccessMessage('');
        setActiveModal(null);
      }, 1400);
    } else {
      setErrorMessage(
        'Failed to restore backup data. Your existing planner records were preserved.'
      );
    }
  };

  const handleRollbackSnapshot = () => {
    clearFeedback();
    const ok = rollbackLastRestore();
    if (ok) {
      setRestorePreview(null);
      setSuccessMessage('Previous planner snapshot restored successfully!');
      setTimeout(() => {
        setSuccessMessage('');
      }, 3500);
    } else {
      setErrorMessage('Could not restore the previous snapshot.');
    }
  };

  return (
    <Modal
      isOpen={activeModal === 'backup_restore'}
      onClose={() => setActiveModal(null)}
      title="Backup & Restore"
      subtitle="Keep a copy of your planner data safe or transfer between devices"
    >
      <ErrorBoundary
        compact
        fallbackTitle="Backup & Restore Manager encountered an error"
        onReset={() => {
          setRestorePreview(null);
          clearFeedback();
        }}
      >
        <div className="space-y-6">
          {/* Export Section */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                Export backup
              </h4>
              <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                Download complete planner records into a versioned JSON file or copy to clipboard.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyJson}
                aria-label="Copy backup JSON to clipboard"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-[#071A3A] dark:text-[#EDF4FF] hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-[#087F83] dark:text-[#38D0C5]" />
                <span>{copied ? 'Copied to clipboard!' : 'Copy JSON'}</span>
              </button>
              <button
                type="button"
                onClick={handleExport}
                aria-label="Export backup: download versioned JSON file"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download JSON</span>
              </button>
            </div>
          </div>

          {/* Restore Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] uppercase tracking-wider">
                Restore from backup file
              </h4>
            </div>

            <input
              type="file"
              accept=".json"
              aria-label="Select backup JSON file to restore"
              onChange={handleFileSelect}
              className="block w-full text-xs text-[#526782] dark:text-[#A8B8CE] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 dark:file:bg-teal-950/60 file:text-[#087F83] dark:file:text-[#38D0C5] hover:file:bg-teal-100 cursor-pointer"
            />

            <details
              data-testid="backup-advanced-details"
              open={isPasteMode}
              onToggle={(e) => setIsPasteMode((e.currentTarget as HTMLDetailsElement).open)}
              className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 px-3.5 py-2.5 text-xs"
            >
              <summary className="font-semibold text-[#526782] dark:text-[#A8B8CE] cursor-pointer select-none">
                Advanced details: Paste raw backup JSON or inspect schema
              </summary>
              <div className="mt-2.5 space-y-2">
                <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                  Paste a complete version <code className="font-mono">1.0.0</code> JSON backup below to validate all 19 collection arrays before restoring:
                </p>
                <textarea
                  aria-label="Paste backup JSON content"
                  value={pastedJson}
                  onChange={(e) => setPastedJson(e.target.value)}
                  placeholder="Paste backup JSON content here (must be a complete version '1.0.0' backup)..."
                  rows={4}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-mono text-[#071A3A] dark:text-[#EDF4FF] focus:ring-2 focus:ring-[#087F83]"
                />
                <button
                  type="button"
                  onClick={handleParsePastedJson}
                  className="px-3.5 py-1.5 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer"
                >
                  Validate and preview backup
                </button>
              </div>
            </details>

            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-200 text-xs space-y-2"
              >
                <div className="flex items-start gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
                {validationErrors.length > 0 && (
                  <ul className="pl-6 list-disc space-y-1 text-[11px] font-mono text-rose-800 dark:text-rose-300 max-h-36 overflow-y-auto">
                    {validationErrors.slice(0, 8).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {validationErrors.length > 8 && (
                      <li>...and {validationErrors.length - 8} more validation issue(s).</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            {successMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Restore Preview Safeguard (Board 27) */}
            {restorePreview && (
              <ErrorBoundary
                compact
                fallbackTitle="Could not display backup preview"
                onReset={() => setRestorePreview(null)}
              >
                <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 text-xs space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Restore preview · Replaces the planner on this device</span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold">
                      <ShieldCheck className="w-3 h-3" />
                      Schema &amp; relationships verified
                    </span>
                  </div>

                  <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE] space-y-1 font-mono">
                    <div>Export date: {restorePreview.exportedAt || 'Unknown'}</div>
                    <div>Owner: {restorePreview.settings?.ownerName || 'Owner'}</div>
                    <div>
                      Records: {(restorePreview.tasks ?? []).length} tasks ·{' '}
                      {(restorePreview.routines ?? []).length} routines ·{' '}
                      {(restorePreview.bills ?? []).length} bills ·{' '}
                      {(restorePreview.transactions ?? []).length} transactions ·{' '}
                      {(restorePreview.recipes ?? []).length} recipes
                    </div>
                  </div>

                  <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                    Restoring will automatically save a recoverable snapshot of your current planner so you can roll back if needed.
                  </p>

                  <div className="pt-2 flex flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      onClick={handleExport}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Download current backup first
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRestore}
                      className="px-3.5 py-1.5 rounded-lg bg-[#071A3A] dark:bg-slate-700 text-white text-[11px] font-semibold hover:bg-black dark:hover:bg-slate-600 cursor-pointer"
                    >
                      Replace planner
                    </button>
                  </div>
                </div>
              </ErrorBoundary>
            )}

            {/* Pre-Restore Safety Snapshot Recovery Section */}
            {preRestoreSnapshot && (
              <div className="p-4 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/70 text-xs space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 font-bold text-[#087F83] dark:text-[#38D0C5]">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Recoverable previous snapshot retained</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRollbackSnapshot}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#087F83] hover:bg-[#06676A] text-white text-[11px] font-semibold cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore previous snapshot</span>
                  </button>
                </div>
                <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE] font-mono">
                  Saved: {new Date(preRestoreSnapshot.savedAt).toLocaleString()} · Owner:{' '}
                  {preRestoreSnapshot.ownerName} · {preRestoreSnapshot.totalRecords} total records
                </div>
              </div>
            )}
          </div>
        </div>
      </ErrorBoundary>
    </Modal>
  );
};
