import React from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { RefreshCw, AlertCircle, AlertTriangle, Download, Cloud, X } from 'lucide-react';

export const SavingIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
  const {
    savingState,
    setActiveModal,
    retrySave,
    lastSaveError,
    exportUnsavedSnapshot,
    corruptStartupQuarantine,
    exportCorruptQuarantine,
    dismissCorruptQuarantine,
    conflictQueue,
  } = usePlanner();

  const renderCorruptBanner = () => {
    if (!corruptStartupQuarantine) return null;
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200"
        role="alert"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="truncate max-w-[160px]" title={corruptStartupQuarantine.reason}>
          Corrupt startup data preserved
        </span>
        <button
          type="button"
          onClick={exportCorruptQuarantine}
          className="inline-flex items-center gap-1 font-semibold underline hover:text-amber-700 dark:hover:text-amber-100 cursor-pointer"
          title="Download quarantined raw storage bytes as JSON"
        >
          <Download className="w-3 h-3" />
          <span>Export raw</span>
        </button>
        <button
          type="button"
          onClick={dismissCorruptQuarantine}
          className="p-0.5 rounded hover:bg-amber-200/60 dark:hover:bg-amber-900/50 cursor-pointer"
          title="Dismiss corrupt data notice"
          aria-label="Dismiss corrupt data notice"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  };

  const renderStateIndicator = () => {
    switch (savingState) {
      case 'saving':
        return (
          <div className={`flex items-center gap-1.5 text-xs text-[#526782] dark:text-[#A8B8CE] transition-opacity duration-150 ${className}`}>
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
            <span>Saving locally…</span>
          </div>
        );
      case 'saved_cloud':
        return (
          <div className={`flex items-center gap-1.5 text-xs text-[#526782] dark:text-[#A8B8CE] transition-opacity duration-150 ${className}`}>
            <Cloud className="w-3.5 h-3.5 text-[#10B981] motion-check-pop" />
            <span>Saved & synced</span>
          </div>
        );
      case 'saved_local':
      case 'saved_online':
      case 'waiting_to_sync':
        return (
          <div className={`flex items-center gap-1.5 text-xs text-[#526782] dark:text-[#A8B8CE] transition-opacity duration-150 ${className}`}>
            <span className="w-2 h-2 rounded-full bg-[#10B981] motion-check-pop" />
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
            <span>
              Version review{conflictQueue.length > 1 ? ` (${conflictQueue.length})` : ''}
            </span>
          </button>
        );
      case 'could_not_save':
        return (
          <div className={`flex items-center gap-2 text-xs ${className}`} role="alert">
            <button
              type="button"
              onClick={() => {
                void retrySave();
              }}
              className="flex items-center gap-1 text-[#EF4444] font-medium hover:underline cursor-pointer"
              title={lastSaveError ? `Storage error: ${lastSaveError}. Click to retry.` : 'Browser storage issue. Click to retry.'}
              aria-label="Browser storage issue. Click to retry."
            >
              <AlertCircle className="w-3.5 h-3.5 text-[#EF4444]" />
              <span>Storage issue · Retry</span>
            </button>
            <button
              type="button"
              onClick={exportUnsavedSnapshot}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-[11px] font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/70 cursor-pointer"
              title="Download unsaved planner changes as JSON backup"
              aria-label="Export unsaved data"
            >
              <Download className="w-3 h-3" />
              <span>Export unsaved</span>
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {renderCorruptBanner()}
      {renderStateIndicator()}
    </div>
  );
};

