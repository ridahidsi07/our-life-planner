import React, { useMemo, useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { useFocusSession } from '../../context/FocusContext';
import { RingProgress } from '../ui/RingProgress';
import { PageHeader } from '../ui/PageHeader';
import { MetricCard } from '../ui/MetricCard';
import { getWeekDaysForDate, getCurrencySymbol } from '../../utils/formatters';
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Droplet,
  Flame,
  Plus,
  TrendingDown,
  TrendingUp,
  Utensils,
  Dumbbell,
  CheckCircle2,
  Calendar,
  Sparkles,
  Archive,
  Target,
  Coffee,
  RotateCcw,
  Zap,
  SlidersHorizontal,
  Moon,
  Sun,
  User,
  Play,
  Pause,
  Maximize2,
} from 'lucide-react';
import {
  calculateHabitStreak,
  convertKgToLb,
  calculateSavingsAndDebtSummary,
  computeWeightMetrics,
} from '../../utils/calculations';
import { isBirthdayEventOnDate } from '../../utils/recurrence';
import {
  isRoutineActiveOnDate,
  getRoutineOccurrence,
  formatRecurrenceRule,
} from '../../utils/routineRecurrence';
import { isModuleOrToolEnabled } from '../../utils/moduleRegistry';

export const TodayDashboard: React.FC = () => {
  const {
    currentDate,
    setCurrentDate,
    todayDate,
    isViewingToday,
    goToToday,
    settings,
    updateSettings,
    tasks,
    toggleTaskCompletion,
    archiveTask,
    rescheduleTask,
    routines,
    toggleRoutineCompletion,
    forgiveRoutineOccurrence,
    unforgiveRoutineOccurrence,
    bills,
    markBillPaid,
    unpayBill,
    savingsPots,
    debts,
    habits,
    toggleHabitCheck,
    goals,
    plannedMeals,
    toggleMealConsumed,
    workouts,
    updateWorkoutSession,
    weightProfiles,
    selectedProfileId,
    weightRecords,
    hydrationEntries,
    hydrationTargets,
    addWaterLog,
    undoLastWaterLog,
    cashFlow,
    calendarEvents,
    setActiveView,
    setActiveModal,
  } = usePlanner();

  const focusSession = useFocusSession();

  const [isCalmMode, setIsCalmMode] = useState(false);
  const [isOverdueExpanded, setIsOverdueExpanded] = useState(false);

  const currencySymbol = settings.currencySymbol || getCurrencySymbol(settings.currency) || '$';

  // Formatted date representations
  const formattedCurrentDate = useMemo(() => {
    try {
      const parts = currentDate.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return currentDate;
    }
  }, [currentDate]);

  const formattedTodayDate = useMemo(() => {
    try {
      const parts = todayDate.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return todayDate;
    }
  }, [todayDate]);

  // Tomorrow calculation relative to currentDate
  const tomorrowDateStr = useMemo(() => {
    const parts = currentDate.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [currentDate]);

  const formattedTomorrow = useMemo(() => {
    try {
      const parts = tomorrowDateStr.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return tomorrowDateStr;
    }
  }, [tomorrowDateStr]);

  // Find overdue tasks (due before todayDate, incomplete, not archived)
  const overdueTasks = useMemo(() => {
    if (!isModuleOrToolEnabled('tasks', settings.enabledTools)) return [];
    return tasks.filter((t) => {
      if (t.isArchived || t.status === 'completed' || !t.dueDate) return false;
      return t.dueDate < todayDate;
    });
  }, [tasks, todayDate, settings.enabledTools]);

  const topOverdueTask = overdueTasks.length > 0 ? overdueTasks[0] : null;
  const overdueDaysLate = useMemo(() => {
    if (!topOverdueTask || !topOverdueTask.dueDate) return 0;
    const dueParts = topOverdueTask.dueDate.split('-');
    const due = new Date(parseInt(dueParts[0]), parseInt(dueParts[1]) - 1, parseInt(dueParts[2]));
    const todayParts = todayDate.split('-');
    const today = new Date(parseInt(todayParts[0]), parseInt(todayParts[1]) - 1, parseInt(todayParts[2]));
    const diff = Math.round((today.getTime() - due.getTime()) / (1000 * 3600 * 24));
    return Math.max(1, diff);
  }, [topOverdueTask, todayDate]);

  // Next Up item determination (highest priority pending task or active routine)
  const nextUpItem = useMemo(() => {
    const isTasksEnabled = isModuleOrToolEnabled('tasks', settings.enabledTools);
    const isRoutinesEnabled = isModuleOrToolEnabled('routines', settings.enabledTools);

    if (isTasksEnabled) {
      const priorityWeight: Record<string, number> = { urgent: 5, high: 4, medium: 3, low: 2, lowest: 1 };
      const candidates = tasks
        .filter(
          (t) =>
            !t.isArchived &&
            t.status !== 'completed' &&
            (t.dueDate === currentDate || (isViewingToday && t.dueDate && t.dueDate < todayDate))
        )
        .sort((a, b) => (priorityWeight[b.priority] || 3) - (priorityWeight[a.priority] || 3));

      if (candidates.length > 0) {
        const top = candidates[0];
        const member = settings.householdMembers?.find((m) => m.id === top.assignedMemberId);
        return {
          id: top.id,
          title: top.title,
          type: 'task' as const,
          priority: top.priority,
          category: top.category,
          description: top.description,
          isAllDay: top.isAllDay || (!top.scheduledStart && !top.dueTime),
          time: top.scheduledStart || top.dueTime,
          assignedMember: member,
          onComplete: () => toggleTaskCompletion(top.id),
          onRescheduleTomorrow: () => rescheduleTask(top.id, tomorrowDateStr),
        };
      }
    }

    if (isRoutinesEnabled) {
      const candidateRoutines = routines.filter(
        (r) =>
          isRoutineActiveOnDate(r, currentDate) &&
          !r.completedDates.includes(currentDate) &&
          !r.skippedDates.includes(currentDate) &&
          !(r.forgivenDates || []).includes(currentDate)
      );
      if (candidateRoutines.length > 0) {
        const r = candidateRoutines[0];
        const occ = getRoutineOccurrence(r, currentDate);
        const member = settings.householdMembers?.find((m) => m.id === r.assignedMemberId);
        return {
          id: r.id,
          title: occ.title,
          type: 'routine' as const,
          priority: 'medium' as const,
          category: r.category,
          isAllDay: false,
          time: occ.startTime || '07:30',
          assignedMember: member,
          onComplete: () => toggleRoutineCompletion(r.id, currentDate),
          onRescheduleTomorrow: undefined,
        };
      }
    }

    return null;
  }, [tasks, routines, currentDate, isViewingToday, todayDate, tomorrowDateStr, settings.householdMembers, settings.enabledTools]);

  // Daily activities for today (strictly guarded by enabled tools)
  const todayTasks = useMemo(
    () => (isModuleOrToolEnabled('tasks', settings.enabledTools) ? tasks.filter((t) => !t.isArchived && t.dueDate === currentDate) : []),
    [tasks, currentDate, settings.enabledTools]
  );

  const todayRoutines = useMemo(
    () => (isModuleOrToolEnabled('routines', settings.enabledTools) ? routines.filter((r) => isRoutineActiveOnDate(r, currentDate)) : []),
    [routines, currentDate, settings.enabledTools]
  );

  const todayBills = useMemo(
    () => (isModuleOrToolEnabled('money', settings.enabledTools) ? bills.filter((b) => b.dueDate === currentDate) : []),
    [bills, currentDate, settings.enabledTools]
  );

  const todayMeals = useMemo(
    () => (isModuleOrToolEnabled('food', settings.enabledTools) ? plannedMeals.filter((m) => m.date === currentDate) : []),
    [plannedMeals, currentDate, settings.enabledTools]
  );

  const todayWorkouts = useMemo(
    () => (isModuleOrToolEnabled('body', settings.enabledTools) ? workouts.filter((w) => w.date === currentDate && !w.isRestDay) : []),
    [workouts, currentDate, settings.enabledTools]
  );

  // Completion calculation (Denominator: tasks + active routine occurrences + bills + meals + workouts)
  const completableItems = useMemo(() => {
    const items: { id: string; isComplete: boolean }[] = [];

    todayTasks.forEach((t) =>
      items.push({ id: t.id, isComplete: t.status === 'completed' })
    );

    todayRoutines.forEach((r) => {
      const isSkipped = r.skippedDates.includes(currentDate);
      if (!isSkipped) {
        items.push({
          id: r.id,
          isComplete: r.completedDates.includes(currentDate),
        });
      }
    });

    todayBills.forEach((b) =>
      items.push({ id: b.id, isComplete: b.isPaid })
    );

    todayMeals.forEach((m) =>
      items.push({ id: m.id, isComplete: m.isConsumed })
    );

    todayWorkouts.forEach((w) =>
      items.push({ id: w.id, isComplete: w.isCompleted })
    );

    return items;
  }, [todayTasks, todayRoutines, todayBills, todayMeals, todayWorkouts, currentDate]);

  const totalCompletable = completableItems.length;
  const completedCount = completableItems.filter((i) => i.isComplete).length;
  const completionPercentage =
    totalCompletable > 0
      ? Math.round((completedCount / totalCompletable) * 100)
      : 0;

  // Week strip calculation (based on settings.weekStartsOn)
  const weekDays = useMemo(() => {
    const list = getWeekDaysForDate(currentDate, settings.weekStartsOn);
    return list.map((d) => ({
      name: d.dayName,
      dayNum: d.dayNum,
      dateStr: d.dateStr,
      isRealToday: d.dateStr === todayDate,
      isSelected: d.dateStr === currentDate,
    }));
  }, [currentDate, todayDate, settings.weekStartsOn]);

  // Weekly Consistency rate calculation (7 calendar days)
  const { weeklyConsistencyRate, weeklyCompletedCount, weeklyTotalCount } = useMemo(() => {
    const isHabitsEnabled = isModuleOrToolEnabled('habits', settings.enabledTools);
    const isTasksEnabled = isModuleOrToolEnabled('tasks', settings.enabledTools);
    const isRoutinesEnabled = isModuleOrToolEnabled('routines', settings.enabledTools);

    let totalDue = 0;
    let totalDone = 0;

    weekDays.forEach((day) => {
      const dStr = day.dateStr;

      if (isTasksEnabled) {
        const dayTasks = tasks.filter((t) => !t.isArchived && t.dueDate === dStr);
        totalDue += dayTasks.length;
        totalDone += dayTasks.filter((t) => t.status === 'completed').length;
      }

      if (isRoutinesEnabled) {
        const dayRoutines = routines.filter(
          (r) => isRoutineActiveOnDate(r, dStr) && !r.skippedDates.includes(dStr)
        );
        totalDue += dayRoutines.length;
        totalDone += dayRoutines.filter(
          (r) => r.completedDates.includes(dStr) || (r.forgivenDates || []).includes(dStr)
        ).length;
      }

      if (isHabitsEnabled && habits.length > 0) {
        totalDue += habits.length;
        totalDone += habits.filter((h) => h.checkedDates.includes(dStr)).length;
      }
    });

    const rate = totalDue > 0 ? Math.round((totalDone / totalDue) * 100) : 0;
    return {
      weeklyConsistencyRate: rate,
      weeklyCompletedCount: totalDone,
      weeklyTotalCount: totalDue,
    };
  }, [weekDays, tasks, routines, habits, settings.enabledTools]);

  const handleRescheduleAllToday = () => {
    overdueTasks.forEach((t) => rescheduleTask(t.id, todayDate));
  };

  // Helper to compile dynamic schedule items for any given date
  const getScheduleItemsForDate = (dateStr: string) => {
    interface ScheduleEntry {
      id: string;
      title: string;
      time: string;
      type: string;
      badgeBg: string;
      badgeText: string;
      isCompleted: boolean;
      onToggle?: () => void;
      subtext?: string;
      isAllDay?: boolean;
      routineId?: string;
      taskId?: string;
      isForgiven?: boolean;
      onForgive?: () => void;
      onUnforgive?: () => void;
      assignedMember?: { id: string; name: string; color: string };
    }

    const items: ScheduleEntry[] = [];

    // 1. Routines active on this date
    if (isModuleOrToolEnabled('routines', settings.enabledTools)) {
      routines
        .filter((r) => isRoutineActiveOnDate(r, dateStr))
        .forEach((r) => {
          const occ = getRoutineOccurrence(r, dateStr);
          const isCompleted = r.completedDates.includes(dateStr);
          const isForgiven = (r.forgivenDates || []).includes(dateStr);
          const assignedMember = settings.householdMembers?.find((m) => m.id === r.assignedMemberId);
          items.push({
            id: `routine-${r.id}`,
            title: occ.title,
            time: occ.startTime || '07:30',
            type: 'Routine',
            badgeBg: 'bg-[var(--accent-soft)]',
            badgeText: 'text-[var(--accent)]',
            isCompleted,
            onToggle: () => toggleRoutineCompletion(r.id, dateStr),
            subtext: formatRecurrenceRule(r),
            isAllDay: false,
            routineId: r.id,
            isForgiven,
            onForgive: () => forgiveRoutineOccurrence(r.id, dateStr),
            onUnforgive: () => unforgiveRoutineOccurrence(r.id, dateStr),
            assignedMember,
          });
        });
    }

    // 2. Tasks due on this date (not archived)
    if (isModuleOrToolEnabled('tasks', settings.enabledTools)) {
      tasks
        .filter((t) => !t.isArchived && t.dueDate === dateStr)
        .forEach((t) => {
          const isCompleted = t.status === 'completed';
          const assignedMember = settings.householdMembers?.find((m) => m.id === t.assignedMemberId);
          const isAllDay = t.isAllDay || (!t.scheduledStart && !t.dueTime);
          items.push({
            id: `task-${t.id}`,
            title: t.title,
            time: isAllDay ? 'All day' : (t.scheduledStart || t.dueTime || '09:00'),
            type: 'Task',
            badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
            badgeText: 'text-blue-600 dark:text-blue-400',
            isCompleted,
            onToggle: () => toggleTaskCompletion(t.id),
            subtext: t.category,
            isAllDay,
            taskId: t.id,
            assignedMember,
          });
        });
    }

    // 3. Calendar events on this date (including yearly birthdays — LP-10)
    if (isModuleOrToolEnabled('calendar', settings.enabledTools)) {
      calendarEvents
        .filter((e) => (e.type === 'birthday' ? isBirthdayEventOnDate(e.date, dateStr) : e.date === dateStr))
        .forEach((e) => {
          items.push({
            id: `event-${e.id}`,
            title: e.title,
            time: e.isAllDay ? 'All day' : `${e.startTime || '10:00'} – ${e.endTime || '11:00'}`,
            type: e.type === 'free_time' ? 'Focus time' : e.type === 'birthday' ? 'Birthday' : 'Event',
            badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
            badgeText: 'text-indigo-600 dark:text-indigo-400',
            isCompleted: false,
            subtext: e.notes,
            isAllDay: e.isAllDay,
          });
        });
    }

    // 4. Meals planned on this date
    if (isModuleOrToolEnabled('food', settings.enabledTools)) {
      plannedMeals.filter((m) => m.date === dateStr).forEach((m) => {
        const defaultTime = m.mealType === 'breakfast' ? '08:00' : m.mealType === 'lunch' ? '12:30' : '19:30';
        items.push({
          id: `meal-${m.id}`,
          title: m.recipeTitle,
          time: m.plannedTime || defaultTime,
          type: m.mealType.charAt(0).toUpperCase() + m.mealType.slice(1),
          badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
          badgeText: 'text-amber-700 dark:text-amber-400',
          isCompleted: m.isConsumed,
          onToggle: () => toggleMealConsumed(m.id),
          isAllDay: false,
        });
      });
    }

    // 5. Workouts on this date
    if (isModuleOrToolEnabled('body', settings.enabledTools)) {
      workouts.filter((w) => w.date === dateStr && !w.isRestDay).forEach((w) => {
        items.push({
          id: `workout-${w.id}`,
          title: w.title,
          time: w.startTime || '15:00',
          type: 'Workout',
          badgeBg: 'bg-[var(--accent-soft)]',
          badgeText: 'text-[var(--accent)]',
          isCompleted: w.isCompleted,
          onToggle: () => updateWorkoutSession(w.id, { isCompleted: !w.isCompleted }),
          subtext: `${w.durationMinutes} min`,
          isAllDay: false,
        });
      });
    }

    // 6. Bills due on this date
    if (isModuleOrToolEnabled('money', settings.enabledTools)) {
      bills.filter((b) => b.dueDate === dateStr).forEach((b) => {
        items.push({
          id: `bill-${b.id}`,
          title: b.title,
          time: '18:00',
          type: 'Bill',
          badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
          badgeText: 'text-rose-600 dark:text-rose-400',
          isCompleted: b.isPaid,
          onToggle: () => {
            if (b.isPaid) unpayBill(b.id);
            else markBillPaid(b.id, b.plannedAmount, dateStr);
          },
          subtext: `${currencySymbol}${b.plannedAmount} · ${b.isPaid ? 'Paid' : 'Due today'}`,
          isAllDay: false,
        });
      });
    }

    // Sort chronologically
    return items.sort((a, b) => a.time.localeCompare(b.time));
  };

  const todayScheduleItems = useMemo(
    () => getScheduleItemsForDate(currentDate),
    [currentDate, tasks, routines, calendarEvents, plannedMeals, workouts, bills, settings.householdMembers, settings.enabledTools]
  );

  const allDayScheduleItems = useMemo(
    () => todayScheduleItems.filter((item) => item.isAllDay),
    [todayScheduleItems]
  );

  const timedScheduleItems = useMemo(
    () => todayScheduleItems.filter((item) => !item.isAllDay),
    [todayScheduleItems]
  );

  const tomorrowScheduleItems = useMemo(
    () => getScheduleItemsForDate(tomorrowDateStr),
    [tomorrowDateStr, tasks, routines, calendarEvents, plannedMeals, workouts, bills, settings.householdMembers, settings.enabledTools]
  );

  // Water tracking for today
  const todayWaterEntries = useMemo(
    () => hydrationEntries.filter((e) => e.date === currentDate),
    [hydrationEntries, currentDate]
  );
  const totalWaterConsumed = todayWaterEntries.reduce((sum, e) => sum + e.amountMl, 0);
  const currentWaterTarget = useMemo(() => {
    const targetEntry = hydrationTargets.find((t) => t.date <= currentDate);
    return targetEntry ? targetEntry.targetMl : 2000;
  }, [hydrationTargets, currentDate]);

  const waterRemaining = Math.max(0, currentWaterTarget - totalWaterConsumed);
  const waterProgress = Math.min(100, Math.round((totalWaterConsumed / currentWaterTarget) * 100));
  const sortedWaterEntries = useMemo(
    () => [...todayWaterEntries].sort((a, b) => a.time.localeCompare(b.time)),
    [todayWaterEntries]
  );
  const latestWaterTime = sortedWaterEntries.length > 0
    ? sortedWaterEntries[sortedWaterEntries.length - 1].time
    : null;

  // Primary Goal
  const primaryGoal = goals.length > 0 ? goals[0] : null;
  const goalProgress = useMemo(() => {
    if (!primaryGoal) return 0;
    if (primaryGoal.steps.length === 0) return primaryGoal.status === 'completed' ? 100 : 0;
    const completed = primaryGoal.steps.filter((s) => s.isCompleted).length;
    return Math.round((completed / primaryGoal.steps.length) * 100);
  }, [primaryGoal]);

  const nextGoalStep = primaryGoal?.steps.find((s) => !s.isCompleted);

  // Dynamic Savings & Debt Summary (LP-05)
  const savingsAndDebtSummary = useMemo(
    () => calculateSavingsAndDebtSummary(savingsPots, debts),
    [savingsPots, debts]
  );

  // Selected weight profile & record without fabricated 72.0 / 72.4 kg fallbacks (LP-05)
  const selectedProfile =
    weightProfiles.find((p) => p.id === selectedProfileId) || weightProfiles[0];
  const profileRecords = useMemo(
    () =>
      selectedProfile
        ? weightRecords
            .filter((r) => r.profileId === selectedProfile.id)
            .sort((a, b) => b.date.localeCompare(a.date))
        : [],
    [weightRecords, selectedProfile]
  );
  const weightMetrics = useMemo(
    () => computeWeightMetrics(profileRecords, selectedProfile),
    [profileRecords, selectedProfile]
  );
  const currentWeightUnit = settings.weightUnit || 'kg';
  const displayedLatestWeight =
    weightMetrics.latestWeightKg !== null
      ? currentWeightUnit === 'lb'
        ? convertKgToLb(weightMetrics.latestWeightKg)
        : weightMetrics.latestWeightKg
      : null;
  const displayedPriorWeight =
    weightMetrics.priorWeightKg !== null
      ? currentWeightUnit === 'lb'
        ? convertKgToLb(weightMetrics.priorWeightKg)
        : weightMetrics.priorWeightKg
      : null;
  const weightDiff =
    displayedLatestWeight !== null && displayedPriorWeight !== null
      ? Math.round((displayedLatestWeight - displayedPriorWeight) * 10) / 10
      : null;

  const isHabitsVisible =
    isModuleOrToolEnabled('habits', settings.enabledTools) &&
    settings.todayVisibleSections?.habits !== false;
  const isWaterVisible = isModuleOrToolEnabled('water', settings.enabledTools);
  const isMoneyVisible =
    !isCalmMode &&
    isModuleOrToolEnabled('money', settings.enabledTools) &&
    settings.todayVisibleSections?.finance !== false;
  const isGoalsVisible =
    isModuleOrToolEnabled('goals', settings.enabledTools) && Boolean(primaryGoal);
  const isHealthVisible =
    !isCalmMode &&
    isModuleOrToolEnabled('body', settings.enabledTools) &&
    settings.todayVisibleSections?.health !== false;
  const isFocusVisible = isModuleOrToolEnabled('focus', settings.enabledTools) && !isCalmMode;
  const hasRightWidgets =
    isHabitsVisible || isWaterVisible || isMoneyVisible || isGoalsVisible || isHealthVisible || isFocusVisible;

  return (
    <div className="p-2 sm:p-4 md:p-8 max-w-7xl mx-auto space-y-2 sm:space-y-4 md:space-y-6">
      {/* Historical Date Notice Banner */}
      {!isViewingToday && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-2.5 sm:p-3.5 px-3 sm:px-4 flex items-center justify-between shadow-2xs animate-in fade-in text-xs">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 min-w-0">
            <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">
              Viewing schedule for <strong>{formattedCurrentDate}</strong> · Today is {formattedTodayDate}.
            </span>
          </div>
          <button
            type="button"
            onClick={goToToday}
            className="min-h-[44px] sm:min-h-9 px-3.5 py-2 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] font-semibold hover:bg-[var(--btn-primary-hover-bg)] transition-colors cursor-pointer shrink-0 text-xs"
          >
            Jump to Today
          </button>
        </div>
      )}

      {/* Desktop Page Header */}
      <div className="hidden sm:block">
        <PageHeader
          title="Today"
          subtitle={formattedCurrentDate}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveModal('quick_add')}
                className="btn-primary min-h-[40px] px-3.5 py-2 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Commitment</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('focus_mode')}
                className="btn-tonal min-h-[40px] px-3.5 py-2 text-xs font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Focus Mode</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('weekly_review')}
                className="btn-secondary min-h-[40px] px-3.5 py-2 text-xs font-semibold"
              >
                <Calendar className="w-3.5 h-3.5 text-[#526782] dark:text-[#A8B8CE]" />
                <span>Weekly Review</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCalmMode(!isCalmMode)}
                aria-pressed={isCalmMode}
                title="Calm View simplifies your dashboard by temporarily hiding financial balances and health metrics."
                aria-label={
                  isCalmMode
                    ? 'Disable Calm View (shows financial and health widgets)'
                    : 'Enable Calm View (hides financial and health widgets for a reduced-stimulation view)'
                }
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                  isCalmMode ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {isCalmMode ? <Sun className="w-3.5 h-3.5" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
                <span>{isCalmMode ? 'Calm Mode Active' : 'Calm View'}</span>
              </button>
            </div>
          }
        />
      </div>

      {/* Mobile-only compact action toolbar */}
      <div className="flex sm:hidden items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveModal('focus_mode')}
            className="btn-tonal min-h-[36px] px-2.5 py-1 text-xs font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Focus Mode</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('weekly_review')}
            className="btn-secondary min-h-[36px] px-2.5 py-1 text-xs font-semibold"
          >
            <Calendar className="w-3.5 h-3.5 text-[#526782] dark:text-[#A8B8CE]" />
            <span>Weekly Review</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsCalmMode(!isCalmMode)}
          aria-pressed={isCalmMode}
          title="Calm View simplifies your dashboard by temporarily hiding financial balances and health metrics."
          aria-label={
            isCalmMode
              ? 'Disable Calm View (shows financial and health widgets)'
              : 'Enable Calm View (hides financial and health widgets for a reduced-stimulation view)'
          }
          className={`min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
            isCalmMode ? 'btn-primary' : 'btn-secondary'
          }`}
        >
          {isCalmMode ? <Sun className="w-3.5 h-3.5" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
          <span>{isCalmMode ? 'Calm Mode Active' : 'Calm View'}</span>
        </button>
      </div>

      {/* 1. Overdue Action Center */}
      {overdueTasks.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-2.5 sm:p-3.5 shadow-2xs animate-in fade-in transition-all">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-xs text-[#071A3A] dark:text-[#EDF4FF]">
                {overdueTasks.length} Overdue Action{overdueTasks.length > 1 ? 's' : ''} Need Rescheduling
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRescheduleAllToday}
                className="min-h-[44px] sm:min-h-8 px-2.5 py-1 rounded-lg bg-rose-100/90 hover:bg-rose-200 dark:bg-rose-900/50 dark:hover:bg-rose-900/70 text-rose-800 dark:text-rose-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                Reschedule Today
              </button>
              <button
                type="button"
                onClick={() => setIsOverdueExpanded(!isOverdueExpanded)}
                aria-expanded={isOverdueExpanded}
                className="min-h-[44px] sm:min-h-8 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800 border border-rose-200/80 dark:border-rose-800/60 text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] hover:bg-white dark:hover:bg-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>{isOverdueExpanded ? 'Hide' : 'Show'} details</span>
                {isOverdueExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setActiveView('tasks')}
                className="min-h-[44px] sm:min-h-8 px-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>View all in tasks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isOverdueExpanded && (
            <div className="space-y-1.5 sm:space-y-2 pt-2.5 mt-2.5 border-t border-rose-200/60 dark:border-rose-900/40">
              {overdueTasks.slice(0, 5).map((t, idx) => {
                const dueParts = (t.dueDate || '').split('-');
                const due = new Date(parseInt(dueParts[0]), parseInt(dueParts[1]) - 1, parseInt(dueParts[2]));
                const todayParts = todayDate.split('-');
                const today = new Date(parseInt(todayParts[0]), parseInt(todayParts[1]) - 1, parseInt(todayParts[2]));
                const daysLate = Math.max(1, Math.round((today.getTime() - due.getTime()) / (1000 * 3600 * 24)));

                return (
                  <div
                    key={t.id}
                    className={`bg-white/80 dark:bg-[#152238]/80 p-2.5 sm:p-3 rounded-xl border border-rose-100 dark:border-rose-900/40 flex items-center justify-between gap-2.5 ${
                      idx > 1 ? 'hidden sm:flex' : 'flex'
                    }`}
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-semibold text-xs text-[#071A3A] dark:text-[#EDF4FF] mr-1.5 truncate">
                        {t.title}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-rose-600 dark:text-rose-400 font-medium whitespace-nowrap">
                        ({daysLate}d late{t.category ? ` · ${t.category}` : ''})
                      </span>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => rescheduleTask(t.id, todayDate)}
                        className="min-h-[44px] sm:min-h-8 px-3 py-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] text-[11px] font-semibold hover:opacity-90 cursor-pointer transition-colors"
                      >
                        Reschedule Today
                      </button>
                      <button
                        type="button"
                        onClick={() => rescheduleTask(t.id, tomorrowDateStr)}
                        className="hidden sm:inline-flex min-h-[44px] sm:min-h-8 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/70 cursor-pointer transition-colors"
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => archiveTask(t.id)}
                        aria-label={`Archive task ${t.title}`}
                        className="min-w-[44px] min-h-[44px] sm:min-w-8 sm:min-h-8 p-2 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        title="Archive task"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Screen reader live announcement */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`Viewing ${formattedCurrentDate}. ${completedCount} of ${totalCompletable} daily commitments completed.`}
      </div>

      {/* 2. Week Strip & Daily Progress Meter */}
      <div className="card-surface px-3 py-2 sm:p-4 md:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-4 md:gap-5">
        {/* Week navigation & days */}
        <div className="flex flex-col md:flex-row md:items-center gap-2.5 sm:gap-3 w-full md:w-auto min-w-0">
          <div className="flex items-center justify-between md:justify-start gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF] whitespace-nowrap">
                This week
              </span>
              {!isViewingToday && (
                <button
                  type="button"
                  onClick={goToToday}
                  aria-label="Jump to real today"
                  className="min-h-[44px] sm:min-h-7 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] hover:opacity-90 cursor-pointer flex items-center"
                >
                  Today
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Inlined progress on mobile */}
              <div className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[11px] font-semibold text-[var(--accent)]">
                <CheckCircle2 className="w-3 h-3" />
                <span>{completedCount}/{totalCompletable}</span>
                <span className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">({completionPercentage}%)</span>
              </div>

              <div className="flex items-center gap-1 text-[#526782] dark:text-[#A8B8CE]">
                <button
                  type="button"
                  onClick={() => {
                    const parts = currentDate.split('-');
                    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    d.setDate(d.getDate() - 7);
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const dateNum = String(d.getDate()).padStart(2, '0');
                    setCurrentDate(`${year}-${month}-${dateNum}`);
                  }}
                  className="min-w-[44px] min-h-[44px] sm:min-w-8 sm:min-h-8 p-2 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const parts = currentDate.split('-');
                    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    d.setDate(d.getDate() + 7);
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const dateNum = String(d.getDate()).padStart(2, '0');
                    setCurrentDate(`${year}-${month}-${dateNum}`);
                  }}
                  className="min-w-[44px] min-h-[44px] sm:min-w-8 sm:min-h-8 p-2 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Next week"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-0.5 sm:gap-1.5 overflow-x-auto no-scrollbar w-full md:w-auto py-0.5">
            {weekDays.map((w) => (
              <button
                key={w.dateStr}
                type="button"
                aria-pressed={w.isSelected}
                aria-current={w.isRealToday ? 'date' : undefined}
                aria-label={`${w.name} ${w.dayNum}${w.isRealToday ? ', Today' : ''}${w.isSelected ? ', Selected' : ''}`}
                onClick={() => setCurrentDate(w.dateStr)}
                className={`relative flex flex-col items-center justify-center flex-1 md:flex-none md:w-11 min-w-[44px] min-h-[44px] shrink-0 px-0.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                  w.isSelected
                    ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] font-bold shadow-xs'
                    : 'text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-[9px] uppercase tracking-tighter truncate w-full">{w.name}</span>
                <span className="text-xs sm:text-sm font-semibold">{w.dayNum}</span>
                {w.isRealToday && (
                  <span
                    className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                      w.isSelected ? 'bg-[var(--btn-primary-fg)]' : 'bg-[var(--accent)]'
                    }`}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Completion Ring on desktop */}
        <div className="hidden md:flex items-center gap-4 shrink-0 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
          <RingProgress
            progress={completionPercentage}
            size={56}
            strokeWidth={5}
            color="var(--accent)"
          >
            <span className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              {completionPercentage}%
            </span>
          </RingProgress>
          <div className="text-left">
            <div className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              {completedCount} of {totalCompletable} complete
            </div>
            <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              {totalCompletable === 0 ? 'Nothing scheduled today' : 'Daily commitments'}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Today Metrics */}
      <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 overflow-x-auto sm:overflow-visible no-scrollbar gap-2.5 sm:gap-4 pb-1 sm:pb-0">
        <MetricCard
          variant="featured"
          testId="today-metric-commitments"
          className="min-w-[140px] sm:min-w-0 shrink-0 sm:shrink flex-1 sm:flex-initial p-2.5 sm:p-5"
          title="Commitments Today"
          value={totalCompletable}
          subtitle={
            totalCompletable === 0
              ? 'No commitments scheduled'
              : completedCount === totalCompletable
              ? 'All finished today'
              : `${Math.max(0, totalCompletable - completedCount)} remaining today`
          }
          badge={{
            text: `${completedCount}/${totalCompletable} done`,
            positive: completedCount === totalCompletable && totalCompletable > 0,
          }}
          actionAriaLabel="View today's schedule"
          onAction={() => {
            document.getElementById('today-schedule-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        <MetricCard
          variant="standard"
          testId="today-metric-completed"
          className="min-w-[140px] sm:min-w-0 shrink-0 sm:shrink flex-1 sm:flex-initial p-2.5 sm:p-5"
          title="Completed Today"
          value={completedCount}
          subtitle={`${completionPercentage}% of daily commitments`}
          badge={{
            text: `${completionPercentage}%`,
            positive: completionPercentage >= 50,
          }}
          actionAriaLabel="View completed schedule items"
          onAction={() => {
            document.getElementById('today-schedule-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        <MetricCard
          variant="standard"
          testId="today-metric-overdue"
          className="min-w-[140px] sm:min-w-0 shrink-0 sm:shrink flex-1 sm:flex-initial p-2.5 sm:p-5"
          title="Needs Attention"
          value={overdueTasks.length}
          subtitle="overdue across all dates"
          badge={
            overdueTasks.length > 0
              ? { text: `${overdueTasks.length} action${overdueTasks.length > 1 ? 's' : ''}`, negative: true }
              : { text: 'All clear', positive: true }
          }
          actionAriaLabel="View overdue items"
          onAction={() => {
            if (overdueTasks.length > 0) {
              setIsOverdueExpanded(true);
            } else {
              setActiveView('tasks');
            }
          }}
        />

        <MetricCard
          variant="standard"
          testId="today-metric-consistency"
          className="min-w-[140px] sm:min-w-0 shrink-0 sm:shrink flex-1 sm:flex-initial p-2.5 sm:p-5"
          title="Weekly Consistency"
          value={`${weeklyConsistencyRate}%`}
          subtitle={`${weeklyCompletedCount} of ${weeklyTotalCount} this week`}
          badge={{
            text: weeklyConsistencyRate >= 70 ? 'On track' : weeklyConsistencyRate > 0 ? 'Building' : 'Start week',
            positive: weeklyConsistencyRate >= 70,
          }}
          actionAriaLabel="Open Weekly Review"
          onAction={() => setActiveModal('weekly_review')}
        />
      </div>

      {/* 3. Main Dashboard 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left Column: Your Day (Timeline) + Tomorrow Preview (7 cols or 12 cols) */}
        <div className={`${hasRightWidgets ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4 sm:space-y-6`}>
          {/* Hero Next Up Card */}
          {nextUpItem && (
            <div className="card-surface p-3 sm:p-5 border-l-4 border-l-[var(--accent)] animate-in fade-in">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Next Up</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {nextUpItem.category}
                  </span>
                  {nextUpItem.assignedMember && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md text-white flex items-center gap-1"
                      style={{ backgroundColor: nextUpItem.assignedMember.color }}
                    >
                      <User className="w-2.5 h-2.5" />
                      <span>{nextUpItem.assignedMember.name}</span>
                    </span>
                  )}
                </div>
              </div>

              <div data-testid="today-next-up-title" className="text-base md:text-lg font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-1.5 sm:mb-3">
                {nextUpItem.title}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1.5 sm:pt-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={nextUpItem.onComplete}
                  className="btn-primary min-h-[44px] sm:min-h-9 px-3.5 py-2 text-xs font-semibold micro-tap"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3] motion-check-pop" />
                  <span>Mark Complete</span>
                </button>
                {nextUpItem.onRescheduleTomorrow && (
                  <button
                    type="button"
                    onClick={nextUpItem.onRescheduleTomorrow}
                    className="btn-secondary min-h-[44px] sm:min-h-9 px-3.5 py-2 text-xs font-semibold"
                  >
                    <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Tomorrow</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveModal('focus_mode')}
                  className="btn-tonal min-h-[44px] sm:min-h-9 px-3.5 py-2 text-xs font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Focus Mode</span>
                </button>
              </div>
            </div>
          )}

          {/* Your Day Card */}
          <div id="today-schedule-section" className="card-surface p-5 md:p-6 scroll-mt-20">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
              <div className="flex items-center gap-2">
                <h2 data-testid="today-heading" className="text-lg font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Your day
                </h2>
                <span className="text-xs text-[#526782] dark:text-[#A8B8CE]">
                  ({todayScheduleItems.length} commitment{todayScheduleItems.length === 1 ? '' : 's'})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('calendar')}
                className="min-h-[44px] sm:min-h-8 px-2 text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View calendar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {todayScheduleItems.length === 0 ? (
              <div data-testid="today-empty-state" className="py-10 px-4 text-center space-y-3">
                <div className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Nothing scheduled for {formattedCurrentDate} yet
                </div>
                <p className="text-xs sm:text-sm text-[#526782] dark:text-[#A8B8CE] max-w-md mx-auto">
                  Start with one clear priority for today—add a task, schedule an event, or capture a quick note.
                </p>
                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    data-testid="today-empty-cta"
                    onClick={() => setActiveModal('quick_add')}
                    className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover-bg)] text-[var(--btn-primary-fg)] text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add your first item for today</span>
                  </button>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Private &amp; saved locally on this device</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-3">
                {/* All-Day Commitments Subsection */}
                {allDayScheduleItems.length > 0 && (
                  <div className="space-y-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#526782] dark:text-[#A8B8CE] block">
                      All-Day Commitments
                    </span>
                    <div className="space-y-2">
                      {allDayScheduleItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {item.onToggle ? (
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={item.isCompleted}
                                onClick={item.onToggle}
                                className="min-w-[44px] min-h-[44px] sm:min-w-8 sm:min-h-8 -my-1.5 -ml-1.5 p-2 rounded-lg flex items-center justify-center cursor-pointer micro-checkbox"
                                aria-label={`Mark ${item.title} as ${item.isCompleted ? 'incomplete' : 'complete'}`}
                              >
                                <span
                                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                                    item.isCompleted
                                      ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]'
                                      : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#152238] hover:border-[var(--accent)]'
                                  }`}
                                >
                                  {item.isCompleted && <Check className="w-3.5 h-3.5 stroke-[3] motion-check-pop" />}
                                </span>
                              </button>
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0 ml-1.5 mr-1.5" />
                            )}
                            <div>
                              <span
                                className={`text-xs font-semibold transition-all duration-150 ${
                                  item.isCompleted
                                    ? 'line-through text-[#526782] dark:text-[#A8B8CE]'
                                    : 'text-[#071A3A] dark:text-[#EDF4FF]'
                                }`}
                              >
                                {item.title}
                              </span>
                              {item.subtext && (
                                <span className="text-[11px] text-[#526782] dark:text-[#A8B8CE] ml-2">
                                  {item.subtext}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {item.assignedMember && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white flex items-center gap-1"
                                style={{ backgroundColor: item.assignedMember.color }}
                              >
                                {item.assignedMember.name}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${item.badgeBg} ${item.badgeText}`}>
                              {item.type}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scheduled Timeline Subsection */}
                {timedScheduleItems.length > 0 && (
                  <div className="space-y-1 divide-y divide-slate-100 dark:divide-slate-800/80">
                    {allDayScheduleItems.length > 0 && (
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#526782] dark:text-[#A8B8CE] block pt-1 pb-1">
                        Schedule
                      </span>
                    )}
                    {timedScheduleItems.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[#526782] dark:text-[#A8B8CE] w-14 shrink-0">
                            {item.time}
                          </span>
                          {item.onToggle ? (
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={item.isCompleted}
                              onClick={item.onToggle}
                              className="min-w-[44px] min-h-[44px] sm:min-w-8 sm:min-h-8 -my-1.5 p-2 rounded-lg flex items-center justify-center cursor-pointer micro-checkbox"
                              aria-label={`Mark ${item.title} as ${item.isCompleted ? 'incomplete' : 'complete'}`}
                            >
                              <span
                                className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                                  item.isCompleted
                                    ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]'
                                    : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#152238] hover:border-[var(--accent)]'
                                }`}
                              >
                                {item.isCompleted && <Check className="w-3.5 h-3.5 stroke-[3] motion-check-pop" />}
                              </span>
                            </button>
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] shrink-0 ml-1 mr-1" />
                          )}
                          <div>
                            <span
                              className={`text-sm font-semibold transition-all duration-150 ${
                                item.isCompleted
                                  ? 'line-through text-[#526782] dark:text-[#A8B8CE]'
                                  : 'text-[#071A3A] dark:text-[#EDF4FF]'
                              }`}
                            >
                              {item.title}
                            </span>
                            {item.subtext && (
                              <span className="text-xs text-[#526782] dark:text-[#A8B8CE] ml-2">
                                {item.subtext}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.assignedMember && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white flex items-center gap-1"
                              style={{ backgroundColor: item.assignedMember.color }}
                            >
                              {item.assignedMember.name}
                            </span>
                          )}

                          {item.isForgiven ? (
                            <div className="flex items-center gap-1">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                Rest day
                              </span>
                              <button
                                type="button"
                                onClick={item.onUnforgive}
                                className="min-h-[44px] sm:min-h-7 px-2 text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                                title="Undo rest day"
                              >
                                Undo
                              </button>
                            </div>
                          ) : item.type === 'Routine' && !item.isCompleted ? (
                            <button
                              type="button"
                              onClick={item.onForgive}
                              aria-label={`Mark ${item.title} as rest day`}
                              className="min-h-[44px] sm:min-h-7 px-2.5 py-1 rounded-md text-[10px] font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center"
                              title="Mark as rest day without breaking routine streak"
                            >
                              Rest day
                            </button>
                          ) : null}

                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${item.badgeBg} ${item.badgeText}`}>
                            {item.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tomorrow Preview Strip */}
          <div className="card-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Tomorrow
                </span>
                <span className="text-xs text-[#526782] dark:text-[#A8B8CE]">
                  {formattedTomorrow}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentDate(tomorrowDateStr)}
                className="min-h-[44px] sm:min-h-8 px-2 flex items-center text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
              >
                Open tomorrow
              </button>
            </div>

            {tomorrowScheduleItems.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-[#526782] dark:text-[#A8B8CE] flex items-center justify-between">
                <span>Nothing scheduled yet for tomorrow.</span>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentDate(tomorrowDateStr);
                    setActiveModal('quick_add');
                  }}
                  className="min-h-[44px] sm:min-h-8 px-2 font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                >
                  + Add task
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tomorrowScheduleItems.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center text-[11px] font-mono font-bold shrink-0">
                      {item.time.length > 5 ? item.time.split('–')[0].trim() : item.time}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] truncate">
                        {item.title}
                      </div>
                      <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] truncate">
                        {item.type} {item.subtext ? `· ${item.subtext}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Daily Rhythm, Water, Money, Goals, Health */}
        {hasRightWidgets && (
          <div className="lg:col-span-5 space-y-4 sm:space-y-6">
            {/* Daily Rhythm (Habits) */}
            {isHabitsVisible && (
              <div className="card-surface p-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A] mb-3">
                  <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF] flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[var(--accent)]" />
                    <span>Daily rhythm</span>
                  </h3>
                  <span className="text-xs text-[#526782] dark:text-[#A8B8CE] font-mono">
                    {habits.filter((h) => h.checkedDates.includes(currentDate)).length} of {habits.length}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {habits.map((habit) => {
                    const isChecked = habit.checkedDates.includes(currentDate);
                    const streakData = calculateHabitStreak(habit, currentDate);
                    return (
                      <div
                        key={habit.id}
                        className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isChecked}
                            aria-label={`Mark habit "${habit.title}" as ${isChecked ? 'incomplete' : 'complete'}`}
                            onClick={() => toggleHabitCheck(habit.id, currentDate)}
                            className="min-w-[44px] min-h-[44px] sm:min-w-8 sm:min-h-8 -my-1 -ml-1 p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                                isChecked
                                  ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]'
                                  : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#152238] hover:border-[var(--accent)]'
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </span>
                          </button>
                          <span className={`text-xs font-semibold ${
                            isChecked
                              ? 'line-through text-[#526782] dark:text-[#A8B8CE]'
                              : 'text-[#071A3A] dark:text-[#EDF4FF]'
                          }`}>
                            {habit.title}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-[#526782] dark:text-[#A8B8CE]">
                          {streakData.currentStreak}-day streak
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Compact Focus Session Card (Phase 07 shared controller & reference frame-012.png) */}
            {isFocusVisible && (
              <div
                data-testid="today-compact-focus-card"
                className="bg-[var(--accent-deep)] text-white p-5 rounded-2xl relative overflow-hidden border border-[var(--border-strong)] shadow-md space-y-3"
              >
                {/* Faint line / contour texture background (Reference frame-012.png) */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{
                    backgroundImage: `radial-gradient(circle at 80% 20%, var(--accent-soft) 0%, transparent 50%), radial-gradient(circle at 20% 80%, var(--accent-soft) 0%, transparent 60%)`,
                  }}
                >
                  <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="focus-lines" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 0 20 Q 20 5, 40 20 T 80 20" fill="none" stroke="currentColor" strokeWidth="0.75" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#focus-lines)" />
                  </svg>
                </div>

                {/* Header row */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {focusSession.isBreak ? (
                      <Coffee className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-[var(--accent)]" />
                    )}
                    <span className="text-xs font-bold uppercase tracking-wider text-white/90">
                      {focusSession.isBreak ? 'Rest & Recharge' : 'Focus Session'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      data-testid="today-focus-status-badge"
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                        focusSession.isRunning
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : focusSession.isPaused
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-white/10 text-white/80'
                      }`}
                    >
                      {focusSession.isRunning ? 'Running' : focusSession.isPaused ? 'Paused' : focusSession.isBreak ? 'Break' : '25 min'}
                    </span>
                    <button
                      type="button"
                      data-testid="today-focus-expand-btn"
                      onClick={() => setActiveModal('focus_mode')}
                      title="Open full focus mode"
                      aria-label="Open full focus mode modal"
                      className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Digits & Timer Row */}
                <div className="relative z-10 flex items-baseline justify-between pt-1">
                  <div
                    data-testid="today-focus-timer-display"
                    aria-label={`Focus timer: ${focusSession.formattedTimer}`}
                    className="text-4xl sm:text-5xl font-mono font-bold tracking-wider tabular-nums text-white"
                  >
                    {focusSession.formattedTimer}
                  </div>
                  <span className="text-xs text-white/60 font-medium">
                    {focusSession.isBreak ? '5 min break' : 'Pomodoro'}
                  </span>
                </div>

                {/* Active task preview if available */}
                {focusSession.currentTask && (
                  <div
                    data-testid="today-focus-task-preview"
                    className="relative z-10 p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase font-semibold text-[var(--accent)] tracking-wider truncate">
                        {focusSession.currentTask.category}
                      </div>
                      <div className="text-xs font-semibold text-white truncate">
                        {focusSession.currentTask.title}
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid="today-focus-task-done-btn"
                      onClick={focusSession.completeTask}
                      title="Mark task done and advance"
                      aria-label={`Complete focus task "${focusSession.currentTask.title}"`}
                      className="shrink-0 min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Check className="w-3 h-3 text-[var(--accent)]" />
                      <span>Done</span>
                    </button>
                  </div>
                )}

                {/* Controls toolbar */}
                <div className="relative z-10 flex items-center gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    data-testid="today-focus-toggle-btn"
                    onClick={focusSession.toggleTimer}
                    aria-pressed={focusSession.isRunning}
                    aria-label={focusSession.isRunning ? 'Pause focus timer' : 'Start focus timer'}
                    className={`flex-1 min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs ${
                      focusSession.isRunning
                        ? 'bg-amber-100 text-amber-950 hover:bg-amber-200'
                        : 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] hover:bg-[var(--btn-primary-hover-bg)]'
                    }`}
                  >
                    {focusSession.isRunning ? (
                      <>
                        <Pause className="w-3.5 h-3.5 text-amber-900" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-[var(--btn-primary-fg)] fill-current" />
                        <span>{focusSession.isPaused ? 'Resume' : 'Start Focus'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    data-testid="today-focus-reset-btn"
                    onClick={focusSession.resetTimer}
                    title="Reset timer to 25 minutes"
                    aria-label="Reset timer to 25 minutes"
                    className="min-w-[40px] min-h-[40px] p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    data-testid="today-focus-break-btn"
                    onClick={focusSession.startBreak}
                    title="Start 5m break"
                    aria-label="Start 5m break"
                    className="min-w-[40px] min-h-[40px] px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Coffee className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Break</span>
                  </button>
                </div>
              </div>
            )}

            {/* Water Tracker Card */}
            {isWaterVisible && (
              <div className="card-surface p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF] flex items-center gap-2">
                    <Droplet className="w-4 h-4 text-[var(--accent)]" />
                    <span>Water</span>
                  </h3>
                  <span className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                    {latestWaterTime ? `Last drink ${latestWaterTime}` : 'No drinks logged yet'}
                  </span>
                </div>

                <div className="flex items-center gap-5 my-2">
                  <RingProgress
                    progress={waterProgress}
                    size={74}
                    strokeWidth={7}
                    color="var(--accent)"
                  >
                    <div className="text-center">
                      <span className="text-[11px] font-bold text-[#071A3A] dark:text-[#EDF4FF] leading-none block">
                        {(totalWaterConsumed / 1000).toFixed(2)} L
                      </span>
                      <span className="text-[9px] text-[#526782] dark:text-[#A8B8CE] leading-none">
                        of {(currentWaterTarget / 1000).toFixed(0)} L
                      </span>
                    </div>
                  </RingProgress>

                  <div>
                    <div className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                      {waterRemaining} ml
                    </div>
                    <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">
                      to reach daily target
                    </div>
                  </div>
                </div>

                {/* Quick buttons */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    aria-label="Log 250 ml of water"
                    onClick={() => addWaterLog(250)}
                    className="flex-1 min-h-[44px] py-2 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-semibold hover:opacity-90 cursor-pointer transition-colors"
                  >
                    +250 ml
                  </button>
                  <button
                    type="button"
                    aria-label="Log 500 ml of water"
                    onClick={() => addWaterLog(500)}
                    className="flex-1 min-h-[44px] py-2 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-semibold hover:opacity-90 cursor-pointer transition-colors"
                  >
                    +500 ml
                  </button>
                  <button
                    type="button"
                    aria-label="Log 750 ml of water"
                    onClick={() => addWaterLog(750)}
                    className="flex-1 min-h-[44px] py-2 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-semibold hover:opacity-90 cursor-pointer transition-colors"
                  >
                    +750 ml
                  </button>
                  <button
                    type="button"
                    onClick={undoLastWaterLog}
                    aria-label="Undo last water log"
                    className="min-w-[44px] min-h-[44px] py-2 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-[#526782] dark:text-[#A8B8CE] text-xs font-medium cursor-pointer"
                    title="Undo last log"
                  >
                    Undo
                  </button>
                </div>
              </div>
            )}

            {/* Money Summary Card */}
            {isMoneyVisible && (
              <div className="card-surface p-5">
                <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0] dark:border-[#1E2D4A] mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                      Money
                    </h3>
                    <span className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                      Left to spend
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveView('budget')}
                    className="min-h-[44px] sm:min-h-8 px-2 text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View budget</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-baseline justify-between mb-4">
                  <span className="text-2xl font-bold tabular-nums text-[#071A3A] dark:text-[#EDF4FF]">
                    {currencySymbol}{cashFlow.leftToSpend.toFixed(0)}
                  </span>
                  <span className="text-xs tabular-nums text-[#526782] dark:text-[#A8B8CE]">
                    of {currencySymbol}{cashFlow.actualBalance.toFixed(0)} balance
                  </span>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <div className="flex justify-between tabular-nums mb-1">
                      <span className="text-[#526782] dark:text-[#A8B8CE]">Savings</span>
                      <span className="font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                        {savingsAndDebtSummary.hasSavingsPots
                          ? `${currencySymbol}${savingsAndDebtSummary.totalSaved.toLocaleString()} / ${currencySymbol}${savingsAndDebtSummary.totalSavingsTarget.toLocaleString()} (${savingsAndDebtSummary.savingsProgressPercent}%)`
                          : 'No savings pots yet'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[var(--accent)] h-full rounded-full transition-all"
                        style={{ width: `${savingsAndDebtSummary.savingsProgressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between tabular-nums mb-1">
                      <span className="text-[#526782] dark:text-[#A8B8CE]">Debt remaining</span>
                      <span className="font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                        {savingsAndDebtSummary.hasDebts
                          ? `${currencySymbol}${savingsAndDebtSummary.totalDebtRemaining.toLocaleString()} (${savingsAndDebtSummary.debtRepaidPercent}% repaid)`
                          : 'No debts tracked'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[var(--accent)] h-full rounded-full transition-all"
                        style={{ width: `${savingsAndDebtSummary.debtRepaidPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Goal Progress Card */}
            {isGoalsVisible && primaryGoal && (
              <div className="card-surface p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                    Goal progress
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveView('goals')}
                    aria-label="View goals"
                    className="min-w-[44px] min-h-[44px] sm:min-w-8 sm:min-h-8 p-2 rounded-lg flex items-center justify-center text-xs font-semibold text-[var(--accent)] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <RingProgress
                    progress={goalProgress}
                    size={56}
                    strokeWidth={5}
                    color="#8B7CF6"
                  >
                    <span className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                      {goalProgress}%
                    </span>
                  </RingProgress>

                  <div className="flex-1 truncate">
                    <div className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF] truncate">
                      {primaryGoal.title}
                    </div>
                    <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">
                      {primaryGoal.steps.filter((s) => s.isCompleted).length} of{' '}
                      {primaryGoal.steps.length} steps complete
                    </div>
                    {nextGoalStep && (
                      <div className="text-[11px] text-[#8B7CF6] font-medium truncate mt-0.5">
                        Next: {nextGoalStep.title}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Health Summary (Workout & Weight) */}
            {isHealthVisible && (
              <div className="card-surface p-5 space-y-4">
                <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Your health
                </h3>

                {/* Workout scheduled */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="View workouts"
                  onClick={() => setActiveView('workouts')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveView('workouts');
                    }
                  }}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-[var(--accent)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                      <Dumbbell className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                        {todayWorkouts.length > 0 ? todayWorkouts[0].title : 'Rest day'}
                      </div>
                      <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">
                        {todayWorkouts.length > 0
                          ? `at ${todayWorkouts[0].startTime || '15:00'} · ${todayWorkouts[0].durationMinutes} min`
                          : 'Recovery & rest'}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#526782] dark:text-[#A8B8CE]" />
                </div>

                {/* Weight card */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="View weight history"
                  onClick={() => setActiveView('weight')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveView('weight');
                    }
                  }}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-[var(--accent)] transition-colors"
                >
                  <div>
                    {displayedLatestWeight === null ? (
                      <>
                        <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                          No weight logged yet
                        </div>
                        <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">
                          Tap to add a profile and log your first reading
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-base font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF]">
                          {displayedLatestWeight} {currentWeightUnit}
                        </div>
                        {weightDiff !== null ? (
                          <div
                            className={`text-[10px] font-medium flex items-center gap-0.5 ${
                              weightDiff < 0
                                ? 'text-[#10B981]'
                                : weightDiff > 0
                                ? 'text-amber-600'
                                : 'text-[#526782] dark:text-[#A8B8CE]'
                            }`}
                          >
                            {weightDiff < 0 ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : (
                              <TrendingUp className="w-3 h-3" />
                            )}
                            <span>
                              {weightDiff > 0 ? `+${weightDiff}` : weightDiff} {currentWeightUnit} since last reading
                            </span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE]">
                            First reading logged ({weightMetrics.latestDateStr})
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#526782] dark:text-[#A8B8CE]" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
