import React, { useEffect, useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Check, RotateCcw, X, ExternalLink } from 'lucide-react';

export const CreationFeedbackToast: React.FC = () => {
  const {
    lastCreationFeedback,
    setLastCreationFeedback,
    undoLastCreation,
    activeView,
    setActiveView,
    setHighlightedTaskId,
    tasks,
  } = usePlanner();

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (lastCreationFeedback) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setLastCreationFeedback(null);
      }, 7000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [lastCreationFeedback, setLastCreationFeedback]);

  if (!lastCreationFeedback || !isVisible) return null;

  const { id, type, title } = lastCreationFeedback;

  const handleUndo = () => {
    undoLastCreation();
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setLastCreationFeedback(null);
  };

  const handleNavigateToItem = () => {
    if (type === 'task') {
      setActiveView('tasks');
      setHighlightedTaskId(id);
    } else if (type === 'expense') {
      setActiveView('budget');
    } else if (type === 'workout') {
      setActiveView('workouts');
    } else if (type === 'weight') {
      setActiveView('weight');
    } else if (type === 'water') {
      setActiveView('water');
    } else if (type === 'thought') {
      setActiveView('inbox');
    }
    setIsVisible(false);
  };

  const categoryLabels: Record<string, string> = {
    task: 'Task',
    expense: 'Expense',
    workout: 'Workout',
    weight: 'Weight',
    water: 'Water log',
    thought: 'Thought',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="creation-feedback-toast"
      className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 max-w-md w-[calc(100%-2rem)] sm:w-auto p-3.5 bg-slate-900/95 dark:bg-slate-800/95 text-white rounded-2xl shadow-xl border border-slate-700/80 backdrop-blur-xs flex items-center justify-between gap-3 text-xs motion-feedback-enter"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-5 h-5 rounded-full bg-[#38D0C5] text-[#071A3A] flex items-center justify-center shrink-0">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </div>
        <div className="truncate">
          <span className="text-slate-300 font-medium mr-1.5">{categoryLabels[type] || 'Item'} added:</span>
          <span className="font-semibold text-white">&ldquo;{title}&rdquo;</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleNavigateToItem}
          data-testid="feedback-view-btn"
          className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          title="View in planner"
        >
          <ExternalLink className="w-3 h-3" />
          <span>View</span>
        </button>

        <button
          type="button"
          onClick={handleUndo}
          data-testid="feedback-undo-btn"
          className="px-2.5 py-1 rounded-lg bg-[#38D0C5] hover:bg-[#2BB5AB] text-[#071A3A] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
          title="Undo adding item"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Undo</span>
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          data-testid="feedback-dismiss-btn"
          className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer ml-0.5"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
