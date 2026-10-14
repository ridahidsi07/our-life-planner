# Phase 02 — compose the Today dashboard

Read the master brief, acceptance checklist, status, and implementation plan in `docs/premium-upgrade/`. Open `reference/frame-003.png`, `frame-060.png`, and `current-dashboard.jpg`. Implement the Today upgrade on actual planner state.

Inspect `src/components/today/TodayDashboard.tsx`, its calculations, and `PlannerContext.tsx`. Extract coherent components/selectors only where useful. Preserve existing actions and enabled-section preferences.

- Compact the overdue area into a clear count, primary action and expandable details. Combine date/week context into a smaller control row. Remove redundant nested cards around headings.
- Add four useful metrics using the explicit scopes in the master brief. Document their formulas and click destinations. The first is a dark navy/deep accent card; the other three are quiet surfaces.
- Make Next Up/selected-day schedule the main content, with supporting habits/weekly trend/focus areas using appropriate spans. Keep optional money/food/health summaries lower in the hierarchy and respect hidden modules.
- Keep real task titles, priorities, due context and actionable controls. Meaningful task content must start within the first 720 px desktop viewport.
- Reuse derived state so completion and creation update every affected metric/list. Empty denominators, missing history, and disabled modules must have honest states.
- Use existing progress UI initially where appropriate. Do not introduce fictional chart values as placeholders for phase 04. The focus region may link to the existing feature until phase 07 provides its shared compact controller.
- Use readable card padding, aligned edges, strong number hierarchy, restrained metadata and stable number widths. Avoid enlarging decorative regions at the expense of content.

Verify 1280x720, 1440x900, 768x1024 and 390x844; light/dark; no data; representative sample data; long task names; core-only and all tools. Complete one task and add one task: compare each affected metric with the underlying records and check its destination filter. Confirm overdue expansion and date switching preserve state correctly.

Run type checks and relevant Today/module/interaction tests. Save screenshots and documented metric definitions under `artifacts/premium-ui/phase-02/`; update `STATUS.md`. Return the actual desktop/mobile result for visual review before propagating the composition to other screens.
