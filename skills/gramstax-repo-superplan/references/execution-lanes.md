# Execution Lanes

A plan is only parallel-safe when its write scopes are disjoint. This reference defines the lanes, their boundaries, and the reconciliation rules.

## Default Lanes

| Lane | Typical owner | Write scope | Validation owner |
| --- | --- | --- | --- |
| Core library | `fixer` | `packages/gramstax/src/**`, `packages/gramstax/test/**` | Core lane runs `bun test packages/gramstax/test` and `bun run ci:check` |
| CLI / app runtime | `fixer` | `packages/gramstax/src/cli/**`, CLI tests, `docs-site/guides/gramstax-*.md` | CLI lane runs `bun run --cwd example/1-complex start --help` plus package tests |
| Scaffolder | `fixer` | `packages/create-gramstax/src/**`, `packages/create-gramstax/test/**` | Scaffold lane runs `bun test packages/create-gramstax/test` |
| LMDB | `fixer` | `packages/lmdb/src/**`, `packages/lmdb/test/**` | LMDB lane runs `bun test packages/lmdb/test` |
| Worker thread | `fixer` | `packages/worker-thread/src/**`, `packages/worker-thread/test/**` | Worker lane runs `bun test packages/worker-thread/test` |
| Examples / e2e | `fixer` | `example/**` | Example lane runs `bun run test:example` |
| Authored docs | `fixer` | `docs-site/guides/**`, `README.md` (one lane only) | Docs lane runs scanner tests and `bun run build:docs` if API docs changed |
| Agent guidance | `fixer` | `AGENTS.md`, `skills/**`, `docs/agents/**` | Guidance lane runs `bun test packages/gramstax/test/cli.docs.test.ts` |
| Architecture / risk | `oracle` | none (read-only) | Reviews the plan and the final diff |
| Discovery | `explorer` | none (read-only) | Returns file/symbol maps |
| External facts | `librarian` | none (read-only) | Returns version-specific sources |
| UI/UX | `designer` | UI files only, if the repo has a UI surface | Designer review |

Use the smallest set of lanes that keeps writes disjoint. Do not spawn a lane for a read you can do yourself.

## Hard Rules

1. **One writer per file.** A file may have many readers and exactly one writer in a phase.
2. **The planner owns the plan.** Code lanes do not edit `plans/**`; they report evidence and let the planner update it.
3. **Shared docs are a single lane.** Root `README.md`, `AGENTS.md`, `docs-site/guides/packages.md`, `package.json`, and lockfiles are not parallel write scopes.
4. **Generated docs are never a writer lane.** `docs-site/reference/**` and `packages/*/docs/{markdown,yaml}` are produced by `bun run build:docs`.
5. **No lane edits another lane's tests to make its own change pass.** If a shared contract changes, assign the test update to the contract owner.
6. **Every lane has a validation owner.** "The final verifier will catch it" is not a lane validation plan.
7. **A phase is complete only after the plan owner reconciles the lane evidence.** Subagent summaries are claims, not evidence.

## Expressing Lanes In A Plan

Every phase and task must state:

```markdown
**Write scope:** `packages/gramstax/src/core/**`, `packages/gramstax/test/core.*`
**Validation owner:** Core lane
**Parallel with:** Phase 3 (docs only; no shared files)
```

If two phases share a path, they are not parallel. Put them in sequence or split the path.

## Conflict Matrix

| If lane A edits… | Lane B must not edit… |
| --- | --- |
| `packages/gramstax/src/core/ctx.ts` | Any file that imports or re-exports `ctx` in the same phase |
| `packages/gramstax/src/template/engine.ts` | Template tests, template docs, and generated template reference in the same phase |
| `packages/create-gramstax/src/templates/**` | The generated-project README or example that mirrors it |
| `packages/lmdb/src/schema.ts` | LMDB tests, migration docs, and README examples describing the schema |
| `packages/worker-thread/src/rpc.ts` | Worker tests and the worker README |
| `docs-site/guides/packages.md` | Root `README.md` if both list the same skills |
| `AGENTS.md` | Package `AGENTS.md` files that repeat the same rule |
| `package.json` | Lockfile and release notes unless the lane owns both |

When a shared contract must change, create a **contract task** that lands first. Then parallel lanes consume the new contract.

## Parallel Phase Example

```markdown
| Phase | Name | Parallel With | Write scope | Validation owner |
| --- | --- | --- | --- | --- |
| 1 | Add CLI env loader | — | `packages/gramstax/src/cli/env.ts`, `packages/gramstax/test/cli.env.test.ts` | CLI lane |
| 2 | Remove runtime selector | — | `packages/create-gramstax/src/**`, `packages/create-gramstax/test/**` | Scaffold lane |
| 3 | Update Bun-only docs | 1, 2 | `docs-site/guides/gramstax-start.md`, `README.md` | Docs lane |
```

Phase 3 can run in parallel only because it does not touch the CLI or scaffolder source files. If the docs lane needs to change the same `README.md` that another lane edits, sequence it.

## Dispatch and Reconciliation

1. Brief each writer with: plan path, phase, exact write scope, validation command, and stop condition.
2. Track the lane by session/task ID.
3. Do not start a second writer in the same scope.
4. When a lane finishes, read its produced artifacts before accepting the summary.
5. Run the lane's narrow validation yourself or assign an independent verifier.
6. Reconcile all lanes before the final gate.
7. If a lane oversteps its scope, stop it and reconcile the partial work before continuing.
8. If a lane reports a blocker, update the plan (REFINE or RECONCILE) before re-dispatching.

## Final Verifier

The final verifier is independent of the writers and runs the full gate:

```bash
bun run ci:test
bun run build
git diff --check
```

Add `bun run test:example` when examples changed and `bun run build:docs` when authored TSDoc changed. The final verifier reports commands and exit codes, not just "all good".

## Anti-Patterns

- Parallel phases that both edit `packages/gramstax/src/core/ctx.ts`.
- Two lanes editing root `README.md` because "the changes are small".
- A lane that stages or commits another lane's files.
- A lane that edits the plan to mark itself complete.
- A writer that fixes tests by weakening assertions.
- A verifier that trusts a writer's summary without reading the diff.
- A docs lane that hand-edits generated reference output.
- A phase with no validation owner.
