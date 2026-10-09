import React from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import { AlertTriangle, Check, Cloud, HardDrive } from 'lucide-react';

export const ConflictModal: React.FC = () => {
  const { activeModal, setActiveModal, conflictItem, resolveConflict } = usePlanner();

  // If no conflict item is active, provide sample conflict for testing
  const item = conflictItem || {
    id: 't-3',
    entityType: 'task',
    title: 'Project proposal',
    localVersion: {
      title: 'Project proposal',
      dueDate: '6 Oct 2026, 09:00 AM',
      notes: 'Initial draft ready for review.',
    },
    onlineVersion: {
      title: 'Project proposal',
      dueDate: '7 Oct 2026, 10:00 AM',
      notes: 'Updated draft with budget section.',
    },
    timestamp: '5 Oct 2026, 09:12',
  };

  return (
    <Modal
      isOpen={activeModal === 'conflict'}
      onClose={() => setActiveModal(null)}
      title="Conflict resolution"
      subtitle="We found different versions of the same item. Choose which version to keep."
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Edits were made both locally while offline and on another connected device. Please choose which version to preserve.
          </span>
        </div>

        <div className="text-xs font-bold text-[#071A3A] dark:text-[#EDF4FF]">
          Item: {item.title}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Local version */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
            <div className="flex items-center gap-2 font-bold text-xs text-[#087F83] dark:text-[#38D0C5]">
              <HardDrive className="w-4 h-4" />
              <span>Local version (on this device)</span>
            </div>

            <div className="text-xs space-y-1.5 font-mono">
              <div>
                <span className="text-[#526782] block text-[10px]">Title:</span>
                <span className="font-semibold">{item.localVersion.title}</span>
              </div>
              <div>
                <span className="text-[#526782] block text-[10px]">Due date:</span>
                <span>{item.localVersion.dueDate}</span>
              </div>
              <div>
                <span className="text-[#526782] block text-[10px]">Notes:</span>
                <span>{item.localVersion.notes}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                resolveConflict('local');
                setActiveModal(null);
              }}
              className="w-full py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer"
            >
              Keep local version
            </button>
          </div>

          {/* Online version */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
            <div className="flex items-center gap-2 font-bold text-xs text-blue-600 dark:text-blue-400">
              <Cloud className="w-4 h-4" />
              <span>Online version (in the cloud)</span>
            </div>

            <div className="text-xs space-y-1.5 font-mono">
              <div>
                <span className="text-[#526782] dark:text-[#A8B8CE] block text-[10px]">Title:</span>
                <span className="font-semibold">{item.onlineVersion.title}</span>
              </div>
              <div>
                <span className="text-[#526782] dark:text-[#A8B8CE] block text-[10px]">Due date:</span>
                <span>{item.onlineVersion.dueDate}</span>
              </div>
              <div>
                <span className="text-[#526782] dark:text-[#A8B8CE] block text-[10px]">Notes:</span>
                <span>{item.onlineVersion.notes}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                resolveConflict('online');
                setActiveModal(null);
              }}
              className="w-full py-2 rounded-xl bg-[#071A3A] dark:bg-slate-700 text-white text-xs font-semibold hover:bg-black dark:hover:bg-slate-600 cursor-pointer"
            >
              Keep online version
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
