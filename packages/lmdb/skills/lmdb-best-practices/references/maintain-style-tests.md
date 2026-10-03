# maintain-style-tests

Boring conventions that keep a database package reviewable.

## Why

Storage bugs corrupt data silently. Deterministic `bun:test` suites plus zero-tolerance style rules are the only cheap defense — and co-located docs keep behavior changes reviewable.

## The gates

Run these exactly — substitutes check the wrong thing.

| Gate | Command | What it runs |
| --- | --- | --- |
| Typecheck (lmdb) | `bunx --package typescript@7.0.2 tsc --noEmit -p packages/lmdb` | Single-package gate |
| Full gate | `bun run ci:check` (repo root) | Root `tsc --noEmit` + one `tsc --noEmit -p <package>` per package, then `bun run lint` |
| Style | `bunx biome lint packages/lmdb` | 114 files, must report no findings |
| Tests | `bun test packages/lmdb/test/` | 503 tests across 41 files, 0 fail |

Two traps: there is NO `typecheck` script — `bun run typecheck` fails with `error: Script not found "typecheck"`. And the compiler pin matters: CI fetches `typescript@7.0.2` via `bunx --package` while the root `devDependencies` still hold `typescript: ^6.0.3` — a bare `bunx tsc` checks a DIFFERENT major version than CI does and can pass locally while failing there (or the reverse).

## Enforced vs convention

`biome lint` is the only style gate. `ci:check` runs `biome lint` but NEVER `biome format`, so quotes are not linted — `quoteStyle` is a formatter concern and the formatter never runs in the gate. `biome.json` sets `plugins: []` (`biome.json:115`), so no plugin can fail a build. Backticks are a convention, not an enforced rule.

| Rule | Status | Source |
| --- | --- | --- |
| `style.useTemplate` | enforced | `biome.json:64` |
| `style.useNodejsImportProtocol` | enforced (`node:` prefixes) | `biome.json:63` |
| `style.useImportType` | enforced (`import type`) | `biome.json:57` |
| `style.useConst` | enforced | `biome.json:56` |
| `correctness.noUnusedVariables` | enforced | `biome.json:42` |
| `correctness.noUnusedFunctionParameters` | enforced | `biome.json:40` |
| `complexity.useLiteralKeys` | enforced | `biome.json:51` |
| Backtick strings | convention only — never fails a build | formatter never runs in `ci:check` |
| `complexity.noStaticOnlyClass` | OFF — permits all-static helpers (`LmdbSearch`, `RecordCodec`, `LmdbSyncStream`, `LmdbBackup`) | `biome.json:48` |
| `style.noNonNullAssertion` | OFF — permits `!` in source | `biome.json:55` |

## `noUncheckedIndexedAccess` consequences

`strict` + `noUncheckedIndexedAccess` are ON — every index access yields `T | undefined` and must be narrowed. The `!` below is a documented consequence of the flag, not sloppiness.

| Site | Without the flag | With the flag (this repo) |
| --- | --- | --- |
| Tuple tail | `page[page.length - 1][0]` | `page[page.length - 1]![0]` — index may be out of bounds |
| Optional columns | `row.tags.length` | `row.tags?.length ?? 0` — `.optional()` columns are `T \| undefined` |
| Destructured entries | `const [k, v] = pair` | guard or `!` — `first()`/`last()` return `tuple \| undefined` |

## Incorrect

```typescript
// wrong: suppressed types hide decode-shape bugs — fix the type instead
// @ts-ignore
const rows = await sub.values() as any
```

```typescript
// wrong: the script does not exist — fails with `error: Script not found "typecheck"`
// bun run typecheck
// wrong: checks the wrong major — root devDeps hold typescript ^6.0.3, CI pins 7.0.2
// bunx tsc --noEmit -p packages/lmdb
```

```typescript
// wrong: unguarded index access — does not compile under noUncheckedIndexedAccess
const lastKey = page[page.length - 1][0]
```

## Correct

```typescript
// correct: exact compiler pin, exact project — reproduces the CI gate
// bunx --package typescript@7.0.2 tsc --noEmit -p packages/lmdb
// correct: full gate from the repo root — typechecks every package, then lints
// bun run ci:check
```

```typescript
// correct: deterministic test — tmp dir helper, explicit close + remove,
// no timers except TTL sleeps
import {createTestDir, rmWithRetry} from `./test-helpers` // correct: helpers live here, not `test/helpers.ts`
let dir = createTestDir(`lmdb-thing-`)
const db = new Db(dir) // correct: env opens on construction, no `open()` call
await db.close() // correct: every test closes + removes its tmp dir
await rmWithRetry(dir)
```

```typescript
// correct: the guard is required by the flag — `!` is allowed (`noNonNullAssertion` off)
const lastKey = page[page.length - 1]![0]
```

## Notes

- `as any` is acceptable in `test/` (fixtures, mocks), forbidden in `src/`.
- Env opens in the constructor; every test closes + removes its tmp dir (`createTestDir`/`rmWithRetry` in `test/test-helpers.ts`).
- Every test closes its env and removes its tmp dir (`createTestDir`/`rmWithRetry` in `test/test-helpers.ts`) — a leaked mmap handle keeps the file locked and fails the NEXT test, not this one.
- `files: ["dist"]` — bench/test/docs never publish.
- Behavior changes land with their test + a note in `AGENTS.md` next to the feature.
- Bench conventions — see `bench-runner.md` and `bench-writing.md`.
