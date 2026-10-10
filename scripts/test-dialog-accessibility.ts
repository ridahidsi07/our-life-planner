import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

function walkTsxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
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
  console.log('=== Dialog Focus Lifecycle & Form Accessibility Verification ===\n');

  // 1. Static Source Verification: Dialog Focus Management & Hook Usage
  console.log('1. Shared & Custom Dialog Focus Management Architecture');
  {
    const modalPath = path.resolve(srcDir, 'components/ui/Modal.tsx');
    const modalContent = fs.readFileSync(modalPath, 'utf-8');

    assert(
      modalContent.includes('export function useDialogAccessibility'),
      'Modal.tsx exports shared useDialogAccessibility hook'
    );
    assert(
      modalContent.includes('onCloseRef.current = onClose'),
      'useDialogAccessibility stores onClose in a ref so inline callbacks do not re-trigger focus effect'
    );
    assert(
      modalContent.includes('}, [isOpen, initialFocusRef]);') &&
        !modalContent.includes('[isOpen, onClose]'),
      'Dialog focus effect depends only on [isOpen, initialFocusRef] and never on onClose'
    );

    const dialogFiles = [
      'components/ui/Modal.tsx',
      'components/modals/WeeklyReviewModal.tsx',
      'components/modals/FocusModal.tsx',
      'components/modals/PwaInstallModal.tsx',
      'components/layout/MoreSheet.tsx',
    ];

    for (const rel of dialogFiles) {
      const content = fs.readFileSync(path.resolve(srcDir, rel), 'utf-8');
      assert(
        content.includes('useDialogAccessibility('),
        `${rel} uses useDialogAccessibility for focus placement, focus trapping, Escape handling, and focus restoration`
      );
    }
  }

  // 2. Static Source Verification: Programmatic Label Association Across All Views & Modals
  console.log('\n2. Programmatic <label> to Control Association Across Entire Codebase');
  {
    const tsxFiles = walkTsxFiles(srcDir);
    let totalLabels = 0;
    const unassociatedLabels: string[] = [];
    const brokenHtmlForLinks: string[] = [];

    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const rel = path.relative(rootDir, file);
      const labelRegex = /<label\b([^>]*)>([\s\S]*?)<\/label>/g;
      let match: RegExpExecArray | null;

      while ((match = labelRegex.exec(content)) !== null) {
        totalLabels++;
        const attrs = match[1];
        const inner = match[2];
        const line = content.slice(0, match.index).split('\n').length;

        const wrapsControl = /<(input|select|textarea)\b/.test(inner);
        const htmlForMatch =
          attrs.match(/htmlFor=["']([^"']+)["']/) || attrs.match(/htmlFor=\{`([^`]+)`\}/);

        if (!wrapsControl && !htmlForMatch) {
          unassociatedLabels.push(`${rel}:${line}`);
        } else if (htmlForMatch) {
          const targetId = htmlForMatch[1];
          const isTemplate = attrs.includes('htmlFor={`');
          const expectedAttr = isTemplate ? `id={\`${targetId}\`}` : `id="${targetId}"`;
          if (!content.includes(expectedAttr)) {
            brokenHtmlForLinks.push(`${rel}:${line} (htmlFor=${targetId})`);
          }
        }
      }
    }

    assert(totalLabels >= 80, `Scanned ${totalLabels} <label> elements across ${tsxFiles.length} .tsx files`);
    assert(
      unassociatedLabels.length === 0,
      'Every <label> across the codebase either wraps a control or has an explicit htmlFor attribute',
      unassociatedLabels.join(', ')
    );
    assert(
      brokenHtmlForLinks.length === 0,
      'Every <label htmlFor="..."> matches a corresponding control id="..." in the same component',
      brokenHtmlForLinks.join(', ')
    );
  }

  // 3. Real Headless Browser DOM & Focus Verification
  console.log('\n3. Headless Browser Runtime Verification (Task Editor & Weekly Review)');
  {
    const browserExe = findBrowserExecutable();
    if (!browserExe) {
      console.log('  SKIP: No local Chrome/Edge executable found');
    } else {
      const distOfflinePath = path.resolve(distDir, 'Our-Life-Planner-Offline.html');
      assert(fs.existsSync(distOfflinePath), 'dist/Our-Life-Planner-Offline.html exists for browser testing');

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

async function runA11yTests() {
  const report = {
    taskModalInitialFocusId: null,
    taskModalLabelsCount: 0,
    taskModalAllLabelsAssociated: false,
    taskModalUnassociatedLabels: [],
    descriptionFocusPreservedOnTyping: false,
    descriptionActiveIdsDuringTyping: [],
    descriptionFinalValue: '',
    taskModalFocusRestoredToTrigger: false,
    weeklyReviewInitialFocusInsideDialog: false,
    weeklyReviewInitialActiveTag: null,
    weeklyReviewReflectionLabelAssociated: false,
    weeklyReviewReflectionTypingPreservedFocus: false,
    weeklyReviewStep2FocusInsideDialog: false,
    weeklyReviewStep3FocusInsideDialog: false,
    weeklyReviewStep4FocusInsideDialog: false,
    weeklyReviewIntentionLabelsAssociatedCount: 0,
    weeklyReviewIntentionTypingPreservedFocus: false,
    weeklyReviewFocusRestoredToTrigger: false,
    error: null,
  };

  try {
    await wait(150);

    // Navigate to Tasks view
    const navButtons = Array.from(document.querySelectorAll('button'));
    const tasksNavBtn = navButtons.find((b) => b.textContent && b.textContent.trim() === 'Tasks');
    if (!tasksNavBtn) throw new Error('Tasks nav button not found');
    tasksNavBtn.click();
    await wait(100);

    // Find and focus "+ New task" button in TasksView
    const allButtons = Array.from(document.querySelectorAll('button'));
    const newTaskBtn = allButtons.find(
      (b) => b.textContent && b.textContent.replace(/\\s+/g, ' ').trim() === 'New task' && !b.hasAttribute('aria-label')
    ) || allButtons.find((b) => b.textContent && b.textContent.includes('New task'));
    if (!newTaskBtn) throw new Error('New task button not found');

    newTaskBtn.focus();
    newTaskBtn.click();
    await wait(100);

    const taskDialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!taskDialog) throw new Error('Task modal dialog did not open');

    report.taskModalInitialFocusId = document.activeElement ? document.activeElement.id : null;

    // Verify all labels inside Task modal are programmatically associated with controls
    const labels = Array.from(taskDialog.querySelectorAll('label'));
    report.taskModalLabelsCount = labels.length;
    const unassociated = [];
    for (const lbl of labels) {
      if (!lbl.control) {
        unassociated.push(lbl.textContent?.trim() || 'unnamed');
      }
    }
    report.taskModalUnassociatedLabels = unassociated;
    report.taskModalAllLabelsAssociated = labels.length >= 8 && unassociated.length === 0;

    // Focus Description textarea and type multiple times across re-renders
    const descTextarea = taskDialog.querySelector('#task-modal-description');
    if (!descTextarea) throw new Error('#task-modal-description not found');
    descTextarea.focus();
    await wait(30);

    const keystrokes = [
      'A',
      'Ac',
      'Acc',
      'Acce',
      'Acces',
      'Access',
      'Accessible task description without focus jump!',
    ];
    for (const text of keystrokes) {
      setNativeValue(descTextarea, text);
      await wait(70); // Exceeds the 50ms timer to prove no focus timer or effect steals focus
      report.descriptionActiveIdsDuringTyping.push(
        document.activeElement ? document.activeElement.id : 'null'
      );
    }
    report.descriptionFinalValue = descTextarea.value;
    report.descriptionFocusPreservedOnTyping =
      report.descriptionActiveIdsDuringTyping.length === keystrokes.length &&
      report.descriptionActiveIdsDuringTyping.every((id) => id === 'task-modal-description');

    // Press Escape to close Task modal and verify focus returns to newTaskBtn
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(100);
    report.taskModalFocusRestoredToTrigger = document.activeElement === newTaskBtn;

    // Navigate back to Today view to test Weekly Review Modal
    const todayNavBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent && b.textContent.trim() === 'Today'
    );
    if (!todayNavBtn) throw new Error('Today nav button not found');
    todayNavBtn.click();
    await wait(100);

    // Now test Weekly Review Modal
    const weeklyBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent && b.textContent.includes('Weekly Review')
    );
    if (!weeklyBtn) throw new Error('Weekly Review trigger button not found');

    weeklyBtn.focus();
    weeklyBtn.click();
    await wait(100);

    const weeklyDialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!weeklyDialog) throw new Error('Weekly Review dialog did not open');

    report.weeklyReviewInitialFocusInsideDialog =
      weeklyDialog.contains(document.activeElement) && document.activeElement !== weeklyBtn;
    report.weeklyReviewInitialActiveTag = document.activeElement ? document.activeElement.tagName : null;

    // Step 1: Personal Reflections & Wins
    const reflectionLabel = weeklyDialog.querySelector('label[for="weekly-review-reflection"]');
    const reflectionInput = weeklyDialog.querySelector('#weekly-review-reflection');
    report.weeklyReviewReflectionLabelAssociated =
      Boolean(reflectionLabel && reflectionInput && reflectionLabel.control === reflectionInput);

    if (reflectionInput) {
      reflectionInput.focus();
      setNativeValue(reflectionInput, 'Reflecting on a great week');
      await wait(70);
      setNativeValue(reflectionInput, 'Reflecting on a great week with stable focus');
      await wait(70);
      report.weeklyReviewReflectionTypingPreservedFocus =
        document.activeElement === reflectionInput;
    }

    // Advance to Step 2
    const findNextBtn = () =>
      Array.from(weeklyDialog.querySelectorAll('button')).find(
        (b) => b.textContent && b.textContent.includes('Next Step')
      );

    const nextTo2 = findNextBtn();
    if (!nextTo2) throw new Error('Next Step button (1->2) not found');
    nextTo2.click();
    await wait(80);
    report.weeklyReviewStep2FocusInsideDialog = weeklyDialog.contains(document.activeElement);

    // Advance to Step 3
    const nextTo3 = findNextBtn();
    if (!nextTo3) throw new Error('Next Step button (2->3) not found');
    nextTo3.click();
    await wait(80);
    report.weeklyReviewStep3FocusInsideDialog = weeklyDialog.contains(document.activeElement);

    // Advance to Step 4 (Top 3 Intentions)
    const nextTo4 = findNextBtn();
    if (!nextTo4) throw new Error('Next Step button (3->4) not found');
    nextTo4.click();
    await wait(80);
    report.weeklyReviewStep4FocusInsideDialog = weeklyDialog.contains(document.activeElement);

    const intentionLabels = Array.from(weeklyDialog.querySelectorAll('label'));
    report.weeklyReviewIntentionLabelsAssociatedCount = intentionLabels.filter(
      (l) => l.control && l.control.id.startsWith('weekly-review-intention-')
    ).length;

    const intention1 = weeklyDialog.querySelector('#weekly-review-intention-1');
    if (intention1) {
      intention1.focus();
      setNativeValue(intention1, 'Ship accessible dialogs');
      await wait(70);
      setNativeValue(intention1, 'Ship accessible dialogs and labels');
      await wait(70);
      report.weeklyReviewIntentionTypingPreservedFocus = document.activeElement === intention1;
    }

    // Close Weekly Review via Escape and check focus restoration to weeklyBtn
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(100);
    report.weeklyReviewFocusRestoredToTrigger = document.activeElement === weeklyBtn;
  } catch (err) {
    report.error = err && err.message ? err.message : String(err);
  }

  await fetch('/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  });
}

runA11yTests();
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
            } catch (e) {
              receivedReport = { error: 'Invalid JSON report' };
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

        assert(receivedReport !== null, 'Headless browser executed accessibility test script and posted report');

        if (receivedReport) {
          const report = receivedReport;
          assert(report.error === null, 'Browser accessibility script ran without runtime errors', report.error);
          assert(
            report.taskModalInitialFocusId === 'task-modal-title',
            `Opening Task Editor places initial focus on #task-modal-title (got ${report.taskModalInitialFocusId})`
          );
          assert(
            report.taskModalAllLabelsAssociated,
            `All ${report.taskModalLabelsCount} visible labels in Task Editor are programmatically associated with their controls via label.control`,
            report.taskModalUnassociatedLabels?.join(', ')
          );
          assert(
            report.descriptionFocusPreservedOnTyping,
            `Typing in Task Editor Description (#task-modal-description) preserves focus across all ${report.descriptionActiveIdsDuringTyping?.length} re-renders without jumping back to Title`,
            `Active IDs: ${JSON.stringify(report.descriptionActiveIdsDuringTyping)}`
          );
          assert(
            report.taskModalFocusRestoredToTrigger,
            'Closing Task Editor restores focus to the trigger button that opened it'
          );
          assert(
            report.weeklyReviewInitialFocusInsideDialog,
            'Opening Weekly Review moves focus inside the dialog rather than leaving focus on the background trigger'
          );
          assert(
            report.weeklyReviewReflectionLabelAssociated,
            'Weekly Review reflection label is programmatically associated with #weekly-review-reflection'
          );
          assert(
            report.weeklyReviewReflectionTypingPreservedFocus,
            'Typing in Weekly Review reflection textarea preserves focus across re-renders'
          );
          assert(
            report.weeklyReviewStep2FocusInsideDialog &&
              report.weeklyReviewStep3FocusInsideDialog &&
              report.weeklyReviewStep4FocusInsideDialog,
            'Advancing Weekly Review across Steps 2, 3, and 4 keeps focus inside the dialog'
          );
          assert(
            report.weeklyReviewIntentionLabelsAssociatedCount === 3,
            `All 3 Weekly Review intention labels are programmatically associated with their inputs (got ${report.weeklyReviewIntentionLabelsAssociatedCount})`
          );
          assert(
            report.weeklyReviewIntentionTypingPreservedFocus,
            'Typing in Weekly Review intention input preserves focus across re-renders'
          );
          assert(
            report.weeklyReviewFocusRestoredToTrigger,
            'Closing Weekly Review restores focus to the Weekly Review trigger button'
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
