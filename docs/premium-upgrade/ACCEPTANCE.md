# Premium UI acceptance checklist

Use this as the completion contract for the implementation. All rows are initially unchecked. For each completed item, record the phase evidence path and any qualifications in `STATUS.md` or `FINAL-REPORT.md`. A screenshot confirms appearance; interactions and persistence require actual execution.

## Coverage of the 33 recommendations

| ID | Requirement | Phase | Observable completion criterion | State |
|---|---|---|---|---|
| 01 | Quieter navigation | 01 | Labeled, grouped navigation is usable with core-only and all modules; pinned/hidden preferences work. | **Complete** (`artifacts/premium-ui/phase-01/`) |
| 02 | Persistent refined header | 01 | Search, creation, saving status and profile remain accessible without duplicated visual emphasis. | **Complete** (`artifacts/premium-ui/phase-01/`) |
| 03 | Useful first screen | 02 | At 1280×720, Today shows its title, key metrics and meaningful task content; attention details can expand. | **Complete** (`artifacts/premium-ui/phase-02/today-1280x720-above-the-fold-light.png`) |
| 04 | Four Today metrics | 02 | Four useful figures have explicit scopes, valid formulas and working relevant destinations. | **Complete** (`artifacts/premium-ui/phase-02/METRICS-DOCUMENTATION.md`) |
| 05 | Featured summary card | 02 | First summary card has deep navy/accent treatment; text/actions remain readable in every supported theme. | **Complete** (`artifacts/premium-ui/phase-02/today-1440x900-light.png`, `dark.png`) |
| 06 | Content-led grid | 02 | Next Up/schedule gets appropriate space; support cards align; optional modules leave no empty holes. | **Complete** (`artifacts/premium-ui/phase-02/`) |
| 07 | Less redundant framing | 01, 08 | Heading/toolbars use hierarchy and spacing; cards are reserved for meaningful content groupings. | Pending |
| 08 | Shared spacing | 01, 08 | Comparable cards/rows/controls use consistent padding and gutters across modules. | Pending |
| 09 | Type hierarchy | 01, 08 | Page title, section title, metric, task title and metadata are distinguishable and readable. | Pending |
| 10 | Consistent surfaces/controls | 01, 08 | Shared corner, border, shadow, height and icon conventions; focus/hover/pressed/disabled states work. | Pending |
| 11 | Useful visual analytics | 04 | Charts answer real completion/category/trend questions; every value has a valid source. | **Complete** (`artifacts/premium-ui/phase-04/01-insights-desktop-1440-light.png`, `METRICS-INSIGHTS-DOCUMENTATION.md`) |
| 12 | Chart inspection | 04 | Dates, units and legends are clear; tooltip/inspection works through pointer, keyboard and touch with a text alternative. | **Complete** (`artifacts/premium-ui/phase-04/03-insights-chart-tooltip-inspection.png`, `04-insights-donut-hover-inspection.png`) |
| 13 | Connected figures | 02–06 | Equivalent scopes agree after creation, completion, reopening, editing, filtering and deletion. | Pending |
| 14 | Honest numeric motion | 04, 09 | Brief true old/new transitions; no arbitrary counts, zero-reset on routine navigation or repeated announcements. | **Complete** (`artifacts/premium-ui/phase-04/03-insights-chart-tooltip-inspection.png`) |
| 15 | Optional Board | 03 | List/Board/Insights coexist; Board uses the four existing stored statuses. | **Complete** (`artifacts/premium-ui/phase-03/01-tasks-board-desktop-1440-light.png`) |
| 16 | Complete drag/status operation | 03 | Lift/source/drop/cancel feedback works; status menu provides keyboard/touch equivalence; no lost or duplicate records. | **Complete** (`artifacts/premium-ui/phase-03/03-tasks-board-card-menu-open.png`, `04-tasks-board-drag-placeholder-active.png`) |
| 17 | Scannable task cards | 03 | Title leads; metadata is restrained; no fictional comments/subtask progress is displayed. | **Complete** (`artifacts/premium-ui/phase-03/01-tasks-board-desktop-1440-light.png`) |
| 18 | Shared contextual drawer | 05 | Existing shared drawer supports consistent detail/edit flows and returns focus/context correctly. | Pending |
| 19 | Contextual Quick Add | 05 | Module actions open the relevant form; global categories remain; common capture is concise and validated. | Pending |
| 20 | Visible save result | 05 | Success reflects real state/saving behavior; new item is identifiable; appropriate Undo actually restores the prior state. | Pending |
| 21 | Informative calendar cells | 06 | Desktop labels and overflow action work; narrow layouts retain readable access to events. | Pending |
| 22 | Synchronized agenda | 06 | Selected date, agenda, upcoming list and navigation/filter state agree. | Pending |
| 23 | In-context focus | 07 | Compact and modal controls share one countdown/break session with correct navigation/refresh/background behavior. | Pending |
| 24 | Relevant household UI | 03, 08 | Assignment/filters help households; solo use does not acquire an irrelevant team directory. | **Complete** (`artifacts/premium-ui/phase-03/05-tasks-board-quick-filter-high-priority.png`) |
| 25 | Filter continuity | 03, 09 | Items keep identity; filtering/reordering is understandable and preserves appropriate focus/scroll. | **Complete** (`artifacts/premium-ui/phase-03/07-tasks-board-filter-empty-state.png`, `10-tasks-list-view-sync.png`) |
| 26 | Coordinated transitions | 05, 09 | Stable shell, clean enter/exit, no invisible interactive overlays, flash or blocked rapid input. | Pending |
| 27 | Complete accent system | 08 | Accent reaches all role-based UI, charts and special surfaces in light/dark; persists across refresh/backup restore. | Pending |
| 28 | Semantic colors | 08 | Danger, warning, success, category and overdue meanings survive accent changes. | Pending |
| 29 | Organized Settings | 08 | Relevant sections are easy to reach; existing preferences and data controls remain usable. | Pending |
| 30 | Selective texture | 07, 08 | At most one featured/focus surface uses faint texture without reducing clarity or depending on remote assets. | Pending |
| 31 | Durable demo composition | 09 | Explicit sample loading uses relative dates and valid relationships; real/persisted records are never silently re-dated. | Pending |
| 32 | Real-world states | 05, 08, 09 | Empty, filtered-empty, long content, large figures, disabled, saving and recoverable error states are usable. | Pending |
| 33 | Responsive finish | 09 | Desktop/tablet/mobile layouts and dialogs work; no clipped important controls or page-wide overflow. | Pending |

## End-to-end scenarios

Run against disposable data. Record the fixture, browser, version, viewport, theme and actual result. Reuse existing module workflows rather than inventing new ones merely for this checklist.

### A. Create → inspect → complete → reopen

1. Note today's visible counts and filters.
2. Add a task due today using Quick Add. Verify title, due context, assignment and ID are stored once.
3. Find the task in the appropriate List, Board and Calendar views. If a filter hides it, verify the confirmation offers a clear way to view it without silently changing filters.
4. Complete it from the Board status action. Compare List, Today, relevant badges and Insights with their documented scopes.
5. Reopen it. Verify completion semantics and counts. Refresh and confirm state remains correct.
6. Repeat the status operation with keyboard only. Cancel a drag and confirm nothing changes.

### B. Editing and recovery

1. Open a task drawer, edit title/date, save, close, and confirm focus returns to a useful location with the original filter and scroll context.
2. Trigger a validation error; entered values and a clear local error remain.
3. Repeat a submit rapidly; a single record results.
4. Exercise a reversible action with Undo and confirm all affected views recover.
5. Safely simulate a storage failure in the disposable session where tooling permits. The saving indicator must stay truthful and existing recovery/export options remain available. Otherwise mark this check unverified with exact manual steps.

### C. Calendar and recurrence

1. Navigate across month and year boundaries and return through Today.
2. Change week start to Sunday/Monday. Verify column ordering and dates.
3. Inspect selected-day agenda and an overflow day with many events.
4. Verify all-day and scheduled entries, a recurring occurrence, and an edited/rescheduled record.
5. Export calendar data with the existing `.ics` flow and run the recurrence/export checks.

### D. Focus session

1. Start focus from the compact card. Open the modal and confirm the same remaining time and state.
2. Navigate away/back, close/reopen the modal, and background the tab. Elapsed time remains accurate.
3. Pause, refresh, resume and reset. A paused timer does not keep counting; running sessions restore coherently.
4. Use a short test fixture to reach zero and enter/reset the break flow. Production default durations remain unchanged.
5. Verify a second tab and a completed/deleted associated task cannot produce conflicting controllers or stale task actions.

### E. Appearance and saved-data compatibility

1. Switch Teal → Ocean → Plum → Ember in light/dark modes, then inspect Today, Tasks, charts, Calendar, Settings and representative optional modules.
2. Confirm status/danger colors keep their meanings and focus/selection remain visible.
3. Refresh; the chosen theme/accent remains.
4. Restore an old compatible backup lacking accent/session fields; the app works with safe defaults.
5. Export/restore a new backup; existing records, module preferences and new supported settings round-trip correctly.

### F. Existing module regression coverage

| Area | Representative functional check |
|---|---|
| Routines | Complete/skip a valid occurrence; next occurrence and history remain correct. |
| Goals and habits | Update a goal step and habit check-in; progress/streak logic agrees with existing rules. |
| Inbox | Capture and use the existing organize/convert flow without losing text. |
| Budget & Bills | Add a transaction and use a bill payment flow; ledger/balance calculations remain unchanged. |
| Savings and debt | Update a valid record; calculations and linked transfers remain coherent. |
| Meals and groceries | Use existing meal planning/grocery aggregation; quantities/units and checked items behave correctly. |
| Workouts, weight and water | Add/edit a log; existing units, calculations and date filtering remain correct. |
| Setup and modules | Complete a disposable setup; toggle/pin modules; navigation and Today respect choices. |
| Search and weekly review | Find records and finish the existing guided workflow using the new controls. |
| Data/support dialogs | Backup/restore, offline download, conflict handling and help/support remain reachable and usable. |

Document actual available workflows. A missing baseline capability does not become an obligation to invent a large new feature; preserve existing coverage and implement the explicit upgrade scope.

## Visual and accessibility matrix

Use representative scenarios instead of blindly testing every possible combination. Record which screen/state was tested for each requirement.

| Dimension | Coverage |
|---|---|
| Desktop | 1440×900; Today also at 1280×720 with meaningful content above the fold. |
| Tablet | 768×1024; verify navigation and multi-column collapse. |
| Mobile | 390×844; 320 px width spot-check for overflow and control reachability. |
| Theme | Light/dark plus system selection; all accent choices; legacy fallback. |
| Data | Empty, populated, filtered-empty, long titles/names, large values, high item count. |
| Configuration | Core-only/all-tools; solo/household; different week-start/unit/currency settings where relevant. |
| Input | Pointer, touch-sized viewport, keyboard-only; visible focus and logical tab order. |
| Dialogs | Initial focus, focus containment, Escape, close, return focus, long-form scroll, 200% zoom. |
| Motion | Default and reduced-motion; quick repeated navigation/open/close; no stale overlays. |
| Charts | Readable axes/legend; pointer/focus/tap inspection; equivalent text; empty range and one-point series. |
| Contrast | Measure actual text/control/focus pairings in supported themes, including disabled and selected states. |

Use matching before/after screenshots for Today, Tasks, Insights, Calendar, Quick Add and Settings. Consistent viewport/data settings matter more than matching the reel's fictional values.

## Build and delivery gates

- [ ] Type checks pass (`npm.cmd run lint`, currently `tsc --noEmit`).
- [ ] Relevant behavioral tests pass; new metric/session/migration logic has meaningful coverage.
- [ ] `npm.cmd run verify` exits successfully, or remaining baseline failures are reported and readiness is conditional.
- [ ] Tests were not disabled/deleted just to accept the redesign; revised structural checks still protect behavior.
- [ ] Production preview is inspected with no newly introduced console/network errors.
- [ ] Generated standalone HTML is exercised as a local file with network unavailable, including storage and export/restore.
- [ ] Fonts, icons, charts, textures and dependencies render offline without missing chunks/assets.
- [ ] Hosted/PWA offline caching and update behavior are verified separately from the file edition.
- [ ] Delivery ZIP contains current outputs and appropriate guides; reference evidence/private data/development files are excluded.
- [ ] Baseline/final performance and bundle measurements are compared; material regressions are addressed or explained.
- [ ] Final report links screenshots, recording, checks, known limitations, build and ZIP paths, and launch instructions.
- [ ] Every required phase and applicable row has evidence; unverified items are explicitly labeled.

The final report must distinguish implemented, tested, and visually verified. None of these labels automatically implies the others.
