# Phase 01 — design foundations and persistent shell

Read `docs/premium-upgrade/MASTER-BRIEF.md`, `ACCEPTANCE.md`, `STATUS.md`, and the implementation plan. Inspect the actual images `reference/frame-003.png`, `frame-060.png`, and `current-dashboard.jpg`. Implement this phase, not just a proposal.

Start with `src/index.css`, `src/App.tsx`, and the layout components. Preserve existing navigation, module selection, search, Quick Add, saving state, profile, mobile navigation, and keyboard behavior.

- Introduce or consolidate semantic design tokens for spacing, type, surfaces, borders, radius, shadow, accents and focus states. Extend existing tokens instead of layering a second conflicting system.
- Build a small set of reusable primitives where repetition warrants them: page heading, metric card, card heading, segmented control and standardized button styles. Avoid a large abstraction framework.
- Refine the desktop sidebar toward 220 px. Group enabled tools into useful planner categories; keep labels and active indicators. Honor pinned tools and hidden modules. Keep Settings and important utilities accessible with all modules enabled.
- Refine the persistent top bar around search, Quick Add, honest saving status and profile. Reduce duplicate profile/storage emphasis. Keep each page's title in the content area.
- Establish readable typography and shared gaps/control heights. Simplify containers around page headings/toolbars. Preserve the recognizable navy/teal identity while preparing accent roles for phase 08.
- Keep mobile navigation usable and avoid global horizontal overflow. Sidebar transitions must not cover the main interaction or trap focus incorrectly.

Inspect desktop at 1440x900 and 1280x720, mobile at 390x844, and both core-only/all-module navigation. Check light/dark mode, long owner/module labels, keyboard focus, search and Quick Add. Run `npm.cmd run lint` and the relevant navigation/module/accessibility checks identified in phase 00. Fix regressions before finishing.

Save before/after evidence under `artifacts/premium-ui/phase-01/` and update `STATUS.md` with exact checks and changed files. Do not claim the whole redesign is finished. The completion gate is a cohesive functioning shell and reusable foundation, ready for Today.
