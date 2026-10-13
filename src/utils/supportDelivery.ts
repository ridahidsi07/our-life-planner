import { UserSettings } from '../types/planner';
import { APP_VERSION, SUPPORT_EMAIL } from './releaseInfo';

export { SUPPORT_EMAIL };

export type SupportCategory = 'general' | 'bug' | 'recovery' | 'feature';

export interface SupportDraftInput {
  name: string;
  email: string;
  category: SupportCategory;
  message: string;
  includeDiagnostics: boolean;
  diagnosticsText: string;
}

export type SupportDeliveryResult =
  | {
      delivered: true;
      ticketId?: string;
      statusCode: number;
    }
  | {
      delivered: false;
      reason: 'validation_error' | 'no_endpoint_configured' | 'delivery_failed';
      error: string;
      statusCode?: number;
    };

const CATEGORY_LABELS: Record<SupportCategory, string> = {
  general: 'General Question',
  bug: 'Bug Report / Defect',
  recovery: 'Data Backup & Recovery Help',
  feature: 'Feature Suggestion',
};

export function getSupportCategoryLabel(category: SupportCategory): string {
  return CATEGORY_LABELS[category] || 'General Question';
}

export function formatSupportDiagnostics(
  settings: Pick<UserSettings, 'edition' | 'theme' | 'timeZone' | 'weekStartsOn'>
): string {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
  const platform = typeof navigator !== 'undefined' ? navigator.platform : 'Unknown';
  let storageAvailable = 'Unavailable';
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      storageAvailable = 'LocalStorage available';
    }
  } catch {
    storageAvailable = 'LocalStorage restricted';
  }

  return [
    'Our Life Planner Diagnostics:',
    `Version: ${APP_VERSION}`,
    `Edition: ${settings.edition}`,
    `Theme: ${settings.theme}`,
    `Timezone: ${settings.timeZone}`,
    `Week starts: ${settings.weekStartsOn}`,
    `Browser: ${userAgent}`,
    `Platform: ${platform}`,
    `Storage: ${storageAvailable}`,
  ].join('\n');
}

export function formatSupportMessageText(input: SupportDraftInput): {
  subject: string;
  body: string;
  fullClipboardText: string;
} {
  const categoryLabel = getSupportCategoryLabel(input.category);
  const cleanName = input.name.trim() || 'Planner User';
  const cleanEmail = input.email.trim() || 'Not provided';
  const cleanMessage = input.message.trim();

  const subject = `Our Life Planner Support — ${categoryLabel}`;

  const bodySections: string[] = [
    `Name: ${cleanName}`,
    `Reply-To Email: ${cleanEmail}`,
    `Category: ${categoryLabel}`,
    '',
    'Message:',
    cleanMessage || '(Describe your question or issue here)',
  ];

  if (input.includeDiagnostics && input.diagnosticsText.trim()) {
    bodySections.push('', '---', input.diagnosticsText.trim());
  }

  const body = bodySections.join('\n');
  const fullClipboardText = [`To: ${SUPPORT_EMAIL}`, `Subject: ${subject}`, '', body].join('\n');

  return {
    subject,
    body,
    fullClipboardText,
  };
}

export function buildSupportMailtoUrl(
  input?: Partial<SupportDraftInput>,
  recipientEmail: string = SUPPORT_EMAIL
): string {
  if (!input) {
    return `mailto:${recipientEmail}?subject=${encodeURIComponent('Our Life Planner Support Request')}`;
  }

  const formatted = formatSupportMessageText({
    name: input.name ?? '',
    email: input.email ?? '',
    category: input.category ?? 'general',
    message: input.message ?? '',
    includeDiagnostics: input.includeDiagnostics ?? true,
    diagnosticsText: input.diagnosticsText ?? '',
  });

  return `mailto:${recipientEmail}?subject=${encodeURIComponent(formatted.subject)}&body=${encodeURIComponent(formatted.body)}`;
}

export function getConfiguredSupportEndpoint(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const raw = env?.VITE_SUPPORT_ENDPOINT_URL;
    return typeof raw === 'string' ? raw.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Attempts to deliver a support request to a real HTTP endpoint.
 * Never fabricates delivery success or ticket numbers when no endpoint is configured
 * or when the endpoint rejects or fails the request.
 */
export async function submitSupportRequest(
  input: SupportDraftInput,
  options?: {
    endpointUrl?: string;
    fetchImpl?: typeof fetch;
  }
): Promise<SupportDeliveryResult> {
  if (!input.message || !input.message.trim()) {
    return {
      delivered: false,
      reason: 'validation_error',
      error: 'Please enter a message before submitting.',
    };
  }

  const endpointUrl = (options?.endpointUrl ?? getConfiguredSupportEndpoint()).trim();
  if (!endpointUrl) {
    return {
      delivered: false,
      reason: 'no_endpoint_configured',
      error:
        'Direct in-app message delivery is not connected in this local browser edition. Please click "Open in Email App" or "Copy Prepared Message" below to email support@ourlifeplanner.app directly.',
    };
  }

  const fetchFn = options?.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetchFn) {
    return {
      delivered: false,
      reason: 'delivery_failed',
      error:
        'Network requests are unavailable in this environment. Please email support@ourlifeplanner.app directly.',
    };
  }

  const formatted = formatSupportMessageText(input);

  try {
    const response = await fetchFn(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        name: input.name.trim(),
        email: input.email.trim(),
        category: input.category,
        subject: formatted.subject,
        message: input.message.trim(),
        diagnostics: input.includeDiagnostics ? input.diagnosticsText : undefined,
      }),
    });

    if (!response.ok) {
      return {
        delivered: false,
        reason: 'delivery_failed',
        statusCode: response.status,
        error: `Support server returned HTTP ${response.status}. Your message was not delivered. Please use the email link or copy your message below to contact ${SUPPORT_EMAIL}.`,
      };
    }

    let ticketId: string | undefined;
    try {
      const data = await response.json();
      if (data && typeof data === 'object') {
        if (data.accepted === false || data.ok === false) {
          return {
            delivered: false,
            reason: 'delivery_failed',
            statusCode: response.status,
            error:
              typeof data.error === 'string'
                ? data.error
                : `Support service did not accept the request. Please email ${SUPPORT_EMAIL} directly.`,
          };
        }
        if (typeof data.ticketId === 'string' && data.ticketId.trim()) {
          ticketId = data.ticketId.trim();
        } else if (typeof data.id === 'string' && data.id.trim()) {
          ticketId = data.id.trim();
        }
      }
    } catch {
      // Response body may be empty on 200/202/204 acceptance
    }

    return {
      delivered: true,
      ticketId,
      statusCode: response.status,
    };
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'Network error';
    return {
      delivered: false,
      reason: 'delivery_failed',
      error: `Could not reach support delivery service (${detail}). Your message was not sent. Please use "Open in Email App" or copy your prepared message below to email ${SUPPORT_EMAIL}.`,
    };
  }
}
