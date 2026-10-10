import React from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Search, Plus, Menu } from 'lucide-react';
import { Logo } from '../ui/Logo';

export const Header: React.FC<{ onOpenMobileMenu?: () => void }> = ({
  onOpenMobileMenu,
}) => {
  const { settings, currentDate, setActiveModal, activeModal } = usePlanner();

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
    <header className="h-16 px-4 md:px-8 flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E2D4A] bg-white/80 dark:bg-[#152238]/80 backdrop-blur-md sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => {
            if (onOpenMobileMenu) onOpenMobileMenu();
            setActiveModal('more_sheet');
          }}
          className="p-2 -ml-2 rounded-lg text-[#526782] md:hidden hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Open menu"
          aria-controls="all-tools-menu"
          aria-expanded={activeModal === 'more_sheet' || activeModal === 'menu'}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="md:hidden">
          <Logo size={26} showText={false} />
        </div>

        {/* Desktop Greeting & Date */}
        <div className="hidden sm:block">
          <h1 className="text-sm font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
            {greeting}, {settings.ownerName}.
          </h1>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            {formattedDate}
          </p>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5">
        {/* Search button */}
        <button
          type="button"
          onClick={() => setActiveModal('search')}
          aria-label="Search planner"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800 text-[#526782] dark:text-[#A8B8CE] hover:text-[#071A3A] dark:hover:text-[#EDF4FF] hover:bg-slate-200/70 transition-colors text-xs font-medium cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Search planner…</span>
        </button>

        {/* Quick Add button */}
        <button
          type="button"
          onClick={() => setActiveModal('quick_add')}
          aria-label="Quick add item"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Quick add</span>
        </button>

        {/* Profile Avatar / Storage Manager */}
        <button
          type="button"
          onClick={() => setActiveModal('account')}
          aria-label={`Profile and local storage for ${settings.ownerName}`}
          title={`Profile & Storage: ${settings.ownerName}`}
          className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#087F83] to-[#38D0C5] text-white flex items-center justify-center font-bold text-xs shadow-xs ml-1 hover:ring-2 hover:ring-[#087F83] focus:ring-2 focus:ring-[#087F83] transition-all cursor-pointer"
        >
          {settings.ownerName.charAt(0) || 'R'}
        </button>
      </div>
    </header>
  );
};
