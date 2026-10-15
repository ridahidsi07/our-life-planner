import React, { useState, useMemo, useEffect } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import {
  Search,
  CheckSquare,
  Utensils,
  Wallet,
  ArrowRight,
  RotateCcw,
  Calendar as CalendarIcon,
  Dumbbell,
  Target,
  Flame,
  ShoppingCart,
  Inbox as InboxIcon,
  ChevronDown,
} from 'lucide-react';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  type: string;
  date?: string;
  view: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SearchModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    tasks,
    routines,
    calendarEvents,
    workouts,
    goals,
    recipes,
    bills,
    habits,
    groceries,
    inbox,
    settings,
    setActiveView,
    setCurrentDate,
  } = usePlanner();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const INITIAL_GROUP_LIMIT = 15;

  const currency = settings.currencySymbol || '$';

  const flattenedResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const results: SearchResultItem[] = [];

    // 1. Tasks
    tasks.forEach((t) => {
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description && t.description.toLowerCase().includes(q);
      if (matchTitle || matchDesc) {
        results.push({
          id: `task-${t.id}`,
          title: t.title,
          subtitle: t.description ? t.description.slice(0, 60) : (t.priority ? `${t.priority} priority` : undefined),
          type: 'Tasks',
          date: t.dueDate,
          view: 'tasks',
          icon: CheckSquare,
        });
      }
    });

    // 2. Routines
    routines.forEach((r) => {
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchNotes = r.notes && r.notes.toLowerCase().includes(q);
      if (matchTitle || matchNotes) {
        results.push({
          id: `routine-${r.id}`,
          title: r.title,
          subtitle: `${r.interval.toUpperCase()}${r.startTime ? ` · ${r.startTime}` : ''} · ${r.category}`,
          type: 'Routines',
          view: 'routines',
          icon: RotateCcw,
        });
      }
    });

    // 3. Calendar & Focus blocks
    calendarEvents.forEach((ev) => {
      const matchTitle = ev.title.toLowerCase().includes(q);
      const matchNotes = ev.notes && ev.notes.toLowerCase().includes(q);
      if (matchTitle || matchNotes) {
        results.push({
          id: `cal-${ev.id}`,
          title: ev.title,
          subtitle: `${ev.startTime ? `${ev.startTime} ` : ''}(${ev.type})`,
          type: 'Calendar & Focus',
          date: ev.date,
          view: 'calendar',
          icon: CalendarIcon,
        });
      }
    });

    // 4. Workouts
    workouts.forEach((w) => {
      const matchTitle = w.title.toLowerCase().includes(q);
      const matchEx = w.exercises && w.exercises.some((e) => e.name.toLowerCase().includes(q));
      if (matchTitle || matchEx) {
        results.push({
          id: `workout-${w.id}`,
          title: w.title,
          subtitle: w.exercises ? `${w.exercises.length} exercise${w.exercises.length === 1 ? '' : 's'}` : 'Rest day',
          type: 'Workouts',
          date: w.date,
          view: 'workouts',
          icon: Dumbbell,
        });
      }
    });

    // 5. Goals & Goal Steps
    goals.forEach((g) => {
      const matchTitle = g.title.toLowerCase().includes(q);
      const matchMotiv = g.motivation && g.motivation.toLowerCase().includes(q);
      const matchingStep = g.steps.find((s) => s.title.toLowerCase().includes(q));
      if (matchTitle || matchMotiv || matchingStep) {
        results.push({
          id: `goal-${g.id}`,
          title: matchingStep ? `${g.title} › ${matchingStep.title}` : g.title,
          subtitle: `${g.category} · ${g.deadline ? `Due: ${g.deadline}` : g.status}`,
          type: 'Goals',
          view: 'goals',
          icon: Target,
        });
      }
    });

    // 6. Recipes
    recipes.forEach((r) => {
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchIng = r.ingredients && r.ingredients.some((i) => i.name.toLowerCase().includes(q));
      if (matchTitle || matchIng) {
        results.push({
          id: `recipe-${r.id}`,
          title: r.title,
          subtitle: `${r.baseServings} servings · ${r.category}`,
          type: 'Recipes',
          view: 'meals',
          icon: Utensils,
        });
      }
    });

    // 7. Bills
    bills.forEach((b) => {
      if (b.title.toLowerCase().includes(q)) {
        results.push({
          id: `bill-${b.id}`,
          title: b.title,
          subtitle: `${currency}${b.plannedAmount} · Due day ${b.dueDate} · ${b.isPaid ? 'Paid' : 'Unpaid'}`,
          type: 'Bills',
          view: 'budget',
          icon: Wallet,
        });
      }
    });

    // 8. Habits
    habits.forEach((h) => {
      const matchTitle = h.title.toLowerCase().includes(q);
      const matchNote = h.personalNote && h.personalNote.toLowerCase().includes(q);
      if (matchTitle || matchNote) {
        results.push({
          id: `habit-${h.id}`,
          title: h.title,
          subtitle: `${h.frequencyType} habit`,
          type: 'Habits',
          view: 'habits',
          icon: Flame,
        });
      }
    });

    // 9. Groceries
    groceries.forEach((g) => {
      if (g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q)) {
        results.push({
          id: `gro-${g.id}`,
          title: g.name,
          subtitle: `${g.amount} ${g.unit} · ${g.category} · ${g.sourceType === 'generated' ? 'From meal plan' : 'Manual extra'}`,
          type: 'Groceries',
          view: 'groceries',
          icon: ShoppingCart,
        });
      }
    });

    // 10. Inbox Thoughts
    inbox.forEach((item) => {
      if (item.text.toLowerCase().includes(q)) {
        results.push({
          id: `inbox-${item.id}`,
          title: item.text,
          subtitle: `Added ${item.createdAt.slice(0, 10)}`,
          type: 'Inbox thoughts',
          view: 'inbox',
          icon: InboxIcon,
        });
      }
    });

    return results;
  }, [query, tasks, routines, calendarEvents, workouts, goals, recipes, bills, habits, groceries, inbox, currency]);

  // Grouped results map
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResultItem[]> = {};
    for (const item of flattenedResults) {
      if (!groups[item.type]) {
        groups[item.type] = [];
      }
      groups[item.type].push(item);
    }
    return groups;
  }, [flattenedResults]);

  // Reset selectedIndex and expanded groups whenever query changes
  useEffect(() => {
    setSelectedIndex(0);
    setExpandedGroups({});
  }, [query]);

  // Bounded list of results actually rendered in the DOM to prevent input lag
  const visibleFlattenedResults = useMemo(() => {
    const list: SearchResultItem[] = [];
    for (const [type, items] of Object.entries(groupedResults)) {
      const isExpanded = !!expandedGroups[type];
      const slice = isExpanded ? items : items.slice(0, INITIAL_GROUP_LIMIT);
      list.push(...slice);
    }
    return list;
  }, [groupedResults, expandedGroups]);

  const handleSelectResult = (item: SearchResultItem) => {
    if (item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
      setCurrentDate(item.date);
    }
    setActiveView(item.view);
    setActiveModal(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (visibleFlattenedResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < visibleFlattenedResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : visibleFlattenedResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = visibleFlattenedResults[selectedIndex];
      if (current) {
        handleSelectResult(current);
      }
    }
  };

  return (
    <Modal
      isOpen={activeModal === 'search'}
      onClose={() => setActiveModal(null)}
      title="Search planner"
      subtitle="Search across tasks, routines, calendar, workouts, goals, recipes, bills, and more"
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#526782] dark:text-[#A8B8CE]" />
          <input
            type="text"
            autoFocus
            aria-label="Search across tasks, routines, workouts, recipes, bills, goals"
            placeholder="Type anything to search across your planner…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-[#071A3A] dark:text-[#EDF4FF] focus:ring-2 focus:ring-[var(--focus-ring)] focus:outline-none"
          />
        </div>

        <div aria-live="polite" className="max-h-80 overflow-y-auto space-y-3 text-xs pr-1">
          {!query.trim() ? (
            <div className="py-6 px-4 text-center space-y-2">
              <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
                Type anything to search across your planner.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                {[
                  'Tasks',
                  'Routines',
                  'Calendar & Focus',
                  'Workouts',
                  'Goals',
                  'Recipes',
                  'Bills',
                  'Habits',
                  'Groceries',
                  'Inbox',
                ].map((scope) => (
                  <span
                    key={scope}
                    className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-[#526782] dark:text-[#A8B8CE]"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          ) : flattenedResults.length === 0 ? (
            <div className="py-8 text-center space-y-1">
              <p className="font-semibold text-xs text-[#071A3A] dark:text-[#EDF4FF]">
                No matches found for “{query}”.
              </p>
              <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                Try searching for tasks, routines, recipes, workouts, calendar events, or goals.
              </p>
            </div>
          ) : (
            Object.entries(groupedResults).map(([type, items]) => {
              const isExpanded = !!expandedGroups[type];
              const visibleItems = isExpanded ? items : items.slice(0, INITIAL_GROUP_LIMIT);
              const remainingCount = items.length - visibleItems.length;

              return (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between px-2 pt-1 pb-1 text-[11px] font-bold text-[#526782] dark:text-[#A8B8CE] uppercase tracking-wider">
                    <span>{type}</span>
                    <span className="text-[10px] font-mono font-medium">{items.length}</span>
                  </div>
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const isSelected = visibleFlattenedResults[selectedIndex]?.id === item.id;
                      const IconComp = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-label={`${item.title}, ${item.type} in ${item.view}`}
                          aria-selected={isSelected}
                          onClick={() => handleSelectResult(item)}
                          className={`w-full text-left py-2 px-2.5 flex items-center justify-between rounded-xl transition-all cursor-pointer group ${
                            isSelected
                              ? 'bg-[var(--accent-soft)] ring-1 ring-[var(--focus-ring)]'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`p-1.5 rounded-lg shrink-0 ${
                              isSelected
                                ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]'
                                : 'bg-slate-100 dark:bg-slate-800 text-[#526782] dark:text-[#A8B8CE]'
                            }`}>
                              <IconComp className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-[#071A3A] dark:text-[#EDF4FF] truncate block">
                                {item.title}
                              </span>
                              {item.subtitle && (
                                <span className="text-[10px] text-[#526782] dark:text-[#A8B8CE] truncate block">
                                  {item.subtitle}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {item.date && (
                              <span className="text-[10px] font-mono text-[#526782] dark:text-[#A8B8CE] hidden sm:inline">
                                {item.date}
                              </span>
                            )}
                            <ArrowRight className="w-3.5 h-3.5 text-[#526782] dark:text-[#A8B8CE] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {remainingCount > 0 && !isExpanded && (
                    <button
                      type="button"
                      onClick={() => setExpandedGroups((prev) => ({ ...prev, [type]: true }))}
                      className="w-full text-center py-2 px-3 text-xs font-semibold text-[var(--accent)] bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      aria-label={`Show ${remainingCount} more ${type} matches`}
                    >
                      <span>Show {remainingCount} more {type.toLowerCase()}</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
