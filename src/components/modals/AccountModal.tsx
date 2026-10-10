import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import {
  User,
  Mail,
  HardDrive,
  ShieldCheck,
  Download,
  Database,
  Check,
  CheckCircle2,
  FileText,
  AlertCircle,
} from 'lucide-react';

export const AccountModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    settings,
    updateSettings,
    tasks,
    routines,
    transactions,
    bills,
    savingsPots,
    habits,
    inbox,
    recipes,
    workouts,
    exportBackup,
  } = usePlanner();

  // Profile editing
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  const [email, setEmail] = useState(settings.email || 'user@example.com');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      ownerName: ownerName.trim() || 'Owner',
      email: email.trim() || 'user@example.com',
    });
    setIsEditingProfile(false);
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2500);
  };

  const handleQuickExport = () => {
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
    setExportFeedback(true);
    setTimeout(() => setExportFeedback(false), 3000);
  };

  // Calculate approximate storage usage
  const totalItemsCount =
    tasks.length +
    routines.length +
    transactions.length +
    bills.length +
    savingsPots.length +
    habits.length +
    inbox.length +
    recipes.length +
    workouts.length;

  let estimatedStorageKb = 0;
  try {
    const rawData = localStorage.getItem('our-life-planner-data') || '';
    const rawSettings = localStorage.getItem('our-life-planner-settings') || '';
    estimatedStorageKb = Math.round((rawData.length + rawSettings.length) / 1024);
  } catch {
    estimatedStorageKb = 15;
  }

  return (
    <Modal
      isOpen={activeModal === 'account'}
      onClose={() => setActiveModal(null)}
      title="Profile & Local Storage"
      subtitle="Manage your local profile, data privacy, and browser storage"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5 text-xs text-[#071A3A] dark:text-[#EDF4FF]">
        {/* Profile Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-700/80 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#087F83] to-[#38D0C5] text-white flex items-center justify-center font-bold text-lg shadow-xs">
                {ownerName.charAt(0) || 'R'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                    {ownerName}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                    Local Profile
                  </span>
                </div>
                <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE] flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{email}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-semibold cursor-pointer transition-colors"
              >
                {isEditingProfile ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
          </div>

          {/* Profile Edit Form */}
          {isEditingProfile && (
            <form onSubmit={handleSaveProfile} className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="account-owner-name"
                  className="block text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] mb-1"
                >
                  Owner / Display Name
                </label>
                <input
                  id="account-owner-name"
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs font-semibold"
                />
              </div>
              <div>
                <label
                  htmlFor="account-profile-email"
                  className="block text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] mb-1"
                >
                  Profile Email
                </label>
                <input
                  id="account-profile-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-xl bg-[#087F83] text-white font-semibold text-xs hover:bg-[#06676A] cursor-pointer"
                >
                  Save Profile
                </button>
              </div>
            </form>
          )}

          {saveFeedback && (
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>Profile details updated locally!</span>
            </div>
          )}

          <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE] pt-1 border-t border-slate-100 dark:border-slate-800">
            Profile details are stored on this device and used to personalize planner greetings, household members, and export metadata.
          </div>
        </div>

        {/* Truthful Storage & Privacy Transparency Notice */}
        <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 space-y-2">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#087F83] dark:text-[#38D0C5]" />
            <h4 className="font-bold text-xs text-[#087F83] dark:text-[#38D0C5]">
              100% Local Browser Storage (localStorage)
            </h4>
          </div>
          <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE] leading-relaxed">
            All planner records—including your tasks, routines, budget transactions, bills, habits, and health logs—are stored exclusively in this browser&apos;s local storage (<code className="text-[10px] font-mono bg-teal-100 dark:bg-teal-900 px-1 py-0.5 rounded">localStorage</code>). No personal data is sent to external servers or cloud accounts.
          </p>
        </div>

        {/* Storage Health & Record Statistics */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-700/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-[#071A3A] dark:text-[#EDF4FF] flex items-center gap-1.5">
              <Database className="w-4 h-4 text-[#087F83] dark:text-[#38D0C5]" />
              <span>Local Storage Footprint</span>
            </h4>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              Active in this browser
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">Tasks & Routines</div>
              <div className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF] mt-0.5">
                {tasks.length + routines.length}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">Finances & Bills</div>
              <div className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF] mt-0.5">
                {transactions.length + bills.length + savingsPots.length}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">Habits & Notes</div>
              <div className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF] mt-0.5">
                {habits.length + inbox.length}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">Storage Used</div>
              <div className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF] mt-0.5">
                ~{estimatedStorageKb} KB
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-[#526782] dark:text-[#A8B8CE] pt-1">
            <span>Total records saved: <strong className="text-[#071A3A] dark:text-[#EDF4FF]">{totalItemsCount} items</strong></span>
            <span>Last backup export: <strong className="text-[#071A3A] dark:text-[#EDF4FF]">{settings.lastBackupDate || 'Not yet exported'}</strong></span>
          </div>
        </div>

        {/* Backups & Multi-Device Transfer Guidance */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-700/80 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#087F83] dark:text-[#38D0C5]" />
            <h4 className="font-bold text-xs text-[#071A3A] dark:text-[#EDF4FF]">
              Backups & Cross-Device Transfer
            </h4>
          </div>

          <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE] leading-relaxed">
            Because Our Life Planner does not operate a remote server or store your data in the cloud, automated cross-device synchronization is not available. To keep your records safe or use the planner on another computer, tablet, or phone:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setActiveModal('backup_restore');
              }}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
            >
              <div className="font-bold text-[11px] text-[#071A3A] dark:text-[#EDF4FF] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#087F83] dark:text-[#38D0C5]" />
                <span>Backup & Restore</span>
              </div>
              <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] mt-1">
                Import or export complete versioned JSON snapshots.
              </div>
            </button>

            <button
              type="button"
              onClick={handleQuickExport}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
            >
              <div className="font-bold text-[11px] text-[#071A3A] dark:text-[#EDF4FF] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#087F83] dark:text-[#38D0C5]" />
                <span>Export JSON File</span>
              </div>
              <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] mt-1">
                Save an instant backup file directly to your downloads.
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveModal('download_offline');
              }}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
            >
              <div className="font-bold text-[11px] text-[#071A3A] dark:text-[#EDF4FF] flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-[#087F83] dark:text-[#38D0C5]" />
                <span>Standalone App</span>
              </div>
              <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] mt-1">
                Download single-file HTML bundle to run offline anywhere.
              </div>
            </button>
          </div>

          {exportFeedback && (
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>Backup JSON downloaded successfully!</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
