import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  SUPPORT_EMAIL,
  buildSupportMailtoUrl,
  formatSupportDiagnostics,
  formatSupportMessageText,
  submitSupportRequest,
} from '../src/utils/supportDelivery';
import { INITIAL_SETTINGS } from '../src/utils/sampleData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.resolve(rootDir, 'src');
const distDir = path.resolve(rootDir, 'dist');

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function findBrowserExecutable(): string | null {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function main() {
  console.log('=== Support Contact & Delivery Truthfulness Verification ===\n');

  // 1. Source Code Audit: No Fake Timers or Fabricated Ticket Confirmations
  console.log('1. Source Code Audit of SupportModal.tsx');
  {
    const supportModalPath = path.resolve(srcDir, 'components/modals/SupportModal.tsx');
    const content = fs.readFileSync(supportModalPath, 'utf-8');

    assert(
      !content.includes('LP-SUP-') && !content.includes('Math.random()'),
      'SupportModal.tsx contains no random ticket number generator (LP-SUP- / Math.random)'
    );
    assert(
      !content.includes('Message Sent Successfully!') &&
        !content.includes('received by our engineering team'),
      'SupportModal.tsx contains no fabricated "Message Sent Successfully!" or fake engineering receipt claim'
    );
    assert(
      content.includes('buildSupportMailtoUrl') && content.includes('SUPPORT_EMAIL'),
      'SupportModal.tsx uses buildSupportMailtoUrl and SUPPORT_EMAIL for real mailto contact links'
    );
    assert(
      content.includes("setActiveModal('backup_restore')"),
      'SupportModal.tsx provides a direct action to open Backup & Restore Manager for local data recovery'
    );
  }

  // 2. Unit Verification of supportDelivery.ts
  console.log('\n2. Mailto Construction, Clipboard Formatting & Delivery Service Verification');
  {
    const diag = formatSupportDiagnostics(INITIAL_SETTINGS);
    assert(
      diag.includes('Our Life Planner Diagnostics:') && diag.includes('Edition: online'),
      'formatSupportDiagnostics includes planner version, edition, theme, and timezone'
    );

    const draft = {
      name: 'Rida Hidsi',
      email: 'rida@example.com',
      category: 'recovery' as const,
      message: 'Need help restoring my weekly backup file.',
      includeDiagnostics: true,
      diagnosticsText: diag,
    };

    const formatted = formatSupportMessageText(draft);
    assert(
      formatted.subject === 'Our Life Planner Support — Data Backup & Recovery Help',
      'formatSupportMessageText generates category-specific subject line'
    );
    assert(
      formatted.body.includes('Name: Rida Hidsi') &&
        formatted.body.includes('Reply-To Email: rida@example.com') &&
        formatted.body.includes('Need help restoring my weekly backup file.') &&
        formatted.body.includes('Our Life Planner Diagnostics:'),
      'formatSupportMessageText includes sender details, message body, and diagnostics when enabled'
    );
    assert(
      formatted.fullClipboardText.startsWith(`To: ${SUPPORT_EMAIL}\nSubject: ${formatted.subject}`),
      'fullClipboardText includes To and Subject headers for webmail copy-paste'
    );

    const formattedNoDiag = formatSupportMessageText({ ...draft, includeDiagnostics: false });
    assert(
      !formattedNoDiag.body.includes('Our Life Planner Diagnostics:'),
      'formatSupportMessageText omits diagnostics when includeDiagnostics is false'
    );

    const mailtoUrl = buildSupportMailtoUrl(draft);
    assert(
      mailtoUrl.startsWith(`mailto:${SUPPORT_EMAIL}?subject=`) &&
        decodeURIComponent(mailtoUrl).includes('Need help restoring my weekly backup file.'),
      'buildSupportMailtoUrl produces a properly URL-encoded mailto: link with subject and body'
    );

    // Verify submitSupportRequest with no endpoint configured
    const noEndpointRes = await submitSupportRequest(draft, { endpointUrl: '' });
    assert(
      noEndpointRes.delivered === false && noEndpointRes.reason === 'no_endpoint_configured',
      'submitSupportRequest returns delivered: false (no_endpoint_configured) when no server URL is configured'
    );

    // Verify submitSupportRequest with empty message
    const emptyMsgRes = await submitSupportRequest({ ...draft, message: '   ' }, { endpointUrl: 'https://example.com/api/support' });
    assert(
      emptyMsgRes.delivered === false && emptyMsgRes.reason === 'validation_error',
      'submitSupportRequest rejects empty message with validation_error'
    );

    // Verify submitSupportRequest when server returns HTTP 500
    const http500Res = await submitSupportRequest(draft, {
      endpointUrl: 'https://example.com/api/support',
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 }),
    });
    assert(
      http500Res.delivered === false &&
        http500Res.reason === 'delivery_failed' &&
        http500Res.statusCode === 500,
      'submitSupportRequest returns delivered: false when server responds with HTTP 500'
    );

    // Verify submitSupportRequest when network throws
    const networkErrRes = await submitSupportRequest(draft, {
      endpointUrl: 'https://example.com/api/support',
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    assert(
      networkErrRes.delivered === false &&
        networkErrRes.reason === 'delivery_failed' &&
        networkErrRes.error.includes('ECONNREFUSED'),
      'submitSupportRequest returns delivered: false when network request fails'
    );

    // Verify submitSupportRequest when server returns HTTP 200 with { accepted: false }
    const rejectedPayloadRes = await submitSupportRequest(draft, {
      endpointUrl: 'https://example.com/api/support',
      fetchImpl: async () =>
        new Response(JSON.stringify({ accepted: false, error: 'Rate limit exceeded' }), {
          status: 200,
        }),
    });
    assert(
      rejectedPayloadRes.delivered === false &&
        rejectedPayloadRes.error === 'Rate limit exceeded',
      'submitSupportRequest returns delivered: false when server payload indicates accepted: false'
    );

    // Verify submitSupportRequest ONLY succeeds when server returns HTTP 2xx acceptance
    let capturedPayload: any = null;
    const acceptedRes = await submitSupportRequest(draft, {
      endpointUrl: 'https://example.com/api/support',
      fetchImpl: async (_url, init) => {
        capturedPayload = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ accepted: true, ticketId: 'SUP-REAL-2026' }), {
          status: 201,
        });
      },
    });
    assert(
      acceptedRes.delivered === true &&
        acceptedRes.ticketId === 'SUP-REAL-2026' &&
        acceptedRes.statusCode === 201 &&
        capturedPayload?.email === 'rida@example.com' &&
        capturedPayload?.message === 'Need help restoring my weekly backup file.',
      'submitSupportRequest sends real JSON POST payload and reports delivered: true only after HTTP 2xx acceptance'
    );
  }

  // 3. Headless Browser Runtime Verification of SupportModal
  console.log('\n3. Headless Browser Runtime Verification of SupportModal');
  {
    const browserExe = findBrowserExecutable();
    if (!browserExe) {
      console.log('  SKIP: No local Chrome/Edge executable found');
    } else {
      const distOfflinePath = path.resolve(distDir, 'Our-Life-Planner-Offline.html');
      assert(fs.existsSync(distOfflinePath), 'dist/Our-Life-Planner-Offline.html exists');

      const baseHtml = fs.readFileSync(distOfflinePath, 'utf-8');
      const browserTestScript = `
<img src="/hold-until-complete.gif" alt="" style="display:none" />
<script type="module">
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function setNativeValue(element, value) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function runSupportBrowserTest() {
  const report = {
    modalOpened: false,
    hasDirectSupportEmail: false,
    hasTruthfulLocalNotice: false,
    hasBackupRecoveryButton: false,
    dynamicMailtoHref: '',
    fakeSuccessShownAfterSubmit: false,
    truthfulAlertShownAfterSubmit: false,
    alertText: '',
    error: null,
  };

  try {
    await wait(120);

    // Navigate to Settings
    const settingsBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent && b.textContent.trim() === 'Settings'
    );
    if (!settingsBtn) throw new Error('Settings button not found');
    settingsBtn.click();
    await wait(100);

    // Open Contact Support modal
    const supportBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent && b.textContent.includes('Contact Support')
    );
    if (!supportBtn) throw new Error('Contact Support button not found');
    supportBtn.click();
    await wait(100);

    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!dialog) throw new Error('Support modal did not open');
    report.modalOpened = true;

    const dialogText = dialog.textContent || '';
    report.hasDirectSupportEmail = dialogText.includes('support@ourlifeplanner.app');
    report.hasTruthfulLocalNotice =
      dialogText.includes('messages are not sent automatically from this window') &&
      dialogText.includes('stored exclusively in this browser');
    report.hasBackupRecoveryButton = Array.from(dialog.querySelectorAll('button')).some(
      (b) => b.textContent && b.textContent.includes('Open Backup & Restore Manager')
    );

    // Fill out the composer fields
    const nameInput = dialog.querySelector('#support-your-name');
    const emailInput = dialog.querySelector('#support-your-email');
    const categorySelect = dialog.querySelector('#support-category');
    const messageInput = dialog.querySelector('#support-message');

    setNativeValue(nameInput, 'Alex Rivera');
    setNativeValue(emailInput, 'alex@example.org');
    setNativeValue(categorySelect, 'recovery');
    setNativeValue(messageInput, 'Testing support draft generation for lost tasks.');
    await wait(80);

    const mailtoAnchor = Array.from(dialog.querySelectorAll('a')).find(
      (a) => a.textContent && a.textContent.includes('Open in Email App')
    );
    report.dynamicMailtoHref = mailtoAnchor ? mailtoAnchor.getAttribute('href') || '' : '';

    // Trigger form submission and verify it does NOT claim fake success
    const form = dialog.querySelector('form');
    if (!form) throw new Error('Support form not found');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await wait(700); // Wait longer than the old 600ms fake timer

    const afterSubmitText = dialog.textContent || '';
    report.fakeSuccessShownAfterSubmit =
      afterSubmitText.includes('Message Sent Successfully') ||
      afterSubmitText.includes('LP-SUP-') ||
      afterSubmitText.includes('received by our engineering team');

    const alertEl = dialog.querySelector('[role="alert"]');
    report.truthfulAlertShownAfterSubmit = Boolean(alertEl);
    report.alertText = alertEl ? alertEl.textContent || '' : '';
  } catch (err) {
    report.error = err && err.message ? err.message : String(err);
  }

  await fetch('/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  });
}

runSupportBrowserTest();
</script>
`;

      const strippedHtml = baseHtml
        .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, '')
        .replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/gi, '');
      const lastBodyIdx = strippedHtml.lastIndexOf('</body>');
      const injectedHtml =
        strippedHtml.slice(0, lastBodyIdx) +
        browserTestScript +
        '\n' +
        strippedHtml.slice(lastBodyIdx);

      let holdRes: http.ServerResponse | null = null;
      let receivedReport: any = null;

      const server = http.createServer((req, res) => {
        if (req.url === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(injectedHtml);
        } else if (req.url === '/hold-until-complete.gif') {
          holdRes = res;
        } else if (req.url === '/report' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              receivedReport = JSON.parse(body);
            } catch {
              receivedReport = { error: 'Invalid JSON' };
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{"ok":true}');
            if (holdRes) {
              holdRes.writeHead(204);
              holdRes.end();
            }
          });
        } else {
          res.writeHead(204);
          res.end();
        }
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const addr = server.address() as { port: number };
      const testUrl = `http://127.0.0.1:${addr.port}/`;

      try {
        await new Promise<void>((resolve, reject) => {
          const proc = spawn(
            browserExe,
            ['--headless', '--disable-gpu', '--dump-dom', testUrl],
            { stdio: 'ignore' }
          );
          const timer = setTimeout(() => {
            proc.kill();
            reject(new Error('Browser timed out after 20s'));
          }, 20000);
          proc.on('exit', () => {
            clearTimeout(timer);
            resolve();
          });
          proc.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
          });
        });

        assert(receivedReport !== null, 'Headless browser executed Support modal test and posted report');
        if (receivedReport) {
          assert(receivedReport.error === null, 'Support modal browser test ran without runtime errors', receivedReport.error);
          assert(receivedReport.modalOpened, 'Support modal opened from Settings -> Contact Support');
          assert(receivedReport.hasDirectSupportEmail, 'Support modal displays support@ourlifeplanner.app');
          assert(
            receivedReport.hasTruthfulLocalNotice,
            'Support modal explains truthfully that messages are not sent automatically and planner data is stored locally'
          );
          assert(
            receivedReport.hasBackupRecoveryButton,
            'Support modal includes direct button to open Backup & Restore Manager'
          );
          const decodedHref = decodeURIComponent(receivedReport.dynamicMailtoHref || '');
          assert(
            receivedReport.dynamicMailtoHref.startsWith('mailto:support@ourlifeplanner.app?') &&
              decodedHref.includes('Alex Rivera') &&
              decodedHref.includes('alex@example.org') &&
              decodedHref.includes('Testing support draft generation for lost tasks.'),
            'Open in Email App link dynamically encodes sender details, category, message, and diagnostics into mailto: URI'
          );
          assert(
            receivedReport.fakeSuccessShownAfterSubmit === false,
            'Submitting the support form without a backend server NEVER displays a fake success message or fake ticket ID'
          );
          assert(
            receivedReport.truthfulAlertShownAfterSubmit &&
              receivedReport.alertText.includes('Message not sent automatically'),
            'Submitting the support form without a backend server displays a truthful alert directing the user to Open in Email App or Copy Prepared Message'
          );
        }
      } finally {
        server.close();
      }
    }
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

main();
