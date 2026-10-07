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
  X,
} from 'lucide-react';
import { RingProgress } from '../ui/RingProgress';
import { Modal } from '../ui/Modal';
import {
  isRoutineActiveOnDate,
  getRoutineOccurrence,
  formatRecurrenceRule,
} from '../../utils/routineRecurrence';

export const CalendarView: React.FC = () => {
  const {
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
    addTask,
    addBill,
  } = usePlanner();

  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week');
  const [selectedDate, setSelectedDate] = useState<string>(currentDate);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

  // Add entry modal form state
  const [entryType, setEntryType] = useState<
    'free_time' | 'task' | 'bill' | 'birthday' | 'event'
  >('free_time');
  const [entryTitle, setEntryTitle] = useState('');
  const [entryDate, setEntryDate] = useState(selectedDate);
  const [isAllDay, setIsAllDay] = useState(false);
  const [entryStartTime, setEntryStartTime] = useState('10:00');
  const [entryEndTime, setEntryEndTime] = useState('11:00');
  const [entryNotes, setEntryNotes] = useState('');
  const [timeError, setTimeError] = useState('');

  // Validate end time after start time
  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryTitle.trim()) return;

    if (!isAllDay && entryStartTime && entryEndTime) {
      if (entryEndTime <= entryStartTime) {
        setTimeError('End time must be after start time.');
        return;
      }
    }
    setTimeError('');

    if (entryType === 'task') {
      addTask({
        title: entryTitle,
        category: 'Personal',
        assignedTo: 'Rida',
        dueDate: entryDate,
        dueTime: isAllDay ? undefined : entryStartTime,
        priority: 'medium',
        status: 'not_started',
      });
    } else if (entryType === 'bill') {
      addBill({
        title: entryTitle,
        category: 'Personal',
        plannedAmount: 50,
        dueDate: entryDate,
      });
    } else {
      addCalendarEvent({
        title: entryTitle,
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
        notes: entryNotes,
      });
    }

    setIsAddModalOpen(false);
    setEntryTitle('');
    setEntryNotes('');
  };

  // Week days (Mon-Sun)
  const weekDays = useMemo(() => {
    const cur = new Date(selectedDate);
    const day = cur.getDay();
    const diff = cur.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(cur.setDate(diff));

    const list = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      list.push({
        dateStr: iso,
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: iso === todayDate,
        isSelected: iso === selectedDate,
      });
    }
    return list;
  }, [selectedDate, todayDate]);

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
    }> = [];

    // Tasks
    if (filters.tasks) {
      tasks
        .filter((t) => t.dueDate === selectedDate)
        .forEach((t) => {
          list.push({
            id: t.id,
            title: t.title,
            type: 'Task',
            time: t.dueTime || t.scheduledStart || 'All day',
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

    // Events
    if (filters.events) {
      calendarEvents
        .filter((e) => e.date === selectedDate)
        .forEach((e) => {
          list.push({
            id: e.id,
            title: e.title,
            type: e.type === 'birthday' ? 'Birthday' : e.type === 'free_time' ? 'Focus time' : 'Event',
            time: e.isAllDay ? 'All day' : `${e.startTime} - ${e.endTime}`,
            badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300',
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
  ]);

  const selectedDayCompleted = selectedDayItems.filter((i) => i.isCompleted).length;
  const selectedDayTotal = selectedDayItems.length;
  const selectedDayPct =
    selectedDayTotal > 0
      ? Math.round((selectedDayCompleted / selectedDayTotal) * 100)
      : 0;

  // Month grid dates calculation
  const monthGridDays = useMemo(() => {
    const cur = new Date(selectedDate);
    const year = cur.getFullYear();
    const month = cur.getMonth();

    const firstDay = new Date(year, month, 1);
    const dayOfWeek = firstDay.getDay(); // 0 is Sunday
    const startOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Mon=0

    const days = [];
    const prevMonthLast = new Date(year, month, 0).getDate();

    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({
        dayNum: prevMonthLast - i,
        isCurrentMonth: false,
        dateStr: `${year}-${String(month).padStart(2, '0')}-${String(prevMonthLast - i).padStart(2, '0')}`,
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

    const remaining = 35 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        dayNum: i,
        isCurrentMonth: false,
        dateStr: `${year}-${String(month + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      });
    }
    return days;
  }, [selectedDate, currentDate]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header & View Controls */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Calendar & Time Blocking
          </h2>
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

          {/* Navigation Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const d = new Date(selectedDate);
                if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
                else if (viewMode === 'week') d.setDate(d.getDate() - 7);
                else d.setDate(d.getDate() - 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-[#526782]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setSelectedDate(todayDate);
                setCurrentDate(todayDate);
              }}
              className="px-3 py-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={() => {
                const d = new Date(selectedDate);
                if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
                else if (viewMode === 'week') d.setDate(d.getDate() + 7);
                else d.setDate(d.getDate() + 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-[#526782]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Add Entry Button */}
          <button
            onClick={() => {
              setEntryDate(selectedDate);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add entry</span>
          </button>
        </div>
      </div>

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
              onClick={() => toggleFilter(f.key as keyof typeof filters)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                active
                  ? 'bg-white dark:bg-[#152238] border-[#087F83] text-[#087F83] dark:text-[#38D0C5]'
                  : 'bg-slate-100 dark:bg-slate-800 border-transparent text-[#526782] opacity-60'
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
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>

              {/* Month Grid Cells */}
              <div className="grid grid-cols-7 gap-1 pt-2">
                {monthGridDays.map((cell, idx) => {
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDate(cell.dateStr)}
                      className={`min-h-[85px] p-1.5 rounded-xl border text-left cursor-pointer transition-colors flex flex-col justify-between ${
                        cell.isSelected
                          ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20'
                          : cell.isCurrentMonth
                          ? 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          : 'border-transparent text-slate-300 dark:text-slate-700 bg-slate-50/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-semibold ${
                            cell.isToday
                              ? 'w-5 h-5 rounded-full bg-[#087F83] text-white flex items-center justify-center font-bold'
                              : ''
                          }`}
                        >
                          {cell.dayNum}
                        </span>
                      </div>

                      {/* Small dots preview for events */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tasks.some((t) => t.dueDate === cell.dateStr) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                        {bills.some((b) => b.dueDate === cell.dateStr) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        )}
                        {workouts.some((w) => w.date === cell.dateStr && !w.isRestDay) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                        )}
                        {calendarEvents.some((e) => e.date === cell.dateStr) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        )}
                        {filters.routines &&
                          routines.some((r) => isRoutineActiveOnDate(r, cell.dateStr)) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === 'week' && (
            <div>
              {/* Week header row */}
              <div className="grid grid-cols-7 gap-2 pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A] text-center">
                {weekDays.map((w) => (
                  <button
                    key={w.dateStr}
                    onClick={() => setSelectedDate(w.dateStr)}
                    className={`py-2 rounded-xl transition-colors cursor-pointer ${
                      w.isSelected
                        ? 'bg-[#087F83] text-white font-bold shadow-xs'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-[#526782]'
                    }`}
                  >
                    <div className="text-[11px] uppercase">{w.dayName}</div>
                    <div className="text-base font-bold">{w.dayNum}</div>
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
                            ? 'bg-slate-50 dark:bg-slate-800/40 text-[#526782] line-through'
                            : 'bg-white dark:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {item.onToggle && (
                            <button
                              onClick={item.onToggle}
                              className={`w-4 h-4 rounded-md shrink-0 flex items-center justify-center cursor-pointer transition-colors ${
                                item.isCompleted
                                  ? 'bg-[#087F83] text-white'
                                  : 'border border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {item.isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                            </button>
                          )}
                          <span>{item.title}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-normal uppercase tracking-wider ${item.badgeColor}`}>
                          {item.type}
                        </span>
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
                          onClick={item.onToggle}
                          className={`w-5 h-5 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
                            item.isCompleted
                              ? 'bg-[#087F83] text-white'
                              : 'border border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {item.isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#087F83]" />
                      )}
                      <div>
                        <div className={`text-xs font-semibold ${item.isCompleted ? 'line-through text-[#526782]' : 'text-[#071A3A] dark:text-[#EDF4FF]'}`}>
                          {item.title}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#526782] font-mono">
                          <span>{item.time}</span>
                          {item.subtitle && (
                            <span className="text-slate-400 dark:text-slate-500 font-sans truncate">
                              · {item.subtitle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${item.badgeColor}`}>
                      {item.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected Day Detail Panel (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-5">
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

          <div className="text-xs text-[#526782] font-semibold">
            {selectedDayCompleted} of {selectedDayTotal} complete
          </div>

          {/* List of items */}
          <div className="space-y-2 max-h-[460px] overflow-y-auto">
            {selectedDayItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#526782]">
                No items scheduled for this day.
              </div>
            ) : (
              selectedDayItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {item.onToggle && (
                      <button
                        onClick={item.onToggle}
                        className={`w-4 h-4 rounded-md shrink-0 flex items-center justify-center cursor-pointer ${
                          item.isCompleted
                            ? 'bg-[#087F83] text-white'
                            : 'border border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {item.isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>
                    )}
                    <div className="truncate">
                      <div className={`text-xs font-semibold truncate ${item.isCompleted ? 'line-through text-[#526782]' : 'text-[#071A3A] dark:text-[#EDF4FF]'}`}>
                        {item.title}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#526782] font-mono">
                        <span>{item.time}</span>
                        {item.subtitle && (
                          <span className="text-slate-400 dark:text-slate-500 font-sans truncate">
                            · {item.subtitle}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0 ${item.badgeColor}`}>
                    {item.type}
                  </span>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => {
              setEntryDate(selectedDate);
              setIsAddModalOpen(true);
            }}
            className="w-full py-2.5 rounded-xl border border-dashed border-[#087F83] text-[#087F83] dark:text-[#38D0C5] text-xs font-semibold flex items-center justify-center gap-2 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add entry to this day</span>
          </button>
        </div>
      </div>

      {/* Add Entry Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add calendar entry"
        subtitle="Schedule a task, bill, event or free time block"
      >
        <form onSubmit={handleSaveEntry} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Type
            </label>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium focus:ring-2 focus:ring-[#087F83]"
            >
              <option value="free_time">Free time / Focus block</option>
              <option value="task">Task</option>
              <option value="bill">Bill</option>
              <option value="birthday">Birthday</option>
              <option value="event">Event</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={entryTitle}
              onChange={(e) => setEntryTitle(e.target.value)}
              placeholder="e.g. Focus time, Doctor appointment"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs focus:ring-2 focus:ring-[#087F83]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
              />
            </div>
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
          </div>

          {!isAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Start time
                </label>
                <input
                  type="time"
                  value={entryStartTime}
                  onChange={(e) => setEntryStartTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  End time
                </label>
                <input
                  type="time"
                  value={entryEndTime}
                  onChange={(e) => setEntryEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
                />
              </div>
            </div>
          )}

          {timeError && (
            <p className="text-xs text-rose-600 font-medium">{timeError}</p>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={entryNotes}
              onChange={(e) => setEntryNotes(e.target.value)}
              placeholder="Add details…"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782] hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A]"
            >
              Save entry
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
