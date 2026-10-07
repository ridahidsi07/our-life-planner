import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import {
  Inbox as InboxIcon,
  Plus,
  ArrowRight,
  Check,
  Trash2,
  X,
  CheckSquare,
} from 'lucide-react';
import { BrainDumpItem, Priority, TaskStatus } from '../../types/planner';

export const InboxView: React.FC = () => {
  const {
    inbox,
    addInboxItem,
    deleteInboxItem,
    convertInboxToTask,
    currentDate,
  } = usePlanner();

  const [inputText, setInputText] = useState('');
  const [convertingItem, setConvertingItem] = useState<BrainDumpItem | null>(null);

  // Conversion form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState('Personal');
  const [taskAssigned, setTaskAssigned] = useState('Rida');
  const [taskDueDate, setTaskDueDate] = useState(currentDate);
  const [taskDueTime, setTaskDueTime] = useState('');
  const [taskPriority, setTaskPriority] = useState<Priority>('medium');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('not_started');

  const handleAddThought = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    addInboxItem(inputText.trim());
    setInputText('');
  };

  const startConversion = (item: BrainDumpItem) => {
    setConvertingItem(item);
    setTaskTitle(item.text);
    setTaskCategory('Personal');
    setTaskAssigned('Rida');
    setTaskDueDate(currentDate);
    setTaskDueTime('');
    setTaskPriority('medium');
    setTaskStatus('not_started');
  };

  const handleConfirmConversion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingItem || !taskTitle.trim()) return;

    // Convert into task and remove from inbox only upon successful call
    convertInboxToTask(convertingItem.id, {
      title: taskTitle.trim(),
      category: taskCategory,
      assignedTo: taskAssigned,
      dueDate: taskDueDate || undefined,
      dueTime: taskDueTime || undefined,
      priority: taskPriority,
      status: taskStatus,
    });

    setConvertingItem(null);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
        <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
          Inbox — Capture and Organize Thoughts
        </h2>
        <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
          Jot down ideas freely and convert them into scheduled tasks when ready.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Capture Textarea & Thoughts List (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Capture Card */}
          <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
            <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Clear your mind.
            </h3>
            <p className="text-xs text-[#526782] dark:text-[#A8B8CE] mb-3">
              Jot down anything on your mind — ideas, reminders, things to look into.
            </p>

            <form onSubmit={handleAddThought} className="space-y-3">
              <textarea
                rows={3}
                maxLength={500}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full p-3.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-slate-50 dark:bg-slate-800 text-xs text-[#071A3A] dark:text-[#EDF4FF] focus:ring-2 focus:ring-[#087F83] focus:outline-none"
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                  {inputText.length}/500
                </span>
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="px-4 py-2 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Add to inbox
                </button>
              </div>
            </form>
          </div>

          {/* Thoughts List */}
          <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A] mb-3">
              <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                {inbox.length} thoughts
              </h3>
              <span className="text-xs text-[#526782]">Newest first</span>
            </div>

            <div className="space-y-2.5">
              {inbox.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#526782]">
                  Your inbox is clear. Add any thought or reminder above!
                </div>
              ) : (
                inbox.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                      convertingItem?.id === item.id
                        ? 'border-[#087F83] bg-teal-50/50 dark:bg-teal-950/20'
                        : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-2 h-2 rounded-full bg-[#087F83] shrink-0" />
                      <span className="text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF] truncate">
                        {item.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => startConversion(item)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-[#087F83] dark:text-[#38D0C5] text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Convert to task</span>
                      </button>
                      <button
                        onClick={() => deleteInboxItem(item.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-500 transition-colors"
                        title="Delete thought"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Turn into a Task Panel (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A] mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  Turn into a task
                </h3>
                <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                  The thought stays in your inbox until the task is saved.
                </p>
              </div>
              {convertingItem && (
                <button
                  onClick={() => setConvertingItem(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-[#526782]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {convertingItem ? (
              <form onSubmit={handleConfirmConversion} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs focus:ring-2 focus:ring-[#087F83]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                      Category
                    </label>
                    <select
                      value={taskCategory}
                      onChange={(e) => setTaskCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
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
                      Assigned to
                    </label>
                    <input
                      type="text"
                      value={taskAssigned}
                      onChange={(e) => setTaskAssigned(e.target.value)}
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
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                      Time (optional)
                    </label>
                    <input
                      type="time"
                      value={taskDueTime}
                      onChange={(e) => setTaskDueTime(e.target.value)}
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
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as Priority)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                      Status
                    </label>
                    <select
                      value={taskStatus}
                      onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
                    >
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="on_hold">On hold</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConvertingItem(null)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A]"
                  >
                    Create task
                  </button>
                </div>
              </form>
            ) : (
              <div className="py-12 text-center text-xs text-[#526782] space-y-2">
                <CheckSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p>Select any thought from the list to convert it into a structured task.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
