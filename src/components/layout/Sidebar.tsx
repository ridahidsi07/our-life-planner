import React from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Logo } from '../ui/Logo';
import { SavingIndicator } from '../ui/SavingIndicator';
import {
  Calendar,
  CheckSquare,
  Clock,
  Inbox,
  Target,
  Sparkles,
  Wallet,
  PiggyBank,
  TrendingDown,
  Utensils,
  ShoppingCart,
  Dumbbell,
  Scale,
  Droplet,
  Settings,
  ChevronRight,
  Flame,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  name?: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, settings } = usePlanner();

  const navGroups: NavGroup[] = [
    {
      items: [
        { id: 'today', label: 'Today', icon: Clock },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare },
        { id: 'routines', label: 'Routines', icon: Sparkles },
        { id: 'inbox', label: 'Inbox', icon: Inbox },
      ],
    },
    {
      items: [
        { id: 'goals', label: 'Goals', icon: Target },
        { id: 'habits', label: 'Habits', icon: Flame },
      ],
    },
    {
      items: [
        { id: 'budget', label: 'Budget & bills', icon: Wallet },
        { id: 'savings', label: 'Savings', icon: PiggyBank },
        { id: 'debts', label: 'Debt payoff', icon: TrendingDown },
      ],
    },
    {
      items: [
        { id: 'meals', label: 'Meals', icon: Utensils },
        { id: 'groceries', label: 'Groceries', icon: ShoppingCart },
      ],
    },
    {
      items: [
        { id: 'workouts', label: 'Workouts', icon: Dumbbell },
        { id: 'weight', label: 'Weight', icon: Scale },
        { id: 'water', label: 'Water', icon: Droplet },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-[#152238] border-r border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col h-screen shrink-0 sticky top-0 overflow-y-auto select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-transparent">
        <Logo />
      </div>

      {/* Nav List */}
      <div className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[14px] font-medium transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'bg-[#E0F2F1] text-[#087F83] dark:bg-[#163642] dark:text-[#38D0C5] font-semibold'
                      : 'text-[#526782] hover:text-[#071A3A] hover:bg-slate-50 dark:text-[#A8B8CE] dark:hover:text-[#EDF4FF] dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 ${
                      isActive
                        ? 'text-[#087F83] dark:text-[#38D0C5]'
                        : 'text-[#526782] dark:text-[#A8B8CE]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
            {groupIdx < navGroups.length - 1 && (
              <div className="pt-2 pb-1">
                <div className="h-px bg-slate-100 dark:bg-slate-800/80 mx-2" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer Profile & Settings */}
      <div className="p-3 border-t border-[#E2E8F0] dark:border-[#1E2D4A] space-y-1 shrink-0 bg-white/50 dark:bg-[#152238]/50">
        <button
          onClick={() => setActiveView('settings')}
          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#087F83] text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
              {settings.ownerName.charAt(0) || 'R'}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] truncate">
                {settings.ownerName}
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#526782] dark:text-[#A8B8CE]" />
        </button>

        <button
          onClick={() => setActiveView('settings')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
            activeView === 'settings'
              ? 'bg-[#E0F2F1] text-[#087F83] dark:bg-[#163642] dark:text-[#38D0C5]'
              : 'text-[#526782] dark:text-[#A8B8CE] hover:text-[#071A3A] dark:hover:text-[#EDF4FF] hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>

        <div className="px-3 pt-1 pb-1">
          <SavingIndicator />
        </div>
      </div>
    </aside>
  );
};
