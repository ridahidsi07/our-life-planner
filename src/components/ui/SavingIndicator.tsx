import React from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Cloud, Check, RefreshCw, AlertCircle, HardDrive, AlertTriangle } from 'lucide-react';

export const SavingIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { savingState, setSavingState, setActiveModal } = usePlanner();

  switch (savingState) {
    case 'saving':
      return (
        <div className={`flex items-center gap-1.5 text-xs text-[#526782] dark:text-[#A8B8CE] ${className}`}>
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#087F83] dark:text-[#38D0C5]" />
          <span>Saving locally…</span>
        </div>
      );
    case 'saved_local':
    case 'saved_online':
    case 'waiting_to_sync':
      return (
        <div className={`flex items-center gap-1.5 text-xs text-[#526782] dark:text-[#A8B8CE] ${className}`}>
          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span>Saved locally</span>
        </div>
      );
    case 'needs_choice':
      return (
        <button
          type="button"
          onClick={() => setActiveModal('conflict')}
          className={`flex items-center gap-1.5 text-xs text-[#F59E0B] font-medium hover:underline cursor-pointer ${className}`}
          aria-label="Version conflict: needs review"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span>Version review</span>
        </button>
      );
    case 'could_not_save':
      return (
        <button
          type="button"
          onClick={() => {
            setSavingState('saving');
            setTimeout(() => setSavingState('saved_local'), 400);
          }}
          className={`flex items-center gap-1.5 text-xs text-[#EF4444] font-medium hover:underline cursor-pointer ${className}`}
          title="Browser storage issue. Click to retry."
          aria-label="Browser storage issue. Click to retry."
        >
          <AlertCircle className="w-3.5 h-3.5 text-[#EF4444]" />
          <span>Storage issue · Retry</span>
        </button>
      );
    default:
      return null;
  }
};
