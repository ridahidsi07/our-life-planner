# Phase 05 — focused creation and consistent detail panels

Read the master brief, acceptance checklist and status. Open `reference/frame-005.png`, `frame-029.png`, and `current-quick-add.jpg`. Inspect `QuickAddModal.tsx`, `Modal.tsx`, `ContextualDetailPanel.tsx`, and their callers before changing them.

- Preserve all supported Quick Add categories and each module's capture flow. Contextual creation starts on the relevant form; global Quick Add retains category choice.
- Refine the existing centered dialog: concise title/helper, persistent field labels, correct initial focus, primary required fields first, optional fields progressively disclosed, aligned Cancel/Save actions. Let actual form complexity determine height; do not force every form into a two-field template.
- Keep inline validation and entered values on failure. Prevent repeated submission. Integrate truthful saving state rather than presenting a failed durable save as success.
- On successful creation, update all relevant state, show concise feedback, reveal or highlight the new item when visible, and provide an explicit way to view it if current filters hide it. Do not silently change the user's filters. Use Undo for suitable reversible actions, with state derived from the same records.
- Refine the existing shared drawer for tasks, calendar and groceries: clear sections, useful footer actions, consistent width/backdrop and coordinated entry/exit. Preserve the originating list/filter/scroll position.
- Retain focus trap, Escape, close control, return focus, scroll locking, accessible names and correct behavior when dialogs overlap or a trigger disappears. Exit animations must not create a period with invisible interactive content or broken focus.
- Long forms scroll within the available viewport; actions remain reachable at mobile sizes and 200% zoom. Dirty-form behavior should be consistent with the existing app.

Exercise every Quick Add category, required-field errors, rapid double submission, save failure if safely simulatable, keyboard-only operation, cancel/reopen, drawer edit/save/close, and creation hidden by a filter. Use disposable records. Run existing dialog/interaction checks and type checks; add tests only for meaningful new behavior.

Save screenshots and interaction evidence to `artifacts/premium-ui/phase-05/`. Update `STATUS.md` with verified categories and any unresolved cases.
