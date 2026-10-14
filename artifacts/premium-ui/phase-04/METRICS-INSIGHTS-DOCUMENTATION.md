# Tasks Insights & Analytics Metric Definitions

Phase 04 establishes standardized, mathematically consistent analytics across Our Life Planner.

## Date Range Calculations

Range selection: `7D | 30D | 90D` (calculated relative to `currentDate`).

| Range | Current Period (Inclusive) | Previous Period (Inclusive) | Point Resolution |
|---|---|---|---|
| **7D** | `[currentDate - 6, currentDate]` (7 days) | `[currentDate - 13, currentDate - 7]` (7 days) | 7 daily points |
| **30D** | `[currentDate - 29, currentDate]` (30 days) | `[currentDate - 59, currentDate - 30]` (30 days) | 30 daily points |
| **90D** | `[currentDate - 89, currentDate]` (90 days) | `[currentDate - 179, currentDate - 90]` (90 days) | 90 daily points |

## Metric Card Formulas

### 1. Tasks Completed
- **Definition:** Count of active non-archived tasks whose completion date (`completedAt` or fallback `dueDate`) falls within the current period.
- **Formula:** `tasks.filter(t => !t.isArchived && t.status === 'completed' && inCurrentPeriod(t)).length`
- **Delta:** `((current - previous) / previous) * 100` if previous > 0; `+current` if previous = 0.

### 2. Daily Velocity
- **Definition:** Average completed tasks per calendar day in the selected period.
- **Formula:** `tasksCompletedInPeriod / periodDays` (rounded to 2 decimal places).
- **Delta:** Comparison against previous period velocity.

### 3. On-time Delivery Rate
- **Definition:** Percentage of completed tasks in the period (with assigned due dates) that were finished on or before their due date.
- **Formula:** `(onTimeCompletedCount / totalCompletedWithDueDate) * 100` (100% if no tasks have due dates).
- **Delta:** Percentage point comparison vs previous period.

### 4. Active Backlog
- **Definition:** Total count of active non-archived, non-completed tasks remaining in the system.
- **Formula:** `tasks.filter(t => !t.isArchived && t.status !== 'completed').length`
- **Context:** Displays count of urgent/high priority tasks and overdue tasks.

## Interactive Inspection & Accessibility

- **Throughput Chart:** Accessible SVG area/line chart with:
  - Solid accent line for This Period and dashed line for Previous Period.
  - Hover/tap crosshair with floating tooltip card showing formatted date, completed tasks count, and previous period count.
  - Keyboard navigation: chart container has `tabIndex={0}`, `ArrowRight` advances inspection point, `ArrowLeft` reverses, and `Escape` clears.
  - Live announcement via `aria-live="polite"`.
- **Category Donut:** Segmented SVG donut with:
  - Personal (#087F83), Career (#3B82F6), Health (#10B981), Finances (#F59E0B), Relationships (#8B5CF6).
  - Hover/focus on slices dynamically updates the central count and percentage.
  - Interactive legend with colored indicators and counts.
- **Priority Matrix Table:** Retains `[data-testid="tasks-accessible-insights-table"]` breaking down all 5 categories against 5 priority levels + Total.

## Historical Data Disclosure

Task completion dates are tracked as tasks are marked completed (`completedAt`). Re-opened or legacy sample tasks without historic timestamps reflect their current status.
