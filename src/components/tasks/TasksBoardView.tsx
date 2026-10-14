import React, { useState, useEffect } from 'react';
import { TaskItem, TaskStatus } from '../../types/planner';
import { BoardTaskCard } from './BoardTaskCard';
import { FilterEmptyState } from '../ui/FilterEmptyState';
import { Plus, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export interface BoardColumnDef {
  id: TaskStatus;
  label: string;
  dotColor: string;
  badgeBg: string;
  description: string;
}

export const BOARD_COLUMNS: BoardColumnDef[] = [
  {
    id: 'not_started',
    label: 'Not started',
    dotColor: 'bg-slate-400 dark:bg-slate-500',
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    description: 'Upcoming tasks queued for action',
  },
  {
    id: 'in_progress',
    label: 'In progress',
    dotColor: 'bg-amber-500',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
    description: 'Tasks currently actively worked on',
  },
  {
    id: 'on_hold',
    label: 'On hold',
    dotColor: 'bg-blue-500',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300',
    description: 'Paused or waiting on input/external review',
  },
  {
    id: 'completed',
    label: 'Completed',
    dotColor: 'bg-emerald-500',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
    description: 'Finished commitments',
  },
];

interface TasksBoardViewProps {
  tasks: TaskItem[];
  allTasksCount: number;
  currentDate: string;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onOpenEdit: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
  onArchive: (taskId: string) => void;
  onUnarchive: (taskId: string) => void;
  onCreateInStatus: (status: TaskStatus) => void;
  onClearFilters: () => void;
}

export const TasksBoardView: React.FC<TasksBoardViewProps> = ({
  tasks,
  allTasksCount,
  currentDate,
  onStatusChange,
  onOpenEdit,
  onDelete,
  onArchive,
  onUnarchive,
  onCreateInStatus,
  onClearFilters,
}) => {
  // Drag and Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');

  // Mobile selected column view ('all' or specific status)
  const [mobileSelectedColumn, setMobileSelectedColumn] = useState<TaskStatus>('not_started');

  // Cancel drag on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && draggedTaskId) {
        setDraggedTaskId(null);
        setDragOverColumn(null);
        setLiveAnnouncement('Drag operation cancelled.');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draggedTaskId]);

  const handleDragStart = (e: React.DragEvent, task: TaskItem) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(task.id);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleColumnDragEnter = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleColumnDragLeave = (e: React.DragEvent, status: TaskStatus) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverColumn === status) {
      setDragOverColumn(null);
    }
  };

  const handleColumnDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);
    setDragOverColumn(null);

    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (task.status !== targetStatus) {
      onStatusChange(taskId, targetStatus);
      const targetColDef = BOARD_COLUMNS.find((c) => c.id === targetStatus);
      setLiveAnnouncement(
        `Moved task "${task.title}" to ${targetColDef?.label || targetStatus}.`
      );
    }
  };

  const handleAccessibleStatusChange = (taskId: string, targetStatus: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    onStatusChange(taskId, targetStatus);
    const targetColDef = BOARD_COLUMNS.find((c) => c.id === targetStatus);
    setLiveAnnouncement(
      `Moved task "${task.title}" to ${targetColDef?.label || targetStatus}.`
    );
  };

  // Group tasks by status
  const tasksByStatus: Record<TaskStatus, TaskItem[]> = {
    not_started: tasks.filter((t) => t.status === 'not_started'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    on_hold: tasks.filter((t) => t.status === 'on_hold'),
    completed: tasks.filter((t) => t.status === 'completed'),
  };

  if (tasks.length === 0 && allTasksCount > 0) {
    return (
      <div className="card-surface p-6">
        <FilterEmptyState
          title="No tasks match active filters"
          description="None of your tasks match the selected search, category, priority, or status filters."
          onClearFilters={onClearFilters}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live announcement region for accessibility */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveAnnouncement}
      </div>

      {/* Mobile Column Switcher (Visible on small screens < 768px) */}
      <div className="md:hidden">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto no-scrollbar">
          {BOARD_COLUMNS.map((col) => {
            const isSelected = mobileSelectedColumn === col.id;
            const count = tasksByStatus[col.id].length;
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => setMobileSelectedColumn(col.id)}
                className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white dark:bg-[#152238] text-[#071A3A] dark:text-[#EDF4FF] shadow-xs'
                    : 'text-[#526782] dark:text-[#A8B8CE] hover:text-[#071A3A]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                <span className="truncate">{col.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-slate-700/80 font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Responsive Columns Grid (4 columns on desktop, 2 on tablet, 1 on mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {BOARD_COLUMNS.map((column) => {
          const columnTasks = tasksByStatus[column.id];
          const isOver = dragOverColumn === column.id;
          const isHiddenOnMobile = mobileSelectedColumn !== column.id;

          return (
            <div
              key={column.id}
              data-testid={`board-column-${column.id}`}
              role="region"
              aria-label={`${column.label} stage, ${columnTasks.length} tasks`}
              className={`flex flex-col rounded-2xl bg-slate-100/70 dark:bg-slate-900/40 border transition-all duration-150 ${
                isOver
                  ? 'border-[#087F83] ring-2 ring-[#087F83]/30 bg-teal-50/50 dark:bg-teal-950/20'
                  : 'border-slate-200/60 dark:border-slate-800/60'
              } ${isHiddenOnMobile ? 'hidden md:flex' : 'flex'}`}
              onDragOver={handleColumnDragOver}
              onDragEnter={(e) => handleColumnDragEnter(e, column.id)}
              onDragLeave={(e) => handleColumnDragLeave(e, column.id)}
              onDrop={(e) => handleColumnDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="p-3.5 flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/60">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${column.dotColor}`} />
                  <h3 className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] truncate">
                    {column.label}
                  </h3>
                  <span
                    data-testid={`board-count-${column.id}`}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold shrink-0 ${column.badgeBg}`}
                  >
                    {columnTasks.length}
                  </span>
                </div>

                {/* Add task in this status button */}
                <button
                  type="button"
                  onClick={() => onCreateInStatus(column.id)}
                  aria-label={`Add task to ${column.label}`}
                  title={`Add task to ${column.label}`}
                  className="p-1 rounded-lg text-[#526782] dark:text-[#A8B8CE] hover:text-[#087F83] dark:hover:text-[#38D0C5] hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Column Body / Cards Container */}
              <div
                className="p-2.5 space-y-2.5 min-h-[360px] flex-1 overflow-y-auto"
                data-testid={`board-dropzone-${column.id}`}
              >
                {columnTasks.length === 0 ? (
                  <div
                    className={`h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-4 text-center transition-colors ${
                      isOver
                        ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20 text-[#087F83]'
                        : 'border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <p className="text-xs font-medium">No tasks</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {isOver ? 'Drop card to move here' : 'Drag cards here or click +'}
                    </p>
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <BoardTaskCard
                      key={task.id}
                      task={task}
                      currentDate={currentDate}
                      isDragging={draggedTaskId === task.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onStatusChange={handleAccessibleStatusChange}
                      onOpenEdit={onOpenEdit}
                      onDelete={onDelete}
                      onArchive={onArchive}
                      onUnarchive={onUnarchive}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
