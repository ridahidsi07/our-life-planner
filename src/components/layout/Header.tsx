import React from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Search, Plus, Menu, RefreshCw, AlertCircle, Cloud } from 'lucide-react';
import { Logo } from '../ui/Logo';

export const Header: React.FC<{ onOpenMobileMenu?: () => void }> = ({
  onOpenMobileMenu,
}) => {
  const { settings, currentDate, setActiveModal, activeModal, savingState } = usePlanner();

  // Greeting based on time of day
  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Format date display (e.g., Monday, October 5, 2026)
  const formattedDate = React.useMemo(() => {
    try {
      const parts = currentDate.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return currentDate;
    }
  }, [currentDate]);

  return (
    <header className="h-16 px-4 md:px-6 flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E2D4A] bg-white/85 dark:bg-[#152238]/85 backdrop-blur-md sticky top-0 z-30 select-none">
      <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-initial mr-2 sm:mr-3">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => {
            if (onOpenMobileMenu) onOpenMobileMenu();
            setActiveModal('more_sheet');
          }}
          className="min-w-[44px] min-h-[44px] p-2.5 -ml-2 rounded-xl flex items-center justify-center text-[#59677B] dark:text-[#A8B8CE] md:hidden hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          aria-label="Open menu"
          aria-controls="all-tools-menu"
          aria-expanded={activeModal === 'more_sheet' || activeModal === 'menu'}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="md:hidden shrink-0">
          <Logo size={26} showText={false} />
        </div>

        {/* Desktop Context Greeting & Date */}
        <div className="hidden sm:block min-w-0">
          <h1 className="text-sm font-semibold text-[#14233B] dark:text-[#EDF4FF] leading-tight truncate">
            {greeting}, {settings.ownerName}.
          </h1>
          <p className="text-xs text-[#59677B] dark:text-[#8A99AD] leading-tight truncate">
            {formattedDate}
          </p>
        </div>
      </div>

      {/* Right Persistent Actions: Search, Quick Add, Saving Indicator, Profile */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Search button */}
        <button
          type="button"
          onClick={() => setActiveModal('search')}
          aria-label="Search planner"
          className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-9 flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 text-[#59677B] dark:text-[#A8B8CE] hover:text-[#14233B] dark:hover:text-[#EDF4FF] hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors text-xs font-medium cursor-pointer shrink-0"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden lg:inline">Search planner…</span>
          <kbd className="hidden xl:inline text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-[#59677B] dark:text-[#A8B8CE]">
            ⌘K
          </kbd>
        </button>

        {/* Quick Add button */}
        <button
          type="button"
          data-testid="header-quick-add"
          onClick={() => setActiveModal('quick_add')}
          aria-label="Quick add item"
          className="min-h-[44px] sm:min-h-9 flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs transition-all shadow-xs cursor-pointer active:scale-97 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
          <span>Quick add</span>
        </button>

        {/* Visible saving & storage confidence indicator */}
        <button
          type="button"
          data-testid="header-saving-indicator"
          onClick={() => setActiveModal('account')}
          aria-label={`Storage status: ${
            savingState === 'saving'
              ? 'Saving changes locally'
              : savingState === 'could_not_save'
              ? 'Storage issue. Click to retry or export.'
              : savingState === 'saved_cloud'
              ? 'Saved and synced with cloud account'
              : 'All changes saved locally to this device'
          }`}
          title="Your data is saved privately in browser storage on this device. Click to view storage details."
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100/70 dark:hover:bg-slate-800 text-xs text-[#59677B] dark:text-[#A8B8CE] hover:text-[#14233B] dark:hover:text-[#EDF4FF] transition-colors cursor-pointer shrink-0"
        >
          {savingState === 'saving' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#087F83] dark:text-[#38D0C5] shrink-0" />
              <span className="font-medium text-[11.5px] hidden xl:inline">Saving…</span>
            </>
          ) : savingState === 'saved_cloud' ? (
            <>
              <Cloud className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="font-medium text-[11.5px] hidden xl:inline">Synced</span>
            </>
          ) : savingState === 'could_not_save' ? (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="font-semibold text-rose-600 dark:text-rose-400 text-[11.5px]">Save issue</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-medium text-[11.5px] hidden xl:inline">Saved locally</span>
            </>
          )}
        </button>

        {/* Profile Avatar / Storage Manager */}
        <button
          type="button"
          data-testid="header-profile-avatar"
          onClick={() => setActiveModal('account')}
          aria-label={`Profile and local storage for ${settings.ownerName}`}
          title={`Profile & Storage: ${settings.ownerName}`}
          className="min-w-[44px] min-h-[44px] sm:min-w-9 sm:min-h-9 p-0.5 rounded-full flex items-center justify-center cursor-pointer relative shrink-0"
        >
          <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#087F83] to-[#38D0C5] text-white flex items-center justify-center font-bold text-xs shadow-xs hover:ring-2 hover:ring-[#087F83]/50 transition-all">
            {settings.ownerName.charAt(0) || 'R'}
          </span>
          <span
            aria-hidden="true"
            className={`sm:hidden absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#0B1220] ${
              savingState === 'could_not_save'
                ? 'bg-rose-500'
                : savingState === 'saving'
                ? 'bg-[#087F83]'
                : 'bg-emerald-500'
            }`}
          />
        </button>
      </div>
    </header>
  );
};
