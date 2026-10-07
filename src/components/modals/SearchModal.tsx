import React, { useState, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import {
  Search,
  CheckSquare,
  Utensils,
  Wallet,
  ArrowRight,
} from 'lucide-react';

export const SearchModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    tasks,
    recipes,
    bills,
    setActiveView,
  } = usePlanner();

  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();

    const results: Array<{
      id: string;
      title: string;
      type: 'Task' | 'Recipe' | 'Bill';
      date?: string;
      view: string;
    }> = [];

    // Search tasks
    tasks.forEach((t) => {
      if (t.title.toLowerCase().includes(q)) {
        results.push({
          id: t.id,
          title: t.title,
          type: 'Task',
          date: t.dueDate,
          view: 'tasks',
        });
      }
    });

    // Search recipes
    recipes.forEach((r) => {
      if (r.title.toLowerCase().includes(q)) {
        results.push({
          id: r.id,
          title: r.title,
          type: 'Recipe',
          date: `${r.baseServings} servings`,
          view: 'meals',
        });
      }
    });

    // Search bills
    bills.forEach((b) => {
      if (b.title.toLowerCase().includes(q)) {
        results.push({
          id: b.id,
          title: b.title,
          type: 'Bill',
          date: `$${b.plannedAmount} · Due ${b.dueDate}`,
          view: 'budget',
        });
      }
    });

    return results;
  }, [query, tasks, recipes, bills]);

  const handleSelectResult = (view: string) => {
    setActiveView(view);
    setActiveModal(null);
  };

  return (
    <Modal
      isOpen={activeModal === 'search'}
      onClose={() => setActiveModal(null)}
      title="Search planner"
      subtitle="Search across tasks, recipes and bills"
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#526782]" />
          <input
            type="text"
            autoFocus
            placeholder="Search by title, ingredient or bill name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-[#087F83] focus:outline-none"
          />
        </div>

        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {query.trim() && searchResults.length === 0 ? (
            <div className="py-8 text-center text-[#526782]">
              No matches found for “{query}”.
            </div>
          ) : (
            searchResults.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectResult(item.view)}
                className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {item.type === 'Task' && (
                    <CheckSquare className="w-4 h-4 text-blue-500" />
                  )}
                  {item.type === 'Recipe' && (
                    <Utensils className="w-4 h-4 text-emerald-500" />
                  )}
                  {item.type === 'Bill' && (
                    <Wallet className="w-4 h-4 text-rose-500" />
                  )}
                  <div>
                    <span className="font-semibold text-[#071A3A] dark:text-[#EDF4FF] group-hover:text-[#087F83]">
                      {item.title}
                    </span>
                    {item.date && (
                      <span className="text-[10px] text-[#526782] block">
                        {item.date}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-[#526782]">
                    {item.type}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#526782] opacity-0 group-hover:opacity-100" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};
