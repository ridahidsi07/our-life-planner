import React, { useState, useRef } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { useDialogAccessibility } from '../ui/Modal';
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
  User,
  Mail,
  Pin,
} from 'lucide-react';
import { SavingIndicator } from '../ui/SavingIndicator';
import {
  ToolViewId,
  isModuleOrToolEnabled,
  isToolVisibleInFavorites,
} from '../../utils/moduleRegistry';

export const MoreSheet: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { setActiveView, setActiveModal, settings } = usePlanner();
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { dialogRef } = useDialogAccessibility(isOpen, onClose, searchInputRef);

  if (!isOpen) return null;

  const toolCategories: {
    name: string;
    items: { id: ToolViewId; label: string; desc: string; icon: React.ElementType }[];
  }[] = [
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

  // Apply module visibility rule across all categories
  const enabledCategories = toolCategories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) =>
        isModuleOrToolEnabled(item.id, settings.enabledTools)
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  const allEnabledItems = enabledCategories.flatMap((cat) => cat.items);
  const pinnedItems = allEnabledItems.filter((item) =>
    isToolVisibleInFavorites(item.id, settings.pinnedTools, settings.enabledTools)
  );

  const filteredCategories = enabledCategories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.desc.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <div
      id="all-tools-menu"
      role="dialog"
      aria-modal="true"
      aria-label="All Tools & Views"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative bg-white dark:bg-[#152238] rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl z-10 border-t border-[#E2E8F0] dark:border-[#1E2D4A] outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
          <div>
            <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              All Tools & Views
            </h3>
            <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              {allEnabledItems.length} enabled tool{allEnabledItems.length === 1 ? '' : 's'} in one place
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-[#526782] dark:text-[#A8B8CE] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-1">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-[#526782] dark:text-[#A8B8CE]" />
            <input
              ref={searchInputRef}
              type="text"
              aria-label="Search tools"
              placeholder="Search tools…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[#071A3A] dark:text-[#EDF4FF]"
            />
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-5">
          {!searchTerm.trim() && pinnedItems.length > 0 && (
            <div data-testid="moresheet-favorites-section">
              <h4 className="flex items-center gap-1.5 text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] uppercase tracking-wider mb-2">
                <Pin className="w-3 h-3 text-[var(--accent)]" />
                <span>Favorites</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pinnedItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={`moresheet-pinned-${item.id}`}
                      type="button"
                      data-testid={`moresheet-favorite-${item.id}`}
                      onClick={() => handleSelect(item.id)}
                      className="min-h-[48px] flex items-center gap-3 p-2.5 rounded-xl text-left bg-[var(--surface-subtle)] border border-[var(--border-color)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-[var(--accent)] shrink-0 shadow-2xs">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] group-hover:text-[var(--accent)]">
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
          )}

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
                      type="button"
                      data-testid={`moresheet-tool-${item.id}`}
                      onClick={() => handleSelect(item.id)}
                      className="min-h-[48px] flex items-center gap-3 p-2.5 rounded-xl text-left bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-[var(--accent)] shrink-0 shadow-2xs">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] group-hover:text-[var(--accent)]">
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
              type="button"
              onClick={() => {
                setActiveModal('account');
                onClose();
              }}
              className="w-full min-h-[44px] flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
            >
              <User className="w-4 h-4 text-[var(--accent)]" />
              <span>Profile & Local Storage</span>
            </button>
            <button
              type="button"
              data-testid="moresheet-settings"
              onClick={() => {
                setActiveView('settings');
                onClose();
              }}
              className="w-full min-h-[44px] flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
            >
              <Settings className="w-4 h-4 text-[#526782] dark:text-[#A8B8CE]" />
              <span>Settings & Preferences</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveModal('guide');
                onClose();
              }}
              className="w-full min-h-[44px] flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
            >
              <HelpCircle className="w-4 h-4 text-[#526782] dark:text-[#A8B8CE]" />
              <span>User Guide</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveModal('support');
                onClose();
              }}
              className="w-full min-h-[44px] flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
            >
              <Mail className="w-4 h-4 text-[var(--accent)]" />
              <span>Customer Support Desk</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveModal('backup_restore');
                onClose();
              }}
              className="w-full min-h-[44px] flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
            >
              <Database className="w-4 h-4 text-[#526782] dark:text-[#A8B8CE]" />
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
