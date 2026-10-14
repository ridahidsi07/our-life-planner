import React, { useState, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  AlertTriangle,
  Download,
  Eye,
  Repeat,
  X,
  Edit2,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { RingProgress } from '../ui/RingProgress';
import { Modal } from '../ui/Modal';
import { ContextualDetailPanel } from '../ui/ContextualDetailPanel';
import { FilterEmptyState } from '../ui/FilterEmptyState';
import {
  isRoutineActiveOnDate,
  getRoutineOccurrence,
  formatRecurrenceRule,
  getUpcomingRoutineOccurrences,
} from '../../utils/routineRecurrence';
import { getWeekDaysForDate } from '../../utils/formatters';
import { isCompletableScheduleItem } from '../../utils/calculations';
import { isBirthdayEventOnDate, shiftCalendarDate } from '../../utils/recurrence';
import { CalendarEvent, RepeatInterval } from '../../types/planner';

export const CalendarView: React.FC = () => {
  const {
    settings,
    currentDate,
    setCurrentDate,
    todayDate,
    tasks,
    toggleTaskCompletion,
    routines,
    toggleRoutineCompletion,
    bills,
    markBillPaid,
    unpayBill,
    goals,
    plannedMeals,
    toggleMealConsumed,
    workouts,
    updateWorkoutSession,
    calendarEvents,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    restoreCalendarEvent,
    addTask,
    addBill,
    exportCalendarIcs,
  } = usePlanner();

  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDate, setSelectedDate] = useState<string>(currentDate);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCalendarEvent, setEditingCalendarEvent] = useState<CalendarEvent | null>(null);
  const [lastDeletedEvent, setLastDeletedEvent] = useState<CalendarEvent | null>(null);
  const [previewRoutineId, setPreviewRoutineId] = useState<string | null>(null);

  // Keep selectedDate synchronized when currentDate changes from outside
  React.useEffect(() => {
    setSelectedDate(currentDate);
  }, [currentDate]);

  // Filter toggles
  const [filters, setFilters] = useState({
    tasks: true,
    routines: true,
    bills: true,
    goals: true,
    meals: true,
    workouts: true,
    events: true,
  });

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Add / Edit entry modal form state
  const [entryType, setEntryType] = useState<
    'free_time' | 'task' | 'bill' | 'birthday' | 'event'
  >('free_time');
  const [entryTitle, setEntryTitle] = useState('');
  const [entryDate, setEntryDate] = useState(selectedDate);
  const [isAllDay, setIsAllDay] = useState(false);
  const [entryStartTime, setEntryStartTime] = useState('10:00');
  const [entryEndTime, setEntryEndTime] = useState('11:00');
  const [entryNotes, setEntryNotes] = useState('');
  const [billPlannedAmount, setBillPlannedAmount] = useState('');
  const [billCategory, setBillCategory] = useState('Utilities');
  const [billRepeatInterval, setBillRepeatInterval] = useState<RepeatInterval>('none');
  const [timeError, setTimeError] = useState('');

  const openAddEntryModal = (dateForEntry: string) => {
    setEditingCalendarEvent(null);
    setEntryType('free_time');
    setEntryTitle('');
    setEntryDate(dateForEntry);
    setIsAllDay(false);
    setEntryStartTime('10:00');
    setEntryEndTime('11:00');
    setEntryNotes('');
    setBillPlannedAmount('');
    setBillCategory('Utilities');
    setBillRepeatInterval('none');
    setTimeError('');
    setIsAddModalOpen(true);
  };

  const openEditEventModal = (ev: CalendarEvent) => {
    setEditingCalendarEvent(ev);
    setEntryType(ev.type);
    setEntryTitle(ev.title);
    setEntryDate(ev.date);
    setIsAllDay(Boolean(ev.isAllDay));
    setEntryStartTime(ev.startTime || '10:00');
    setEntryEndTime(ev.endTime || '11:00');
    setEntryNotes(ev.notes || '');
    setTimeError('');
    setIsAddModalOpen(true);
  };

  const handleDeleteCalendarEvent = (ev: CalendarEvent) => {
    setLastDeletedEvent(ev);
    deleteCalendarEvent(ev.id);
  };

  const handleUndoDeleteCalendarEvent = () => {
    if (!lastDeletedEvent) return;
    restoreCalendarEvent(lastDeletedEvent);
    setLastDeletedEvent(null);
  };

  // Validate end time after start time and explicit bill amount
  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryTitle.trim()) return;

    if (entryType !== 'bill' && !isAllDay && entryStartTime && entryEndTime) {
      if (entryEndTime <= entryStartTime) {
        setTimeError('End time must be after start time.');
        return;
      }
    }

    if (!editingCalendarEvent && entryType === 'bill') {
      const parsedAmount = parseFloat(billPlannedAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setTimeError('Please enter a valid bill amount greater than 0.');
        return;
      }
      setTimeError('');
      addBill({
        title: entryTitle.trim(),
        category: billCategory || 'Personal',
        plannedAmount: Math.round(parsedAmount * 100) / 100,
        dueDate: entryDate,
        repeatInterval: billRepeatInterval !== 'none' ? billRepeatInterval : undefined,
      });
      setIsAddModalOpen(false);
      setEntryTitle('');
      setEntryNotes('');
      setBillPlannedAmount('');
      return;
    }

    setTimeError('');

    if (editingCalendarEvent) {
      updateCalendarEvent(editingCalendarEvent.id, {
        title: entryTitle.trim(),
        date: entryDate,
        startTime: isAllDay ? undefined : entryStartTime,
        endTime: isAllDay ? undefined : entryEndTime,
        isAllDay,
        type:
          entryType === 'birthday'
            ? 'birthday'
            : entryType === 'free_time'
            ? 'free_time'
            : 'event',
        notes: entryNotes || undefined,
      });
    } else if (entryType === 'task') {
      addTask({
        title: entryTitle.trim(),
        description: entryNotes || undefined,
        category: 'Personal',
        assignedTo: settings.ownerName || 'Me',
        dueDate: entryDate,
        dueTime: isAllDay ? undefined : entryStartTime,
        scheduledStart: isAllDay ? undefined : entryStartTime,
        scheduledEnd: isAllDay ? undefined : entryEndTime,
        isAllDay,
        priority: 'medium',
        status: 'not_started',
      });
    } else {
      addCalendarEvent({
        title: entryTitle.trim(),
        date: entryDate,
        startTime: isAllDay ? undefined : entryStartTime,
        endTime: isAllDay ? undefined : entryEndTime,
        isAllDay,
        type:
          entryType === 'birthday'
            ? 'birthday'
            : entryType === 'free_time'
            ? 'free_time'
            : 'event',
        notes: entryNotes || undefined,
      });
    }

    setIsAddModalOpen(false);
    setEditingCalendarEvent(null);
    setEntryTitle('');
    setEntryNotes('');
  };

  // Week days based on settings.weekStartsOn
  const weekDays = useMemo(() => {
    const list = getWeekDaysForDate(selectedDate, settings.weekStartsOn);
    return list.map((d) => {
      let fullDate = d.dateStr;
      try {
        const [y, m, day] = d.dateStr.split('-');
        const dt = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(day, 10));
        fullDate = dt.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      } catch {
        fullDate = d.dateStr;
      }
      return {
        dateStr: d.dateStr,
        dayNum: d.dayNum,
        dayName: d.dayName,
        fullDate,
        isToday: d.dateStr === todayDate,
        isSelected: d.dateStr === selectedDate,
      };
    });
  }, [selectedDate, todayDate, settings.weekStartsOn]);

  const visibleMonthYearLabel = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      if (viewMode === 'month') {
        return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } else if (viewMode === 'week') {
        const first = weekDays[0];
        const last = weekDays[weekDays.length - 1];
        return `${first.dayName.slice(0, 3)} ${first.dayNum} – ${last.dayName.slice(0, 3)} ${last.dayNum}, ${dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
      } else {
        return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch {
      return selectedDate;
    }
  }, [selectedDate, viewMode, weekDays]);

  const conflictsSet = useMemo(() => {
    const conflictMap = new Set<string>();

    weekDays.forEach((w) => {
      const timedList: Array<{ id: string; start: number; end: number }> = [];

      calendarEvents
        .filter(
          (e) =>
            (e.type === 'birthday'
              ? isBirthdayEventOnDate(e.date, w.dateStr)
              : e.date === w.dateStr) &&
            !e.isAllDay &&
            e.startTime
        )
        .forEach((e) => {
          const [sh, sm] = (e.startTime || '00:00').split(':').map(Number);
          const [eh, em] = (e.endTime || '00:00').split(':').map(Number);
          timedList.push({
            id: e.id,
            start: sh * 60 + sm,
            end: eh ? eh * 60 + em : sh * 60 + sm + 60,
          });
        });

      tasks
        .filter((t) => t.dueDate === w.dateStr && !t.isArchived && t.scheduledStart)
        .forEach((t) => {
          const [sh, sm] = t.scheduledStart!.split(':').map(Number);
          const [eh, em] = (t.scheduledEnd || '').split(':').map(Number);
          timedList.push({
            id: t.id,
            start: sh * 60 + sm,
            end: eh ? eh * 60 + em : sh * 60 + sm + 30,
          });
        });

      for (let i = 0; i < timedList.length; i++) {
        for (let j = i + 1; j < timedList.length; j++) {
          const a = timedList[i];
          const b = timedList[j];
          if (a.start < b.end && b.start < a.end) {
            conflictMap.add(a.id);
            conflictMap.add(b.id);
          }
        }
      }
    });

    return conflictMap;
  }, [weekDays, calendarEvents, tasks]);

  // Items for selected day
  const selectedDayItems = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      type: string;
      time?: string;
      isCompleted?: boolean;
      badgeColor: string;
      onToggle?: () => void;
      subtitle?: string;
      routineId?: string;
      calendarEvent?: CalendarEvent;
    }> = [];

    // Tasks (exclude archived tasks - LP-08)
    if (filters.tasks) {
      tasks
        .filter((t) => !t.isArchived && t.dueDate === selectedDate)
        .forEach((t) => {
          list.push({
            id: t.id,
            title: t.title,
            type: 'Task',
            time: t.isAllDay
              ? 'All day'
              : t.scheduledStart && t.scheduledEnd
              ? `${t.scheduledStart} - ${t.scheduledEnd}`
              : t.dueTime || t.scheduledStart || 'All day',
            isCompleted: t.status === 'completed',
            badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
            onToggle: () => toggleTaskCompletion(t.id),
          });
        });
    }

    // Routines (scheduled on selected date)
    if (filters.routines) {
      routines
        .filter((r) => isRoutineActiveOnDate(r, selectedDate))
        .forEach((r) => {
          const occ = getRoutineOccurrence(r, selectedDate);
          const isDone = r.completedDates.includes(selectedDate);
          list.push({
            id: r.id,
            title: occ.title,
            type: 'Routine',
            time: occ.startTime || '07:30',
            isCompleted: isDone,
            badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300',
            onToggle: () => toggleRoutineCompletion(r.id, selectedDate),
            subtitle: formatRecurrenceRule(r),
            routineId: r.id,
          });
        });
    }

    // Bills
    if (filters.bills) {
      bills
        .filter((b) => b.dueDate === selectedDate)
        .forEach((b) => {
          list.push({
            id: b.id,
            title: b.title,
            type: 'Bill',
            time: '18:00',
            isCompleted: b.isPaid,
            badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
            onToggle: () => (b.isPaid ? unpayBill(b.id) : markBillPaid(b.id, b.plannedAmount, selectedDate)),
            subtitle: `${settings.currencySymbol}${b.plannedAmount.toFixed(2)}`,
          });
        });
    }

    // Goals (Deadlines)
    if (filters.goals) {
      goals
        .filter((g) => g.deadline === selectedDate)
        .forEach((g) => {
          list.push({
            id: g.id,
            title: `${g.title} deadline`,
            type: 'Goal',
            time: 'All day',
            isCompleted: g.status === 'completed',
            badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
          });
        });
    }

    // Meals
    if (filters.meals) {
      plannedMeals
        .filter((m) => m.date === selectedDate)
        .forEach((m) => {
          list.push({
            id: m.id,
            title: m.recipeTitle,
            type: 'Meal',
            time: m.plannedTime || '12:30',
            isCompleted: m.isConsumed,
            badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
            onToggle: () => toggleMealConsumed(m.id),
          });
        });
    }

    // Workouts
    if (filters.workouts) {
      workouts
        .filter((w) => w.date === selectedDate && !w.isRestDay)
        .forEach((w) => {
          list.push({
            id: w.id,
            title: w.title,
            type: 'Workout',
            time: w.startTime || '15:00',
            isCompleted: w.isCompleted,
            badgeColor: 'bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300',
            onToggle: () => updateWorkoutSession(w.id, { isCompleted: !w.isCompleted }),
          });
        });
    }

    // Events (including yearly recurring birthdays - LP-10)
    if (filters.events) {
      calendarEvents
        .filter((e) =>
          e.type === 'birthday'
            ? isBirthdayEventOnDate(e.date, selectedDate)
            : e.date === selectedDate
        )
        .forEach((e) => {
          list.push({
            id: e.id,
            title: e.title,
            type: e.type === 'birthday' ? 'Birthday' : e.type === 'free_time' ? 'Focus time' : 'Event',
            time: e.type === 'birthday' || e.isAllDay ? 'All day' : `${e.startTime} - ${e.endTime}`,
            badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300',
            subtitle: e.type === 'birthday' ? 'Yearly birthday' : e.notes,
            calendarEvent: e,
          });
        });
    }

    // Sort chronologically
    return list.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [
    selectedDate,
    filters,
    tasks,
    routines,
    bills,
    goals,
    plannedMeals,
    workouts,
    calendarEvents,
    settings.currencySymbol,
  ]);

  // LP-09: Only count completable items in the completion denominator
  const completableDayItems = useMemo(
    () => selectedDayItems.filter((i) => isCompletableScheduleItem(i)),
    [selectedDayItems]
  );
  const selectedDayCompleted = completableDayItems.filter((i) => i.isCompleted).length;
  const selectedDayTotal = completableDayItems.length;
  const selectedDayPct =
    selectedDayTotal > 0
      ? Math.round((selectedDayCompleted / selectedDayTotal) * 100)
      : 0;

  // Month grid dates calculation
  const monthGridDays = useMemo(() => {
    const [yStr, mStr] = selectedDate.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10) - 1;

    const firstDay = new Date(year, month, 1);
    const dayOfWeek = firstDay.getDay(); // 0 is Sunday
    const startOffset =
      settings.weekStartsOn === 'Sunday'
        ? dayOfWeek
        : dayOfWeek === 0
        ? 6
        : dayOfWeek - 1; // Mon=0

    const days = [];
    const prevMonthDate = new Date(year, month, 0);
    const prevMonthLast = prevMonthDate.getDate();
    const prevMonthYear = prevMonthDate.getFullYear();
    const prevMonthNum = prevMonthDate.getMonth() + 1;

    for (let i = startOffset - 1; i >= 0; i--) {
      const pDay = prevMonthLast - i;
      days.push({
        dayNum: pDay,
        isCurrentMonth: false,
        dateStr: `${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`,
      });
    }

    const currentMonthDays = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= currentMonthDays; i++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dayNum: i,
        isCurrentMonth: true,
        dateStr: iso,
        isToday: iso === currentDate,
        isSelected: iso === selectedDate,
      });
    }

    const totalSlots = days.length > 35 ? 42 : 35;
    const remaining = totalSlots - days.length;
    const nextMonthDate = new Date(year, month + 1, 1);
    const nextMonthYear = nextMonthDate.getFullYear();
    const nextMonthNum = nextMonthDate.getMonth() + 1;

    for (let i = 1; i <= remaining; i++) {
      days.push({
        dayNum: i,
        isCurrentMonth: false,
        dateStr: `${nextMonthYear}-${String(nextMonthNum).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      });
    }
    return days;
  }, [selectedDate, currentDate, settings.weekStartsOn]);

  // Memoized map of events by date for month grid display (Phase 06)
  const monthEventsMap = useMemo(() => {
    const map = new Map<string, Array<{ id: string; title: string; type: string; dotColor: string }>>();

    // Tasks
    if (filters.tasks) {
      tasks.forEach((t) => {
        if (!t.isArchived && t.dueDate) {
          const arr = map.get(t.dueDate) || [];
          arr.push({ id: t.id, title: t.title, type: 'Task', dotColor: 'bg-blue-500' });
          map.set(t.dueDate, arr);
        }
      });
    }

    // Bills
    if (filters.bills) {
      bills.forEach((b) => {
        if (b.dueDate) {
          const arr = map.get(b.dueDate) || [];
          arr.push({ id: b.id, title: b.title, type: 'Bill', dotColor: 'bg-rose-500' });
          map.set(b.dueDate, arr);
        }
      });
    }

    // Workouts
    if (filters.workouts) {
      workouts.forEach((w) => {
        if (w.date && !w.isRestDay) {
          const arr = map.get(w.date) || [];
          arr.push({ id: w.id, title: w.title, type: 'Workout', dotColor: 'bg-teal-500' });
          map.set(w.date, arr);
        }
      });
    }

    // Calendar events
    if (filters.events) {
      calendarEvents.forEach((e) => {
        if (e.type === 'birthday') {
          monthGridDays.forEach((cell) => {
            if (isBirthdayEventOnDate(e.date, cell.dateStr)) {
              const arr = map.get(cell.dateStr) || [];
              arr.push({ id: `${e.id}-${cell.dateStr}`, title: e.title, type: 'Birthday', dotColor: 'bg-indigo-500' });
              map.set(cell.dateStr, arr);
            }
          });
        } else if (e.date) {
          const arr = map.get(e.date) || [];
          arr.push({ id: e.id, title: e.title, type: e.type === 'free_time' ? 'Focus' : 'Event', dotColor: 'bg-indigo-500' });
          map.set(e.date, arr);
        }
      });
    }

    // Routines
    if (filters.routines) {
      monthGridDays.forEach((cell) => {
        routines.forEach((r) => {
          if (isRoutineActiveOnDate(r, cell.dateStr)) {
            const arr = map.get(cell.dateStr) || [];
            arr.push({ id: `${r.id}-${cell.dateStr}`, title: r.title, type: 'Routine', dotColor: 'bg-purple-500' });
            map.set(cell.dateStr, arr);
          }
        });
      });
    }

    return map;
  }, [filters, tasks, bills, workouts, calendarEvents, routines, monthGridDays]);

  // Upcoming items across the next 7 days (reference frame-037.png)
  const upcomingItems = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      type: string;
      date: string;
      time: string;
      dateLabel: string;
      dotColor: string;
      badgeColor: string;
    }> = [];

    const baseDate = selectedDate >= currentDate ? selectedDate : currentDate;

    for (let i = 1; i <= 7; i++) {
      const targetDate = shiftCalendarDate(baseDate, i);
      const [y, m, d] = targetDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const dateLabel = i === 1
        ? 'Tomorrow'
        : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      // Tasks
      if (filters.tasks) {
        tasks
          .filter((t) => !t.isArchived && t.status !== 'completed' && t.dueDate === targetDate)
          .forEach((t) => {
            list.push({
              id: t.id,
              title: t.title,
              type: 'Task',
              date: targetDate,
              time: t.dueTime || 'All day',
              dateLabel,
              dotColor: 'bg-blue-500',
              badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
            });
          });
      }

      // Bills
      if (filters.bills) {
        bills
          .filter((b) => !b.isPaid && b.dueDate === targetDate)
          .forEach((b) => {
            list.push({
              id: b.id,
              title: b.title,
              type: 'Bill',
              date: targetDate,
              time: '18:00',
              dateLabel,
              dotColor: 'bg-rose-500',
              badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
            });
          });
      }

      // Events
      if (filters.events) {
        calendarEvents
          .filter((e) =>
            e.type === 'birthday'
              ? isBirthdayEventOnDate(e.date, targetDate)
              : e.date === targetDate
          )
          .forEach((e) => {
            list.push({
              id: e.id,
              title: e.title,
              type: e.type === 'birthday' ? 'Birthday' : 'Event',
              date: targetDate,
              time: e.startTime || 'All day',
              dateLabel,
              dotColor: 'bg-indigo-500',
              badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300',
            });
          });
      }

      // Workouts
      if (filters.workouts) {
        workouts
          .filter((w) => !w.isCompleted && w.date === targetDate && !w.isRestDay)
          .forEach((w) => {
            list.push({
              id: w.id,
              title: w.title,
              type: 'Workout',
              date: targetDate,
              time: w.startTime || '15:00',
              dateLabel,
              dotColor: 'bg-teal-500',
              badgeColor: 'bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300',
            });
          });
      }

      if (list.length >= 8) break;
    }

    return list.slice(0, 5);
  }, [selectedDate, currentDate, filters, tasks, bills, calendarEvents, workouts]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Screen reader live announcement */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`Viewing calendar date ${selectedDate}. Showing ${selectedDayItems.length} scheduled items.`}
      </div>

      {/* Top Header & View Controls */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              {visibleMonthYearLabel}
            </h2>
            <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              {viewMode} view
            </span>
          </div>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            Connect your daily tasks, routines, meals, workouts, and events
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Buttons */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-[#526782]">
            {(['month', 'week', 'day'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-colors cursor-pointer ${
                  viewMode === m
                    ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                    : 'hover:text-[#071A3A] dark:hover:text-[#EDF4FF]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Navigation Controls (Pure Calendar Date Stepping - LP-12) */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`Previous ${viewMode}`}
              title={`Previous ${viewMode}`}
              onClick={() => {
                setSelectedDate(shiftCalendarDate(selectedDate, viewMode, -1));
              }}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-[#526782] dark:text-[#A8B8CE] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Jump to Today"
              onClick={() => {
                setSelectedDate(todayDate);
                setCurrentDate(todayDate);
              }}
              className="px-3 py-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              aria-label={`Next ${viewMode}`}
              title={`Next ${viewMode}`}
              onClick={() => {
                setSelectedDate(shiftCalendarDate(selectedDate, viewMode, 1));
              }}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-[#526782] dark:text-[#A8B8CE] cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Export Calendar .ics Button */}
          <button
            type="button"
            onClick={exportCalendarIcs}
            title="Export calendar to iCalendar (.ics)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#087F83] dark:text-[#38D0C5]" />
            <span className="hidden sm:inline">Export .ics</span>
          </button>

          {/* Add Entry Button */}
          <button
            type="button"
            onClick={() => openAddEntryModal(selectedDate)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add entry</span>
          </button>
        </div>
      </div>

      {/* Undo Delete Calendar Event Banner (LP-10) */}
      {lastDeletedEvent && (
        <div
          role="status"
          aria-live="polite"
          className="p-3.5 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-between gap-4 shadow-md border border-slate-700"
        >
          <div className="text-xs">
            Deleted calendar event <span className="font-bold">&ldquo;{lastDeletedEvent.title}&rdquo;</span>.
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUndoDeleteCalendarEvent}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#38D0C5] text-[#071A3A] text-xs font-bold hover:bg-[#2BB5AB] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo delete</span>
            </button>
            <button
              type="button"
              onClick={() => setLastDeletedEvent(null)}
              className="px-2 py-1 rounded-lg text-slate-300 hover:text-white text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'tasks', label: 'Tasks', color: 'bg-blue-500' },
          { key: 'routines', label: 'Routines', color: 'bg-purple-500' },
          { key: 'bills', label: 'Bills', color: 'bg-rose-500' },
          { key: 'goals', label: 'Goals', color: 'bg-amber-500' },
          { key: 'meals', label: 'Meals', color: 'bg-emerald-500' },
          { key: 'workouts', label: 'Workouts', color: 'bg-teal-500' },
          { key: 'events', label: 'Events', color: 'bg-indigo-500' },
        ].map((f) => {
          const active = filters[f.key as keyof typeof filters];
          return (
            <button
              key={f.key}
              type="button"
              role="switch"
              aria-checked={active}
              aria-label={`Filter ${f.label}`}
              onClick={() => toggleFilter(f.key as keyof typeof filters)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                active
                  ? 'bg-white dark:bg-[#152238] border-[#087F83] text-[#087F83] dark:text-[#38D0C5]'
                  : 'bg-slate-100 dark:bg-slate-800 border-transparent text-[#526782] dark:text-[#A8B8CE] opacity-60'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${f.color}`} />
              <span>{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Calendar Area + Selected Day Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar View Body (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs overflow-hidden">
          {viewMode === 'month' && (
            <div>
              {/* Day Headers */}
              <div className="grid grid-cols-7 text-center font-bold text-xs text-[#526782] py-2 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
                {settings.weekStartsOn === 'Sunday' ? (
                  <>
                    <span>Sun</span>
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                  </>
                ) : (
                  <>
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                    <span>Sun</span>
                  </>
                )}
              </div>

              {/* Month Grid Cells */}
              <div className="grid grid-cols-7 gap-1 pt-2">
                {monthGridDays.map((cell, idx) => {
                  let formattedCellLabel = `${cell.dayNum}`;
                  try {
                    const [y, m, d] = cell.dateStr.split('-');
                    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
                    formattedCellLabel = dateObj.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    });
                  } catch {
                    formattedCellLabel = cell.dateStr;
                  }

                  const cellEventsCount = [
                    tasks.some((t) => !t.isArchived && t.dueDate === cell.dateStr),
                    bills.some((b) => b.dueDate === cell.dateStr),
                    workouts.some((w) => w.date === cell.dateStr && !w.isRestDay),
                    calendarEvents.some((e) =>
                      e.type === 'birthday'
                        ? isBirthdayEventOnDate(e.date, cell.dateStr)
                        : e.date === cell.dateStr
                    ),
                    filters.routines && routines.some((r) => isRoutineActiveOnDate(r, cell.dateStr)),
                  ].filter(Boolean).length;

                  if (cellEventsCount > 0) {
                    formattedCellLabel += `, ${cellEventsCount} scheduled item${cellEventsCount === 1 ? '' : 's'}`;
                  } else {
                    formattedCellLabel += ', no scheduled items';
                  }

                  if (cell.isToday) formattedCellLabel += ', Today';
                  if (cell.isSelected) formattedCellLabel += ', Selected';

                  const cellItems = monthEventsMap.get(cell.dateStr) || [];
                  return (
                    <button
                      key={idx}
                      type="button"
                      data-calendar-date={cell.dateStr}
                      aria-label={formattedCellLabel}
                      aria-pressed={cell.isSelected}
                      aria-current={cell.isToday ? 'date' : undefined}
                      onClick={() => setSelectedDate(cell.dateStr)}
                      className={`min-h-[92px] p-1.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between w-full min-w-0 ${
                        cell.isSelected
                          ? 'border-[#087F83] ring-2 ring-[#087F83]/50 bg-teal-50/50 dark:bg-teal-950/20 shadow-xs'
                          : cell.isToday
                          ? 'border-teal-300 dark:border-teal-700/80 bg-teal-50/20 dark:bg-teal-950/10'
                          : cell.isCurrentMonth
                          ? 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          : 'border-transparent text-slate-300 dark:text-slate-600 bg-slate-50/30 dark:bg-slate-900/20'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs font-semibold ${
                            cell.isToday
                              ? 'w-5 h-5 rounded-full bg-[#087F83] text-white flex items-center justify-center font-bold text-[11px] shadow-2xs'
                              : cell.isSelected
                              ? 'text-[#087F83] dark:text-[#38D0C5] font-bold'
                              : ''
                          }`}
                        >
                          {cell.dayNum}
                        </span>
                      </div>

                      {/* Desktop readable event chips preview (Reference frame-037.png) */}
                      <div className="hidden md:flex flex-col gap-1 mt-1 w-full overflow-hidden">
                        {cellItems.slice(0, 2).map((item) => (
                          <span
                            key={item.id}
                            className="text-[10px] leading-tight px-1.5 py-0.5 rounded truncate font-medium bg-slate-100 dark:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1 w-full"
                            title={`${item.title} (${item.type})`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${item.dotColor} shrink-0`} />
                            <span className="truncate">{item.title}</span>
                          </span>
                        ))}
                        {cellItems.length > 2 && (
                          <span
                            data-testid={`calendar-cell-overflow-${cell.dateStr}`}
                            className="text-[9px] font-bold text-[#087F83] dark:text-[#38D0C5] px-1 hover:underline text-left leading-tight"
                          >
                            +{cellItems.length - 2} more
                          </span>
                        )}
                      </div>

                      {/* Mobile compact colored dots preview */}
                      <div className="md:hidden flex flex-wrap gap-1 mt-1">
                        {cellItems.slice(0, 4).map((it) => (
                          <span key={it.id} className={`w-1.5 h-1.5 rounded-full ${it.dotColor}`} />
                        ))}
                        {cellItems.length > 4 && (
                          <span className="text-[8px] font-bold text-[#087F83] dark:text-[#38D0C5] leading-none">+</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === 'week' && (
            <div>
              {/* Week header row */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A] text-center w-full">
                {weekDays.map((w) => (
                  <button
                    key={w.dateStr}
                    type="button"
                    aria-label={`${w.fullDate}${w.isToday ? ', Today' : ''}${w.isSelected ? ', Selected' : ''}`}
                    aria-pressed={w.isSelected}
                    aria-current={w.dateStr === currentDate ? 'date' : undefined}
                    onClick={() => setSelectedDate(w.dateStr)}
                    className={`py-2 px-0.5 rounded-xl transition-colors cursor-pointer min-w-0 ${
                      w.isSelected
                        ? 'bg-[#087F83] text-white font-bold shadow-xs'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-[#526782] dark:text-[#A8B8CE]'
                    }`}
                  >
                    <div className="text-[9px] sm:text-[11px] uppercase tracking-tighter truncate w-full">{w.dayName}</div>
                    <div className="text-sm sm:text-base font-bold">{w.dayNum}</div>
                  </button>
                ))}
              </div>

              {/* Time blocks hourly grid */}
              <div className="mt-4 space-y-3 divide-y divide-slate-100 dark:divide-slate-800/80">
                {selectedDayItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#526782] dark:text-[#A8B8CE]">
                    No scheduled items or focus blocks for this day.
                  </div>
                ) : (
                  selectedDayItems.map((item) => (
                    <div key={item.id} className="pt-3 flex items-start gap-4">
                      <span className="text-xs font-mono text-[#526782] dark:text-[#A8B8CE] w-24 shrink-0">
                        {item.time || 'All day'}
                      </span>
                      <div
                        className={`flex-1 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold flex items-center justify-between ${
                          item.isCompleted
                            ? 'bg-slate-50 dark:bg-slate-800/40 text-[#526782] dark:text-[#94A3B8] line-through'
                            : 'bg-white dark:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {item.onToggle && (
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={item.isCompleted}
                              aria-label={`Mark "${item.title}" as ${item.isCompleted ? 'incomplete' : 'complete'}`}
                              onClick={item.onToggle}
                              className={`w-4 h-4 rounded-md shrink-0 flex items-center justify-center cursor-pointer transition-colors ${
                                item.isCompleted
                                  ? 'bg-[#087F83] text-white'
                                  : 'border border-slate-300 dark:border-slate-600 hover:border-[#087F83]'
                              }`}
                            >
                              {item.isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                            </button>
                          )}
                          <span>{item.title}</span>
                          {conflictsSet.has(item.id) && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800"
                              title="Schedule overlap with another event or task"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              Overlap
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {item.routineId && (
                            <button
                              type="button"
                              onClick={() => setPreviewRoutineId(item.routineId!)}
                              title="Preview recurring schedule"
                              className="p-1 rounded text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 cursor-pointer"
                            >
                              <Repeat className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {item.calendarEvent && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditEventModal(item.calendarEvent!)}
                                title="Edit event"
                                aria-label={`Edit event "${item.title}"`}
                                className="p-1 rounded text-[#526782] hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCalendarEvent(item.calendarEvent!)}
                                title="Delete event"
                                aria-label={`Delete event "${item.title}"`}
                                className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-normal uppercase tracking-wider ${item.badgeColor}`}>
                            {item.type}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {viewMode === 'day' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
                <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Daily Timeline · {selectedDate}
                </h3>
              </div>

              <div className="space-y-2">
                {selectedDayItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      {item.onToggle ? (
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={item.isCompleted}
                          aria-label={`Mark "${item.title}" as ${item.isCompleted ? 'incomplete' : 'complete'}`}
                          onClick={item.onToggle}
                          className={`w-5 h-5 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
                            item.isCompleted
                              ? 'bg-[#087F83] text-white'
                              : 'border border-slate-300 dark:border-slate-600 hover:border-[#087F83]'
                          }`}
                        >
                          {item.isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#087F83]" />
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-semibold ${item.isCompleted ? 'line-through text-[#526782] dark:text-[#94A3B8]' : 'text-[#071A3A] dark:text-[#EDF4FF]'}`}>
                            {item.title}
                          </span>
                          {conflictsSet.has(item.id) && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1 py-0.5 rounded border border-amber-300 dark:border-amber-800 shrink-0"
                              title="Schedule overlap with another event or task"
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                              Overlap
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#526782] dark:text-[#A8B8CE] font-mono">
                          <span>{item.time}</span>
                          {item.subtitle && (
                            <span className="text-slate-500 dark:text-slate-400 font-sans truncate">
                              · {item.subtitle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.routineId && (
                        <button
                          type="button"
                          onClick={() => setPreviewRoutineId(item.routineId!)}
                          title="Preview recurring schedule"
                          className="p-1 rounded text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 cursor-pointer"
                        >
                          <Repeat className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {item.calendarEvent && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditEventModal(item.calendarEvent!)}
                            title="Edit event"
                            aria-label={`Edit event "${item.title}"`}
                            className="p-1 rounded text-[#526782] hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCalendarEvent(item.calendarEvent!)}
                            title="Delete event"
                            aria-label={`Delete event "${item.title}"`}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${item.badgeColor}`}>
                        {item.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Selected Day & Coming Up (Reference frame-037.png) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Selected Day Detail Panel */}
          <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
              <div>
                <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Selected day
                </h3>
                <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
                  {selectedDate}
                </p>
              </div>

              <RingProgress
                progress={selectedDayPct}
                size={50}
                strokeWidth={5}
                color="#087F83"
              >
                <span className="text-xs font-bold font-mono">
                  {selectedDayPct}%
                </span>
              </RingProgress>
            </div>

            <div className="text-xs text-[#526782] dark:text-[#A8B8CE] font-semibold">
              {selectedDayCompleted} of {selectedDayTotal} complete
            </div>

            {/* List of items */}
            <div className="space-y-2 max-h-[460px] overflow-y-auto">
              {selectedDayItems.length === 0 ? (
                Object.values(filters).some((v) => !v) ? (
                  <FilterEmptyState
                    title="No items match your active filters"
                    description="One or more calendar filter categories are currently hidden. Reset filters to see all events and tasks."
                    clearLabel="Enable all filters"
                    onClearFilters={() =>
                      setFilters({
                        tasks: true,
                        routines: true,
                        bills: true,
                        goals: true,
                        meals: true,
                        workouts: true,
                        events: true,
                      })
                    }
                  />
                ) : (
                  <div className="p-6 text-center text-xs text-[#526782] dark:text-[#A8B8CE]">
                    No items scheduled for this day.
                  </div>
                )
              ) : (
                selectedDayItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {item.onToggle && (
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={item.isCompleted}
                          aria-label={`Mark "${item.title}" as ${item.isCompleted ? 'incomplete' : 'complete'}`}
                          onClick={item.onToggle}
                          className={`w-4 h-4 rounded-md shrink-0 flex items-center justify-center cursor-pointer micro-checkbox ${
                            item.isCompleted
                              ? 'bg-[#087F83] text-white'
                              : 'border border-slate-300 dark:border-slate-600 hover:border-[#087F83]'
                          }`}
                        >
                          {item.isCompleted && <Check className="w-3 h-3 stroke-[3] motion-check-pop" />}
                        </button>
                      )}
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={`text-xs font-semibold truncate transition-all duration-150 ${item.isCompleted ? 'line-through text-[#526782] dark:text-[#94A3B8]' : 'text-[#071A3A] dark:text-[#EDF4FF]'}`}>
                            {item.title}
                          </span>
                          {conflictsSet.has(item.id) && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1 py-0.5 rounded border border-amber-300 dark:border-amber-800 shrink-0"
                              title="Schedule overlap with another event or task"
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#526782] dark:text-[#A8B8CE] font-mono">
                          <span>{item.time}</span>
                          {item.subtitle && (
                            <span className="text-slate-500 dark:text-slate-400 font-sans truncate">
                              · {item.subtitle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.routineId && (
                        <button
                          type="button"
                          onClick={() => setPreviewRoutineId(item.routineId!)}
                          title="Preview recurring schedule"
                          className="p-1 rounded text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 cursor-pointer"
                        >
                          <Repeat className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {item.calendarEvent && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditEventModal(item.calendarEvent!)}
                            title="Edit event"
                            aria-label={`Edit event "${item.title}"`}
                            className="p-1 rounded text-[#526782] hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCalendarEvent(item.calendarEvent!)}
                            title="Delete event"
                            aria-label={`Delete event "${item.title}"`}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0 ${item.badgeColor}`}>
                        {item.type}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => openAddEntryModal(selectedDate)}
              className="w-full py-2.5 rounded-xl border border-dashed border-[#087F83] text-[#087F83] dark:text-[#38D0C5] text-xs font-semibold flex items-center justify-center gap-2 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add entry to this day</span>
            </button>
          </div>

          {/* Coming Up Card (Reference frame-037.png) */}
          <div data-testid="calendar-upcoming-card" className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
              <div>
                <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Coming up
                </h3>
                <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
                  Next 7 days
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[#526782] dark:text-[#A8B8CE]">
                {upcomingItems.length}
              </span>
            </div>

            <div className="space-y-2">
              {upcomingItems.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#526782] dark:text-[#A8B8CE]">
                  No upcoming items scheduled in the next 7 days.
                </div>
              ) : (
                upcomingItems.map((item) => (
                  <button
                    key={`${item.id}-${item.date}`}
                    type="button"
                    onClick={() => setSelectedDate(item.date)}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                    aria-label={`Jump to ${item.dateLabel}: ${item.title} (${item.type})`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full ${item.dotColor} shrink-0`} />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] truncate group-hover:text-[#087F83] dark:group-hover:text-[#38D0C5] transition-colors">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] font-mono">
                          {item.dateLabel} · {item.time}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0 ${item.badgeColor}`}>
                      {item.type}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Entry Contextual Detail Panel */}
      <ContextualDetailPanel
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCalendarEvent(null);
        }}
        title={editingCalendarEvent ? 'Edit calendar event' : 'Add calendar entry'}
        subtitle={
          editingCalendarEvent
            ? 'Update your scheduled event, birthday, or focus block'
            : 'Schedule a task, bill, event or free time block'
        }
        dataTestId="calendar-entry-panel"
      >
        <form onSubmit={handleSaveEntry} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="calendar-entry-type"
              className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
            >
              Type
            </label>
            <select
              id="calendar-entry-type"
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium focus:ring-2 focus:ring-[#087F83]"
            >
              <option value="free_time">Free time / Focus block</option>
              {!editingCalendarEvent && <option value="task">Task</option>}
              {!editingCalendarEvent && <option value="bill">Bill</option>}
              <option value="birthday">Birthday (Repeats yearly)</option>
              <option value="event">Event</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="calendar-entry-title"
              className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
            >
              Title *
            </label>
            <input
              id="calendar-entry-title"
              type="text"
              required
              value={entryTitle}
              onChange={(e) => setEntryTitle(e.target.value)}
              placeholder={
                entryType === 'bill'
                  ? 'e.g. Electricity bill, Internet'
                  : entryType === 'birthday'
                  ? 'e.g. Sam Birthday'
                  : 'e.g. Focus time, Doctor appointment'
              }
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs focus:ring-2 focus:ring-[#087F83]"
            />
          </div>

          {/* Explicit Bill Details when entryType === 'bill' (LP-11) */}
          {!editingCalendarEvent && entryType === 'bill' && (
            <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="calendar-bill-amount"
                    className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                  >
                    Planned amount ({settings.currencySymbol}) *
                  </label>
                  <input
                    id="calendar-bill-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    aria-invalid={Boolean(timeError)}
                    value={billPlannedAmount}
                    onChange={(e) => {
                      setBillPlannedAmount(e.target.value);
                      if (timeError) setTimeError('');
                    }}
                    placeholder="e.g. 85.00"
                    className={`w-full px-3 py-2 rounded-xl border ${timeError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-[#E2E8F0] dark:border-[#1E2D4A]'} bg-white dark:bg-[#152238] text-xs font-mono`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="calendar-bill-category"
                    className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                  >
                    Bill category
                  </label>
                  <select
                    id="calendar-bill-category"
                    value={billCategory}
                    onChange={(e) => setBillCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
                  >
                    <option value="Utilities">Utilities</option>
                    <option value="Housing">Housing</option>
                    <option value="Subscriptions">Subscriptions</option>
                    <option value="Household">Household</option>
                    <option value="Personal">Personal</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label
                  htmlFor="calendar-bill-repeat"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                >
                  Repeat schedule
                </label>
                <select
                  id="calendar-bill-repeat"
                  value={billRepeatInterval}
                  onChange={(e) => setBillRepeatInterval(e.target.value as RepeatInterval)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
                >
                  <option value="none">One-time bill</option>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="calendar-entry-date"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                {entryType === 'bill' ? 'Due date' : 'Date'}
              </label>
              <input
                id="calendar-entry-date"
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
              />
            </div>
            {entryType !== 'bill' && entryType !== 'birthday' && (
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className="rounded text-[#087F83] focus:ring-[#087F83]"
                  />
                  <span>All-day event</span>
                </label>
              </div>
            )}
          </div>

          {entryType !== 'bill' && entryType !== 'birthday' && !isAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="calendar-entry-start-time"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                >
                  Start time
                </label>
                <input
                  id="calendar-entry-start-time"
                  type="time"
                  aria-invalid={Boolean(timeError)}
                  value={entryStartTime}
                  onChange={(e) => {
                    setEntryStartTime(e.target.value);
                    if (timeError) setTimeError('');
                  }}
                  className={`w-full px-3 py-2 rounded-xl border ${timeError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-[#E2E8F0] dark:border-[#1E2D4A]'} bg-white dark:bg-[#152238] text-xs`}
                />
              </div>
              <div>
                <label
                  htmlFor="calendar-entry-end-time"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                >
                  End time
                </label>
                <input
                  id="calendar-entry-end-time"
                  type="time"
                  aria-invalid={Boolean(timeError)}
                  value={entryEndTime}
                  onChange={(e) => {
                    setEntryEndTime(e.target.value);
                    if (timeError) setTimeError('');
                  }}
                  className={`w-full px-3 py-2 rounded-xl border ${timeError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-[#E2E8F0] dark:border-[#1E2D4A]'} bg-white dark:bg-[#152238] text-xs`}
                />
              </div>
            </div>
          )}

          {timeError && (
            <div
              role="alert"
              data-testid="calendar-entry-time-error"
              className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{timeError}</span>
            </div>
          )}

          {entryType !== 'bill' && (
            <div>
              <label
                htmlFor="calendar-entry-notes"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Notes (optional)
              </label>
              <textarea
                id="calendar-entry-notes"
                rows={2}
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
                placeholder="Add details…"
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingCalendarEvent(null);
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782] hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="calendar-entry-submit-btn"
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A]"
            >
              {editingCalendarEvent ? 'Save changes' : 'Save entry'}
            </button>
          </div>
        </form>
      </ContextualDetailPanel>

      {/* Recurring Rule Preview Modal */}
      {previewRoutineId && (() => {
        const routine = routines.find((r) => r.id === previewRoutineId);
        if (!routine) return null;
        const upcomingOccurrences = getUpcomingRoutineOccurrences(routine, selectedDate, 8);
        return (
          <Modal
            isOpen={true}
            onClose={() => setPreviewRoutineId(null)}
            title="Recurring schedule preview"
            subtitle={routine.title}
          >
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 flex items-start gap-3">
                <Repeat className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-purple-900 dark:text-purple-200">
                    Recurrence pattern
                  </div>
                  <div className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                    {formatRecurrenceRule(routine)}
                  </div>
                  {routine.startTime && (
                    <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400 mt-1">
                      Scheduled time: {routine.startTime}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#526782] dark:text-[#A8B8CE] mb-2">
                  Next 8 occurrences
                </h4>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {upcomingOccurrences.map((occDate) => {
                    const isForgiven = (routine.forgivenDates || []).includes(occDate);
                    const isDone = routine.completedDates.includes(occDate);
                    const isSkipped = routine.skippedDates.includes(occDate);
                    let formattedDate = occDate;
                    try {
                      const [y, m, d] = occDate.split('-').map(Number);
                      formattedDate = new Date(y, m - 1, d).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });
                    } catch {
                      formattedDate = occDate;
                    }

                    return (
                      <div
                        key={occDate}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs"
                      >
                        <span className="font-medium text-[#071A3A] dark:text-[#EDF4FF]">
                          {formattedDate}
                        </span>
                        <div>
                          {isForgiven ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                              Rest day (protected)
                            </span>
                          ) : isDone ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
                              Completed
                            </span>
                          ) : isSkipped ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                              Skipped
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                              Scheduled
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setPreviewRoutineId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] hover:bg-slate-200 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};
