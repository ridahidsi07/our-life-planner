# Antigravity prompt — phase 01 correction pass

Paste the following into Antigravity, with the existing project open:

```text
Continue Our Life Planner on the existing premium-ui-upgrade branch.

Read:
- docs/premium-upgrade/PHASE-00-01-REVIEW.md
- docs/premium-upgrade/MASTER-BRIEF.md
- docs/premium-upgrade/ACCEPTANCE.md
- docs/premium-upgrade/STATUS.md

Inspect current Git status/history first. Phases 02, 03 and 04 already exist.
Preserve their implementation and any unrelated work. Do not reset to phase 01,
rebuild the project, or start phase 05 during this correction pass.

Implement the following fixes completely:

1. Header responsiveness (R1)
   Make the greeting/name containers shrink correctly while reserving room for
   search, Quick Add, saving status and profile. Fix sidebar profile overflow too.
   Reproduce with owner name "Alexandria Catherine Montgomery-Wellington" at
   768x1024. Verify short/long names at 390, 768, 1024, 1280 and 1440 px widths.
   Keep all important controls reachable, with no page/sidebar horizontal overflow.

2. SegmentedControl keyboard behavior (R2)
   The shared primitive currently removes inactive tabs from Tab navigation without
   implementing arrow keys. Use a complete keyboard-accessible interaction model.
   If keeping tabs, implement ArrowLeft/ArrowRight and Home/End focus movement,
   consistent activation, roving tabindex, and appropriate panel relationships.
   If the intended usage is not tab panels, use correct button-group semantics
   instead. Prove every option is keyboard reachable and selectable in a focused
   component interaction test. This primitive is currently unused in production;
   do not unnecessarily replace the working Tasks tabs to demonstrate the fix.

3. Sidebar section-label contrast (R3)
   Replace faint Plan/Growth/Money/Food/Health/Favorites label colors with semantic
   text roles meeting at least 4.5:1 contrast against their actual light/dark
   surfaces. Keep the visual hierarchy restrained and readable. Measure actual
   computed colors; do not use a screenshot-only guess or reduce opacity afterward.

4. Verification and handoff corrections (R4)
   Replace the duplicate keyboard-focus evidence with a real Tab-navigation capture
   and assertions for the focused element and visible focus state. Correct the
   nonexistent prompts/05-drawers.md path in STATUS.md to
   prompts/05-capture-and-details.md. Record exactly which checks were run.

Validate on the current branch after the fixes:
- Type check and production/standalone build.
- Existing module-visibility, dialog-accessibility, backup and tab-sync checks.
- Focused regression checks for header containment and segmented keyboard behavior.
- Browser review in light/dark, core-only/all-tools, normal/long-name states and
  the listed viewport widths. Check 200% zoom and keep current mobile navigation.
- Smoke-check the existing Today, Board and Insights screens for regressions.

Do not disable failing tests or weaken assertions to produce a pass. If a legitimate
refactor changes a structural assertion, preserve the equivalent behavior check.

Save screenshots and results under artifacts/premium-ui/phase-01-corrections/.
Update STATUS.md and the acceptance checklist with verified results and limitations.
Create a reviewed local checkpoint containing only the intended corrections/evidence.
Do not deploy, merge, or publish remotely.

Finish with what changed, the results and remaining gaps. Identify phases 02–04 as
the next review target; phase 05 is the next planned feature after that review.
Implement and verify this correction pass; do not finish with a plan only.
```
