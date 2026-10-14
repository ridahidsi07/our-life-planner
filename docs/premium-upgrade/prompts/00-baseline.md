# Phase 00 — inspect, preserve, and plan

Execute this phase in the existing Our Life Planner workspace. Read `docs/premium-upgrade/MASTER-BRIEF.md`, `ACCEPTANCE.md`, `STATUS.md`, and `reference/PREMIUM-UPGRADE-REPORT.md` first. Open `reference/frame-003.png`, `frame-005.png`, `frame-019.png`, `frame-041.png`, `frame-052.png`, and the corresponding current screenshots. Use their visual evidence to plan the upgrade.

Complete these tasks without changing runtime UI:

1. Confirm the project root, installed runtime/package versions, Git branch/status, applicable repository instructions, npm scripts, available browser tools, and actual running dev servers. Identify unrelated edits and preserve them.
2. Establish a recoverable local code checkpoint and a dedicated `premium-ui-upgrade` branch if that name is available; if it already exists, inspect it before choosing or reusing it. Do not stage private files or unrelated work. Check for valuable ignored assets/build outputs and preserve them separately if needed.
3. Explain how to export planner data from the actual app if a user-data backup is needed. Use a disposable browser profile/origin and clearly marked sample data for testing. Do not clear or replace the user's existing browser data.
4. Inspect state, storage, backup validation, module registry, existing design tokens, UI accessibility helpers, sample data, standalone builder, packaging script and service worker. Identify existing test expectations that may need equivalent updates during refactoring.
5. Run the baseline `npm.cmd run verify` after preserving important outputs. Record commands, exit codes and failures. Do not attribute pre-existing failures to the upcoming redesign. If an environment requirement prevents a command, record it and a concrete remedy.
6. Start the actual app on a free localhost port, capture Today, Tasks/List/Insights, Quick Add, Calendar, Settings, and representative optional modules. Include desktop 1440x900 and mobile 390x844, plus Today at 1280x720. Record viewport, browser, data fixture, enabled modules, theme and port with the screenshots.
7. Write `docs/premium-upgrade/IMPLEMENTATION-PLAN.md` with: current architecture; proposed Today composition; shared tokens/components; metric definitions; Board status behavior; chart data limitations; focus-session persistence; accent migration; offline packaging strategy; phase order and checks. Keep optional feature expansion out of scope.
8. Update `STATUS.md` with baseline evidence and the next action. Save screenshots/logs under `artifacts/premium-ui/phase-00/`.

Make routine design/technical decisions using the master brief. Ask only if a genuine blocker cannot be resolved from the workspace. Return a concise baseline summary and the proposed Today arrangement. Phase 00 is complete when the baseline and implementation plan are reviewable; the new UI has not been built yet.
