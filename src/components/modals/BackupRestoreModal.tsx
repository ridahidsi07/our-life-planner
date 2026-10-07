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
  } = usePlanner();

  const [restorePreview, setRestorePreview] = useState<PlannerBackupData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleExport = () => {
    const data = exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planner-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Export backup
            </h4>
            <p className="text-[11px] text-[#526782]">
              Download complete planner records into a versioned JSON file.
            </p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export backup</span>
          </button>
        </div>

        {/* Restore Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] uppercase tracking-wider">
            Restore from backup
          </h4>

          <input
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="block w-full text-xs text-[#526782] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-[#087F83] hover:file:bg-teal-100 cursor-pointer"
          />

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
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-[11px] font-semibold text-[#526782] hover:bg-white"
                >
                  Download current backup first
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  className="px-3.5 py-1.5 rounded-lg bg-[#071A3A] text-white text-[11px] font-semibold hover:bg-black"
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
