# Phase 03 — task hierarchy and a working Board

Read the master brief, acceptance checklist and status. Inspect `reference/frame-019.png`, `frame-029.png`, and `current-tasks.jpg`. Implement within `TasksView.tsx` and existing state/drawer utilities.

Keep List and Insights, and add Board using these exact stored statuses:

| Label | Value |
|---|---|
| Not started | `not_started` |
| In progress | `in_progress` |
| On hold | `on_hold` |
| Completed | `completed` |

- Unify List/Board filters and summaries. Task identity, archive status, assignment, priority and dates remain intact when the view changes.
- Make the task title primary, with quiet category/priority/due metadata and member initials where relevant. Use an overflow action menu. Do not fabricate comment counts or subtask progress.
- Implement drag interaction with an elevated dragged card, readable source slot, highlighted destination, cancellation and reliable settling. Use stable record IDs. Support empty columns and enough tasks to require scrolling.
- Provide a status menu/select that works through keyboard and touch without dragging. Announce the resulting status change accessibly and preserve useful focus.
- Route all status changes through the correct existing state API. Preserve completion timestamp and reopening semantics; fix API gaps deliberately if needed. Verify Completed is reflected in Today, List, Insights and the relevant calendar items.
- Make household assignment/filtering useful where members exist; retain a simple solo experience. Do not create a corporate team directory.
- Mobile may default to List or show one selected Board column at a time with explicit controls; provide equivalent operations without page-wide overflow.

Use existing tools where adequate. If a maintained drag library is necessary, inspect current official APIs and justify bundle/offline effects before installing it. Update the lockfile and verify the standalone build if dependencies change.

Test drag, canceled drag, keyboard status changes, empty columns, filtering, archived tasks, completing/reopening, refresh, and duplicate prevention. Add focused tests for changed status logic as needed; run type checks and affected existing checks. Save evidence in `artifacts/premium-ui/phase-03/` and update `STATUS.md`.
