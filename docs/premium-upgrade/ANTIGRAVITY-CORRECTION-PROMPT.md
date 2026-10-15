# Antigravity — premium UI correction pass

Continue work on Our Life Planner in the existing premium-ui-upgrade branch. This is a correction and verification pass on commit 8dc53a486048930c9f14d3ce11fb1f43b68d3125, not a new redesign.

Read these repository files first:

- docs/premium-upgrade/INDEPENDENT-REVIEW-8dc53a4.md
- docs/premium-upgrade/MASTER-BRIEF.md
- docs/premium-upgrade/ACCEPTANCE.md
- docs/premium-upgrade/STATUS.md
- docs/premium-upgrade/FINAL-REPORT.md
- The existing phase prompts relevant to the work.
- The evidence in artifacts/premium-ui/independent-review-8dc53a4/.

The independent review found eight actionable gaps even though the existing 25 verification suites and eight separate upgrade suites pass. Reproduce the findings, correct the behavior, and add meaningful regression checks. Do not dismiss a reproduced defect because the old test passes. Preserve the original 33 acceptance IDs and requirement wording.

## Working rules

1. Inspect the current branch and changes before editing. Preserve unrelated work. If the branch has advanced since the reviewed commit, evaluate what is already fixed and report the actual final SHA.
2. Keep the current visual direction and existing functionality. Preserve storage compatibility, record IDs, module preferences, recurrence, financial calculations, backup/restore, local-first operation, PWA behavior and single-file offline delivery.
3. Do not fabricate completion history, silently re-date saved records, add fake chart values, remove tests to obtain a green result, or hide broken controls using overflow clipping.
4. Use disposable data for browser verification. Do not overwrite the user's real planner records.
5. Keep fixes focused. Do not add unrelated features, rewrite the whole app or add dependencies without a demonstrated need.
6. Work through the corrections autonomously, using the original brief for routine decisions. Report genuine blockers and precise unverified checks; do not substitute unsupported completion claims.
7. Do not merge to main, deploy or publish a release as part of this pass.

## R1 — Make completion analytics truthful

Correct src/utils/insightsMetrics.ts and the affected chart/metric UI.

- Never infer a legacy completion date from dueDate or createdAt.
- Use valid recorded completedAt timestamps for dated throughput and on-time calculations.
- Interpret timestamps in the planner's selected timezone using existing date utilities where possible.
- Preserve records with unknown history, exclude them from dated historical series, and show a concise, understandable disclosure.
- An on-time metric with no eligible completions must be unavailable, not 100%. Handle current and comparison periods, displayed deltas and accessible descriptions consistently.
- Keep current-state counts separate from dated historical measures and label their scopes clearly.
- Preserve the existing completion/reopening semantics; do not invent a historical event log unless the existing contract requires it.

Add behavior tests for: missing and invalid timestamps, UTC/local-midnight boundaries, zero eligible records, a task without a due date, reopening/completing a task, and 7/30/90-day ranges.

Reference failing fixture: a completed task with no completedAt, created on 1 September and due 14 October was counted as completed on 14 October and on time. Another timestamp, 2026-10-13T23:30:00Z, was assigned 13 October rather than 14 October in Africa/Casablanca. An empty period returned 100%.

## R2 — Count every custom-category record

Correct category aggregation so each eligible task is counted exactly once. Three tasks in Custom currently produce count 1 and 33%; they must produce count 3 and 100% when they are the whole eligible collection.

Cover repeated custom categories, mixed standard/custom categories, missing categories, archived tasks and percentage rounding. Preserve compatible imported string categories rather than deleting or coercing those records.

## R3 — Preserve and disclose task scope across views

Make List, Board and Insights respect the same relevant active category, assignee, search and priority filters. Keep filter state discoverable in Insights, with a clear/reset action. Align accessible status text with the displayed collection.

Reproduce: Career gives 3 tasks and 1 completed in the filtered sample; opening Insights currently displays all 12 tasks and 3 completions without explaining the change.

Date-window throughput and all-open backlog may legitimately have different scopes, but label them clearly. Do not silently discard filters to simplify the calculation.

Test switches between all three views, individual and combined filters, and changes after capture, completion, reopening, editing and deletion. Ensure focus and scroll remain useful.

## R4 — Unify calendar items and counts

Use a shared, consistent source of eligible day items for month previews, overflow counts, accessible cell names, selected-day agenda and Coming Up.

- Include existing Meals and Goals in month previews.
- Include eligible Meals, Goals and Routines in upcoming items.
- Apply enabled modules, active filters and recurrence consistently.
- Count actual items, not the number of event types represented.
- Preserve intentional distinctions, such as excluding completed actions from Coming Up, and make them explicit.
- Use “Tomorrow” only for the actual next day relative to the planner's current date.
- Define whether Coming Up is relative to today or selected date and label it accordingly.
- Keep sorting, any item cap and overflow disclosure truthful.
- Retain current navigation, week-start preference, editing flows and .ics export.

Reproduce the Meals-only screenshot: agenda shows meals today and the following day, while the grid is blank and Coming Up says no upcoming items.

Tests must include every existing calendar item type, multiple same-type items on one day, filter toggles, disabled modules, recurring occurrences, completed/archived state as applicable, month/year transitions, future selections and accessible counts. Avoid creating duplicate occurrences or new unrelated calendar features.

## R5 — Finish role-based accent coverage

Use the existing shared accent/chart tokens across Today, Tasks, Insights, Calendar, Quick Add, Focus, Settings, optional modules and dialogs.

Inspect primary buttons, selected controls, focus rings, links, progress treatments and current-series charts. Plum currently updates the shell while many of these remain teal; Budget Add transaction and the throughput chart are clear examples.

Keep semantic status/category/danger/warning/success colors meaningful. The navy featured card may remain navy. Do not replace every teal value indiscriminately.

Create a concrete module/dialog inventory with the checked surface and result. Check Teal, Ocean, Plum and Ember in light and dark, persistence across refresh, legacy fallback, and theme settings after a populated backup round-trip. Measure important text/control/focus contrast pairings.

## R6 — Repair 320 px and zoom layouts

At 320 px, the Tasks toolbar clips the List and New task controls. Quick Add's six-column category row overlaps Expense/Workout labels.

- Allow toolbar groups to wrap or stack while maintaining clear hierarchy.
- Use a readable category arrangement, such as three columns by two rows at narrow sizes.
- Keep labels, hit targets and focus indicators fully usable.
- Check important element bounds and clipping ancestors, not only document scrollWidth.
- Exercise List, Board, Insights and relevant dialogs at 320 and 390 px, tablet, desktop, and 200% browser zoom.
- Include long titles/profile names and keyboard use.

Add regression assertions that would fail on the current clipped/overlapping controls. Capture corrected screenshots at matching dimensions.

## R7 — Keep compact Focus available in Core Starter

TodayDashboard currently omits isFocusVisible from hasRightWidgets. When all optional right-column widgets are disabled, their parent also removes the compact Focus card.

Include Focus in the layout condition or place it independently. Respect the intended calm-mode behavior. Avoid blank columns and do not reset, duplicate or fork the shared timer when changing module presets.

Verify Core Starter, all-tools and calm-mode configurations. Start, pause, resume and reset from compact/modal controls; navigate and reload; use a real second tab. Check break transition and stale associated-task behavior. Report exactly which background/concurrency cases were exercised.

## R8 — Repair the gate and completion evidence

Register all eight premium upgrade scripts in the standard verification path, alongside the existing suites. Add the new behavioral regressions above to that same gate. Do not weaken baseline assertions.

Update ACCEPTANCE.md, STATUS.md and FINAL-REPORT.md using the ORIGINAL 33 IDs and wording. For each original row, record:

- Implemented behavior.
- Behavioral tests actually executed and their result.
- Visually inspected screen/state, viewport/theme/configuration and screenshot path.
- Any limits or remaining unverified cases.

The old final report says 100%, but 16 original checklist rows remain Pending and the report replaces them with a different 33-item matrix. Reconcile the original contract; do not relabel incomplete requirements to manufacture completion.

A clickable navigation target is not a verified module workflow. A root-level overflow check is not proof that controls are unclipped. Empty-array backup fixtures are not proof that populated records round-trip. A file opening without syntax errors is not a full offline workflow. Keep these distinctions explicit.

## Verification and final handoff

1. Run type checks and the complete standard verification command, including all newly registered suites. Use the package manager and scripts already in this repository.
2. Build and inspect the production preview. Check browser console errors in the exercised flows.
3. Run representative workflows for all existing modules using disposable data, as specified by the original acceptance contract. Document actual assertions rather than merely visiting pages.
4. Complete the relevant visual/input matrix: 1440×900, Today 1280×720, 768×1024, 390×844 and 320 px; light/dark and all accents; core/all-tools; solo/household as applicable; keyboard, reduced motion, long content and 200% zoom.
5. Exercise a populated new backup export/restore and a compatible old backup. Verify records, preferences and supported new settings.
6. Build the single-file offline edition and delivery ZIP. Verify the file edition with network unavailable, including storage and export/restore. Verify hosted/PWA offline behavior separately.
7. Save fresh screenshots and logs with a dated manifest that names the exact commit/build under test. Include clear before/after evidence for R3–R7 and machine-readable or test output for R1–R2.
8. Keep source changes, generated delivery outputs and documentation coherent. Do not include disposable/private data or scratch dependencies in the delivery ZIP.
9. Commit the focused corrections on premium-ui-upgrade. Push that branch if repository access permits so the updated GitHub repository can be independently reviewed. Never merge or release here. If push is unavailable, report the local SHA and exact limitation.

The previous reviewer needed to set PSModulePath to the Windows system modules directory only within the verification process to make Compress-Archive available. Treat this as an environment diagnostic if it recurs; do not make unrelated machine-wide changes.

In your final response provide:

- Branch URL and exact final commit SHA.
- An R1–R8 table: fixed or unresolved, with implementation and verification evidence.
- Original 33-item acceptance status with qualifications.
- Exact commands run and actual results.
- Paths to the updated report, screenshot manifest, standalone HTML and delivery ZIP.
- Any unresolved or unverified item, plainly stated.

Call the pass complete only when the fixes and their meaningful checks are complete. If a check could not be executed, label the result conditional and provide precise reproduction steps instead of claiming 100%.

