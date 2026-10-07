import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Clock, Calendar, Plus, MoreHorizontal } from 'lucide-react';
import { MoreSheet } from './MoreSheet';

export const MobileNav: React.FC = () => {
  const { activeView, setActiveView, setActiveModal } = usePlanner();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#152238] border-t border-[#E2E8F0] dark:border-[#1E2D4A] flex items-center justify-around px-2 z-40 shadow-lg">
        {/* Today */}
        <button
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

        {/* Calendar */}
        <button
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

        {/* Quick Add Pill */}
        <button
          onClick={() => setActiveModal('quick_add')}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-[#087F83] dark:bg-[#38D0C5] text-white dark:text-[#071A3A] shadow-md hover:scale-105 active:scale-95 transition-all -mt-5 cursor-pointer"
          aria-label="Quick add"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* More */}
        <button
          onClick={() => setIsMoreOpen(true)}
          className={`flex flex-col items-center justify-center w-16 h-full transition-colors cursor-pointer ${
            isMoreOpen || (activeView !== 'today' && activeView !== 'calendar')
              ? 'text-[#087F83] dark:text-[#38D0C5]'
              : 'text-[#526782] dark:text-[#A8B8CE]'
          }`}
        >
          <MoreHorizontal className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>

      <MoreSheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
    </>
  );
};
