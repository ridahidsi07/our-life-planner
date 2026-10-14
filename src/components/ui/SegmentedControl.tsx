import React, { useRef } from 'react';

export interface SegmentedControlOption<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ElementType;
  badge?: string | number;
  panelId?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  idPrefix?: string;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel,
  idPrefix = 'segmented',
  className = '',
}: SegmentedControlProps<T>) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const enabledIndices = options
      .map((opt, idx) => (!opt.disabled ? idx : -1))
      .filter((idx) => idx !== -1);

    if (enabledIndices.length === 0) return;

    let targetIndex: number | null = null;
    const currentEnabledPos = enabledIndices.indexOf(currentIndex);

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextPos = (currentEnabledPos + 1) % enabledIndices.length;
      targetIndex = enabledIndices[nextPos];
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevPos = (currentEnabledPos - 1 + enabledIndices.length) % enabledIndices.length;
      targetIndex = enabledIndices[prevPos];
    } else if (e.key === 'Home') {
      e.preventDefault();
      targetIndex = enabledIndices[0];
    } else if (e.key === 'End') {
      e.preventDefault();
      targetIndex = enabledIndices[enabledIndices.length - 1];
    }

    if (targetIndex !== null && targetIndex !== undefined) {
      const nextOpt = options[targetIndex];
      if (nextOpt && !nextOpt.disabled) {
        onChange(nextOpt.id);
        buttonRefs.current[targetIndex]?.focus();
      }
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 gap-1 border border-slate-200/50 dark:border-slate-700/50 ${className}`}
    >
      {options.map((opt, idx) => {
        const isSelected = opt.id === value;
        const Icon = opt.icon;
        const tabId = `${idPrefix}-tab-${opt.id}`;
        return (
          <button
            key={opt.id}
            ref={(el) => {
              buttonRefs.current[idx] = el;
            }}
            id={tabId}
            role="tab"
            type="button"
            disabled={opt.disabled}
            aria-selected={isSelected}
            aria-controls={opt.panelId}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => {
              if (!opt.disabled) onChange(opt.id);
            }}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`flex items-center gap-1.5 rounded-lg font-semibold transition-all cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#087F83] dark:focus-visible:ring-[#38D0C5] ${
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs'
            } ${
              opt.disabled ? 'opacity-40 cursor-not-allowed' : ''
            } ${
              isSelected
                ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                : 'text-[#59677B] dark:text-[#A8B8CE] hover:text-[#14233B] dark:hover:text-[#EDF4FF]'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-slate-700 font-semibold tabular-nums">
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
