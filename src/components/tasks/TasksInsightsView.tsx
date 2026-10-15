import React, { useState, useMemo } from 'react';
import { TaskItem, Priority } from '../../types/planner';
import {
  computeInsights,
  InsightsRange,
  CATEGORY_COLORS,
} from '../../utils/insightsMetrics';
import { TasksThroughputChart } from './TasksThroughputChart';
import { TasksCategoryDonut } from './TasksCategoryDonut';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

interface TasksInsightsViewProps {
  tasks: TaskItem[];
  allTasksCount?: number;
  onClearFilters?: () => void;
  currentDate: string;
  timeZone?: string;
  onToggleTaskCompletion: (taskId: string) => void;
}

export const TasksInsightsView: React.FC<TasksInsightsViewProps> = ({
  tasks,
  allTasksCount,
  onClearFilters,
  currentDate,
  timeZone,
  onToggleTaskCompletion,
}) => {
  const [selectedRange, setSelectedRange] = useState<InsightsRange>('30D');

  // Compute analytics using pure calculation utility
  const summary = useMemo(
    () => computeInsights(tasks, currentDate, selectedRange, timeZone),
    [tasks, currentDate, selectedRange, timeZone]
  );

  // Active non-archived tasks
  const activeTasks = useMemo(() => tasks.filter((t) => !t.isArchived), [tasks]);

  // Deadlines next 7 days
  const next7DaysCounts = useMemo(() => {
    const days: { name: string; count: number; iso: string }[] = [];
    const [year, month, day] = currentDate.split('-').map(Number);
    for (let i = 0; i < 7; i++) {
      const d = new Date(year, month - 1, day + i);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(d.getDate()).padStart(2, '0');
      const iso = `${yStr}-${mStr}-${dStr}`;
      const name = d.toLocaleDateString('en-US', { weekday: 'short' });
      const count = activeTasks.filter(
        (t) => t.status !== 'completed' && t.dueDate === iso
      ).length;
      days.push({ name, count, iso });
    }
    return days;
  }, [activeTasks, currentDate]);

  // Overdue tasks
  const overdueTasks = useMemo(
    () =>
      activeTasks.filter(
        (t) => t.status !== 'completed' && t.dueDate && t.dueDate < currentDate
      ),
    [activeTasks, currentDate]
  );

  const rangeButtons: { id: InsightsRange; label: string }[] = [
    { id: '7D', label: '7D' },
    { id: '30D', label: '30D' },
    { id: '90D', label: '90D' },
  ];

  return (
    <div className="space-y-6" data-testid="tasks-insights-container">
      {/* Active Filter Scope Disclosure (R3) */}
      {allTasksCount !== undefined && allTasksCount > tasks.length && (
        <div
          role="status"
          data-testid="insights-filter-disclosure"
          className="p-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2 text-[#071A3A] dark:text-[#EDF4FF]">
            <Info className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <span>
              Showing insights for <strong>{tasks.length}</strong> filtered task{tasks.length === 1 ? '' : 's'} (of {allTasksCount} total).
            </span>
          </div>
          {onClearFilters && (
            <button
              type="button"
              data-testid="insights-clear-filters-btn"
              onClick={onClearFilters}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer shrink-0"
            >
              Clear active filters
            </button>
          )}
        </div>
      )}

      {/* Unknown History Disclosure Notice (R1) */}
      {summary.unknownHistoryCount > 0 && (
        <div
          role="note"
          data-testid="insights-unknown-history-notice"
          className="p-3 px-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            {summary.unknownHistoryCount} completed task{summary.unknownHistoryCount === 1 ? '' : 's'} with unrecorded completion dates {summary.unknownHistoryCount === 1 ? 'is' : 'are'} excluded from dated throughput.
          </span>
        </div>
      )}

      {/* Top Controls Bar: Subtitle & Range Switcher (Fernly frame-041) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Task Throughput & Completion Trends
          </h3>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE] mt-0.5">
            {summary.currentRange.startDate} – {summary.currentRange.endDate} (vs.{' '}
            {summary.previousRange.startDate} – {summary.previousRange.endDate})
          </p>
        </div>

        {/* 7D / 30D / 90D Range Control */}
        <div
          role="tablist"
          aria-label="Insights time range"
          className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 gap-1 self-start sm:self-auto"
        >
          {rangeButtons.map((r) => {
            const isSelected = selectedRange === r.id;
            return (
              <button
                key={r.id}
                role="tab"
                type="button"
                data-testid={`insights-range-${r.id}`}
                aria-selected={isSelected}
                onClick={() => setSelectedRange(r.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#071A3A] dark:bg-[var(--accent)] text-white dark:text-[#071A3A] shadow-xs'
                    : 'text-[#526782] dark:text-[#A8B8CE] hover:text-[#071A3A] dark:hover:text-[#EDF4FF]'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Top Metric Cards (Fernly Reference frame-041) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Tasks Completed */}
        <div className="card-surface p-4 rounded-2xl space-y-1.5" data-testid="metric-tasks-completed">
          <div className="text-xs font-medium text-[#526782] dark:text-[#A8B8CE] flex items-center justify-between">
            <span>Tasks completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]">
            {summary.completedCount}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`font-semibold font-mono ${
                summary.completedMetric.isPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : summary.completedMetric.isNeutral
                  ? 'text-slate-500'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {summary.completedMetric.isPositive && '^ '}
              {summary.completedMetric.formattedChange}
            </span>
            <span className="text-[11px] text-slate-400">vs previous {selectedRange}</span>
          </div>
        </div>

        {/* Metric 2: Completion Velocity */}
        <div className="card-surface p-4 rounded-2xl space-y-1.5" data-testid="metric-completion-velocity">
          <div className="text-xs font-medium text-[#526782] dark:text-[#A8B8CE] flex items-center justify-between">
            <span>Daily velocity</span>
            <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]">
            {summary.dailyVelocity}{' '}
            <span className="text-xs font-normal text-slate-400">/ day</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`font-semibold font-mono ${
                summary.velocityMetric.isPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : summary.velocityMetric.isNeutral
                  ? 'text-slate-500'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {summary.velocityMetric.isPositive && '^ '}
              {summary.velocityMetric.formattedChange}
            </span>
            <span className="text-[11px] text-slate-400">vs previous {selectedRange}</span>
          </div>
        </div>

        {/* Metric 3: On-time Delivery Rate */}
        <div className="card-surface p-4 rounded-2xl space-y-1.5" data-testid="metric-ontime-delivery">
          <div className="text-xs font-medium text-[#526782] dark:text-[#A8B8CE] flex items-center justify-between">
            <span>On-time delivery</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]">
            {summary.onTimeRate !== null ? `${summary.onTimeRate}%` : '—'}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            {summary.onTimeRate !== null ? (
              <>
                <span
                  className={`font-semibold font-mono ${
                    summary.onTimeMetric.isPositive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : summary.onTimeMetric.isNeutral
                      ? 'text-slate-500'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {summary.onTimeMetric.isPositive && '^ '}
                  {summary.onTimeMetric.formattedChange}
                </span>
                <span className="text-[11px] text-slate-400">vs previous {selectedRange}</span>
              </>
            ) : (
              <span className="text-[11px] text-slate-400">No eligible completions in period</span>
            )}
          </div>
        </div>

        {/* Metric 4: Active Backlog */}
        <div className="card-surface p-4 rounded-2xl space-y-1.5" data-testid="metric-active-backlog">
          <div className="text-xs font-medium text-[#526782] dark:text-[#A8B8CE] flex items-center justify-between">
            <span>Active backlog</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]">
            {summary.activeBacklogCount}
          </div>
          <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE] truncate">
            {summary.urgentHighBacklogCount} high/urgent · {summary.overdueBacklogCount} overdue
          </div>
        </div>
      </div>

      {/* Main Charts Row: Left Throughput Chart (2/3) + Right Category Donut (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <TasksThroughputChart
            points={summary.throughputPoints}
            maxCount={summary.maxDailyCount}
            rangeDays={summary.currentRange.daysCount}
          />
        </div>
        <div className="lg:col-span-1">
          <TasksCategoryDonut
            distribution={summary.categoryDistribution}
            totalTasks={activeTasks.length}
          />
        </div>
      </div>

      {/* Status Breakdown Bar */}
      <div className="card-surface p-5 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Tasks by status
          </h3>
          <span className="text-xs font-mono text-[#526782] dark:text-[#A8B8CE]">
            {activeTasks.length} total active tasks
          </span>
        </div>

        {/* Segmented horizontal bar */}
        <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
          {summary.statusCounts.not_started > 0 && (
            <div
              style={{
                width: `${(summary.statusCounts.not_started / (activeTasks.length || 1)) * 100}%`,
              }}
              className="bg-slate-400 h-full"
              title={`Not started: ${summary.statusCounts.not_started}`}
            />
          )}
          {summary.statusCounts.in_progress > 0 && (
            <div
              style={{
                width: `${(summary.statusCounts.in_progress / (activeTasks.length || 1)) * 100}%`,
              }}
              className="bg-amber-500 h-full"
              title={`In progress: ${summary.statusCounts.in_progress}`}
            />
          )}
          {summary.statusCounts.on_hold > 0 && (
            <div
              style={{
                width: `${(summary.statusCounts.on_hold / (activeTasks.length || 1)) * 100}%`,
              }}
              className="bg-blue-500 h-full"
              title={`On hold: ${summary.statusCounts.on_hold}`}
            />
          )}
          {summary.statusCounts.completed > 0 && (
            <div
              style={{
                width: `${(summary.statusCounts.completed / (activeTasks.length || 1)) * 100}%`,
              }}
              className="bg-emerald-500 h-full"
              title={`Completed: ${summary.statusCounts.completed}`}
            />
          )}
        </div>

        {/* Legend pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
            <span className="flex items-center gap-1.5 text-[#526782] dark:text-[#A8B8CE]">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span>Not started</span>
            </span>
            <span className="font-mono font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              {summary.statusCounts.not_started}
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50/50 dark:bg-amber-950/20">
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>In progress</span>
            </span>
            <span className="font-mono font-bold text-amber-800 dark:text-amber-200">
              {summary.statusCounts.in_progress}
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50/50 dark:bg-blue-950/20">
            <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>On hold</span>
            </span>
            <span className="font-mono font-bold text-blue-800 dark:text-blue-200">
              {summary.statusCounts.on_hold}
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20">
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Completed</span>
            </span>
            <span className="font-mono font-bold text-emerald-800 dark:text-emerald-200">
              {summary.statusCounts.completed}
            </span>
          </div>
        </div>
      </div>

      {/* Matrix table: Outstanding Priorities by Category (Preserved for accessibility & Stage 5 assertions) */}
      <div className="card-surface p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Outstanding priorities by category
            </h3>
            <p className="text-xs text-[#526782] dark:text-[#A8B8CE] mt-0.5">
              Breakdown of active, non-completed tasks across categories
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-[var(--accent)]">
            {summary.activeBacklogCount} open tasks
          </span>
        </div>

        <div className="overflow-x-auto">
          <table
            data-testid="tasks-accessible-insights-table"
            className="w-full text-left text-xs border-collapse"
          >
            <thead>
              <tr className="border-b border-[#E2E8F0] dark:border-[#1E2D4A] text-[#526782] dark:text-[#A8B8CE]">
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-center">Urgent</th>
                <th className="py-2.5 px-3 text-center">High</th>
                <th className="py-2.5 px-3 text-center">Medium</th>
                <th className="py-2.5 px-3 text-center">Low</th>
                <th className="py-2.5 px-3 text-center">Lowest</th>
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {['Personal', 'Career', 'Health', 'Finances', 'Relationships'].map((cat) => {
                const openInCat = activeTasks.filter(
                  (t) => t.category === cat && t.status !== 'completed'
                );
                const urgent = openInCat.filter((t) => t.priority === 'urgent').length;
                const high = openInCat.filter((t) => t.priority === 'high').length;
                const medium = openInCat.filter((t) => t.priority === 'medium').length;
                const low = openInCat.filter((t) => t.priority === 'low').length;
                const lowest = openInCat.filter((t) => t.priority === 'lowest').length;

                return (
                  <tr key={cat} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                    <td className="py-2.5 px-3 font-semibold text-[#071A3A] dark:text-[#EDF4FF] flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                      />
                      <span>{cat}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-rose-600 dark:text-rose-400">
                      {urgent || '–'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-amber-600 dark:text-amber-400">
                      {high || '–'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-blue-600 dark:text-blue-400">
                      {medium || '–'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                      {low || '–'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                      {lowest || '–'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                      {openInCat.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deadlines Next 7 Days & Overdue Tasks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deadlines Next 7 Days */}
        <div className="card-surface p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Upcoming deadlines (next 7 days)
          </h3>
          <div className="flex items-end justify-between h-32 pt-6">
            {next7DaysCounts.map((d) => (
              <div key={d.iso} className="flex flex-col items-center gap-1.5 flex-1">
                <span className="text-xs font-mono font-bold text-[var(--accent)]">
                  {d.count}
                </span>
                <div
                  className="w-5 bg-[var(--accent)]/20 dark:bg-[var(--accent)]/30 rounded-t-md transition-all"
                  style={{ height: `${Math.max(6, d.count * 28)}px` }}
                />
                <span className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Overdue Tasks */}
        <div className="card-surface p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Overdue tasks ({overdueTasks.length})
            </h3>
            {overdueTasks.length > 0 && (
              <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                Action required
              </span>
            )}
          </div>

          <div className="space-y-2 max-h-44 overflow-y-auto">
            {overdueTasks.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1 opacity-80" />
                No overdue tasks. All deadlines on track!
              </div>
            ) : (
              overdueTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-semibold text-rose-900 dark:text-rose-200 truncate">
                      {t.title}
                    </div>
                    <div className="text-[10px] text-rose-600 dark:text-rose-400">
                      Due {t.dueDate}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleTaskCompletion(t.id)}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-semibold hover:bg-rose-700 cursor-pointer shrink-0"
                    aria-label={`Complete overdue task "${t.title}"`}
                  >
                    Complete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Historical Data Disclosure Notice (Requirement 8) */}
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80 flex items-start gap-2.5 text-xs text-[#526782] dark:text-[#A8B8CE]">
        <Info className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-[#071A3A] dark:text-[#EDF4FF]">Data tracking note:</strong> Task completion dates are recorded as items are marked completed (<code className="font-mono text-[11px] text-[var(--accent)]">completedAt</code>). Re-opened or legacy tasks without historic event records reflect their current status.
        </p>
      </div>
    </div>
  );
};
