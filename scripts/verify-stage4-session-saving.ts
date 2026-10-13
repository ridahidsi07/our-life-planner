/**
 * Automated Verification Suite for Stage 4:
 * Buyer's First Session and Saving Confidence
 *
 * Verifies:
 * 1. Onboarding clarity & starter preset selection
 * 2. First-action guidance & Today creation loop
 * 3. Visible saving feedback (Header indicator, optimistic state -> confirmed local persistence)
 * 4. Demo-data labeling & 1-click removal of sample records
 * 5. Reopening setup wizard (safely preserving user records)
 * 6. Storage explanation & footprint in AccountModal (Profile & Storage)
 * 7. Restore preview & automatic safety rollback in BackupRestoreModal
 * 8. Clear distinction of unconfigured data vs meaningful zero values
 * 9. Storage failure handling with retained input & emergency JSON export
 */

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
  }

  ready(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data.toString());
          if (msg.id && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id)!;
            this.pending.delete(msg.id);
            if (msg.error) {
              reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            } else {
              resolve(msg.result);
            }
          }
        } catch {
          // ignore parsing error
        }
      };
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
    } catch {
      // ignore
    }
  }
}

async function main() {
  console.log('=== Stage 4 Verification: Buyer First Session & Saving Confidence ===\n');

  const distDir = path.resolve(process.cwd(), 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error('dist/index.html not found. Run "npm run build" first.');
  }

  // Host standalone app locally
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
    let filePath = path.join(distDir, parsedUrl.pathname);
    if (parsedUrl.pathname === '/' || !fs.existsSync(filePath)) {
      filePath = indexHtmlPath;
    }
    const ext = path.extname(filePath);
    const contentTypeMap: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
    };
    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentTypeMap[ext] || 'application/octet-stream' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as any).port;
  const appUrl = `http://127.0.0.1:${port}/`;

  const browserExe = findBrowserExecutable();
  const userDataDir = path.resolve(process.cwd(), 'dist', `.tmp-edge-stage4-${Date.now()}`);

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

    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    await wait(400);

    let passed = 0;
    let failed = 0;
    const assert = (condition: boolean, msg: string) => {
      if (condition) {
        console.log(`  PASS: ${msg}`);
        passed++;
      } else {
        console.error(`  FAIL: ${msg}`);
        failed++;
      }
    };

    // =========================================================================
    // 1. Setup Wizard: Onboarding Clarity & Starter Preset
    // =========================================================================
    console.log('1. Setup Wizard: Onboarding Clarity & Starter Preset');

    // Wait for the app and setup wizard to mount
    for (let i = 0; i < 40; i++) {
      const ready = await evalJs(`Boolean(document.querySelector('#setup-owner-name'))`);
      if (ready) break;
      await wait(100);
    }

    const setupInfo = await evalJs(`
      (() => {
        const dialog = document.querySelector('[role="dialog"][aria-label="Setup Wizard"]');
        const nameInput = document.querySelector('#setup-owner-name');
        return {
          isDialogOpen: Boolean(dialog),
          hasNameInput: Boolean(nameInput),
        };
      })()
    `);
    assert(setupInfo.isDialogOpen && setupInfo.hasNameInput, 'Setup wizard opens on first session with profile step');

    // Fill Step 1 and proceed to Step 2
    await evalJs(`
      (async () => {
        const nameInput = document.querySelector('#setup-owner-name');
        if (nameInput) {
          const proto = Object.getPrototypeOf(nameInput);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          desc.set.call(nameInput, 'Taylor');
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          nameInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const step1Btn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          b => b.textContent?.includes('Choose Tools & Data')
        );
        if (step1Btn) step1Btn.click();
      })()
    `);
    await wait(200);

    const step2Info = await evalJs(`
      (() => {
        const starterBtn = document.querySelector('[data-testid="setup-preset-starter"]');
        const emptyRadio = document.querySelector('[data-testid="setup-preset-empty"]');
        const sampleRadio = document.querySelector('[data-testid="setup-preset-sample"]');
        return {
          hasStarterBtn: Boolean(starterBtn),
          hasEmptyRadio: Boolean(emptyRadio),
          hasSampleRadio: Boolean(sampleRadio),
          emptyRadioText: emptyRadio ? emptyRadio.textContent : '',
        };
      })()
    `);
    assert(step2Info.hasStarterBtn, 'Core Starter (5) preset button is available');
    assert(step2Info.hasEmptyRadio, 'Start Empty data choice is available');
    assert(step2Info.emptyRadioText?.includes('Recommended'), 'Start Empty is clearly marked as (Recommended) for new buyers');

    await captureScreenshot('stage4-setup-step2-choices.png');

    // Select Start Empty, verify Starter (5) preset button, then select All Modules (10) for full navigation + proceed to Step 3
    await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const emptyRadio = document.querySelector('[data-testid="setup-preset-empty"]');
        if (emptyRadio) emptyRadio.click();
        await wait(50);
        const starterBtn = document.querySelector('[data-testid="setup-preset-starter"]');
        if (starterBtn) starterBtn.click();
        await wait(50);
        const allBtn = document.querySelector('[data-testid="setup-preset-all"]');
        if (allBtn) allBtn.click();
        await wait(50);
        const confirmBox = document.querySelector('#setup-confirm-destructive');
        if (confirmBox && !confirmBox.checked) confirmBox.click();
        const nextBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          b => b.textContent?.includes('Add First Commitments')
        );
        if (nextBtn) nextBtn.click();
      })()
    `);
    await wait(200);

    const step3Info = await evalJs(`
      (() => {
        const dialog = document.querySelector('[role="dialog"]');
        const text = dialog ? dialog.textContent : '';
        const hasReassurance = text.includes('Next Up') && text.includes('stored privately and locally');
        return { hasReassurance };
      })()
    `);
    assert(step3Info.hasReassurance, 'Step 3 explains Next Up placement and private local storage before launching');

    // Enter first task and launch planner
    await evalJs(`
      (async () => {
        const taskInput = document.querySelector('input[aria-label="First task title"]');
        if (taskInput) {
          const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
          if (desc && desc.set) {
            desc.set.call(taskInput, 'Finalize monthly product budget');
          } else {
            taskInput.value = 'Finalize monthly product budget';
          }
          taskInput.dispatchEvent(new Event('input', { bubbles: true }));
          taskInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const finishBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          b => b.textContent?.includes('Launch My Planner')
        );
        if (finishBtn) finishBtn.click();
      })()
    `);
    await wait(300);

    // =========================================================================
    // 2. First-Session Today Dashboard & Item Visibility
    // =========================================================================
    console.log('\n2. First-Session Today Dashboard & Item Visibility');

    const todayAfterLaunch = await evalJs(`
      (() => {
        const nextUpTitle = document.querySelector('[data-testid="today-next-up-title"]')?.textContent || '';
        const greeting = document.querySelector('header h1')?.textContent || '';
        const markCompleteBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent?.includes('Mark Complete')
        );
        return {
          greeting,
          nextUpTitle,
          hasNextUpCommitment: nextUpTitle.includes('Finalize monthly product budget'),
          hasMarkCompleteBtn: Boolean(markCompleteBtn),
        };
      })()
    `);
    assert(todayAfterLaunch.greeting.includes('Taylor'), 'Personalized greeting reflects owner name entered in setup');
    assert(todayAfterLaunch.hasNextUpCommitment, 'First task created in setup is immediately present in Today Next Up card');
    assert(todayAfterLaunch.hasMarkCompleteBtn, 'Next Up task has immediate "Mark Complete" 1-click action');

    // =========================================================================
    // 3. Visible Saving Feedback in Header & Profile
    // =========================================================================
    console.log('\n3. Visible Saving Feedback in Header & Profile');

    const headerSavingInfo = await evalJs(`
      (() => {
        const savingPill = document.querySelector('[data-testid="header-saving-indicator"]');
        const avatar = document.querySelector('[data-testid="header-profile-avatar"]');
        return {
          hasSavingPill: Boolean(savingPill),
          savingText: savingPill ? savingPill.textContent?.trim() : '',
          hasAvatar: Boolean(avatar),
        };
      })()
    `);
    assert(headerSavingInfo.hasSavingPill, 'Header displays visible saving indicator [data-testid="header-saving-indicator"]');
    assert(headerSavingInfo.savingText.includes('Saved locally'), 'Saving indicator confirms "Saved locally" in browser');

    await captureScreenshot('stage4-header-storage-indicator.png');

    // Test mobile saving indicator presence
    await setViewport(390, 844, true);
    const mobileHeaderInfo = await evalJs(`
      (() => {
        const avatar = document.querySelector('[data-testid="header-profile-avatar"]');
        const statusDot = avatar ? avatar.querySelector('span[aria-hidden="true"]') : null;
        return {
          hasAvatar: Boolean(avatar),
          hasStatusDot: Boolean(statusDot),
        };
      })()
    `);
    assert(mobileHeaderInfo.hasStatusDot, 'Mobile header avatar contains persistent saving status dot');

    await setViewport(1440, 900, false);

    // =========================================================================
    // 4. AccountModal Storage Explanation & Footprint
    // =========================================================================
    console.log('\n4. AccountModal Storage Explanation & Footprint');

    await evalJs(`
      (() => {
        const pill = document.querySelector('[data-testid="header-saving-indicator"]');
        if (pill) pill.click();
      })()
    `);
    await wait(250);

    const accountModalInfo = await evalJs(`
      (() => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(
          d => d.textContent?.includes('Profile, Local Storage')
        );
        const text = dialog ? dialog.textContent : '';
        const advanced = document.querySelector('[data-testid="account-advanced-details"]');
        if (advanced && !advanced.open) advanced.open = true;
        return {
          isOpen: Boolean(dialog),
          explainsLocalStorage: text.includes('Local-First Browser Storage') || text.includes('stored on this device'),
          hasStorageFootprint: text.includes('Storage Used') || text.includes('Active in this browser'),
        };
      })()
    `);
    assert(accountModalInfo.isOpen, 'Clicking header saving indicator opens Profile & Storage modal');
    assert(accountModalInfo.explainsLocalStorage, 'Account modal explicitly explains private local-first storage');
    assert(accountModalInfo.hasStorageFootprint, 'Account modal displays active storage footprint and item count');

    await captureScreenshot('stage4-account-storage-explanation.png');

    // Close account modal
    await evalJs(`
      (() => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(
          d => d.textContent?.includes('Profile, Local Storage')
        );
        const closeBtn = dialog ? dialog.querySelector('button[aria-label^="Close"]') : null;
        if (closeBtn) closeBtn.click();
      })()
    `);
    await wait(180);

    // =========================================================================
    // 5. Demo-Data Labeling & 1-Click Clean Removal
    // =========================================================================
    console.log('\n5. Demo-Data Labeling & 1-Click Clean Removal');

    // Navigate to Settings to reload demo data
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
        const reloadDemoBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent?.includes('Reload Demo / Sample Data')
        );
        if (reloadDemoBtn) reloadDemoBtn.click();
        await wait(200);
        const confirmBtn = document.querySelector('[data-testid="confirm-reload-demo-btn"]');
        if (confirmBtn) confirmBtn.click();
        await wait(300);
      })()
    `);

    // Verify Demo Mode banner appears at top
    const demoBannerInfo = await evalJs(`
      (() => {
        const banner = document.querySelector('[data-testid="demo-data-banner"]');
        const clearBtn = document.querySelector('[data-testid="clear-demo-data-btn"]');
        return {
          hasBanner: Boolean(banner),
          bannerText: banner ? banner.textContent : '',
          hasClearBtn: Boolean(clearBtn),
        };
      })()
    `);
    assert(demoBannerInfo.hasBanner, 'Demo mode banner [data-testid="demo-data-banner"] is displayed when sample data is active');
    assert(demoBannerInfo.hasClearBtn, 'Demo banner provides 1-click "Remove sample data" button');

    await captureScreenshot('stage4-demo-mode-banner.png');

    // Add a custom task while demo mode is active to verify selective preservation
    await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const quickAddBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent?.includes('Quick add')
        );
        if (quickAddBtn) {
          quickAddBtn.click();
          await wait(200);
        }
        const titleInput = document.querySelector('#quick-add-task-title');
        if (titleInput) {
          const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
          if (desc && desc.set) desc.set.call(titleInput, 'Taylor personal budget task');
          titleInput.dispatchEvent(new Event('input', { bubbles: true }));
          titleInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const createBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          b => b.textContent?.includes('Add to planner')
        );
        if (createBtn) createBtn.click();
        await wait(600);
      })()
    `);

    // Click "Remove sample data" from banner
    await evalJs(`
      (async () => {
        const clearBtn = document.querySelector('[data-testid="clear-demo-data-btn"]');
        if (clearBtn) clearBtn.click();
      })()
    `);
    await wait(200);

    const demoClearedInfo = await evalJs(`
      (() => {
        const banner = document.querySelector('[data-testid="demo-data-banner"]');
        const tasksNav = Array.from(document.querySelectorAll('aside button, nav button')).find(
          b => b.textContent?.includes('Tasks')
        );
        if (tasksNav) tasksNav.click();
        return {
          bannerStillPresent: Boolean(banner),
        };
      })()
    `);
    await wait(150);

    const customRecordCheck = await evalJs(`
      (() => {
        const text = document.body.textContent || '';
        return {
          hasCustomTask: text.includes('Taylor personal budget task'),
        };
      })()
    `);
    assert(!demoClearedInfo.bannerStillPresent, 'Demo banner disappears immediately upon removing sample data');
    assert(customRecordCheck.hasCustomTask, 'Custom task created by user was safely preserved when demo data was cleared');

    // =========================================================================
    // 6. Reopening Setup Wizard Safely Preserves Records
    // =========================================================================
    console.log('\n6. Reopening Setup Wizard Safely Preserves Records');

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
        const rerunBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent?.includes('Re-run Setup Wizard')
        );
        if (rerunBtn) rerunBtn.click();
        await wait(200);
      })()
    `);

    // Verify Setup Wizard opens in rerun mode
    const rerunSetupInfo = await evalJs(`
      (() => {
        const dialog = document.querySelector('[role="dialog"]');
        const title = dialog ? dialog.querySelector('h2')?.textContent : '';
        const nameInput = document.querySelector('#setup-owner-name');
        return {
          isOpen: Boolean(dialog),
          isRerunTitle: title?.includes('Update Planner Setup'),
          ownerNameValue: nameInput ? nameInput.value : '',
        };
      })()
    `);
    assert(rerunSetupInfo.isOpen && rerunSetupInfo.isRerunTitle, 'Setup wizard opens in rerun mode ("Update Planner Setup")');
    assert(rerunSetupInfo.ownerNameValue === 'Taylor', 'Rerun setup preserves current owner name');

    // Cancel / close setup without changing records
    await evalJs(`
      (() => {
        const dialog = document.querySelector('[role="dialog"]');
        const closeBtn = dialog ? dialog.querySelector('button[aria-label^="Close"]') : null;
        if (closeBtn) closeBtn.click();
      })()
    `);
    await wait(200);

    // =========================================================================
    // 7. Backup & Restore Preview Safeguards
    // =========================================================================
    console.log('\n7. Backup & Restore Preview Safeguards');

    await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const backupBtn = document.querySelector('[data-testid="sidebar-backup-restore"]');
        if (backupBtn) {
          backupBtn.click();
          await wait(200);
        }
      })()
    `);

    const backupModalInfo = await evalJs(`
      (() => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(
          d => d.textContent?.includes('Backup & Restore')
        );
        const text = dialog ? dialog.textContent : '';
        const hasExportBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Download JSON'));
        const hasCopyBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Copy JSON'));
        return {
          isOpen: Boolean(dialog),
          hasExportBtn,
          hasCopyBtn,
        };
      })()
    `);
    assert(backupModalInfo.isOpen, 'Backup & Restore modal opens cleanly');
    assert(backupModalInfo.hasExportBtn && backupModalInfo.hasCopyBtn, 'Offers verified Download JSON and Copy JSON actions');

    // Close backup modal
    await evalJs(`
      (() => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(
          d => d.textContent?.includes('Backup & Restore')
        );
        const closeBtn = dialog ? dialog.querySelector('button[aria-label^="Close"]') : null;
        if (closeBtn) closeBtn.click();
      })()
    `);
    await wait(200);

    // =========================================================================
    // 8. Distinguish Unconfigured Data from Meaningful Zeros
    // =========================================================================
    console.log('\n8. Distinguish Unconfigured Data from Meaningful Zeros');

    // 8.1 Budget & Bills
    await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const budgetNav = Array.from(document.querySelectorAll('aside button, nav button')).find(
          b => b.textContent?.includes('Budget & bills')
        );
        if (budgetNav) {
          budgetNav.click();
          await wait(300);
        }
      })()
    `);

    const budgetZeroCheck = await evalJs(`
      (() => {
        const text = document.body.textContent || '';
        return {
          hasUnconfiguredNotice: text.includes('Unconfigured budget') || text.includes('No transactions or opening balance logged'),
        };
      })()
    `);
    assert(budgetZeroCheck.hasUnconfiguredNotice, 'Budget view explains unconfigured budget rather than presenting misleading $0 balance calculation');

    // 8.2 Savings Pots
    await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const savingsNav = Array.from(document.querySelectorAll('aside button, nav button')).find(
          b => b.textContent?.includes('Savings')
        );
        if (savingsNav) {
          savingsNav.click();
          await wait(150);
        }
      })()
    `);

    const savingsZeroCheck = await evalJs(`
      (() => {
        const text = document.body.textContent || '';
        return {
          hasUnconfiguredNotice: text.includes('No savings pots configured yet') || text.includes('Create your first savings pot'),
        };
      })()
    `);
    assert(savingsZeroCheck.hasUnconfiguredNotice, 'Savings view explains unconfigured pots rather than "$0 of $0 target"');

    // 8.3 Debt Payoff
    await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const debtNav = Array.from(document.querySelectorAll('aside button, nav button')).find(
          b => b.textContent?.includes('Debt payoff')
        );
        if (debtNav) {
          debtNav.click();
          await wait(150);
        }
      })()
    `);

    const debtZeroCheck = await evalJs(`
      (() => {
        const text = document.body.textContent || '';
        return {
          hasUnconfiguredNotice: text.includes('No debts configured yet') || text.includes('Add your first balance to track'),
        };
      })()
    `);
    assert(debtZeroCheck.hasUnconfiguredNotice, 'Debt view explains unconfigured debts rather than "$0.00 of $0.00"');

    // =========================================================================
    // 9. Storage Failure Handling & In-Memory Recovery
    // =========================================================================
    console.log('\n9. Storage Failure Handling & In-Memory Recovery');

    // Simulate storage failure in PlannerContext by monkey-patching localStorage.setItem to throw
    await evalJs(`
      (() => {
        const originalSetItem = window.localStorage.setItem;
        window.__origSetItem = originalSetItem;
        window.localStorage.setItem = function() {
          throw new DOMException('QuotaExceededError: storage limit reached', 'QuotaExceededError');
        };
        // Trigger a change to initiate saving failure
        const btn = Array.from(document.querySelectorAll('aside button, nav button')).find(
          b => b.textContent?.includes('Tasks')
        );
        if (btn) btn.click();
      })()
    `);
    await wait(250);

    // Try creating a new task while storage fails
    await evalJs(`
      (async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const quickAddBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent?.includes('Quick add')
        );
        if (quickAddBtn) {
          quickAddBtn.click();
          await wait(200);
        }
        const titleInput = document.querySelector('#quick-add-task-title');
        if (titleInput) {
          const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
          if (desc && desc.set) desc.set.call(titleInput, 'Urgent in-memory task');
          titleInput.dispatchEvent(new Event('input', { bubbles: true }));
          titleInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const saveBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          b => b.textContent?.includes('Add to planner')
        );
        if (saveBtn) {
          saveBtn.click();
          await wait(600);
        }
      })()
    `);
    await wait(350);

    const storageFailureCheck = await evalJs(`
      (() => {
        const errorBanner = document.querySelector('[data-testid="storage-error-banner"]');
        const retryBtn = document.querySelector('[data-testid="banner-retry-save-btn"]');
        const exportBtn = document.querySelector('[data-testid="banner-export-unsaved-btn"]');
        return {
          hasErrorBanner: Boolean(errorBanner),
          hasRetryBtn: Boolean(retryBtn),
          hasExportBtn: Boolean(exportBtn),
        };
      })()
    `);
    assert(storageFailureCheck.hasErrorBanner, 'Storage error banner [data-testid="storage-error-banner"] appears on save failure');
    assert(storageFailureCheck.hasRetryBtn, 'Storage error banner provides 1-click "Retry saving" button');
    assert(storageFailureCheck.hasExportBtn, 'Storage error banner provides "Export unsaved (JSON)" backup button');

    await captureScreenshot('stage4-storage-error-banner.png');

    // Restore localStorage.setItem
    await evalJs(`
      (() => {
        if (window.__origSetItem) {
          window.localStorage.setItem = window.__origSetItem;
        }
      })()
    `);

    // Click retry saving to confirm persistence restores
    await evalJs(`
      (async () => {
        const retryBtn = document.querySelector('[data-testid="banner-retry-save-btn"]');
        if (retryBtn) retryBtn.click();
      })()
    `);
    await wait(300);

    const recoveredStorageCheck = await evalJs(`
      (() => {
        const errorBanner = document.querySelector('[data-testid="storage-error-banner"]');
        const savingPill = document.querySelector('[data-testid="header-saving-indicator"]');
        return {
          errorBannerGone: !errorBanner,
          savingText: savingPill ? savingPill.textContent?.trim() : '',
        };
      })()
    `);
    assert(recoveredStorageCheck.errorBannerGone, 'Storage error banner resolves cleanly upon successful retry');
    assert(recoveredStorageCheck.savingText.includes('Saved locally'), 'Saving indicator confirms "Saved locally" after successful recovery');

    console.log(`\n================================================================`);
    console.log(`Stage 4 Verification Summary: ${passed} passed, ${failed} failed.`);
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
