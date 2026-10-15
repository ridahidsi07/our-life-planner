import React, { useState, useRef } from 'react';
import { DailyThroughputPoint } from '../../utils/insightsMetrics';

interface TasksThroughputChartProps {
  points: DailyThroughputPoint[];
  maxCount: number;
  rangeDays: number;
}

export const TasksThroughputChart: React.FC<TasksThroughputChartProps> = ({
  points,
  maxCount,
  rangeDays,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dimensions for SVG internal coordinate system
  const svgWidth = 800;
  const svgHeight = 240;
  const paddingLeft = 36;
  const paddingRight = 20;
  const paddingTop = 24;
  const paddingBottom = 36;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Y-axis maximum: ensure at least 4 for clean steps
  const yMax = Math.max(4, Math.ceil(maxCount * 1.25));

  // Determine Y coordinate for a given count
  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(val, yMax));
    return paddingTop + chartHeight - (clamped / yMax) * chartHeight;
  };

  // Determine X coordinate for a point index
  const getX = (index: number) => {
    if (points.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (points.length - 1)) * chartWidth;
  };

  // Build SVG path strings
  const thisPeriodCoords = points.map((p, idx) => ({ x: getX(idx), y: getY(p.thisPeriodCount) }));
  const prevPeriodCoords = points.map((p, idx) => ({ x: getX(idx), y: getY(p.previousPeriodCount) }));

  // Create smooth or linear SVG path
  const buildLinePath = (coords: { x: number; y: number }[]) => {
    if (coords.length === 0) return '';
    return coords.reduce((acc, curr, idx) => {
      if (idx === 0) return `M ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
      return `${acc} L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    }, '');
  };

  const thisPeriodPath = buildLinePath(thisPeriodCoords);
  const prevPeriodPath = buildLinePath(prevPeriodCoords);

  // Closed area path for gradient under "This period" line
  const areaPath =
    thisPeriodCoords.length > 0
      ? `${thisPeriodPath} L ${thisPeriodCoords[thisPeriodCoords.length - 1].x.toFixed(1)} ${(
          paddingTop + chartHeight
        ).toFixed(1)} L ${thisPeriodCoords[0].x.toFixed(1)} ${(
          paddingTop + chartHeight
        ).toFixed(1)} Z`
      : '';

  // Y-axis ticks (4 ticks: 0, 1/3, 2/3, max)
  const yTicks = [
    0,
    Math.round(yMax * 0.33),
    Math.round(yMax * 0.66),
    yMax,
  ];

  // X-axis label indices (select 5-6 evenly spaced points)
  const step = Math.max(1, Math.floor(points.length / 5));
  const xLabelIndices: number[] = [];
  for (let i = 0; i < points.length; i += step) {
    xLabelIndices.push(i);
  }
  if (xLabelIndices[xLabelIndices.length - 1] !== points.length - 1 && points.length > 0) {
    xLabelIndices.push(points.length - 1);
  }

  // Handle pointer interactions
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - svgRect.left;
    const ratio = (clientX - (paddingLeft / svgWidth) * svgRect.width) / ((chartWidth / svgWidth) * svgRect.width);
    const rawIdx = Math.round(ratio * (points.length - 1));
    const clampedIdx = Math.max(0, Math.min(rawIdx, points.length - 1));
    setHoverIndex(clampedIdx);
  };

  const handlePointerLeave = () => {
    setHoverIndex(null);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (points.length === 0) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setHoverIndex((prev) => (prev === null ? 0 : Math.min(prev + 1, points.length - 1)));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setHoverIndex((prev) => (prev === null ? points.length - 1 : Math.max(prev - 1, 0)));
    } else if (e.key === 'Escape') {
      setHoverIndex(null);
    }
  };

  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;
  const activeX = hoverIndex !== null ? getX(hoverIndex) : 0;
  const activeY = activePoint ? getY(activePoint.thisPeriodCount) : 0;
  const activePrevY = activePoint ? getY(activePoint.previousPeriodCount) : 0;

  // Screen reader readout
  const srAnnouncement = activePoint
    ? `${activePoint.label}: ${activePoint.thisPeriodCount} tasks completed. Previous period: ${activePoint.previousPeriodCount} tasks.`
    : '';

  return (
    <div
      ref={containerRef}
      className="card-surface p-5 space-y-4 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded-2xl"
      tabIndex={0}
      role="region"
      aria-label="Throughput chart. Use left and right arrow keys to inspect daily task completions."
      onKeyDown={handleKeyDown}
      data-testid="tasks-throughput-chart"
    >
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Throughput
          </h3>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE] mt-0.5">
            Tasks completed per day, against the previous period
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5 text-[var(--chart-current,var(--accent))]">
            <span className="w-3.5 h-0.5 bg-[var(--chart-current,var(--accent))] rounded-full" />
            <span>This period</span>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--chart-previous,#94A3B8)]">
            <span className="w-3.5 h-0.5 border-b border-dashed border-[var(--chart-previous,#94A3B8)]" />
            <span>Previous</span>
          </div>
        </div>
      </div>

      {/* Screen Reader Live Announcement */}
      <div aria-live="polite" className="sr-only">
        {srAnnouncement}
      </div>

      {/* Chart Surface */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible select-none cursor-crosshair touch-none"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onMouseMove={handlePointerMove}
          onMouseLeave={handlePointerLeave}
          role="img"
          aria-label="Throughput trend line chart"
        >
          {/* Transparent event capture surface */}
          <rect
            x={0}
            y={0}
            width={svgWidth}
            height={svgHeight}
            fill="transparent"
            className="cursor-crosshair pointer-events-auto"
          />
          <defs>
            <linearGradient id="throughputAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels */}
          {yTicks.map((val) => {
            const y = getY(val);
            return (
              <g key={val} className="text-[11px] font-mono fill-slate-400 dark:fill-slate-500">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.15"
                  strokeDasharray="2 2"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="select-none"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area Fill Under "This Period" */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#throughputAreaGrad)"
              className="transition-all duration-200"
            />
          )}

          {/* Previous Period Dashed Line */}
          {prevPeriodPath && (
            <path
              d={prevPeriodPath}
              fill="none"
              stroke="var(--chart-previous, #94A3B8)"
              strokeWidth="1.75"
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />
          )}

          {/* This Period Solid Line */}
          {thisPeriodPath && (
            <path
              d={thisPeriodPath}
              fill="none"
              stroke="var(--chart-current, var(--accent))"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* X-Axis Date Labels */}
          {xLabelIndices.map((idx) => {
            const pt = points[idx];
            if (!pt) return null;
            const x = getX(idx);
            return (
              <text
                key={pt.date}
                x={x}
                y={svgHeight - 10}
                textAnchor="middle"
                className="text-[10px] font-medium fill-slate-400 dark:fill-slate-500 select-none"
              >
                {pt.label}
              </text>
            );
          })}

          {/* Hover Crosshair & Markers */}
          {activePoint && hoverIndex !== null && (
            <g className="transition-opacity duration-150">
              {/* Vertical Crosshair Line */}
              <line
                x1={activeX}
                y1={paddingTop}
                x2={activeX}
                y2={paddingTop + chartHeight}
                stroke="#071A3A"
                className="dark:stroke-slate-400"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.5"
              />

              {/* Point Marker: Previous Period */}
              <circle
                cx={activeX}
                cy={activePrevY}
                r="3.5"
                fill="#94A3B8"
                className="transition-all"
              />

              {/* Point Marker: This Period */}
              <circle
                cx={activeX}
                cy={activeY}
                r="5.5"
                fill="#FFFFFF"
                stroke="var(--accent)"
                strokeWidth="2.5"
                className="transition-all"
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip (Positioned HTML over SVG) */}
        {activePoint && hoverIndex !== null && (
          <div
            data-testid="throughput-tooltip"
            className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 bg-[#071A3A] dark:bg-slate-900 text-white rounded-xl p-2.5 shadow-xl border border-slate-700/60 text-xs min-w-[130px] transition-all"
            style={{
              left: `${(activeX / svgWidth) * 100}%`,
              top: `${Math.max(10, (activeY / svgHeight) * 100 - 8)}%`,
            }}
          >
            <div className="text-[10px] font-medium text-slate-300">
              {activePoint.label}
            </div>
            <div className="text-sm font-bold text-white mt-0.5">
              {activePoint.thisPeriodCount}{' '}
              <span className="text-xs font-normal text-slate-300">
                {activePoint.thisPeriodCount === 1 ? 'task' : 'tasks'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-700/60">
              Prev period: {activePoint.previousPeriodCount}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
