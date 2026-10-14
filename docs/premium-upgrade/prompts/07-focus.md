# Phase 07 — shared focus timer and compact controller

Read the master brief, acceptance checklist and status. Inspect `reference/frame-012.png` and the existing `FocusModal.tsx`. Implement a compact focus card/controller connected to the same session as the existing modal.

- Keep the existing 25-minute focus countdown, 5-minute break, task completion/defer and reset behavior. The reel's elapsed stopwatch does not require changing this planner's countdown into a different product.
- Move session state into an appropriate shared controller/context. Render both modal and compact controller from one session; never start two independent countdowns.
- Derive running time from persisted timestamps/remaining duration so background throttling, navigation and refresh do not drift or restart the session. Clamp completion at zero and handle pause/resume/reset correctly.
- Define what happens when an associated task is completed, archived, deleted or no longer in the current filter. Preserve safe user control instead of linking to a stale task.
- Persist session data with a backward-compatible contract and clean defaults. Respect existing storage coordination and avoid echo writes/races across tabs. Do not reset the main planner data or confuse session data with historical time analytics.
- Use a dark navy/deep-accent surface, a faint line texture, tabular timer digits and explicit accessible controls. Keep current state readable without animation or color alone. Avoid announcing every second to screen readers.
- Keep the compact controller reachable without covering mobile navigation/content. Closing the modal should not unexpectedly stop a running session.

Add meaningful timer/state tests covering elapsed time, pause/resume, reset, completion, refresh restoration, expired sessions and cross-tab reconciliation. Browser-check start, navigate away/back, close/reopen modal, pause, refresh and break/reset. Use a short test duration through an appropriate test fixture rather than waiting 25 minutes or changing production defaults.

Run type and affected storage/interaction checks. Save evidence under `artifacts/premium-ui/phase-07/`, document the session contract, and update `STATUS.md`.
