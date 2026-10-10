import fs from 'fs';
import path from 'path';
import http from 'http';
import { execFile } from 'child_process';
import {
  MODULE_REGISTRY,
  TOOL_REGISTRY,
  DEFAULT_ENABLED_MODULES,
  migrateEnabledTools,
  migratePinnedTools,
  isModuleOrToolEnabled,
  isToolVisibleInFavorites,
  toggleModuleEnabledInList,
  resolveModuleId,
} from '../src/utils/moduleRegistry';
import {
  INITIAL_SETTINGS,
  SAMPLE_TASKS,
  SAMPLE_ROUTINES,
  SAMPLE_GOALS,
  SAMPLE_HABITS,
  SAMPLE_BRAIN_DUMP,
  SAMPLE_TRANSACTIONS,
  SAMPLE_BILLS,
  SAMPLE_SAVINGS_POTS,
  SAMPLE_DEBTS,
  SAMPLE_RECIPES,
  SAMPLE_PLANNED_MEALS,
  SAMPLE_GROCERIES,
  SAMPLE_WORKOUTS,
  SAMPLE_WEIGHT_PROFILES,
  SAMPLE_WEIGHT_RECORDS,
  SAMPLE_HYDRATION_LOG,
  SAMPLE_HYDRATION_TARGETS,
  SAMPLE_CALENDAR_EVENTS,
} from '../src/utils/sampleData';
import { validateBackupData } from '../src/utils/backupValidator';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function findBrowserExecutable(): string | null {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

interface BrowserModuleVisibilityReport {
  initialSettingsStatusByModule: Record<string, string>;
  initialSidebarNavIds: string[];
  initialSidebarFavoriteIds: string[];
  afterHideSettingsStatusByModule: Record<string, string>;
  afterHideSidebarNavIds: string[];
  afterHideSidebarFavoriteIds: string[];
  moreSheetHeaderSubtitle: string | null;
  moreSheetToolIds: string[];
  moreSheetFavoriteIds: string[];
  migratedStoredEnabledTools: string[];
  error?: string;
}

async function runBrowserVisibilityTest(): Promise<BrowserModuleVisibilityReport> {
  const browserExe = findBrowserExecutable();
  if (!browserExe) {
    throw new Error('No headless browser (Edge or Chrome) found on system.');
  }

  const standalonePath = path.resolve(process.cwd(), 'dist', 'Our-Life-Planner-Offline.html');
  if (!fs.existsSync(standalonePath)) {
    throw new Error(`Offline bundle not found at ${standalonePath}. Run npm run build first.`);
  }

  const rawHtml = fs.readFileSync(standalonePath, 'utf-8');

  const testHarnessScript = `
<script type="module">
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function runTest() {
    const phase = new URLSearchParams(window.location.search).get('phase') || '1';

    if (phase === '1') {
      // Seed localStorage with legacy individual tool identifiers ('budget', 'meals', 'workouts', etc.)
      // to verify automatic migration + alignment between Settings, Sidebar, Favorites, and Mobile MoreSheet
      localStorage.clear();
      const legacySettings = {
        ownerName: 'Rida',
        email: 'rida@example.com',
        edition: 'online',
        weekStartsOn: 'Monday',
        timeZone: 'Europe/London',
        currency: 'USD',
        currencySymbol: '$',
        weightUnit: 'kg',
        heightUnit: 'cm',
        waterUnit: 'ml',
        theme: 'light',
        isSampleDataActive: true,
        hasCompletedSetup: true,
        enabledTools: [
          'today',
          'calendar',
          'tasks',
          'routines',
          'inbox',
          'goals',
          'habits',
          'budget',
          'savings',
          'debts',
          'meals',
          'groceries',
          'workouts',
          'weight',
          'water',
        ],
        pinnedTools: ['today', 'tasks', 'routines', 'calendar'],
      };
      localStorage.setItem('our_life_planner_settings_v1', JSON.stringify(legacySettings));
      window.location.replace('/?phase=2');
      return;
    }

    const report = {
      initialSettingsStatusByModule: {},
      initialSidebarNavIds: [],
      initialSidebarFavoriteIds: [],
      afterHideSettingsStatusByModule: {},
      afterHideSidebarNavIds: [],
      afterHideSidebarFavoriteIds: [],
      moreSheetHeaderSubtitle: null,
      moreSheetToolIds: [],
      moreSheetFavoriteIds: [],
      migratedStoredEnabledTools: [],
    };

    try {
      for (let i = 0; i < 40; i++) {
        if (document.querySelector('[data-testid="sidebar-nav-today"]')) break;
        await wait(100);
      }

      // Open Settings view
      const settingsBtn = Array.from(document.querySelectorAll('aside button')).find(
        (b) => b.textContent && b.textContent.trim() === 'Settings'
      );
      if (!settingsBtn) throw new Error('Settings button in sidebar not found');
      settingsBtn.click();
      await wait(120);

      // Record initial module toggle labels in Settings and Sidebar items
      const moduleIds = ['today', 'tasks', 'calendar', 'routines', 'habits', 'goals', 'inbox', 'money', 'food', 'body'];
      for (const id of moduleIds) {
        const toggleBtn = document.querySelector('[data-testid="module-toggle-' + id + '"]');
        report.initialSettingsStatusByModule[id] = toggleBtn ? toggleBtn.textContent.trim() : 'MISSING';
      }

      report.initialSidebarNavIds = Array.from(
        document.querySelectorAll('[data-testid^="sidebar-nav-"]')
      ).map((el) => el.getAttribute('data-testid').replace('sidebar-nav-', ''));

      report.initialSidebarFavoriteIds = Array.from(
        document.querySelectorAll('[data-testid^="sidebar-favorite-"]')
      ).map((el) => el.getAttribute('data-testid').replace('sidebar-favorite-', ''));

      // Now hide 'money', 'food', and 'tasks' (where 'tasks' is also in pinnedTools!)
      for (const idToHide of ['money', 'food', 'tasks']) {
        const btn = document.querySelector('[data-testid="module-toggle-' + idToHide + '"]');
        if (!btn) throw new Error('Toggle button not found for ' + idToHide);
        btn.click();
        await wait(80);
      }

      await wait(120);

      for (const id of moduleIds) {
        const toggleBtn = document.querySelector('[data-testid="module-toggle-' + id + '"]');
        report.afterHideSettingsStatusByModule[id] = toggleBtn ? toggleBtn.textContent.trim() : 'MISSING';
      }

      report.afterHideSidebarNavIds = Array.from(
        document.querySelectorAll('[data-testid^="sidebar-nav-"]')
      ).map((el) => el.getAttribute('data-testid').replace('sidebar-nav-', ''));

      report.afterHideSidebarFavoriteIds = Array.from(
        document.querySelectorAll('[data-testid^="sidebar-favorite-"]')
      ).map((el) => el.getAttribute('data-testid').replace('sidebar-favorite-', ''));

      // Open Mobile More menu (MoreSheet) via the More button in MobileNav or Header menu button
      const moreBtn = document.querySelector('button[aria-controls="all-tools-menu"]');
      if (!moreBtn) throw new Error('Mobile More menu button not found');
      moreBtn.click();
      await wait(150);

      const moreSheet = document.getElementById('all-tools-menu');
      if (!moreSheet) throw new Error('#all-tools-menu did not open');

      const subtitleEl = moreSheet.querySelector('p');
      report.moreSheetHeaderSubtitle = subtitleEl ? subtitleEl.textContent.trim() : null;

      report.moreSheetToolIds = Array.from(
        moreSheet.querySelectorAll('[data-testid^="moresheet-tool-"]')
      ).map((el) => el.getAttribute('data-testid').replace('moresheet-tool-', ''));

      report.moreSheetFavoriteIds = Array.from(
        moreSheet.querySelectorAll('[data-testid^="moresheet-favorite-"]')
      ).map((el) => el.getAttribute('data-testid').replace('moresheet-favorite-', ''));

      const storedSettingsRaw = localStorage.getItem('our_life_planner_settings_v1');
      if (storedSettingsRaw) {
        const parsed = JSON.parse(storedSettingsRaw);
        report.migratedStoredEnabledTools = parsed.enabledTools || [];
      }
    } catch (err) {
      report.error = err && err.message ? err.message : String(err);
    }

    await fetch('/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
  }

  setTimeout(runTest, 200);
</script>
<img src="/hold-until-complete.gif" style="display:none" />
`;

  const strippedHtml = rawHtml.replace(/<meta[^>]+Content-Security-Policy[^>]*>/gi, '');
  const lastBodyIdx = strippedHtml.lastIndexOf('</body>');
  const instrumentedHtml =
    strippedHtml.slice(0, lastBodyIdx) +
    testHarnessScript +
    '\n</body>' +
    strippedHtml.slice(lastBodyIdx + '</body>'.length);

  return new Promise<BrowserModuleVisibilityReport>((resolve, reject) => {
    let holdResponses: http.ServerResponse[] = [];
    let resolved = false;

    const server = http.createServer((req, res) => {
      if (req.url === '/' || req.url?.startsWith('/?')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(instrumentedHtml);
        return;
      }
      if (req.url === '/hold-until-complete.gif') {
        holdResponses.push(res);
        return;
      }
      if (req.url === '/report' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
          for (const hr of holdResponses) {
            try {
              hr.writeHead(204);
              hr.end();
            } catch {
              // ignore
            }
          }
          holdResponses = [];
          if (!resolved) {
            resolved = true;
            try {
              const parsed = JSON.parse(body) as BrowserModuleVisibilityReport;
              server.close();
              resolve(parsed);
            } catch (e) {
              server.close();
              reject(e);
            }
          }
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('Could not bind local server'));
        return;
      }
      const url = `http://127.0.0.1:${addr.port}/?phase=1`;
      const userDataDir = path.resolve(
        process.cwd(),
        'dist',
        `.tmp-edge-module-vis-${Date.now()}`
      );

      const child = execFile(
        browserExe,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          `--user-data-dir=${userDataDir}`,
          '--virtual-time-budget=20000',
          '--dump-dom',
          url,
        ],
        { timeout: 25000, maxBuffer: 10 * 1024 * 1024 },
        (err) => {
          setTimeout(() => {
            try {
              fs.rmSync(userDataDir, { recursive: true, force: true });
            } catch {
              // ignore
            }
          }, 500);
          if (!resolved) {
            resolved = true;
            server.close();
            reject(err || new Error('Browser exited before posting /report'));
          }
        }
      );

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            child.kill();
          } catch {
            // ignore
          }
          server.close();
          reject(new Error('Timed out waiting for browser module visibility report'));
        }
      }, 23000);
    });
  });
}

async function main() {
  console.log('=== P2 Module Visibility & Navigation Alignment Verification Suite ===\n');

  // 1. Unified Module Registry & Default Settings Alignment
  console.log('1. Testing Unified Module Registry & Default Settings...');
  assert(MODULE_REGISTRY.length === 10, 'MODULE_REGISTRY defines all 10 canonical modules');
  assert(TOOL_REGISTRY.length === 15, 'TOOL_REGISTRY defines all 15 individual tool views');
  assert(
    JSON.stringify(INITIAL_SETTINGS.enabledTools) === JSON.stringify(DEFAULT_ENABLED_MODULES),
    'INITIAL_SETTINGS.enabledTools uses canonical module identifiers matching MODULE_REGISTRY'
  );
  assert(
    TOOL_REGISTRY.every((t) => MODULE_REGISTRY.some((m) => m.id === t.moduleId)),
    'Every tool in TOOL_REGISTRY maps to a valid canonical module in MODULE_REGISTRY'
  );

  // 2. Legacy Identifier Migration & Visibility Rules
  console.log('\n2. Testing Legacy Identifier Migration & Visibility Rules...');
  const legacySavedTools = [
    'today',
    'calendar',
    'tasks',
    'routines',
    'inbox',
    'goals',
    'habits',
    'budget',
    'savings',
    'debts',
    'meals',
    'groceries',
    'workouts',
    'weight',
    'water',
  ];
  const migrated = migrateEnabledTools(legacySavedTools);
  assert(
    migrated.includes('money') &&
      migrated.includes('food') &&
      migrated.includes('body') &&
      !migrated.includes('budget' as any) &&
      !migrated.includes('meals' as any) &&
      !migrated.includes('workouts' as any),
    'migrateEnabledTools converts legacy tool IDs (budget, meals, workouts, etc.) to canonical module IDs (money, food, body)'
  );
  assert(
    isModuleOrToolEnabled('money', legacySavedTools) &&
      isModuleOrToolEnabled('food', legacySavedTools) &&
      isModuleOrToolEnabled('body', legacySavedTools),
    'Money, Meals, and Health groups evaluate as Enabled when legacy tool IDs are present'
  );

  const afterDisablingMoney = toggleModuleEnabledInList(legacySavedTools, 'money');
  assert(
    !isModuleOrToolEnabled('money', afterDisablingMoney) &&
      !isModuleOrToolEnabled('budget', afterDisablingMoney) &&
      !isModuleOrToolEnabled('savings', afterDisablingMoney) &&
      !isModuleOrToolEnabled('debts', afterDisablingMoney),
    'Disabling "money" hides budget, savings, and debts even when starting from legacy tool IDs'
  );

  // 3. Favorites Visibility Filter
  console.log('\n3. Testing Favorites Visibility Filter...');
  const pinned = migratePinnedTools(['today', 'tasks', 'budget']);
  assert(
    pinned.includes('today') && pinned.includes('tasks') && pinned.includes('money'),
    'migratePinnedTools normalizes pinned tool IDs to canonical module IDs'
  );
  assert(
    isToolVisibleInFavorites('tasks', ['today', 'tasks'], ['today', 'tasks']) === true,
    'Pinned tool is visible in Favorites when its module is enabled'
  );
  assert(
    isToolVisibleInFavorites('tasks', ['today', 'tasks'], ['today']) === false,
    'Pinned tool is NOT visible in Favorites when its module is hidden (Favorites do not bypass visibility filter)'
  );
  assert(
    isToolVisibleInFavorites('budget', ['money'], ['today']) === false,
    'Pinned group module tools are NOT visible in Favorites when the group module is hidden'
  );

  // 4. Backup Validation Migration
  console.log('\n4. Testing Backup Validator Identifier Migration...');
  const legacyBackup = {
    version: '1.0.0',
    exportedAt: '2026-10-05T12:00:00.000Z',
    settings: {
      ...INITIAL_SETTINGS,
      enabledTools: legacySavedTools,
      pinnedTools: ['today', 'budget'],
    },
    tasks: SAMPLE_TASKS,
    routines: SAMPLE_ROUTINES,
    goals: SAMPLE_GOALS,
    habits: SAMPLE_HABITS,
    inbox: SAMPLE_BRAIN_DUMP,
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
  };
  const validated = validateBackupData(legacyBackup);
  assert(
    validated.isValid &&
      Boolean(validated.data?.settings.enabledTools?.includes('money')) &&
      !validated.data?.settings.enabledTools?.includes('budget'),
    'validateBackupData migrates legacy enabledTools to canonical module IDs'
  );
  assert(
    Boolean(validated.data?.settings.pinnedTools?.includes('money')),
    'validateBackupData migrates legacy pinnedTools to canonical module IDs'
  );
  void resolveModuleId;

  // 5. End-to-End Headless Browser Verification
  console.log('\n5. Running End-to-End Headless Browser Verification (Settings, Sidebar, Favorites & Mobile MoreSheet)...');
  const browserReport = await runBrowserVisibilityTest();

  if (browserReport.error) {
    console.error('Browser test error:', browserReport.error);
  }

  assert(!browserReport.error, 'Headless browser test completed without runtime errors');
  assert(
    browserReport.initialSettingsStatusByModule['money'] === 'Enabled' &&
      browserReport.initialSettingsStatusByModule['food'] === 'Enabled' &&
      browserReport.initialSettingsStatusByModule['body'] === 'Enabled',
    `Money, Meals, and Health groups show "Enabled" in Settings after migrating legacy saved identifiers (money=${browserReport.initialSettingsStatusByModule['money']}, food=${browserReport.initialSettingsStatusByModule['food']}, body=${browserReport.initialSettingsStatusByModule['body']})`
  );
  assert(
    browserReport.initialSidebarNavIds.length === 15,
    `All 15 tools are initially visible in Sidebar when all 10 modules are enabled (got ${browserReport.initialSidebarNavIds.length})`
  );
  assert(
    browserReport.afterHideSettingsStatusByModule['money'] === 'Hidden' &&
      browserReport.afterHideSettingsStatusByModule['food'] === 'Hidden' &&
      browserReport.afterHideSettingsStatusByModule['tasks'] === 'Hidden',
    'Toggling money, food, and tasks in Settings updates their status to "Hidden"'
  );
  assert(
    !browserReport.afterHideSidebarNavIds.includes('budget') &&
      !browserReport.afterHideSidebarNavIds.includes('savings') &&
      !browserReport.afterHideSidebarNavIds.includes('debts') &&
      !browserReport.afterHideSidebarNavIds.includes('meals') &&
      !browserReport.afterHideSidebarNavIds.includes('groceries') &&
      !browserReport.afterHideSidebarNavIds.includes('tasks') &&
      browserReport.afterHideSidebarNavIds.length === 9,
    `Hiding money, food, and tasks removes all 6 corresponding tools from the Sidebar (remaining=${browserReport.afterHideSidebarNavIds.length})`
  );
  assert(
    browserReport.initialSidebarFavoriteIds.includes('tasks') &&
      !browserReport.afterHideSidebarFavoriteIds.includes('tasks') &&
      browserReport.afterHideSidebarFavoriteIds.length === 3,
    'Hiding a pinned module ("tasks") removes it from Sidebar Favorites so Favorites never bypass visibility rules'
  );
  assert(
    !browserReport.moreSheetToolIds.includes('budget') &&
      !browserReport.moreSheetToolIds.includes('savings') &&
      !browserReport.moreSheetToolIds.includes('debts') &&
      !browserReport.moreSheetToolIds.includes('meals') &&
      !browserReport.moreSheetToolIds.includes('groceries') &&
      !browserReport.moreSheetToolIds.includes('tasks') &&
      browserReport.moreSheetToolIds.length === 9,
    `Mobile More menu (MoreSheet) applies module visibility settings and hides disabled tools (remaining=${browserReport.moreSheetToolIds.length})`
  );
  assert(
    !browserReport.moreSheetFavoriteIds.includes('tasks') &&
      browserReport.moreSheetFavoriteIds.length === 3,
    'Mobile More menu Favorites section also enforces module visibility rules'
  );
  assert(
    browserReport.moreSheetHeaderSubtitle === '9 enabled tools in one place',
    `Mobile More menu header subtitle accurately reflects enabled tool count ("${browserReport.moreSheetHeaderSubtitle}")`
  );

  console.log(`\n========================================`);
  console.log(`Module Visibility Verification: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error in test-module-visibility:', err);
  process.exit(1);
});
