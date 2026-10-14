/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { PlannerProvider, usePlanner } from './context/PlannerContext';
import { FocusProvider } from './context/FocusContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MobileNav } from './components/layout/MobileNav';

// Tool Views
import { TodayDashboard } from './components/today/TodayDashboard';
import { CalendarView } from './components/calendar/CalendarView';
import { TasksView } from './components/tasks/TasksView';
import { RoutinesView } from './components/routines/RoutinesView';
import { InboxView } from './components/inbox/InboxView';
import { GoalsView } from './components/goals/GoalsView';
import { HabitsView } from './components/habits/HabitsView';
import { BudgetBillsView } from './components/money/BudgetBillsView';
import { SavingsPotsView } from './components/money/SavingsPotsView';
import { DebtPayoffView } from './components/money/DebtPayoffView';
import { MealsView } from './components/food/MealsView';
import { GroceriesView } from './components/food/GroceriesView';
import { WorkoutsView } from './components/health/WorkoutsView';
import { WeightBMIView } from './components/health/WeightBMIView';
import { HydrationView } from './components/health/HydrationView';
import { SettingsView } from './components/settings/SettingsView';

// Modals
import { QuickAddModal } from './components/modals/QuickAddModal';
import { SearchModal } from './components/modals/SearchModal';
import { BackupRestoreModal } from './components/modals/BackupRestoreModal';
import { ConflictModal } from './components/modals/ConflictModal';
import { GuideModal } from './components/modals/GuideModal';
import { OfflineDownloadModal } from './components/modals/OfflineDownloadModal';
import { SetupWizardModal } from './components/modals/SetupWizardModal';
import { AccountModal } from './components/modals/AccountModal';
import { SupportModal } from './components/modals/SupportModal';
import { FocusModal } from './components/modals/FocusModal';
import { WeeklyReviewModal } from './components/modals/WeeklyReviewModal';
import { PwaInstallModal } from './components/modals/PwaInstallModal';
import { CreationFeedbackToast } from './components/ui/CreationFeedbackToast';

import { AlertCircle, AlertTriangle, Download, Sparkles, X } from 'lucide-react';

const PlannerAppContent: React.FC = () => {
  const {
    activeView,
    setActiveView,
    activeModal,
    setActiveModal,
    settings,
    savingState,
    lastSaveError,
    retrySave,
    exportUnsavedSnapshot,
    corruptStartupQuarantine,
    exportCorruptQuarantine,
    dismissCorruptQuarantine,
    removeSampleData,
  } = usePlanner();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isDemoBannerDismissed, setIsDemoBannerDismissed] = useState(false);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    const mainEl = mainScrollRef.current;
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
    window.scrollTo(0, 0);

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    // When switching views, move focus to the primary view heading
    if (mainEl) {
      const heading = mainEl.querySelector<HTMLElement>('h1, h2');
      if (heading) {
        if (!heading.hasAttribute('tabindex')) {
          heading.setAttribute('tabindex', '-1');
        }
        heading.style.outline = 'none';
        heading.focus({ preventScroll: true });
      }
    }
  }, [activeView]);

  const renderActiveView = () => {
    switch (activeView) {
      case 'today':
        return <TodayDashboard />;
      case 'calendar':
        return <CalendarView />;
      case 'tasks':
        return <TasksView />;
      case 'routines':
        return <RoutinesView />;
      case 'inbox':
        return <InboxView />;
      case 'goals':
        return <GoalsView />;
      case 'habits':
        return <HabitsView />;
      case 'budget':
        return <BudgetBillsView />;
      case 'savings':
        return <SavingsPotsView />;
      case 'debts':
        return <DebtPayoffView />;
      case 'meals':
        return <MealsView />;
      case 'groceries':
        return <GroceriesView />;
      case 'workouts':
        return <WorkoutsView />;
      case 'weight':
        return <WeightBMIView />;
      case 'water':
        return <HydrationView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <TodayDashboard />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-[var(--canvas)] text-[var(--text-primary)] overflow-hidden">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block shrink-0">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header onOpenMobileMenu={() => setIsMobileDrawerOpen(true)} />

        {/* Storage Failure Alert Banner */}
        {savingState === 'could_not_save' && (
          <div
            data-testid="storage-error-banner"
            className="bg-rose-50 dark:bg-rose-950/80 border-b border-rose-300 dark:border-rose-800 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 text-rose-900 dark:text-rose-200 z-30 shrink-0"
            role="alert"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <div>
                <strong className="font-semibold">Storage issue:</strong> Could not save latest changes to browser storage{lastSaveError ? ` (${lastSaveError})` : ''}. All changes remain safe in active memory.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="banner-retry-save-btn"
                onClick={() => void retrySave()}
                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold text-[11px] hover:bg-rose-700 cursor-pointer transition-colors"
              >
                Retry saving
              </button>
              <button
                type="button"
                data-testid="banner-export-unsaved-btn"
                onClick={exportUnsavedSnapshot}
                className="px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-200 font-semibold text-[11px] hover:bg-rose-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Export unsaved (JSON)
              </button>
            </div>
          </div>
        )}

        {/* Corrupted Startup Quarantine Alert Banner */}
        {corruptStartupQuarantine && (
          <div
            data-testid="corrupt-quarantine-banner"
            className="bg-amber-100 dark:bg-amber-950/80 border-b border-amber-300 dark:border-amber-800 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 text-amber-950 dark:text-amber-200 z-30 shrink-0"
            role="alert"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Corrupt startup data detected and safely quarantined ({corruptStartupQuarantine.reason}). Current session started safely.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportCorruptQuarantine}
                className="px-2 py-1 rounded-lg bg-amber-200 dark:bg-amber-900 font-semibold text-[11px] cursor-pointer"
              >
                Export raw corrupted data
              </button>
              <button
                type="button"
                onClick={dismissCorruptQuarantine}
                className="px-2 py-1 rounded-lg border border-amber-400 text-[11px] cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Demo Mode / Sample Data Labeling Banner */}
        {settings.isSampleDataActive && !isDemoBannerDismissed && (
          <div
            data-testid="demo-data-banner"
            className="bg-amber-50/90 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-900/60 px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 text-amber-900 dark:text-amber-200 z-20 shrink-0"
            role="status"
            aria-label="Demo mode active"
          >
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 font-bold text-[10px] uppercase tracking-wider">
                Demo Mode
              </span>
              <span className="text-[11px]">
                Exploring with sample records. Any personal items you add are preserved.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="clear-demo-data-btn"
                onClick={removeSampleData}
                className="px-2.5 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 dark:bg-amber-900 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 font-semibold text-[11px] cursor-pointer transition-colors"
              >
                Remove sample data
              </button>
              <button
                type="button"
                onClick={() => setIsDemoBannerDismissed(true)}
                aria-label="Dismiss demo banner"
                className="p-1 rounded hover:bg-amber-200/60 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <main
          ref={mainScrollRef}
          data-testid="main-scroll-container"
          className="flex-1 overflow-y-auto pb-20 md:pb-8"
        >
          <ErrorBoundary onReset={() => setActiveView('today')}>
            {renderActiveView()}
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile Navigation Bottom Bar & Navigation Sheet */}
      <MobileNav
        isMoreOpen={isMobileDrawerOpen}
        onOpenMore={() => setIsMobileDrawerOpen(true)}
        onCloseMore={() => setIsMobileDrawerOpen(false)}
      />

      {/* Global Capture Feedback Toast */}
      <CreationFeedbackToast />

      {/* Global Modals */}
      <ErrorBoundary compact onReset={() => setActiveModal(null)}>
        <QuickAddModal />
        <SearchModal />
        <BackupRestoreModal />
        <ConflictModal />
        <GuideModal />
        <OfflineDownloadModal />
        <SetupWizardModal />
        <AccountModal />
        <SupportModal />
        <FocusModal />
        <WeeklyReviewModal />
        <PwaInstallModal />
      </ErrorBoundary>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <PlannerProvider>
        <FocusProvider>
          <PlannerAppContent />
        </FocusProvider>
      </PlannerProvider>
    </ErrorBoundary>
  );
}
