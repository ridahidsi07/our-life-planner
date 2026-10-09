import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import {
  Download,
  Upload,
  AlertTriangle,
  Check,
  ShieldCheck,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { PlannerBackupData } from '../../types/planner';

export const BackupRestoreModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    exportBackup,
    restoreBackup,
    updateSettings,
  } = usePlanner();

  const [restorePreview, setRestorePreview] = useState<PlannerBackupData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [isPasteMode, setIsPasteMode] = useState(false);
  const [pastedJson, setPastedJson] = useState('');

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
    setErrorMessage('');
    setSuccessMessage('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || parsed.version !== '1.0.0') {
          setErrorMessage('We could not read this backup. Your planner has not changed. Please select a valid version 1.0.0 backup file.');
          setRestorePreview(null);
          return;
        }
        setRestorePreview(parsed);
      } catch (err) {
        setErrorMessage('We could not read this backup file (invalid JSON format). Your planner has not changed.');
        setRestorePreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleParsePastedJson = () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!pastedJson.trim()) {
      setErrorMessage('Please paste backup JSON content.');
      return;
    }
    try {
      const parsed = JSON.parse(pastedJson.trim());
      if (!parsed || parsed.version !== '1.0.0') {
        setErrorMessage('Invalid backup format. Must be a valid version 1.0.0 backup.');
        setRestorePreview(null);
        return;
      }
      setRestorePreview(parsed);
    } catch (e) {
      setErrorMessage('Could not parse pasted text as valid JSON.');
      setRestorePreview(null);
    }
  };

  const handleConfirmRestore = () => {
    if (!restorePreview) return;
    const ok = restoreBackup(restorePreview);
    if (ok) {
      setSuccessMessage('Planner restored successfully!');
      setTimeout(() => {
        setRestorePreview(null);
        setActiveModal(null);
      }, 1000);
    } else {
      setErrorMessage('Failed to restore backup data.');
    }
  };

  return (
    <Modal
      isOpen={activeModal === 'backup_restore'}
      onClose={() => setActiveModal(null)}
      title="Backup & Restore"
      subtitle="Keep a copy of your planner data safe or transfer between devices"
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
              Restore from backup
            </h4>
            <button
              type="button"
              onClick={() => setIsPasteMode(!isPasteMode)}
              className="text-xs text-[#087F83] dark:text-[#38D0C5] hover:underline font-medium cursor-pointer"
            >
              {isPasteMode ? 'Switch to file upload' : 'Paste JSON text instead'}
            </button>
          </div>

          {!isPasteMode ? (
            <input
              type="file"
              accept=".json"
              aria-label="Select backup JSON file to restore"
              onChange={handleFileSelect}
              className="block w-full text-xs text-[#526782] dark:text-[#A8B8CE] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 dark:file:bg-teal-950/60 file:text-[#087F83] dark:file:text-[#38D0C5] hover:file:bg-teal-100 cursor-pointer"
            />
          ) : (
            <div className="space-y-2">
              <textarea
                value={pastedJson}
                onChange={(e) => setPastedJson(e.target.value)}
                placeholder="Paste backup JSON content here (must have version '1.0.0')..."
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
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Restore Preview Safeguard (Board 27) */}
          {restorePreview && (
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 text-xs space-y-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>Restore preview · Replaces the planner on this device</span>
              </div>

              <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE] space-y-1 font-mono">
                <div>Export date: {restorePreview.exportedAt}</div>
                <div>Owner: {restorePreview.settings.ownerName}</div>
                <div>
                  Records: {restorePreview.tasks.length} tasks · {restorePreview.routines.length} routines · {restorePreview.bills.length} bills · {restorePreview.recipes.length} recipes
                </div>
              </div>

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
          )}
        </div>
      </div>
    </Modal>
  );
};
