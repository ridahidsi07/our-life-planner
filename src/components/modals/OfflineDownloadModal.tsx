import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import { Download, Check, ShieldCheck } from 'lucide-react';

export const OfflineDownloadModal: React.FC = () => {
  const { activeModal, setActiveModal, exportBackup, generateStandaloneHtml } = usePlanner();
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const backupData = exportBackup();
      backupData.settings = {
        ...backupData.settings,
        edition: 'downloaded',
      };
      const serializedData = JSON.stringify(backupData);

      let htmlTemplate = '';
      try {
        const res = await fetch('/Our-Life-Planner-Offline.html');
        if (res.ok) {
          htmlTemplate = await res.text();
        }
      } catch (e) {
        console.warn('Could not fetch standalone template from server', e);
      }

      let finalHtml = '';
      if (htmlTemplate && htmlTemplate.includes('embedded-planner-bootstrap-data')) {
        finalHtml = htmlTemplate.replace(
          /<!--BOOTSTRAP_DATA_PLACEHOLDER-->|<script id="embedded-planner-bootstrap-data"[^>]*>[\s\S]*?<\/script>/,
          `<script id="embedded-planner-bootstrap-data" type="application/json">\n${serializedData}\n</script>`
        );
      } else if (document.getElementById('embedded-planner-bootstrap-data')) {
        // We are already running inside the standalone offline app bundle!
        const currentDoc = '<!DOCTYPE html>\n<html lang="en">' + document.documentElement.outerHTML + '</html>';
        finalHtml = currentDoc.replace(
          /<script id="embedded-planner-bootstrap-data"[^>]*>[\s\S]*?<\/script>/,
          `<script id="embedded-planner-bootstrap-data" type="application/json">\n${serializedData}\n</script>`
        );
      } else {
        finalHtml = generateStandaloneHtml();
      }

      const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Our-Life-Planner-Offline.html';
      a.click();
      URL.revokeObjectURL(url);
      setHasDownloaded(true);
    } catch (err) {
      console.error('Error generating offline bundle:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Modal
      isOpen={activeModal === 'download_offline'}
      onClose={() => setActiveModal(null)}
      title="Download offline edition"
      subtitle="Independent standalone HTML planner"
    >
      <div className="space-y-4 text-xs">
        <p className="text-[#526782]">
          You can download a self-contained HTML application that runs locally in any web browser (Chrome, Safari, Firefox, Edge) without requiring an internet connection or server.
        </p>

        <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 text-[#087F83] dark:text-[#38D0C5] space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Guaranteed offline privacy</span>
          </div>
          <p className="text-[11px] opacity-90">
            All data persists in the browser's local database on your device. Reconnecting never uploads this offline edition automatically.
          </p>
        </div>

        {hasDownloaded && (
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 flex items-center gap-2 font-semibold">
            <Check className="w-4 h-4" />
            <span>Downloaded Our-Life-Planner-Offline.html! Double-click to open.</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setActiveModal(null)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#526782]"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isDownloading ? 'Packaging application…' : 'Download HTML app'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
