import React from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import { AlertTriangle, HardDrive, FileText, Trash2, Cloud, Layers } from 'lucide-react';
import { describeConflictVersion } from '../../utils/storageCoordinator';

export const ConflictModal: React.FC = () => {
  const { activeModal, setActiveModal, conflictItem, conflictQueue, resolveConflict } = usePlanner();

  const item = conflictItem || {
    id: 't-3',
    entityType: 'tasks',
    title: 'Project proposal',
    source: 'tab' as const,
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

  const localDesc = describeConflictVersion(item.entityType, item.localVersion);
  const onlineDesc = describeConflictVersion(item.entityType, item.onlineVersion);

  const remoteSourceLabel =
    item.source === 'cloud'
      ? 'Cloud account version (from server sync)'
      : item.source === 'import'
      ? 'Imported version (from backup)'
      : 'Other tab version (from concurrent browser tab)';

  const remoteButtonLabel =
    item.source === 'cloud'
      ? onlineDesc.isDeleted
        ? 'Accept cloud deletion'
        : 'Keep cloud version'
      : item.source === 'import'
      ? onlineDesc.isDeleted
        ? 'Accept imported deletion'
        : 'Keep imported version'
      : onlineDesc.isDeleted
      ? 'Accept other tab deletion'
      : 'Keep other tab version';

  const localButtonLabel = localDesc.isDeleted
    ? 'Keep local deletion'
    : 'Keep current version';

  const queueTotal = conflictQueue.length;

  const handleResolve = (choice: 'local' | 'online') => {
    const hasMoreAfterThis = conflictQueue.length > 1;
    resolveConflict(choice);
    if (!hasMoreAfterThis) {
      setActiveModal(null);
    }
  };

  return (
    <Modal
      isOpen={activeModal === 'conflict'}
      onClose={() => setActiveModal(null)}
      title={queueTotal > 1 ? `Conflict resolution (1 of ${queueTotal} remaining)` : 'Conflict resolution'}
      subtitle="We found different versions of the same item. Choose which version to keep."
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {item.source === 'cloud'
                ? 'Concurrent edits were detected between this browser and your online cloud account. Choose which version to preserve.'
                : item.source === 'import'
                ? 'Multiple versions of this record were found during backup import. Choose which version to preserve.'
                : 'Concurrent edits were detected across open browser tabs. Choose which version to preserve.'}
            </span>
          </div>
          {queueTotal > 1 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900 text-[11px] font-bold shrink-0">
              <Layers className="w-3 h-3" />
              {queueTotal} queued
            </span>
          )}
        </div>

        <div className="space-y-2 text-xs">
          <div className="font-bold text-[#071A3A] dark:text-[#EDF4FF]">
            Item: {item.title || localDesc.heading || onlineDesc.heading}
          </div>
          <details
            data-testid="conflict-advanced-details"
            className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 px-3 py-2 text-[11px]"
          >
            <summary className="font-semibold text-[#526782] dark:text-[#A8B8CE] cursor-pointer select-none">
              Advanced details: Collection &amp; record metadata
            </summary>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-[10px] text-[#526782] dark:text-[#A8B8CE]">
              <span>Collection: {item.entityType}</span>
              <span>Record ID: {item.id}</span>
              <span>Detected: {item.timestamp}</span>
            </div>
          </details>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Local version */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex flex-col justify-between space-y-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs text-[#087F83] dark:text-[#38D0C5]">
                <HardDrive className="w-4 h-4" />
                <span>Current version (in this tab)</span>
              </div>

              {localDesc.isDeleted ? (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-bold">{localDesc.heading}</div>
                    <div className="text-[11px] opacity-80">
                      {localDesc.details[0] ? `${localDesc.details[0].label}: ${localDesc.details[0].value}` : 'Deleted'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs space-y-1.5 font-mono">
                  <div>
                    <span className="text-[#526782] dark:text-[#A8B8CE] block text-[10px]">Record:</span>
                    <span className="font-semibold">{localDesc.heading}</span>
                  </div>
                  {localDesc.details.map((line, idx) => (
                    <div key={idx} className="text-[11px] text-[#071A3A] dark:text-[#EDF4FF] break-words">
                      <span className="text-[#526782] dark:text-[#A8B8CE]">{line.label}: </span>
                      <span>{line.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleResolve('local')}
              className="w-full py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer"
            >
              {localButtonLabel}
            </button>
          </div>

          {/* Remote / Online / Tab version */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex flex-col justify-between space-y-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs text-blue-600 dark:text-blue-400">
                {item.source === 'cloud' ? <Cloud className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                <span>{remoteSourceLabel}</span>
              </div>

              {onlineDesc.isDeleted ? (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-bold">{onlineDesc.heading}</div>
                    <div className="text-[11px] opacity-80">
                      {onlineDesc.details[0] ? `${onlineDesc.details[0].label}: ${onlineDesc.details[0].value}` : 'Deleted'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs space-y-1.5 font-mono">
                  <div>
                    <span className="text-[#526782] dark:text-[#A8B8CE] block text-[10px]">Record:</span>
                    <span className="font-semibold">{onlineDesc.heading}</span>
                  </div>
                  {onlineDesc.details.map((line, idx) => (
                    <div key={idx} className="text-[11px] text-[#071A3A] dark:text-[#EDF4FF] break-words">
                      <span className="text-[#526782] dark:text-[#A8B8CE]">{line.label}: </span>
                      <span>{line.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleResolve('online')}
              className="w-full py-2 rounded-xl bg-[#071A3A] dark:bg-slate-700 text-white text-xs font-semibold hover:bg-black dark:hover:bg-slate-600 cursor-pointer"
            >
              {remoteButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

