import React, { useMemo } from 'react';
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
  Pin,
  Smartphone,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import {
  ToolViewId,
  isModuleOrToolEnabled,
  isToolVisibleInFavorites,
} from '../../utils/moduleRegistry';

interface NavItem {
  id: ToolViewId;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    setActiveModal,
    settings,
    updateSettings,
    tasks,
  } = usePlanner();

  const activeTaskCount = useMemo(() => {
    return tasks.filter((t) => !t.isArchived && t.status !== 'completed').length;
  }, [tasks]);

  const navGroups: NavGroup[] = [
    {
      name: 'Plan',
      items: [
        { id: 'today', label: 'Today', icon: Clock },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare },
        { id: 'routines', label: 'Routines', icon: Sparkles },
        { id: 'inbox', label: 'Inbox', icon: Inbox },
      ],
    },
    {
      name: 'Growth',
      items: [
        { id: 'goals', label: 'Goals', icon: Target },
        { id: 'habits', label: 'Habits', icon: Flame },
      ],
    },
    {
      name: 'Money',
      items: [
        { id: 'budget', label: 'Budget & bills', icon: Wallet },
        { id: 'savings', label: 'Savings', icon: PiggyBank },
        { id: 'debts', label: 'Debt payoff', icon: TrendingDown },
      ],
    },
    {
      name: 'Food',
      items: [
        { id: 'meals', label: 'Meals', icon: Utensils },
        { id: 'groceries', label: 'Groceries', icon: ShoppingCart },
      ],
    },
    {
      name: 'Health',
      items: [
        { id: 'workouts', label: 'Workouts', icon: Dumbbell },
        { id: 'weight', label: 'Weight', icon: Scale },
        { id: 'water', label: 'Water', icon: Droplet },
      ],
    },
  ];

  const enabledTools = settings.enabledTools;
  const pinnedTools = settings.pinnedTools;

  const allItems = navGroups.flatMap((g) => g.items);
  const pinnedItems = allItems.filter((item) =>
    isToolVisibleInFavorites(item.id, pinnedTools, enabledTools)
  );

  const filteredNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isModuleOrToolEnabled(item.id, enabledTools)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="w-[220px] bg-white dark:bg-[#152238] border-r border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col h-screen shrink-0 sticky top-0 overflow-y-auto select-none transition-all">
      {/* Brand Header */}
      <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
        <Logo />
      </div>

      {/* Nav List */}
      <div className="flex-1 px-2.5 py-3 space-y-3 overflow-y-auto">
        {/* Pinned Section */}
        {pinnedItems.length > 0 && (
          <div
            data-testid="sidebar-favorites-section"
            className="space-y-0.5 pb-2.5 border-b border-slate-100 dark:border-slate-800"
          >
            <div className="flex items-center justify-between px-2.5 py-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]">
                <Pin className="w-3 h-3 text-[#087F83] dark:text-[#38D0C5]" />
                <span>Favorites</span>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ pinnedTools: [] })}
                title="Hide pinned favorites section"
                className="text-[10px] font-medium text-[#526782] dark:text-[#A8B8CE] hover:text-[#087F83] dark:hover:text-[#38D0C5] cursor-pointer"
              >
                Clear
              </button>
            </div>
            {pinnedItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={`pinned-${item.id}`}
                  type="button"
                  data-testid={`sidebar-favorite-${item.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveView(item.id)}
                  style={
                    isActive
                      ? { backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }
                      : undefined
                  }
                  className={`relative w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-[13px] font-medium transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'font-semibold'
                      : 'text-[#526782] hover:text-[#071A3A] hover:bg-slate-100/70 dark:text-[#A8B8CE] dark:hover:text-[#EDF4FF] dark:hover:bg-slate-800/60'
                  }`}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full"
                      style={{ backgroundColor: 'var(--accent)' }}
                    />
                  )}
                  <Icon
                    className="w-4 h-4 shrink-0"
                    style={isActive ? { color: 'var(--accent)' } : undefined}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Grouped Nav List */}
        {filteredNavGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-0.5">
            <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]">
              {group.name}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`sidebar-nav-${item.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveView(item.id)}
                  style={
                    isActive
                      ? { backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }
                      : undefined
                  }
                  className={`relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-medium transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'font-semibold'
                      : 'text-[#526782] hover:text-[#071A3A] hover:bg-slate-100/70 dark:text-[#A8B8CE] dark:hover:text-[#EDF4FF] dark:hover:bg-slate-800/60'
                  }`}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full"
                      style={{ backgroundColor: 'var(--accent)' }}
                    />
                  )}
                  <Icon
                    className="w-[17px] h-[17px] shrink-0"
                    style={isActive ? { color: 'var(--accent)' } : undefined}
                  />
                  <span
                    className={`truncate flex-1 ${
                      item.id === 'tasks' && activeTaskCount > 0
                        ? 'flex items-center justify-between after:content-[attr(data-count)] after:text-[10px] after:font-semibold after:px-1.5 after:py-0.2 after:rounded-full after:bg-slate-100 dark:after:bg-slate-800 after:text-[#526782] dark:after:text-[#A8B8CE] after:tabular-nums'
                        : ''
                    }`}
                    data-count={item.id === 'tasks' && activeTaskCount > 0 ? activeTaskCount : undefined}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Profile, Shortcuts & Settings */}
      <div className="p-2.5 border-t border-[#E2E8F0] dark:border-[#1E2D4A] space-y-1 shrink-0 bg-white/60 dark:bg-[#152238]/60">
        {/* Quick Modals Toolbar */}
        <div className="grid grid-cols-2 gap-1 mb-1.5">
          <button
            type="button"
            onClick={() => setActiveModal('focus_mode')}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[#087F83] dark:text-[#38D0C5] text-[11px] font-semibold hover:bg-teal-100 dark:hover:bg-teal-900/70 transition-colors cursor-pointer"
          >
            <Zap className="w-3 h-3" />
            <span>Focus</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('pwa_install')}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <Smartphone className="w-3 h-3" />
            <span>App Install</span>
          </button>
        </div>

        {/* Profile & Storage */}
        <button
          type="button"
          onClick={() => setActiveModal('account')}
          aria-label={`Manage profile and storage for ${settings.ownerName}`}
          className="w-full flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer min-w-0"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
            <div
              className="w-6 h-6 rounded-full text-white flex items-center justify-center font-bold text-[11px] uppercase shadow-xs shrink-0"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {settings.ownerName.charAt(0) || 'R'}
            </div>
            <div className="min-w-0 flex-1 truncate">
              <div className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] truncate">
                {settings.ownerName}
              </div>
              <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] truncate">
                Profile & Storage
              </div>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-[#526782] dark:text-[#A8B8CE] shrink-0" />
        </button>

        {/* Backup & Restore */}
        <button
          type="button"
          data-testid="sidebar-backup-restore"
          onClick={() => setActiveModal('backup_restore')}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#526782] dark:text-[#A8B8CE] hover:text-[#071A3A] dark:hover:text-[#EDF4FF] hover:bg-slate-100/70 dark:hover:bg-slate-800 cursor-pointer transition-colors"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#087F83] dark:text-[#38D0C5]" />
          <span>Backup & Restore</span>
        </button>

        {/* Settings */}
        <button
          type="button"
          data-testid="sidebar-settings"
          onClick={() => setActiveView('settings')}
          aria-current={activeView === 'settings' ? 'page' : undefined}
          style={
            activeView === 'settings'
              ? { backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }
              : undefined
          }
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
            activeView === 'settings'
              ? 'font-semibold'
              : 'text-[#526782] dark:text-[#A8B8CE] hover:text-[#071A3A] dark:hover:text-[#EDF4FF] hover:bg-slate-100/70 dark:hover:bg-slate-800'
          }`}
        >
          <Settings className="w-3.5 h-3.5" style={activeView === 'settings' ? { color: 'var(--accent)' } : undefined} />
          <span>Settings</span>
        </button>

        <div className="px-2 pt-1 pb-0.5">
          <SavingIndicator />
        </div>
      </div>
    </aside>
  );
};
