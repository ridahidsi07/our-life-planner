import React, { useEffect, useRef, useId } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  maxWidth?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  maxWidth = 'max-w-lg',
  ariaLabel,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const uniqueId = useId();
  const titleId = `modal-title-${uniqueId}`;
  const subtitleId = `modal-desc-${uniqueId}`;

  // Focus placement, trapping, return, and Escape key handling
  useEffect(() => {
    if (!isOpen) return;

    // Remember currently focused element to return focus on close
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus placement: focus first interactive element or dialog itself
    const timer = setTimeout(() => {
      if (!dialogRef.current) return;
      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        // Prefer first input/select/textarea if present, otherwise first focusable
        const firstField = Array.from(focusableElements).find((el) =>
          ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
        );
        (firstField || focusableElements[0]).focus();
      } else {
        dialogRef.current.focus();
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      // Focus return
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={subtitle ? subtitleId : undefined}
        aria-label={!title ? (ariaLabel || 'Dialog') : undefined}
        tabIndex={-1}
        className={`relative w-full ${maxWidth} bg-white dark:bg-[#152238] rounded-2xl shadow-xl border border-[#E2E8F0] dark:border-[#1E2D4A] overflow-hidden max-h-[92vh] flex flex-col z-10 outline-none`}
      >
        {(title || subtitle) && (
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#E2E8F0] dark:border-[#1E2D4A] shrink-0">
            <div>
              {title && (
                <h3
                  id={titleId}
                  className="text-lg font-bold text-[#071A3A] dark:text-[#EDF4FF]"
                >
                  {title}
                </h3>
              )}
              {subtitle && (
                <p
                  id={subtitleId}
                  className="text-xs text-[#526782] dark:text-[#A8B8CE] mt-0.5"
                >
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#526782] hover:text-[#071A3A] dark:text-[#A8B8CE] dark:hover:text-[#EDF4FF] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label={`Close ${title || 'dialog'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};
