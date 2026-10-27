# maintain-style-tests.md

Verdict: `bun:test` only, per-package `tsc` green, full suite green, no type
suppression in source — and **backticks are convention, not a lint rule**.

## Why

`biome lint` is the only style gate. `ci:check` runs per-package `tsc --noEmit`
then `biome lint` — no formatter, no quote check. `biome.json` sets
`plugins: []`, so no GritQL plugin and no custom rule can fail a build either.

That distinction matters because this rule previously claimed "Biome enforces
backtick strings" and used single quotes as an `Incorrect` example. Both were
false: `biome.json` declares no `quoteStyle` for the linter, and quote style is
a **formatter** concern (`quoteStyle: "double"`), so `biome format --write`
would rewrite quotes — but `biome format` never runs in `ci:check`. Writing
`import {x} from 'node:y'` fails nothing in the gate. It only drifts from the
surrounding file.

What Biome's linter *does* enforce (verified against `biome.json`):
`style.useTemplate`, `style.useNodejsImportProtocol`, `style.useImportType`,
`style.useConst`, `correctness.noUnusedVariables`,
`correctness.noUnusedFunctionParameters`, `complexity.useLiteralKeys`.

Two of those are load-bearing for this package: `useTemplate` is why string
concatenation gets flagged, and `useNodejsImportProtocol` is why builtins need
the `node:` prefix. Two notable **off** switches explain existing code:
`complexity.noStaticOnlyClass: "off"` is what permits the all-static
`WorkerThreadGatewayPath` / `WorkerThreadErrorHandler` helpers, and
`style.noNonNullAssertion: "off"` permits `!` in source.

`bun:test` (`describe`/`it`/`expect`) is the only runner — no vitest, no jest.
Every package typechecks through its own tsconfig
(`tsc --noEmit -p packages/worker-thread`), which is what `ci:check` wires; the
root `tsc --noEmit` alone sees almost nothing.

**Use the pinned compiler, not the local one.** Both `ci:check` and the CI
matrix invoke `bunx --package typescript@7.0.2 tsc`, while the root
`devDependencies` still pins `typescript: ^6.0.3`. A bare `bunx tsc` therefore
typechecks against a *different major version* than the gate does, and can pass
locally while failing in CI (or the reverse). Reproduce the gate exactly.

Source forbids `@ts-ignore`/`@ts-expect-error` (fix it instead); test files may
use `as any` sparingly.

## Enforced-vs-convention style table

The gate fails the left column. The right column passes the gate and only
drifts from surrounding files — fix it for consistency, not for CI:

| Enforced by `biome lint` (fails the gate) | Convention only (passes, but drifts) |
|---|---|
| string concatenation instead of a template (`useTemplate`) | single-quoted strings instead of backticks — `quoteStyle` is formatter-only and the formatter never runs in the gate |
| builtin import without `node:` prefix (`useNodejsImportProtocol`) | line-width drift — formatter `lineWidth` is 300 for TS, never checked by lint |
| value import of a type-only symbol (`useImportType`) | trailing-comma or bracket-spacing style — formatter concerns, not lint rules |
| `let` never reassigned (`useConst`) | arrow-parens or quote placement — no linter rule covers them |
| unused variable or parameter (`noUnusedVariables`, `noUnusedFunctionParameters`) | comment wording or block order — invisible to the gate |
| computed string key where a literal works (`useLiteralKeys`) | file-local naming taste — the gate checks no naming rule |

`biome.json` sets `plugins: []`, so nothing outside this table can fail the
style gate either — no GritQL plugin, no custom rule.

## The gate command list, with its two traps

Run these three, in this order, and nothing else stands in for them:

| Step | Command | What it proves |
|---|---|---|
| 1. Typecheck | `bunx --package typescript@7.0.2 tsc --noEmit -p packages/worker-thread` | package compiles under the exact CI compiler |
| 2. Lint | `bunx biome lint packages/worker-thread` | only-style-gate passes, no format check |
| 3. Test | `bun test packages/worker-thread/test/` | 254 pass / 0 fail on this runtime |

Trap 1 — the wrong compiler: a bare `bunx tsc` resolves the root
`devDependencies` pin (`typescript: ^6.0.3`), a DIFFERENT major version from
the gate's `typescript@7.0.2`. Green locally under 6.x can still be red in CI
under 7.x, and the reverse. Always spell out the `--package` pin.

Trap 2 — the missing script: **there is NO `typecheck` script** in this repo.
`bun run typecheck` fails with `error: Script not found "typecheck"`. The
gate is `ci:check` (per-package `tsc --noEmit`, then `biome lint`), not a
script of that name — do not document it, do not call it.

## `noUncheckedIndexedAccess` consequence table

`strict` + `noUncheckedIndexedAccess` are on, so every index access widens to
include `undefined`. Handle each shape at the use site:

| Access shape | Type you get | Do this |
|---|---|---|
| `pool.thread.get(id)` | `T \| undefined` | guard or early-return before use, never assert it away |
| `arr[i]` on a plain array | `T \| undefined` | narrow with a length or `undefined` check first |
| `record[key]` on a `Record<string, unknown>` | `unknown` (key may be absent) | narrow with `typeof` or a presence check |
| `map.get(k)` after `map.has(k)` | still `T \| undefined` | the guard does not narrow `Map.get` — check the result anyway |

## Incorrect

```typescript
// wrong: banned in source — fix the type instead of suppressing it
// @ts-ignore
await worker.mtd_DoWork() // wrong: unprefixed, PascalCase — invisible to the mtd* contract
```

```typescript
// wrong: passes biome lint today — it is drift, not a build failure
import {WorkerThreadInit} from '@gramstax/worker-thread' // wrong: single quotes drift from backtick files
```

```typescript
// wrong: checks a DIFFERENT major version than CI (root pins typescript ^6.0.3)
bunx tsc --noEmit -p packages/worker-thread // wrong: gate uses --package typescript@7.0.2
bun run typecheck // wrong: Script not found "typecheck" — no such script exists
```

## Correct

```typescript
await worker.request(`mtdDoWork`, []) // right: mtd* prefix, backticks, no suppression
bun test packages/worker-thread/test/ // right: 254 pass / 0 fail
bunx --package typescript@7.0.2 tsc --noEmit -p packages/worker-thread // right: gate-equivalent typecheck
```

```typescript
import {tmpdir} from "node:os" // right: useNodejsImportProtocol needs the node: prefix
import type {IGatewayClientOptions} from "@gramstax/worker-thread" // right: useImportType for type-only imports
const path = WorkerThreadGatewayPath.normalize(`gateway-main`) // right: useConst, useTemplate, literal key
```

```typescript
const worker = pool.thread.get(id) // right: typed T | undefined under noUncheckedIndexedAccess
if (worker === undefined) return // right: guard at the use site, never asserted away
await worker.request(`mtdPing`, []) // right: reachable only after the narrow
```

## Notes

- `strict` + `noUncheckedIndexedAccess` are on — index access needs guards.
  `pool.thread.get(id)` returns `T | undefined`; do not assert it away.
- `node:` prefixes for builtins; `import type` for type-only imports.
- Test every fix red→green; wrap thread/socket awaits in `withTimeout`
  (see `test/helpers.ts`) so the suite can never hang.
- All 9 `.test.ts` files plus `test/helpers.ts` import `bun:test`. Because of
  that, Node cannot run the suite at all — see `references/platform-runtime.md`.
- Never commit unless asked; never leave the tree red.
- **Locking evidence.** The gate pins are `bunx --package typescript@7.0.2 tsc`
  (CI matrix and `ci:check` agree) and `biome lint` with `plugins: []` —
  change either only by updating `biome.json` and the workflow together.
- **Sibling cross-references.** `references/platform-runtime.md` for why CI
  runs ubuntu + Bun only, `references/maintain-api-surface.md` for the
  `@public` / `@internal` discipline that `useImportType` supports.

## References

- `packages/worker-thread/AGENTS.md` — package conventions
- `biome.json` at the repo root — the authoritative lint rule set
- `references/platform-runtime.md` — why CI runs ubuntu + Bun only
- `references/maintain-api-surface.md` — `@public` / `@internal` discipline
