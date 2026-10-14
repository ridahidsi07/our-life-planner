import React, { useState, useEffect } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import {
  CheckSquare,
  DollarSign,
  Dumbbell,
  Scale,
  Droplet,
  Inbox,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { convertLbToKg, convertKgToLb } from '../../utils/calculations';

export const QuickAddModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    activeView,
    addTask,
    addTransaction,
    addWorkoutSession,
    addWeightRecord,
    addWaterLog,
    addInboxItem,
    setLastCreationFeedback,
    setHighlightedTaskId,
    selectedProfileId,
    currentDate,
    settings,
  } = usePlanner();

  const isModalOpen = Boolean(
    activeModal && (activeModal === 'quick_add' || activeModal.startsWith('quick_add:'))
  );

  const [activeTab, setActiveTab] = useState<
    'task' | 'expense' | 'workout' | 'weight' | 'water' | 'thought'
  >('task');

  // Progressive disclosure for Task
  const [isTaskOptionsOpen, setIsTaskOptionsOpen] = useState(false);

  // Form states
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState('Personal');
  const [taskPriority, setTaskPriority] = useState<'urgent' | 'high' | 'medium' | 'low' | 'lowest'>('medium');
  const [taskDueDate, setTaskDueDate] = useState(() => currentDate);
  const [taskDueTime, setTaskDueTime] = useState('');
  const [taskAssignee, setTaskAssignee] = useState(() => settings.ownerName || 'Me');

  const [expenseAmount, setExpenseAmount] = useState<number | string>(25);
  const [expenseCategory, setExpenseCategory] = useState('Food');
  const [expenseNote, setExpenseNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => currentDate);

  const [workoutTitle, setWorkoutTitle] = useState('Quick workout');
  const [workoutDuration, setWorkoutDuration] = useState<number>(30);
  const [workoutMuscle, setWorkoutMuscle] = useState('Full body');

  const [modalWeightUnit, setModalWeightUnit] = useState<'kg' | 'lb'>(() => settings.weightUnit || 'kg');
  const [weightValue, setWeightValue] = useState<number | string>(() =>
    (settings.weightUnit || 'kg') === 'lb' ? 158.7 : 72.0
  );
  const [weightDate, setWeightDate] = useState(() => currentDate);
  const [weightTime, setWeightTime] = useState('08:00');

  const [waterAmount, setWaterAmount] = useState<number>(250);

  const [thoughtText, setThoughtText] = useState('');

  // UI state
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Contextual initial tab mapping when opening
  useEffect(() => {
    if (!isModalOpen) return;

    if (activeModal && activeModal.startsWith('quick_add:')) {
      const requested = activeModal.split(':')[1] as any;
      if (['task', 'expense', 'workout', 'weight', 'water', 'thought'].includes(requested)) {
        setActiveTab(requested);
        setValidationError(null);
        return;
      }
    }

    if (activeModal === 'quick_add') {
      if (['budget', 'savings', 'debts'].includes(activeView)) {
        setActiveTab('expense');
      } else if (activeView === 'workouts') {
        setActiveTab('workout');
      } else if (activeView === 'weight') {
        setActiveTab('weight');
      } else if (activeView === 'water') {
        setActiveTab('water');
      } else if (activeView === 'inbox') {
        setActiveTab('thought');
      } else {
        setActiveTab('task');
      }
      setValidationError(null);
    }
  }, [activeModal, activeView, isModalOpen]);

  const handleModalWeightUnitChange = (newUnit: 'kg' | 'lb') => {
    if (newUnit === modalWeightUnit) return;
    const num = typeof weightValue === 'number' ? weightValue : parseFloat(weightValue);
    if (num && num > 0) {
      if (newUnit === 'lb') {
        setWeightValue(Math.round(convertKgToLb(num) * 10) / 10);
      } else {
        setWeightValue(Math.round(convertLbToKg(num) * 10) / 10);
      }
    }
    setModalWeightUnit(newUnit);
  };

  const handleTabChange = (newTab: 'task' | 'expense' | 'workout' | 'weight' | 'water' | 'thought') => {
    setActiveTab(newTab);
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    try {
      if (activeTab === 'task') {
        if (!taskTitle.trim()) {
          setValidationError('Please enter a task title.');
          return;
        }

        setIsSubmitting(true);
        const newTaskId = addTask({
          title: taskTitle.trim(),
          category: taskCategory,
          assignedTo: taskAssignee.trim() || settings.ownerName || 'Me',
          dueDate: taskDueDate || currentDate,
          dueTime: taskDueTime ? taskDueTime : undefined,
          priority: taskPriority,
          status: 'not_started',
        });

        setLastCreationFeedback({
          id: newTaskId,
          type: 'task',
          title: taskTitle.trim(),
          category: taskCategory,
          dueDate: taskDueDate || currentDate,
          priority: taskPriority,
          status: 'not_started',
          createdAt: Date.now(),
        });
        setHighlightedTaskId(newTaskId);
        setTaskTitle('');
        setIsTaskOptionsOpen(false);
      } else if (activeTab === 'expense') {
        const numAmount = typeof expenseAmount === 'number' ? expenseAmount : parseFloat(expenseAmount);
        if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
          setValidationError('Please enter an amount greater than 0.');
          return;
        }

        setIsSubmitting(true);
        const newTxId = addTransaction({
          type: 'expense',
          amount: Math.round(numAmount * 100) / 100,
          category: expenseCategory,
          date: expenseDate || currentDate,
          note: expenseNote.trim() || undefined,
        });

        setLastCreationFeedback({
          id: newTxId,
          type: 'expense',
          title: `${settings.currencySymbol || '$'}${numAmount.toFixed(2)} (${expenseCategory})`,
          createdAt: Date.now(),
        });
        setExpenseNote('');
      } else if (activeTab === 'workout') {
        if (!workoutTitle.trim()) {
          setValidationError('Please enter a workout title.');
          return;
        }

        setIsSubmitting(true);
        const newWorkoutId = addWorkoutSession({
          title: workoutTitle.trim(),
          date: currentDate,
          durationMinutes: workoutDuration > 0 ? workoutDuration : 30,
          muscleGroups: [workoutMuscle],
          exercises: [],
          isCompleted: true,
        });

        setLastCreationFeedback({
          id: newWorkoutId,
          type: 'workout',
          title: workoutTitle.trim(),
          createdAt: Date.now(),
        });
        setWorkoutTitle('Quick workout');
      } else if (activeTab === 'weight') {
        const numWeight = typeof weightValue === 'number' ? weightValue : parseFloat(weightValue as string);
        if (!numWeight || isNaN(numWeight) || numWeight <= 0) {
          setValidationError('Please enter a valid weight.');
          return;
        }

        setIsSubmitting(true);
        const canonicalKg =
          modalWeightUnit === 'lb'
            ? Math.round(convertLbToKg(numWeight) * 10) / 10
            : Math.round(numWeight * 10) / 10;

        const newRecordId = addWeightRecord({
          profileId: selectedProfileId,
          date: weightDate || currentDate,
          time: weightTime || '08:00',
          weightKg: canonicalKg,
        });

        setLastCreationFeedback({
          id: newRecordId,
          type: 'weight',
          title: `${numWeight} ${modalWeightUnit}`,
          createdAt: Date.now(),
        });
      } else if (activeTab === 'water') {
        if (!waterAmount || waterAmount <= 0) {
          setValidationError('Please enter an amount of water to log.');
          return;
        }

        setIsSubmitting(true);
        const newWaterId = addWaterLog(waterAmount, '12:00');

        setLastCreationFeedback({
          id: newWaterId,
          type: 'water',
          title: `${waterAmount} ml`,
          createdAt: Date.now(),
        });
      } else if (activeTab === 'thought') {
        if (!thoughtText.trim()) {
          setValidationError('Please enter your thought or idea.');
          return;
        }

        setIsSubmitting(true);
        const newThoughtId = addInboxItem(thoughtText.trim());

        setLastCreationFeedback({
          id: newThoughtId,
          type: 'thought',
          title: thoughtText.trim().slice(0, 32) + (thoughtText.trim().length > 32 ? '…' : ''),
          createdAt: Date.now(),
        });
        setThoughtText('');
      }

      setIsSubmitting(false);
      setActiveModal(null);
    } catch (err: any) {
      setIsSubmitting(false);
      setValidationError(err?.message || 'Could not save item. Please try again.');
    }
  };

  const categories = [
    { id: 'task', label: 'Task', icon: CheckSquare },
    { id: 'expense', label: 'Expense', icon: DollarSign },
    { id: 'workout', label: 'Workout', icon: Dumbbell },
    { id: 'weight', label: 'Weight', icon: Scale },
    { id: 'water', label: 'Water', icon: Droplet },
    { id: 'thought', label: 'Thought', icon: Inbox },
  ] as const;

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={() => {
        setValidationError(null);
        setActiveModal(null);
      }}
      title="Quick add"
      subtitle="Capture anything quickly into your planner"
    >
      <div className="space-y-4">
        {/* Category selection row */}
        <div role="radiogroup" aria-label="Item category" className="grid grid-cols-6 gap-2">
          {categories.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Category: ${item.label}`}
                onClick={() => handleTabChange(item.id)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer min-h-[44px] ${
                  isSelected
                    ? 'border-[#087F83] bg-teal-50 dark:bg-teal-950/40 text-[#087F83] dark:text-[#38D0C5] font-bold shadow-2xs'
                    : 'border-slate-200 dark:border-slate-700 text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 mb-1" />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Inline Validation Alert */}
        {validationError && (
          <div
            role="alert"
            data-testid="quick-add-validation-error"
            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4 pt-1">
          {/* TASK FORM */}
          {activeTab === 'task' && (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="quick-add-task-title"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                >
                  Task title *
                </label>
                <input
                  id="quick-add-task-title"
                  type="text"
                  required
                  autoFocus
                  value={taskTitle}
                  onChange={(e) => {
                    setTaskTitle(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="e.g. Call accountant, Review draft"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs text-[#071A3A] dark:text-[#EDF4FF] focus:ring-2 focus:ring-[#087F83] outline-none"
                />
              </div>

              {/* Progressive Disclosure Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setIsTaskOptionsOpen((prev) => !prev)}
                  aria-expanded={isTaskOptionsOpen}
                  className="text-xs font-semibold text-[#087F83] dark:text-[#38D0C5] flex items-center gap-1 hover:underline cursor-pointer py-1"
                >
                  <span>{isTaskOptionsOpen ? 'Fewer options' : '+ Add scheduling & priority'}</span>
                  {isTaskOptionsOpen ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Disclosed Task Fields */}
              {isTaskOptionsOpen && (
                <div className="p-3 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="quick-add-task-category"
                        className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                      >
                        Category
                      </label>
                      <select
                        id="quick-add-task-category"
                        value={taskCategory}
                        onChange={(e) => setTaskCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs text-[#071A3A] dark:text-[#EDF4FF] font-medium"
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
                        htmlFor="quick-add-task-priority"
                        className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                      >
                        Priority
                      </label>
                      <select
                        id="quick-add-task-priority"
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs text-[#071A3A] dark:text-[#EDF4FF] font-medium capitalize"
                      >
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                        <option value="lowest">Lowest</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="quick-add-task-due-date"
                        className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                      >
                        Due date
                      </label>
                      <input
                        id="quick-add-task-due-date"
                        type="date"
                        value={taskDueDate}
                        onChange={(e) => setTaskDueDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs text-[#071A3A] dark:text-[#EDF4FF]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="quick-add-task-due-time"
                        className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                      >
                        Due time (optional)
                      </label>
                      <input
                        id="quick-add-task-due-time"
                        type="time"
                        value={taskDueTime}
                        onChange={(e) => setTaskDueTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs text-[#071A3A] dark:text-[#EDF4FF]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="quick-add-task-assignee"
                      className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                    >
                      Assigned to
                    </label>
                    <input
                      id="quick-add-task-assignee"
                      type="text"
                      value={taskAssignee}
                      onChange={(e) => setTaskAssignee(e.target.value)}
                      placeholder="e.g. Me or partner name"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs text-[#071A3A] dark:text-[#EDF4FF]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EXPENSE FORM */}
          {activeTab === 'expense' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="quick-add-expense-amount"
                    className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                  >
                    Amount ({settings.currencySymbol || '$'}) *
                  </label>
                  <input
                    id="quick-add-expense-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    autoFocus
                    value={expenseAmount}
                    onChange={(e) => {
                      setExpenseAmount(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-mono font-bold text-[#071A3A] dark:text-[#EDF4FF] focus:ring-2 focus:ring-[#087F83]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="quick-add-expense-category"
                    className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                  >
                    Category
                  </label>
                  <select
                    id="quick-add-expense-category"
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium text-[#071A3A] dark:text-[#EDF4FF]"
                  >
                    <option value="Food">Food</option>
                    <option value="Transport">Transport</option>
                    <option value="Home">Home</option>
                    <option value="Personal">Personal</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Entertainment">Entertainment</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="quick-add-expense-note"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                >
                  Description / Note
                </label>
                <input
                  id="quick-add-expense-note"
                  type="text"
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                  placeholder="e.g. Weekly grocery trip, train ticket"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs text-[#071A3A] dark:text-[#EDF4FF]"
                />
              </div>

              <div>
                <label
                  htmlFor="quick-add-expense-date"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                >
                  Date
                </label>
                <input
                  id="quick-add-expense-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs text-[#071A3A] dark:text-[#EDF4FF]"
                />
              </div>
            </div>
          )}

          {/* WORKOUT FORM */}
          {activeTab === 'workout' && (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="quick-add-workout-title"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                >
                  Workout session title *
                </label>
                <input
                  id="quick-add-workout-title"
                  type="text"
                  required
                  autoFocus
                  value={workoutTitle}
                  onChange={(e) => {
                    setWorkoutTitle(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="e.g. 20 min Core & Mobility"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs text-[#071A3A] dark:text-[#EDF4FF] focus:ring-2 focus:ring-[#087F83]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="quick-add-workout-duration"
                    className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                  >
                    Duration (minutes)
                  </label>
                  <input
                    id="quick-add-workout-duration"
                    type="number"
                    min="5"
                    step="5"
                    value={workoutDuration}
                    onChange={(e) => setWorkoutDuration(parseInt(e.target.value, 10) || 30)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs text-[#071A3A] dark:text-[#EDF4FF]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="quick-add-workout-muscle"
                    className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                  >
                    Focus area
                  </label>
                  <select
                    id="quick-add-workout-muscle"
                    value={workoutMuscle}
                    onChange={(e) => setWorkoutMuscle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs text-[#071A3A] dark:text-[#EDF4FF]"
                  >
                    <option value="Full body">Full body</option>
                    <option value="Upper body">Upper body</option>
                    <option value="Lower body">Lower body</option>
                    <option value="Core">Core</option>
                    <option value="Cardio">Cardio</option>
                    <option value="Mobility">Mobility</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* WEIGHT FORM */}
          {activeTab === 'weight' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="quick-add-weight-value"
                    className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF]"
                  >
                    Weight ({modalWeightUnit}) *
                  </label>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-[#526782] dark:text-[#A8B8CE] text-[10px]">Unit:</span>
                    <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => handleModalWeightUnitChange('kg')}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                          modalWeightUnit === 'kg'
                            ? 'bg-[#087F83] text-white shadow-2xs'
                            : 'text-[#526782] dark:text-[#A8B8CE] hover:text-[#071A3A]'
                        }`}
                      >
                        kg
                      </button>
                      <button
                        type="button"
                        onClick={() => handleModalWeightUnitChange('lb')}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                          modalWeightUnit === 'lb'
                            ? 'bg-[#087F83] text-white shadow-2xs'
                            : 'text-[#526782] dark:text-[#A8B8CE] hover:text-[#071A3A]'
                        }`}
                      >
                        lb
                      </button>
                    </div>
                  </div>
                </div>
                <input
                  id="quick-add-weight-value"
                  type="number"
                  step="0.1"
                  min="1"
                  required
                  autoFocus
                  value={weightValue}
                  onChange={(e) => {
                    setWeightValue(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-mono font-bold text-[#071A3A] dark:text-[#EDF4FF] focus:ring-2 focus:ring-[#087F83]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="quick-add-weight-date"
                    className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                  >
                    Date
                  </label>
                  <input
                    id="quick-add-weight-date"
                    type="date"
                    value={weightDate}
                    onChange={(e) => setWeightDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs text-[#071A3A] dark:text-[#EDF4FF]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="quick-add-weight-time"
                    className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                  >
                    Time
                  </label>
                  <input
                    id="quick-add-weight-time"
                    type="time"
                    value={weightTime}
                    onChange={(e) => setWeightTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs text-[#071A3A] dark:text-[#EDF4FF]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* WATER FORM */}
          {activeTab === 'water' && (
            <div className="space-y-3">
              <div className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                Quick water presets
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[250, 500, 750].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setWaterAmount(preset);
                      if (validationError) setValidationError(null);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
                      waterAmount === preset
                        ? 'border-[#087F83] bg-teal-50 dark:bg-teal-950/40 text-[#087F83] dark:text-[#38D0C5]'
                        : 'border-slate-200 dark:border-slate-700 text-[#526782] dark:text-[#A8B8CE]'
                    }`}
                  >
                    +{preset} ml
                  </button>
                ))}
              </div>

              <div>
                <label
                  htmlFor="quick-add-water-amount"
                  className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
                >
                  Or custom amount (ml) *
                </label>
                <input
                  id="quick-add-water-amount"
                  type="number"
                  min="50"
                  step="50"
                  value={waterAmount}
                  onChange={(e) => {
                    setWaterAmount(parseInt(e.target.value, 10) || 0);
                    if (validationError) setValidationError(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs text-[#071A3A] dark:text-[#EDF4FF] font-mono font-bold"
                />
              </div>
            </div>
          )}

          {/* THOUGHT / BRAIN DUMP FORM */}
          {activeTab === 'thought' && (
            <div>
              <label
                htmlFor="quick-add-thought-text"
                className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1"
              >
                Thought or idea *
              </label>
              <textarea
                id="quick-add-thought-text"
                rows={3}
                required
                autoFocus
                value={thoughtText}
                onChange={(e) => {
                  setThoughtText(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="What's on your mind? Jot down anything to process later…"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs text-[#071A3A] dark:text-[#EDF4FF] focus:ring-2 focus:ring-[#087F83] outline-none"
              />
            </div>
          )}

          {/* Dialog Action Buttons */}
          <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setValidationError(null);
                setActiveModal(null);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="quick-add-submit-btn"
              className="px-5 py-2.5 rounded-xl bg-[#087F83] hover:bg-[#06676A] text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              <span>{isSubmitting ? 'Saving…' : 'Add to planner'}</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
