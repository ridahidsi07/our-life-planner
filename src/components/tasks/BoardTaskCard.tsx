import React, { useState, useRef, useEffect } from 'react';
import { TaskItem, TaskStatus, Priority } from '../../types/planner';
import {
  Calendar,
  Clock,
  MoreHorizontal,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  Flag,
  ArrowRightCircle,
  CheckCircle2,
} from 'lucide-react';

interface BoardTaskCardProps {
  task: TaskItem;
  currentDate: string;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, task: TaskItem) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onOpenEdit: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
  onArchive: (taskId: string) => void;
  onUnarchive: (taskId: string) => void;
}

export const BoardTaskCard: React.FC<BoardTaskCardProps> = ({
  task,
  currentDate,
  isDragging,
  onDragStart,
  onDragEnd,
  onStatusChange,
  onOpenEdit,
  onDelete,
  onArchive,
  onUnarchive,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close menu on outside click or Escape
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const isOverdue =
    task.status !== 'completed' &&
    Boolean(task.dueDate) &&
    task.dueDate! < currentDate;

  const isDueToday = task.dueDate === currentDate;

  const getInitials = (name?: string) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getCategoryClass = (category?: string) => {
    switch (category) {
      case 'Personal':
        return 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200/60 dark:border-teal-800/50';
      case 'Career':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/50';
      case 'Health':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/50';
      case 'Finances':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/50';
      case 'Relationships':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/50';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/50';
    }
  };

  const getPriorityBadge = (priority: Priority) => {
    switch (priority) {
      case 'urgent':
        return {
          label: 'Urgent',
          cls: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-200/60',
          flagCls: 'text-rose-600',
        };
      case 'high':
        return {
          label: 'High',
          cls: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200/60',
          flagCls: 'text-amber-600',
        };
      case 'medium':
        return {
          label: 'Medium',
          cls: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200/60',
          flagCls: 'text-slate-500',
        };
      case 'low':
      case 'lowest':
        return {
          label: priority === 'lowest' ? 'Lowest' : 'Low',
          cls: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 border-slate-200/60',
          flagCls: 'text-slate-400',
        };
    }
  };

  const prioInfo = getPriorityBadge(task.priority);

  // When dragging, this card in the source column acts as a placeholder
  if (isDragging) {
    return (
      <div
        data-task-id={task.id}
        className="opacity-40 border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/40 rounded-xl p-3.5 min-h-[96px] select-none pointer-events-none transition-all"
        aria-hidden="true"
      >
        <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 truncate">
          {task.title}
        </div>
      </div>
    );
  }

  const allStatuses: { id: TaskStatus; label: string }[] = [
    { id: 'not_started', label: 'Not started' },
    { id: 'in_progress', label: 'In progress' },
    { id: 'on_hold', label: 'On hold' },
    { id: 'completed', label: 'Completed' },
  ];

  return (
    <div
      data-task-id={task.id}
      data-testid={`board-task-card-${task.id}`}
      draggable={!task.isArchived}
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      className="bg-white dark:bg-[#152238] rounded-xl p-3.5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing group relative focus-within:ring-2 focus-within:ring-[var(--accent)]"
    >
      {/* Top Row: Category tag, Priority badge, and Overflow action menu */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {task.category && (
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getCategoryClass(
                task.category
              )}`}
            >
              {task.category}
            </span>
          )}

          <span
            className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${prioInfo.cls}`}
          >
            <Flag className={`w-2.5 h-2.5 ${prioInfo.flagCls}`} />
            <span>{prioInfo.label}</span>
          </span>
        </div>

        {/* Overflow Menu Trigger */}
        <div className="relative shrink-0">
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-label={`Options for task "${task.title}"`}
            data-testid={`task-menu-btn-${task.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen((prev) => !prev);
            }}
            className="p-1 rounded-md text-[#526782] dark:text-[#A8B8CE] hover:text-[#071A3A] dark:hover:text-[#EDF4FF] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* Action Menu Dropdown */}
          {isMenuOpen && (
            <div
              ref={menuRef}
              role="menu"
              aria-label={`Actions for "${task.title}"`}
              className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#1A2A47] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-40 text-xs"
            >
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#526782] dark:text-[#8A99AD]">
                Move to stage
              </div>
              {allStatuses.map((st) => {
                const isCurrent = task.status === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    role="menuitem"
                    disabled={isCurrent}
                    onClick={() => {
                      onStatusChange(task.id, st.id);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${
                      isCurrent
                        ? 'text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-800/40 cursor-default'
                        : 'text-[#071A3A] dark:text-[#EDF4FF] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)]'
                    }`}
                  >
                    <span>{st.label}</span>
                    {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                );
              })}

              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenEdit(task);
                }}
                className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-[#071A3A] dark:text-[#EDF4FF] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#526782]" />
                <span>Edit details</span>
              </button>

              {task.isArchived ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onUnarchive(task.id);
                  }}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-[var(--accent)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore task</span>
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onArchive(task.id);
                  }}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive task</span>
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  onDelete(task);
                }}
                className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete task</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Task Title (Primary element leading the card hierarchy) */}
      <h4
        className={`font-semibold text-xs sm:text-sm text-[#071A3A] dark:text-[#EDF4FF] leading-snug break-words transition-all line-clamp-2 ${
          task.status === 'completed'
            ? 'line-through text-[#526782] dark:text-[#7A8FA6]'
            : ''
        }`}
      >
        {task.title}
      </h4>

      {/* Description Preview (Restrained, quiet snippet if available) */}
      {task.description && (
        <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE] line-clamp-2 mt-1 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Bottom Row: Due date badge & Assignee Initials Avatar */}
      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-[10px]">
        {/* Due date */}
        {task.dueDate ? (
          <span
            className={`inline-flex items-center gap-1 font-mono px-2 py-0.5 rounded-md ${
              isOverdue
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-semibold border border-rose-200/60 dark:border-rose-900/60'
                : isDueToday
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-medium border border-amber-200/60 dark:border-amber-900/60'
                : 'bg-slate-100 dark:bg-slate-800 text-[#526782] dark:text-[#A8B8CE] border border-slate-200/50 dark:border-slate-700/50'
            }`}
          >
            <Clock className="w-2.5 h-2.5 shrink-0" />
            <span>
              {isDueToday ? 'Today' : task.dueDate}
              {task.dueTime ? ` · ${task.dueTime}` : ''}
            </span>
            {isOverdue && <span className="font-bold ml-0.5">· Overdue</span>}
          </span>
        ) : (
          <span className="text-[#8A99AD] text-[10px]">No due date</span>
        )}

        {/* Member Initials Avatar */}
        {task.assignedTo && (
          <div
            className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[#071A3A] dark:text-[#EDF4FF] border border-slate-200 dark:border-slate-700 text-[9px] font-bold flex items-center justify-center shrink-0 cursor-default select-none shadow-2xs"
            title={`Assigned to ${task.assignedTo}`}
            aria-label={`Assigned to ${task.assignedTo}`}
          >
            {getInitials(task.assignedTo)}
          </div>
        )}
      </div>
    </div>
  );
};
