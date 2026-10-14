# Phase 08 — complete themes, organized Settings, consistent modules

Read the master brief, acceptance checklist and status. Inspect `reference/frame-052.png`, `frame-060.png`, `frame-026.png`, and `current-settings.jpg`. Inspect settings models/defaults/validators, storage, module registry and every existing product screen.

- Organize Settings into clear local sections: General, Appearance, Household, Modules and Data. Preserve existing controls, support/guide access, edition behavior, units, currency, week start and time zone. Make local navigation work on small screens and through a keyboard.
- Implement Teal, Ocean, Plum and Ember accent choices through semantic roles, with coordinated light/dark values. Preserve existing users' theme preference and familiar Teal fallback when no accent was stored; use the planned default for new users.
- Accent selection must affect navigation, buttons, highlighted cards, charts, progress, links, selected states, focus indicators and dialogs. Avoid brute-force replacement of warning/error/success/category colors.
- Update type definitions, defaults, validators and backup/restore handling for new preference fields. Round-trip both an old backup without the field and a new backup with it. An invalid saved accent should fall back safely.
- Improve existing household initials/assignment filters and useful summaries; keep solo mode uncomplicated. Filter results preserve identity and show a clear empty state.
- Carry the design system through Routines, Goals, Habits, Inbox, Budget & Bills, Savings, Debt Payoff, Meals, Groceries, Workouts, Weight/BMI and Hydration. Include setup, search, weekly review, backup/restore, offline download, conflict, support and guide dialogs. Inventory actual available screens first.
- Preserve each module's substantive workflows, calculations and data. Refine headings, rows, cards, forms, tables, empty states and controls; do not replace working modules with summary placeholders.

This phase may require several work sessions. Track each screen as pending/implemented/verified in `STATUS.md` so a completed Settings screen does not hide unfinished modules. Work through bounded groups while retaining the same tokens.

Verify theme changes across the whole app, refresh, old/new backups, core-only/all-tools, solo/household, light/dark/system and mobile. Run type checks and affected backup/module/domain tests. Capture representative before/after screens plus a module coverage table under `artifacts/premium-ui/phase-08/`. Mark the phase complete only when the inventory is covered.
