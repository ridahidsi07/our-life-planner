import React, { useEffect, useState, useCallback } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { useDialogAccessibility } from '../ui/Modal';
import {
  X,
  Smartphone,
  Share,
  PlusSquare,
  Download,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  HardDriveDownload,
  ShieldCheck,
} from 'lucide-react';
import {
  inspectPwaOfflineStatus,
  subscribeToPwaStatus,
  checkForPwaUpdate,
  applyWaitingPwaUpdate,
  recoverPwaOfflineCache,
  triggerNativeInstallPrompt,
  PwaOfflineStatus,
} from '../../utils/pwaManager';

export const PwaInstallModal: React.FC = () => {
  const { activeModal, setActiveModal } = usePlanner();
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('ios');
  const [pwaStatus, setPwaStatus] = useState<PwaOfflineStatus | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const isOpen = activeModal === 'pwa_install';
  const { dialogRef } = useDialogAccessibility(isOpen, () => setActiveModal(null));

  const refreshStatus = useCallback(async () => {
    const status = await inspectPwaOfflineStatus();
    setPwaStatus(status);
  }, []);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setActionFeedback(null);
    void refreshStatus();
    const unsubscribe = subscribeToPwaStatus(() => {
      void refreshStatus();
    });
    return unsubscribe;
  }, [isOpen, refreshStatus]);

  if (!isOpen) return null;

  const isOfflineVerified =
    pwaStatus?.mode === 'sw_cached_ready' || pwaStatus?.mode === 'standalone_file';

  const handleCheckUpdate = async () => {
    setIsBusy(true);
    setActionFeedback(null);
    try {
      const res = await checkForPwaUpdate();
      await refreshStatus();
      if (!res.checked) {
        setActionFeedback('Update checks require an active HTTP/HTTPS Service Worker session.');
      } else if (res.updateAvailable) {
        setActionFeedback('A new version is ready to activate.');
      } else {
        setActionFeedback('App shell is up to date.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleApplyUpdate = async () => {
    setIsBusy(true);
    setActionFeedback(null);
    try {
      const applied = await applyWaitingPwaUpdate();
      await refreshStatus();
      if (applied) {
        setActionFeedback('Updated Service Worker activated.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleRepairCache = async () => {
    setIsBusy(true);
    setActionFeedback(null);
    try {
      const updated = await recoverPwaOfflineCache();
      setPwaStatus(updated);
      if (updated.isShellComplete) {
        setActionFeedback(
          `Offline app shell cache verified and rebuilt (${updated.cachedPaths.length} resources cached). Your saved planner records remain intact.`
        );
      } else {
        setActionFeedback(
          'Service Worker cache could not be completed in this environment. Use the Standalone Offline HTML bundle for guaranteed offline use.'
        );
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleNativeInstall = async () => {
    const outcome = await triggerNativeInstallPrompt();
    await refreshStatus();
    if (outcome === 'accepted') {
      setActionFeedback('Installation accepted.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071A3A]/70 backdrop-blur-md animate-in fade-in">
      <div
        className="fixed inset-0"
        onClick={() => setActiveModal(null)}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        tabIndex={-1}
        className="bg-white dark:bg-[#152238] rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative z-10 flex flex-col outline-none"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={() => setActiveModal(null)}
          aria-label="Close install instructions"
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-[#087F83] dark:text-[#38D0C5] flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="install-title"
              className="text-lg md:text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]"
            >
              Add to Home Screen &amp; Offline Setup
            </h2>
            <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              Install Our Life Planner for quick launch and verify offline startup readiness
            </p>
          </div>
        </div>

        {/* Live Offline Readiness Status Banner */}
        <div
          data-testid="pwa-offline-status-banner"
          data-offline-mode={pwaStatus?.mode || 'checking'}
          className={`p-3.5 rounded-2xl border text-xs mb-5 ${
            isOfflineVerified
              ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
              : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {isOfflineVerified ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1.5 flex-1">
              <div className="font-bold flex items-center justify-between gap-2">
                <span>
                  {pwaStatus?.mode === 'sw_cached_ready'
                    ? 'Offline App Shell Cached & Ready'
                    : pwaStatus?.mode === 'standalone_file'
                    ? 'Standalone Offline HTML Edition Active'
                    : pwaStatus?.mode === 'sw_installing'
                    ? 'Offline Cache Initializing'
                    : 'Home-Screen Shortcut Mode (Offline Cache Inactive)'}
                </span>
                {pwaStatus?.cacheName && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                    {pwaStatus.cachedPaths.length} assets cached
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                {pwaStatus?.statusSummary || 'Checking Service Worker and Cache Storage status...'}
              </p>

              {/* Update Available Prompt */}
              {pwaStatus?.updateAvailable && (
                <div className="pt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold">
                    A newer app version is waiting to activate.
                  </span>
                  <button
                    type="button"
                    data-testid="pwa-apply-update-btn"
                    onClick={handleApplyUpdate}
                    disabled={isBusy}
                    className="px-2.5 py-1 rounded-lg bg-[#087F83] text-white text-[11px] font-semibold hover:bg-[#06676A] cursor-pointer"
                  >
                    Apply Update
                  </button>
                </div>
              )}

              {/* Cache Maintenance & Recovery Controls */}
              {pwaStatus?.mode !== 'standalone_file' && (
                <div className="pt-1.5 flex flex-wrap items-center gap-2">
                  {pwaStatus?.canPromptInstall && (
                    <button
                      type="button"
                      data-testid="pwa-native-install-btn"
                      onClick={handleNativeInstall}
                      className="px-2.5 py-1 rounded-lg bg-[#087F83] text-white text-[11px] font-semibold hover:bg-[#06676A] cursor-pointer"
                    >
                      Install App Now
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid="pwa-check-update-btn"
                    onClick={handleCheckUpdate}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-current/20 hover:bg-black/5 dark:hover:bg-white/5 text-[11px] font-semibold cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isBusy ? 'animate-spin' : ''}`} />
                    <span>Check for update</span>
                  </button>
                  <button
                    type="button"
                    data-testid="pwa-repair-cache-btn"
                    onClick={handleRepairCache}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-current/20 hover:bg-black/5 dark:hover:bg-white/5 text-[11px] font-semibold cursor-pointer"
                  >
                    <span>Verify &amp; repair offline cache</span>
                  </button>
                </div>
              )}

              {actionFeedback && (
                <p
                  data-testid="pwa-action-feedback"
                  className="text-[11px] font-medium pt-1"
                >
                  {actionFeedback}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Platform Tabs */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-5">
          <button
            type="button"
            onClick={() => setPlatform('ios')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              platform === 'ios'
                ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            iPhone / iPad
          </button>
          <button
            type="button"
            onClick={() => setPlatform('android')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              platform === 'android'
                ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Android
          </button>
          <button
            type="button"
            onClick={() => setPlatform('desktop')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              platform === 'desktop'
                ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Desktop Chrome/Edge
          </button>
        </div>

        {/* Instructions by Platform */}
        <div className="space-y-4 mb-5 text-xs text-[#071A3A] dark:text-[#EDF4FF]">
          {platform === 'ios' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#087F83] font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <div className="font-semibold mb-0.5">Open in Safari</div>
                  <div className="text-[#526782] dark:text-[#A8B8CE]">
                    Open this page in Safari on your iPhone or iPad while connected once so the app shell can cache.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#087F83] font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <div className="font-semibold mb-0.5 flex items-center gap-1.5">
                    <span>Tap the Share Button</span>
                    <Share className="w-3.5 h-3.5 text-[#087F83]" />
                  </div>
                  <div className="text-[#526782] dark:text-[#A8B8CE]">
                    Located at the bottom of Safari&apos;s toolbar on iPhone, or top-right on iPad.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#087F83] font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <div className="font-semibold mb-0.5 flex items-center gap-1.5">
                    <span>Select &ldquo;Add to Home Screen&rdquo;</span>
                    <PlusSquare className="w-3.5 h-3.5 text-[#087F83]" />
                  </div>
                  <div className="text-[#526782] dark:text-[#A8B8CE]">
                    Scroll down the share sheet and tap &ldquo;Add to Home Screen&rdquo;, then tap &ldquo;Add&rdquo; in the top right.
                  </div>
                </div>
              </div>
            </div>
          )}

          {platform === 'android' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#087F83] font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <div className="font-semibold mb-0.5">Open in Google Chrome</div>
                  <div className="text-[#526782] dark:text-[#A8B8CE]">
                    Navigate to Our Life Planner in Chrome on your Android phone or tablet.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#087F83] font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <div className="font-semibold mb-0.5">Tap Chrome Menu (⋮)</div>
                  <div className="text-[#526782] dark:text-[#A8B8CE]">
                    Tap the three vertical dots in the top right corner of Chrome.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#087F83] font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <div className="font-semibold mb-0.5">Tap &ldquo;Install app&rdquo; / &ldquo;Add to Home Screen&rdquo;</div>
                  <div className="text-[#526782] dark:text-[#A8B8CE]">
                    Confirm the prompt. An icon will appear on your home screen and app drawer.
                  </div>
                </div>
              </div>
            </div>
          )}

          {platform === 'desktop' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#087F83] font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <div className="font-semibold mb-0.5 flex items-center gap-1.5">
                    <span>Look for the Install Icon</span>
                    <Download className="w-3.5 h-3.5 text-[#087F83]" />
                  </div>
                  <div className="text-[#526782] dark:text-[#A8B8CE]">
                    In Chrome or Edge, click the computer/install icon located on the right side of the URL bar.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#087F83] font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <div className="font-semibold mb-0.5">Click &ldquo;Install&rdquo;</div>
                  <div className="text-[#526782] dark:text-[#A8B8CE]">
                    Our Life Planner will launch in its own dedicated window without browser tab bars.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Truthful Capabilities & Standalone Fallback Note */}
        <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 text-xs mb-5 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-[#087F83] dark:text-[#38D0C5]">
            <CheckCircle2 className="w-4 h-4" />
            <span>What Home-Screen Installation Provides</span>
          </div>
          <ul className="text-[#526782] dark:text-[#A8B8CE] space-y-1 list-disc list-inside">
            <li>1-tap launch shortcut from your home screen, dock, or app drawer</li>
            <li>Dedicated standalone window without browser address bar clutter</li>
            {isOfflineVerified ? (
              <li>
                Verified Service Worker app-shell cache for offline startup in this browser profile
              </li>
            ) : (
              <li>
                Home-screen shortcuts rely on browser cache storage; for guaranteed offline startup without a Service Worker, download the Standalone Offline HTML bundle below
              </li>
            )}
          </ul>

          <div className="pt-1 border-t border-teal-200/60 dark:border-teal-800/60 flex items-center justify-between gap-3">
            <span className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
              Want a permanent single-file copy that opens offline from any folder?
            </span>
            <button
              type="button"
              data-testid="pwa-open-standalone-download-btn"
              onClick={() => setActiveModal('download_offline')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#152238] border border-teal-300 dark:border-teal-700 text-[#087F83] dark:text-[#38D0C5] text-[11px] font-semibold hover:bg-teal-50 cursor-pointer shrink-0"
            >
              <HardDriveDownload className="w-3.5 h-3.5" />
              <span>Standalone HTML</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveModal(null)}
          className="w-full py-2.5 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
