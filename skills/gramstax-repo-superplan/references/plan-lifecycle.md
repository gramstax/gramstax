# Plan Lifecycle

This is the protocol for creating a plan, changing a running plan, reviewing one, resuming work, and handing it to `superbuild`.

## Mode Selection

| Situation | Mode | Do not |
| --- | --- | --- |
| No plan exists | CREATE | Write code first |
| Scope, architecture, tasks, or tests changed | REFINE | Rewrite completed history |
| Plan is about to be executed | REVIEW | Assume the plan is still current |
| Work resumed after a pause or compact | RESUME | Re-plan from memory |
| Implementation differs from the plan | RECONCILE | Mark phases complete without evidence |
| Plan is approved | HANDOFF | Execute from this skill |

If the request is a one-line fix or a known-path edit, skip this skill and do the work.

## CREATE

1. **Intake.** Capture the request verbatim. Classify it: feature, refactor, migration, bug fix, docs, release.
2. **Load truth.** Root `AGENTS.md`, package `AGENTS.md`, `CONTEXT-MAP.md`, relevant READMEs, and the existing plan directory.
3. **Grill.** Follow `references/grilling.md` until the frontier is empty and the user confirms shared understanding.
4. **Explore.** Use read-only agents to find patterns, integration points, and debt. Record file paths and line numbers.
5. **Design.** Name the public surface, runtime/deploy path, data/state, tests, docs, and release constraints.
6. **Phase.** Split into independently testable phases. Assign estimates, dependencies, parallel lanes, write scopes, and validation owners.
7. **Review.** Run the checklist in `references/plan-review.md` before saving.
8. **Number.** Use the highest existing number in `plans/` + 1, zero-padded to three digits. Never renumber existing plans.
9. **Write.** Use `references/plan-template.md` and save as `plans/NNN-feature-slug/plan.md`.
10. **Confirm.** Present the phase table, total estimate, open questions, and execution options.

A new plan starts as `Draft` unless the user explicitly approves it in the same turn. Do not mark it `Approved` on the user's behalf.

## REFINE

Changing a plan is a first-class task, not a rewrite.

### 1. Classify the change

| Change | Update |
| --- | --- |
| Scope / MVP | Goals, non-goals, acceptance criteria, phase list |
| Architecture / API | Architecture, public surface, task file lists, tests |
| Task order / dependency | Phase table, dependencies, parallel scopes, CHECKPOINTs |
| Verification | Test matrix, DoD, commands, evidence |
| Execution drift | Statuses, deviations, follow-ups, execution report |
| Documentation only | Docs references, scanners, release notes |

### 2. Preserve history

- Do not delete completed tasks or rewrite what happened.
- If a completed decision is reversed, add a new decision row and a change-log entry; do not erase the old rationale.
- If a phase is structurally replaced, mark it `⏭️ Skipped` or `Superseded` with the reason and link to the replacement.
- Never mark a phase complete because the plan was edited. Completion requires execution evidence.

### 3. Apply the minimal diff

Use targeted edits, not a full regeneration. Update in this order:

1. Header: `Last Updated`, status.
2. Goals / non-goals / acceptance criteria (if scope changed).
3. Key decisions and clarifications.
4. Architecture and file lists.
5. Phase table and affected phase details.
6. Test matrix and Definition of Done.
7. Change log.
8. Execution handoff.

### 4. Re-evaluate downstream work

Ask:

- Does this invalidate a later phase's assumptions?
- Does it change a write scope or create a parallel conflict?
- Does it change a test, smoke command, or release note?
- Does it make a completed phase's evidence stale?
- Does it require a new grilling round?

If a downstream phase is unstarted, change it. If it is in progress, stop the active writer before editing its task. If it is complete, record the deviation instead of pretending it was always planned.

### 5. Change-log entry

Every REFINE and RECONCILE adds one row:

```markdown
| 2026-10-27 | REFINE | Add automatic `.env*` loading before config import | 2, 4 | User confirmed env precedence; Phase 2 gains `cli/env.ts` |
```

The row must state **what changed**, **why**, and **which phases** are affected.

### 6. Output

Report:

- Plan path and old/new status.
- Sections changed.
- Phases re-opened, re-sequenced, or marked blocked.
- New open questions.
- Whether the plan is still superbuild-ready.

## REVIEW

Review the plan against the repository, not against your memory.

### Checklist

- [ ] Request is captured verbatim.
- [ ] Goals and non-goals are explicit.
- [ ] Acceptance criteria are observable and testable.
- [ ] Every task has exact file paths and a test or verifier.
- [ ] Every code task has RED/GREEN evidence.
- [ ] Every phase has a Definition of Done.
- [ ] Estimates are Fibonacci and no phase is `21`.
- [ ] Parallel phases have disjoint write scopes and validation owners.
- [ ] No task edits generated docs.
- [ ] Runtime claims match the current Bun-only app policy.
- [ ] Package-specific rules match the package `AGENTS.md`.
- [ ] Test commands actually exist in `package.json` or the package.
- [ ] Public API changes include compatibility and release impact.
- [ ] Risks, assumptions, and Known Unknowns are recorded.
- [ ] The plan is still compatible with `superbuild`.
- [ ] The plan has a change log and a handoff section.

### Findings Format

```markdown
## Plan Review: <plan>

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| HIGH | Phase 2 edits generated reference docs | `docs-site/reference/...` | Hand-edit the source TSDoc and regenerate |
| MEDIUM | Task 3.2 has no test | plan lines 180–194 | Add RED/GREEN steps or a scanner |
```

Do not rewrite a plan during REVIEW unless the user asks for changes. If asked, switch to REFINE and log the changes.

## RESUME

1. Read the plan and `execution-report.md` if present.
2. Identify the last verified phase and the current in-progress phase.
3. Re-run the narrow verification for that phase if the workspace may have changed.
4. Check for uncommitted work, new files, or a different branch state.
5. Report:
   - Last verified phase and evidence.
   - Current blocker, if any.
   - Next phase and its write scope.
   - Checks that must run before continuing.
6. If the plan and reality disagree, switch to RECONCILE before executing.

Do not assume the plan is current because it exists. Do not auto-continue a phase that was not explicitly resumed.

## RECONCILE

Use when implementation has drifted, a phase was partially done, or a prior agent's claims need verification.

1. Compare each completed phase's planned files and tests with the actual tree.
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
Use superbuild for this plan.

Plan: plans/NNN-feature-slug/plan.md
Mode: phase-by-phase | --build-all
Start: Phase <N>
Stop after: <phase or complete>
Parallel lanes: <lanes and disjoint write scopes>
Validation owner: <lane/agent>
Final gate: bun run ci:test && bun run build
Commit policy: <do not commit | generate message only | user asked for commit>

Rules:
- Update the plan after every phase.
- Run fresh verification; do not trust prior output.
- Do not edit generated docs.
- Do not skip a failed Definition of Done.
- Stop if a write scope conflicts with another lane.
```

### Handoff Preconditions

- [ ] Plan status is `Approved` or the user explicitly asked to execute a draft.
- [ ] No open frontier questions.
- [ ] Every phase has a DoD and a CHECKPOINT.
- [ ] Parallel phases have disjoint write scopes.
- [ ] The final gate is named.
- [ ] The commit policy is stated.

## Execution Report

Save to `plans/NNN-feature-slug/execution-report.md`.

```markdown
# Execution Report: <Feature>

**Plan:** `plans/NNN-feature-slug/plan.md`
**Started:** YYYY-MM-DD
**Last Updated:** YYYY-MM-DD
**Status:** in progress | complete | blocked

## Verified Phases

| Phase | Status | Tests | Typecheck | Lint | Build | Commit message |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | complete | pass | pass | pass | — | `feat(scope): summary` |

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
- Editing a phase while a writer is still active.
- Adding a parallel phase that touches the same files.
- Treating a subagent summary as verification.
- Updating generated reference docs by hand.
- Forgetting the change log or `Last Updated`.
- Handing off a plan with unresolved questions.
