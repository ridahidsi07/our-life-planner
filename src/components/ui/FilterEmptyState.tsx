import React from 'react';
import { SearchX, RotateCcw } from 'lucide-react';

interface FilterEmptyStateProps {
  title?: string;
  description?: string;
  onClearFilters: () => void;
  clearLabel?: string;
  dataTestId?: string;
}

export const FilterEmptyState: React.FC<FilterEmptyStateProps> = ({
  title = 'No matching items found',
  description = 'None of your records match the active search or filter criteria. Reset filters to see all items.',
  onClearFilters,
  clearLabel = 'Clear filters & search',
  dataTestId = 'filter-empty-state',
}) => {
  return (
    <div
      data-testid={dataTestId}
      role="status"
      className="p-8 my-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/30 text-center flex flex-col items-center justify-center space-y-3 motion-filter-enter"
    >
      <div className="w-10 h-10 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)]">
        <SearchX className="w-5 h-5 stroke-[1.75]" />
      </div>

      <div className="space-y-1 max-w-sm">
        <h4 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
          {title}
        </h4>
        <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
          {description}
        </p>
      </div>

      <button
        type="button"
        data-testid="clear-filters-btn"
        onClick={onClearFilters}
        className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover-bg)] text-[var(--btn-primary-fg)] transition-colors cursor-pointer shadow-2xs micro-tap"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>{clearLabel}</span>
      </button>
    </div>
  );
};
