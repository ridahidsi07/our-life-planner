import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import {
  APP_NAME,
  APP_VERSION,
  APP_RELEASE_NAME,
  SUPPORT_EMAIL,
  SUPPORT_HOURS,
  OFFLINE_FILE_NAME,
  DELIVERY_ZIP_NAME,
  GETTING_STARTED_PDF_NAME,
} from '../src/utils/releaseInfo';
import {
  injectBootstrapDataIntoHtml,
  safeSerializeJsonForScript,
} from '../src/utils/standaloneHtml';
import { PlannerBackupData } from '../src/types/planner';

let failedChecks = 0;
let passedChecks = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedChecks++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedChecks++;
  }
}

console.log('=== PHASE 4 DELIVERY & RELEASE INTEGRITY VERIFICATION ===\n');

// 1. External Network Dependency Check (LP-17)
console.log('1. External Network Dependencies (LP-17):');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const offlineHtml = fs.readFileSync(path.join('dist', OFFLINE_FILE_NAME), 'utf8');

assert(!indexHtml.includes('fonts.googleapis.com'), 'index.html has no Google Fonts preconnect or stylesheets');
assert(!indexHtml.includes('fonts.gstatic.com'), 'index.html has no Google Fonts gstatic preconnect');
assert(!offlineHtml.includes('fonts.googleapis.com'), `${OFFLINE_FILE_NAME} has no Google Fonts stylesheets`);
assert(!offlineHtml.includes('fonts.gstatic.com'), `${OFFLINE_FILE_NAME} has no Google Fonts gstatic preconnect`);

const offlineExternalLinks = (offlineHtml.match(/<link\b[^>]*href=["']https?:\/\/[^"']+["']/gi) || []);
const offlineExternalScripts = (offlineHtml.match(/<script\b[^>]*src=["']https?:\/\/[^"']+["']/gi) || []);
assert(offlineExternalLinks.length === 0, `${OFFLINE_FILE_NAME} has 0 external <link> stylesheet tags`);
assert(offlineExternalScripts.length === 0, `${OFFLINE_FILE_NAME} has 0 external <script> src tags`);

// 2. Release Identity Synchronization (LP-16)
console.log('\n2. Unified Release Identity (LP-16):');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(packageJson.name === 'our-life-planner', `package.json name matches 'our-life-planner' (was '${packageJson.name}')`);
assert(packageJson.version === APP_VERSION, `package.json version (${packageJson.version}) matches APP_VERSION (${APP_VERSION})`);

const guideModal = fs.readFileSync('src/components/modals/GuideModal.tsx', 'utf8');
assert(guideModal.includes('APP_RELEASE_NAME'), 'GuideModal derives version identity from releaseInfo APP_RELEASE_NAME');
assert(guideModal.includes('SUPPORT_EMAIL'), 'GuideModal derives support email from releaseInfo SUPPORT_EMAIL');
assert(!guideModal.includes('Version 1.2.0'), 'GuideModal has no legacy fabricated version string (Version 1.2.0)');
assert(!guideModal.includes('drag items into time blocks'), 'GuideModal has no unsupported drag statement');

const supportModal = fs.readFileSync('src/components/modals/SupportModal.tsx', 'utf8');
assert(supportModal.includes('APP_VERSION'), 'SupportModal imports APP_VERSION from releaseInfo');

// 3. Printable Guide & Headless PDF Generation
console.log('\n3. Printable Guide & PDF Verification:');
const pdfPath = path.join('artifacts', 'delivery', GETTING_STARTED_PDF_NAME);
assert(fs.existsSync(pdfPath), `${GETTING_STARTED_PDF_NAME} exists in artifacts/delivery`);
const pdfStat = fs.statSync(pdfPath);
assert(pdfStat.size > 50000, `PDF file size is substantial (${(pdfStat.size / 1024).toFixed(1)} KB > 50 KB)`);
const pdfBuf = fs.readFileSync(pdfPath);
assert(pdfBuf.slice(0, 5).toString('ascii') === '%PDF-', 'PDF file contains valid %PDF header');

// 4. Delivery ZIP Package & Etsy Limits (LP-15)
console.log('\n4. Delivery ZIP Package & Etsy Limits (LP-15):');
const zipPath = path.join('dist', DELIVERY_ZIP_NAME);
assert(fs.existsSync(zipPath), `${DELIVERY_ZIP_NAME} exists in dist/`);
const zipStat = fs.statSync(zipPath);
const zipSizeMb = zipStat.size / (1024 * 1024);
assert(zipSizeMb < 20, `Delivery ZIP size (${zipSizeMb.toFixed(2)} MB) is strictly under Etsy's 20 MB limit`);

const expectedPackageFiles = [
  OFFLINE_FILE_NAME,
  GETTING_STARTED_PDF_NAME,
  'README-START-HERE.txt',
  'ETSY-DOWNLOAD-INSTRUCTIONS.md',
  'ONLINE-ACCESS-INSTRUCTIONS.md',
  'BACKUP-AND-UPGRADE-GUIDE.md',
  'COMPATIBILITY-AND-REQUIREMENTS.md',
  'SUPPORT-AND-TERMS.md',
  'LICENSE-AND-NOTICES.txt',
];

for (const fileName of expectedPackageFiles) {
  const fileInPkg = path.join('artifacts', 'delivery', 'package', fileName);
  assert(fs.existsSync(fileInPkg), `Package contains ${fileName}`);
}

// 5. Offline HTML Standalone Launch in Edge Headless
console.log('\n5. Offline HTML Headless Launch:');
try {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const fullOfflinePath = path.resolve('dist', OFFLINE_FILE_NAME);
  const renderedDom = execFileSync(
    edgePath,
    ['--headless=new', '--disable-gpu', '--dump-dom', `file:///${fullOfflinePath.replace(/\\/g, '/')}`],
    { maxBuffer: 15 * 1024 * 1024, encoding: 'utf8' }
  );
  const rootIndex = renderedDom.indexOf('<div id="root">');
  const scriptIndex = renderedDom.indexOf('<script type="module">');
  const rootContent = rootIndex !== -1 && scriptIndex !== -1 ? renderedDom.slice(rootIndex, scriptIndex) : renderedDom;

  assert(renderedDom.includes('id="root"'), 'Standalone bundle loads and contains #root container');
  assert(rootContent.length > 500, `Live rendered UI in #root is substantial (${rootContent.length} bytes)`);
  assert(renderedDom.includes('Our Life Planner'), 'Rendered DOM contains application title/branding');
  assert(!rootContent.includes('Something went wrong'), 'Rendered DOM in #root does not trigger ErrorBoundary error screen');
} catch (err) {
  console.error('Edge headless launch check error:', err);
  assert(false, 'Edge headless successfully launches and parses offline HTML bundle');
}

// 6. Data Persistence, Relocation & Migration Simulation (LP-17)
console.log('\n6. Relocation & Migration Simulation:');
const sampleBackup: PlannerBackupData = {
  version: '1.0.0',
  exportedAt: '2026-10-13T10:00:00.000Z',
  settings: {
    ownerName: 'Test Buyer',
    theme: 'dark',
    timeZone: 'Europe/London',
    weekStartsOn: 'monday',
    currency: 'USD',
    edition: 'downloaded',
    modules: { tasks: true, habits: true, budget: true },
  },
  tasks: [
    {
      id: 'task-test-1',
      title: 'First offline task after relocation',
      category: 'daily',
      priority: 'high',
      status: 'not_started',
      createdAt: '2026-10-13T10:00:00.000Z',
    },
  ],
  habits: [],
  routines: [],
  goals: [],
  bills: [],
  savingsPots: [],
  debts: [],
  recipes: [],
  groceries: [],
  workouts: [],
  weightEntries: [],
  inbox: [],
};

const injectedHtml = injectBootstrapDataIntoHtml(offlineHtml, sampleBackup);
assert(injectedHtml.includes('id="embedded-planner-bootstrap-data"'), 'Bootstrap script tag injected correctly');
assert(injectedHtml.includes('First offline task after relocation'), 'Bootstrap records serialized into standalone bundle');

// Extract bootstrap data back out to verify exact deserialization
const bootstrapMatch = injectedHtml.match(/<script\b[^>]*id="embedded-planner-bootstrap-data"[^>]*>([\s\S]*?)<\/script>/i);
assert(bootstrapMatch !== null, 'Bootstrap script tag is extractable from relocated HTML');
if (bootstrapMatch) {
  const extractedData = JSON.parse(bootstrapMatch[1]);
  assert(extractedData.settings.ownerName === 'Test Buyer', 'Owner name preserved through relocation injection');
  assert(extractedData.tasks[0].title === 'First offline task after relocation', 'Task title preserved through relocation injection');
}

// 7. Actionable Download Failure Feedback in OfflineDownloadModal
console.log('\n7. Actionable Download Failure Handling (OfflineDownloadModal):');
const offlineModalCode = fs.readFileSync('src/components/modals/OfflineDownloadModal.tsx', 'utf8');
assert(offlineModalCode.includes('downloadError'), 'OfflineDownloadModal tracks downloadError state');
assert(offlineModalCode.includes('role="alert"'), 'OfflineDownloadModal renders accessible error alert');
assert(offlineModalCode.includes('Retry download'), 'OfflineDownloadModal provides retry action');
assert(offlineModalCode.includes('Copy backup JSON fallback') || offlineModalCode.includes('Copied JSON to clipboard!'), 'OfflineDownloadModal provides clipboard JSON copy fallback');
assert(offlineModalCode.includes("setActiveModal('backup_restore')"), 'OfflineDownloadModal links to Backup & Restore modal');

console.log(`\n========================================`);
console.log(`Phase 4 Delivery Verification Complete:`);
console.log(`Passed: ${passedChecks}`);
console.log(`Failed: ${failedChecks}`);
console.log(`========================================\n`);

if (failedChecks > 0) {
  process.exit(1);
} else {
  console.log('ALL PHASE 4 CHECKS PASSED SUCCESSFULLY!\n');
}
