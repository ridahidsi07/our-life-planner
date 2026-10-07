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
} from 'lucide-react';

export const GuideModal: React.FC = () => {
  const { activeModal, setActiveModal } = usePlanner();
  const [activeArticle, setActiveArticle] = useState<string>('getting_started');

  const articles: Record<
    string,
    { title: string; subtitle: string; content: React.ReactNode }
  > = {
    getting_started: {
      title: 'Getting started with Our Life Planner',
      subtitle: 'Set up your daily command center and planning rhythm',
      content: (
        <div className="space-y-4 text-xs text-[#526782] dark:text-[#A8B8CE]">
          <p>
            Welcome to <strong>Our Life Planner</strong>. The application is built around three core daily actions:
          </p>
          <ol className="list-decimal pl-5 space-y-1.5 font-medium text-[#071A3A] dark:text-[#EDF4FF]">
            <li><strong>Plan the day:</strong> Review Today and schedule your time blocks, meals, and tasks.</li>
            <li><strong>Log what happened:</strong> Complete tasks, log hydration, mark meals consumed, and track workouts.</li>
            <li><strong>Review what needs attention next:</strong> Check overdue commitments, weekly progress, and budget balances.</li>
          </ol>
          <p>
            Every tool connects directly to the <strong>Today dashboard</strong> and <strong>Calendar</strong>. Whenever you complete or edit an item in any view, all connected screens update instantly without duplicates.
          </p>
        </div>
      ),
    },
    tools_15: {
      title: 'Using the 15 Tools',
      subtitle: 'Everything included in your Version 1 planner',
      content: (
        <div className="space-y-3 text-xs text-[#526782] dark:text-[#A8B8CE]">
          <p>Our Life Planner includes 15 connected tools organized into five groups:</p>
          <div className="space-y-2">
            <div><strong>1. Daily planning:</strong> Today dashboard, Calendar, Tasks & insights, Routines & recurrence, Brain-dump inbox.</div>
            <div><strong>2. Progress:</strong> Goals & milestone checklists, Habits & streaks.</div>
            <div><strong>3. Money:</strong> Budget & bills ledger, Savings pots, Debt payoff scenarios.</div>
            <div><strong>4. Food:</strong> Weekly meals & food library, Groceries list generator.</div>
            <div><strong>5. Health:</strong> Workout training log, Weight & CDC BMI (up to 8 profiles), Hydration water tracker.</div>
          </div>
        </div>
      ),
    },
    saving_backups: {
      title: 'Saving states & backups',
      subtitle: 'How your planner data persists securely',
      content: (
        <div className="space-y-3 text-xs text-[#526782] dark:text-[#A8B8CE]">
          <p>
            Your planner data is persistently stored in your browser using structured local storage and synchronized when online.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Saved online:</strong> Synchronized with the personal account cloud.</li>
            <li><strong>Saved locally:</strong> Confirmed saved on your current device.</li>
            <li><strong>Waiting to synchronize:</strong> Edits are safely stored locally while offline and will upload when reconnected.</li>
            <li><strong>Needs your choice:</strong> If you edit the same item on two devices while offline, a side-by-side comparison lets you choose which version to preserve.</li>
          </ul>
        </div>
      ),
    },
    editions: {
      title: 'Moving between editions',
      subtitle: 'Downloaded offline edition vs Online account edition',
      content: (
        <div className="space-y-3 text-xs text-[#526782] dark:text-[#A8B8CE]">
          <p>
            Your single purchase includes both editions:
          </p>
          <p>
            <strong>The Downloaded Offline Edition</strong> works 100% offline without accounts, servers or external connections. You can export a backup from Settings at any time to transfer records into the online edition or another device.
          </p>
          <p>
            Importing a backup creates an independent copy in the destination; it never creates a permanent linking dependency.
          </p>
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
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[340px]">
        {/* Navigation topics */}
        <div className="md:col-span-4 border-r border-[#E2E8F0] dark:border-[#1E2D4A] pr-4 space-y-1">
          {[
            { id: 'getting_started', label: 'Getting started' },
            { id: 'tools_15', label: 'Using the 15 tools' },
            { id: 'saving_backups', label: 'Saving & backups' },
            { id: 'editions', label: 'Moving between editions' },
          ].map((topic) => (
            <button
              key={topic.id}
              onClick={() => setActiveArticle(topic.id)}
              className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeArticle === topic.id
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-[#087F83] dark:text-[#38D0C5]'
                  : 'text-[#526782] hover:bg-slate-50 dark:hover:bg-slate-800'
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
