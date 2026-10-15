import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import { Download, Check, ShieldCheck, AlertCircle, Copy, RefreshCw, Database } from 'lucide-react';
import { injectBootstrapDataIntoHtml } from '../../utils/standaloneHtml';
import { OFFLINE_FILE_NAME } from '../../utils/releaseInfo';

export const OfflineDownloadModal: React.FC = () => {
  const { activeModal, setActiveModal, exportBackup, generateStandaloneHtml } = usePlanner();
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    setCopySuccess(false);

    try {
      const backupData = exportBackup();
      backupData.settings = {
        ...backupData.settings,
        edition: 'downloaded',
      };

      let htmlTemplate = '';
      try {
        const res = await fetch(`/${OFFLINE_FILE_NAME}`);
        if (res.ok) {
          htmlTemplate = await res.text();
        }
      } catch (e) {
        console.warn('Could not fetch standalone template from server:', e);
      }

      let finalHtml = '';
      if (htmlTemplate && htmlTemplate.includes('embedded-planner-bootstrap-data')) {
        finalHtml = injectBootstrapDataIntoHtml(htmlTemplate, backupData);
      } else if (typeof document !== 'undefined' && document.getElementById('embedded-planner-bootstrap-data')) {
        // Already running inside the standalone offline app bundle: clone document, clear live #root, and inject safely
        const docClone = document.documentElement.cloneNode(true) as HTMLElement;
        const rootClone = docClone.querySelector('#root');
        if (rootClone) {
          rootClone.innerHTML = '';
        }
        const currentDoc = `<!DOCTYPE html>\n${docClone.outerHTML}`;
        finalHtml = injectBootstrapDataIntoHtml(currentDoc, backupData);
      } else {
        finalHtml = generateStandaloneHtml();
      }

      if (!finalHtml || typeof finalHtml !== 'string' || finalHtml.length < 100) {
        throw new Error('Generated bundle content is empty or incomplete.');
      }

      const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = OFFLINE_FILE_NAME;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      }, 500);

      setHasDownloaded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown download error';
      console.error('Error generating offline bundle:', err);
      setDownloadError(`Unable to save ${OFFLINE_FILE_NAME} automatically (${message}). This can happen if your browser blocks downloads, storage is restricted, or the file system cannot be accessed.`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyBackupData = async () => {
    try {
      const backupData = exportBackup();
      await navigator.clipboard.writeText(JSON.stringify(backupData, null, 2));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      setDownloadError('Clipboard access failed. Please use Settings > Backup & Restore to export your data.');
    }
  };

  return (
    <Modal
      isOpen={activeModal === 'download_offline'}
      onClose={() => {
        setActiveModal(null);
        setDownloadError(null);
      }}
      title="Download offline edition"
      subtitle="Independent standalone HTML planner"
    >
      <div className="space-y-4 text-xs">
        <p className="text-[#526782] dark:text-[#A8B8CE]">
          You can download a self-contained HTML application that runs locally in any modern web browser (Edge, Chrome, Safari, Firefox) without requiring an internet connection or server.
        </p>

        <div className="p-3.5 rounded-xl bg-[var(--accent-soft)] border border-[var(--border-color)] text-[var(--accent)] space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Guaranteed offline privacy</span>
          </div>
          <p className="text-[11px] opacity-90">
            All data persists in the browser's local database on your device. Reconnecting to the internet never uploads this offline edition automatically.
          </p>
        </div>

        {downloadError && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 space-y-2.5"
          >
            <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Download failed</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {downloadError}
            </p>
            <div className="pt-1 flex flex-wrap gap-2 text-[11px]">
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-900 dark:text-rose-100 font-semibold hover:bg-rose-200 dark:hover:bg-rose-900 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry download</span>
              </button>
              <button
                type="button"
                onClick={handleCopyBackupData}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-[#071A3A] dark:text-[#EDF4FF] font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copySuccess ? 'Copied JSON to clipboard!' : 'Copy backup JSON fallback'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('backup_restore')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-[#071A3A] dark:text-[#EDF4FF] font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Database className="w-3 h-3" />
                <span>Go to Backup & Restore</span>
              </button>
            </div>
          </div>
        )}

        {hasDownloaded && !downloadError && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 font-semibold">
            <Check className="w-4 h-4 shrink-0" />
            <span>Downloaded {OFFLINE_FILE_NAME}! Double-click to open in any web browser.</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              setActiveModal(null);
              setDownloadError(null);
            }}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDownload}
            aria-label={`Download HTML app: independent offline planner (${OFFLINE_FILE_NAME})`}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] text-xs font-semibold hover:bg-[var(--btn-primary-hover-bg)] cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isDownloading ? 'Packaging application…' : 'Download HTML app'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
