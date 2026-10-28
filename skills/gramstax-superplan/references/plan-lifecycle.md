# Plan Lifecycle For Gramstax Apps

Protocol for creating a plan, changing a running plan, reviewing it, resuming work, and handing it to `superbuild` or a manual execution loop.

## Mode Selection

| Situation | Mode | Do not |
| --- | --- | --- |
| No plan exists | CREATE | Write code first |
| Scope, design, tasks, or tests changed | REFINE | Rewrite completed history |
| Plan is about to be executed | REVIEW | Assume the plan is still current |
| Work resumed after a pause or compact | RESUME | Re-plan from memory |
| Implementation differs from the plan | RECONCILE | Mark phases complete without evidence |
| Plan is approved | HANDOFF | Execute from this skill |

If the request is a one-line fix or a known-path edit, skip this skill and do the work.

## CREATE

1. **Intake.** Capture the request verbatim. Classify it: greenfield, page, flow, config/deploy, data, worker, test, refactor, upgrade, or docs.
2. **Load app truth.** Read `package.json` when present, `gramstax.config.ts`, `README.md`, any `AGENTS.md`, env variable names from `.env.example`/config/README (never read secret values), the relevant `src/` files, `e2e/`, `test/`, and the existing `plans/`.
3. **Classify context.** Greenfield, existing app adopting Gramstax, generated app, standalone app, ecosystem integration, or framework repo. If the project root has a root `package.json` plus `packages/gramstax`, stop and use `gramstax-repo-superplan`; a nested `real-projects` app does not count. For greenfield, read `references/greenfield.md` and confirm the `create-gramstax` path. For an existing app, plan `bun add gramstax` and incremental adoption instead of a scaffold.
4. **Load best practices.** Read `references/best-practices.md`; load `gramstax-best-practices` for pages/templates/config/e2e, `lmdb-best-practices` for LMDB, and `worker-thread-best-practices` for workers. Record the sections used.
5. **Grill.** Follow `references/grilling.md` until the frontier is empty and the user confirms shared understanding.
6. **Explore.** Use read-only agents to find existing pages, guards, blocks, data flows, worker patterns, and tests. Record file paths and line numbers.
7. **Design.** Name the route flow, page/template/keyboard changes, config/deploy path, data/state, worker lifecycle, tests, docs, and dependency compatibility.
8. **Phase.** Split into independently testable phases. Assign estimates, dependencies, parallel lanes, write scopes, and validation owners. A greenfield plan starts with scaffold and baseline phases.
9. **Review.** Run the checklist in `references/plan-review.md` before saving.
10. **Number.** Use the highest existing number in `plans/` + 1, zero-padded to three digits. Never renumber existing plans. If `plans/` does not exist, create it. For greenfield, keep the plan in the parent and move it after scaffold, or grill first and write it inside the new app; see `references/greenfield.md`.
11. **Write.** Use `references/plan-template.md` and save as `plans/NNN-feature-slug/plan.md`.
12. **Confirm.** Present the context classification, phase table, total estimate, open questions, and execution options.

A new plan starts as `Draft` unless the user explicitly approves it in the same turn. Do not mark it `Approved` on the user's behalf.

## REFINE

Changing a plan is a first-class task, not a rewrite.

### 1. Classify the change

| Change | Update |
| --- | --- |
| Scope / MVP | Goals, non-goals, acceptance criteria, phase list |
| Bootstrap / greenfield | Scaffold command, feature flags, plan placement, baseline gates |
| Page / flow / template | Architecture, task file lists, e2e mirror, tests |
| Config / deploy | Config, env, deploy notes, smoke tests |
| Data / worker | Schema/migration or lifecycle, tests, compatibility |
| Verification | Test matrix, DoD, commands, evidence |
| Best-practice rule | Re-read the relevant skill section and update affected tasks |
| Dependency / version | Version facts, compatibility, migration plan |
| Execution drift | Statuses, deviations, follow-ups, execution report |
| Documentation only | README, env documentation, release notes |

### 2. Preserve history

- Do not delete completed tasks or rewrite what happened.
- If a completed decision is reversed, add a new decision row and a change-log entry; do not erase the old rationale.
- If a phase is structurally replaced, mark it `⏭️ Skipped` or `Superseded` with the reason and link to the replacement.
- Never mark a phase complete because the plan was edited. Completion requires execution evidence.

### 3. Apply the minimal diff

Use targeted edits, not a full regeneration. Update in this order:

1. Header: `Last Updated`, status, framework/dependency versions.
2. Goals / non-goals / acceptance criteria.
3. Key decisions and clarifications.
4. Architecture and app file lists.
5. Phase table and affected phase details.
6. Test matrix and Definition of Done.
7. Change log.
8. Execution handoff.

### 4. Re-evaluate downstream work

Ask:

- Does this invalidate a later phase's assumptions?
- Does it change a write scope or create a parallel conflict?
- Does it change a page route, callback, session, or e2e mirror?
- Does it change a config/deploy, schema, or worker lifecycle?
- Does it make a completed phase's evidence stale?
- Does it require a new grilling round?

If a downstream phase is unstarted, change it. If it is in progress, stop the active writer before editing its task. If it is complete, record the deviation instead of pretending it was always planned.

### 5. Change-log entry

Every REFINE and RECONCILE adds one row:

```markdown
| 2026-10-27 | REFINE | Add fallback message when the subscription expires | 2, 4 | User confirmed the expired-link path; Phase 2 gains a guard test |
```

The row must state **what changed**, **why**, and **which phases** are affected.

### 6. Output

Report:

- Plan path and old/new status.
- Context classification and framework version.
- Sections changed.
- Phases re-opened, re-sequenced, or marked blocked.
- New open questions.
- Whether the plan is still executable by the selected workflow.

## REVIEW

Review the plan against the app, not against your memory.

### Checklist

- [ ] Request is captured verbatim.
- [ ] App context is classified.
- [ ] Greenfield plans name the scaffold command, feature flags, and baseline gates.
- [ ] Relevant best-practice skill(s) and sections are recorded.
- [ ] Goals and non-goals are explicit.
- [ ] Acceptance criteria are observable and testable.
- [ ] Every task has exact app paths and a test or verifier.
- [ ] Every code task has RED/GREEN evidence.
- [ ] Every phase has a Definition of Done.
- [ ] Estimates are Fibonacci and no phase is `21`.
- [ ] Parallel phases have disjoint write scopes and validation owners.
- [ ] No task edits `node_modules`, `.gramstax`, or runtime data.
- [ ] Framework/dependency versions are recorded.
- [ ] Page changes include the e2e mirror.
- [ ] Config/deploy changes include a start/build smoke.
- [ ] Data changes include restart/migration coverage.
- [ ] Worker changes include startup failure and shutdown coverage.
- [ ] Public-facing app behavior changes include compatibility/release impact.
- [ ] Risks, assumptions, and Known Unknowns are recorded.
- [ ] The plan is executable by `superbuild` or the manual loop.
- [ ] The plan has a change log and a handoff section.

### Findings Format

```markdown
## Plan Review: <plan>

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| BLOCKER | Page rename has no e2e mirror update | plan lines 120–150 | Add `e2e/<page>.test.ts` |
| HIGH | Task 3.2 edits installed framework source | plan lines 180–194 | Use a public extension point or upstream |
```

Do not rewrite a plan during REVIEW unless the user asks for changes. If asked, switch to REFINE and log the changes.

## RESUME

1. Read the plan and `execution-report.md` if present.
2. Identify the last verified phase and the current in-progress phase.
3. Re-run the narrow app verification for that phase if the workspace may have changed.
4. Check for uncommitted work, new files, changed dependency versions, or a different branch state.
5. Report:
   - Last verified phase and evidence.
   - Current blocker, if any.
   - Next phase and its write scope.
   - Checks that must run before continuing.
6. If the plan and reality disagree, switch to RECONCILE before executing.

Do not assume the plan is current because it exists. Do not auto-continue a phase that was not explicitly resumed.

## RECONCILE

Use when implementation has drifted, a phase was partially done, or a prior agent's claims need verification.

1. Compare each completed phase's planned files and tests with the actual app tree.
2. Read the artifacts; do not trust a summary.
3. Run the phase's narrow checks.
4. Classify each difference:
   - **Planned and verified:** mark complete.
   - **Planned but incomplete:** mark in progress/blocked.
   - **Unplanned but necessary:** add a task and a change-log row.
   - **Unplanned and unnecessary:** record as out of scope.
   - **Stale plan claim:** correct the plan, do not preserve a false statement.
5. Update the execution report with evidence and next action.

## HANDOFF

The plan is ready only when the REVIEW checklist passes and the user confirms.

### Handoff Prompt

```text
Use superbuild for this plan when available; otherwise execute it phase by phase.

Plan: plans/NNN-feature-slug/plan.md
Mode: phase-by-phase | --build-all | manual
Start: Phase <N>
Stop after: <phase or complete>
Parallel lanes: <lanes and disjoint write scopes>
Validation owner: <lane/agent>
Final gate: <app test/build commands from package.json>
Commit policy: <do not commit | generate message only | user asked for commit>

Rules:
- Update the plan after every phase.
- Run fresh verification; do not trust prior output.
- Do not edit node_modules, .gramstax, or runtime data.
- Do not skip a failed Definition of Done.
- Stop if a write scope conflicts with another lane.
```

### Handoff Preconditions

- [ ] Plan status is `Approved` or the user explicitly asked to execute a draft.
- [ ] The relevant best-practice skill(s) and sections are recorded.
- [ ] No open frontier questions.
- [ ] Every phase has a DoD and a CHECKPOINT.
- [ ] Greenfield plans have a passing scaffold baseline before customization phases.
- [ ] Parallel phases have disjoint write scopes.
- [ ] The final gate uses app scripts that exist.
- [ ] The commit policy is stated.

If `superbuild` is not installed, the handoff becomes a manual phase-by-phase checklist with the same DoD and stop conditions. Do not weaken the gate just because the executor is manual.

## Execution Report

Save to `plans/NNN-feature-slug/execution-report.md`.

```markdown
# Execution Report: <Feature>

**Plan:** `plans/NNN-feature-slug/plan.md`
**Context:** greenfield / existing app adopting Gramstax / generated app / standalone / ecosystem integration
**Framework:** `gramstax <version>`
**Started:** YYYY-MM-DD
**Last Updated:** YYYY-MM-DD
**Status:** in progress | complete | blocked

## Verified Phases

| Phase | Status | Unit | E2E | Typecheck | Lint | Build | Commit message |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | complete | pass | pass | pass | pass | — | `feat(scope): summary` |

## Deviations

| Planned | Actual | Reason | Plan change |
| --- | --- | --- | --- |
| <planned> | <actual> | <why> | <link/section> |

## Resume From

<next phase, blocker, or "complete">
```

The execution report is evidence, not a diary. Keep it short and verifiable.

## Status Transitions

- `Draft` → `In Review` after the plan is written.
- `In Review` → `Approved` after user review.
- `Approved` → `In Progress` when execution starts.
- `In Progress` → `Complete` only when all phases and the final gate pass.
- Any state → `Blocked` when a dependency, decision, or external constraint stops progress.
- Any state → `Superseded` when a new plan replaces it; link the replacement.

## Anti-Patterns

- Rewriting the whole plan to hide a small change.
- Marking a phase complete because a task checkbox was edited.
- Re-planning without re-grilling a changed branch.
- Planning page/template work without reading `gramstax-best-practices`.
- Creating `plans/` in an empty target and then trying to scaffold in place.
- Passing `.` to `create-gramstax` instead of using a name or the interactive empty-name flow.
- Editing a phase while a writer is still active.
- Adding a parallel phase that touches the same files.
- Treating a subagent summary as verification.
- Editing installed packages instead of the app.
- Handing off a plan with unresolved questions or missing app commands.
