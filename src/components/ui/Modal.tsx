import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  maxWidth?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  maxWidth = 'max-w-lg',
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
        className={`relative w-full ${maxWidth} bg-white dark:bg-[#152238] rounded-2xl shadow-xl border border-[#E2E8F0] dark:border-[#1E2D4A] overflow-hidden max-h-[92vh] flex flex-col z-10`}
      >
        {(title || subtitle) && (
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#E2E8F0] dark:border-[#1E2D4A] shrink-0">
            <div>
              {title && (
                <h3 className="text-lg font-bold text-[#071A3A] dark:text-[#EDF4FF]">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-[#526782] dark:text-[#A8B8CE] mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#526782] hover:text-[#071A3A] dark:text-[#A8B8CE] dark:hover:text-[#EDF4FF] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close"
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
