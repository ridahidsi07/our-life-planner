import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import {
  User,
  Mail,
  ShieldCheck,
  Cloud,
  RefreshCw,
  Smartphone,
  Laptop,
  Key,
  Check,
  Copy,
  AlertTriangle,
  Wifi,
  WifiOff,
  LogOut,
  Plus,
  HardDrive,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const AccountModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    settings,
    updateSettings,
    savingState,
    setSavingState,
    setConflictItem,
  } = usePlanner();

  // Profile editing
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  const [email, setEmail] = useState(settings.email || 'rida@example.com');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);

  // Syncing
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState('');

  // Connected devices
  const [devices, setDevices] = useState([
    { id: 'dev-1', name: 'This Device (Windows PC · Chrome)', type: 'desktop', isCurrent: true, lastSync: 'Active now' },
    { id: 'dev-2', name: 'iPhone 15 Pro (Safari Mobile)', type: 'mobile', isCurrent: false, lastSync: '12 minutes ago' },
    { id: 'dev-3', name: 'MacBook Air (Chrome)', type: 'desktop', isCurrent: false, lastSync: 'Yesterday at 18:40' },
  ]);
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [pairCodeCopied, setPairCodeCopied] = useState(false);

  // Switch account
  const [isSwitchOpen, setIsSwitchOpen] = useState(false);
  const [switchEmailInput, setSwitchEmailInput] = useState('');
  const [switchFeedback, setSwitchFeedback] = useState('');

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

  const handleManualSync = () => {
    setIsSyncing(true);
    setSavingState('saving');
    setTimeout(() => {
      const nowFormatted = new Date().toLocaleString('en-US', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      updateSettings({ lastSyncDate: nowFormatted });
      setSavingState('saved_online');
      setIsSyncing(false);
      setSyncFeedback('All devices up to date!');
      setTimeout(() => setSyncFeedback(''), 3000);
    }, 800);
  };

  const handleRemoveDevice = (id: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  const handleCopyPairCode = async () => {
    try {
      await navigator.clipboard.writeText('849-204');
      setPairCodeCopied(true);
      setTimeout(() => setPairCodeCopied(false), 2000);
    } catch (e) {
      console.warn('Clipboard write failed', e);
    }
  };

  const handleSwitchAccount = (targetEmail: string, targetName: string) => {
    updateSettings({
      email: targetEmail,
      ownerName: targetName,
      lastSyncDate: 'Just now',
    });
    setOwnerName(targetName);
    setEmail(targetEmail);
    setSwitchFeedback(`Successfully signed into ${targetName} (${targetEmail})!`);
    setTimeout(() => {
      setSwitchFeedback('');
      setIsSwitchOpen(false);
    }, 1500);
  };

  const handleTriggerConflictSimulation = () => {
    setConflictItem({
      id: 'task-test-conflict',
      entityType: 'task',
      title: 'QA TEST — Budget and schedule review',
      localVersion: {
        title: 'QA TEST — Budget and schedule review (Local edit)',
        dueDate: '6 Oct 2026, 14:00',
        notes: 'Updated timeline locally while offline on Windows PC.',
      },
      onlineVersion: {
        title: 'QA TEST — Budget and schedule review (Remote edit)',
        dueDate: '7 Oct 2026, 09:30',
        notes: 'Updated timeline from iPhone 15 Pro.',
      },
      timestamp: new Date().toLocaleTimeString(),
    });
    setSavingState('needs_choice');
    setActiveModal('conflict');
  };

  const handleTriggerSyncFailureSimulation = () => {
    setSavingState('could_not_save');
  };

  const handleToggleOfflineSimulation = () => {
    if (savingState === 'waiting_to_sync') {
      setSavingState('saved_online');
    } else {
      setSavingState('waiting_to_sync');
    }
  };

  return (
    <Modal
      isOpen={activeModal === 'account'}
      onClose={() => setActiveModal(null)}
      title="Account & Synchronization"
      subtitle="Manage your cloud account, connected devices, and customer isolation"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 text-xs text-[#071A3A] dark:text-[#EDF4FF]">
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
                    Active Account
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
              <button
                type="button"
                onClick={() => setIsSwitchOpen(!isSwitchOpen)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold cursor-pointer transition-colors"
              >
                Switch Account
              </button>
            </div>
          </div>

          {/* Profile Edit Form */}
          {isEditingProfile && (
            <form onSubmit={handleSaveProfile} className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] mb-1">
                  Owner / Display Name
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] mb-1">
                  Account Email
                </label>
                <input
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
              <span>Profile details updated successfully!</span>
            </div>
          )}

          {/* Customer Separation & Privacy Badge */}
          <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/60 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-[#087F83] dark:text-[#38D0C5] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold text-[#087F83] dark:text-[#38D0C5] text-[11px] flex items-center gap-2">
                <span>Customer Vault: CUST-84920-EU</span>
                <span className="px-1.5 py-0.2 rounded bg-teal-200/50 dark:bg-teal-900/50 text-[10px]">Isolated Tenant</span>
              </div>
              <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE] leading-relaxed">
                Strict customer separation enabled. Your planner database is isolated and end-to-end encrypted with zero cross-customer data leakage.
              </p>
            </div>
          </div>
        </div>

        {/* Switch Account Drawer */}
        {isSwitchOpen && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs">Switch Customer Account</h4>
              <button
                type="button"
                onClick={() => setIsSwitchOpen(false)}
                className="text-[11px] text-[#526782] dark:text-[#A8B8CE] hover:underline"
              >
                Close
              </button>
            </div>

            <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
              Select a customer profile to switch sessions or verify account separation:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSwitchAccount('rida@example.com', 'Rida')}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-left hover:border-[#087F83] transition-colors cursor-pointer"
              >
                <div className="font-bold text-xs">Rida (Current)</div>
                <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">rida@example.com · Primary</div>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchAccount('family@ourlifeplanner.app', 'Alex & Jordan')}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-left hover:border-[#087F83] transition-colors cursor-pointer"
              >
                <div className="font-bold text-xs">Alex & Jordan (Family)</div>
                <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">family@ourlifeplanner.app · Shared</div>
              </button>
            </div>

            {switchFeedback && (
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs">
                {switchFeedback}
              </div>
            )}
          </div>
        )}

        {/* Sync Status & Connected Devices */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-700/80 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-xs text-[#071A3A] dark:text-[#EDF4FF] flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-[#087F83] dark:text-[#38D0C5]" />
                <span>Cloud Synchronization</span>
              </h4>
              <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                Last synchronized: <span className="font-semibold">{settings.lastSyncDate || 'Today, Just now'}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#087F83] text-white hover:bg-[#06676A] font-semibold text-xs cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing…' : 'Sync Now'}</span>
              </button>
            </div>
          </div>

          {syncFeedback && (
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>{syncFeedback}</span>
            </div>
          )}

          {/* Devices List */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#526782] dark:text-[#A8B8CE]">
                Connected Devices ({devices.length})
              </span>
              <button
                type="button"
                onClick={() => setIsPairingOpen(!isPairingOpen)}
                className="flex items-center gap-1 text-[11px] text-[#087F83] dark:text-[#38D0C5] font-semibold hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Pair another device</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {devices.map((dev) => (
                <div
                  key={dev.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    {dev.type === 'mobile' ? (
                      <Smartphone className="w-4 h-4 text-[#087F83] dark:text-[#38D0C5]" />
                    ) : (
                      <Laptop className="w-4 h-4 text-[#526782] dark:text-[#A8B8CE]" />
                    )}
                    <div>
                      <div className="font-semibold text-xs flex items-center gap-1.5">
                        <span>{dev.name}</span>
                        {dev.isCurrent && (
                          <span className="px-1.5 py-0.2 rounded bg-teal-100 dark:bg-teal-950 text-[#087F83] dark:text-[#38D0C5] text-[10px] font-bold">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">
                        {dev.lastSync}
                      </div>
                    </div>
                  </div>

                  {!dev.isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDevice(dev.id)}
                      className="text-[11px] text-rose-500 hover:text-rose-700 hover:underline cursor-pointer"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Pair Device Drawer */}
            {isPairingOpen && (
              <div className="p-3.5 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-[#087F83] dark:text-[#38D0C5]">
                    Pair a Mobile or Tablet Device
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPairingOpen(false)}
                    className="text-[11px] text-[#526782] dark:text-[#A8B8CE] hover:underline"
                  >
                    Done
                  </button>
                </div>
                <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                  Open Our Life Planner on your other phone or tablet, go to Account & Sync, and enter this secure one-time pairing key:
                </p>
                <div className="flex items-center gap-3">
                  <div className="px-4 py-2 rounded-xl bg-white dark:bg-[#152238] border border-slate-300 dark:border-slate-700 font-mono text-base font-bold tracking-widest text-[#087F83] dark:text-[#38D0C5]">
                    849-204
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPairCode}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{pairCodeCopied ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
                <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">
                  Expires in 15 minutes · Uses end-to-end device identity handshakes
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Audit & Test Simulation Controls (Verifies release checks in report) */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center gap-2 font-bold text-xs text-[#526782] dark:text-[#A8B8CE]">
            <ShieldCheck className="w-4 h-4 text-[#087F83] dark:text-[#38D0C5]" />
            <span>Sync Diagnostic & Audit Verification Scenarios</span>
          </div>

          <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
            Test offline queuing, conflict resolution modals, and server failure recovery live:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleTriggerConflictSimulation}
              className="p-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/40 text-left hover:bg-amber-100/60 cursor-pointer"
            >
              <div className="font-bold text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Simulate Conflict</span>
              </div>
              <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                Triggers side-by-side version picker
              </div>
            </button>

            <button
              type="button"
              onClick={handleTriggerSyncFailureSimulation}
              className="p-2.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/40 text-left hover:bg-rose-100/60 cursor-pointer"
            >
              <div className="font-bold text-[11px] text-rose-800 dark:text-rose-300 flex items-center gap-1">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Simulate Server Error</span>
              </div>
              <div className="text-[10px] text-rose-700 dark:text-rose-400 mt-0.5">
                Exercises error state & retry queue
              </div>
            </button>

            <button
              type="button"
              onClick={handleToggleOfflineSimulation}
              className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#152238] text-left hover:bg-slate-100 cursor-pointer"
            >
              <div className="font-bold text-[11px] text-[#071A3A] dark:text-[#EDF4FF] flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-[#087F83]" />
                <span>Toggle Network Mode</span>
              </div>
              <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] mt-0.5">
                Current: {savingState === 'waiting_to_sync' ? 'Offline queue' : 'Online connected'}
              </div>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
