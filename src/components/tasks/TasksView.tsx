import React, { useState, useMemo, useEffect } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { getWeekDaysForDate } from '../../utils/formatters';
import { RingProgress } from '../ui/RingProgress';
import { ContextualDetailPanel } from '../ui/ContextualDetailPanel';
import { FilterEmptyState } from '../ui/FilterEmptyState';
import {
  Check,
  Plus,
  Search,
  Filter,
  AlertCircle,
  MoreVertical,
  Calendar,
  Clock,
  User,
  Trash2,
  Edit2,
  PieChart,
  List,
  ChevronLeft,
  ChevronRight,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { TaskItem, Priority, TaskStatus } from '../../types/planner';

export const TasksView: React.FC = () => {
  const {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    restoreDeletedTask,
    archiveTask,
    unarchiveTask,
    toggleTaskCompletion,
    currentDate,
    settings,
  } = usePlanner();

  const defaultOwner = settings.ownerName || 'Me';

  const [activeTab, setActiveTab] = useState<'list' | 'insights'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [assignedFilter, setAssignedFilter] = useState('Anyone');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [lastDeletedTask, setLastDeletedTask] = useState<TaskItem | null>(null);

  // Pagination / bounded rendering state (50 per page default)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Task Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalCategory, setModalCategory] = useState('Personal');
  const [modalAssigned, setModalAssigned] = useState(defaultOwner);
  const [modalDueDate, setModalDueDate] = useState('');
  const [modalDueTime, setModalDueTime] = useState('');
  const [modalPriority, setModalPriority] = useState<Priority>('medium');
  const [modalStatus, setModalStatus] = useState<TaskStatus>('not_started');
  const [modalDescription, setModalDescription] = useState('');
  const [modalTitleError, setModalTitleError] = useState('');

  const openCreateModal = () => {
    setEditingTask(null);
    setModalTitle('');
    setModalTitleError('');
    setModalCategory('Personal');
    setModalAssigned(settings.ownerName || 'Me');
    setModalDueDate(currentDate);
    setModalDueTime('');
    setModalPriority('medium');
    setModalStatus('not_started');
    setModalDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (task: TaskItem) => {
    setEditingTask(task);
    setModalTitle(task.title);
    setModalTitleError('');
    setModalCategory(task.category);
    setModalAssigned(task.assignedTo);
    setModalDueDate(task.dueDate || '');
    setModalDueTime(task.dueTime || '');
    setModalPriority(task.priority);
    setModalStatus(task.status);
    setModalDescription(task.description || '');
    setIsModalOpen(true);
  };

  const handleDeleteTaskWithUndo = (task: TaskItem) => {
    setLastDeletedTask(task);
    deleteTask(task.id);
  };

  const handleUndoDeleteTask = () => {
    if (!lastDeletedTask) return;
    restoreDeletedTask(lastDeletedTask);
    setLastDeletedTask(null);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) {
      setModalTitleError('Please enter a task title.');
      return;
    }
    setModalTitleError('');

    if (editingTask) {
      updateTask(editingTask.id, {
        title: modalTitle.trim(),
        category: modalCategory,
        assignedTo: modalAssigned,
        dueDate: modalDueDate || undefined,
        dueTime: modalDueTime || undefined,
        priority: modalPriority,
        status: modalStatus,
        description: modalDescription || undefined,
      });
    } else {
      addTask({
        title: modalTitle.trim(),
        category: modalCategory,
        assignedTo: modalAssigned,
        dueDate: modalDueDate || undefined,
        dueTime: modalDueTime || undefined,
        priority: modalPriority,
        status: modalStatus,
        description: modalDescription || undefined,
      });
    }
    setIsModalOpen(false);
  };

  const archivedCount = useMemo(
    () => tasks.filter((t) => Boolean(t.isArchived)).length,
    [tasks]
  );

  // Filter tasks (excluding archived tasks from active views unless 'Archived' filter is chosen)
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter === 'Archived') {
        if (!t.isArchived) return false;
      } else {
        if (t.isArchived) return false;
      }
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
      if (assignedFilter !== 'Anyone' && t.assignedTo !== assignedFilter) return false;
      if (priorityFilter !== 'All' && t.priority !== priorityFilter.toLowerCase()) return false;
      if (
        statusFilter !== 'All' &&
        statusFilter !== 'Archived' &&
        t.status !== statusFilter.toLowerCase().replace(' ', '_')
      ) {
        return false;
      }
      if (selectedDateFilter !== 'all' && t.dueDate !== selectedDateFilter) {
        return false;
      }
      return true;
    });
  }, [tasks, searchQuery, categoryFilter, assignedFilter, priorityFilter, statusFilter, selectedDateFilter]);

  const activeFilterCount =
    (categoryFilter !== 'All' ? 1 : 0) +
    (priorityFilter !== 'All' ? 1 : 0) +
    (statusFilter !== 'All' ? 1 : 0) +
    (selectedDateFilter !== 'all' ? 1 : 0);

  // Reset to first page whenever search query or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, assignedFilter, priorityFilter, statusFilter, selectedDateFilter]);

  // Bounded pagination: slices filteredTasks to avoid mounting thousands of DOM nodes simultaneously
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(filteredTasks.length, startIndex + pageSize);
  const paginatedTasks = useMemo(() => {
    return filteredTasks.slice(startIndex, endIndex);
  }, [filteredTasks, startIndex, endIndex]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('All');
    setPriorityFilter('All');
    setStatusFilter('All');
    setSelectedDateFilter('all');
  };

  // Overall Task Metrics (Calculated honestly from filtered data)
  const totalCount = filteredTasks.length;
  const completedCount = filteredTasks.filter((t) => t.status === 'completed').length;
  const overdueCount = filteredTasks.filter(
    (t) => t.status !== 'completed' && t.dueDate && t.dueDate < currentDate
  ).length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Categorical aggregations for Insights
  const statusCounts = useMemo(() => {
    return {
      not_started: filteredTasks.filter((t) => t.status === 'not_started').length,
      in_progress: filteredTasks.filter((t) => t.status === 'in_progress').length,
      on_hold: filteredTasks.filter((t) => t.status === 'on_hold').length,
      completed: filteredTasks.filter((t) => t.status === 'completed').length,
    };
  }, [filteredTasks]);

  const categoryCounts = useMemo(() => {
    const cats: Record<string, number> = {};
    filteredTasks.forEach((t) => {
      cats[t.category] = (cats[t.category] || 0) + 1;
    });
    return cats;
  }, [filteredTasks]);

  const priorityCounts = useMemo(() => {
    const prios: Record<string, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
      lowest: 0,
    };
    filteredTasks.forEach((t) => {
      prios[t.priority] = (prios[t.priority] || 0) + 1;
    });
    return prios;
  }, [filteredTasks]);

  const assigneeCounts = useMemo(() => {
    const assignees: Record<string, number> = {};
    filteredTasks.forEach((t) => {
      const name = t.assignedTo || 'Unassigned';
      assignees[name] = (assignees[name] || 0) + 1;
    });
    return assignees;
  }, [filteredTasks]);

  // Deadlines next 7 days based on settings.weekStartsOn (excluding archived tasks)
  const next7DaysCounts = useMemo(() => {
    const list = getWeekDaysForDate(currentDate, settings.weekStartsOn);
    return list.map((d) => {
      const count = tasks.filter(
        (t) => !t.isArchived && t.dueDate === d.dateStr && t.status !== 'completed'
      ).length;
      return {
        name: d.dayName,
        dayNum: d.dayNum,
        count,
        iso: d.dateStr,
      };
    });
  }, [tasks, currentDate, settings.weekStartsOn]);

  const priorityBadge = (priority: Priority) => {
    switch (priority) {
      case 'urgent':
        return 'badge-priority-urgent';
      case 'high':
        return 'badge-priority-high';
      case 'medium':
        return 'badge-priority-medium';
      case 'low':
        return 'badge-priority-low';
      case 'lowest':
        return 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
    }
  };

  const statusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
      case 'in_progress':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
      case 'on_hold':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
      case 'not_started':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Screen reader live announcement for task count and filters */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`Tasks list updated: ${totalCount} tasks total, ${completedCount} completed, ${overdueCount} overdue. ${selectedDateFilter !== 'all' ? `Filtered by date ${selectedDateFilter}.` : ''}`}
      </div>

      {/* Top Header & New Task button */}
      <div className="card-surface p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Tasks
          </h2>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            Stay organized and get things done.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* List / Insights Tab Switch */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-[#526782]">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                  : 'hover:text-[#071A3A] dark:hover:text-[#EDF4FF]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'insights'
                  ? 'bg-white dark:bg-[#152238] text-[#087F83] dark:text-[#38D0C5] shadow-xs'
                  : 'hover:text-[#071A3A] dark:hover:text-[#EDF4FF]'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>Insights</span>
            </button>
          </div>

          <button
            onClick={openCreateModal}
            data-testid="tasks-new-task-btn"
            className="btn-primary min-h-[44px] px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            <span>New task</span>
          </button>
        </div>
      </div>

      {/* Undo Delete Banner (LP-08) */}
      {lastDeletedTask && (
        <div
          role="status"
          aria-live="polite"
          className="p-3.5 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-between gap-4 shadow-md border border-slate-700"
        >
          <div className="text-xs">
            Deleted task <span className="font-bold">&ldquo;{lastDeletedTask.title}&rdquo;</span>.
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUndoDeleteTask}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#38D0C5] text-[#071A3A] text-xs font-bold hover:bg-[#2BB5AB] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo delete</span>
            </button>
            <button
              type="button"
              onClick={() => setLastDeletedTask(null)}
              className="px-2 py-1 rounded-lg text-slate-300 hover:text-white text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* First-Use Empty State Hero CTA */}
      {tasks.length === 0 && statusFilter !== 'Archived' && (
        <div
          data-testid="tasks-empty-hero"
          className="bg-teal-50/70 dark:bg-teal-950/30 rounded-2xl p-6 border border-teal-200 dark:border-teal-800/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs"
        >
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Create your first task
            </h3>
            <p className="text-xs sm:text-sm text-[#526782] dark:text-[#A8B8CE] max-w-xl">
              Capture what matters most today, set a due date or priority, and keep your daily focus clear.
            </p>
          </div>
          <button
            type="button"
            data-testid="tasks-empty-cta"
            onClick={openCreateModal}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create your first task</span>
          </button>
        </div>
      )}

      {/* Desktop Metric Cards Row */}
      <div className="hidden md:grid md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="text-xs text-[#526782] dark:text-[#A8B8CE] font-medium">
            Total tasks
          </div>
          <div className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
            {totalCount}
          </div>
        </div>

        <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="text-xs text-[#526782] dark:text-[#A8B8CE] font-medium">
            Completed
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {completedCount}
          </div>
        </div>

        <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="text-xs text-[#526782] dark:text-[#A8B8CE] font-medium">
            Overdue
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
            {overdueCount}
          </div>
        </div>

        <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[#526782] dark:text-[#A8B8CE] font-medium">
              Completion
            </div>
            <div className="text-2xl font-bold font-mono text-[#087F83] dark:text-[#38D0C5] mt-1">
              {completionPct}%
            </div>
          </div>
          <RingProgress
            progress={completionPct}
            size={44}
            strokeWidth={4.5}
            color="#087F83"
          />
        </div>
      </div>

      {/* Mobile Condensed Summary */}
      <div className="md:hidden bg-white dark:bg-[#152238] rounded-xl p-3 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
        <div className="grid grid-cols-4 gap-1 text-center divide-x divide-slate-100 dark:divide-slate-800">
          <div className="px-1">
            <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] font-medium">Total</div>
            <div className="text-base font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-0.5">{totalCount}</div>
          </div>
          <div className="px-1">
            <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] font-medium">Done</div>
            <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{completedCount}</div>
          </div>
          <div className="px-1">
            <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] font-medium">Overdue</div>
            <div className="text-base font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">{overdueCount}</div>
          </div>
          <div className="px-1">
            <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] font-medium">Rate</div>
            <div className="text-base font-bold font-mono text-[#087F83] dark:text-[#38D0C5] mt-0.5">{completionPct}%</div>
          </div>
        </div>
      </div>

      {/* 7-Day Week Selector Strip (No horizontal scrolling on phone width) */}
      <div className="bg-white dark:bg-[#152238] rounded-xl p-3 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Weekly dates
            </span>
            {selectedDateFilter !== 'all' && (
              <span className="text-[10px] font-semibold text-[#087F83] dark:text-[#38D0C5]">
                Filtered ({selectedDateFilter})
              </span>
            )}
          </div>
          {selectedDateFilter !== 'all' && (
            <button
              onClick={() => setSelectedDateFilter('all')}
              className="text-[11px] font-semibold text-[#087F83] dark:text-[#38D0C5] hover:underline cursor-pointer"
            >
              All dates
            </button>
          )}
        </div>

        <div className="grid grid-cols-7 gap-1 w-full text-center">
          {next7DaysCounts.map((d) => {
            const isSelected = selectedDateFilter === d.iso;
            const isToday = d.iso === currentDate;
            return (
              <button
                key={d.iso}
                type="button"
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${d.name} ${d.dayNum}, ${d.count} tasks due${isSelected ? ' (Selected)' : ''}`}
                onClick={() => setSelectedDateFilter(isSelected ? 'all' : d.iso)}
                className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg transition-all cursor-pointer min-w-0 ${
                  isSelected
                    ? 'bg-[#087F83] text-white font-bold shadow-xs'
                    : isToday
                    ? 'bg-teal-50 dark:bg-teal-950/40 text-[#087F83] dark:text-[#38D0C5] border border-teal-200 dark:border-teal-800'
                    : 'text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={`${d.name} (${d.iso})`}
              >
                <span className="text-[9px] uppercase tracking-tighter truncate w-full">{d.name}</span>
                <span className="text-xs font-semibold leading-tight">{d.dayNum}</span>
                <span
                  className={`text-[9px] px-1 rounded-full font-mono mt-0.5 ${
                    isSelected
                      ? 'bg-white/20 text-white font-bold'
                      : d.count > 0
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {d.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* List Tab View */}
      {activeTab === 'list' && (
        <div className="card-surface p-4 md:p-5 space-y-4">
          {/* Mobile Search & Filters: Single control toggle */}
          <div className="md:hidden space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-[#526782]" />
                <input
                  type="text"
                  aria-label="Search tasks"
                  placeholder="Search tasks…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input pl-9 text-xs"
                />
              </div>

              <button
                onClick={() => setIsMobileFilterOpen((prev) => !prev)}
                aria-expanded={isMobileFilterOpen}
                aria-label="Toggle task filters"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer shrink-0 ${
                  isMobileFilterOpen || activeFilterCount > 0
                    ? 'bg-teal-50 dark:bg-teal-950/50 border-[#087F83] text-[#087F83] dark:text-[#38D0C5]'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-[#526782] dark:text-[#A8B8CE]'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#087F83] text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Collapsible Mobile Filters */}
            {isMobileFilterOpen && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                  <span>Filter Options</span>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={handleClearFilters}
                      className="text-[11px] text-[#087F83] dark:text-[#38D0C5] hover:underline cursor-pointer"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    aria-label="Filter tasks by category"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  >
                    <option value="All">Category: All</option>
                    <option value="Personal">Personal</option>
                    <option value="Career">Career</option>
                    <option value="Health">Health</option>
                    <option value="Finances">Finances</option>
                    <option value="Relationships">Relationships</option>
                  </select>

                  <select
                    aria-label="Filter tasks by priority"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  >
                    <option value="All">Priority: All</option>
                    <option value="Urgent">Urgent</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                    <option value="Lowest">Lowest</option>
                  </select>

                  <select
                    aria-label="Filter tasks by status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  >
                    <option value="All">Status: All</option>
                    <option value="Not started">Not started</option>
                    <option value="In progress">In progress</option>
                    <option value="On hold">On hold</option>
                    <option value="Completed">Completed</option>
                    <option value="Archived">Archived ({archivedCount})</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Search & Filters toolbar */}
          <div className="hidden md:grid md:grid-cols-5 gap-3">
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#526782]" />
              <input
                type="text"
                aria-label="Search tasks"
                placeholder="Search tasks…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input pl-9 text-xs"
              />
            </div>

            <select
              aria-label="Filter tasks by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="form-select text-xs font-medium"
            >
              <option value="All">Category: All</option>
              <option value="Personal">Personal</option>
              <option value="Career">Career</option>
              <option value="Health">Health</option>
              <option value="Finances">Finances</option>
              <option value="Relationships">Relationships</option>
            </select>

            <select
              aria-label="Filter tasks by priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="form-select text-xs font-medium"
            >
              <option value="All">Priority: All</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Lowest">Lowest</option>
            </select>

            <select
              aria-label="Filter tasks by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select text-xs font-medium"
            >
              <option value="All">Status: All</option>
              <option value="Not started">Not started</option>
              <option value="In progress">In progress</option>
              <option value="On hold">On hold</option>
              <option value="Completed">Completed</option>
              <option value="Archived">Archived ({archivedCount})</option>
            </select>
          </div>

          {/* Quick Archived View Pill when archived tasks exist */}
          {(archivedCount > 0 || statusFilter === 'Archived') && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 text-xs">
              <div className="flex items-center gap-2 text-[#526782] dark:text-[#A8B8CE]">
                <Archive className="w-3.5 h-3.5 text-[#087F83]" />
                <span>
                  {statusFilter === 'Archived'
                    ? `Viewing ${archivedCount} archived task${archivedCount === 1 ? '' : 's'}`
                    : `${archivedCount} archived task${archivedCount === 1 ? '' : 's'} hidden from active list`}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setStatusFilter(statusFilter === 'Archived' ? 'All' : 'Archived')
                }
                className="font-semibold text-[#087F83] dark:text-[#38D0C5] hover:underline cursor-pointer"
              >
                {statusFilter === 'Archived' ? 'Back to active tasks' : 'View archived'}
              </button>
            </div>
          )}

          {/* Mobile Task Cards (All vital details visible together) */}
          <div className="md:hidden space-y-2.5">
            {filteredTasks.length === 0 ? (
              tasks.length > 0 ? (
                <FilterEmptyState
                  title="No tasks match active filters"
                  description="None of your tasks match the selected search, category, priority, or status filters."
                  onClearFilters={handleClearFilters}
                />
              ) : (
                <div className="py-8 text-center text-xs text-[#526782] dark:text-[#A8B8CE]">
                  No tasks created yet.
                </div>
              )
            ) : (
              paginatedTasks.map((task) => {
                const isOverdue =
                  task.status !== 'completed' &&
                  task.dueDate &&
                  task.dueDate < currentDate;
                return (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl bg-white dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs flex items-start gap-3 transition-colors"
                  >
                    {/* Completion Checkbox */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={task.status === 'completed'}
                      onClick={() => toggleTaskCompletion(task.id)}
                      className={`w-5 h-5 mt-0.5 rounded-md flex items-center justify-center shrink-0 cursor-pointer micro-checkbox ${
                        task.status === 'completed'
                          ? 'bg-[#087F83] text-white'
                          : 'border border-slate-300 dark:border-slate-600 hover:border-[#087F83]'
                      }`}
                      aria-label={`Mark task "${task.title}" as ${task.status === 'completed' ? 'incomplete' : 'complete'}`}
                    >
                      {task.status === 'completed' && (
                        <Check className="w-3.5 h-3.5 stroke-[3] motion-check-pop" />
                      )}
                    </button>

                    {/* Task Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`text-xs font-semibold leading-snug break-words transition-all duration-150 ${
                            task.status === 'completed'
                              ? 'line-through text-[#526782] dark:text-[#7A8FA6]'
                              : 'text-[#071A3A] dark:text-[#EDF4FF]'
                          }`}
                        >
                          {task.title}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 -mt-1 -mr-1">
                          {task.isArchived ? (
                            <button
                              type="button"
                              onClick={() => unarchiveTask(task.id)}
                              className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/50 text-[#087F83] dark:text-[#38D0C5] text-[10px] font-semibold cursor-pointer"
                              aria-label={`Restore archived task "${task.title}"`}
                              title="Restore task"
                            >
                              Restore
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(task)}
                                className="p-1 rounded-md text-[#526782] hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                aria-label={`Edit task "${task.title}"`}
                                title="Edit task"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => archiveTask(task.id)}
                                className="p-1 rounded-md text-[#526782] hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                aria-label={`Archive task "${task.title}"`}
                                title="Archive task"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteTaskWithUndo(task)}
                            className="p-1 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                            aria-label={`Delete task "${task.title}"`}
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Visible Together: Due Date, Priority, Status, Category */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                        {/* Due Date & Time */}
                        {task.dueDate ? (
                          <span
                            className={`inline-flex items-center gap-1 font-mono px-1.5 py-0.5 rounded ${
                              isOverdue
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-semibold'
                                : 'bg-slate-100 dark:bg-slate-800 text-[#526782] dark:text-[#A8B8CE]'
                            }`}
                          >
                            <Calendar className="w-2.5 h-2.5 shrink-0" />
                            <span>{task.dueDate}</span>
                            {task.dueTime && <span>· {task.dueTime}</span>}
                            {isOverdue && <span className="font-bold ml-0.5">Overdue</span>}
                          </span>
                        ) : (
                          <span className="text-[#526782] text-[10px]">No due date</span>
                        )}

                        {/* Priority Badge */}
                        <span
                          className={`capitalize ${priorityBadge(
                            task.priority
                          )}`}
                        >
                          {task.priority}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`px-1.5 py-0.5 rounded font-medium capitalize ${statusBadge(
                            task.status
                          )}`}
                        >
                          {task.status.replace('_', ' ')}
                        </span>

                        {/* Category */}
                        {task.category && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#526782] dark:text-[#A8B8CE]">
                            {task.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table of Tasks */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] dark:border-[#1E2D4A] text-[#526782] font-semibold">
                  <th className="py-3 px-3 w-8"></th>
                  <th className="py-3 px-3">Task</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Assigned</th>
                  <th className="py-3 px-3">Due date</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-4">
                      {tasks.length > 0 ? (
                        <FilterEmptyState
                          title="No tasks match active filters"
                          description="None of your tasks match the selected search, category, priority, or status filters."
                          onClearFilters={handleClearFilters}
                        />
                      ) : (
                        <div className="py-8 text-center text-xs text-[#526782] dark:text-[#A8B8CE]">
                          No tasks created yet.
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedTasks.map((task) => {
                    const isOverdue =
                      task.status !== 'completed' &&
                      task.dueDate &&
                      task.dueDate < currentDate;
                    return (
                      <tr
                        key={task.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={task.status === 'completed'}
                            aria-label={`Mark task "${task.title}" as ${task.status === 'completed' ? 'incomplete' : 'complete'}`}
                            onClick={() => toggleTaskCompletion(task.id)}
                            className={`w-4.5 h-4.5 rounded-md flex items-center justify-center cursor-pointer micro-checkbox ${
                              task.status === 'completed'
                                ? 'bg-[#087F83] text-white shadow-2xs'
                                : 'border border-slate-300 dark:border-slate-600 hover:border-[#087F83]'
                            }`}
                          >
                            {task.status === 'completed' && (
                              <Check className="w-3.5 h-3.5 stroke-[3] motion-check-pop" />
                            )}
                          </button>
                        </td>

                        <td className="py-3 px-3 font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                          <span
                            className={`transition-all duration-150 ease-out ${
                              task.status === 'completed'
                                ? 'line-through text-[#526782]'
                                : ''
                            }`}
                          >
                            {task.title}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-[#526782] dark:text-[#A8B8CE]">
                            {task.category}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-[#526782] dark:text-[#A8B8CE]">
                          {task.assignedTo || 'Unassigned'}
                        </td>

                        <td className="py-3 px-3">
                          {task.dueDate ? (
                            <div>
                              <span
                                className={`font-mono ${
                                  isOverdue
                                    ? 'text-rose-600 font-semibold'
                                    : 'text-[#526782] dark:text-[#A8B8CE]'
                                }`}
                              >
                                {task.dueDate} {task.dueTime ? `· ${task.dueTime}` : ''}
                              </span>
                              {isOverdue && (
                                <div className="text-[10px] text-rose-600 font-medium">
                                  Overdue
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#526782]">No due date</span>
                          )}
                        </td>

                        <td className="py-3 px-3 capitalize">
                          <span className={priorityBadge(task.priority)}>
                            {task.priority}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium capitalize ${statusBadge(
                              task.status
                            )}`}
                          >
                            {task.status.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {task.isArchived ? (
                              <button
                                type="button"
                                onClick={() => unarchiveTask(task.id)}
                                className="px-2 py-1 rounded-md bg-teal-50 dark:bg-teal-950/50 text-[#087F83] dark:text-[#38D0C5] text-[10px] font-semibold hover:bg-teal-100 cursor-pointer"
                                aria-label={`Restore archived task "${task.title}"`}
                                title="Restore task"
                              >
                                Restore
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(task)}
                                  className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-[#526782] cursor-pointer"
                                  aria-label={`Edit task "${task.title}"`}
                                  title="Edit task"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => archiveTask(task.id)}
                                  className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-[#526782] cursor-pointer"
                                  aria-label={`Archive task "${task.title}"`}
                                  title="Archive task"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteTaskWithUndo(task)}
                              className="p-1 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 cursor-pointer"
                              aria-label={`Delete task "${task.title}"`}
                              title="Delete task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Accessible Pagination & Bounded Navigation Controls */}
          {filteredTasks.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#E2E8F0] dark:border-[#1E2D4A] text-xs text-[#526782] dark:text-[#A8B8CE]">
              <div className="flex items-center gap-2">
                <span>
                  Showing <strong className="text-[#071A3A] dark:text-[#EDF4FF]">{startIndex + 1}</strong>–<strong className="text-[#071A3A] dark:text-[#EDF4FF]">{endIndex}</strong> of <strong className="text-[#071A3A] dark:text-[#EDF4FF]">{filteredTasks.length}</strong> tasks
                </span>
                <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
                <label className="hidden sm:flex items-center gap-1.5 text-xs">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-[#071A3A] dark:text-[#EDF4FF]"
                    aria-label="Tasks per page"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs">
                  Page <strong className="text-[#071A3A] dark:text-[#EDF4FF]">{safeCurrentPage}</strong> of <strong className="text-[#071A3A] dark:text-[#EDF4FF]">{totalPages}</strong>
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage <= 1}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    aria-label="Previous page of tasks"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    aria-label="Next page of tasks"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Insights Tab View (Board 17) */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {/* Top row donuts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Status Breakdown */}
            <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
              <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-4">
                Tasks by status
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <span>Not started</span>
                  </span>
                  <span className="font-mono font-semibold">{statusCounts.not_started}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span>In progress</span>
                  </span>
                  <span className="font-mono font-semibold">{statusCounts.in_progress}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>On hold</span>
                  </span>
                  <span className="font-mono font-semibold">{statusCounts.on_hold}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Completed</span>
                  </span>
                  <span className="font-mono font-semibold">{statusCounts.completed}</span>
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
              <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-4">
                Tasks by category
              </h3>
              <div className="space-y-2 text-xs">
                {Object.entries(categoryCounts).map(([cat, count]) => (
                  <div key={cat} className="flex justify-between items-center py-1">
                    <span className="text-[#526782] dark:text-[#A8B8CE]">{cat}</span>
                    <span className="font-mono font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority Breakdown */}
            <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
              <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-4">
                Tasks by priority
              </h3>
              <div className="space-y-2 text-xs">
                {Object.entries(priorityCounts).map(([prio, count]) => (
                  <div key={prio} className="flex justify-between items-center py-1 capitalize">
                    <span className="text-[#526782] dark:text-[#A8B8CE]">{prio}</span>
                    <span className="font-mono font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Matrix table: Outstanding Priorities by Category */}
          <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-4">
              Outstanding priorities by category
            </h3>
            <div className="overflow-x-auto">
              <table
                data-testid="tasks-accessible-insights-table"
                className="w-full text-left text-xs border-collapse"
              >
                <thead>
                  <tr className="border-b border-[#E2E8F0] dark:border-[#1E2D4A] text-[#526782]">
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
                  {['Personal', 'Career', 'Health', 'Finances', 'Relationships'].map(
                    (cat) => {
                      const openInCat = filteredTasks.filter(
                        (t) => t.category === cat && t.status !== 'completed'
                      );
                      const urgent = openInCat.filter((t) => t.priority === 'urgent').length;
                      const high = openInCat.filter((t) => t.priority === 'high').length;
                      const medium = openInCat.filter((t) => t.priority === 'medium').length;
                      const low = openInCat.filter((t) => t.priority === 'low').length;
                      const lowest = openInCat.filter((t) => t.priority === 'lowest').length;

                      return (
                        <tr key={cat}>
                          <td className="py-2.5 px-3 font-semibold">{cat}</td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {urgent || '–'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {high || '–'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {medium || '–'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {low || '–'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {lowest || '–'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {openInCat.length}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom row: Deadlines next 7 days & Overdue tasks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deadlines Next 7 Days */}
            <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
              <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-4">
                Upcoming deadlines (next 7 days)
              </h3>
              <div className="flex items-end justify-between h-32 pt-6">
                {next7DaysCounts.map((d) => (
                  <div key={d.iso} className="flex flex-col items-center gap-1.5 flex-1">
                    <span className="text-xs font-mono font-bold text-[#087F83]">
                      {d.count}
                    </span>
                    <div
                      className="w-5 bg-teal-100 dark:bg-teal-900/60 rounded-t-md transition-all"
                      style={{ height: `${Math.max(6, d.count * 28)}px` }}
                    />
                    <span className="text-[10px] text-[#526782]">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Overdue tasks */}
            <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
              <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-3">
                Overdue tasks
              </h3>
              <div className="space-y-2">
                {filteredTasks
                  .filter((t) => t.status !== 'completed' && t.dueDate && t.dueDate < currentDate)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40"
                    >
                      <div>
                        <div className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                          {t.title}
                        </div>
                        <div className="text-[10px] text-rose-600">
                          Due {t.dueDate}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleTaskCompletion(t.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-semibold hover:bg-rose-700 cursor-pointer"
                        aria-label={`Complete overdue task "${t.title}"`}
                      >
                        Complete
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Task Contextual Detail Panel */}
      <ContextualDetailPanel
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTask ? 'Edit task' : 'Create a new task'}
        subtitle="Add details to keep your work and personal tasks on track"
        dataTestId="task-detail-panel"
      >
        <form onSubmit={handleSaveTask} noValidate className="space-y-4">
          {modalTitleError && (
            <div
              role="alert"
              data-testid="task-modal-title-error"
              className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{modalTitleError}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="task-modal-title"
              className="form-label"
            >
              Task title *
            </label>
            <input
              id="task-modal-title"
              type="text"
              required
              aria-invalid={Boolean(modalTitleError)}
              value={modalTitle}
              onChange={(e) => {
                setModalTitle(e.target.value);
                if (modalTitleError && e.target.value.trim()) {
                  setModalTitleError('');
                }
              }}
              placeholder="e.g. Renew car insurance"
              className={`form-input text-xs ${modalTitleError ? 'border-rose-500 focus:ring-rose-500' : ''}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="task-modal-category"
                className="form-label"
              >
                Category
              </label>
              <select
                id="task-modal-category"
                value={modalCategory}
                onChange={(e) => setModalCategory(e.target.value)}
                className="form-select text-xs font-medium"
              >
                <option value="Personal">Personal</option>
                <option value="Career">Career</option>
                <option value="Health">Health</option>
                <option value="Finances">Finances</option>
                <option value="Relationships">Relationships</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="task-modal-assigned"
                className="form-label"
              >
                Assign to
              </label>
              <input
                id="task-modal-assigned"
                type="text"
                value={modalAssigned}
                onChange={(e) => setModalAssigned(e.target.value)}
                placeholder={defaultOwner}
                className="form-input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="task-modal-due-date"
                className="form-label"
              >
                Due date
              </label>
              <input
                id="task-modal-due-date"
                type="date"
                value={modalDueDate}
                onChange={(e) => setModalDueDate(e.target.value)}
                className="form-input text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="task-modal-due-time"
                className="form-label"
              >
                Due time (optional)
              </label>
              <input
                id="task-modal-due-time"
                type="time"
                value={modalDueTime}
                onChange={(e) => setModalDueTime(e.target.value)}
                className="form-input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="task-modal-priority"
                className="form-label"
              >
                Priority
              </label>
              <select
                id="task-modal-priority"
                value={modalPriority}
                onChange={(e) => setModalPriority(e.target.value as Priority)}
                className="form-select text-xs font-medium"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="lowest">Lowest</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="task-modal-status"
                className="form-label"
              >
                Status
              </label>
              <select
                id="task-modal-status"
                value={modalStatus}
                onChange={(e) => setModalStatus(e.target.value as TaskStatus)}
                className="form-select text-xs font-medium"
              >
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="on_hold">On hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="task-modal-description"
              className="form-label"
            >
              Description (optional)
            </label>
            <textarea
              id="task-modal-description"
              rows={2}
              value={modalDescription}
              onChange={(e) => setModalDescription(e.target.value)}
              placeholder="Write a short description…"
              className="form-textarea text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn-secondary min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="task-modal-submit-btn"
              className="btn-primary min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold"
            >
              {editingTask ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </form>
      </ContextualDetailPanel>
    </div>
  );
};
