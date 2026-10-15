import { execSync } from 'node:child_process';
import path from 'node:path';

interface TestSuite {
  name: string;
  command: string;
  category: string;
}

const suites: TestSuite[] = [
  // 1. Security & Performance Scaffolding
  { name: 'Secret & Credential Scan', command: 'node scripts/scan-secrets.mjs', category: 'Security' },
  { name: 'LP-19 Performance & Bundle Latency', command: 'npx tsx scripts/measure-performance.ts', category: 'Performance' },
  { name: 'Section 8 Complete Buyer Journey Rehearsal', command: 'npx tsx scripts/rehearse-buyer-journey.ts', category: 'End-to-End Rehearsal' },

  // 2. Original Core Test Suites (13 suites)
  { name: 'Recurrence Rules (Daily/Weekly/Monthly)', command: 'npx tsx scripts/test-recurrence.ts', category: 'Core Modules' },
  { name: 'Tab Sync & Coordination', command: 'npx tsx scripts/test-tab-sync-coordinator.ts', category: 'Core Modules' },
  { name: 'Budget & Bills Ledger', command: 'npx tsx scripts/test-budget-ledger.ts', category: 'Core Modules' },
  { name: 'Backup Validation & Schema Integrity', command: 'npx tsx scripts/test-backup-validation.ts', category: 'Core Modules' },
  { name: 'Dialog Accessibility & Focus Trap', command: 'npx tsx scripts/test-dialog-accessibility.ts', category: 'Core Modules' },
  { name: 'Support Delivery & Mailto Helper', command: 'npx tsx scripts/test-support-delivery.ts', category: 'Core Modules' },
  { name: 'Module Visibility & Customization', command: 'npx tsx scripts/test-module-visibility.ts', category: 'Core Modules' },
  { name: 'Calendar .ics Export', command: 'npx tsx scripts/test-ics-export.ts', category: 'Core Modules' },
  { name: 'Habit Streaks & Rest Days', command: 'npx tsx scripts/test-habit-streak.ts', category: 'Core Modules' },
  { name: 'PWA Service Worker & Offline Caching', command: 'npx tsx scripts/test-pwa-offline.ts', category: 'Core Modules' },
  { name: 'Standalone Offline HTML Edition', command: 'npx tsx scripts/test-offline-edition.ts', category: 'Core Modules' },
  { name: 'Grocery List Aggregation & Units', command: 'npx tsx scripts/test-grocery-aggregation.ts', category: 'Core Modules' },
  { name: 'Weekly Review Guided Workflow', command: 'npx tsx scripts/test-weekly-review.ts', category: 'Core Modules' },

  // 3. Audit Remediation Suites (Phases 1 - 4)
  { name: 'Phase 1: Core Reliability (LP-01 - LP-12)', command: 'npx tsx scripts/test-phase1-audit-remediation.ts', category: 'Remediation' },
  { name: 'Phase 2: Accessibility & Mobile (LP-13, LP-14)', command: 'npx tsx scripts/test-phase2-accessibility.ts', category: 'Remediation' },
  { name: 'Phase 3: Visual Polish & Clarity (LP-20)', command: 'npx tsx scripts/test-phase3-clarity.ts', category: 'Remediation' },
  { name: 'Stage 3: Refocus Today & Responsive Navigation', command: 'npx tsx scripts/verify-stage3-refocus.ts', category: 'Remediation' },
  { name: 'Stage 4: Buyer First Session & Saving Confidence', command: 'npx tsx scripts/verify-stage4-session-saving.ts', category: 'Remediation' },
  { name: 'Stage 5: Standardized Shared Interactions & Validation', command: 'npx tsx scripts/verify-stage5-interactions.ts', category: 'Remediation' },
  { name: 'Stage 6: Restrained Motion & Microinteractions', command: 'npx tsx scripts/verify-stage6-motion.ts', category: 'Remediation' },
  { name: 'Stage 7: Customer Readiness & Design Quality Validation', command: 'npx tsx scripts/verify-stage7-customer-readiness.ts', category: 'Remediation' },
  { name: 'Phase 4: Buyer Delivery & Packaging (LP-15 - LP-17)', command: 'npx tsx scripts/test-phase4-delivery.ts', category: 'Remediation' },

  // 4. Premium UI Upgrade Suites (Phases 01 - 09 & Independent Review Corrections)
  { name: 'Phase 01: Foundations & Shell Corrections', command: 'npx tsx scripts/test-phase01-corrections.ts', category: 'Premium Upgrade' },
  { name: 'Phase 03: Tasks Hierarchy & Working Board', command: 'npx tsx scripts/test-phase03-tasks-board.ts', category: 'Premium Upgrade' },
  { name: 'Phase 04: Insights & Useful Analytics', command: 'npx tsx scripts/test-phase04-insights.ts', category: 'Premium Upgrade' },
  { name: 'Phase 05: Contextual Capture & Details', command: 'npx tsx scripts/test-phase05-capture-and-details.ts', category: 'Premium Upgrade' },
  { name: 'Phase 06: Calendar Grid, Agenda & Sync', command: 'npx tsx scripts/test-phase06-calendar.ts', category: 'Premium Upgrade' },
  { name: 'Phase 07: Shared Focus Controller', command: 'npx tsx scripts/test-phase07-focus.ts', category: 'Premium Upgrade' },
  { name: 'Phase 08: Themes, Accents & Modules', command: 'npx tsx scripts/test-phase08-themes-and-modules.ts', category: 'Premium Upgrade' },
  { name: 'Phase 09: Polish, Motion & Responsive Matrix', command: 'npx tsx scripts/test-phase09-polish.ts', category: 'Premium Upgrade' },
  { name: 'Independent Review Corrections (R1–R8 Regressions)', command: 'npx tsx scripts/test-correction-pass-regressions.ts', category: 'Premium Upgrade' },

  // 5. Apple-Inspired Color System & Neutral Design
  { name: 'Apple-Inspired Color System & Neutral Surfaces', command: 'npx tsx scripts/test-apple-color-system.ts', category: 'Apple Color System' },
  { name: 'Review Findings F1–F4 Verification', command: 'npx tsx scripts/test-findings-f1-f4.ts', category: 'Apple Color System' },
];

console.log('================================================================');
console.log('OUR LIFE PLANNER — COMPREHENSIVE AUTOMATED VERIFICATION SUITE');
console.log(`Running ${suites.length} test suites...`);
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;
const results: { name: string; category: string; passed: boolean; durationMs: number }[] = [];

for (const suite of suites) {
  process.stdout.write(`• Running [${suite.category}] ${suite.name}... `);
  const t0 = Date.now();
  try {
    execSync(suite.command, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CI: 'true' },
    });
    const durationMs = Date.now() - t0;
    console.log(`PASS (${durationMs}ms)`);
    passedCount++;
    results.push({ name: suite.name, category: suite.category, passed: true, durationMs });
  } catch (err: any) {
    const durationMs = Date.now() - t0;
    console.log(`FAIL (${durationMs}ms)`);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    failedCount++;
    results.push({ name: suite.name, category: suite.category, passed: false, durationMs });
  }
}

console.log('\n================================================================');
console.log('VERIFICATION SUMMARY');
console.log('================================================================');
console.log(`Total Suites Executed: ${suites.length}`);
console.log(`Passed:                ${passedCount}`);
console.log(`Failed:                ${failedCount}`);
console.log('================================================================\n');

if (failedCount > 0) {
  console.error(`QUALITY GATE FAILED: ${failedCount} test suite(s) failed.`);
  process.exit(1);
} else {
  console.log('ALL VERIFICATION SUITES PASSED! RELEASE CANDIDATE QUALITY GATE MET.\n');
  process.exit(0);
}
