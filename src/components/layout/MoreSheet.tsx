import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import {
  Clock,
  Calendar,
  CheckSquare,
  Sparkles,
  Inbox,
  Target,
  Flame,
  Wallet,
  PiggyBank,
  TrendingDown,
  Utensils,
  ShoppingCart,
  Dumbbell,
  Scale,
  Droplet,
  Settings,
  HelpCircle,
  Database,
  X,
  Search,
} from 'lucide-react';
import { SavingIndicator } from '../ui/SavingIndicator';

export const MoreSheet: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { setActiveView, setActiveModal } = usePlanner();
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const toolCategories = [
    {
      name: 'Plan & organize',
      items: [
        { id: 'today', label: 'Today', desc: 'Daily overview', icon: Clock },
        { id: 'calendar', label: 'Calendar', desc: 'Plan your time', icon: Calendar },
        { id: 'tasks', label: 'Tasks', desc: 'Get things done', icon: CheckSquare },
        { id: 'routines', label: 'Routines', desc: 'Build daily rhythms', icon: Sparkles },
        { id: 'inbox', label: 'Inbox', desc: 'Capture anything', icon: Inbox },
      ],
    },
    {
      name: 'Growth & goals',
      items: [
        { id: 'goals', label: 'Goals', desc: 'Set and track milestones', icon: Target },
        { id: 'habits', label: 'Habits', desc: 'Build consistency', icon: Flame },
      ],
    },
    {
      name: 'Money',
      items: [
        { id: 'budget', label: 'Budget & bills', desc: 'Track cash flow', icon: Wallet },
        { id: 'savings', label: 'Savings', desc: 'Grow your money', icon: PiggyBank },
        { id: 'debts', label: 'Debt payoff', desc: 'Become debt-free', icon: TrendingDown },
      ],
    },
    {
      name: 'Health & lifestyle',
      items: [
        { id: 'meals', label: 'Meals', desc: 'Plan your recipes', icon: Utensils },
        { id: 'groceries', label: 'Groceries', desc: 'Shopping lists', icon: ShoppingCart },
        { id: 'workouts', label: 'Workouts', desc: 'Stay active', icon: Dumbbell },
        { id: 'weight', label: 'Weight', desc: 'Track your weight & BMI', icon: Scale },
        { id: 'water', label: 'Water', desc: 'Stay hydrated', icon: Droplet },
      ],
    },
  ];

  const handleSelect = (id: string) => {
    setActiveView(id);
    onClose();
  };

  const filteredCategories = toolCategories.map((cat) => ({
    ...cat,
    items: cat.items.filter((item) =>
      item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#152238] rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl z-10 border-t border-[#E2E8F0] dark:border-[#1E2D4A]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
          <div>
            <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              All Tools & Views
            </h3>
            <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              15 connected tools in one place
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-[#526782]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-1">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[#526782]" />
            <input
              type="text"
              placeholder="Search tools…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-[#087F83]"
            />
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-5">
          {filteredCategories.map((cat, idx) => (
            <div key={idx}>
              <h4 className="text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] uppercase tracking-wider mb-2">
                {cat.name}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cat.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.id)}
                      className="flex items-center gap-3 p-2.5 rounded-xl text-left bg-slate-50 dark:bg-slate-800/60 hover:bg-[#E0F2F1] dark:hover:bg-[#163642] transition-colors cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-[#087F83] dark:text-[#38D0C5] shrink-0 shadow-2xs">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] group-hover:text-[#087F83] dark:group-hover:text-[#38D0C5]">
                          {item.label}
                        </div>
                        <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">
                          {item.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quick shortcuts */}
          <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#1E2D4A] space-y-1">
            <button
              onClick={() => {
                setActiveView('settings');
                onClose();
              }}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
            >
              <Settings className="w-4 h-4 text-[#526782]" />
              <span>Settings & Preferences</span>
            </button>
            <button
              onClick={() => {
                setActiveModal('guide');
                onClose();
              }}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
            >
              <HelpCircle className="w-4 h-4 text-[#526782]" />
              <span>User Guide & Support</span>
            </button>
            <button
              onClick={() => {
                setActiveModal('backup_restore');
                onClose();
              }}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
            >
              <Database className="w-4 h-4 text-[#526782]" />
              <span>Backup & Restore</span>
            </button>
          </div>

          <div className="py-2">
            <SavingIndicator />
          </div>
        </div>
      </div>
    </div>
  );
};
