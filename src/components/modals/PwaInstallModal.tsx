import React, { useEffect, useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import {
  X,
  Smartphone,
  Share,
  PlusSquare,
  Check,
  Download,
  Laptop,
  CheckCircle2,
} from 'lucide-react';

export const PwaInstallModal: React.FC = () => {
  const { activeModal, setActiveModal } = usePlanner();
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('ios');

  useEffect(() => {
    // Detect user platform if possible
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }
  }, []);

  // Keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeModal === 'pwa_install') {
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, setActiveModal]);

  if (activeModal !== 'pwa_install') return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071A3A]/70 backdrop-blur-md animate-in fade-in"
    >
      <div className="bg-white dark:bg-[#152238] rounded-3xl max-w-lg w-full p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative flex flex-col">
        {/* Close Button */}
        <button
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
            <h2 id="install-title" className="text-lg md:text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Add to Home Screen
            </h2>
            <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              Install Our Life Planner as a standalone app on your device
            </p>
          </div>
        </div>

        {/* Platform Tabs */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-6">
          <button
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
        <div className="space-y-4 mb-6 text-xs text-[#071A3A] dark:text-[#EDF4FF]">
          {platform === 'ios' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#087F83] font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <div className="font-semibold mb-0.5">Open in Safari</div>
                  <div className="text-[#526782] dark:text-[#A8B8CE]">
                    Make sure you are browsing this page in Safari on your iPhone or iPad.
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
                    Located at the bottom of Safari's toolbar on iPhone, or top-right on iPad.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#087F83] font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <div className="font-semibold mb-0.5 flex items-center gap-1.5">
                    <span>Select "Add to Home Screen"</span>
                    <PlusSquare className="w-3.5 h-3.5 text-[#087F83]" />
                  </div>
                  <div className="text-[#526782] dark:text-[#A8B8CE]">
                    Scroll down the share sheet and tap "Add to Home Screen", then tap "Add" in the top right.
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
                  <div className="font-semibold mb-0.5">Tap "Install app" / "Add to Home Screen"</div>
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
                  <div className="font-semibold mb-0.5">Click "Install"</div>
                  <div className="text-[#526782] dark:text-[#A8B8CE]">
                    Our Life Planner will launch in its own dedicated, clean window without browser tab bars.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Benefits Note */}
        <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 text-xs mb-6">
          <div className="flex items-center gap-2 font-bold text-[#087F83] dark:text-[#38D0C5] mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>Why install as a home screen app?</span>
          </div>
          <ul className="text-[#526782] dark:text-[#A8B8CE] space-y-1 list-disc list-inside">
            <li>Instant 1-tap launch from your device screen</li>
            <li>Full screen experience with no browser address bar distraction</li>
            <li>Works completely offline whenever internet is unavailable</li>
          </ul>
        </div>

        <button
          onClick={() => setActiveModal(null)}
          className="w-full py-2.5 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
