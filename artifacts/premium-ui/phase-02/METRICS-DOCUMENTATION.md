# Today Dashboard: Four Metrics Documentation

This document defines the mathematical contracts, denominator scopes, state dependencies, and interaction destinations for the four Today summary metric cards implemented in Phase 02.

---

## 1. Commitments Today (Featured Deep Navy Card)

- **Visual Role:** Featured summary card (`.card-featured` with `--accent-deep` navy surface `#071A3A`, white text, soft translucent pill badge, and top-right jump action button).
- **Test ID:** `data-testid="today-metric-commitments"`
- **Scope:** Selected day only (`currentDate`). Resets and updates cleanly whenever the user selects another day in the calendar week strip or jumps to today.
- **Formula:**
  $$\text{Commitments Today} = N_{\text{tasks}} + N_{\text{routines}} + N_{\text{bills}} + N_{\text{meals}} + N_{\text{workouts}}$$
  Where:
  - $N_{\text{tasks}}$ = Eligible non-archived tasks with `dueDate === currentDate` (or unscheduled tasks scheduled for today).
  - $N_{\text{routines}}$ = Active routine occurrences on `currentDate` that are not marked skipped (`!r.skippedDates.includes(currentDate)`).
  - $N_{\text{bills}}$ = Bills due on `currentDate` (when Money module is enabled).
  - $N_{\text{meals}}$ = Meals planned for `currentDate` (when Food module is enabled).
  - $N_{\text{workouts}}$ = Non-rest workouts scheduled for `currentDate` (when Body module is enabled).
- **Empty Denominator Handling:** If no commitments are scheduled for `currentDate`, the card cleanly displays `0` and subtitle `"No commitments scheduled"` (never NaN or misleading percentages).
- **Subtitle / Badge:**
  - Badge: `${completedCount}/${totalCompletable} done`
  - Subtitle: `${totalCompletable - completedCount} remaining today` (or `"All finished today"` when complete).
- **Click Destination:** Top-right action button smoothly scrolls the page to the `"Your day"` schedule section (`#today-schedule-section`).

---

## 2. Completed Today

- **Visual Role:** Crisp quiet surface card (`.card-surface`, high-contrast text, tonal completion percentage badge).
- **Test ID:** `data-testid="today-metric-completed"`
- **Scope:** Strict subset of Metric #1 for `currentDate`.
- **Formula:**
  $$\text{Completed Today} = \sum \mathbf{1}_{\{\text{item is completed for currentDate}\}}$$
  Where:
  - Task is marked `status === 'completed'`.
  - Routine occurrence is marked in `r.completedDates.includes(currentDate)`.
  - Bill is marked `b.isPaid === true`.
  - Meal is marked `m.isConsumed === true`.
  - Workout is marked `w.isCompleted === true`.
- **Percentage Formula:**
  $$\text{Completion Rate} = \begin{cases} 0\% & \text{if } \text{Total Commitments} = 0 \\ \left\lfloor \frac{\text{Completed Today}}{\text{Total Commitments}} \times 100 \right\rceil \% & \text{otherwise} \end{cases}$$
- **Subtitle / Badge:**
  - Badge: `${completionPercentage}%` (positive green tint when $\ge 50\%$).
  - Subtitle: `${completionPercentage}% of daily commitments`.
- **Click Destination:** Smoothly scrolls the page to the schedule section (`#today-schedule-section`).

---

## 3. Needs Attention

- **Visual Role:** Crisp quiet surface card (`.card-surface`, alert badge).
- **Test ID:** `data-testid="today-metric-overdue"`
- **Scope:** Overdue tasks across all historical dates. Clearly labeled overdue scope.
- **Formula:**
  $$\text{Needs Attention} = \left| \{ t \in \text{Tasks} \mid t.\text{dueDate} < \text{todayDate} \land t.\text{status} \neq \text{'completed'} \land \neg t.\text{isArchived} \} \right|$$
- **Empty State:** When no tasks are overdue, displays `0` with a positive badge `"All clear"` and subtitle `"overdue across all dates"`.
- **Active State:** When overdue tasks exist, displays count with danger-tinted badge `"${N} actions"` and subtitle `"overdue across all dates"`.
- **Click Destination:** If overdue tasks exist, expands the inline overdue attention details drawer; otherwise navigates directly to the full Tasks view (`setActiveView('tasks')`).

---

## 4. Weekly Consistency

- **Visual Role:** Crisp quiet surface card (`.card-surface`, trend badge).
- **Test ID:** `data-testid="today-metric-consistency"`
- **Scope:** Current calendar week (the 7 days determined by `settings.weekStartsOn`).
- **Formula:**
  $$\text{Weekly Consistency} = \begin{cases} 0\% & \text{if } \text{Total Due in Week} = 0 \\ \left\lfloor \frac{\text{Completed in Week}}{\text{Total Due in Week}} \times 100 \right\rceil \% & \text{otherwise} \end{cases}$$
  Where:
  - $\text{Total Due in Week} = \text{Tasks due in week} + \text{Routines active in week} + (\text{Habit slots in week if habits enabled})$.
  - $\text{Completed in Week} = \text{Tasks completed in week} + \text{Routines completed/forgiven in week} + (\text{Habit check-ins if habits enabled})$.
  - If Habits module is disabled, strictly evaluates tasks and routines without mixing fictional habit denominators.
- **Empty Denominator Handling:** If a brand-new planner has zero tasks and routines for the week, displays `0%` and `"Start week"` (never NaN or 100%).
- **Subtitle / Badge:**
  - Badge: `"On track"` when $\ge 70\%$, `"Building"` when $> 0\%$, `"Start week"` when $0\%$.
  - Subtitle: `${weeklyCompletedCount} of ${weeklyTotalCount} this week`.
- **Click Destination:** Opens the guided Weekly Review modal (`setActiveModal('weekly_review')`).

---

## Reactive Update Integrity

Every planner operation:
- Completing / reopening a task (`toggleTaskCompletion`)
- Completing a routine occurrence (`toggleRoutineCompletion`)
- Rescheduling an overdue task (`rescheduleTask`)
- Checking a habit (`toggleHabitCheck`)
- Creating an item via Quick Add (`setActiveModal('quick_add')`)

Immediately and synchronously re-evaluates all 4 metric cards from the single shared state store (`usePlanner()`), guaranteeing zero discrepancy between summary cards, the schedule agenda, and underlying records.
