/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PlannerProvider, usePlanner } from './context/PlannerContext';
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

const PlannerAppContent: React.FC = () => {
  const { activeView, setActiveView } = usePlanner();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

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
    <div className="flex h-screen w-full bg-[#F3F8FC] dark:bg-[#0B1220] text-[#071A3A] dark:text-[#EDF4FF] overflow-hidden">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header onOpenMobileMenu={() => setIsMobileDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-8">
          {renderActiveView()}
        </main>
      </div>

      {/* Mobile Navigation Bottom Bar & Navigation Sheet */}
      <MobileNav
        isMoreOpen={isMobileDrawerOpen}
        onOpenMore={() => setIsMobileDrawerOpen(true)}
        onCloseMore={() => setIsMobileDrawerOpen(false)}
      />

      {/* Global Modals */}
      <QuickAddModal />
      <SearchModal />
      <BackupRestoreModal />
      <ConflictModal />
      <GuideModal />
      <OfflineDownloadModal />
      <SetupWizardModal />
    </div>
  );
};

export default function App() {
  return (
    <PlannerProvider>
      <PlannerAppContent />
    </PlannerProvider>
  );
}
