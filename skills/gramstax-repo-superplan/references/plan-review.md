# Plan Review

Review the plan as an executable artifact. Do not review the implementation unless the user asked for a code review.

## Severity

| Severity | Meaning | Action |
| --- | --- | --- |
| **BLOCKER** | The plan cannot be executed safely or would produce a false result | Do not approve |
| **HIGH** | A phase will fail, a write conflict is likely, or a release claim is wrong | Fix before handoff |
| **MEDIUM** | The plan is executable but missing evidence, clarity, or maintainability | Fix or record as accepted risk |
| **LOW** | Wording, naming, or formatting | Optional |

## Checklist

### 1. Requirement Traceability

- [ ] The original request is captured verbatim, not paraphrased into a different requirement.
- [ ] Every acceptance criterion traces to a phase/task.
- [ ] Non-goals are explicit.
- [ ] Clarifications from grilling are recorded with their plan impact.
- [ ] Open questions are either resolved or listed as Known Unknowns with an owner and resolution point.

### 2. Repo Truth

- [ ] Paths and symbols exist, or the plan says they will be created.
- [ ] The plan reads the correct package `AGENTS.md`.
- [ ] Runtime/deploy claims match the current Bun-only app policy.
- [ ] The plan does not apply Gramstax app runtime assumptions to `@gramstax/lmdb` or `@gramstax/worker-thread`.
- [ ] The plan does not modify `real-projects/production-vip-content-bot` without checking its independent version/lockfile.
- [ ] Test commands and scripts actually exist.

### 3. Architecture

- [ ] The change has one clear owner package or a named cross-package contract.
- [ ] Public API, config, CLI, template, or generated-project changes are called out.
- [ ] Compatibility and migration impact are stated.
- [ ] Error, empty, retry, cancellation, and restart paths are covered when relevant.
- [ ] Security boundaries and untrusted input are covered when relevant.
- [ ] The approach follows existing patterns or explains why it must diverge.

### 4. Task Executability

- [ ] Every task names exact files and line ranges where known.
- [ ] Every code task has a failing test first and a named expected failure.
- [ ] Every code task has a passing command and named expected evidence.
- [ ] Docs-only tasks have a verifier: scanner, link check, build, or review command.
- [ ] No task says "implement X" without a file path and acceptance check.
- [ ] No task hides a multi-file refactor inside a vague instruction.
- [ ] Rollback or compatibility notes exist for risky migrations.

### 5. Phase Structure

- [ ] Phases are independently testable.
- [ ] Estimates are Fibonacci and no phase is `21`.
- [ ] Dependencies are explicit.
- [ ] Parallel phases have disjoint write scopes.
- [ ] Every phase has a Definition of Done and a CHECKPOINT.
- [ ] A failed phase stops the sequence; it does not silently continue.

### 6. Verification

- [ ] The test matrix covers happy path, edge cases, and regression.
- [ ] The final gate includes typecheck, lint, tests, and build when artifacts change.
- [ ] Generated docs are verified with `bun run build:docs`, not hand-edited.
- [ ] CLI changes include `gramstax start --help` and, when relevant, a packed/built smoke.
- [ ] Example changes include `bun run test:example` and a runnable example check.
- [ ] Every claim has fresh evidence; prior output is not accepted as current proof.

### 7. Parallel Safety

- [ ] Each lane has a disjoint write scope.
- [ ] Shared files (`AGENTS.md`, root README, `docs-site/guides/packages.md`, `package.json`, lockfiles) are assigned to exactly one lane.
- [ ] No lane edits generated reference output.
- [ ] Each lane has a validation owner.
- [ ] A final verifier is independent of the writers.

### 8. Plan Hygiene

- [ ] Header status and `Last Updated` are current.
- [ ] Phase table matches phase details.
- [ ] Change log has an entry for every revision.
- [ ] Completed history is preserved.
- [ ] The execution handoff names the plan, start phase, stop condition, and commit policy.
- [ ] `plans/` is treated as the durable record even though it is gitignored.

## Gramstax Traps

| Trap | Why it matters | Correct handling |
| --- | --- | --- |
| Editing `docs-site/reference/**` by hand | CI regenerates and overwrites it | Change TSDoc/source, run `bun run build:docs` |
| Planning a Node app runtime | The app/CLI is Bun-only | Remove it; use Bun commands |
| Applying app runtime rules to LMDB/worker-thread | Those packages have their own runtime support | Read the package README/AGENTS |
| Adding a test under a package that has no test runner | False confidence | Use the package's existing `bun:test` layout |
| Parallel edits to the same README/AGENTS file | Lost writes | Assign shared docs to one lane |
| Calling a phase done from a subagent summary | Summaries are claims, not evidence | Read artifacts and run the command |
| Marking a plan complete while `plans/` is ignored | Git cannot preserve the record | Keep the plan and report updated on disk |
| Using Jest/Vitest | Not supported | Use `bun:test` |
| Adding `@ts-ignore` to make a plan fit | Source policy forbids it | Fix the type or redesign the task |

## Findings Format

```markdown
## Plan Review: <plan path>

**Verdict:** Approve / Approve with changes / Reject

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| BLOCKER | Phase 3 removes the only e2e coverage for callback routing | plan lines 120–150 | Add a Flow DSL regression test before the refactor |
| HIGH | Task 2.2 and 4.1 both edit `packages/gramstax/src/core/ctx.ts` | plan lines 210, 360 | Move the 4.1 change into Phase 2 or split the file ownership |
| MEDIUM | Test command is not in `package.json` | plan line 275 | Use `bun test packages/gramstax/test` |
```

## Verdict Rules

- **Approve:** no BLOCKER or HIGH findings; MEDIUM findings are accepted or fixed.
- **Approve with changes:** only MEDIUM/LOW findings; list the required edits.
- **Reject:** any BLOCKER or HIGH finding that changes scope, safety, or verification.

Do not silently apply fixes during REVIEW. Ask to switch to REFINE, then record the changes in the plan's change log.
