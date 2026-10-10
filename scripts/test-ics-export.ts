import fs from 'fs';
import path from 'path';
import http from 'http';
import { execFile } from 'child_process';
import {
  serializePlannerCalendarToIcs,
  validateIcsContent,
  unfoldIcsLines,
  escapeIcsText,
  foldIcsLine,
} from '../src/utils/icsSerializer';
import {
  INITIAL_SETTINGS,
  SAMPLE_CALENDAR_EVENTS,
  SAMPLE_TASKS,
} from '../src/utils/sampleData';
import { CalendarEvent, TaskItem } from '../src/types/planner';

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

interface BrowserIcsExportReport {
  capturedCount: number;
  capturedMimeType?: string;
  capturedIcsText?: string;
  downloadFilename?: string;
  error?: string;
}

async function runBrowserIcsExportTest(): Promise<BrowserIcsExportReport> {
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
  const capturedBlobs = [];
  let lastDownloadFilename = '';

  const origCreateObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(blob) {
    if (blob && blob.type && blob.type.includes('text/calendar')) {
      capturedBlobs.push(blob);
    }
    return origCreateObjectURL(blob);
  };

  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function() {
    if (this.getAttribute('download')) {
      lastDownloadFilename = this.getAttribute('download') || '';
    }
    return origClick.apply(this, arguments);
  };

  function setNativeValue(element, value) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor =
      Object.getOwnPropertyDescriptor(prototype, 'value') ||
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') ||
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function runTest() {
    const report = {
      capturedCount: 0,
    };

    try {
      await wait(400);

      // Navigate to Calendar view
      const navButtons = Array.from(document.querySelectorAll('aside button'));
      const calBtn = navButtons.find((b) => (b.textContent || '').includes('Calendar'));
      if (!calBtn) throw new Error('Calendar sidebar button not found');
      calBtn.click();
      await wait(300);

      // Click "Add entry" button
      const addEntryBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        (b.textContent || '').includes('Add entry')
      );
      if (!addEntryBtn) throw new Error('Add entry button not found');
      addEntryBtn.click();
      await wait(250);

      // Fill modal form to create a timed Task on 2026-10-09 from 09:00 to 10:00
      const typeSelect = document.getElementById('calendar-entry-type');
      const titleInput = document.getElementById('calendar-entry-title');
      const dateInput = document.getElementById('calendar-entry-date');
      const startTimeInput = document.getElementById('calendar-entry-start-time');
      const endTimeInput = document.getElementById('calendar-entry-end-time');

      if (!typeSelect || !titleInput || !dateInput || !startTimeInput || !endTimeInput) {
        throw new Error('Calendar entry modal inputs not found');
      }

      setNativeValue(typeSelect, 'task');
      await wait(50);
      setNativeValue(titleInput, 'Browser E2E Timed Task Oct 9');
      setNativeValue(dateInput, '2026-10-09');
      setNativeValue(startTimeInput, '09:00');
      setNativeValue(endTimeInput, '10:00');
      await wait(100);

      const saveBtn = Array.from(document.querySelectorAll('button[type="submit"]')).find((b) =>
        (b.textContent || '').includes('Save entry')
      );
      if (!saveBtn) throw new Error('Save entry button not found');
      saveBtn.click();
      await wait(300);

      // Click Export .ics button
      const exportBtn = document.querySelector('button[title="Export calendar to iCalendar (.ics)"]');
      if (!exportBtn) throw new Error('Export .ics button not found');
      exportBtn.click();
      await wait(300);

      report.capturedCount = capturedBlobs.length;
      report.downloadFilename = lastDownloadFilename;
      if (capturedBlobs.length > 0) {
        report.capturedMimeType = capturedBlobs[0].type;
        report.capturedIcsText = await capturedBlobs[0].text();
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

  return new Promise<BrowserIcsExportReport>((resolve, reject) => {
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
              const parsed = JSON.parse(body) as BrowserIcsExportReport;
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
        `.tmp-edge-ics-${Date.now()}`
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
  console.log('=== P2 iCalendar (.ics) RFC 5545 Serializer & Export Verification ===\n');

  const fixedNow = new Date('2026-10-05T12:00:00Z');

  // 1. Exact reproduction case: Task due October 9 at 09:00 + completed task
  console.log('1. Testing exact user reproduction case (Task due Oct 9 at 09:00 & Completed task)...');
  const reproTasks: TaskItem[] = [
    {
      id: 'oct9-timed',
      title: 'Morning dentist checkup',
      description: 'Bring insurance card; arrive 10 mins early, Wing B',
      category: 'Health',
      assignedTo: 'Rida',
      dueDate: '2026-10-09',
      dueTime: '09:00',
      priority: 'high',
      status: 'not_started',
      createdAt: '2026-10-01T08:00:00Z',
    },
    {
      id: 'oct9-completed',
      title: 'Submit quarterly tax estimate',
      category: 'Finance',
      assignedTo: 'Rida',
      dueDate: '2026-10-09',
      scheduledStart: '14:00',
      scheduledEnd: '15:30',
      priority: 'urgent',
      status: 'completed',
      createdAt: '2026-10-01T08:00:00Z',
      completedAt: '2026-10-09T15:20:00Z',
    },
  ];

  const reproIcs = serializePlannerCalendarToIcs({
    tasks: reproTasks,
    calendarEvents: [],
    timeZone: 'Europe/London',
    now: fixedNow,
  });

  const unfoldedRepro = unfoldIcsLines(reproIcs);
  assert(
    !reproIcs.includes('DTSTART;20261009T090000'),
    'Does NOT emit malformed DTSTART;20261009T090000 lacking property/value separator'
  );
  assert(
    unfoldedRepro.includes('DTSTART;TZID=Europe/London:20261009T090000'),
    'Emits standards-compliant DTSTART;TZID=Europe/London:20261009T090000 with colon separator'
  );
  assert(
    unfoldedRepro.includes('DUE;TZID=Europe/London:20261009T090000'),
    'Emits standards-compliant DUE;TZID=Europe/London:20261009T090000 for timed task due at 09:00'
  );
  assert(
    unfoldedRepro.includes('BEGIN:VTODO') && unfoldedRepro.includes('END:VTODO'),
    'Exports tasks as RFC 5545 VTODO components (distinguished from VEVENT)'
  );
  assert(
    !unfoldedRepro.includes('BEGIN:VEVENT'),
    'Task-only export does not wrap tasks in VEVENT components'
  );
  assert(
    unfoldedRepro.includes('DTSTART;TZID=Europe/London:20261009T140000') &&
      unfoldedRepro.includes('DURATION:PT1H30M'),
    'Scheduled task (14:00 to 15:30) preserves its 1h30m duration via DURATION:PT1H30M'
  );
  assert(
    unfoldedRepro.includes('STATUS:COMPLETED') &&
      unfoldedRepro.includes('PERCENT-COMPLETE:100') &&
      unfoldedRepro.includes('COMPLETED:20261009T152000Z'),
    'Completed task emits valid VTODO STATUS:COMPLETED, PERCENT-COMPLETE:100, and UTC COMPLETED timestamp'
  );

  const reproValidation = validateIcsContent(reproIcs);
  assert(
    reproValidation.valid,
    `RFC 5545 validator passes on reproduction output (errors: ${reproValidation.errors.join('; ') || 'none'})`
  );

  // 2. Testing CalendarEvent VEVENT export & duration preservation
  console.log('\n2. Testing CalendarEvent VEVENT export & duration preservation...');
  const sampleEvents: CalendarEvent[] = [
    {
      id: 'ev-timed-duration',
      title: 'Date Night Dinner',
      date: '2026-10-09',
      startTime: '18:00',
      endTime: '21:00',
      isAllDay: false,
      type: 'event',
      notes: 'Table reserved for 2 at 6pm',
    },
    {
      id: 'ev-all-day',
      title: "Mom's Birthday",
      date: '2026-10-12',
      isAllDay: true,
      type: 'birthday',
    },
    {
      id: 'ev-overnight',
      title: 'Late Night Deployment Window',
      date: '2026-10-15',
      startTime: '23:00',
      endTime: '01:30',
      isAllDay: false,
      type: 'free_time',
    },
  ];

  const eventsIcs = serializePlannerCalendarToIcs({
    tasks: [],
    calendarEvents: sampleEvents,
    timeZone: 'America/New_York',
    now: fixedNow,
  });
  const unfoldedEvents = unfoldIcsLines(eventsIcs);

  assert(
    unfoldedEvents.includes('DTSTART;TZID=America/New_York:20261009T180000') &&
      unfoldedEvents.includes('DTEND;TZID=America/New_York:20261009T210000'),
    'Timed event (18:00 to 21:00) preserves start and end time via DTSTART and DTEND'
  );
  assert(
    unfoldedEvents.includes('DTSTART;VALUE=DATE:20261012') &&
      unfoldedEvents.includes('DTEND;VALUE=DATE:20261013'),
    'All-day event on 2026-10-12 emits DTSTART;VALUE=DATE:20261012 and exclusive next-day DTEND;VALUE=DATE:20261013'
  );
  assert(
    unfoldedEvents.includes('DTSTART;TZID=America/New_York:20261015T230000') &&
      unfoldedEvents.includes('DTEND;TZID=America/New_York:20261016T013000'),
    'Overnight event (23:00 to 01:30) rolls DTEND date to next calendar day (20261016T013000)'
  );
  assert(
    unfoldedEvents.includes('STATUS:CONFIRMED') && !unfoldedEvents.includes('STATUS:COMPLETED'),
    'VEVENT components use STATUS:CONFIRMED and never STATUS:COMPLETED'
  );

  const eventsValidation = validateIcsContent(eventsIcs);
  assert(
    eventsValidation.valid,
    `RFC 5545 validator passes on VEVENT export (errors: ${eventsValidation.errors.join('; ') || 'none'})`
  );

  // 3. Testing Timezone Modes (IANA with DST, UTC, and Floating)
  console.log('\n3. Testing timezone behavior (IANA VTIMEZONE, UTC, and Floating)...');
  assert(
    unfoldedEvents.includes('BEGIN:VTIMEZONE') &&
      unfoldedEvents.includes('TZID:America/New_York') &&
      unfoldedEvents.includes('X-WR-TIMEZONE:America/New_York'),
    'IANA timezone (America/New_York) emits X-WR-TIMEZONE and matching VTIMEZONE component'
  );

  const utcIcs = serializePlannerCalendarToIcs({
    tasks: [reproTasks[0]],
    calendarEvents: [sampleEvents[0]],
    timeZone: 'UTC',
    now: fixedNow,
  });
  const unfoldedUtc = unfoldIcsLines(utcIcs);
  assert(
    unfoldedUtc.includes('DTSTART:20261009T090000Z') &&
      unfoldedUtc.includes('DTSTART:20261009T180000Z') &&
      unfoldedUtc.includes('DTEND:20261009T210000Z'),
    'UTC timezone formats timed properties with trailing Z and no TZID parameter'
  );
  assert(validateIcsContent(utcIcs).valid, 'UTC iCalendar output passes RFC 5545 validation');

  const floatingIcs = serializePlannerCalendarToIcs({
    tasks: [reproTasks[0]],
    calendarEvents: [sampleEvents[0]],
    timeZone: '',
    now: fixedNow,
  });
  const unfoldedFloating = unfoldIcsLines(floatingIcs);
  assert(
    unfoldedFloating.includes('DTSTART:20261009T090000') &&
      unfoldedFloating.includes('DTSTART:20261009T180000') &&
      unfoldedFloating.includes('DTEND:20261009T210000'),
    'Empty timezone emits floating local DATE-TIME with required colon (DTSTART:20261009T090000)'
  );
  assert(
    validateIcsContent(floatingIcs).valid,
    'Floating timezone iCalendar output passes RFC 5545 validation'
  );

  // 4. Testing Text Escaping & 75-octet Line Folding
  console.log('\n4. Testing RFC 5545 text escaping and 75-octet line folding...');
  const escaped = escapeIcsText('Review budget, bills; & taxes\\2026\nLine two\r\nLine three');
  assert(
    escaped === 'Review budget\\, bills\\; & taxes\\\\2026\\nLine two\\nLine three',
    'escapeIcsText properly escapes commas, semicolons, backslashes, and newlines'
  );

  const longText =
    'DESCRIPTION:This is a very long task description with Unicode characters (🎉🚀✨) and punctuation\\, semicolons\\; that exceeds seventy-five UTF-8 octets and must be folded cleanly.';
  const folded = foldIcsLine(longText);
  const physicalFoldedLines = folded.split('\r\n');
  const allUnder75 = physicalFoldedLines.every(
    (l) => new TextEncoder().encode(l).length <= 75
  );
  assert(
    physicalFoldedLines.length >= 3 && allUnder75,
    'foldIcsLine folds long UTF-8 lines so every physical line is <= 75 UTF-8 octets'
  );
  assert(
    unfoldIcsLines(`${folded}\r\n`)[0] === longText,
    'unfoldIcsLines lossless-restores folded UTF-8 lines back to original logical line'
  );

  // 5. Testing RFC 5545 Validator negative detection on broken legacy output
  console.log('\n5. Testing RFC 5545 validator catches legacy defects...');
  const brokenLegacyIcs = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Our Life Planner//EN',
    'BEGIN:VEVENT',
    'UID:task-t1@ourlifeplanner.app',
    'DTSTAMP:20261005T120000Z',
    'SUMMARY:Task due Oct 9 at 09:00',
    'DTSTART;20261009T090000',
    'STATUS:COMPLETED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const brokenCheck = validateIcsContent(brokenLegacyIcs);
  assert(!brokenCheck.valid, 'Validator rejects legacy broken iCalendar output');
  assert(
    brokenCheck.errors.some((e) => e.includes('DTSTART;20261009T090000')),
    'Validator specifically flags DTSTART;20261009T090000 missing colon separator'
  );
  assert(
    brokenCheck.errors.some((e) => e.includes('Invalid STATUS "COMPLETED" inside VEVENT')),
    'Validator specifically flags STATUS:COMPLETED inside VEVENT'
  );

  // 6. Full Sample Dataset Validation
  console.log('\n6. Testing full sample dataset export...');
  const fullSampleIcs = serializePlannerCalendarToIcs({
    tasks: SAMPLE_TASKS,
    calendarEvents: SAMPLE_CALENDAR_EVENTS,
    timeZone: INITIAL_SETTINGS.timeZone,
    now: fixedNow,
  });
  const fullSampleValidation = validateIcsContent(fullSampleIcs);
  assert(
    fullSampleValidation.valid,
    `Full sample data export passes RFC 5545 validation (errors: ${fullSampleValidation.errors.join('; ') || 'none'})`
  );

  // 7. Headless Browser E2E Verification
  console.log('\n7. Running headless browser E2E verification of Calendar .ics export...');
  const browserReport = await runBrowserIcsExportTest();
  if (browserReport.error) {
    console.error('  Browser test error:', browserReport.error);
  }
  assert(!browserReport.error, 'Headless browser Calendar export test ran without error');
  assert(
    browserReport.capturedCount === 1 &&
      Boolean(browserReport.capturedMimeType?.includes('text/calendar')),
    `Clicking Export .ics triggers a text/calendar Blob download (${browserReport.downloadFilename})`
  );

  if (browserReport.capturedIcsText) {
    const dlValidation = validateIcsContent(browserReport.capturedIcsText);
    assert(
      dlValidation.valid,
      `Browser-exported .ics passes RFC 5545 validation (errors: ${dlValidation.errors.join('; ') || 'none'})`
    );
    const unfoldedDl = unfoldIcsLines(browserReport.capturedIcsText);
    assert(
      unfoldedDl.includes('SUMMARY:Browser E2E Timed Task Oct 9') &&
        unfoldedDl.includes('DTSTART;TZID=Europe/London:20261009T090000') &&
        unfoldedDl.includes('DURATION:PT1H'),
      'Browser-exported .ics contains newly added Oct 9 09:00-10:00 task with valid DTSTART;TZID=Europe/London:20261009T090000 and DURATION:PT1H'
    );
  }

  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
