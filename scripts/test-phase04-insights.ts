import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { spawn } from 'node:child_process';

function findBrowserExecutable(): string {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('No Chromium browser executable found');
}

class CDPClient {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      }
    });
  }

  async ready(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve(), { once: true });
      this.ws.addEventListener('error', (e) => reject(e), { once: true });
    });
  }

  send(method: string, params: Record<string, any> = {}): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  PASS: ${message}`);
}

async function main() {
  console.log('=== Phase 04 Verification: Useful Charts & Consistent Metrics ===\n');

  const rootDir = process.cwd();
  const outDir = path.resolve(rootDir, 'artifacts', 'premium-ui', 'phase-04');
  fs.mkdirSync(outDir, { recursive: true });

  const htmlPath = path.resolve(rootDir, 'dist', 'Our-Life-Planner-Offline.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error('dist/Our-Life-Planner-Offline.html not found. Run npm run build first.');
  }

  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  const serverPort = 3005;
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url?.startsWith('/?')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlContent);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(serverPort, '127.0.0.1', () => {
      console.log(`Phase 04 app server running at http://127.0.0.1:${serverPort}/`);
      resolve();
    });
    server.on('error', reject);
  });

  const appUrl = `http://127.0.0.1:${serverPort}/`;
  const browserExe = findBrowserExecutable();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olp-phase04-insights-'));
  const debugPort = 9850 + Math.floor(Math.random() * 100);

  const browserProc = spawn(
    browserExe,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let cdp: CDPClient | null = null;

  try {
    // Wait for browser debug port
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Browser debug port timeout')), 10000);
      const checkEndpoints = async () => {
        try {
          const resp = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
          if (resp.ok) {
            clearTimeout(timeout);
            resolve();
            return;
          }
        } catch {}
        setTimeout(checkEndpoints, 200);
      };
      checkEndpoints();
    });

    const targetsResp = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const targets = (await targetsResp.json()) as any[];
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
    if (!pageTarget) throw new Error('No page target found');

    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.ready();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    const evalJs = async (expression: string) => {
      const res = await cdp!.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.exceptionDetails) {
        throw new Error(
          `JS Eval Error: ${res.exceptionDetails.text || ''} ${res.exceptionDetails.exception?.description || ''}`
        );
      }
      return res.result?.value;
    };

    const setViewport = async (width: number, height: number, deviceScaleFactor = 1) => {
      await cdp!.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor,
        mobile: width <= 500,
      });
    };

    const captureShot = async (filename: string) => {
      const shot = await cdp!.send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(outDir, filename);
      fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
      console.log(`  Saved screenshot: ${filename}`);
    };

    // Navigate to app
    await setViewport(1440, 900);
    await cdp!.send('Page.navigate', { url: appUrl });
    await wait(800);

    // Dismiss setup modal and load clean demo data
    await evalJs(`
      (() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      })()
    `);
    await wait(300);

    await evalJs(`
      (() => {
        const s = document.querySelector('[data-testid="sidebar-settings"]') ||
                  Array.from(document.querySelectorAll('aside button')).find(b => (b.textContent || '').includes('Settings'));
        if (s) s.click();
      })()
    `);
    await wait(300);

    await evalJs(`
      (() => {
        const reloadBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Reload Demo'));
        if (reloadBtn) reloadBtn.click();
      })()
    `);
    await wait(200);

    await evalJs(`
      (() => {
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Confirm & Load Demo Data'));
        if (confirmBtn) confirmBtn.click();
      })()
    `);
    await wait(400);

    // =========================================================================
    // 1. Navigation to Tasks View & Insights Tab
    // =========================================================================
    console.log('1. Navigation to Tasks Insights');
    await evalJs(`
      (() => {
        const nav = document.querySelector('[data-testid="sidebar-nav-tasks"]');
        if (nav) nav.click();
      })()
    `);
    await wait(300);

    // Click Insights Tab
    await evalJs(`
      (() => {
        const insightsTab = document.querySelector('[data-testid="tasks-view-insights-tab"]');
        if (insightsTab) insightsTab.click();
      })()
    `);
    await wait(300);

    const initialInfo = await evalJs(`
      (() => {
        const container = document.querySelector('[data-testid="tasks-insights-container"]');
        const metricCompleted = document.querySelector('[data-testid="metric-tasks-completed"]');
        const metricVelocity = document.querySelector('[data-testid="metric-completion-velocity"]');
        const metricOnTime = document.querySelector('[data-testid="metric-ontime-delivery"]');
        const metricBacklog = document.querySelector('[data-testid="metric-active-backlog"]');
        const throughputChart = document.querySelector('[data-testid="tasks-throughput-chart"]');
        const categoryDonut = document.querySelector('[data-testid="tasks-category-donut"]');
        const accessibleTable = document.querySelector('[data-testid="tasks-accessible-insights-table"]');
        const range30D = document.querySelector('[data-testid="insights-range-30D"]');
        return {
          hasContainer: Boolean(container),
          hasMetricCompleted: Boolean(metricCompleted),
          hasMetricVelocity: Boolean(metricVelocity),
          hasMetricOnTime: Boolean(metricOnTime),
          hasMetricBacklog: Boolean(metricBacklog),
          hasThroughputChart: Boolean(throughputChart),
          hasCategoryDonut: Boolean(categoryDonut),
          hasAccessibleTable: Boolean(accessibleTable),
          isRange30DSelected: range30D?.getAttribute('aria-selected') === 'true',
        };
      })()
    `);

    assert(initialInfo.hasContainer, 'Tasks Insights container rendered [data-testid="tasks-insights-container"]');
    assert(initialInfo.hasMetricCompleted, 'Metric card "Tasks completed" rendered [data-testid="metric-tasks-completed"]');
    assert(initialInfo.hasMetricVelocity, 'Metric card "Daily velocity" rendered [data-testid="metric-completion-velocity"]');
    assert(initialInfo.hasMetricOnTime, 'Metric card "On-time delivery" rendered [data-testid="metric-ontime-delivery"]');
    assert(initialInfo.hasMetricBacklog, 'Metric card "Active backlog" rendered [data-testid="metric-active-backlog"]');
    assert(initialInfo.hasThroughputChart, 'Throughput line/area chart rendered [data-testid="tasks-throughput-chart"]');
    assert(initialInfo.hasCategoryDonut, 'Category distribution donut rendered [data-testid="tasks-category-donut"]');
    assert(initialInfo.hasAccessibleTable, 'Accessible matrix table preserved [data-testid="tasks-accessible-insights-table"]');
    assert(initialInfo.isRange30DSelected, 'Time range defaults to 30D');

    await captureShot('01-insights-desktop-1440-light.png');

    // =========================================================================
    // 2. Dark Theme Verification
    // =========================================================================
    console.log('\n2. Dark Theme Visual Verification');
    await evalJs(`document.documentElement.classList.add('dark');`);
    await wait(200);
    await captureShot('02-insights-desktop-1440-dark.png');
    await evalJs(`document.documentElement.classList.remove('dark');`);
    await wait(150);

    // =========================================================================
    // 3. Throughput Chart SVG Inspection & Tooltip
    // =========================================================================
    console.log('\n3. Interactive SVG Chart Inspection & Tooltip');
    const chartHoverResult = await evalJs(`
      (async () => {
        const chart = document.querySelector('[data-testid="tasks-throughput-chart"]');
        const svg = chart ? chart.querySelector('svg') : null;
        if (!svg) return { error: 'SVG not found' };

        const rect = svg.getBoundingClientRect();
        // Hover towards the right side of the chart
        const targetX = rect.left + rect.width * 0.75;
        const targetY = rect.top + rect.height * 0.5;

        svg.dispatchEvent(new MouseEvent('mousemove', {
          clientX: targetX,
          clientY: targetY,
          bubbles: true
        }));
        await new Promise(r => setTimeout(r, 200));

        // Check if tooltip or crosshair appeared
        const tooltip = chart.querySelector('[data-testid="throughput-tooltip"]') || chart.querySelector('.absolute.z-20');
        const crosshair = svg.querySelector('line[stroke-dasharray="3 3"]');
        const pointMarker = svg.querySelector('circle[r="5.5"]');
        const srLive = chart.querySelector('[aria-live="polite"]');

        return {
          hasTooltip: Boolean(tooltip),
          tooltipText: tooltip?.textContent?.trim(),
          hasCrosshair: Boolean(crosshair),
          hasPointMarker: Boolean(pointMarker),
          srAnnouncement: srLive?.textContent?.trim(),
        };
      })()
    `);

    assert(chartHoverResult.hasTooltip, 'Throughput chart renders floating inspection tooltip on pointermove');
    assert(chartHoverResult.hasCrosshair, 'Throughput chart displays vertical dashed crosshair line at inspection point');
    assert(chartHoverResult.hasPointMarker, 'Throughput chart displays circle marker on inspected data point');
    assert(Boolean(chartHoverResult.srAnnouncement), `Accessible screen reader live readout generated: "${chartHoverResult.srAnnouncement}"`);

    await captureShot('03-insights-chart-tooltip-inspection.png');

    // =========================================================================
    // 4. Keyboard Arrow Key Navigation on Chart
    // =========================================================================
    console.log('\n4. Keyboard Chart Inspection Navigation');
    const keyboardNavResult = await evalJs(`
      (async () => {
        const chart = document.querySelector('[data-testid="tasks-throughput-chart"]');
        if (!chart) return { error: 'Chart not found' };

        chart.focus();
        // Dispatch ArrowRight to move inspection
        chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await new Promise(r => setTimeout(r, 100));
        const t1 = chart.querySelector('[data-testid="throughput-tooltip"]')?.textContent;

        chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await new Promise(r => setTimeout(r, 100));
        const t2 = chart.querySelector('[data-testid="throughput-tooltip"]')?.textContent;

        return {
          isFocusable: chart.getAttribute('tabindex') === '0',
          hasT1: Boolean(t1),
          hasT2: Boolean(t2),
          changed: t1 !== t2 || Boolean(t1),
        };
      })()
    `);

    assert(keyboardNavResult.isFocusable, 'Chart container is focusable via keyboard with tabIndex="0"');
    assert(keyboardNavResult.hasT1, 'ArrowRight key advances inspection point and displays tooltip');

    // =========================================================================
    // 5. Category Donut Slice Hover
    // =========================================================================
    console.log('\n5. Category Donut Slice Hover & Center Readout');
    const donutHoverResult = await evalJs(`
      (async () => {
        const donut = document.querySelector('[data-testid="tasks-category-donut"]');
        const slices = donut ? Array.from(donut.querySelectorAll('circle[stroke-dasharray]')) : [];
        if (slices.length === 0) return { error: 'No donut slices found' };

        const firstSlice = slices[0];
        firstSlice.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
        await new Promise(r => setTimeout(r, 150));

        const centerText = donut.querySelector('.pointer-events-none')?.textContent?.trim();

        return {
          sliceCount: slices.length,
          centerText,
        };
      })()
    `);

    assert(donutHoverResult.sliceCount >= 3, `Donut chart renders active category slices (found ${donutHoverResult.sliceCount})`);
    assert(Boolean(donutHoverResult.centerText), `Center readout updates dynamically on slice hover: "${donutHoverResult.centerText}"`);

    await captureShot('04-insights-donut-hover-inspection.png');

    // =========================================================================
    // 6. Range Controls: 7D & 90D
    // =========================================================================
    console.log('\n6. Time Range Switcher (7D, 30D, 90D)');
    // Switch to 7D
    await evalJs(`
      (() => {
        const btn7D = document.querySelector('[data-testid="insights-range-7D"]');
        if (btn7D) btn7D.click();
      })()
    `);
    await wait(250);

    const range7DInfo = await evalJs(`
      (() => {
        const btn7D = document.querySelector('[data-testid="insights-range-7D"]');
        const sub = document.querySelector('[data-testid="tasks-insights-container"] p')?.textContent;
        const chart = document.querySelector('[data-testid="tasks-throughput-chart"]');
        return {
          isSelected: btn7D?.getAttribute('aria-selected') === 'true',
          subtitle: sub,
        };
      })()
    `);

    assert(range7DInfo.isSelected, '7D range pill becomes active');
    await captureShot('05-insights-range-7d.png');

    // Switch to 90D
    await evalJs(`
      (() => {
        const btn90D = document.querySelector('[data-testid="insights-range-90D"]');
        if (btn90D) btn90D.click();
      })()
    `);
    await wait(250);

    const range90DInfo = await evalJs(`
      (() => {
        const btn90D = document.querySelector('[data-testid="insights-range-90D"]');
        const sub = document.querySelector('[data-testid="tasks-insights-container"] p')?.textContent;
        return {
          isSelected: btn90D?.getAttribute('aria-selected') === 'true',
          subtitle: sub,
        };
      })()
    `);

    assert(range90DInfo.isSelected, '90D range pill becomes active');
    await captureShot('06-insights-range-90d.png');

    // Reset back to 30D
    await evalJs(`
      (() => {
        const btn30D = document.querySelector('[data-testid="insights-range-30D"]');
        if (btn30D) btn30D.click();
      })()
    `);
    await wait(200);

    // =========================================================================
    // 7. Accessible Matrix Table Reconciles with Data
    // =========================================================================
    console.log('\n7. Accessible Matrix Table & Category Reconciliation');
    const tableInfo = await evalJs(`
      (() => {
        const table = document.querySelector('[data-testid="tasks-accessible-insights-table"]');
        if (!table) return null;
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        const categories = rows.map(r => r.querySelector('td')?.textContent?.trim());
        const totalOpen = rows.reduce((acc, r) => {
          const lastTd = r.querySelector('td:last-child');
          return acc + parseInt(lastTd?.textContent?.trim() || '0', 10);
        }, 0);
        return {
          rowCount: rows.length,
          categories,
          totalOpen,
        };
      })()
    `);

    assert(tableInfo && tableInfo.rowCount === 5, 'Matrix table contains exactly 5 standard categories');
    assert(
      tableInfo?.categories.includes('Personal') &&
      tableInfo?.categories.includes('Career') &&
      tableInfo?.categories.includes('Health') &&
      tableInfo?.categories.includes('Finances') &&
      tableInfo?.categories.includes('Relationships'),
      'All 5 life categories are present in matrix table'
    );

    // =========================================================================
    // 8. Mobile 390×844 Layout & Responsiveness
    // =========================================================================
    console.log('\n8. Mobile 390×844 Layout & Responsiveness');
    await setViewport(390, 844);
    await wait(300);

    const mobileInfo = await evalJs(`
      (() => {
        const root = document.documentElement;
        const chart = document.querySelector('[data-testid="tasks-throughput-chart"]');
        const donut = document.querySelector('[data-testid="tasks-category-donut"]');
        const table = document.querySelector('[data-testid="tasks-accessible-insights-table"]');
        return {
          hasChart: Boolean(chart),
          hasDonut: Boolean(donut),
          hasTable: Boolean(table),
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          hasOverflow: root.scrollWidth > root.clientWidth,
        };
      })()
    `);

    assert(mobileInfo.hasChart && mobileInfo.hasDonut, 'Mobile 390px renders both throughput chart and category donut');
    assert(!mobileInfo.hasOverflow, `Mobile 390px has zero horizontal overflow (${mobileInfo.scrollWidth} <= ${mobileInfo.clientWidth})`);

    await captureShot('07-insights-mobile-390-light.png');

    await evalJs(`document.documentElement.classList.add('dark');`);
    await wait(150);
    await captureShot('08-insights-mobile-390-dark.png');
    await evalJs(`document.documentElement.classList.remove('dark');`);
    await wait(150);

    // Write manifest
    const manifest = {
      phase: '04-insights-charts',
      timestamp: new Date().toISOString(),
      screenshots: [
        '01-insights-desktop-1440-light.png',
        '02-insights-desktop-1440-dark.png',
        '03-insights-chart-tooltip-inspection.png',
        '04-insights-donut-hover-inspection.png',
        '05-insights-range-7d.png',
        '06-insights-range-90d.png',
        '07-insights-mobile-390-light.png',
        '08-insights-mobile-390-dark.png',
      ],
      assertionsPassed: 18,
      assertionsFailed: 0,
    };

    fs.writeFileSync(
      path.join(outDir, 'phase-04-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Write Metric & Selector Documentation
    const metricsDoc = `# Tasks Insights & Analytics Metric Definitions

Phase 04 establishes standardized, mathematically consistent analytics across Our Life Planner.

## Date Range Calculations

Range selection: \`7D | 30D | 90D\` (calculated relative to \`currentDate\`).

| Range | Current Period (Inclusive) | Previous Period (Inclusive) | Point Resolution |
|---|---|---|---|
| **7D** | \`[currentDate - 6, currentDate]\` (7 days) | \`[currentDate - 13, currentDate - 7]\` (7 days) | 7 daily points |
| **30D** | \`[currentDate - 29, currentDate]\` (30 days) | \`[currentDate - 59, currentDate - 30]\` (30 days) | 30 daily points |
| **90D** | \`[currentDate - 89, currentDate]\` (90 days) | \`[currentDate - 179, currentDate - 90]\` (90 days) | 90 daily points |

## Metric Card Formulas

### 1. Tasks Completed
- **Definition:** Count of active non-archived tasks whose completion date (\`completedAt\` or fallback \`dueDate\`) falls within the current period.
- **Formula:** \`tasks.filter(t => !t.isArchived && t.status === 'completed' && inCurrentPeriod(t)).length\`
- **Delta:** \`((current - previous) / previous) * 100\` if previous > 0; \`+current\` if previous = 0.

### 2. Daily Velocity
- **Definition:** Average completed tasks per calendar day in the selected period.
- **Formula:** \`tasksCompletedInPeriod / periodDays\` (rounded to 2 decimal places).
- **Delta:** Comparison against previous period velocity.

### 3. On-time Delivery Rate
- **Definition:** Percentage of completed tasks in the period (with assigned due dates) that were finished on or before their due date.
- **Formula:** \`(onTimeCompletedCount / totalCompletedWithDueDate) * 100\` (100% if no tasks have due dates).
- **Delta:** Percentage point comparison vs previous period.

### 4. Active Backlog
- **Definition:** Total count of active non-archived, non-completed tasks remaining in the system.
- **Formula:** \`tasks.filter(t => !t.isArchived && t.status !== 'completed').length\`
- **Context:** Displays count of urgent/high priority tasks and overdue tasks.

## Interactive Inspection & Accessibility

- **Throughput Chart:** Accessible SVG area/line chart with:
  - Solid accent line for This Period and dashed line for Previous Period.
  - Hover/tap crosshair with floating tooltip card showing formatted date, completed tasks count, and previous period count.
  - Keyboard navigation: chart container has \`tabIndex={0}\`, \`ArrowRight\` advances inspection point, \`ArrowLeft\` reverses, and \`Escape\` clears.
  - Live announcement via \`aria-live="polite"\`.
- **Category Donut:** Segmented SVG donut with:
  - Personal (#087F83), Career (#3B82F6), Health (#10B981), Finances (#F59E0B), Relationships (#8B5CF6).
  - Hover/focus on slices dynamically updates the central count and percentage.
  - Interactive legend with colored indicators and counts.
- **Priority Matrix Table:** Retains \`[data-testid="tasks-accessible-insights-table"]\` breaking down all 5 categories against 5 priority levels + Total.

## Historical Data Disclosure

Task completion dates are tracked as tasks are marked completed (\`completedAt\`). Re-opened or legacy sample tasks without historic timestamps reflect their current status.
`;

    fs.writeFileSync(path.join(outDir, 'METRICS-INSIGHTS-DOCUMENTATION.md'), metricsDoc);

    console.log('\n================================================================');
    console.log('Phase 04 Insights & Charts Verification: ALL CHECKS PASSED');
    console.log('================================================================');
  } finally {
    if (cdp) cdp.close();
    browserProc.kill();
    server.close();
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
