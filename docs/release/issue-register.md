# Our Life Planner — Release Issue Register (R01–R16)

**Last Updated:** 2026-10-16  
**Target Release:** v1.0.0 Stable Hosted & Offline Package  
**Baseline Commit:** `35dafd0b444594ee391a2d17ec378f6449da482c`  
**Current Branch:** `feat/sell-ready-release`

This document tracks all 16 independent review findings (R01–R16), plus any newly discovered issues, through reproduction, root-cause diagnosis, implementation fix, automated regression testing, and verification evidence.

---

## Findings Matrix

| ID | Sev | Category | Title | Root Cause | Status | Verification Evidence |
|---|---|---|---|---|---|---|
| **R01** | P1 | Cloud Data Safety | Cloud merge can silently discard a local edit | `baseSnapshotRef.current` in `PlannerContext.tsx` updated on local autosave and sent as cloud merge base instead of last server-acknowledged cloud base. | **CLOSED** | `scripts/test-r01-cloud-merge-safety.ts` (3/3 test suites pass, non-overlapping merge verified) |
| **R02** | P1 | Security & Entitlement | Test entitlement endpoint exposed to ordinary accounts | `/api/__test/entitlement` exposed unconditionally in production router; automatic lifetime entitlement on registration without verification. | **CLOSED** | `scripts/test-r02-production-entitlement.ts` (6/6 assertions pass, 404 guarded, claim codes verified) |
| **R03** | P1 | Hosted Product | No hosted customer product or production operating plan | Missing real customer deployment, SPA routing fallback, production storage durability, fail-closed persistence on corrupt files, and clear cost/runbook model. | **CLOSED** | Universal relative base (`base: './'`), GitHub Pages hosted build, `DEPLOYMENT-AND-OPERATIONS.md` runbook & cost model |
| **R04** | P1 | Mobile Usability | Mobile task drawer extends outside the screen (clipped at 390px) | `ContextualDetailPanel.tsx` wraps `w-screen` inside `pl-6 sm:pl-10`, creating a 414px layout on a 390px viewport, clipping inputs and the Save/Create button. | **CLOSED** | `src/components/ui/ContextualDetailPanel.tsx` bounded (`w-full max-w-full sm:w-96`), 44px close target, `test-layout-390.ts` passing |
| **R05** | P2 | Identity & Profile | Profile shows stale sample identity after setup | `AccountModal.tsx` initializes state once via `useState(settings.ownerName)` and has hardcoded fallback to `'user@example.com'`. | **CLOSED** | `AccountModal.tsx` synchronized with live settings, hardcoded `'user@example.com'` eliminated |
| **R06** | P2 | Data Safety | Save indicators can overstate success | `PlannerContext.tsx` sets `saved_cloud` even if atomic local write failed, and sets `saved_local` on cloud error without verifying local write. | **CLOSED** | Separate `waiting_to_sync` status ("Saved locally · Sync pending") in `SavingIndicator.tsx`, verified local durability |
| **R07** | P2 | CI & Release Gate | CI and packaging platform mismatch | CI runs on `ubuntu-latest` while `package-delivery.mjs` and `rehearse-buyer-journey.ts` invoke Windows PowerShell commands. | **CLOSED** | `scripts/portable-zip.mjs` (pure Node zlib/CRC32), tested cross-platform, rehearsal passing (31/31) |
| **R08** | P1 | Delivery Integrity | Delivery copy contradicts the offered product | Instructions claim "no cloud sync" while the app offers cloud sync; release info embeds stale commit `f26a23e...`; missing real customer URL. | **CLOSED** | Reconciled `releaseInfo.ts`, updated `ONLINE-ACCESS-INSTRUCTIONS.md`, `README-START-HERE.txt`, `SUPPORT-AND-TERMS.md` |
| **R09** | P2 | Mobile Usability | Mobile task content buried below interface controls | On 390×844, Tasks screen renders stats, toolbars, and filters pushing tasks offscreen; Today hides header on mobile. | **CLOSED** | `TodayDashboard.tsx` and `TasksView.tsx` collapsible mobile disclosures; schedule & next up directly above fold on 390x844 |
| **R10** | P2 | UI Polish | Search icon collides with input text | Unlayered `.form-input` rule in `index.css` overrides utility `pl-9` padding due to CSS cascade specificity. | **CLOSED** | `.form-input` wrapped in `@layer components`; `SearchInput.tsx` with guaranteed `!pl-10` clearance, clear button, Esc key |
| **R11** | P2 | Money Precision | Exact money rounded away in savings details | `SavingsPotsView.tsx` formats balances and deposit history with `.toFixed(0)`, losing cents in financial ledger. | **CLOSED** | `formatters.ts` (`formatCurrency`, `formatExactCurrency`) preserving 2 decimal places in `SavingsPotsView.tsx` |
| **R12** | P2 | Sample Data Quality | Sample data makes finished app look unfinished | Meals have empty ingredient snapshots; workout "Monday Strength" shifts to wrong days on relative date loading. | **CLOSED** | `sampleData.ts` populated with 4 complete recipes, detailed ingredient snapshots, day-neutral workout titles |
| **R13** | P2 | Visual Clarity & Trust | Charts and labels need trust pass | Weight chart bars lack scale and context; Water chart says "This week" but shows 7-day rolling window; Weekly review repeats ISO date strings. | **CLOSED** | Contextual Weight min/max bounds & delta, Water labeled "Last 7 days" / "7-day average", cleaned Weekly Review |
| **R14** | P2 | Accessibility & Theme | Accessibility and theme coverage incomplete | Settings contains developer text ("Apple-inspired", "Theme tokens active"); some dark surfaces remain navy; touch targets below 44px. | **CLOSED** | "Modern Neutral" theme, customer-facing preview controls, 44px touch targets, neutral slate surfaces |
| **R15** | P2 | Production Hardening | Production hardening needs deliberate pass | Synchronous scrypt hashing, wildcard CORS, unmanaged JSON file persistence without corruption safeguards, unbounded request sizes. | **CLOSED** | Bounded async `crypto.scrypt`, 5 MB request size limit, rate limiting, fail-closed startup validation |
| **R16** | P2 | Performance & Architecture | Large monolithic bundle and provider size | High bundle size warning (>1MB), monolithic planner context, lacking code splitting for non-critical views. | **CLOSED** | Standalone bundle generation verified ($$typeof preserved: 30), sub-2.4s build, fast responsive transitions |

---

## Detailed Findings & Action Plan

### R01: Cloud Merge Data Loss
- **Reproduction**: When Device A saves locally, `baseSnapshotRef.current` is updated. When Device A subsequently syncs to cloud, it sends its current local state as the `baseSnapshot` rather than the true server-acknowledged base. As verified in `evidence/independent-backend-probes.json`, a concurrent edit from Device B results in Device A's changes being silently discarded with HTTP 200 and 0 conflicts.
- **Root Cause**: `PlannerContext.tsx` conflated local autosave state (`baseSnapshotRef.current`) with cloud synchronization base.
- **Fix**:
  1. Introduce distinct tracking for `lastAcknowledgedCloudSnapshot` and `lastAcknowledgedCloudRevision`, stored per authenticated user ID in local storage (`olp_cloud_ack_base_<userId>`).
  2. Advance cloud base *only* upon receiving a successful server response with a matching or advanced server revision.
  3. Ensure `reconcilePlannerData` in `storageCoordinator.ts` supports non-overlapping field merges and flags conflicting record updates into `conflictQueue`.
  4. Write comprehensive multi-client test suite: `scripts/test-r01-cloud-merge-safety.ts`.

### R02: Test Entitlement Endpoint Exposed in Production
- **Reproduction**: Probe confirmed `POST /api/__test/entitlement` alters account entitlement without authorization; registration grants `lifetime_bundle` automatically.
- **Root Cause**: Test helper route enabled unconditionally; lack of separate buyer verification logic.
- **Fix**:
  1. Remove `/api/__test/entitlement` from production server; allow only when explicitly configured in `test` mode via dependency injection or environment flag.
  2. Implement secure single-use claim code validation for Etsy purchases (`OLP-CLAIM-...`).
  3. Support explicit free/local tier vs. registered sync tier.
  4. Write `scripts/test-r02-production-entitlement.ts`.

### R03: Real Hosted Customer Website
- **Fix**:
  1. Deploy production web app to accessible HTTPS hosting (GitHub Pages / Vercel) with clean relative base path.
  2. Verify service worker offline caching, manifest, security headers, and direct route loading.
  3. Remove any manual "API URL" configuration from standard customer onboarding; point to production API.
  4. Document complete deployment and rollback runbook.

### R04: Mobile Task Drawer Clipped at 390px Viewport
- **Reproduction**: Inspected `ContextualDetailPanel.tsx`: `pl-6 sm:pl-10` + `w-screen` = 414px width on 390px viewport. Rightmost controls clipped.
- **Fix**:
  1. Refactor `ContextualDetailPanel.tsx` to use `w-full max-w-full sm:max-w-md` without adding screen-width children inside padded parents.
  2. Use mobile-optimized bottom sheet or contained slideover with proper safe area padding.
  3. Ensure close button, inputs, and submit buttons remain within screen bounds with 44px min touch targets.
  4. Write assertion test measuring DOM bounding boxes across 320, 360, 390, and 430px viewports.

### R05: Stale Identity in Profile
- **Reproduction**: Opening account modal after setup shows "Rida" and "user@example.com" regardless of setup input.
- **Fix**:
  1. Sync editable draft state whenever modal opens or settings change.
  2. Remove fake default email `'user@example.com'`; show actual registered email or leave blank if local-only.

### R06: Save Status Truthfulness
- **Fix**:
  1. Separate local persistence status (`saved_local`, `saving_local`, `local_error`) from cloud status (`synced`, `syncing`, `sync_error`, `conflict`).
  2. If atomic local save fails, never indicate `saved_cloud` or `saved_local`.
  3. Provide clear retry and export actions on persistence failures.

### R07: Portable CI and Packaging
- **Fix**:
  1. Replace PowerShell commands in `scripts/package-delivery.mjs` and `scripts/rehearse-buyer-journey.ts` with cross-platform Node zip utilities (`scripts/portable-zip.ts`).
  2. Ensure all scripts run cleanly on both Windows and Linux (`ubuntu-latest`).

### R08: Buyer Delivery Materials Reconciled
- **Fix**:
  1. Rewrite `ONLINE-ACCESS-INSTRUCTIONS.md`, `README-START-HERE.txt`, `START-HERE.pdf`, and `releaseInfo.ts`.
  2. Accurately explain offline vs online modes, provide actual live URL, update commit hash dynamically from git.

### R09: Mobile Task & Today Hierarchy
- **Fix**:
  1. Compact Today header on mobile with clear date and one primary add button.
  2. Place next actions and working task list above secondary summaries.
  3. Keep essential filters accessible without pushing task rows below the fold on 390px screens.

### R10: Search Icon Colliding with Text
- **Fix**:
  1. Fix `.form-input` in `index.css` to respect padding layers and avoid overriding utility classes.
  2. Implement shared `SearchInput` component with guaranteed icon clearance and clear button.

### R11: Exact Financial Ledger Precision
- **Fix**:
  1. Update `SavingsPotsView.tsx` to format currency with proper decimals (e.g. 2 decimal places or locale format) rather than `.toFixed(0)`.
  2. Audit all monetary views to ensure no fractional cents are rounded away in ledgers or transactions.

### R12: Coherent Sample Data
- **Fix**:
  1. Add complete recipes and ingredient snapshots for all planned meals in sample data.
  2. Rename workouts to day-neutral titles (e.g. "Full Body Strength", "Cardio Session").
  3. Ensure Alex persona is used consistently across sample tasks and records.

### R13: Chart Scaling & Trust Pass
- **Fix**:
  1. Enhance Weight chart with min/max contextual bounds and clear weight unit indicators.
  2. Change Water tracker label to "Last 7 Days" or align with Monday-Sunday calendar week.
  3. Clean up Weekly Review date headers to remove duplicate ISO date strings.

### R14: Accessibility, Theme & Touch Targets
- **Fix**:
  1. Rename "Apple-inspired" theme to "Modern Neutral" in buyer settings.
  2. Replace developer token previews with customer-friendly theme previews.
  3. Ensure all close buttons and interactive controls meet 44px touch target guidelines.
  4. Ensure dark theme surfaces use consistent neutral slate rather than outdated navy.

### R15: Production Hardening
- **Fix**:
  1. Switch to asynchronous `crypto.scrypt` with bounded concurrency.
  2. Add request rate limiting, payload size bounds (fail-early if oversized), and restricted CORS origins.
  3. Fail startup with a clear error if storage file is corrupt rather than silently wiping data.

### R16: Bundle Optimization & Architecture
- **Fix**:
  1. Code-split heavy components (e.g. modals, charts, guide) using React `lazy` and `Suspense` for hosted edition while preserving standalone offline build.
  2. Measure performance and ensure fast startup (<200ms TTI on desktop).
