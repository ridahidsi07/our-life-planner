import { PlannerBackupData } from '../types/planner';

const LT = String.fromCharCode(60);
const SCRIPT_OPEN_PREFIX = `${LT}script`;
const SCRIPT_CLOSE_TAG = `${LT}/script>`;
const HEAD_CLOSE_TAG = `${LT}/head>`;
export const BOOTSTRAP_PLACEHOLDER_TOKEN = `${LT}!--BOOTSTRAP_DATA_PLACEHOLDER-->`;

/**
 * Escapes plain text for safe interpolation into HTML element content or attributes.
 */
export function escapeHtmlText(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Serializes data to JSON that is safe to embed directly inside an HTML <script> element.
 * Escapes <, >, &, U+2028, and U+2029 using standard RFC 8259 Unicode escapes so that
 * strings like "</script>", "<!--", or "<script>" can never terminate or break the script tag,
 * while JSON.parse() restores the exact original characters.
 */
export function safeSerializeJsonForScript(data: unknown): string {
  const rawJson = JSON.stringify(data);
  if (typeof rawJson !== 'string') {
    return 'null';
  }
  return rawJson
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Safely embeds PlannerBackupData into a standalone HTML template.
 * Uses replacement callbacks (() => ...) so that JavaScript $-replacement tokens
 * (such as $$typeof, $&, $', $`) in either the template or the user's records are
 * preserved verbatim without corruption.
 */
export function injectBootstrapDataIntoHtml(
  htmlTemplate: string,
  data: PlannerBackupData
): string {
  const safeJson = safeSerializeJsonForScript(data);
  const bootstrapScriptTag = `${SCRIPT_OPEN_PREFIX} id="embedded-planner-bootstrap-data" type="application/json">\n${safeJson}\n${SCRIPT_CLOSE_TAG}`;

  const existingScriptRegex = new RegExp(
    `${SCRIPT_OPEN_PREFIX}\\b[^>]*id=["']embedded-planner-bootstrap-data["'][^>]*>[\\s\\S]*?${LT}\\/script>`,
    'i'
  );

  if (existingScriptRegex.test(htmlTemplate)) {
    return htmlTemplate.replace(existingScriptRegex, () => bootstrapScriptTag);
  }

  if (htmlTemplate.includes(BOOTSTRAP_PLACEHOLDER_TOKEN)) {
    return htmlTemplate.replace(BOOTSTRAP_PLACEHOLDER_TOKEN, () => safeJson);
  }

  const headCloseRegex = new RegExp(`${LT}\\/head>`, 'i');
  if (headCloseRegex.test(htmlTemplate)) {
    return htmlTemplate.replace(headCloseRegex, () => `${bootstrapScriptTag}\n${HEAD_CLOSE_TAG}`);
  }

  return `${bootstrapScriptTag}\n${htmlTemplate}`;
}

/**
 * Generates a self-contained fallback HTML document with safely serialized bootstrap data.
 */
export function buildStandaloneFallbackHtml(backup: PlannerBackupData): string {
  const safeJson = safeSerializeJsonForScript(backup);
  const safeExportedAt = escapeHtmlText(backup.exportedAt || '');
  const safeOwnerName = escapeHtmlText(backup.settings?.ownerName || 'Owner');
  const tasksCount = Array.isArray(backup.tasks) ? backup.tasks.length : 0;
  const routinesCount = Array.isArray(backup.routines) ? backup.routines.length : 0;
  const billsCount = Array.isArray(backup.bills) ? backup.bills.length : 0;
  const recipesCount = Array.isArray(backup.recipes) ? backup.recipes.length : 0;

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <title>Our Life Planner - Standalone Edition</title>',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `  ${SCRIPT_OPEN_PREFIX} id="embedded-planner-bootstrap-data" type="application/json">\n${safeJson}\n  ${SCRIPT_CLOSE_TAG}`,
    '  <style>',
    '    body { font-family: system-ui, -apple-system, sans-serif; background: #F3F8FC; color: #071A3A; padding: 2rem; max-width: 800px; margin: auto; }',
    '    .card { background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 4px 12px rgba(7,26,58,0.06); }',
    '    h1 { color: #087F83; margin-top: 0; }',
    '    .btn { background: #087F83; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; }',
    '    pre { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 1rem; border-radius: 8px; overflow: auto; max-height: 300px; }',
    '  </style>',
    HEAD_CLOSE_TAG,
    '<body>',
    '  <div id="root"></div>',
    '  <div class="card">',
    '    <h1>Our Life Planner - Downloaded Offline Edition</h1>',
    '    <p>This is your independent offline planner bundle. Your records are preserved below and will continue to persist in this browser\'s local storage.</p>',
    `    <p><strong>Owner:</strong> ${safeOwnerName}</p>`,
    `    <p><strong>Export Date:</strong> ${safeExportedAt}</p>`,
    `    <p><strong>Total Records:</strong> ${tasksCount} tasks, ${routinesCount} routines, ${billsCount} bills, ${recipesCount} recipes.</p>`,
    '    <button class="btn" id="download-json-btn" type="button">Export JSON Backup</button>',
    '    <h3>Embedded Planner Payload</h3>',
    '    <pre id="data-preview"></pre>',
    '  </div>',
    `  ${SCRIPT_OPEN_PREFIX}>`,
    '    (function() {',
    '      var rawEl = document.getElementById("embedded-planner-bootstrap-data");',
    '      var plannerData = rawEl && rawEl.textContent ? JSON.parse(rawEl.textContent) : null;',
    '      var previewEl = document.getElementById("data-preview");',
    '      if (previewEl && plannerData) {',
    '        previewEl.textContent = JSON.stringify(plannerData, null, 2);',
    '      }',
    '      var btn = document.getElementById("download-json-btn");',
    '      if (btn && plannerData) {',
    '        btn.addEventListener("click", function() {',
    '          var blob = new Blob([JSON.stringify(plannerData, null, 2)], { type: "application/json" });',
    '          var url = URL.createObjectURL(blob);',
    '          var a = document.createElement("a");',
    '          a.href = url;',
    '          a.download = "our-life-planner-backup.json";',
    '          a.click();',
    '          setTimeout(function() { URL.revokeObjectURL(url); }, 200);',
    '        });',
    '      }',
    '    })();',
    `  ${SCRIPT_CLOSE_TAG}`,
    '</body>',
    '</html>',
  ].join('\n');
}
