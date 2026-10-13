import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const htmlPath = path.resolve('dist/Our-Life-Planner-Offline.html');
  const port = 9556;
  const userDataDir = path.resolve('.tmp-cdp-measure');
  const proc = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    `file:///${htmlPath.replace(/\\/g, '/')}`,
  ]);

  await new Promise((r) => setTimeout(r, 1200));

  http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
    let d = '';
    res.on('data', (c) => (d += c));
    res.on('end', async () => {
      try {
        const targets = JSON.parse(d);
        const wsUrl = targets[0].webSocketDebuggerUrl;
        const ws = new WebSocket(wsUrl);

        ws.onopen = async () => {
          let reqId = 1;
          const send = (m: string, p: any = {}) =>
            new Promise<any>((resolve) => {
              const id = reqId++;
              const h = (e: any) => {
                const msg = JSON.parse(e.data);
                if (msg.id === id) {
                  ws.removeEventListener('message', h);
                  resolve(msg.result);
                }
              };
              ws.addEventListener('message', h);
              ws.send(JSON.stringify({ id, method: m, params: p }));
            });

          await send('Page.enable');
          await send('Runtime.enable');
          await send('DOM.enable');
          await new Promise((r) => setTimeout(r, 1000));

          await send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 1,
            mobile: true,
          });

          // Dismiss setup dialog if open
          await send('Runtime.evaluate', {
            expression: `
              (() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const closeSetup = btns.find(b => (b.getAttribute('aria-label') || '').includes('Close'));
                if (closeSetup) closeSetup.click();
              })()
            `,
          });
          await new Promise((r) => setTimeout(r, 300));

          // Load Demo data via Settings
          await send('Runtime.evaluate', {
            expression: `
              (() => {
                const openMenu = document.querySelector('button[aria-label="Open menu"]');
                if (openMenu) openMenu.click();
              })()
            `,
          });
          await new Promise((r) => setTimeout(r, 200));

          await send('Runtime.evaluate', {
            expression: `
              (() => {
                const allBtns = Array.from(document.querySelectorAll('#all-tools-menu button'));
                const match = allBtns.find(b => (b.textContent || '').includes('Settings'));
                if (match) match.click();
              })()
            `,
          });
          await new Promise((r) => setTimeout(r, 300));

          await send('Runtime.evaluate', {
            expression: `
              (() => {
                const reloadBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Reload Demo'));
                if (reloadBtn) reloadBtn.click();
              })()
            `,
          });
          await new Promise((r) => setTimeout(r, 200));

          await send('Runtime.evaluate', {
            expression: `
              (() => {
                const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Confirm & Load Demo Data'));
                if (confirmBtn) confirmBtn.click();
              })()
            `,
          });
          await new Promise((r) => setTimeout(r, 400));

          // Navigate back to Today
          await send('Runtime.evaluate', {
            expression: `
              (() => {
                const todayNav = document.querySelector('[data-testid="mobile-nav-today"]');
                if (todayNav) todayNav.click();
              })()
            `,
          });
          await new Promise((r) => setTimeout(r, 400));

          const result = await send('Runtime.evaluate', {
            expression: `
              (() => {
                const nextUp = document.querySelector('.card-surface.border-l-4');
                const emptyCta = document.querySelector('[data-testid="today-empty-cta"]');
                const weekStrip = document.querySelector('.card-surface');
                const header = document.querySelector('header');
                const mobileNav = document.querySelector('nav[aria-label="Mobile navigation"]');

                return {
                  viewportHeight: window.innerHeight,
                  headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
                  mobileNavTop: mobileNav ? Math.round(mobileNav.getBoundingClientRect().top) : 0,
                  weekStripRect: weekStrip ? {
                    top: Math.round(weekStrip.getBoundingClientRect().top),
                    bottom: Math.round(weekStrip.getBoundingClientRect().bottom),
                    height: Math.round(weekStrip.getBoundingClientRect().height),
                  } : null,
                  nextUpRect: nextUp ? {
                    top: Math.round(nextUp.getBoundingClientRect().top),
                    bottom: Math.round(nextUp.getBoundingClientRect().bottom),
                    height: Math.round(nextUp.getBoundingClientRect().height),
                  } : null,
                  nextUpBtnRect: nextUp && nextUp.querySelector('button') ? {
                    top: Math.round(nextUp.querySelector('button').getBoundingClientRect().top),
                    bottom: Math.round(nextUp.querySelector('button').getBoundingClientRect().bottom),
                  } : null,
                  emptyCtaRect: emptyCta ? {
                    top: Math.round(emptyCta.getBoundingClientRect().top),
                    bottom: Math.round(emptyCta.getBoundingClientRect().bottom),
                  } : null,
                };
              })()
            `,
            returnByValue: true,
          });

          console.log('MEASUREMENT RESULT:', JSON.stringify(result?.result?.value, null, 2));

          ws.close();
          proc.kill();
          process.exit(0);
        };
      } catch (err) {
        console.error(err);
        proc.kill();
        process.exit(1);
      }
    });
  });
}

main();
