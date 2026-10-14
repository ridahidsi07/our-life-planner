# Phase 04 — useful charts and consistent metrics

Read the master brief's data contracts, acceptance checklist, status and current plan. Inspect `reference/frame-041.png`, `frame-043.png`, and `current-insights.jpg`. Implement analytics using actual supported planner records.

- Consolidate shared metric selectors so Today, Tasks, Board and Insights agree for equivalent scopes. Document date boundaries, archive/member/module filters and denominators.
- Replace text-only analysis where useful with a weekly completion chart, task/category/status breakdown, and a comparable previous-period trend when actual history supports it. Keep a compact summary row and clear units.
- Provide 7/30/90-day controls where meaningful. Chart labels and selected range must reflect real dates in the user's intended time zone; respect week-start preference where applicable.
- Use `completedAt` for dated task completions. Existing reopened/deleted/legacy records may not provide a full event history; disclose this limitation in concise product language and do not generate historical activity. Do not build a project-time donut with invented hours.
- Add hover/tap/focus inspection, concise tooltip values, a marker/crosshair where useful, clear legends and an accessible textual/table equivalent. Important information cannot depend on color or pointer hover alone.
- Handle zero values, one data point, no previous period, negative/undefined comparison cases, long labels and large counts. Distinguish no data from a measured zero when relevant.
- Animate genuine metric changes briefly without resetting all values on navigation. Final numbers must be correct and accessible announcements should not repeat each frame.

Prefer a small accessible SVG implementation for simple charts if it keeps maintenance reasonable. If selecting a chart library, confirm its current React compatibility and APIs from official sources, compare bundle impact, and verify assets work in the standalone HTML. No CDN dependency.

Test a known fixture with recorded dates at range boundaries, an empty period, and a new completion. Manually reconcile figures with records and verify filters affect the correct data. Add meaningful tests for new selectors and boundaries. Run type/build and affected tests; inspect charts on desktop/mobile and in light/dark mode.

Save chart screenshots plus metric definitions/check evidence under `artifacts/premium-ui/phase-04/` and update `STATUS.md`. Every visible number must have a documented source or a clearly labeled unavailable state.
