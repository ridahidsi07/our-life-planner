# Phase 09 — motion, responsive behavior and complete states

Read the master brief, acceptance checklist, status and reel report. Inspect the relevant source frames for entry, drag, filtering, drawer and theme continuity. Complete the finish across the working product.

- Keep sidebar/header stable during page changes. Coordinate content entry and exit without blank flashes, layout jumps or long delays. Prefer transform/opacity animations and preserve interactivity during rapid navigation.
- Smooth filtering/reordering with stable item identity and clear selected-filter feedback. Do not animate unrelated regions or reset scroll unnecessarily.
- Finish modal/drawer exit, hover/focus/pressed states, meaningful save/completion feedback and true old-to-new metric changes. Respect reduced motion; content and state remain equally understandable.
- Test desktop 1440x900 and 1280x720, tablet 768x1024, mobile 390x844 and a 320 px spot-check. Remove page-wide horizontal overflow and clipped controls. Local scrolling is acceptable for deliberately designed tables/boards with usable alternatives.
- Check keyboard-only use, tab order, accessible labels, return focus, visible focus, non-color status cues, 200% zoom, long text and large values. Inspect contrast for actual themes and interactive states; do not claim compliance from palette names alone.
- Finish empty, filter-empty, loading where real asynchronous work exists, disabled, saving, success and recoverable error states. Avoid artificial loading delays or skeletons for instantly available local data.
- Make sample data relative to the current date when a user explicitly loads/resets samples. Keep stable IDs/relationships, valid dates, known completion history, coherent values and sample indicators. Do not re-date persisted sample data on every render or modify real records.
- Exercise core-only and all-module layouts; make sure optional content does not leave empty dashboard holes. Keep destructive controls clearly distinguished.

Use real browser interactions/recordings to inspect motion; still screenshots are insufficient. Run type checks, affected motion/accessibility/sample-data checks, and a production build if assets/dependencies changed. Compare runtime/bundle measurements with phase 00 and investigate material regressions.

Save evidence and a completed responsive/state matrix under `artifacts/premium-ui/phase-09/`. Update `STATUS.md` and list any remaining defects for phase 10 rather than hiding them.
