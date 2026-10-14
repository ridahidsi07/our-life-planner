import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export interface MetricCardProps {
  variant?: 'featured' | 'standard';
  title: string;
  value: string | number;
  badge?: {
    text: string;
    positive?: boolean;
    negative?: boolean;
  };
  subtitle?: string;
  actionAriaLabel?: string;
  onAction?: () => void;
  actionIcon?: React.ElementType;
  className?: string;
  children?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  variant = 'standard',
  title,
  value,
  badge,
  subtitle,
  actionAriaLabel,
  onAction,
  actionIcon: ActionIcon = ArrowUpRight,
  className = '',
  children,
}) => {
  const isFeatured = variant === 'featured';

  return (
    <div
      className={`metric-card p-5 transition-all ${
        isFeatured ? 'card-featured' : 'card-surface'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span
          className={`text-xs font-semibold tracking-wide uppercase ${
            isFeatured
              ? 'text-white/80'
              : 'text-[#59677B] dark:text-[#A8B8CE]'
          }`}
        >
          {title}
        </span>
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            aria-label={actionAriaLabel || `View details for ${title}`}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isFeatured
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'border border-slate-200/90 dark:border-slate-700/80 hover:bg-slate-100/80 dark:hover:bg-slate-800 text-[#59677B] dark:text-[#A8B8CE] hover:text-[#14233B] dark:hover:text-[#EDF4FF]'
            }`}
          >
            <ActionIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="my-1">
        <div
          className={`text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums ${
            isFeatured ? 'text-white' : 'text-[#14233B] dark:text-[#EDF4FF]'
          }`}
        >
          {value}
        </div>
      </div>

      {(badge || subtitle || children) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
          {badge && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
                isFeatured
                  ? 'bg-white/15 text-white border border-white/10'
                  : badge.positive
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60'
                  : badge.negative
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/60'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-[#59677B] dark:text-[#A8B8CE] border border-slate-200/60 dark:border-slate-700/60'
              }`}
            >
              {badge.text}
            </span>
          )}
          {subtitle && (
            <span
              className={
                isFeatured
                  ? 'text-white/70 text-[11.5px]'
                  : 'text-[#59677B] dark:text-[#8A99AD] text-[11.5px]'
              }
            >
              {subtitle}
            </span>
          )}
          {children}
        </div>
      )}
    </div>
  );
};
