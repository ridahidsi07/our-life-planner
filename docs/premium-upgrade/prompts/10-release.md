# Phase 10 — verify the whole product and deliver

Read the complete `docs/premium-upgrade/ACCEPTANCE.md`, master brief, status, implementation plan and phase evidence. Finish unresolved requirements and verify the actual shipped outputs. This is a local delivery phase, not authorization to deploy or publish remotely.

1. Review the entire diff for unrelated changes, placeholders, hardcoded demo metrics, duplicate state, disabled tests, console errors, storage migrations and external asset dependencies. Fix actual defects while preserving accepted work.
2. Complete every applicable acceptance row with evidence. Exercise the end-to-end scenarios and representative module workflows. Recheck metrics after create/complete/undo/filter/refresh. Inspect all-module and core-only mode in both light/dark themes.
3. Run `npm.cmd run verify` from the project root and inspect all output. Investigate failures against the recorded baseline. Fix introduced failures; list any remaining baseline failures explicitly. A nonzero command is not a passed check.
4. Open the production build with the configured preview flow. Verify real UI behavior and console/network errors. Avoid relying exclusively on Vite's development server.
5. Open the newly generated `dist/Our-Life-Planner-Offline.html` as an actual local file in the intended supported browser. With network unavailable, verify rendering, icons/fonts/charts, create/edit/complete, reload, backup export/import, theme persistence and focus-session behavior. Use disposable test data and document browser limitations honestly.
6. Separately verify the hosted/PWA offline caching/update flow. Ensure customers can receive the new assets without a broken mixed-version cache. The file edition and service-worker edition are distinct checks.
7. Inspect the generated delivery ZIP and verify it contains the intended current product and guides, not private backups, reference screenshots/video, development evidence, secrets or node_modules. Update setup/release documentation if visible workflows changed.
8. Capture before/after Today, Tasks, Insights, Calendar, Quick Add and Settings at matching viewports, plus representative mobile screens. Record a short real product walkthrough: open Today, create a task, move/complete it, inspect charts, use calendar, start/pause focus, switch accent and return to Today.
9. Write `docs/premium-upgrade/FINAL-REPORT.md`: completed changes; 33-item coverage; module coverage; checks with results; screenshots/recording; performance comparison; migration/offline findings; remaining limitations; exact build/ZIP paths; launch instructions. Update `STATUS.md` accurately and create a reviewed local checkpoint of completed work.

Do not label the product ready while a required flow is broken or a release check is unverified. If an environment prevents an essential check, give the exact remaining manual steps and mark readiness conditional. Return links to the final local deliverables and evidence.
