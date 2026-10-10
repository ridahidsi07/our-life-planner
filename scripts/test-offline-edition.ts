import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  safeSerializeJsonForScript,
  injectBootstrapDataIntoHtml,
  buildStandaloneFallbackHtml,
} from '../src/utils/standaloneHtml';
import { validateBackupData } from '../src/utils/backupValidator';
import {
  INITIAL_SETTINGS,
  SAMPLE_BILLS,
  SAMPLE_BRAIN_DUMP,
  SAMPLE_CALENDAR_EVENTS,
  SAMPLE_DEBTS,
  SAMPLE_GOALS,
  SAMPLE_GROCERIES,
  SAMPLE_HABITS,
  SAMPLE_HYDRATION_LOG,
  SAMPLE_HYDRATION_TARGETS,
  SAMPLE_PLANNED_MEALS,
  SAMPLE_RECIPES,
  SAMPLE_ROUTINES,
  SAMPLE_SAVINGS_POTS,
  SAMPLE_TASKS,
  SAMPLE_TRANSACTIONS,
  SAMPLE_WEIGHT_PROFILES,
  SAMPLE_WEIGHT_RECORDS,
  SAMPLE_WORKOUTS,
} from '../src/utils/sampleData';
import { PlannerBackupData } from '../src/types/planner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const publicDir = path.resolve(rootDir, 'public');

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

function createAdversarialBackup(): PlannerBackupData {
  const backup: PlannerBackupData = JSON.parse(
    JSON.stringify({
      version: '1.0.0',
      exportedAt: '2026-10-10T15:00:00.000Z',
      revision: 12,
      settings: {
        ...INITIAL_SETTINGS,
        edition: 'downloaded',
        ownerName: 'Rida </script><script>window.__xss=1</script> $$typeof $& $\' $`',
      },
      tasks: [
        ...SAMPLE_TASKS,
        {
          id: 't-adversarial-1',
          title: 'Test closing tag </script><script>alert("broken")</script> and </SCRIPT >',
          description: 'Replacement tokens: $$typeof, $$$$, $&, $`, $\', $1 and HTML <!-- comment --> \u2028 \u2029',
          category: 'Personal',
          assignedTo: 'Rida',
          dueDate: '2026-10-10',
          priority: 'high',
          status: 'not_started',
          createdAt: '2026-10-10T10:00:00Z',
        },
      ],
      routines: SAMPLE_ROUTINES,
      goals: SAMPLE_GOALS,
      habits: SAMPLE_HABITS,
      inbox: [
        ...SAMPLE_BRAIN_DUMP,
        {
          id: 'bd-adversarial',
          text: 'Check </script> & <img src=x onerror=alert(1)> and $$typeof in brain dump',
          createdAt: '2026-10-10T11:00:00Z',
        },
      ],
      transactions: SAMPLE_TRANSACTIONS,
      bills: SAMPLE_BILLS,
      savingsPots: SAMPLE_SAVINGS_POTS,
      debts: SAMPLE_DEBTS,
      recipes: SAMPLE_RECIPES,
      plannedMeals: SAMPLE_PLANNED_MEALS,
      groceries: SAMPLE_GROCERIES,
      workouts: SAMPLE_WORKOUTS,
      weightProfiles: SAMPLE_WEIGHT_PROFILES,
      weightRecords: SAMPLE_WEIGHT_RECORDS,
      hydrationEntries: SAMPLE_HYDRATION_LOG,
      hydrationTargets: SAMPLE_HYDRATION_TARGETS,
      calendarEvents: SAMPLE_CALENDAR_EVENTS,
    })
  );
  return backup;
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

console.log('=== Standalone Offline Edition & Safe Export Verification Tests ===\n');

// 1. Verify Built Artifacts in dist/ and public/
console.log('1. Built Artifact Integrity (dist/Our-Life-Planner-Offline.html)');
{
  const distOfflinePath = path.resolve(distDir, 'Our-Life-Planner-Offline.html');
  const publicOfflinePath = path.resolve(publicDir, 'Our-Life-Planner-Offline.html');
  assert(fs.existsSync(distOfflinePath), 'dist/Our-Life-Planner-Offline.html exists');
  assert(fs.existsSync(publicOfflinePath), 'public/Our-Life-Planner-Offline.html exists');

  const offlineHtml = fs.readFileSync(distOfflinePath, 'utf-8');
  const publicHtml = fs.readFileSync(publicOfflinePath, 'utf-8');
  assert(offlineHtml === publicHtml, 'dist and public offline HTML bundles are identical');

  const assetsDir = path.resolve(distDir, 'assets');
  const jsFile = fs.readdirSync(assetsDir).find((f) => f.endsWith('.js'))!;
  const cssFile = fs.readdirSync(assetsDir).find((f) => f.endsWith('.css'))!;
  const rawJs = fs.readFileSync(path.resolve(assetsDir, jsFile), 'utf-8');
  const rawCss = fs.readFileSync(path.resolve(assetsDir, cssFile), 'utf-8');

  const jsTypeofCount = (rawJs.match(/\$\$typeof/g) || []).length;
  const htmlTypeofCount = (offlineHtml.match(/\$\$typeof/g) || []).length;

  assert(jsTypeofCount > 0, `Raw JS bundle contains React $$typeof (${jsTypeofCount} occurrences)`);
  assert(
    htmlTypeofCount === jsTypeofCount,
    `Offline HTML preserves all ${jsTypeofCount} occurrences of $$typeof (found ${htmlTypeofCount})`
  );

  // Verify the entire JS and CSS bundles are preserved verbatim
  const expectedSafeJs = rawJs.replace(/<\/(script)/gi, '<\\/$1');
  assert(
    offlineHtml.includes(expectedSafeJs),
    'Offline HTML preserves the entire JS bundle verbatim (with safe <\\/script escaping)'
  );
  assert(
    offlineHtml.includes(rawCss),
    'Offline HTML preserves the entire CSS stylesheet verbatim'
  );

  // Check </script> closing tag count across the entire HTML document
  // There must be exactly 4 </script> tags (theme init, standalone-edition flag, bootstrap json, inline module bundle)
  const closeScriptTags = (offlineHtml.match(/<\/script>/gi) || []).length;
  assert(
    closeScriptTags === 4,
    `Offline HTML has exactly 4 </script> closing tags (no premature script termination; got ${closeScriptTags})`
  );

  // Extract inline module script and verify syntax & zero unescaped </script
  const moduleMatch = offlineHtml.match(/<script type="module">\n([\s\S]*?)\n<\/script>/);
  assert(moduleMatch !== null, 'Extracted inline <script type="module"> block cleanly');
  if (moduleMatch) {
    assert(
      !/<\/script/i.test(moduleMatch[1]),
      'Inline <script type="module"> content contains zero unescaped </script sequences'
    );
    let syntaxValid = false;
    try {
      // vm.Script checks JS syntax (bundle is a single self-contained IIFE/bundle without top-level import/export)
      new vm.Script(moduleMatch[1]);
      syntaxValid = true;
    } catch (e: any) {
      console.error('Syntax check error:', e?.message);
    }
    assert(syntaxValid, 'Embedded JavaScript bundle parses with 100% valid JS syntax');
  }

  // Verify <div id="root"></div> appears before <script type="module">
  const rootIdx = offlineHtml.indexOf('<div id="root"></div>');
  const moduleScriptIdx = offlineHtml.indexOf('<script type="module">');
  assert(
    rootIdx !== -1 && moduleScriptIdx !== -1 && rootIdx < moduleScriptIdx,
    '<div id="root"></div> is positioned before inline <script type="module">'
  );
}

// 2. Verify safeSerializeJsonForScript with special characters and </script>
console.log('\n2. Safe JSON Serialization for <script> Elements');
{
  const adversarial = createAdversarialBackup();
  const safeJson = safeSerializeJsonForScript(adversarial);

  assert(!safeJson.includes('<'), 'safeSerializeJsonForScript escapes all "<" characters');
  assert(!safeJson.includes('>'), 'safeSerializeJsonForScript escapes all ">" characters');
  assert(!safeJson.includes('&'), 'safeSerializeJsonForScript escapes all "&" characters');
  assert(!/<\s*\/?\s*script/i.test(safeJson), 'safeSerializeJsonForScript contains no <script or </script');
  assert(!safeJson.includes('\u2028') && !safeJson.includes('\u2029'), 'Escapes U+2028 and U+2029 line/paragraph separators');

  const roundTripped = JSON.parse(safeJson) as PlannerBackupData;
  assert(
    roundTripped.settings.ownerName === adversarial.settings.ownerName,
    'Round-trip JSON.parse restores exact ownerName including </script> and $$typeof $& $\' $`'
  );
  const advTask = roundTripped.tasks.find((t) => t.id === 't-adversarial-1')!;
  assert(
    advTask.title === 'Test closing tag </script><script>alert("broken")</script> and </SCRIPT >',
    'Round-trip JSON.parse restores exact task title with script-closing tags'
  );
  assert(
    advTask.description === 'Replacement tokens: $$typeof, $$$$, $&, $`, $\', $1 and HTML <!-- comment --> \u2028 \u2029',
    'Round-trip JSON.parse restores exact task description with $-replacement tokens and Unicode separators'
  );
}

// 3. Verify Personalized Export Injection (injectBootstrapDataIntoHtml)
console.log('\n3. Personalized Export Injection into Standalone Template');
{
  const templateHtml = fs.readFileSync(path.resolve(distDir, 'Our-Life-Planner-Offline.html'), 'utf-8');
  const adversarial = createAdversarialBackup();

  const personalizedHtml = injectBootstrapDataIntoHtml(templateHtml, adversarial);

  const closeScripts = (personalizedHtml.match(/<\/script>/gi) || []).length;
  assert(
    closeScripts === 4,
    `Personalized HTML maintains exactly 4 </script> closing tags even with </script> in user data (got ${closeScripts})`
  );

  // Extract the embedded JSON from <script id="embedded-planner-bootstrap-data" type="application/json">
  const match = personalizedHtml.match(
    /<script\b[^>]*id=["']embedded-planner-bootstrap-data["'][^>]*>([\s\S]*?)<\/script>/i
  );
  assert(match !== null && match[1].trim().length > 0, 'Extracted embedded bootstrap JSON from personalized HTML');

  const parsedEmbedded = JSON.parse(match![1].trim());
  const validation = validateBackupData(parsedEmbedded);
  assert(validation.isValid, 'Extracted embedded bootstrap data passes full backup schema validation', validation.errors.join('; '));
  assert(
    parsedEmbedded.settings.ownerName === adversarial.settings.ownerName,
    'Personalized HTML preserves exact ownerName without $-replacement corruption'
  );
  const embeddedTask = parsedEmbedded.tasks.find((t: any) => t.id === 't-adversarial-1');
  assert(
    embeddedTask &&
      embeddedTask.description ===
        'Replacement tokens: $$typeof, $$$$, $&, $`, $\', $1 and HTML <!-- comment --> \u2028 \u2029',
    'Personalized HTML preserves $$typeof, $$$$, $&, $`, $\' in user records without corruption'
  );

  // Re-injecting into an already-personalized HTML file (simulating downloading again from offline edition)
  adversarial.settings.ownerName = 'Second Export </script> $$typeof';
  const reExportedHtml = injectBootstrapDataIntoHtml(personalizedHtml, adversarial);
  const reMatch = reExportedHtml.match(
    /<script\b[^>]*id=["']embedded-planner-bootstrap-data["'][^>]*>([\s\S]*?)<\/script>/i
  );
  assert(
    reMatch !== null && JSON.parse(reMatch[1].trim()).settings.ownerName === 'Second Export </script> $$typeof',
    'Re-exporting from an already-populated offline HTML bundle cleanly replaces bootstrap data'
  );
}

// 4. Verify Fallback Standalone HTML Generator (buildStandaloneFallbackHtml)
console.log('\n4. Fallback Standalone HTML Generator');
{
  const adversarial = createAdversarialBackup();
  const fallbackHtml = buildStandaloneFallbackHtml(adversarial);

  const openScripts = (fallbackHtml.match(/<script\b/gi) || []).length;
  const closeScripts = (fallbackHtml.match(/<\/script>/gi) || []).length;
  assert(
    openScripts === 2 && closeScripts === 2,
    `Fallback HTML has balanced <script> tags (${openScripts}/${closeScripts}) with adversarial data`
  );
  assert(
    !fallbackHtml.includes('<script>window.__xss=1</script>'),
    'Fallback HTML escapes HTML in ownerName and prevents script injection'
  );
}

// 5. Real Headless Browser DOM Execution Check
console.log('\n5. Headless Browser Execution Verification on Generated Artifacts');
{
  const browserExe = findBrowserExecutable();
  if (browserExe) {
    const distOfflinePath = path.resolve(distDir, 'Our-Life-Planner-Offline.html');
    const fileUrl = pathToFileURL(distOfflinePath).href;
    try {
      const dumpedDom = execFileSync(
        browserExe,
        ['--headless', '--disable-gpu', '--dump-dom', fileUrl],
        { encoding: 'utf-8', maxBuffer: 25 * 1024 * 1024, timeout: 20000 }
      );
      const bodyWithoutScripts = dumpedDom
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

      // Verify React mounted into <div id="root"> and rendered the Planner UI
      const rootRendered =
        bodyWithoutScripts.includes('<div id="root"><div') &&
        !bodyWithoutScripts.includes('<div id="root"></div>') &&
        bodyWithoutScripts.includes('Our Life Planner') &&
        bodyWithoutScripts.includes('Today');
      assert(rootRendered, 'Headless browser mounted React app into #root and rendered Today dashboard');

      // Ensure raw JS bundle text is NOT leaked into visible body text outside <script>
      assert(
        !bodyWithoutScripts.includes('$$typeof') && !bodyWithoutScripts.includes('createRoot'),
        'No raw JavaScript code is leaked into visible page DOM outside <script> tags'
      );

      // Now test a personalized export containing </script><script> and $$typeof in a real browser
      const templateHtml = fs.readFileSync(distOfflinePath, 'utf-8');
      const adversarial = createAdversarialBackup();
      const personalizedHtml = injectBootstrapDataIntoHtml(templateHtml, adversarial);
      const tempPersonalizedPath = path.resolve(distDir, 'test-personalized-offline.html');
      fs.writeFileSync(tempPersonalizedPath, personalizedHtml, 'utf-8');

      try {
        const personalizedUrl = pathToFileURL(tempPersonalizedPath).href;
        const personalizedDom = execFileSync(
          browserExe,
          ['--headless', '--disable-gpu', '--dump-dom', personalizedUrl],
          { encoding: 'utf-8', maxBuffer: 25 * 1024 * 1024, timeout: 20000 }
        );
        const personalizedBody = personalizedDom
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

        assert(
          personalizedBody.includes('<div id="root"><div') &&
            personalizedBody.includes('Our Life Planner'),
          'Headless browser mounted personalized offline HTML with </script> and $$typeof in user data'
        );
        assert(
          !personalizedBody.includes('window.__xss=1'),
          'Adversarial </script><script>window.__xss=1</script> did not break out of bootstrap script tag'
        );
      } finally {
        if (fs.existsSync(tempPersonalizedPath)) {
          fs.unlinkSync(tempPersonalizedPath);
        }
      }
    } catch (e: any) {
      assert(false, `Headless browser execution failed: ${e?.message}`);
    }
  } else {
    console.log('  SKIP: No local Chrome/Edge executable found for --dump-dom');
  }
}

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
