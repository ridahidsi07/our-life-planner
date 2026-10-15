import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  getPreRestoreSnapshot,
  STORAGE_KEY_PRE_RESTORE_SNAPSHOT,
} from '../../utils/backupValidator';
import {
  STORAGE_KEY_DATA,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_REVISION,
  getStoredRevision,
} from '../../utils/storageCoordinator';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackSubtitle?: string;
  compact?: boolean;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  recoveredSnapshotMessage: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    recoveredSnapshotMessage: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unexpected render error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, recoveredSnapshotMessage: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleRestorePreviousSnapshot = () => {
    try {
      const preRestore = getPreRestoreSnapshot();
      if (!preRestore) return;
      const nextRev = getStoredRevision() + 1;
      const restored = {
        ...preRestore.snapshot,
        revision: nextRev,
      };
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(restored));
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(restored.settings));
      localStorage.setItem(STORAGE_KEY_REVISION, String(nextRev));
      this.setState({
        recoveredSnapshotMessage: 'Previous planner snapshot restored. Reloading...',
      });
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 400);
    } catch (e) {
      console.error('Failed to recover pre-restore snapshot from ErrorBoundary:', e);
    }
  };

  private handleClearCorruptedStorageAndReload = () => {
    try {
      const preRestore = getPreRestoreSnapshot();
      if (preRestore) {
        this.handleRestorePreviousSnapshot();
        return;
      }
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const preRestore = getPreRestoreSnapshot();
    const isCompact = Boolean(this.props.compact);

    if (isCompact) {
      return (
        <div
          role="alert"
          className="p-4 rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/40 text-xs text-rose-900 dark:text-rose-200 space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">
                {this.props.fallbackTitle || 'Could not render this section'}
              </div>
              <p className="text-[11px] text-rose-700 dark:text-rose-300">
                {this.props.fallbackSubtitle ||
                  'An unexpected data format or rendering error occurred. Your saved planner records remain intact.'}
              </p>
              {this.state.error?.message && (
                <pre className="mt-1 p-2 rounded-lg bg-white/70 dark:bg-slate-900/60 text-[10px] font-mono overflow-x-auto">
                  {this.state.error.message}
                </pre>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Dismiss &amp; Reset Section</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        role="alert"
        className="min-h-screen w-full bg-[#F3F8FC] dark:bg-[#0B1220] text-[#071A3A] dark:text-[#EDF4FF] flex items-center justify-center p-4"
      >
        <div className="max-w-lg w-full bg-white dark:bg-[#152238] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D4A] p-6 shadow-lg space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                {this.props.fallbackTitle || 'Something went wrong while displaying the planner'}
              </h2>
              <p className="text-xs text-[#526782] dark:text-[#A8B8CE] mt-1">
                {this.props.fallbackSubtitle ||
                  'The recovery boundary caught an unexpected error so your stored data remains protected.'}
              </p>
            </div>
          </div>

          {this.state.error?.message && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-rose-600 dark:text-rose-400 overflow-x-auto">
              {this.state.error.message}
            </div>
          )}

          {this.state.recoveredSnapshotMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{this.state.recoveredSnapshotMessage}</span>
            </div>
          )}

          {preRestore && (
            <div className="p-3.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--border-color)] text-xs space-y-2">
              <div className="font-bold text-[var(--accent)] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Recoverable safety snapshot available</span>
              </div>
              <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                Saved at {new Date(preRestore.savedAt).toLocaleString()} · Owner: {preRestore.ownerName} ({preRestore.totalRecords} records)
              </div>
              <button
                type="button"
                onClick={this.handleRestorePreviousSnapshot}
                className="px-3.5 py-1.5 rounded-xl bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover-bg)] text-[var(--btn-primary-fg)] text-xs font-semibold cursor-pointer transition-colors"
              >
                Restore previous snapshot
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0] dark:border-[#1E2D4A]">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-[#071A3A] dark:text-[#EDF4FF] hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Try again</span>
            </button>
            <button
              type="button"
              onClick={this.handleClearCorruptedStorageAndReload}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#071A3A] dark:bg-slate-700 text-white text-xs font-semibold hover:bg-black dark:hover:bg-slate-600 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload planner</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}

void STORAGE_KEY_PRE_RESTORE_SNAPSHOT;
