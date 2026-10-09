import React, { useState, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { RingProgress } from '../ui/RingProgress';
import { Modal } from '../ui/Modal';
import {
  Target,
  Plus,
  Check,
  Calendar,
  Clock,
  Sparkles,
  Trash2,
  Edit2,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { GoalItem, TaskStatus } from '../../types/planner';

export const GoalsView: React.FC = () => {
  const {
    goals,
    addGoal,
    updateGoal,
    deleteGoal,
    toggleGoalStep,
    addGoalStep,
    currentDate,
  } = usePlanner();

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedGoalId, setSelectedGoalId] = useState<string>(
    goals.length > 0 ? goals[0].id : ''
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null);

  // Form states
  const [modalTitle, setModalTitle] = useState('');
  const [modalCategory, setModalCategory] = useState<
    'Career' | 'Personal growth' | 'Health' | 'Finances' | 'Relationships'
  >('Career');
  const [modalMotivation, setModalMotivation] = useState('');
  const [modalReward, setModalReward] = useState('');
  const [modalDeadline, setModalDeadline] = useState('');
  const [modalStatus, setModalStatus] = useState<TaskStatus>('in_progress');

  // Step input in details
  const [newStepText, setNewStepText] = useState('');

  const openCreateModal = () => {
    setEditingGoal(null);
    setModalTitle('');
    setModalCategory('Career');
    setModalMotivation('');
    setModalReward('');
    setModalDeadline(currentDate);
    setModalStatus('in_progress');
    setIsModalOpen(true);
  };

  const openEditModal = (goal: GoalItem) => {
    setEditingGoal(goal);
    setModalTitle(goal.title);
    setModalCategory(goal.category);
    setModalMotivation(goal.motivation || '');
    setModalReward(goal.reward || '');
    setModalDeadline(goal.deadline || '');
    setModalStatus(goal.status);
    setIsModalOpen(true);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) return;

    if (editingGoal) {
      updateGoal(editingGoal.id, {
        title: modalTitle.trim(),
        category: modalCategory,
        motivation: modalMotivation || undefined,
        reward: modalReward || undefined,
        deadline: modalDeadline || undefined,
        status: modalStatus,
      });
    } else {
      addGoal({
        title: modalTitle.trim(),
        category: modalCategory,
        motivation: modalMotivation || undefined,
        reward: modalReward || undefined,
        deadline: modalDeadline || undefined,
        status: modalStatus,
        steps: [],
      });
    }
    setIsModalOpen(false);
  };

  // Filter goals
  const filteredGoals = useMemo(() => {
    if (categoryFilter === 'All') return goals;
    return goals.filter((g) => g.category === categoryFilter);
  }, [goals, categoryFilter]);

  // Selected goal
  const selectedGoal =
    goals.find((g) => g.id === selectedGoalId) || (goals.length > 0 ? goals[0] : null);

  // Goal metrics & averages
  const overallMetrics = useMemo(() => {
    if (filteredGoals.length === 0) {
      return { avgProgress: 0, activeCount: 0, onHoldCount: 0, completedCount: 0 };
    }

    let sumPct = 0;
    let active = 0;
    let onHold = 0;
    let completed = 0;

    filteredGoals.forEach((g) => {
      let pct = 0;
      if (g.steps.length === 0) {
        pct = g.status === 'completed' ? 100 : 0;
      } else {
        const comp = g.steps.filter((s) => s.isCompleted).length;
        pct = Math.round((comp / g.steps.length) * 100);
      }
      sumPct += pct;

      if (g.status === 'completed') completed++;
      else if (g.status === 'on_hold') onHold++;
      else active++;
    });

    const avg = Math.round(sumPct / filteredGoals.length);
    return {
      avgProgress: avg,
      activeCount: active,
      onHoldCount: onHold,
      completedCount: completed,
    };
  }, [filteredGoals]);

  const handleAddStepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal || !newStepText.trim()) return;
    addGoalStep(selectedGoal.id, newStepText.trim());
    setNewStepText('');
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl p-5 border border-[#E2E8F0] dark:border-[#1E2D4A] flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Goals
          </h2>
          <p className="text-xs text-[#526782] dark:text-[#A8B8CE]">
            Set goals, track progress, and make it happen.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087F83] hover:bg-[#06676A] dark:bg-[#38D0C5] dark:hover:bg-[#2BB5AB] text-white dark:text-[#071A3A] font-semibold text-xs transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Set a goal</span>
        </button>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Overall progress donut */}
        <div className="col-span-2 bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs flex items-center gap-4">
          <RingProgress
            progress={overallMetrics.avgProgress}
            size={58}
            strokeWidth={6}
            color="#087F83"
          >
            <span className="text-sm font-bold font-mono">
              {overallMetrics.avgProgress}%
            </span>
          </RingProgress>
          <div>
            <div className="text-sm font-bold text-[#071A3A] dark:text-[#EDF4FF]">
              Overall progress
            </div>
            <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">
              Average across {filteredGoals.length} goals
            </div>
            <div className="text-[11px] text-[#526782] mt-0.5">
              {overallMetrics.activeCount} active · {overallMetrics.onHoldCount} on hold
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">Total goals</div>
          <div className="text-2xl font-bold font-mono text-[#071A3A] dark:text-[#EDF4FF] mt-1">
            {filteredGoals.length}
          </div>
        </div>

        <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">Active</div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {overallMetrics.activeCount}
          </div>
        </div>

        <div className="bg-white dark:bg-[#152238] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs">
          <div className="text-xs text-[#526782] dark:text-[#A8B8CE]">Completed</div>
          <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
            {overallMetrics.completedCount}
          </div>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        {['All', 'Health', 'Finances', 'Career', 'Personal growth', 'Relationships'].map(
          (cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-[#087F83] text-white shadow-2xs'
                  : 'bg-white dark:bg-[#152238] text-[#526782] hover:bg-slate-100 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {cat}
            </button>
          )
        )}
      </div>

      {/* Main 2-Column Area: Goals List (6 cols) & Goal Detail Checklist (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Goals List (6 cols) */}
        <div className="lg:col-span-6 space-y-3">
          {filteredGoals.map((goal) => {
            const completedSteps = goal.steps.filter((s) => s.isCompleted).length;
            const pct =
              goal.steps.length === 0
                ? goal.status === 'completed'
                  ? 100
                  : 0
                : Math.round((completedSteps / goal.steps.length) * 100);

            const isSelected = selectedGoal?.id === goal.id;

            return (
              <div
                key={goal.id}
                onClick={() => setSelectedGoalId(goal.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer bg-white dark:bg-[#152238] shadow-2xs ${
                  isSelected
                    ? 'border-[#087F83] ring-1 ring-[#087F83]'
                    : 'border-[#E2E8F0] dark:border-[#1E2D4A] hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                      {goal.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                        {goal.category}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-[#526782] capitalize">
                        {goal.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-[#087F83] dark:text-[#38D0C5]">
                      {pct}%
                    </span>
                    <div className="text-[10px] text-[#526782]">
                      {completedSteps} of {goal.steps.length} steps
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden my-3">
                  <div
                    className="bg-[#087F83] dark:bg-[#38D0C5] h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {goal.deadline && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#526782]">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Due {goal.deadline}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Goal Detail & Checklist (6 cols) */}
        <div className="lg:col-span-6">
          {selectedGoal ? (
            <div className="bg-white dark:bg-[#152238] rounded-2xl p-6 border border-[#E2E8F0] dark:border-[#1E2D4A] shadow-2xs space-y-5">
              <div className="flex items-start justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D4A]">
                <div>
                  <h3 className="text-lg font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                    {selectedGoal.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                      {selectedGoal.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 capitalize">
                      {selectedGoal.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedGoal)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#526782] dark:text-[#A8B8CE] cursor-pointer"
                    title="Edit goal"
                    aria-label={`Edit goal "${selectedGoal.title}"`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteGoal(selectedGoal.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 cursor-pointer"
                    title="Delete goal"
                    aria-label={`Delete goal "${selectedGoal.title}"`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Motivation & Reward cards */}
              {(selectedGoal.motivation || selectedGoal.reward) && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {selectedGoal.motivation && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <span className="font-semibold text-[#526782] dark:text-[#A8B8CE] block text-[10px] uppercase">
                        Motivation
                      </span>
                      <p className="text-[#071A3A] dark:text-[#EDF4FF] mt-0.5">
                        {selectedGoal.motivation}
                      </p>
                    </div>
                  )}
                  {selectedGoal.reward && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <span className="font-semibold text-[#526782] dark:text-[#A8B8CE] block text-[10px] uppercase">
                        Reward
                      </span>
                      <p className="text-[#071A3A] dark:text-[#EDF4FF] mt-0.5">
                        {selectedGoal.reward}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Checklist Steps */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF] uppercase tracking-wider">
                    Steps ({selectedGoal.steps.filter((s) => s.isCompleted).length} of{' '}
                    {selectedGoal.steps.length} completed)
                  </h4>
                </div>

                <div className="space-y-2 mb-4">
                  {selectedGoal.steps.map((step) => (
                    <div
                      key={step.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={step.isCompleted}
                        aria-label={`Mark step "${step.title}" as ${step.isCompleted ? 'incomplete' : 'complete'}`}
                        onClick={() => toggleGoalStep(selectedGoal.id, step.id)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
                          step.isCompleted
                            ? 'bg-[#087F83] text-white'
                            : 'border border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {step.isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                      <span
                        className={`text-xs font-medium ${
                          step.isCompleted
                            ? 'line-through text-[#526782] dark:text-[#A8B8CE]'
                            : 'text-[#071A3A] dark:text-[#EDF4FF]'
                        }`}
                      >
                        {step.title}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Add Step Form */}
                <form onSubmit={handleAddStepSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={newStepText}
                    onChange={(e) => setNewStepText(e.target.value)}
                    placeholder="Add a smaller action step…"
                    className="flex-1 px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-[#087F83]"
                  />
                  <button
                    type="submit"
                    disabled={!newStepText.trim()}
                    className="px-3.5 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] disabled:opacity-50 cursor-pointer"
                  >
                    Add step
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#152238] rounded-2xl p-8 border border-[#E2E8F0] dark:border-[#1E2D4A] text-center text-xs text-[#526782]">
              Select a goal to view and manage its checklist steps.
            </div>
          )}
        </div>
      </div>

      {/* Goal Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingGoal ? 'Edit goal' : 'Set a goal'}
        subtitle="Define what you want to achieve and break it down into actionable steps"
      >
        <form onSubmit={handleSaveGoal} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Goal title *
            </label>
            <input
              type="text"
              required
              value={modalTitle}
              onChange={(e) => setModalTitle(e.target.value)}
              placeholder="e.g. Finish portfolio, Learn Spanish"
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
                onChange={(e) => setModalCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs font-medium"
              >
                <option value="Career">Career</option>
                <option value="Personal growth">Personal growth</option>
                <option value="Health">Health</option>
                <option value="Finances">Finances</option>
                <option value="Relationships">Relationships</option>
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
                <option value="in_progress">In progress</option>
                <option value="not_started">Not started</option>
                <option value="on_hold">On hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Motivation (optional)
            </label>
            <input
              type="text"
              value={modalMotivation}
              onChange={(e) => setModalMotivation(e.target.value)}
              placeholder="Why does this matter to you?"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Reward (optional)
            </label>
            <input
              type="text"
              value={modalReward}
              onChange={(e) => setModalReward(e.target.value)}
              placeholder="How will you celebrate?"
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] mb-1">
              Deadline
            </label>
            <input
              type="date"
              value={modalDeadline}
              onChange={(e) => setModalDeadline(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D4A] bg-white dark:bg-[#152238] text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A]"
            >
              Save goal
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
