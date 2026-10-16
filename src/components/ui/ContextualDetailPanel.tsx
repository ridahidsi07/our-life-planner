import React, { useId } from 'react';
import { X } from 'lucide-react';
import { useDialogAccessibility } from './Modal';

export interface ContextualDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  ariaLabel?: string;
  width?: string;
  dataTestId?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const ContextualDetailPanel: React.FC<ContextualDetailPanelProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  ariaLabel,
  width = 'sm:max-w-md',
  dataTestId = 'contextual-detail-panel',
  children,
  footer,
}) => {
  const { dialogRef } = useDialogAccessibility(isOpen, onClose);
  const uniqueId = useId();
  const titleId = `panel-title-${uniqueId}`;
  const subtitleId = `panel-subtitle-${uniqueId}`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Translucent contextual backdrop retaining parent view visibility */}
      <div
        className="fixed inset-0 bg-slate-900/35 dark:bg-black/55 backdrop-blur-[1px] motion-backdrop-enter"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full w-full sm:w-auto flex justify-end pointer-events-none">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={subtitle ? subtitleId : undefined}
          aria-label={!title ? (ariaLabel || 'Contextual detail panel') : undefined}
          tabIndex={-1}
          data-testid={dataTestId}
          className={`w-full max-w-full sm:w-96 md:w-[28rem] ${width} pointer-events-auto bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col outline-none motion-panel-enter`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/70 dark:bg-slate-900/50">
            <div className="min-w-0 pr-3">
              <div className="flex items-center gap-2 flex-wrap">
                {title && (
                  <h3
                    id={titleId}
                    className="text-base font-bold text-slate-900 dark:text-slate-100 truncate"
                  >
                    {title}
                  </h3>
                )}
                {badge && <div className="shrink-0">{badge}</div>}
              </div>
              {subtitle && (
                <p
                  id={subtitleId}
                  className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate"
                >
                  {subtitle}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              data-testid="detail-panel-close-btn"
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label={`Close ${title || 'detail panel'}`}
              title="Close panel (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            {children}
          </div>

          {/* Optional Footer Actions */}
          {footer && (
            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
