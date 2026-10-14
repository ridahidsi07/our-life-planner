# Phase 06 — readable calendar and useful agenda

Read the master brief, acceptance checklist and status. Inspect `reference/frame-037.png` and `current-calendar.jpg`. Extend `CalendarView.tsx`, existing event calculations and the shared drawer.

- Preserve Month, Week and Day views, date navigation, Today, export, filtering and recurring-event behavior.
- At desktop sizes, show one or two short event labels per month cell, plus a useful `+N more` action. Ensure labels truncate gracefully and full information remains reachable. Keep compact dots or a compact alternative on narrow screens.
- Make selected day and current day visually distinct. The selected-day agenda and a compact upcoming section should agree with the calendar's date/filter state.
- Tighten the toolbar and page heading using the shared design system. Distinguish all-day events, scheduled items, and overdue/completed states through understandable labels/styles.
- Use the shared detail drawer for existing record actions. Calendar interactions should update the original records and relevant summaries, not parallel event copies.
- Respect week-start, timezone, month boundaries and existing recurrence exceptions. Use local-date utilities where required; avoid accidental UTC shifts for `YYYY-MM-DD` values.
- On mobile, prioritize a readable selected-day agenda and accessible date controls. Preserve keyboard access, focus visibility and useful target sizes.

Test next/previous month, Today, month/year boundaries, Monday/Sunday start, an empty day, many events on one day, long titles, a recurring occurrence, completion/edit from detail, and `.ics` export. Confirm date labels and event sets across calendar and agenda. Run type checks and affected recurrence/export/module tests.

Capture desktop and mobile results and key interactions under `artifacts/premium-ui/phase-06/`. Update `STATUS.md` with evidence and any gaps.
