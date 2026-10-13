import fs from 'fs';
import path from 'path';
import http from 'http';
import { execFile } from 'child_process';
import {
  aggregateGroceriesFromMeals,
  classifyAndNormalizeUnit,
  normalizeIngredientKey,
} from '../src/utils/groceryAggregator';
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
  SAMPLE_RECIPES,
  SAMPLE_ROUTINES,
  SAMPLE_SAVINGS_POTS,
  SAMPLE_TASKS,
  SAMPLE_TRANSACTIONS,
  SAMPLE_WEIGHT_PROFILES,
  SAMPLE_WEIGHT_RECORDS,
  SAMPLE_WORKOUTS,
} from '../src/utils/sampleData';
import { GroceryItem, PlannedMeal } from '../src/types/planner';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
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

interface BrowserGroceryReport {
  pantryItems: Array<{ name: string; quantityText: string }>;
  storedRiceItems: Array<{ name: string; amount: number; unit: string; sourceMealTitles?: string[] }>;
  error?: string;
}

async function runBrowserGroceryTest(): Promise<BrowserGroceryReport> {
  const browserExe = findBrowserExecutable();
  if (!browserExe) {
    throw new Error('No headless browser (Edge or Chrome) found on system.');
  }

  const standalonePath = path.resolve(process.cwd(), 'dist', 'Our-Life-Planner-Offline.html');
  if (!fs.existsSync(standalonePath)) {
    throw new Error(`Offline bundle not found at ${standalonePath}. Run npm run build first.`);
  }

  const rawHtml = fs.readFileSync(standalonePath, 'utf-8');

  // Seed data with two planned meals in the current week:
  // Meal 1: Rice 200 g (2 servings / 2 base)
  // Meal 2: Rice 1 cup (2 servings / 2 base)
  const now = new Date();
  const day = now.getDay();
  const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
  const monDate = new Date(now.getFullYear(), now.getMonth(), diffToMon);
  const tueDate = new Date(now.getFullYear(), now.getMonth(), diffToMon + 1);
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const seedDay1 = fmt(monDate);
  const seedDay2 = fmt(tueDate);

  const seedMeals: PlannedMeal[] = [
    {
      id: 'pm-repro-1',
      date: seedDay1,
      mealType: 'lunch',
      plannedTime: '12:30',
      recipeTitle: 'Teriyaki Rice Bowl',
      plannedServings: 2,
      baseServings: 2,
      ingredientsSnapshot: [
        { name: 'Rice', amount: 200, unit: 'g' },
        { name: 'Broccoli', amount: 150, unit: 'g' },
      ],
      isConsumed: false,
    },
    {
      id: 'pm-repro-2',
      date: seedDay2,
      mealType: 'dinner',
      plannedTime: '19:00',
      recipeTitle: 'Veggie Pilaf',
      plannedServings: 2,
      baseServings: 2,
      ingredientsSnapshot: [
        { name: 'Rice', amount: 1, unit: 'cup' },
        { name: 'Broccoli', amount: 0.85, unit: 'kg' },
      ],
      isConsumed: false,
    },
  ];

  const seedData = {
    version: '1.0.0' as const,
    exportedAt: '2026-10-05T12:00:00Z',
    settings: { ...INITIAL_SETTINGS, hasCompletedSetup: true },
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
    plannedMeals: seedMeals,
    groceries: SAMPLE_GROCERIES,
    workouts: SAMPLE_WORKOUTS,
    weightProfiles: SAMPLE_WEIGHT_PROFILES,
    weightRecords: SAMPLE_WEIGHT_RECORDS,
    hydrationEntries: SAMPLE_HYDRATION_LOG,
    hydrationTargets: SAMPLE_HYDRATION_TARGETS,
    calendarEvents: SAMPLE_CALENDAR_EVENTS,
  };

  const testHarnessScript = `
<script type="module">
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function runTest() {
    const phase = new URLSearchParams(window.location.search).get('phase') || '1';
    if (phase === '1') {
      localStorage.clear();
      localStorage.setItem('our_life_planner_settings_v1', ${JSON.stringify(
        JSON.stringify({ ...INITIAL_SETTINGS, hasCompletedSetup: true })
      )});
      localStorage.setItem('our_life_planner_data_v1', ${JSON.stringify(
        JSON.stringify(seedData)
      )});
      window.location.replace('/?phase=2');
      return;
    }

    const report = {
      pantryItems: [],
      storedRiceItems: [],
    };

    try {
      await wait(450);

      // Navigate to Groceries view
      const navButtons = Array.from(document.querySelectorAll('aside button'));
      const groBtn = navButtons.find((b) => (b.textContent || '').includes('Groceries'));
      if (!groBtn) throw new Error('Groceries sidebar button not found');
      groBtn.click();
      await wait(300);

      // Click "Regenerate from meals" button
      const regenBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        (b.textContent || '').includes('Regenerate from meals')
      );
      if (!regenBtn) throw new Error('Regenerate from meals button not found');
      regenBtn.click();
      await wait(250);

      // Click "Apply update" inside modal
      const applyBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        (b.textContent || '').includes('Apply update')
      );
      if (!applyBtn) throw new Error('Apply update button not found');
      applyBtn.click();
      await wait(350);

      // Read stored groceries from localStorage
      const rawData = localStorage.getItem('our_life_planner_data_v1');
      if (rawData) {
        const parsed = JSON.parse(rawData);
        const groceries = parsed.groceries || [];
        report.storedRiceItems = groceries
          .filter((g) => g.name.toLowerCase() === 'rice')
          .map((g) => ({
            name: g.name,
            amount: g.amount,
            unit: g.unit,
            sourceMealTitles: g.sourceMealTitles,
          }));
      }

      // Collect rendered grocery rows in Pantry & Produce
      const allGroupRows = Array.from(document.querySelectorAll('.group'));
      report.pantryItems = allGroupRows.map((row) => {
        const nameEl = row.querySelector('span.cursor-pointer');
        const qtyEl = row.querySelector('span.font-mono.font-bold');
        return {
          name: nameEl ? (nameEl.textContent || '').trim() : '',
          quantityText: qtyEl ? (qtyEl.textContent || '').trim() : '',
        };
      });
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

  const strippedHtml = rawHtml
    .replace(/<meta[^>]+Content-Security-Policy[^>]*>/gi, '')
    .replace(/<script id="olp-preloaded-bundle">[\s\S]*?<\/script>/, '');
  const lastBodyIdx = strippedHtml.lastIndexOf('</body>');
  const instrumentedHtml =
    strippedHtml.slice(0, lastBodyIdx) +
    testHarnessScript +
    '\n</body>' +
    strippedHtml.slice(lastBodyIdx + '</body>'.length);

  return new Promise<BrowserGroceryReport>((resolve, reject) => {
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
              const parsed = JSON.parse(body) as BrowserGroceryReport;
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
      const url = `http://127.0.0.1:${addr.port}/`;
      const userDataDir = path.resolve(
        process.cwd(),
        'dist',
        `.tmp-edge-grocery-${Date.now()}`
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
          reject(new Error('Timed out waiting for browser /report'));
        }
      }, 24000);
    });
  });
}

async function runTests() {
  console.log('=== P2 Grocery Unit-Dimension Aggregation Verification ===\n');

  // 1. Exact User Reproduction Case: Rice: 200 g + Rice: 1 cup
  console.log('1. Testing exact reproduction case (Rice: 200 g and Rice: 1 cup)...');
  const reproMeals: PlannedMeal[] = [
    {
      id: 'm1',
      date: '2026-10-05',
      mealType: 'lunch',
      recipeTitle: 'Meal A',
      plannedServings: 2,
      baseServings: 2,
      ingredientsSnapshot: [{ name: 'Rice', amount: 200, unit: 'g' }],
      isConsumed: false,
    },
    {
      id: 'm2',
      date: '2026-10-06',
      mealType: 'dinner',
      recipeTitle: 'Meal B',
      plannedServings: 2,
      baseServings: 2,
      ingredientsSnapshot: [{ name: 'Rice', amount: 1, unit: 'cup' }],
      isConsumed: false,
    },
  ];

  const reproResult = aggregateGroceriesFromMeals({ weekMeals: reproMeals });
  const riceItems = reproResult.filter((g) => normalizeIngredientKey(g.name) === 'rice');

  assert(
    !riceItems.some((g) => g.amount === 201),
    'Does NOT combine Rice: 200 g and Rice: 1 cup into erroneous Rice: 201 g'
  );
  assert(
    riceItems.length === 2,
    `Generates 2 separate Rice entries for incompatible dimensions (got ${riceItems.length})`
  );
  const riceGrams = riceItems.find((g) => g.unit === 'g');
  const riceCups = riceItems.find((g) => g.unit === 'cup');
  assert(
    Boolean(riceGrams && riceGrams.amount === 200 && riceGrams.unit === 'g'),
    'Preserves Rice: 200 g in the metric mass bucket'
  );
  assert(
    Boolean(riceCups && riceCups.amount === 1 && riceCups.unit === 'cup'),
    'Preserves Rice: 1 cup in the cup volume bucket'
  );

  // 2. Compatible Unit Conversions within the Same Dimension
  console.log('\n2. Testing compatible unit conversions (g + kg, ml + L, oz + lb, cup + cups, count + pcs)...');
  const compatibleMeals: PlannedMeal[] = [
    {
      id: 'cm1',
      date: '2026-10-05',
      mealType: 'lunch',
      recipeTitle: 'Dish 1',
      plannedServings: 2,
      baseServings: 2,
      ingredientsSnapshot: [
        { name: 'Rice', amount: 400, unit: 'g' },
        { name: 'Stock', amount: 600, unit: 'ml' },
        { name: 'Chicken', amount: 8, unit: 'oz' },
        { name: 'Oats', amount: 1, unit: 'cup' },
        { name: 'Bell Peppers', amount: 2, unit: 'count' },
        { name: 'Diced Tomatoes', amount: 1, unit: 'can' },
      ],
      isConsumed: false,
    },
    {
      id: 'cm2',
      date: '2026-10-06',
      mealType: 'dinner',
      recipeTitle: 'Dish 2',
      plannedServings: 2,
      baseServings: 2,
      ingredientsSnapshot: [
        { name: '  rice ', amount: 1, unit: 'kg' },
        { name: 'Stock', amount: 1, unit: 'L' },
        { name: 'Chicken', amount: 1, unit: 'lb' },
        { name: 'Oats', amount: 1.5, unit: 'cups' },
        { name: 'bell   peppers', amount: 3, unit: 'pcs' },
        { name: 'Diced Tomatoes', amount: 2, unit: 'cans' },
      ],
      isConsumed: false,
    },
  ];

  const compatResult = aggregateGroceriesFromMeals({ weekMeals: compatibleMeals });
  const findItem = (key: string) =>
    compatResult.find((g) => normalizeIngredientKey(g.name) === key);

  const aggRice = findItem('rice');
  assert(
    Boolean(aggRice && aggRice.amount === 1.4 && aggRice.unit === 'kg'),
    `400 g + 1 kg Rice aggregates to 1.4 kg (got ${aggRice?.amount} ${aggRice?.unit})`
  );

  const aggStock = findItem('stock');
  assert(
    Boolean(aggStock && aggStock.amount === 1.6 && aggStock.unit === 'L'),
    `600 ml + 1 L Stock aggregates to 1.6 L (got ${aggStock?.amount} ${aggStock?.unit})`
  );

  const aggChicken = findItem('chicken');
  assert(
    Boolean(aggChicken && aggChicken.amount === 1.5 && aggChicken.unit === 'lb'),
    `8 oz + 1 lb Chicken aggregates to 1.5 lb (got ${aggChicken?.amount} ${aggChicken?.unit})`
  );

  const aggOats = findItem('oats');
  assert(
    Boolean(aggOats && aggOats.amount === 2.5 && aggOats.unit === 'cups'),
    `1 cup + 1.5 cups Oats aggregates to 2.5 cups (got ${aggOats?.amount} ${aggOats?.unit})`
  );

  const aggPeppers = findItem('bell peppers');
  assert(
    Boolean(aggPeppers && aggPeppers.amount === 5 && aggPeppers.unit === 'count'),
    `2 count + 3 pcs Bell Peppers aggregates to 5 count (got ${aggPeppers?.amount} ${aggPeppers?.unit})`
  );

  const aggTomatoes = findItem('diced tomatoes');
  assert(
    Boolean(aggTomatoes && aggTomatoes.amount === 3 && aggTomatoes.unit === 'can'),
    `1 can + 2 cans Diced Tomatoes aggregates to 3 can (got ${aggTomatoes?.amount} ${aggTomatoes?.unit})`
  );

  // 3. Multi-Dimension Separation & Servings Scaling
  console.log('\n3. Testing multi-dimension separation (ml vs tbsp vs bottle) & servings scaling...');
  const multiDimMeals: PlannedMeal[] = [
    {
      id: 'md1',
      date: '2026-10-05',
      mealType: 'dinner',
      recipeTitle: 'Roasted Veg',
      plannedServings: 4, // 2x scaling
      baseServings: 2,
      ingredientsSnapshot: [
        { name: 'Olive oil', amount: 15, unit: 'ml' },
        { name: 'Garlic', amount: 2, unit: 'cloves' },
      ],
      isConsumed: false,
    },
    {
      id: 'md2',
      date: '2026-10-06',
      mealType: 'dinner',
      recipeTitle: 'Salad Dressing',
      plannedServings: 2,
      baseServings: 2,
      ingredientsSnapshot: [
        { name: 'Olive oil', amount: 2, unit: 'tbsp' },
        { name: 'Olive oil', amount: 1, unit: 'bottle' },
        { name: 'Garlic', amount: 50, unit: 'g' },
      ],
      isConsumed: false,
    },
  ];

  const multiDimResult = aggregateGroceriesFromMeals({ weekMeals: multiDimMeals });
  const oilItems = multiDimResult.filter(
    (g) => normalizeIngredientKey(g.name) === 'olive oil'
  );
  const garlicItems = multiDimResult.filter(
    (g) => normalizeIngredientKey(g.name) === 'garlic'
  );

  assert(
    oilItems.length === 3 &&
      oilItems.some((o) => o.amount === 30 && o.unit === 'ml') &&
      oilItems.some((o) => o.amount === 2 && o.unit === 'tbsp') &&
      oilItems.some((o) => o.amount === 1 && o.unit === 'bottle'),
    'Olive oil in ml (scaled 2x to 30 ml), tbsp (2 tbsp), and bottle (1 bottle) stay separate'
  );
  assert(
    garlicItems.length === 2 &&
      garlicItems.some((g) => g.amount === 4 && g.unit === 'cloves') &&
      garlicItems.some((g) => g.amount === 50 && g.unit === 'g'),
    'Garlic in cloves (scaled 2x to 4 cloves) and grams (50 g) stay separate'
  );

  // 4. Purchased State Preservation & Manual Extras Retention
  console.log('\n4. Testing purchased state preservation and manual extras retention...');
  const priorGroceries: GroceryItem[] = [
    {
      id: 'gen-rice-g',
      name: 'Rice',
      amount: 200,
      unit: 'g',
      category: 'Pantry',
      isPurchased: true,
      sourceType: 'generated',
    },
    {
      id: 'gen-rice-cup',
      name: 'Rice',
      amount: 1,
      unit: 'cup',
      category: 'Pantry',
      isPurchased: false,
      sourceType: 'generated',
    },
    {
      id: 'man-soap',
      name: 'Dish soap',
      amount: 1,
      unit: 'bottle',
      category: 'Household',
      isPurchased: true,
      sourceType: 'manual',
    },
  ];

  const preservedResult = aggregateGroceriesFromMeals({
    weekMeals: reproMeals,
    existingGroceries: priorGroceries,
  });
  const preservedRiceG = preservedResult.find((g) => g.id === 'gen-rice-g');
  const preservedRiceCup = preservedResult.find((g) => g.id === 'gen-rice-cup');
  const preservedManual = preservedResult.find((g) => g.id === 'man-soap');

  assert(
    Boolean(preservedRiceG && preservedRiceG.isPurchased === true),
    'Unchanged Rice: 200 g retains its purchased checkmark and ID'
  );
  assert(
    Boolean(preservedRiceCup && preservedRiceCup.isPurchased === false),
    'Rice: 1 cup retains its own separate unchecked state without colliding with Rice: 200 g'
  );
  assert(
    Boolean(preservedManual && preservedManual.sourceType === 'manual'),
    'Manual grocery item (Dish soap) survives regeneration intact'
  );

  void classifyAndNormalizeUnit;

  // 5. End-to-End Headless Browser Verification
  console.log('\n5. Running headless browser E2E verification of Grocery Regeneration...');
  const browserReport = await runBrowserGroceryTest();
  if (browserReport.error) {
    console.error('  Browser test error:', browserReport.error);
  }
  assert(!browserReport.error, 'Headless browser Grocery Regeneration test ran without error');
  assert(
    browserReport.storedRiceItems.length === 2 &&
      browserReport.storedRiceItems.some((r) => r.amount === 200 && r.unit === 'g') &&
      browserReport.storedRiceItems.some((r) => r.amount === 1 && r.unit === 'cup'),
    `Browser regeneration stored two distinct Rice items: ${JSON.stringify(
      browserReport.storedRiceItems.map((r) => `${r.amount} ${r.unit}`)
    )}`
  );
  assert(
    browserReport.pantryItems.some(
      (p) => p.name === 'Rice' && p.quantityText === '200 g'
    ) &&
      browserReport.pantryItems.some(
        (p) => p.name === 'Rice' && p.quantityText === '1 cup'
      ) &&
      browserReport.pantryItems.some(
        (p) => p.name === 'Broccoli' && p.quantityText === '1 kg'
      ),
    'GroceriesView DOM renders "Rice 200 g", "Rice 1 cup" separately, and combines "Broccoli 150 g + 0.85 kg" into "1 kg"'
  );

  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
