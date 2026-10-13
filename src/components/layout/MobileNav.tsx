import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Clock, Calendar, Plus, MoreHorizontal } from 'lucide-react';
import { MoreSheet } from './MoreSheet';
import { isModuleOrToolEnabled } from '../../utils/moduleRegistry';

interface MobileNavProps {
  isMoreOpen?: boolean;
  onOpenMore?: () => void;
  onCloseMore?: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  isMoreOpen: controlledIsMoreOpen,
  onOpenMore,
  onCloseMore,
}) => {
  const { activeView, setActiveView, setActiveModal, activeModal, settings } = usePlanner();
  const [internalIsMoreOpen, setInternalIsMoreOpen] = useState(false);

  const isMoreSheetOpen = Boolean(
    controlledIsMoreOpen ||
      internalIsMoreOpen ||
      activeModal === 'menu' ||
      activeModal === 'more_sheet'
  );

  const showTodayTab = isModuleOrToolEnabled('today', settings.enabledTools);
  const showCalendarTab = isModuleOrToolEnabled('calendar', settings.enabledTools);

  const handleOpenMore = () => {
    setActiveModal('more_sheet');
    setInternalIsMoreOpen(true);
    if (onOpenMore) {
      onOpenMore();
    }
  };

  const handleCloseMore = () => {
    if (onCloseMore) {
      onCloseMore();
    }
    setInternalIsMoreOpen(false);
    if (activeModal === 'menu' || activeModal === 'more_sheet') {
      setActiveModal(null);
    }
  };

  return (
    <>
      <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#152238] border-t border-[#E2E8F0] dark:border-[#1E2D4A] flex items-center justify-around px-2 z-40 shadow-lg">
        {/* Today */}
        {showTodayTab && (
          <button
            type="button"
            data-testid="mobile-nav-today"
            aria-current={activeView === 'today' ? 'page' : undefined}
            onClick={() => setActiveView('today')}
            className={`flex flex-col items-center justify-center w-16 h-full transition-colors cursor-pointer ${
              activeView === 'today'
                ? 'text-[#087F83] dark:text-[#38D0C5]'
                : 'text-[#526782] dark:text-[#A8B8CE]'
            }`}
          >
            <Clock className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">Today</span>
          </button>
        )}

        {/* Calendar */}
        {showCalendarTab && (
          <button
            type="button"
            data-testid="mobile-nav-calendar"
            aria-current={activeView === 'calendar' ? 'page' : undefined}
            onClick={() => setActiveView('calendar')}
            className={`flex flex-col items-center justify-center w-16 h-full transition-colors cursor-pointer ${
              activeView === 'calendar'
                ? 'text-[#087F83] dark:text-[#38D0C5]'
                : 'text-[#526782] dark:text-[#A8B8CE]'
            }`}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">Calendar</span>
          </button>
        )}

        {/* Quick Add Pill */}
        <button
          type="button"
          onClick={() => setActiveModal('quick_add')}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] shadow-md transition-all -mt-5 cursor-pointer"
          aria-label="Quick add"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* More */}
        <button
          type="button"
          onClick={handleOpenMore}
          aria-label="All tools and views"
          aria-controls="all-tools-menu"
          aria-expanded={isMoreSheetOpen}
          className={`flex flex-col items-center justify-center w-16 h-full transition-colors cursor-pointer ${
            isMoreSheetOpen || (activeView !== 'today' && activeView !== 'calendar')
              ? 'text-[#087F83] dark:text-[#38D0C5]'
              : 'text-[#526782] dark:text-[#A8B8CE]'
          }`}
        >
          <MoreHorizontal className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>

      <MoreSheet isOpen={isMoreSheetOpen} onClose={handleCloseMore} />
    </>
  );
};
