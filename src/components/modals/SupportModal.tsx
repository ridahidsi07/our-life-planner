import React, { useMemo, useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { Modal } from '../ui/Modal';
import {
  Mail,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Laptop,
  Database,
  Info,
} from 'lucide-react';
import {
  SUPPORT_EMAIL,
  SupportCategory,
  SupportDeliveryResult,
  buildSupportMailtoUrl,
  formatSupportDiagnostics,
  formatSupportMessageText,
  getConfiguredSupportEndpoint,
  submitSupportRequest,
} from '../../utils/supportDelivery';

export const SupportModal: React.FC = () => {
  const { activeModal, setActiveModal, settings } = usePlanner();

  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedDiag, setCopiedDiag] = useState(false);
  const [copiedPreparedMessage, setCopiedPreparedMessage] = useState(false);
  const [openedMailClientNotice, setOpenedMailClientNotice] = useState(false);

  // Composer state
  const [name, setName] = useState(settings.ownerName);
  const [email, setEmail] = useState(settings.email || '');
  const [category, setCategory] = useState<SupportCategory>('general');
  const [message, setMessage] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState<SupportDeliveryResult | null>(null);

  const configuredEndpoint = getConfiguredSupportEndpoint();
  const diagnosticsText = useMemo(() => formatSupportDiagnostics(settings), [settings]);

  const draftInput = useMemo(
    () => ({
      name,
      email,
      category,
      message,
      includeDiagnostics,
      diagnosticsText,
    }),
    [name, email, category, message, includeDiagnostics, diagnosticsText]
  );

  const formattedMessage = useMemo(() => formatSupportMessageText(draftInput), [draftInput]);
  const composedMailtoUrl = useMemo(
    () => buildSupportMailtoUrl(draftInput, SUPPORT_EMAIL),
    [draftInput]
  );
  const directMailtoUrl = useMemo(() => buildSupportMailtoUrl(undefined, SUPPORT_EMAIL), []);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch (e) {
      console.warn('Clipboard write failed', e);
    }
  };

  const handleCopyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(diagnosticsText);
      setCopiedDiag(true);
      setTimeout(() => setCopiedDiag(false), 2000);
    } catch (e) {
      console.warn('Clipboard write failed', e);
    }
  };

  const handleCopyPreparedMessage = async () => {
    try {
      await navigator.clipboard.writeText(formattedMessage.fullClipboardText);
      setCopiedPreparedMessage(true);
      setTimeout(() => setCopiedPreparedMessage(false), 2500);
    } catch (e) {
      console.warn('Clipboard write failed', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpenedMailClientNotice(false);
    setIsSubmitting(true);
    try {
      const result = await submitSupportRequest(draftInput);
      setDeliveryResult(result);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setMessage('');
    setDeliveryResult(null);
    setOpenedMailClientNotice(false);
  };

  return (
    <Modal
      isOpen={activeModal === 'support'}
      onClose={() => setActiveModal(null)}
      title="Contact Support & Troubleshooting"
      subtitle="Direct email contact, local data recovery tools, and environment diagnostics"
      maxWidth="max-w-xl"
    >
      <div className="space-y-4 text-xs text-[#071A3A] dark:text-[#EDF4FF]">
        {/* Direct Support Contact Card */}
        <div className="p-4 rounded-2xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/60 space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-bold text-xs text-[#087F83] dark:text-[#38D0C5] flex items-center gap-1.5">
                <Mail className="w-4 h-4" />
                <span>Direct Support Email</span>
              </div>
              <div className="text-sm font-mono font-bold text-[#071A3A] dark:text-[#EDF4FF] mt-1 select-all">
                {SUPPORT_EMAIL}
              </div>
              <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE] mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#087F83]" />
                <span>Hours: Monday to Friday (replies by email)</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyEmail}
                aria-label="Copy support email address"
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-[#152238] hover:bg-teal-50 text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                {copiedEmail ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[#087F83]" />
                )}
                <span>{copiedEmail ? 'Copied!' : 'Copy Email'}</span>
              </button>

              <a
                href={directMailtoUrl}
                onClick={() => setOpenedMailClientNotice(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#087F83] text-white hover:bg-[#06676A] text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Email Support</span>
              </a>
            </div>
          </div>

          <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE] leading-relaxed">
            <strong>How to send your request:</strong> Because Our Life Planner runs locally in your browser without a background server, messages are not sent automatically from this window. Click <strong>Open in Email App</strong> below to launch your mail client with your draft pre-filled, or click <strong>Copy Prepared Message</strong> and paste it into any email service addressed to <span className="font-mono font-semibold">{SUPPORT_EMAIL}</span>.
          </p>
        </div>

        {/* Truthful Data Recovery & Self-Service Help Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="font-bold text-xs text-[#071A3A] dark:text-[#EDF4FF] flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#087F83] dark:text-[#38D0C5]" />
            <span>Need help with missing or overwritten planner data?</span>
          </div>
          <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
            Your planner records are stored exclusively in this browser&apos;s local storage (<code className="font-mono">localStorage</code>). Support cannot remotely view or recover your local database, but you can restore a saved JSON backup or roll back to an automatic pre-restore snapshot in the Backup &amp; Restore Manager.
          </p>
          <div className="flex flex-wrap gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setActiveModal('backup_restore')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-[#087F83] dark:text-[#38D0C5] hover:bg-teal-50/50 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Open Backup &amp; Restore Manager</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('guide')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] hover:bg-slate-100 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Open User Guide</span>
            </button>
          </div>
        </div>

        {/* Verified Server Delivery Success (only shown if a real endpoint accepted HTTP 2xx) */}
        {deliveryResult?.delivered === true ? (
          <div
            role="status"
            className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-3 text-center"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                Support Request Accepted by Server
              </h4>
              {deliveryResult.ticketId && (
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-mono mt-0.5">
                  Ticket ID: <span className="font-bold">{deliveryResult.ticketId}</span>
                </p>
              )}
            </div>
            <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE] max-w-md mx-auto">
              The configured support endpoint accepted your message (HTTP {deliveryResult.statusCode}).
            </p>
            <div className="pt-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer hover:bg-white"
              >
                Prepare another message
              </button>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-1.5 rounded-xl bg-[#087F83] text-white text-xs font-semibold hover:bg-[#06676A] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="p-4 rounded-2xl bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-700/80 shadow-2xs space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-[#071A3A] dark:text-[#EDF4FF]">
                Prepare Support Email &amp; Diagnostics
              </h4>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[#526782] dark:text-[#A8B8CE]">
                {configuredEndpoint ? 'Connected endpoint' : 'Email draft helper'}
              </span>
            </div>

            {deliveryResult && !deliveryResult.delivered && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Message not sent automatically</span>
                  <span>{deliveryResult.error}</span>
                </div>
              </div>
            )}

            {openedMailClientNotice && (
              <div
                role="status"
                className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-[11px] flex items-start gap-2"
              >
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Complete sending in your email app</span>
                  <span>
                    Your default mail client was requested with a pre-filled draft to{' '}
                    <span className="font-mono font-semibold">{SUPPORT_EMAIL}</span>. Please press{' '}
                    <strong>Send</strong> inside your email application—this planner does not send emails in the background. If no email app opened, click <strong>Copy Prepared Message</strong> below and paste it into your webmail.
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="support-your-name"
                  className="block text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] mb-1"
                >
                  Your Name
                </label>
                <input
                  id="support-your-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs font-semibold"
                />
              </div>

              <div>
                <label
                  htmlFor="support-your-email"
                  className="block text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] mb-1"
                >
                  Your Reply-To Email
                </label>
                <input
                  id="support-your-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="support-category"
                className="block text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] mb-1"
              >
                Category
              </label>
              <select
                id="support-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as SupportCategory)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs font-semibold"
              >
                <option value="general">General Question</option>
                <option value="bug">Bug Report / Defect</option>
                <option value="recovery">Data Backup &amp; Recovery Help</option>
                <option value="feature">Feature Suggestion</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="support-message"
                className="block text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] mb-1"
              >
                How can we help? *
              </label>
              <textarea
                id="support-message"
                required
                rows={4}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (deliveryResult) setDeliveryResult(null);
                }}
                placeholder="Describe what you are experiencing or what you need assistance with..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs focus:ring-2 focus:ring-[#087F83]"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeDiagnostics}
                  onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                  className="rounded text-[#087F83] focus:ring-[#087F83]"
                />
                <span className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                  Include environment diagnostics (Browser, OS, Edition)
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPreparedMessage}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#0B1220] hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer transition-colors"
                >
                  {copiedPreparedMessage ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#087F83]" />
                  )}
                  <span>
                    {copiedPreparedMessage ? 'Copied Message & Diagnostics!' : 'Copy Prepared Message'}
                  </span>
                </button>

                <a
                  href={composedMailtoUrl}
                  onClick={() => setOpenedMailClientNotice(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#087F83] text-white hover:bg-[#06676A] text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Email App</span>
                </a>

                {configuredEndpoint && (
                  <button
                    type="submit"
                    disabled={isSubmitting || !message.trim()}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50 text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Sending…' : 'Submit to Support Server'}</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        {/* System Diagnostics Info Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="font-bold text-[11px] text-[#526782] dark:text-[#A8B8CE] flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5" />
              <span>Diagnostic Information</span>
            </div>
            <div className="text-[10px] text-[#526782] dark:text-[#A8B8CE] font-mono">
              Version 1.0.0 · Edition: {settings.edition} · Timezone: {settings.timeZone}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyDiagnostics}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-white text-[10px] font-semibold cursor-pointer"
          >
            {copiedDiag ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            <span>{copiedDiag ? 'Copied' : 'Copy Diagnostics'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
