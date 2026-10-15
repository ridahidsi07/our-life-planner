import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import {
  Mail,
  HardDrive,
  ShieldCheck,
  Download,
  Database,
  Check,
  FileText,
  Cloud,
  RefreshCw,
  KeyRound,
  LogOut,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import {
  registerCloudAccount,
  loginCloudAccount,
  logoutCloudAccount,
  recoverCloudAccount,
  exportCloudData,
  deleteCloudAccount,
  getStoredCloudSyncState,
  getCloudApiBaseUrl,
  setCloudApiBaseUrl,
} from '../../utils/cloudSyncClient';
import { STORAGE_KEY_DATA, STORAGE_KEY_SETTINGS } from '../../utils/storageCoordinator';

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
    cloudSyncState,
    setCloudSyncState,
    syncWithCloudNow,
  } = usePlanner();

  // Local profile editing (explicitly local-only)
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  const [email, setEmail] = useState(settings.email || 'user@example.com');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(false);

  // Online Cloud Account state
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'recover'>('login');
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [cloudDisplayName, setCloudDisplayName] = useState(settings.ownerName || '');
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [newRecoveryPassword, setNewRecoveryPassword] = useState('');
  const [issuedRecoveryKey, setIssuedRecoveryKey] = useState<string | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudMessage, setCloudMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [migrationChoice, setMigrationChoice] = useState<'merge' | 'use_cloud' | 'overwrite_cloud'>('merge');
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState(() => getCloudApiBaseUrl());
  const [showEndpointConfig, setShowEndpointConfig] = useState(false);

  const isCloudConnected = cloudSyncState.status !== 'disconnected' && Boolean(cloudSyncState.accountId);

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

  const handleCloudAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCloudLoading(true);
    setCloudMessage(null);
    if (apiEndpoint.trim()) {
      setCloudApiBaseUrl(apiEndpoint.trim());
    }

    try {
      if (authTab === 'register') {
        const res = await registerCloudAccount({
          email: cloudEmail,
          password: cloudPassword,
          displayName: cloudDisplayName || settings.ownerName || 'Planner User',
        });
        setCloudSyncState(getStoredCloudSyncState());
        if (res.success) {
          setIssuedRecoveryKey(res.recoveryKey || null);
          setCloudPassword('');
          setCloudMessage({
            type: 'success',
            text: 'Online account created! Save your one-time recovery key below, then click Sync Now.',
          });
        } else {
          setCloudMessage({ type: 'error', text: res.error || 'Could not register account.' });
        }
      } else if (authTab === 'login') {
        const res = await loginCloudAccount({
          email: cloudEmail,
          password: cloudPassword,
        });
        setCloudSyncState(getStoredCloudSyncState());
        if (res.success) {
          setCloudPassword('');
          setCloudMessage({
            type: 'success',
            text: 'Signed in to Online Account. Choose a sync mode below or click Sync Now.',
          });
        } else {
          setCloudMessage({ type: 'error', text: res.error || 'Invalid credentials.' });
        }
      } else {
        const res = await recoverCloudAccount({
          email: cloudEmail,
          recoveryKey: recoveryKeyInput,
          newPassword: newRecoveryPassword,
        });
        setCloudSyncState(getStoredCloudSyncState());
        if (res.success) {
          setIssuedRecoveryKey(res.recoveryKey || null);
          setRecoveryKeyInput('');
          setNewRecoveryPassword('');
          setCloudMessage({
            type: 'success',
            text: 'Account recovered and password updated! A new recovery key has been issued below.',
          });
        } else {
          setCloudMessage({ type: 'error', text: res.error || 'Account recovery failed.' });
        }
      }
    } finally {
      setCloudLoading(false);
    }
  };

  const handleSyncNow = async () => {
    setCloudLoading(true);
    setCloudMessage(null);
    try {
      const res = await syncWithCloudNow(migrationChoice);
      if (res.success) {
        setCloudMessage({
          type: 'success',
          text:
            res.conflicts && res.conflicts.length > 0
              ? `Synced (revision ${res.serverRevision}) with ${res.conflicts.length} conflict(s) queued for review.`
              : `Synced with cloud account (revision ${res.serverRevision}).`,
        });
      } else {
        setCloudMessage({ type: 'error', text: res.error || 'Cloud sync failed.' });
      }
    } finally {
      setCloudLoading(false);
    }
  };

  const handleCloudExport = async () => {
    setCloudLoading(true);
    setCloudMessage(null);
    try {
      const res = await exportCloudData();
      if (res.success && res.backup) {
        const blob = new Blob([JSON.stringify(res.backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cloud-account-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setCloudMessage({ type: 'success', text: 'Cloud account backup exported.' });
      } else {
        setCloudMessage({ type: 'error', text: res.error || 'Could not export cloud snapshot.' });
      }
    } finally {
      setCloudLoading(false);
    }
  };

  const handleSignOut = async () => {
    setCloudLoading(true);
    await logoutCloudAccount();
    setCloudSyncState(getStoredCloudSyncState());
    setIssuedRecoveryKey(null);
    setConfirmDeleteAccount(false);
    setCloudMessage({ type: 'success', text: 'Signed out of online account. Local data remains intact.' });
    setCloudLoading(false);
  };

  const handleDeleteCloudAccount = async () => {
    setCloudLoading(true);
    const res = await deleteCloudAccount();
    setCloudSyncState(getStoredCloudSyncState());
    setConfirmDeleteAccount(false);
    setIssuedRecoveryKey(null);
    if (res.success) {
      setCloudMessage({
        type: 'success',
        text: 'Online cloud account and server data permanently deleted. Local browser data was preserved.',
      });
    } else {
      setCloudMessage({ type: 'error', text: res.error || 'Failed to delete online account.' });
    }
    setCloudLoading(false);
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
    const rawData = localStorage.getItem(STORAGE_KEY_DATA) || '';
    const rawSettings = localStorage.getItem(STORAGE_KEY_SETTINGS) || '';
    estimatedStorageKb = Math.round((rawData.length + rawSettings.length) / 1024);
  } catch {
    estimatedStorageKb = 15;
  }

  return (
    <Modal
      isOpen={activeModal === 'account'}
      onClose={() => setActiveModal(null)}
      title="Profile, Local Storage & Online Account"
      subtitle="Manage your local device profile, browser storage, and optional cross-device cloud sync"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5 text-xs text-[#071A3A] dark:text-[#EDF4FF]">
        {/* Local Profile Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-700/80 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center font-bold text-lg shadow-xs">
                {(ownerName || 'M').charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                    {ownerName || 'Me'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                    Local Device Profile Only
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
                  Local Contact Email (Metadata)
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
                  className="px-3.5 py-1.5 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] hover:bg-[var(--btn-primary-hover-bg)] font-semibold text-xs cursor-pointer transition-colors"
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
            Local profile fields are stored on this device for greetings, default task ownership, and backup metadata. Editing these fields does <strong>not</strong> create or sign in to a cloud account.
          </div>
        </div>

        {/* Online Account & Cross-Device Cloud Sync (LP-01) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-700/80 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-[var(--accent)]" />
              <h4 className="font-bold text-xs text-[#071A3A] dark:text-[#EDF4FF]">
                Online Account & Cross-Device Sync
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isCloudConnected
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-[#526782] dark:text-[#A8B8CE]'
                }`}
              >
                {isCloudConnected
                  ? `Connected (${cloudSyncState.email}) · Rev ${cloudSyncState.serverRevision}`
                  : 'Offline / Local-Only Mode'}
              </span>
              <button
                type="button"
                onClick={() => setShowEndpointConfig(!showEndpointConfig)}
                className="text-[10px] text-[var(--accent)] hover:underline cursor-pointer"
              >
                {showEndpointConfig ? 'Hide server URL' : 'Server URL'}
              </button>
            </div>
          </div>

          {showEndpointConfig && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <label htmlFor="cloud-api-endpoint" className="text-[11px] font-semibold shrink-0">
                Sync API URL:
              </label>
              <input
                id="cloud-api-endpoint"
                type="url"
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                className="flex-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  setCloudApiBaseUrl(apiEndpoint);
                  setShowEndpointConfig(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] hover:bg-[var(--btn-primary-hover-bg)] text-[11px] font-semibold cursor-pointer"
              >
                Apply
              </button>
            </div>
          )}

          {issuedRecoveryKey && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200 text-xs">
                <KeyRound className="w-4 h-4" />
                <span>Save Your One-Time Recovery Key</span>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                Store this key in a password manager. You will need it to reset your password if you ever lose access:
              </p>
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 font-mono text-xs font-bold select-all">
                <span>{issuedRecoveryKey}</span>
                <button
                  type="button"
                  onClick={() => setIssuedRecoveryKey(null)}
                  className="text-[10px] font-sans font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                >
                  I saved it
                </button>
              </div>
            </div>
          )}

          {cloudMessage && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                cloudMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900'
              }`}
            >
              {cloudMessage.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{cloudMessage.text}</span>
            </div>
          )}

          {!isCloudConnected ? (
            <div className="space-y-3">
              <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                Offline use is 100% independent. Sign in or create an Online Account to synchronize versioned planner snapshots across devices.
              </p>

              <div className="flex gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
                {(['login', 'register', 'recover'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setAuthTab(tab);
                      setCloudMessage(null);
                    }}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                      authTab === tab
                        ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]'
                        : 'bg-slate-100 dark:bg-slate-800 text-[#526782] dark:text-[#A8B8CE]'
                    }`}
                  >
                    {tab === 'login'
                      ? 'Sign In'
                      : tab === 'register'
                      ? 'Create Account'
                      : 'Recover Password'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleCloudAuthSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="cloud-auth-email" className="block text-[11px] font-semibold mb-1">
                    Account Email
                  </label>
                  <input
                    id="cloud-auth-email"
                    type="email"
                    required
                    value={cloudEmail}
                    onChange={(e) => setCloudEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs"
                  />
                </div>

                {authTab === 'register' && (
                  <div>
                    <label htmlFor="cloud-auth-display-name" className="block text-[11px] font-semibold mb-1">
                      Display Name
                    </label>
                    <input
                      id="cloud-auth-display-name"
                      type="text"
                      value={cloudDisplayName}
                      onChange={(e) => setCloudDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs"
                    />
                  </div>
                )}

                {authTab !== 'recover' ? (
                  <div className={authTab === 'register' ? 'sm:col-span-2' : ''}>
                    <label htmlFor="cloud-auth-password" className="block text-[11px] font-semibold mb-1">
                      Password (min 8 chars)
                    </label>
                    <input
                      id="cloud-auth-password"
                      type="password"
                      required
                      minLength={8}
                      value={cloudPassword}
                      onChange={(e) => setCloudPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label htmlFor="cloud-recovery-key" className="block text-[11px] font-semibold mb-1">
                        One-Time Recovery Key
                      </label>
                      <input
                        id="cloud-recovery-key"
                        type="text"
                        required
                        value={recoveryKeyInput}
                        onChange={(e) => setRecoveryKeyInput(e.target.value)}
                        placeholder="OLP-XXXX-XXXX-XXXX-XXXX"
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="cloud-new-password" className="block text-[11px] font-semibold mb-1">
                        New Password (min 8 chars)
                      </label>
                      <input
                        id="cloud-new-password"
                        type="password"
                        required
                        minLength={8}
                        value={newRecoveryPassword}
                        onChange={(e) => setNewRecoveryPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs"
                      />
                    </div>
                  </>
                )}

                <div className="sm:col-span-2 flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={cloudLoading}
                    className="px-4 py-1.5 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] font-semibold text-xs hover:bg-[var(--btn-primary-hover-bg)] disabled:opacity-50 cursor-pointer"
                  >
                    {cloudLoading
                      ? 'Connecting…'
                      : authTab === 'login'
                      ? 'Sign In to Cloud'
                      : authTab === 'register'
                      ? 'Create Online Account'
                      : 'Reset Password with Recovery Key'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                  <div className="text-[#526782] dark:text-[#A8B8CE]">Plan & Entitlement</div>
                  <div className="font-bold mt-0.5 capitalize">
                    {cloudSyncState.entitlement?.plan || 'online_plus'} ({cloudSyncState.entitlement?.status || 'active'})
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                  <div className="text-[#526782] dark:text-[#A8B8CE]">Server Revision</div>
                  <div className="font-bold mt-0.5">v{cloudSyncState.serverRevision}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                  <div className="text-[#526782] dark:text-[#A8B8CE]">Last Synced</div>
                  <div className="font-bold mt-0.5 truncate">
                    {cloudSyncState.lastSyncedAt
                      ? new Date(cloudSyncState.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Pending first sync'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label htmlFor="cloud-migration-mode" className="text-[11px] font-semibold shrink-0">
                  Sync / Migration Mode:
                </label>
                <select
                  id="cloud-migration-mode"
                  value={migrationChoice}
                  onChange={(e) => setMigrationChoice(e.target.value as any)}
                  className="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs"
                >
                  <option value="merge">3-Way Merge (Preserve both local & cloud changes)</option>
                  <option value="use_cloud">Use Cloud Data (Replace local with server snapshot)</option>
                  <option value="overwrite_cloud">Overwrite Cloud (Push local snapshot to server)</option>
                </select>
                <button
                  type="button"
                  disabled={cloudLoading}
                  onClick={handleSyncNow}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] font-semibold text-xs hover:bg-[var(--btn-primary-hover-bg)] disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cloudLoading ? 'animate-spin' : ''}`} />
                  <span>Sync Now</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={cloudLoading}
                    onClick={handleCloudExport}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export Cloud JSON</span>
                  </button>
                  <button
                    type="button"
                    disabled={cloudLoading}
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Sign Out</span>
                  </button>
                </div>

                {!confirmDeleteAccount ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAccount(true)}
                    className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete Online Account</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-red-600 font-semibold">Delete cloud data?</span>
                    <button
                      type="button"
                      onClick={handleDeleteCloudAccount}
                      className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAccount(false)}
                      className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Advanced Storage & Footprint Details */}
        <details
          data-testid="account-advanced-details"
          className="rounded-2xl bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-700/80 shadow-2xs p-4"
        >
          <summary className="font-bold text-xs text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer select-none flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--accent)]" />
              <span>Advanced details: Browser storage &amp; record footprint (~{estimatedStorageKb} KB)</span>
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              Active in this browser
            </span>
          </summary>

          <div className="mt-3 space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="p-3 rounded-xl bg-[var(--accent-soft)] border border-[var(--border-color)] space-y-1">
              <div className="flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-[var(--accent)]" />
                <h4 className="font-bold text-xs text-[var(--accent)]">
                  Local-First Browser Storage (localStorage)
                </h4>
              </div>
              <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE] leading-relaxed">
                All planner records are stored durably in this browser&apos;s local storage (<code className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">localStorage</code>). Unless you explicitly connect an Online Account above, zero personal data leaves your device.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-[#526782] dark:text-[#A8B8CE]">
              <span>Total records saved: <strong className="text-[#071A3A] dark:text-[#EDF4FF]">{totalItemsCount} items</strong></span>
              <span>Last backup export: <strong className="text-[#071A3A] dark:text-[#EDF4FF]">{settings.lastBackupDate || 'Not yet exported'}</strong></span>
            </div>
          </div>
        </details>

        {/* Backups & Multi-Device Transfer Guidance */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-700/80 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
            <h4 className="font-bold text-xs text-[#071A3A] dark:text-[#EDF4FF]">
              Offline Backups & Standalone Bundle
            </h4>
          </div>

          <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE] leading-relaxed">
            You can always export or restore full versioned JSON backups or download the standalone offline HTML application with zero server dependency:
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
                <Database className="w-3.5 h-3.5 text-[var(--accent)]" />
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
                <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />
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
                <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
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

