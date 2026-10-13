import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import {
  HelpCircle,
  BookOpen,
  Cloud,
  Database,
  ArrowRight,
  ShieldCheck,
  Printer,
  Smartphone,
  Laptop,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Mail,
  Download,
} from 'lucide-react';
import {
  APP_VERSION,
  APP_RELEASE_NAME,
  SUPPORT_EMAIL,
  SUPPORT_HOURS,
  OFFLINE_FILE_NAME,
} from '../../utils/releaseInfo';

export const GuideModal: React.FC = () => {
  const { activeModal, setActiveModal } = usePlanner();
  const [activeArticle, setActiveArticle] = useState<string>('getting_started');

  const articles: Record<
    string,
    { title: string; subtitle: string; content: React.ReactNode }
  > = {
    getting_started: {
      title: 'Getting started & product walkthrough',
      subtitle: 'Master the daily planning loop: Capture → Schedule → Complete → Review',
      content: (
        <div className="space-y-4 text-xs text-[#526782] dark:text-[#A8B8CE]">
          <p>
            Welcome to <strong>Our Life Planner</strong>. The planner is designed around a single dependable daily loop that eliminates cognitive clutter:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-[#071A3A] dark:text-[#EDF4FF] block mb-1">
                1. Capture
              </span>
              Dump thoughts into the Brain Dump inbox or Quick Add modal without friction.
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-[#071A3A] dark:text-[#EDF4FF] block mb-1">
                2. Schedule
              </span>
              Assign due dates or schedule explicit time blocks directly from the Calendar, Task editor, or Quick Add.
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-[#071A3A] dark:text-[#EDF4FF] block mb-1">
                3. Complete
              </span>
              Use the calm <strong>Focus View</strong> (one task at a time) or Today dashboard to stay on track.
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-[#071A3A] dark:text-[#EDF4FF] block mb-1">
                4. Review
              </span>
              Use the <strong>Weekly Review</strong> to triage overdue items, celebrate wins, and set intentions.
            </div>
          </div>

          <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-[#087F83] dark:text-[#38D0C5]">
                Printable quick reference
              </div>
              <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                Generate a clean, printable 1-page quick start cheat sheet or PDF export
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#087F83] text-white font-semibold text-xs hover:bg-[#06676A] shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      ),
    },
    editions: {
      title: 'Online vs Downloaded Offline editions',
      subtitle: 'What is included in each edition and how data is managed',
      content: (
        <div className="space-y-4 text-xs text-[#526782] dark:text-[#A8B8CE]">
          <p>
            Your purchase includes complete access to both editions with zero recurring subscription fees:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-[#071A3A] dark:text-[#EDF4FF]">
                  <th className="py-2 pr-3 font-bold">Feature</th>
                  <th className="py-2 px-3 font-bold bg-slate-50 dark:bg-slate-800/40 rounded-t-lg">
                    Standalone HTML File
                  </th>
                  <th className="py-2 pl-3 font-bold">Web Browser Edition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  <td className="py-2 pr-3 font-medium">Storage Location</td>
                  <td className="py-2 px-3 bg-slate-50/60 dark:bg-slate-800/20 font-mono text-[11px]">
                    Local file storage (localStorage)
                  </td>
                  <td className="py-2 pl-3 font-mono text-[11px]">
                    Local browser storage (localStorage)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-medium">Internet Required</td>
                  <td className="py-2 px-3 bg-slate-50/60 dark:bg-slate-800/20 text-emerald-600 dark:text-emerald-400 font-semibold">
                    100% Offline (No wifi)
                  </td>
                  <td className="py-2 pl-3">Only to load initial web assets</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-medium">Account / Login</td>
                  <td className="py-2 px-3 bg-slate-50/60 dark:bg-slate-800/20">
                    None required
                  </td>
                  <td className="py-2 pl-3">None required (Private local profile)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-medium">Data Privacy</td>
                  <td className="py-2 px-3 bg-slate-50/60 dark:bg-slate-800/20 text-emerald-600 dark:text-emerald-400 font-semibold">
                    Zero data leaves device
                  </td>
                  <td className="py-2 pl-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                    Zero data leaves device
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-medium">Cross-device transfer</td>
                  <td className="py-2 px-3 bg-slate-50/60 dark:bg-slate-800/20">
                    JSON Backup file export/import
                  </td>
                  <td className="py-2 pl-3 text-teal-600 dark:text-teal-400 font-semibold">
                    JSON Backup file export/import
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-medium">Subscription fees</td>
                  <td className="py-2 px-3 bg-slate-50/60 dark:bg-slate-800/20 font-bold text-emerald-600 dark:text-emerald-400">
                    $0 (Forever free)
                  </td>
                  <td className="py-2 pl-3 font-bold text-emerald-600 dark:text-emerald-400">
                    $0 (Forever free)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            You can export your data at any time from Settings &gt; Data & Storage or download an independent offline HTML bundle.
          </p>
        </div>
      ),
    },
    compatibility: {
      title: 'Device & browser compatibility',
      subtitle: 'First-class experience on phone, tablet, and desktop',
      content: (
        <div className="space-y-4 text-xs text-[#526782] dark:text-[#A8B8CE]">
          <p>
            Our Life Planner is built as a progressive web application (PWA) tested on modern browsers across all major mobile and desktop platforms:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                <Smartphone className="w-4 h-4 text-teal-600" />
                iOS (iPhone / iPad)
              </div>
              <p className="text-[11px]">
                Safari 15+, Chrome, Edge. Full support for &ldquo;Add to Home Screen&rdquo; with offline caching.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                <Smartphone className="w-4 h-4 text-teal-600" />
                Android Phones & Tablets
              </div>
              <p className="text-[11px]">
                Chrome 90+, Samsung Internet, Firefox. 1-tap app install to home screen.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                <Laptop className="w-4 h-4 text-teal-600" />
                Desktop (Mac / Windows / Linux)
              </div>
              <p className="text-[11px]">
                Google Chrome, Microsoft Edge, Apple Safari, Mozilla Firefox, Brave.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-[#087F83] dark:text-[#38D0C5]">
                Install as a phone or desktop app
              </div>
              <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                View step-by-step instructions for adding the planner to your phone Home Screen
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal('pwa_install')}
              className="px-3 py-1.5 rounded-xl bg-[#087F83] text-white font-semibold text-xs hover:bg-[#06676A] shrink-0 cursor-pointer"
            >
              Open install guide
            </button>
          </div>
        </div>
      ),
    },
    tools_15: {
      title: 'The 15 integrated planner tools',
      subtitle: 'Complete list of modules and their role in your life system',
      content: (
        <div className="space-y-3 text-xs text-[#526782] dark:text-[#A8B8CE]">
          <p>You can hide or enable any of these modules in Settings &gt; Module Customization:</p>
          <div className="space-y-2">
            <div><strong>1. Daily planning:</strong> Today dashboard, Calendar, Tasks & insights, Routines & recurrence, Brain-dump inbox.</div>
            <div><strong>2. Progress:</strong> Goals & milestone checklists, Habits & streaks (with forgiving rest days).</div>
            <div><strong>3. Money:</strong> Budget & bills ledger, Savings pots, Debt payoff forecast (Snowball/Avalanche).</div>
            <div><strong>4. Food:</strong> Weekly meals & food library, Groceries list generator.</div>
            <div><strong>5. Health:</strong> Workout training log, Weight & CDC BMI (up to 8 profiles), Hydration water tracker.</div>
          </div>
        </div>
      ),
    },
    saving_backups: {
      title: 'Saving states & data recovery',
      subtitle: 'How your planner data persists locally and how to create backups',
      content: (
        <div className="space-y-3 text-xs text-[#526782] dark:text-[#A8B8CE]">
          <p>
            Your planner data is persistently stored in your browser using structured local storage (<code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">localStorage</code>). No data leaves your machine.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Saved locally:</strong> Confirmed saved safely in this browser&apos;s local database.</li>
            <li><strong>Storage issue:</strong> Indicated if your browser quota is exceeded or storage is disabled.</li>
            <li><strong>Version review:</strong> Displayed if comparing different backup snapshots during restoration.</li>
          </ul>
          <p className="pt-2">
            <strong>Data safety recommendation:</strong> Export a JSON backup once a week from Settings &gt; Data & Storage to keep a permanent local snapshot of your life data or transfer to another device.
          </p>
        </div>
      ),
    },
    updates: {
      title: 'Release information & updates',
      subtitle: `${APP_RELEASE_NAME} · Changelog & update guide`,
      content: (
        <div className="space-y-3 text-xs text-[#526782] dark:text-[#A8B8CE]">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              {APP_RELEASE_NAME}
            </div>
            <ul className="list-disc pl-5 space-y-1 text-[11px]">
              <li><strong>Calm Focus View:</strong> Distraction-free single-task momentum view with 25m focus & 5m break timer.</li>
              <li><strong>Weekly Review:</strong> 4-step guided triage of wins, overdue tasks, habits, and next week intentions.</li>
              <li><strong>Moroccan Dirham (MAD / DH):</strong> Full currency formatting and Africa/Casablanca timezone support.</li>
              <li><strong>Schedule Conflict Detection:</strong> Automatic badge alerts and queued resolutions for overlapping time blocks.</li>
              <li><strong>Recurring Schedule Previews:</strong> Preview future occurrences and protect rest-day streaks without fabricated values.</li>
              <li><strong>Household Member Assignment:</strong> Color-coded profiles assignable to tasks and routines.</li>
              <li><strong>Calendar .ics Export:</strong> Export appointments and tasks to Apple, Google, or Outlook calendar format.</li>
              <li><strong>Verified Accessibility:</strong> High contrast color tokens (≥4.5:1), visible focus rings, dialog focus management, explicit programmatic control labels, screen reader live regions, and reduced-motion support.</li>
            </ul>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              How Updates &amp; Upgrades Work
            </div>
            <p className="text-[11px]">
              <strong>Standalone HTML Edition:</strong> Updates are completely manual and privacy-preserving. To upgrade to a newer version of the HTML file, first export a backup from Settings &gt; Data &amp; Storage, open the new HTML file, and click <strong>Restore from Backup</strong>. Your personal data is never overwritten automatically.
            </p>
            <p className="text-[11px]">
              <strong>Web App / PWA Edition:</strong> When hosted on an online server and installed as a PWA, Service Worker caches updated static assets when your device connects to the internet.
            </p>
          </div>
        </div>
      ),
    },
    support: {
      title: 'Customer support & contact',
      subtitle: 'Official help channels, response times and direct assistance',
      content: (
        <div className="space-y-3 text-xs text-[#526782] dark:text-[#A8B8CE]">
          <p>
            Need assistance, have questions, or want to suggest an improvement? Our support team is ready to help you:
          </p>
          <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-2">
            <div className="font-bold text-xs text-[#087F83] dark:text-[#38D0C5] flex items-center gap-1.5">
              <Mail className="w-4 h-4" />
              <span>Official Support Email</span>
            </div>
            <div className="font-mono text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] select-all">
              {SUPPORT_EMAIL}
            </div>
            <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
              Response time: {SUPPORT_HOURS}
            </div>
            <div className="pt-1">
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Our%20Life%20Planner%20Support%20Request`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#087F83] dark:text-[#38D0C5] hover:underline"
              >
                <span>Send direct email</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
          <p>
            You can also open the Support &amp; Contact helper in Settings to prepare a pre-filled support email, copy environment diagnostics, or access local backup recovery tools.
          </p>
          <button
            type="button"
            onClick={() => setActiveModal('support')}
            className="px-3.5 py-1.5 rounded-xl bg-[#087F83] text-white font-semibold text-xs hover:bg-[#06676A] cursor-pointer"
          >
            Open support &amp; contact helper
          </button>
        </div>
      ),
    },
  };

  return (
    <Modal
      isOpen={activeModal === 'guide'}
      onClose={() => setActiveModal(null)}
      title="User Guide & Help"
      subtitle="Learn how to make the most of Our Life Planner"
      maxWidth="max-w-3xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[380px]">
        {/* Navigation topics */}
        <div className="md:col-span-4 border-r border-[#E2E8F0] dark:border-[#1E2D4A] pr-4 space-y-1">
          {[
            { id: 'getting_started', label: 'Getting started' },
            { id: 'editions', label: 'Online vs Offline editions' },
            { id: 'compatibility', label: 'Device & compatibility' },
            { id: 'tools_15', label: 'Using the 15 tools' },
            { id: 'saving_backups', label: 'Saving & backups' },
            { id: 'updates', label: 'Updates & changelog' },
            { id: 'support', label: 'Support & contact' },
          ].map((topic) => (
            <button
              key={topic.id}
              type="button"
              aria-selected={activeArticle === topic.id}
              onClick={() => setActiveArticle(topic.id)}
              className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeArticle === topic.id
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-[#087F83] dark:text-[#38D0C5]'
                  : 'text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {topic.label}
            </button>
          ))}
        </div>

        {/* Article content */}
        <div className="md:col-span-8 pl-2 space-y-3">
          <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            {articles[activeArticle]?.title}
          </h3>
          <p className="text-xs text-[#087F83] dark:text-[#38D0C5] font-medium pb-2 border-b border-slate-100 dark:border-slate-800">
            {articles[activeArticle]?.subtitle}
          </p>
          <div className="pt-2">{articles[activeArticle]?.content}</div>
        </div>
      </div>
    </Modal>
  );
};
