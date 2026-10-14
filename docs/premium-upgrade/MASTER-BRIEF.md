# Master brief — Our Life Planner premium upgrade

## Mission and scope

Upgrade the existing app to the level of composition and interaction polish shown in the supplied Fernly reel. The product remains Our Life Planner, a personal/household planner with optional modules, local persistence, backup/restore, a hosted/PWA edition, and a standalone offline HTML edition.

Implement real interfaces on existing data. Work phase by phase using the prompts in this directory. Read `STATUS.md` before editing and update it with evidence afterwards. Current source takes precedence over old path/line assumptions in these documents.

The reel demonstrates visual behavior, not source architecture, accessibility, storage reliability, or mobile support. The numeric design targets below are proposed implementation values, not measurements recovered from the video.

## Visual direction

Calm, compact, precise, and readable. Use a neutral cool canvas, crisp cards, a dark navy featured surface, and restrained brand accent. Preserve recognizable planner language and useful controls.

| Element | Starting target; adjust after actual viewport review |
|---|---|
| Desktop navigation | Labeled sidebar approximately 220 px; expandable Plan/Money/Food/Health groups; honor existing module and favorite preferences. |
| Top bar | Persistent approximately 64 px; search, Quick Add, saving status, and profile ordered by importance. Page heading belongs in content. |
| Content | 24 px desktop gutters, 16 px small-screen gutters; coherent grid, generous enough for readable content. |
| Spacing | Shared 4/8/12/16/24/32 px scale; 4 px mainly for icon/label details. |
| Card surfaces | 16–20 px radii and padding; subtle border/shadow; avoid a large container around every title/toolbar. |
| Typography | Neutral system sans-serif initially; page titles 26–30 px, section titles 16–18 px, metric values 32–40 px, body 14–16 px, metadata 12–13 px. |
| Controls | Consistent primary/secondary/tertiary styles; approximately 40 px desktop control height with 44 px touch targets where practical; clear focus/hover/pressed/disabled states. |
| Icons | Existing Lucide family; usually 18–20 px with consistent stroke; accessible names on icon-only buttons. |
| Numbers | Tabular numerals; stable width; localize currency/dates using existing preferences. |
| Motion | Usually 140–220 ms for controls/panels, 180–260 ms for layout; short stagger only when helpful. Respect reduced motion and rapid repeated interaction. |

Starting light-theme palette for the Ocean option: canvas `#F4F6F9`, surface `#FFFFFF`, text `#14233B`, muted text `#59677B`, border `#E2E7EF`, accent `#2754C5`, deep accent `#102B63`. These are art-direction seeds, not a guarantee of contrast in every pairing. Validate actual states. Keep the existing navy/teal theme available and preserve existing users' light/dark/system preference.

Ocean/navy is the reference preview direction. For existing saved settings with no new accent field, preserve the familiar teal accent through a backward-compatible fallback. New users may default to Ocean. Add Teal, Ocean, Plum, and Ember as complete accent choices; exact names need not copy the reel.

Use semantic variables for canvas, raised surface, text, muted text, border, accent, accent-hover, accent-soft, accent-deep, focus, chart-current, and chart-previous. Provide light and dark values. Warning, danger, success, category, and overdue colors retain their meanings when the accent changes.

Apply a faint contour/line texture to at most one focus or featured surface using CSS/SVG. Keep normal cards quiet. Avoid decorative glass effects, large gradients on every card, stock photos, and unnecessary animated backgrounds.

## Today composition

Suggested desktop hierarchy:

```text
Persistent sidebar | Search / Quick Add / saving status / profile
                   | Today — concise date context + primary action
                   | Compact date/week controls + expandable attention summary
                   | Featured metric | Completed | Needs attention | Weekly consistency
                   | Next Up / selected-day schedule (wide) | Supporting trend / habits
                   | Continued useful schedule content     | Focus / upcoming
                   | Optional money, food, and health summaries when enabled
```

At 1280×720, meaningful task content must be visible without scrolling through a large introduction. At narrow widths the same priorities stack; do not shrink a desktop dashboard into unreadable cards.

Keep the first summary card dark. The focus card can use a related dark treatment lower in the hierarchy. Use differing spans only where content benefits; do not create empty space to imitate a screenshot's silhouette.

## Data contracts

- Use existing records and recurrence/calculation utilities. Build shared selectors for repeated metrics rather than storing duplicate derived counts in components.
- Define the scope beside each metric: selected day, previous dates, current week, or selected analytics range. Apply archive, module, member, and active-filter rules consistently wherever the same metric is shown.
- Suggested Today metric 1: commitments due on the selected day, using the app's existing eligible tasks and routine occurrences. Metric 2: completed commitments from exactly that set. Metric 3: needs attention, with an explicitly named overdue scope. Metric 4: weekly consistency using an existing documented completion/streak definition; use weekly commitments completion if habits are disabled. Never silently mix denominators.
- Preserve existing completion logic for routines, habits, bills, and other modules. Recurring occurrences require occurrence identity/date; a recurring series is not a single task completion.
- Empty denominators should show a clear empty/zero state rather than NaN or a misleading 100%. Round consistently.
- Tasks have `createdAt`, optional `completedAt`, optional due dates, and existing statuses. Due dates are not completion timestamps. Reopened tasks are not a complete historical event ledger. For missing history, label the limitation or show an empty trend; never invent past completions or time-spent figures.
- A comparison range must use comparable periods and identify incomplete current periods. Do not call count changes percentages without a defined denominator.
- Every create, edit, status change, undo, and delete must update the applicable list, board, calendar, badges, summary cards, and charts from the shared state.
- Animate true old-to-new values briefly. Do not reset metrics to zero on routine navigation or increment random demo numbers. Announce meaningful results, not every animation frame.

## Existing architecture to inspect and extend

| Area | Current location / constraint |
|---|---|
| Stack | React 19, TypeScript, Vite 8, Tailwind 4, Lucide. Keep the stack. |
| App shell | `src/App.tsx`, `src/components/layout/Sidebar.tsx`, `Header.tsx`, `MobileNav.tsx`, `MoreSheet.tsx`. |
| Shared styles | `src/index.css` already has surface/theme and motion primitives. Extend them. |
| State | `src/context/PlannerContext.tsx`; avoid a second planner store. |
| Models | `src/types/planner.ts`; backward-compatible additions only when required. |
| Persistence | `src/utils/storageCoordinator.ts` and existing backup validators; preserve atomic saving, tab coordination, recovery, and truthful save indicators. |
| Today | `src/components/today/TodayDashboard.tsx`; extract coherent pieces when needed, preserve calculations and actions. |
| Tasks | `src/components/tasks/TasksView.tsx`; retain List and Insights, add Board. |
| Dialogs | `src/components/ui/Modal.tsx` and its accessibility hook; preserve focus trapping, Escape, return focus, and validation. |
| Drawer | `src/components/ui/ContextualDetailPanel.tsx`; already used by tasks, calendar, and groceries. Extend this system. |
| Capture | `src/components/modals/QuickAddModal.tsx`; keep supported categories and direct module capture. |
| Calendar | `src/components/calendar/CalendarView.tsx`; preserve Month/Week/Day, recurrence and export behavior. |
| Focus | `src/components/modals/FocusModal.tsx`; existing 25-minute focus / 5-minute break countdown. A shared controller should drive modal and compact card. |
| Settings | `src/components/settings/SettingsView.tsx`, `src/utils/moduleRegistry.ts`; retain module/pinned tool and household behavior. |
| Other modules | Routines, goals, habits, inbox, money, food, health, setup, weekly review, support/data dialogs. Include them in the finish. |
| Samples | `src/utils/sampleData.ts`; generate relative dates only for explicitly loaded sample data. |
| Delivery | `scripts/build-standalone.mjs`, `scripts/package-delivery.mjs`, `public/sw.js`, `vite.config.ts`, existing deployment/setup docs. |

Verify file existence and current contents before relying on this map. This is a guide to entry points, not a requirement to force every implementation into those files.

## Functional details

**Tasks:** Board columns map directly to `not_started`, `in_progress`, `on_hold`, `completed`. Keep List. Drag requires a lifted representation, source placeholder, visible destination, cancellation, and reliable state update. A status menu/select must offer the same operation via keyboard and touch. Use meaningful task metadata; omit fictional comments and unsupported progress bars.

**Capture:** Contextual entry starts with the correct form. Keep global category switching. Use persistent labels, sensible focus, local validation, and protection from duplicate submission. New records use the current planner context. Confirmation follows actual successful state/storage handling; do not present a failed save as durable success.

**Drawers:** Retain the originating filter/scroll position. Coordinate enter and exit with focus/inertness and actual mount/unmount state. Reuse the shared drawer instead of creating visually similar independent implementations.

**Calendar:** Desktop month cells show short labels and `+N more` when needed; compact cells can use dots with usable detail access. Selected day, agenda and month navigation remain synchronized. Respect week start, time zone, all-day/scheduled events, and recurring occurrences.

**Focus:** Keep countdown semantics and break/reset actions. One shared session drives both UI surfaces. Prefer deriving running time from a target timestamp rather than assuming setInterval ticks are exact. Preserve session continuity across navigation, refresh and backgrounding; persist through a compatible session contract. Resolve cross-tab updates coherently. Do not add time analytics without actually recording valid sessions.

**Household:** Improve existing member initials, assignment filters, and relevant summaries. Solo mode should remain simple. A separate corporate-style team directory is outside scope unless a real planner need emerges.

**Settings:** Use local sections/navigation for General, Appearance, Household, Modules and Data; keep Support/Guide accessible. Accent choices update the entire app and persist through refresh and backup/restore. Preserve currency, units, week start, time zone, and edition behavior.

## Engineering boundaries

1. Improve this app in place. Do not generate a separate demo or replace working modules with placeholders.
2. Preserve stored records, IDs, recurrence, monetary/health calculations, backup restore, imports/exports, and enabled-tool preferences. UI migration must not reset storage.
3. Do not add authentication, paid services, analytics trackers, remote databases, or a backend for this UI request. Preserve truthful distinctions between local saving and any configured online behavior.
4. Prefer existing tools, CSS, SVG and small reusable components. A chart/drag library is acceptable only when needed, compatible, tested, and justified. Do not bulk-install a UI template or several overlapping component systems.
5. Verify current official documentation for any new dependency. Do not copy API examples from a different major version. Keep `package-lock.json` consistent.
6. Important: the current standalone builder takes the first emitted JS/CSS asset and inlines it. Extra chunks, imports, fonts, images, or external assets can break the HTML edition. Inspect the output and either maintain compatible bundling or deliberately extend packaging with verification. Do not simply assume a passing Vite build proves standalone compatibility.
7. Fonts and visual assets must work offline. Do not rely on a CDN for the finished interface. Keep reference files out of customer delivery artifacts.
8. Preserve existing tests. If a source-shape assertion becomes obsolete after a legitimate refactor, replace it with a check of equivalent behavior and explain why. Never delete/skip a failing assertion merely to report green.
9. Run checks appropriate to the phase. Add meaningful tests for new data/migration/interaction logic; do not create tests that only repeat styling implementation.
10. Avoid touching unrelated user changes. Review diffs and use local recoverable checkpoints. Do not deploy/publish or change remote services as part of this handoff.

## Evidence and completion protocol

For each phase:

1. Inspect the indicated source and reference images.
2. Implement the scoped result; resolve normal choices autonomously.
3. Run type checks and relevant existing/new tests.
4. Open the real app and exercise affected flows. Compare screenshots at consistent viewport, data state and theme.
5. Fix issues found, then save final evidence under `artifacts/premium-ui/phase-XX/`.
6. Update `STATUS.md`: changed files, checked flows, commands/results, screenshot paths, unresolved gaps, and next phase.
7. End with what works, evidence, and material limitations. Mark unrun checks as unverified.

Recommended visual coverage: 1440×900, 1280×720, 768×1024, 390×844; a narrow 320 px layout spot-check; light/dark, Ocean/Plum/legacy Teal, core-only/all-tools, populated/empty/long-content, reduced motion, keyboard-only, and 200% zoom where applicable. Test current shipped hosted and standalone behavior separately. Use a disposable demo browser profile/origin for fixtures; do not clear the user's working planner.

## Reference map

| Image | Evidence |
|---|---|
| `reference/frame-003.png` | Main dashboard: shell, metric row, mixed card spans. |
| `reference/frame-005.png` | Centered compact creation dialog. |
| `reference/frame-012.png` | Dark patterned timer and clear controls. |
| `reference/frame-019.png` | Task drag, destination and card hierarchy. |
| `reference/frame-026.png` | Filtered member grid. |
| `reference/frame-029.png` | Right detail drawer. |
| `reference/frame-037.png` | Calendar, day agenda, upcoming list. |
| `reference/frame-041.png` | Chart composition and summary cards. |
| `reference/frame-043.png` | Chart crosshair and tooltip. |
| `reference/frame-052.png` | Appearance selection. |
| `reference/frame-060.png` | Theme applied consistently to dashboard. |
| `reference/current-dashboard.jpg` | Current Today baseline. |
| `reference/current-tasks.jpg`, `current-insights.jpg` | Current task/analytics baseline. |
| `reference/current-quick-add.jpg`, `current-calendar.jpg`, `current-settings.jpg` | Current interaction/calendar/settings baselines. |

The original report describes movement between these stills. Camera zooms belong to the reel presentation, not to the product interaction specification.
