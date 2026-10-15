# Antigravity — focused follow-up after re-review of a7f9fd9

Continue in the existing Our Life Planner repository on premium-ui-upgrade.

Read docs/premium-upgrade/SECOND-REVIEW-a7f9fd9.md and its evidence in artifacts/premium-ui/independent-review-a7f9fd9/. Also read the original MASTER-BRIEF.md, ACCEPTANCE.md and the Apple color implementation brief.

The reviewed head was a7f9fd9722d651ff9d4a1308db9f8f88136dc459. Inspect the current branch and working tree first; preserve unrelated changes. If the branch has advanced, verify which issues remain before editing.

Keep the successful work: R1 completion-history/timezone/no-data fixes, R2 custom category aggregation, R3 Insights filter handoff, R6 320 px wrapping/category layout, and R7 Core Starter Focus rendering. Do not restart the redesign.

The independent reviewer ran the full gate: 35/35 suites passed, and the rebuilt standalone HTML matched the committed output. Four findings nevertheless remain. Fix the tests and the behavior, not just the report.

## F4 first — make visual verification trustworthy

The Apple screenshot test silently fails to navigate. Its four desktop-light screenshots named Today, Tasks, Budget and Settings are byte-identical and all show Today. The same duplication occurs within the desktop-dark and each mobile group.

In scripts/test-apple-color-system.ts:

- Replace queries that depend on nonexistent aria-label attributes.
- Navigate using actual accessible names or stable verified controls.
- Fail if the target is absent, ambiguous or not actionable. Never use a null fallback and continue as if navigation succeeded.
- After every navigation, assert the destination heading and a page-specific landmark before capturing.
- Use the real appearance picker to switch light/dark and Apple. Verify refresh persistence through the application; do not force body colors or document classes before asserting them.
- Add meaningful system-theme and saved-preset compatibility checks where practical; label any unexecuted media-mode check accurately.
- Capture computed colors on real visible controls. Keep palette-pair calculations as supporting checks, not whole-app accessibility proof.
- Replace source-string checks for relevant R3–R7 cases with rendered behavior assertions. Retain useful direct-function tests for R1/R2.
- Register any additional regression suites in the standard verify command.

Regenerate the named screenshots only after destination assertions pass. Inspect every saved screenshot. Do not rename Today images to stand in for other modules. Do not alter tests solely to accept the implementation.

## F1 — use complete, contrast-safe control roles

The correction pass introduced --accent-foreground and --accent-muted consumers, but those tokens are undefined.

Reproduce in Apple-inspired Savings:

- New pot / Add deposit, light: inherited #1D1D1F on #0066CC, 3.02:1.
- Same controls, dark: inherited #F5F5F7 on #2997FF, 2.77:1.
- Today selected-day text, dark: white on #2997FF, 3.02:1.

These are normal-size labels requiring at least 4.5:1 under the supplied brief. The existing correct primary pairing is white on #0071E3, 4.70:1.

Fix by role:

- Use existing paired primary-button tokens or shared classes for filled actions: --btn-primary-bg, --btn-primary-fg, hover and pressed tokens.
- Give selected controls their own verified foreground/background pair where needed.
- Use existing defined border roles for borders.
- Do not merely define --accent-foreground as white: white still fails on the dark link-blue fill.
- Audit all uses of the undefined variables across Savings, Debt, Routines, Settings, Budget forms, Tasks and error/empty states.
- Audit filled accent surfaces with explicit text-white as well; they can have the same contrast defect.
- Check Teal, Ocean, Plum, Ember and Apple in both appearances. Preserve compatible saved choices.

Add regression coverage for undefined consumed role variables and actual default/hover/pressed/selected control contrast. Preserve visible keyboard focus and usable disabled states.

## F2 — complete the palette at its consumers

Apple currently updates major surfaces but leaves old interface colors:

- Habits New habit and active This week remain #087F83.
- Meals Plan meal and Weekly plan remain #087F83.
- Dark header and sidebar footer retain navy because opacity variants escape the new CSS remapping.
- Compact Focus retains a navy treatment that was not reconciled with the requested neutral mapping.

Complete the module/shared-flow inventory. Cover Today, Calendar, Tasks, Routines, Inbox, Goals, Habits, Budget & bills, Savings, Debt, Meals, Groceries, Workouts, Weight and Water, plus settings, setup, mobile navigation, dialogs, errors, toasts and empty states.

Replace interface color literals at their actual consumers using semantic roles. Avoid adding another broad utility override layer. Keep user-defined household/category colors and meaningful status colors intact. Use the specified neutral surfaces, neutral ordinary headings and blue action/selection roles; keep label/icon/shape cues.

Decide and document the new-install default consistently with the Apple brief. The reviewed build still selects Teal for a genuinely fresh setup because INITIAL_SETTINGS and sample/default settings remain teal. If Apple is the intended default for new installations and demo data, update those paths only. Preserve existing saved selections and the established missing-field legacy fallback.

Verify all claimed modules in light/dark at desktop and phone widths, with actual destination checks and fresh evidence. Do not describe navigation-only checks as full workflow verification.

## F3 — finish Calendar consistency

The original missing meals and inaccurate item-type counts are fixed. Keep those fixes and the corrected real-Tomorrow label.

Remaining behavior:

1. Core Starter disables Money/Meals/Health, and Today respects that. Calendar still includes their filters and records. In the reviewed fixture Today has 3 schedule entries while Calendar has 7.
2. Coming Up is assembled by item type, so 09:00 precedes 07:30 and 18:00 precedes 12:30 on the same day.
3. Coming Up silently cuts to five items and presents the badge 5 beside Next 7 days, with no truncation disclosure or access to the remainder.

Use one consistent eligible day-item source or equivalent shared logic across grid, accessible counts, agenda and upcoming list. Apply module eligibility, user filters, recurrence and explicitly documented completion rules.

Sort by date/time with a defined all-day policy before limiting results. Label a preview honestly, show the actual eligible total where appropriate, and provide access to remaining items. Make the selected-date versus today basis understandable.

Add behavior tests for:

- Core Starter and all-tools configurations.
- Every supported calendar item type.
- More than one item of the same type on a day.
- Mixed types at different times, plus all-day items.
- More than five upcoming items.
- Filter changes, recurrence, completed/archived state as applicable, future selections and month/year boundaries.
- Visible contents and accessible counts agreeing.

## Delivery and truthful acceptance

Keep original acceptance IDs 01–33 and their wording. Update ACCEPTANCE.md, STATUS.md and FINAL-REPORT.md with the exact new build, current suite count and evidence.

Separate:

- Implemented.
- Behavior tested.
- Visually inspected.
- Unverified or conditional.

Remove unsupported 100% claims. Report real scope: a screenshot of Today does not verify Tasks, and a hard-coded color pair does not verify a real button.

After corrections:

1. Run lint and the full integrated verification command without weakening baseline assertions.
2. Inspect the production build and its error logs.
3. Capture matching fresh before/after evidence for the corrected controls, modules and Calendar cases.
4. Preserve the successful 320 px Tasks and Quick Add layouts; check keyboard and relevant 200% zoom behavior.
5. Check Apple preset persistence and populated backup compatibility, including a legacy backup lacking the new field.
6. Rebuild the standalone offline file and delivery ZIP. Verify the file edition and PWA separately; label any unavailable manual offline workflow check accurately.
7. Save a dated evidence manifest with the build/commit under test and the exact workflow, viewport, appearance and outcome for every capture.
8. Commit focused changes on premium-ui-upgrade and push that branch if access permits for independent re-review. Do not merge, deploy or publish a release.

Use disposable test data. Do not modify the user's real planner records or make unrelated machine-wide changes.

Return the branch URL and final commit SHA, an F1–F4 resolution table with evidence, exact test results, updated report and screenshot paths, delivery artifact paths and any remaining limitations.

