import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import {
  CheckSquare,
  DollarSign,
  Dumbbell,
  Scale,
  Droplet,
  Inbox,
  Check,
} from 'lucide-react';
import { convertLbToKg, convertKgToLb } from '../../utils/calculations';

export const QuickAddModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    addTask,
    addTransaction,
    addWorkoutSession,
    addWeightRecord,
    addWaterLog,
    addInboxItem,
    selectedProfileId,
    currentDate,
    settings,
  } = usePlanner();

  const [activeTab, setActiveTab] = useState<
    'task' | 'expense' | 'workout' | 'weight' | 'water' | 'thought'
  >('task');

  // Form states
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState('Personal');
  const [expenseAmount, setExpenseAmount] = useState<number>(25);
  const [expenseCategory, setExpenseCategory] = useState('Food');
  const [workoutTitle, setWorkoutTitle] = useState('Quick workout');
  const [modalWeightUnit, setModalWeightUnit] = useState<'kg' | 'lb'>(() => settings.weightUnit || 'kg');
  const [weightValue, setWeightValue] = useState<number>(() =>
    (settings.weightUnit || 'kg') === 'lb' ? 158.7 : 72.0
  );

  const handleModalWeightUnitChange = (newUnit: 'kg' | 'lb') => {
    if (newUnit === modalWeightUnit) return;
    if (weightValue > 0) {
      if (newUnit === 'lb') {
        setWeightValue(convertKgToLb(weightValue));
      } else {
        setWeightValue(convertLbToKg(weightValue));
      }
    }
    setModalWeightUnit(newUnit);
  };
  const [thoughtText, setThoughtText] = useState('');

  const [submittedFeedback, setSubmittedFeedback] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeTab === 'task' && taskTitle.trim()) {
      addTask({
        title: taskTitle.trim(),
        category: taskCategory,
        assignedTo: 'Rida',
        dueDate: currentDate,
        priority: 'medium',
        status: 'not_started',
      });
      setTaskTitle('');
    } else if (activeTab === 'expense' && expenseAmount > 0) {
      addTransaction({
        type: 'expense',
        amount: expenseAmount,
        category: expenseCategory,
        date: currentDate,
      });
    } else if (activeTab === 'workout' && workoutTitle.trim()) {
      addWorkoutSession({
        title: workoutTitle.trim(),
        date: currentDate,
        durationMinutes: 30,
        muscleGroups: ['Full body'],
        exercises: [],
        isCompleted: true,
      });
      setWorkoutTitle('');
    } else if (activeTab === 'weight' && weightValue > 0) {
      const canonicalKg =
        modalWeightUnit === 'lb'
          ? convertLbToKg(weightValue)
          : Math.round(weightValue * 10) / 10;
      addWeightRecord({
        profileId: selectedProfileId,
        date: currentDate,
        time: '08:00',
        weightKg: canonicalKg,
      });
    } else if (activeTab === 'water') {
      addWaterLog(250, '12:00');
    } else if (activeTab === 'thought' && thoughtText.trim()) {
      addInboxItem(thoughtText.trim());
      setThoughtText('');
    }

    setSubmittedFeedback(true);
    setTimeout(() => {
      setSubmittedFeedback(false);
      setActiveModal(null);
    }, 450);
  };

  return (
    <Modal
      isOpen={activeModal === 'quick_add'}
      onClose={() => setActiveModal(null)}
      title="Quick add"
      subtitle="Capture anything quickly into your planner"
    >
      <div className="space-y-4">
        {/* Category icons row */}
        <div role="radiogroup" aria-label="Item category" className="grid grid-cols-6 gap-2">
          {[
            { id: 'task', label: 'Task', icon: CheckSquare },
            { id: 'expense', label: 'Expense', icon: DollarSign },
            { id: 'workout', label: 'Workout', icon: Dumbbell },
            { id: 'weight', label: 'Weight', icon: Scale },
            { id: 'water', label: 'Water', icon: Droplet },
            { id: 'thought', label: 'Thought', icon: Inbox },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Category: ${item.label}`}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#087F83] bg-teal-50 dark:bg-teal-950/40 text-[#087F83] dark:text-[#38D0C5]'
                    : 'border-slate-200 dark:border-slate-700 text-[#526782] hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4 mb-1" />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {activeTab === 'task' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Task title *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Call accountant, Review draft"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs focus:ring-2 focus:ring-[#087F83]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Category
                </label>
                <select
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium"
                >
                  <option value="Personal">Personal</option>
                  <option value="Career">Career</option>
                  <option value="Health">Health</option>
                  <option value="Finances">Finances</option>
                  <option value="Relationships">Relationships</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'expense' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Amount ({settings.currencySymbol || '$'}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  autoFocus
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                  Category
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-medium"
                >
                  <option value="Food">Food</option>
                  <option value="Transport">Transport</option>
                  <option value="Home">Home</option>
                  <option value="Personal">Personal</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'workout' && (
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Workout session title
              </label>
              <input
                type="text"
                required
                autoFocus
                value={workoutTitle}
                onChange={(e) => setWorkoutTitle(e.target.value)}
                placeholder="e.g. 20 min Core & Mobility"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs"
              />
            </div>
          )}

          {activeTab === 'weight' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF]">
                  Weight ({modalWeightUnit}) *
                </label>
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-[#526782] text-[10px]">Unit:</span>
                  <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => handleModalWeightUnitChange('kg')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        modalWeightUnit === 'kg'
                          ? 'bg-[#087F83] text-white shadow-2xs'
                          : 'text-[#526782] hover:text-[#071A3A]'
                      }`}
                    >
                      kg
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModalWeightUnitChange('lb')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        modalWeightUnit === 'lb'
                          ? 'bg-[#087F83] text-white shadow-2xs'
                          : 'text-[#526782] hover:text-[#071A3A]'
                      }`}
                    >
                      lb
                    </button>
                  </div>
                </div>
              </div>
              <input
                type="number"
                step="0.1"
                min="1"
                required
                autoFocus
                value={weightValue}
                onChange={(e) => setWeightValue(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs font-mono font-bold"
              />
            </div>
          )}

          {activeTab === 'water' && (
            <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-center text-xs text-[#087F83] dark:text-[#38D0C5] font-semibold">
              Log +250 ml intake for today ({currentDate})
            </div>
          )}

          {activeTab === 'thought' && (
            <div>
              <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
                Jot down idea *
              </label>
              <textarea
                rows={2}
                required
                autoFocus
                value={thoughtText}
                onChange={(e) => setThoughtText(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152238] text-xs"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] flex items-center gap-1.5 cursor-pointer"
            >
              {submittedFeedback && <Check className="w-3.5 h-3.5" />}
              <span>{submittedFeedback ? 'Added!' : 'Add to planner'}</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
