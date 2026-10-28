# Plan Review For Gramstax Apps

Review the plan as an executable app artifact. Do not review the implementation unless the user asked for a code review.

## Severity

| Severity | Meaning | Action |
| --- | --- | --- |
| **BLOCKER** | The plan cannot be executed safely or would produce a false result | Do not approve |
| **HIGH** | A phase will fail, a write conflict is likely, or a version claim is wrong | Fix before handoff |
| **MEDIUM** | The plan is executable but missing evidence, clarity, or maintainability | Fix or record as accepted risk |
| **LOW** | Wording, naming, or formatting | Optional |

## Checklist

### 1. Requirement Traceability

- [ ] The original request is captured verbatim.
- [ ] Every acceptance criterion traces to a phase/task.
- [ ] Non-goals are explicit.
- [ ] Clarifications from grilling are recorded with their plan impact.
- [ ] Open questions are resolved or listed as Known Unknowns with an owner.

### 2. App Truth

- [ ] The app context is classified: greenfield, existing app adopting Gramstax, generated, standalone, or ecosystem integration.
- [ ] For greenfield, the scaffold command, project name, feature flags, and plan placement are valid and explicit.
- [ ] `package.json` scripts are used when present, not monorepo scripts.
- [ ] The installed `gramstax` version is recorded, or the greenfield target version is stated.
- [ ] `@gramstax/lmdb` / `@gramstax/worker-thread` versions and feature decisions are recorded when used.
- [ ] The relevant best-practice skill(s) and sections are recorded.
- [ ] The plan does not edit `node_modules` or installed package source.
- [ ] The plan does not hand-edit `.gramstax/**`.
- [ ] The plan does not assume `packages/gramstax` exists.

### 3. Architecture

- [ ] The change has one clear app owner surface (pages, config, data, workers, tests).
- [ ] Page flow, callback flow, session, and keyboard changes are called out.
- [ ] Deploy mode and env changes are stated.
- [ ] Data/worker lifecycle changes are stated.
- [ ] Error, empty, retry, cancellation, and restart paths are covered when relevant.
- [ ] Security boundaries and untrusted input are covered when relevant.
- [ ] The approach follows existing app patterns or explains why it must diverge.

### 4. Task Executability

- [ ] Every task names exact app files and line ranges where known.
- [ ] A greenfield bootstrap task names a valid `create-gramstax` command, all required feature flags, and the destination rule.
- [ ] Every code task has a failing test first and a named expected failure.
- [ ] Every code task has a passing command and named expected evidence.
- [ ] Docs-only tasks have a verifier: scanner, link check, build, or review command.
- [ ] No task says “implement X” without a file path and acceptance check.
- [ ] No task hides a multi-file refactor inside a vague instruction.
- [ ] A dependency upgrade/migration task has a compatibility and rollback note.

### 5. Phase Structure

- [ ] Phases are independently testable.
- [ ] Estimates are Fibonacci and no phase is `21`.
- [ ] Dependencies are explicit.
- [ ] Parallel phases have disjoint write scopes.
- [ ] Every phase has a Definition of Done and a CHECKPOINT.
- [ ] A failed phase stops the sequence.

### 6. Verification

- [ ] The test matrix covers happy path, edge cases, and regression.
- [ ] The final gate uses the app's real scripts.
- [ ] Greenfield plans run the generated baseline before changing pages or config.
- [ ] Page changes include the e2e mirror.
- [ ] Config/deploy changes include a start/build smoke.
- [ ] Data changes include a restart/migration check.
- [ ] Worker changes include startup failure and shutdown checks.
- [ ] Every claim has fresh evidence; prior output is not current proof.

### 7. Parallel Safety

- [ ] Each lane has a disjoint write scope.
- [ ] Shared files (`README.md`, `gramstax.config.ts`, `package.json`, lockfile) are assigned to exactly one lane.
- [ ] No lane edits `node_modules`, `.gramstax`, `data`, or generated artifacts.
- [ ] Each lane has a validation owner.
- [ ] A final verifier is independent of the writers.

### 8. Plan Hygiene

- [ ] Header status and `Last Updated` are current.
- [ ] Phase table matches phase details.
- [ ] Change log has an entry for every revision.
- [ ] Completed history is preserved.
- [ ] The execution handoff names the plan, start phase, stop condition, and commit policy.
- [ ] The plan's location in `plans/` is recorded and its Git status is understood.

## Gramstax App Traps

| Trap | Why it matters | Correct handling |
| --- | --- | --- |
| `bunx create-gramstax@latest .` | `.` is not a valid project name; the CLI rejects it | Use a name, or run interactively and submit an empty name in an effectively empty directory |
| Creating `plans/` in an empty target before scaffolding | A plan file makes the target non-empty and blocks in-place scaffold | Keep the plan in the parent and move it after scaffold, or grill before in-place scaffold |
| Planning a page without reading `gramstax-best-practices` | The plan can contradict route, template, e2e, or config rules | Load the relevant sections and record them |
| Treating an empty directory as an existing app | There is no `package.json`, `gramstax.config.ts`, or app script yet | Plan the scaffold and baseline phases first |
| Editing `node_modules/gramstax` or `@gramstax/*` | Changes disappear on install and bypass review | Upgrade, use a public extension point, or patch upstream |
| Planning against current `main` while the app pins an older major | The API may not exist in the app | Read installed version and README |
| Using `bun run ci:check` in an app | That script belongs to the monorepo | Use the app's `package.json` scripts |
| Hand-editing `.gramstax/**` | It is regenerated by `gramstax build` | Change source and rebuild |
| Adding/renaming a page without the e2e mirror | The mirror check and journeys break | Update `e2e/` and the mirror script together |
| Assuming `src/index.ts` exists | Gramstax boot is config-driven | Use `gramstax.config.ts` and `src/core/bot.ts` |
| Using Jest/Vitest | The app uses `bun:test` | Use `bun test` |
| Ignoring `src/base` impact | A base change affects many pages | Add route-level regression coverage |
| Changing a schema without migration/restart coverage | Existing data can be unreadable | Add migration and restart test |
| Committing `.env`, tokens, data, or `.gramstax` output | Secrets and generated state leak | Exclude them; document safe variables in the README, or add `.env.example` if the app uses one |
| Planning Node app runtime | Gramstax apps are Bun-only | Use Bun and `bun:test` |

## Findings Format

```markdown
## Plan Review: <plan path>

**Verdict:** Approve / Approve with changes / Reject

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| BLOCKER | Page rename has no e2e mirror update | plan lines 120–150 | Add `e2e/<page>.test.ts` or update the mirror |
| HIGH | Task 2.2 edits `node_modules/gramstax` | plan line 210 | Use a public extension point or upstream the change |
| MEDIUM | Test command is not in `package.json` | plan line 275 | Use `bun run test:all` |
```

## Verdict Rules

- **Approve:** no BLOCKER or HIGH findings; MEDIUM findings are accepted or fixed.
- **Approve with changes:** only MEDIUM/LOW findings; list the required edits.
- **Reject:** any BLOCKER or HIGH finding that changes scope, safety, or verification.

Do not silently apply fixes during REVIEW. Ask to switch to REFINE, then record the changes in the plan's change log.
