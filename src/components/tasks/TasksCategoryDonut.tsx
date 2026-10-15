import React, { useState } from 'react';

interface CategoryItem {
  count: number;
  percentage: number;
  color: string;
}

interface TasksCategoryDonutProps {
  distribution: Record<string, CategoryItem>;
  totalTasks: number;
}

export const TasksCategoryDonut: React.FC<TasksCategoryDonutProps> = ({
  distribution,
  totalTasks,
}) => {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // SVG parameters
  const size = 200;
  const center = size / 2;
  const radius = 72;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  const entries = Object.entries(distribution).filter(([_, item]) => item.count > 0);

  // Calculate SVG strokeDasharray and strokeDashoffset for each segment
  let accumulatedAngle = 0;
  const segments = entries.map(([category, item]) => {
    const fraction = totalTasks > 0 ? item.count / totalTasks : 0;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedAngle * circumference;
    accumulatedAngle += fraction;

    return {
      category,
      count: item.count,
      percentage: item.percentage,
      color: item.color,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  const activeCategory = hoveredCategory ? distribution[hoveredCategory] : null;

  return (
    <div
      className="card-surface p-5 space-y-4 rounded-2xl flex flex-col justify-between"
      data-testid="tasks-category-donut"
    >
      {/* Header */}
      <div>
        <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
          Tasks by category
        </h3>
        <p className="text-xs text-[#526782] dark:text-[#A8B8CE] mt-0.5">
          Distribution across life domains
        </p>
      </div>

      {/* Donut Chart with Center Text */}
      <div className="relative flex items-center justify-center py-2">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-44 h-44 transform -rotate-90 select-none overflow-visible"
          role="img"
          aria-label="Category distribution donut chart"
        >
          {/* Background Track Circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-100 dark:text-slate-800/80"
          />

          {/* Slices */}
          {segments.map((seg) => {
            const isHovered = hoveredCategory === seg.category;
            return (
              <circle
                key={seg.category}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="butt"
                className="transition-all duration-200 cursor-pointer"
                onPointerEnter={() => setHoveredCategory(seg.category)}
                onPointerLeave={() => setHoveredCategory(null)}
                tabIndex={0}
                role="button"
                aria-label={`${seg.category}: ${seg.count} tasks (${seg.percentage}%)`}
                onFocus={() => setHoveredCategory(seg.category)}
                onBlur={() => setHoveredCategory(null)}
              />
            );
          })}
        </svg>

        {/* Center Readout (Inverted rotation back to normal) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          {hoveredCategory && activeCategory ? (
            <>
              <span className="text-[10px] font-semibold text-[#526782] dark:text-[#A8B8CE] truncate max-w-[88px]">
                {hoveredCategory}
              </span>
              <span className="text-lg font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] leading-tight">
                {activeCategory.count}
              </span>
              <span className="text-[10px] font-mono text-[var(--accent)]">
                {activeCategory.percentage}%
              </span>
            </>
          ) : (
            <>
              <span className="text-xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] leading-tight">
                {totalTasks}
              </span>
              <span className="text-[10px] font-medium text-[#526782] dark:text-[#A8B8CE] mt-0.5">
                Total tasks
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend Grid */}
      <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
        {Object.entries(distribution).map(([cat, item]) => {
          const isHovered = hoveredCategory === cat;
          return (
            <div
              key={cat}
              className={`flex items-center justify-between text-xs py-1 px-1.5 rounded-lg transition-colors cursor-pointer ${
                isHovered
                  ? 'bg-slate-100 dark:bg-slate-800/60 font-semibold'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'
              }`}
              onPointerEnter={() => setHoveredCategory(cat)}
              onPointerLeave={() => setHoveredCategory(null)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[#071A3A] dark:text-[#EDF4FF] truncate">{cat}</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[#526782] dark:text-[#A8B8CE]">
                <span>{item.count}</span>
                <span className="text-[10px] text-slate-400">({item.percentage}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
