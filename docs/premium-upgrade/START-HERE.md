# Our Life Planner — Antigravity premium UI implementation guide

Prepared October 14, 2026 for the existing React planner. This package is an implementation handoff: it does not mean the redesigned product has already been built.

## 1. What you are trying to achieve

Bring the quality of the Fernly reel into Our Life Planner: a quieter navigation system, a persistent top bar, a composed dashboard, one dark featured summary card, useful charts, clear task information, compact creation dialogs, consistent drawers, coordinated color themes, and restrained motion.

Keep Our Life Planner's identity and real functionality. The finished experience should make personal and household planning clearer. Do not turn it into a fictional company project manager just to imitate the video.

The supplied [original analysis](reference/PREMIUM-UPGRADE-REPORT.md) covers the full 30-second visual sequence and 33 recommendations. The numbered phases below turn that analysis into implementation work.

## 2. What you need

- Antigravity installed and signed in, with Gemini 3.8 Flash (High) available in your account.
- This existing project folder, including `package.json`, `src`, `scripts`, `public`, and this guide.
- Node.js/npm and Git. They are already present in the inspected environment; let the baseline phase confirm their versions and compatibility instead of upgrading them unnecessarily.
- Browser tools enabled in Antigravity so the agent can open the local app, interact with it, and capture screenshots.
- A backup exported from the planner if you have personal data you need to keep. A Git commit saves code; it does not save data stored in your browser.

You do not need a Figma subscription, a backend rewrite, paid stock images, an image generator, or a new React project for this upgrade. Use existing Lucide icons and offline-compatible fonts/assets.

## 3. Open the correct folder and choose the model

Open this exact folder as the Antigravity project/workspace:

```text
C:\Users\Rida\Desktop\web app business\our-life-planner build
```

Do not open only the parent folder or create a fresh starter app. The source and package scripts are in `our-life-planner build`.

In the conversation model selector, choose **Gemini 3.8 Flash (High)**. If your interface separates model and reasoning effort, select Gemini 3.8 Flash and High. Google's documentation lists Gemini 3.8 Flash and places model selection below the prompt box; the CLI documentation confirms the exact High variant as `gemini-3.8-flash-high`. These names were checked on October 13, 2026. If the option is absent, check your installed version/account's available models rather than silently using a different model. [Models](https://antigravity.google/docs/models/) · [Exact model variant](https://antigravity.google/docs/cli/headless/)

High reasoning is a model setting; it is not a substitute for a written specification or visual checks.

Enable browser tools and complete the browser connection/setup requested by Antigravity. The IDE supports operating local Chrome and capturing screenshots/recordings; screenshots can be reviewed as artifacts. [Browser tools](https://antigravity.google/docs/ide/browser/) · [Screenshot review](https://antigravity.google/docs/screenshots/)

Use ordinary agent chat for the prompts below. In the Antigravity app, `/plan` can optionally be used for a separate design-plan review before execution. The prompts already specify a baseline phase, so this is optional. If you do use `/plan`, leave planning and choose Proceed before expecting implementation. [Planning](https://antigravity.google/docs/plan/)

This guide uses plain Markdown prompts, not custom slash-command workflows. Google currently says the existing IDE workflow system will stop working on October 19, 2026. [Workflow notice](https://antigravity.google/docs/ide/workflows/)

## 4. Give Gemini the right evidence

Everything required for the handoff is inside `docs/premium-upgrade/`:

| File/folder | Purpose |
|---|---|
| [MASTER-BRIEF.md](MASTER-BRIEF.md) | Product scope, visual targets, engineering constraints, and completion rules. |
| [prompts](prompts/00-baseline.md) | Eleven ready-to-use phase prompts, numbered 00–10. |
| [ACCEPTANCE.md](ACCEPTANCE.md) | The 33 recommendations mapped to implementation phases, plus functional and visual checks. |
| [STATUS.md](STATUS.md) | Handoff memory: completed phases, evidence, failures, and next actions. Initially every phase is pending. |
| [reference/PREMIUM-UPGRADE-REPORT.md](reference/PREMIUM-UPGRADE-REPORT.md) | Full reel analysis and comparison with the current product. |
| `reference/frame-*.png` | Eleven actual reference frames from the reel. |
| `reference/current-*.jpg` | Six screenshots of the existing planner for before/after comparison. |

The frame mapping is in the master brief. Tell the agent to **open and inspect the images**, not merely read their filenames. If its image-reading tools cannot open a local frame, attach that frame to the conversation. The Instagram link alone is insufficient if login or playback blocks access.

These frames are design evidence, not product assets. Do not embed Fernly's screenshots, branding, fictional people, or project names in the shipped planner.

## 5. Start with this exact message

Paste this into Antigravity after opening the project:

```text
We are upgrading the existing Our Life Planner in this workspace.

Read:
1. docs/premium-upgrade/MASTER-BRIEF.md
2. docs/premium-upgrade/ACCEPTANCE.md
3. docs/premium-upgrade/STATUS.md
4. docs/premium-upgrade/reference/PREMIUM-UPGRADE-REPORT.md
5. docs/premium-upgrade/prompts/00-baseline.md

Open and visually inspect the reference and current screenshots named in phase 00.
Execute phase 00 completely: inspect the real app and architecture, establish a
recoverable baseline, run the baseline checks, and write the implementation plan
and evidence into this package. Do not change runtime UI in phase 00.

Use the supplied design direction and make routine decisions yourself. Ask only
for a real blocker. Preserve personal data, existing business logic, local saving,
backup/restore, and both the hosted/PWA and standalone offline editions.

Finish with the baseline result, the proposed Today layout, and the exact next
phase. Do not claim that the premium UI is implemented yet.
```

Phase 00 is deliberately a baseline. The first visible implementation is phase 01; the main dashboard composition appears in phase 02.

## 6. Implement in this order

For each phase, paste the entire linked prompt, or use the short launcher below with its exact filename. Let Gemini finish implementation and verification before sending the next phase.

| Phase | Prompt | Result to inspect |
|---|---|---|
| 00 | [Baseline](prompts/00-baseline.md) | Current screenshots, baseline test results, checkpoint, code map, implementation plan. |
| 01 | [Foundations and shell](prompts/01-foundations.md) | Narrower grouped navigation, refined header, shared type/spacing/surface/button tokens. |
| 02 | [Today dashboard](prompts/02-today.md) | Four clear metrics, one dark featured card, better grid, useful content above the fold. |
| 03 | [Tasks and Board](prompts/03-tasks.md) | Refined List plus functional Board using existing task statuses. |
| 04 | [Charts and metrics](prompts/04-insights.md) | Real-data charts, ranges, accessible inspection, consistent figures. |
| 05 | [Creation and drawers](prompts/05-capture-and-details.md) | Focused Quick Add, coordinated save feedback, consistent accessible detail panels. |
| 06 | [Calendar](prompts/06-calendar.md) | Event labels, selected-day agenda, upcoming items, preserved date behavior. |
| 07 | [Focus timer](prompts/07-focus.md) | Compact dark focus card connected to the existing countdown and break flow. |
| 08 | [Settings and all modules](prompts/08-themes-and-modules.md) | Persistent accents, organized Settings, the same quality across every enabled module. |
| 09 | [Motion, responsive states, demo](prompts/09-polish.md) | Coherent transitions, mobile layouts, edge states, useful sample dates. |
| 10 | [Final verification and delivery](prompts/10-release.md) | Verified build, offline HTML and ZIP, before/after evidence, final gap report. |

Short launcher — change the filename for each phase:

```text
Read MASTER-BRIEF.md, ACCEPTANCE.md, and STATUS.md in docs/premium-upgrade/.
Then execute docs/premium-upgrade/prompts/01-foundations.md completely.
Implement the scoped changes, run relevant checks, inspect the actual browser
result, fix defects, and update STATUS.md with evidence and remaining issues.
Do not finish with a plan only. Do not start the next phase in this turn.
```

Keep phases 01 and 02 in the same conversation where practical. Check the dashboard direction after phase 02, before spreading its patterns to every screen. Later phases may use new chats with the resume prompt below.

The checkpoint is a way for you to steer the result, not a requirement to approve every CSS change. Within each phase the agent should implement, inspect, and repair autonomously.

## 7. How to review the result

After phase 02, open the live page. Compare it with `reference/frame-003.png` at a similar desktop viewport. Evaluate composition, not whether the fictional numbers match.

- At 1280 × 720, can you see the page identity, four key metrics, and meaningful tasks without first scrolling through large toolbars?
- Is one summary card clearly emphasized while other cards remain quiet?
- Do the title, value, task text, and metadata have different visual weights?
- Do card edges, gutters, control heights, and icon sizes align?
- Is whitespace deliberate, with useful information instead of huge empty panels?
- Does the page still feel like a personal planner?

If the result is too generic, give measurable feedback. For example:

```text
Refine the current Today screen before moving on. At 1280x720 the toolbar is
still too tall and the first task starts too low. Compress the overdue summary,
remove the extra outlined container around the heading, align the four metric
cards, and give only the first metric a deep navy surface. Keep task text readable.
Inspect reference/frame-003.png again, capture the updated screen, and compare it
with the prior screenshot. Preserve the functioning controls and calculations.
```

After phase 03, create a task, move it on the board, and verify List and summary figures. After phase 08, change accent and visit every module in light/dark modes. After phase 10, inspect the actual generated offline file as well as the dev website.

Use screenshots for layout; use the live app or a short recording for save feedback, drag, timer behavior, keyboard navigation, and transitions. A still image cannot verify an interaction.

## 8. Working commands

Gemini should normally run these itself. They are included so you can recognize and reproduce the checks. Run from the project root in PowerShell.

```powershell
Set-Location -LiteralPath 'C:\Users\Rida\Desktop\web app business\our-life-planner build'
node --version
npm.cmd --version
git status --short
```

If dependencies are missing, install the lockfile versions:

```powershell
npm.cmd ci
```

Start development on a free local port. Check what is already running first. Port 3001 was used for the earlier preview; using a different port creates a different browser-storage origin.

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 3001
```

Use the URL Vite actually prints. Leave that terminal running while viewing the app. Do not terminate unrelated development servers to take their port.

Run a quick type check after a meaningful phase:

```powershell
npm.cmd run lint
```

In this repository, `lint` runs `tsc --noEmit`; it is a TypeScript check, not a visual or interaction test.

The complete release command is:

```powershell
npm.cmd run verify
```

It runs type checking, production build, packaging, and the configured test suites. The current runner enumerates 25 suites. The agent must inspect the scripts and preserve important existing delivery outputs before baseline/final runs because the build and package steps regenerate files.

Current output paths include:

```text
dist/Our-Life-Planner-Offline.html
dist/Our-Life-Planner-v1.0.0-Delivery.zip
```

Use the version and actual output paths produced by the current packaging script if they change. Opening localhost successfully is not proof that the standalone file works offline.

## 9. Recover or continue without losing context

At the end of every phase the agent should update `STATUS.md` and save screenshots/check results. Use local Git checkpoints after checking the diff; avoid blanket staging of secrets, personal backups, or unrelated files. A local checkpoint is enough; publishing to GitHub is not required.

If you start a new chat, paste:

```text
Continue the existing Our Life Planner premium upgrade. Read
docs/premium-upgrade/MASTER-BRIEF.md, ACCEPTANCE.md, STATUS.md, and the latest
implementation plan/evidence. Inspect git status and the current source before
editing. Resume the first incomplete phase listed in STATUS.md. Preserve completed
work and unrelated edits. Implement, verify in the browser, and update the handoff.
Do not restart the application from a new template.
```

If a phase breaks behavior, paste:

```text
Stop adding features. Investigate the regression introduced in the current phase.
Reproduce it, compare with the saved baseline and diff, fix the cause, and run the
relevant checks. Keep the accepted design work. Do not reset the entire repository,
clear planner data, or disable tests. Record the cause and verified fix in STATUS.md.
```

If browser tools cannot run, the agent should still complete code checks and give exact manual reproduction steps. It must label visual checks as unverified, not mark the whole phase visually passed.

## 10. Definition of ready

The upgrade is ready only when all applicable items in `ACCEPTANCE.md` pass, every existing module uses the new design system, the core data workflows still work, all release checks pass, and both delivery editions have been opened and exercised. Any failed or unverified requirement belongs in the final report.

Expect several implementation and review cycles. Model effort alone does not guarantee the finish: clear reference images, controlled scope, consistent components, and real browser verification are the tools that make the result reach the target.
