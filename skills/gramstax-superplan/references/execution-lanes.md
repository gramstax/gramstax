# Execution Lanes For Gramstax Apps

A plan is only parallel-safe when its write scopes are disjoint. This reference defines app lanes and reconciliation rules.

## Default Lanes

| Lane | Typical owner | Write scope | Validation owner |
| --- | --- | --- | --- |
| Pages / templates | `fixer` | `src/pages/**`, `src/blocks/**`, related `e2e/**` | Pages lane runs `bun run test:e2e` |
| Base / guards / core | `fixer` | `src/base/**`, `src/guards/**`, `src/core/**`, `src/types/**`, `src/helpers/**` | Core lane runs `bun run test` and `bun run test:e2e` |
| Config / deploy | `fixer` | `gramstax.config.ts`, `src/env.ts`, env documentation (`.env.example` if present), README deploy section | Config lane runs typecheck and a start/build smoke |
| Data / LMDB | `fixer` | `src/db/**`, DB-related `test/**` | Data lane runs unit tests plus a restart check |
| Workers / jobs | `fixer` | `src/workers/**` or `src/jobs/**`, worker tests | Worker lane runs its tests plus startup/shutdown checks |
| App docs | `fixer` | `README.md`, app `docs/**` (one lane only) | Docs lane runs a link/review check |
| Discovery | `explorer` | none (read-only) | Returns file/symbol maps |
| External facts | `librarian` | none (read-only) | Returns version-specific sources |
| Architecture / risk | `oracle` | none (read-only) | Reviews the plan and final diff |
| UI/UX | `designer` | UI files only, if the app has a UI surface | Designer review |

Use the smallest set of lanes that keeps writes disjoint. Do not spawn a lane for a read you can do yourself.

## Hard Rules

1. **One writer per file.** A file may have many readers and exactly one writer in a phase.
2. **The planner owns the plan.** Code lanes do not edit `plans/**`; they report evidence and let the planner update it.
3. **A page and its e2e mirror belong to the same lane.** Splitting them creates a stale mirror.
4. **Shared files are a single lane.** `README.md`, `gramstax.config.ts`, `.env.example` (if present), `package.json`, and lockfiles are not parallel write scopes.
5. **Never write `node_modules`.** Installed dependencies are read-only.
6. **Never write `.gramstax/**` or runtime data.** They are generated or mutable state.
7. **Every lane has a validation owner.** “The final verifier will catch it” is not a lane validation plan.
8. **A phase is complete only after the plan owner reconciles lane evidence.** Subagent summaries are claims, not evidence.

## Expressing Lanes In A Plan

Every phase and task must state:

```markdown
**Write scope:** `src/pages/checkout/**`, `e2e/checkout/**`
**Validation owner:** Pages lane
**Parallel with:** Phase 3 (docs only; no shared files)
```

If two phases share a path, they are not parallel. Put them in sequence or split the path.

## Conflict Matrix

| If lane A edits… | Lane B must not edit… |
| --- | --- |
| `src/pages/checkout.ts` | `e2e/checkout.test.ts` or `src/blocks/checkout-keyboard.ts` in the same phase |
| `src/base/page.ts` | Any page or e2e test that inherits from it in the same phase |
| `src/core/bot.ts` | Bot lifecycle tests and `gramstax.config.ts` wiring in the same phase |
| `gramstax.config.ts` | `.env.example` (if present) or README deploy section unless the same lane owns both |
| `src/db/schema/**` | DB tests, migration notes, and README examples describing the schema |
| `src/workers/job.ts` | Worker tests and `src/core/services.ts` wiring in the same phase |
| `README.md` | Any other lane that wants to document its own change |
| `package.json` | Lockfile and release notes unless the lane owns both |

When a shared contract must change, create a **contract task** that lands first. Then parallel lanes consume the new contract.

## Parallel Phase Example

```markdown
| Phase | Name | Parallel With | Write scope | Validation owner |
| --- | --- | --- | --- | --- |
| 1 | Add checkout page | — | `src/pages/checkout.ts`, `e2e/checkout.test.ts` | Pages lane |
| 2 | Add checkout data model | — | `src/db/schema/checkout.ts`, `test/checkout-db.test.ts` | Data lane |
| 3 | Update deploy docs | 1, 2 | `README.md`, env docs | Docs lane |
```

Phase 3 can run in parallel only because it does not touch page or data files. If the docs lane needs the same `README.md` another lane edits, sequence it.

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

The final verifier is independent of the writers and runs the app gate:

```bash
bun run typecheck
bun run lint
bun run test:all
bun run build:gramstax   # or the app's build script
git diff --check
```

Use the names that exist in `package.json`. Add a manual `bun run dev` check when the change affects a real Telegram journey, and a restart check when it affects LMDB or workers.

## Anti-Patterns

- Parallel phases that both edit `src/pages/start.ts`.
- A page change without the matching e2e mirror owner.
- Two lanes editing `README.md` because “the changes are small”.
- A lane that edits `node_modules` to make a type pass.
- A lane that edits `.gramstax/**` instead of rebuilding.
- A lane that stages or commits another lane's files.
- A lane that edits the plan to mark itself complete.
- A writer that fixes tests by weakening assertions.
- A verifier that trusts a writer's summary without reading the diff.
