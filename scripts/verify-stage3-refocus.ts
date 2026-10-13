import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
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

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  console.log('=== Stage 3 Verification: Refocus Today & Responsive Navigation ===\n');

  const htmlPath = path.resolve(process.cwd(), 'dist', 'Our-Life-Planner-Offline.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error('dist/Our-Life-Planner-Offline.html does not exist');
  }

  const htmlContent = fs
    .readFileSync(htmlPath, 'utf-8')
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, '')
    .replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/gi, '');

  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url?.startsWith('/?')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlContent);
      return;
    }
    res.writeHead(204);
    res.end();
  });

  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as any).port;
  const appUrl = `http://127.0.0.1:${port}/`;

  const browserExe = findBrowserExecutable();
  const userDataDir = path.resolve(process.cwd(), 'dist', `.tmp-edge-stage3-${Date.now()}`);

  const proc = spawn(
    browserExe,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=0',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const wsUrl = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('DevTools listening timeout')), 15000);
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      const match = text.match(/ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-zA-Z0-9-]+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    };
    proc.stderr.on('data', onData);
    proc.stdout.on('data', onData);
  });

  const browserCdp = new CDPClient(wsUrl);
  await browserCdp.ready();

  try {
    const { targetId } = await browserCdp.send('Target.createTarget', { url: appUrl });
    const portMatch = wsUrl.match(/ws:\/\/127\.0\.0\.1:(\d+)\//)!;
    const debugPort = portMatch[1];
    const targetsRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const targets = (await targetsRes.json()) as Array<{ id: string; webSocketDebuggerUrl: string }>;
    const pageTarget = targets.find((t) => t.id === targetId) || targets[0];

    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    const evalJs = async <T = any>(expression: string): Promise<T> => {
      const res = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.exceptionDetails) {
        throw new Error(
          `JS Runtime exception: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description || ''}`
        );
      }
      return res.result?.value as T;
    };

    const setViewport = async (width: number, height: number, mobile = false) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
      });
      await wait(180);
    };

    const captureScreenshot = async (filename: string) => {
      const res = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const dir = path.resolve(process.cwd(), 'screenshots');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), Buffer.from(res.data, 'base64'));
    };

    await setViewport(1440, 900, false);
    await wait(350);

    // =========================================================================
    // 1. Setup Wizard: Start Empty + Core Starter Tools (5)
    // =========================================================================
    console.log('1. Setup Wizard: Start Empty + Core Starter Tools (5)');

    await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const nameInput = document.querySelector('#setup-owner-name');
        if (nameInput) {
          const proto = Object.getPrototypeOf(nameInput);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(nameInput, 'Alex');
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          nameInput.dispatchEvent(new Event('change', { bubbles: true }));
          await wait(60);
        }
        const step1Btn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          b => b.textContent?.includes('Choose Tools & Data')
        );
        if (step1Btn) {
          step1Btn.click();
          await wait(150);
        }
        const starterBtn = document.querySelector('[data-testid="setup-preset-starter"]');
        if (starterBtn) starterBtn.click();
        await wait(60);

        const emptyRadio = Array.from(document.querySelectorAll('[role="dialog"] [role="radio"]')).find(
          b => b.textContent?.includes('Start Empty')
        );
        if (emptyRadio) {
          emptyRadio.click();
          await wait(60);
        }
        const confirmBox = document.querySelector('#setup-confirm-destructive');
        if (confirmBox && !confirmBox.checked) {
          confirmBox.click();
          await wait(60);
        }
        const nextBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          b => b.textContent?.includes('Add First Commitments')
        );
        if (nextBtn) {
          nextBtn.click();
          await wait(120);
        }
        const finishBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          b => b.textContent?.includes('Launch My Planner')
        );
        if (finishBtn) {
          finishBtn.click();
          await wait(250);
        }
      })()
    `);

    // =========================================================================
    // 2. Empty State Layout Budget at Mobile 390x844 (No Scrolling Required)
    // =========================================================================
    console.log('\n2. Mobile 390x844 Empty State Layout Budget');
    await setViewport(390, 844, true);

    const emptyMetrics = await evalJs(`
      (() => {
        const todayNav = document.querySelector('[data-testid="mobile-nav-today"]');
        if (todayNav) todayNav.click();

        const emptyHero = document.querySelector('[data-testid="today-empty-state"]');
        const emptyCta = document.querySelector('[data-testid="today-empty-cta"]');
        const mobileNav = document.querySelector('nav[aria-label="Mobile navigation"]');
        const weekStrip = document.querySelector('.card-surface');
        const moneyCard = Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('Money'));
        const healthCard = Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('Your health'));
        const habitCard = Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('Daily rhythm'));

        return {
          hasEmptyHero: Boolean(emptyHero),
          hasEmptyCta: Boolean(emptyCta),
          emptyCtaTop: emptyCta ? Math.round(emptyCta.getBoundingClientRect().top) : null,
          emptyCtaBottom: emptyCta ? Math.round(emptyCta.getBoundingClientRect().bottom) : null,
          mobileNavTop: mobileNav ? Math.round(mobileNav.getBoundingClientRect().top) : 780,
          weekStripHeight: weekStrip ? Math.round(weekStrip.getBoundingClientRect().height) : null,
          hasMoneyCard: Boolean(moneyCard),
          hasHealthCard: Boolean(healthCard),
          hasHabitCard: Boolean(habitCard),
        };
      })()
    `);

    assert(
      emptyMetrics.hasEmptyHero && emptyMetrics.hasEmptyCta,
      'Today empty state displays hero card and "Add your first item for today" CTA'
    );
    assert(
      emptyMetrics.emptyCtaBottom !== null && emptyMetrics.emptyCtaBottom < emptyMetrics.mobileNavTop,
      `Empty state CTA button is visible without scrolling (bottom=${emptyMetrics.emptyCtaBottom}px < ${emptyMetrics.mobileNavTop}px)`
    );
    assert(
      !emptyMetrics.hasMoneyCard && !emptyMetrics.hasHealthCard && !emptyMetrics.hasHabitCard,
      'Disabled starter tools (money, health, habits) do not leak into Today widgets'
    );
    assert(
      emptyMetrics.weekStripHeight !== null && emptyMetrics.weekStripHeight <= 140,
      `Compact mobile week summary height <= 140px (actual: ${emptyMetrics.weekStripHeight}px)`
    );

    await captureScreenshot('stage3-mobile-390-empty.png');

    // =========================================================================
    // 3. Load Demo Data to Verify Populated Layout Budget with Next Up & Overdue
    // =========================================================================
    console.log('\n3. Mobile 390x844 Populated Layout Budget (Next Up & Overdue)');
    // Switch to desktop to easily navigate settings
    await setViewport(1440, 900, false);

    await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const settingsBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Settings');
        if (settingsBtn) {
          settingsBtn.click();
          await wait(150);
        }
        const allPreset = document.querySelector('[data-testid="settings-preset-all"]');
        if (allPreset) {
          allPreset.click();
          await wait(100);
        }
        const reloadBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Reload Demo'));
        if (reloadBtn) {
          reloadBtn.click();
          await wait(100);
        }
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Confirm & Load Demo Data'));
        if (confirmBtn) {
          confirmBtn.click();
          await wait(300);
        }
        const todayNav = document.querySelector('[data-testid="sidebar-nav-today"]');
        if (todayNav) {
          todayNav.click();
          await wait(150);
        }
      })()
    `);

    // Measure at mobile 390x844
    await setViewport(390, 844, true);

    const popMetrics = await evalJs(`
      (() => {
        const nextUp = document.querySelector('.card-surface.border-l-4');
        const nextUpBtn = nextUp ? nextUp.querySelector('.btn-primary') : null;
        const mobileNav = document.querySelector('nav[aria-label="Mobile navigation"]');
        const weekStrip = document.querySelector('.card-surface');
        const overdueBanner = document.querySelector('.bg-rose-50, [class*="rose-950"]');

        return {
          hasOverdueBanner: Boolean(overdueBanner),
          mobileNavTop: mobileNav ? Math.round(mobileNav.getBoundingClientRect().top) : 780,
          nextUpTop: nextUp ? Math.round(nextUp.getBoundingClientRect().top) : null,
          nextUpBtnTop: nextUpBtn ? Math.round(nextUpBtn.getBoundingClientRect().top) : null,
          nextUpBtnBottom: nextUpBtn ? Math.round(nextUpBtn.getBoundingClientRect().bottom) : null,
          nextUpBtnText: nextUpBtn ? nextUpBtn.textContent?.trim() : '',
          weekStripHeight: weekStrip ? Math.round(weekStrip.getBoundingClientRect().height) : null,
        };
      })()
    `);

    assert(
      popMetrics.hasOverdueBanner,
      'Overdue action center is displayed when overdue tasks exist'
    );
    assert(
      popMetrics.nextUpTop !== null && popMetrics.nextUpTop < popMetrics.mobileNavTop,
      `Next Up card top is above mobile nav fold (y=${popMetrics.nextUpTop}px < ${popMetrics.mobileNavTop}px)`
    );
    assert(
      popMetrics.nextUpBtnBottom !== null && popMetrics.nextUpBtnBottom < popMetrics.mobileNavTop,
      `Primary action "${popMetrics.nextUpBtnText}" button is visible without scrolling (bottom=${popMetrics.nextUpBtnBottom}px < ${popMetrics.mobileNavTop}px)`
    );

    await captureScreenshot('stage3-mobile-390-populated.png');

    // =========================================================================
    // 4. Responsive Breakpoints Zero Horizontal Overflow
    // =========================================================================
    console.log('\n4. Responsive Breakpoints Zero Horizontal Overflow');
    const testWidths = [320, 390, 768, 1440];
    for (const width of testWidths) {
      await setViewport(width, 844, width < 768);
      const overflow = await evalJs(`
        (() => {
          const docWidth = document.documentElement.scrollWidth;
          const winWidth = window.innerWidth;
          return {
            scrollWidth: docWidth,
            innerWidth: winWidth,
            hasOverflow: docWidth > winWidth,
          };
        })()
      `);
      assert(
        !overflow.hasOverflow,
        `Viewport width ${width}px has zero horizontal overflow (scrollWidth=${overflow.scrollWidth}px, innerWidth=${overflow.innerWidth}px)`
      );
    }

    // =========================================================================
    // 5. Calm View Display Preference & Focus Mode Standardization
    // =========================================================================
    console.log('\n5. Calm View Display Preference & Focus Mode Standardization');
    await setViewport(1440, 900, false);

    const calmInitial = await evalJs(`
      (() => {
        const moneyCard = Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('Money'));
        const healthCard = Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('Your health'));
        const calmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Calm'));
        return {
          hasMoney: Boolean(moneyCard),
          hasHealth: Boolean(healthCard),
          ariaPressed: calmBtn ? calmBtn.getAttribute('aria-pressed') : '',
        };
      })()
    `);
    assert(
      calmInitial.hasMoney && calmInitial.hasHealth,
      'Money and Health widgets visible in default mode with demo data'
    );
    assert(calmInitial.ariaPressed === 'false', 'Calm View toggle initially aria-pressed="false"');

    await captureScreenshot('stage3-desktop-1440-default.png');

    // Toggle Calm View ON
    await evalJs(`
      (() => {
        const calmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Calm'));
        if (calmBtn) calmBtn.click();
      })()
    `);
    await wait(150);

    const calmActive = await evalJs(`
      (() => {
        const moneyCard = Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('Money'));
        const healthCard = Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('Your health'));
        const calmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Calm'));
        return {
          hasMoney: Boolean(moneyCard),
          hasHealth: Boolean(healthCard),
          ariaPressed: calmBtn ? calmBtn.getAttribute('aria-pressed') : '',
        };
      })()
    `);
    assert(!calmActive.hasMoney && !calmActive.hasHealth, 'Money and Health widgets hidden when Calm View is active');
    assert(calmActive.ariaPressed === 'true', 'Calm View button reflects aria-pressed="true"');

    await captureScreenshot('stage3-desktop-1440-calm.png');

    // Toggle Calm View OFF
    await evalJs(`
      (() => {
        const calmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Calm'));
        if (calmBtn) calmBtn.click();
      })()
    `);
    await wait(150);

    // Open Focus Mode modal
    await evalJs(`
      (() => {
        const focusBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Focus Mode');
        if (focusBtn) focusBtn.click();
      })()
    `);
    await wait(200);

    const focusModalInfo = await evalJs(`
      (() => {
        const dialog = document.querySelector('[role="dialog"][aria-labelledby="focus-title"]');
        const spans = dialog ? Array.from(dialog.querySelectorAll('span')) : [];
        const hasBadge = spans.some(s => s.textContent?.trim() === 'Focus Mode');
        const closeBtn = dialog ? dialog.querySelector('button[aria-label="Close Focus Mode"]') : null;
        return {
          isOpen: Boolean(dialog),
          hasBadge,
          hasCloseBtnWithFocusModeLabel: Boolean(closeBtn),
        };
      })()
    `);
    assert(focusModalInfo.isOpen, 'Focus Mode modal opens cleanly');
    assert(focusModalInfo.hasBadge, 'Focus Mode modal standardized badge says "Focus Mode"');
    assert(focusModalInfo.hasCloseBtnWithFocusModeLabel, 'Focus Mode close button has accessible label "Close Focus Mode"');

    await captureScreenshot('stage3-desktop-focus-modal.png');

    // Close Focus Mode modal
    await evalJs(`
      (() => {
        const closeBtn = document.querySelector('button[aria-label="Close Focus Mode"]');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await wait(150);

    // =========================================================================
    // 6. Module Registry Consistency (Disabling Money & Health)
    // =========================================================================
    console.log('\n6. Module Registry Consistency (Disabling Money & Health)');
    await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const settingsBtn = Array.from(document.querySelectorAll('aside button, nav button')).find(
          b => b.textContent?.includes('Settings')
        );
        if (settingsBtn) {
          settingsBtn.click();
          await wait(150);
        }
        const moneySwitch = document.querySelector('[data-testid="module-toggle-money"]');
        if (moneySwitch && moneySwitch.getAttribute('aria-pressed') === 'true') moneySwitch.click();
        await wait(100);
        const bodySwitch = document.querySelector('[data-testid="module-toggle-body"]');
        if (bodySwitch && bodySwitch.getAttribute('aria-pressed') === 'true') bodySwitch.click();
        await wait(100);
        const todayBtn = Array.from(document.querySelectorAll('aside button, nav button')).find(
          b => b.textContent?.includes('Today')
        );
        if (todayBtn) {
          todayBtn.click();
          await wait(200);
        }
      })()
    `);

    const disabledWidgetsCheck = await evalJs(`
      (() => {
        const moneyCard = Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('Money'));
        const healthCard = Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('Your health'));
        const billsInSchedule = Array.from(document.querySelectorAll('span')).filter(s => s.textContent?.includes('Bill'));
        return {
          hasMoneyCard: Boolean(moneyCard),
          hasHealthCard: Boolean(healthCard),
          billCountInSchedule: billsInSchedule.length,
        };
      })()
    `);

    assert(!disabledWidgetsCheck.hasMoneyCard, 'Money summary widget completely hidden when money module is disabled');
    assert(!disabledWidgetsCheck.hasHealthCard, 'Health summary widget completely hidden when body module is disabled');
    assert(disabledWidgetsCheck.billCountInSchedule === 0, 'No bills leak into Today schedule when money module is disabled');

    console.log(`\n================================================================`);
    console.log(`Stage 3 Verification Summary: ${passed} passed, ${failed} failed.`);
    console.log(`================================================================`);

    cdp.close();
    browserCdp.close();
    proc.kill();
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test error:', err);
    browserCdp.close();
    proc.kill();
    server.close();
    process.exit(1);
  }
}

main();
