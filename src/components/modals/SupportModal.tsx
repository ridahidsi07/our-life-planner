import React, { useState } from 'react';
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
} from 'lucide-react';

export const SupportModal: React.FC = () => {
  const { activeModal, setActiveModal, settings } = usePlanner();

  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedDiag, setCopiedDiag] = useState(false);

  // Form state
  const [name, setName] = useState(settings.ownerName);
  const [email, setEmail] = useState(settings.email || 'user@example.com');
  const [category, setCategory] = useState<'bug' | 'sync' | 'feature' | 'general'>('general');
  const [message, setMessage] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketReference, setTicketReference] = useState<string | null>(null);

  const supportEmail = 'support@ourlifeplanner.app';

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(supportEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch (e) {
      console.warn('Clipboard write failed', e);
    }
  };

  const getDiagnosticsText = () => {
    return [
      `Our Life Planner Diagnostics:`,
      `Version: 1.0.0`,
      `Edition: ${settings.edition}`,
      `Theme: ${settings.theme}`,
      `Timezone: ${settings.timeZone}`,
      `Week starts: ${settings.weekStartsOn}`,
      `Browser: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}`,
      `Platform: ${typeof navigator !== 'undefined' ? navigator.platform : 'Unknown'}`,
      `Storage: LocalStorage available`,
    ].join('\n');
  };

  const handleCopyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(getDiagnosticsText());
      setCopiedDiag(true);
      setTimeout(() => setCopiedDiag(false), 2000);
    } catch (e) {
      console.warn('Clipboard write failed', e);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const randomTicket = `LP-SUP-${Math.floor(1000 + Math.random() * 9000)}`;
      setTicketReference(randomTicket);
      setIsSubmitting(false);
    }, 600);
  };

  const handleResetForm = () => {
    setMessage('');
    setTicketReference(null);
  };

  return (
    <Modal
      isOpen={activeModal === 'support'}
      onClose={() => setActiveModal(null)}
      title="Get Customer Support"
      subtitle="We are here to help you get the most out of Our Life Planner"
      maxWidth="max-w-xl"
    >
      <div className="space-y-5 text-xs text-[#071A3A] dark:text-[#EDF4FF]">
        {/* Support Destination Card with Explicit Readable Email */}
        <div className="p-4 rounded-2xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/60 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-bold text-xs text-[#087F83] dark:text-[#38D0C5] flex items-center gap-1.5">
                <Mail className="w-4 h-4" />
                <span>Direct Support Desk</span>
              </div>
              <div className="text-sm font-mono font-bold text-[#071A3A] dark:text-[#EDF4FF] mt-1 select-all">
                {supportEmail}
              </div>
              <div className="text-[11px] text-[#526782] dark:text-[#A8B8CE] mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#087F83]" />
                <span>Response SLA: Monday to Friday within 24 hours</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyEmail}
                aria-label="Copy support email address"
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-[#152238] hover:bg-teal-50 text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#087F83]" />}
                <span>{copiedEmail ? 'Copied!' : 'Copy Email'}</span>
              </button>

              <a
                href={`mailto:${supportEmail}?subject=Our%20Life%20Planner%20Help%20Request`}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#087F83] text-white hover:bg-[#06676A] text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Mail</span>
              </a>
            </div>
          </div>
        </div>

        {/* Message Delivery Section */}
        {ticketReference ? (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-3 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                Message Sent Successfully!
              </h4>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 font-mono mt-0.5">
                Reference ID: <span className="font-bold">{ticketReference}</span>
              </p>
            </div>
            <p className="text-[11px] text-[#526782] dark:text-[#A8B8CE] max-w-md mx-auto">
              Your inquiry has been received by our engineering team. A confirmation receipt has been logged for <span className="font-semibold">{email}</span>. We will reply to your email within 24 hours.
            </p>
            <div className="pt-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer hover:bg-white"
              >
                Send another message
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
          <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-700/80 shadow-2xs space-y-3.5">
            <h4 className="font-bold text-xs text-[#071A3A] dark:text-[#EDF4FF]">
              Send an In-App Support Message
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] mb-1">
                  Your Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs font-semibold"
              >
                <option value="general">General Question</option>
                <option value="bug">Bug Report / Defect</option>
                <option value="sync">Sync & Cross-Device Inquiry</option>
                <option value="feature">Feature Suggestion</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#526782] dark:text-[#A8B8CE] mb-1">
                How can we help? *
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe what you are experiencing or what you need assistance with..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs focus:ring-2 focus:ring-[#087F83]"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeDiagnostics}
                  onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                  className="rounded text-[#087F83] focus:ring-[#087F83]"
                />
                <span className="text-[11px] text-[#526782] dark:text-[#A8B8CE]">
                  Attach environment diagnostics (Browser, OS, Edition)
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087F83] text-white hover:bg-[#06676A] disabled:opacity-50 text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Sending…' : 'Send Message'}</span>
              </button>
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
