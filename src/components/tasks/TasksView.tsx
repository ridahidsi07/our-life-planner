import React, { useState, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { RingProgress } from '../ui/RingProgress';
import { Modal } from '../ui/Modal';
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
} from 'lucide-react';
import { TaskItem, Priority, TaskStatus } from '../../types/planner';

export const TasksView: React.FC = () => {
  const {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    currentDate,
  } = usePlanner();

  const [activeTab, setActiveTab] = useState<'list' | 'insights'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [assignedFilter, setAssignedFilter] = useState('Anyone');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Task Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalCategory, setModalCategory] = useState('Personal');
  const [modalAssigned, setModalAssigned] = useState('Rida');
  const [modalDueDate, setModalDueDate] = useState('');
  const [modalDueTime, setModalDueTime] = useState('');
  const [modalPriority, setModalPriority] = useState<Priority>('medium');
  const [modalStatus, setModalStatus] = useState<TaskStatus>('not_started');
  const [modalDescription, setModalDescription] = useState('');

  const openCreateModal = () => {
    setEditingTask(null);
    setModalTitle('');
    setModalCategory('Personal');
    setModalAssigned('Rida');
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
    setModalCategory(task.category);
    setModalAssigned(task.assignedTo);
    setModalDueDate(task.dueDate || '');
    setModalDueTime(task.dueTime || '');
    setModalPriority(task.priority);
    setModalStatus(task.status);
    setModalDescription(task.description || '');
    setIsModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) return;

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

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
      if (assignedFilter !== 'Anyone' && t.assignedTo !== assignedFilter) return false;
      if (priorityFilter !== 'All' && t.priority !== priorityFilter.toLowerCase()) return false;
      if (statusFilter !== 'All' && t.status !== statusFilter.toLowerCase().replace(' ', '_')) {
        return false;
      }
      return true;
    });
  }, [tasks, searchQuery, categoryFilter, assignedFilter, priorityFilter, statusFilter]);

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

  // Deadlines next 7 days
  const next7DaysCounts = useMemo(() => {
    const cur = new Date(currentDate);
    const day = cur.getDay();
    const diff = cur.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(cur.setDate(diff));

    const days = [];
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const count = filteredTasks.filter(
        (t) => t.dueDate === iso && t.status !== 'completed'
      ).length;
      days.push({ name: names[i], dayNum: d.getDate(), count, iso });
    }
    return days;
  }, [filteredTasks, currentDate]);

  const priorityBadge = (priority: Priority) => {
    switch (priority) {
      case 'urgent':
        return 'text-rose-600 dark:text-rose-400 font-semibold';
      case 'high':
        return 'text-orange-600 dark:text-orange-400 font-medium';
      case 'medium':
        return 'text-amber-600 dark:text-amber-400 font-medium';
      case 'low':
        return 'text-blue-600 dark:text-blue-400 font-medium';
      case 'lowest':
        return 'text-slate-500 font-normal';
    }
  };

  const statusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
      case 'in_progress':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300';
      case 'on_hold':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';
      case 'not_started':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header & New Task button */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
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
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New task</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* List Tab View */}
      {activeTab === 'list' && (
        <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-4">
          {/* Search & Filters toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#526782]" />
              <input
                type="text"
                placeholder="Search tasks…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-[#087F83]"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
            >
              <option value="All">Category: All</option>
              <option value="Personal">Personal</option>
              <option value="Career">Career</option>
              <option value="Health">Health</option>
              <option value="Finances">Finances</option>
              <option value="Relationships">Relationships</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
            >
              <option value="All">Priority: All</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Lowest">Lowest</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
            >
              <option value="All">Status: All</option>
              <option value="Not started">Not started</option>
              <option value="In progress">In progress</option>
              <option value="On hold">On hold</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          {/* Table of Tasks */}
          <div className="overflow-x-auto">
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
                    <td colSpan={8} className="py-8 text-center text-[#526782]">
                      No tasks found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
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
                            onClick={() => toggleTaskCompletion(task.id)}
                            className={`w-4.5 h-4.5 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
                              task.status === 'completed'
                                ? 'bg-[#087F83] text-white'
                                : 'border border-slate-300 dark:border-slate-600 hover:border-[#087F83]'
                            }`}
                          >
                            {task.status === 'completed' && (
                              <Check className="w-3 h-3 stroke-[3]" />
                            )}
                          </button>
                        </td>

                        <td className="py-3 px-3 font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                          <span
                            className={
                              task.status === 'completed'
                                ? 'line-through text-[#526782]'
                                : ''
                            }
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
                            <button
                              onClick={() => openEditModal(task)}
                              className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-[#526782]"
                              title="Edit task"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="p-1 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600"
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
              <table className="w-full text-left text-xs border-collapse">
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
                        onClick={() => toggleTaskCompletion(t.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-semibold hover:bg-rose-700"
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

      {/* Create / Edit Task Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTask ? 'Edit task' : 'Create a new task'}
        subtitle="Add details to keep your work and personal tasks on track"
      >
        <form onSubmit={handleSaveTask} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Task title *
            </label>
            <input
              type="text"
              required
              value={modalTitle}
              onChange={(e) => setModalTitle(e.target.value)}
              placeholder="e.g. Renew car insurance"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs focus:ring-2 focus:ring-[#087F83]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Category
              </label>
              <select
                value={modalCategory}
                onChange={(e) => setModalCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
              >
                <option value="Personal">Personal</option>
                <option value="Career">Career</option>
                <option value="Health">Health</option>
                <option value="Finances">Finances</option>
                <option value="Relationships">Relationships</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Assign to
              </label>
              <input
                type="text"
                value={modalAssigned}
                onChange={(e) => setModalAssigned(e.target.value)}
                placeholder="Rida"
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Due date
              </label>
              <input
                type="date"
                value={modalDueDate}
                onChange={(e) => setModalDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Due time (optional)
              </label>
              <input
                type="time"
                value={modalDueTime}
                onChange={(e) => setModalDueTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Priority
              </label>
              <select
                value={modalPriority}
                onChange={(e) => setModalPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="lowest">Lowest</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Status
              </label>
              <select
                value={modalStatus}
                onChange={(e) => setModalStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
              >
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="on_hold">On hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Description (optional)
            </label>
            <textarea
              rows={2}
              value={modalDescription}
              onChange={(e) => setModalDescription(e.target.value)}
              placeholder="Write a short description…"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782] hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A]"
            >
              {editingTask ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
