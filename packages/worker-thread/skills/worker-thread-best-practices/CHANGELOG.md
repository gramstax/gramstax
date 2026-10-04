# Changelog

## 3.0.0

The five exported free functions are gone, replaced by class statics. This is the breaking change the `2.2.0` entry warned about while it sat unversioned on `main` — it now ships *with* the version bump it always needed.

**Version note.** `nx release --dry-run` resolves `2.2.0 → 3.0.0` for all four packages as one fixed release group, driven by `cb59cfdc`. `@gramstax/worker-thread` is the only package with a breaking change in this release; `gramstax`, `create-gramstax`, and `@gramstax/lmdb` move in lockstep and carry none of their own.

### Breaking: free functions → class statics

| Removed export | Replacement |
| --- | --- |
| `setDefaultErrorHandler(fn)` | `WorkerThreadErrorHandler.setDefault(fn)` |
| `resetDefaultErrorHandler()` | `WorkerThreadErrorHandler.resetDefault()` |
| `reportError(err)` | `WorkerThreadErrorHandler.report(err)` |
| `normalizeGatewayPath(path)` | `WorkerThreadGatewayPath.normalize(path)` |
| `estimatePayloadSize(value)` | `WorkerThreadRpc.estimatePayloadSize(value)` |

The module-level `defaultHandler` binding became `private static _default` on `WorkerThreadErrorHandler`; it was never public API, but it is no longer reachable by any import path either.

**Unchanged:** the three RPC constants `DEFAULT_MAX_MESSAGE_SIZE`, `DEFAULT_REQUEST_TIMEOUT_MS`, and `DENIED_RPC_METHODS` keep their names and values. Migration table also lives in `references/maintain-api-surface.md`.

### Shared types moved to `src/types`

The 10 shared `I*` definitions moved into `src/types`, one file per source module, mirroring `lmdb/src/types`:

```text
src/types/export.ts          IWorkerThreadExportOpt, IWorkerThreadGatewayProxy, …
src/types/gateway-client.ts  IGatewayClientOptions
src/types/gateway-server.ts  IGatewayServerOptions
src/types/rpc.ts             IMapRpc, IRpcContext, IRpcMiddleware
```

`index.ts` re-exports them with `export type {…}`, so the **type surface stays backwards compatible** — consumers importing `IRpcContext` from the package root are unaffected. Only deep imports into `src/types` paths are new; nothing was removed from the old locations because the types were previously declared inside their source modules, which still declare them.

### Also in this release

- Skill realigned with the post-reshape source (`1703499d`), so the rules lead with the class-static API instead of documenting both shapes side by side.
- JSDoc on every function (`218f88f8`) and a fix for wrong imports inside JSDoc `@example` blocks (`287489f4`), which previously showed code that would not compile if pasted.

## 2.2.0

Realigns the skill with the current `@gramstax/worker-thread` source. The skill
was last touched at commit `9248268d`, when the package was at `1.1.0`; four
later commits changed `src/`, the last of which is breaking. The old rules were
not wrong so much as silent — they never mentioned the five free functions that
`main` removed, so an agent following them would write an import that resolves
against the published package but not against `main`.

**Version note.** The package version is `2.2.0`, but the breaking reshape
landed *after* the `v2.2.0` tag was cut, so `main` is 12 commits ahead of that
tag with no version bump. The published `v2.2.0` still exports the free
functions; only `main` has the class statics. This skill documents both shapes
and leads with a side-by-side, because the version string alone cannot tell you
which API a build has.

### Why / Incorrect / Correct deepened to gramstax depth

All 16 rule files rewritten to match the depth the `gramstax` skill adopted in
`f2bce1f8` (compare `route-hooks.md`: 31 → 109 lines there). Rule content grew
from **912 to 2166 lines**; every rule now carries 3 `Incorrect` blocks, 2-4
`Correct` blocks, and at least one analytical table.

What changed structurally in every file:

- **The verdict now carries the load-bearing correction**, not a feature
  description — matching how `gramstax` leads with "there are **two**
  `hookBeforeRoute` hooks, not one".
- **`Why` states the failure mode and cost model**, not the feature.
- **Dedicated analytical sections** — dispatch decision flows, deny-list
  comparison tables, dedupe state tables, atomicity matrices, phase tables,
  command cheat-sheets. This is the largest addition.
- **`Incorrect` carries 3 separate blocks**, each isolating ONE mistake, each
  with an inline `// wrong: <specific consequence>` comment.
- **`Correct` carries one block per valid variant**, each commented.
- **Line citations** appear only where the number was read from source. All were
  re-verified after the rewrite.

Representative outcome — `pool-membership.md` (37 → 117) now carries the
three-branch `add()` decision table keyed to the actual guard order, so the
`threadCount` consequence of each branch is explicit. `gateway-reliability.md`
(38 → 100) enumerates which redelivery rows re-execute the handler instead of
only saying "make it idempotent".

### Claims found to be wrong or missing while rewriting

- **`pool.add()` with a duplicate `threadId` REPLACES, it does not refuse.**
  `src/pool.ts:89-97` compares `known === instance` first (a no-op return), then
  `known !== undefined`, which detaches the old exit listener and overwrites the
  map entry. `threadCount += 1` runs only in the genuinely-new-id branch, so a
  swap cannot double-count. Documented as a three-branch table.
- **The `allowedMethods` guard is itself a `use()` middleware** —
  `src/gateway-server.ts:161-163` registers it through `rpc.use(...)`. That is
  precisely *why* a short-circuiting middleware skips it, which
  `rpc-middleware.md` now explains instead of merely cross-referencing.
- **`rpc.ts:417-419` spreads reserved envelope fields LAST**, so a `context` or
  `others` key named `id`/`method`/`params` cannot corrupt the wire format.
- **Freshly verified while rewriting**: `estimatePayloadSize` skips `symbol` and
  `function` entirely and is cycle-guarded by a `seen` `Set`;
  `WorkerThreadRpc.defaultTimeoutMs` is initialised to
  `DEFAULT_REQUEST_TIMEOUT_MS` at `rpc.ts:154`. Note `exclusiveStart` is an
  `lmdb` range option and has NO equivalent here — `makeRequest` still takes
  exactly five parameters.
- **Corrected stale test citations.** Rules cited `regression (h)`, `(k)` and
  `(b)/(o)` as if those were test names. No test in the suite carries a bare
  letter label; those letters belong to the `describe` blocks
  `WorkerThreadExport regression (a–k fixes)` (`test/export.test.ts:191`) and
  `WorkerThreadLaunch regression (a–k fixes)` (`test/launch.test.ts:212`). The
  specific behaviours have real named tests and the rules now cite those —
  `counts Map keys and values instead of Object.keys undercount`,
  `counts Set items`, `handles empty Map/Set as zero`,
  `reports synchronous send throws from make()`,
  `reports async send rejections from make()`,
  `dispatches a request to the registered method`,
  `dispatches id-less requests but answers nobody`,
  `calls unref on the timer right after creation`.

### Package defects fixed in source

The JSDoc defects listed below were found while verifying this skill and have
now been **fixed in the package**, not just documented around:

| File | Fix |
| --- | --- |
| `src/export.ts:58,214` | `@example` imports changed from `"gramstax"` to `"@gramstax/worker-thread"` |
| `src/init.ts:20` | import corrected, and the non-existent `log` symbol dropped — this package exports no `log` |
| `src/launch.ts:17,33,51` | `@example` imports changed from `"gramstax"` to `"@gramstax/worker-thread"` |
| `src/pool.ts:12` | `@example` imports changed from `"gramstax"` to `"@gramstax/worker-thread"` |

All four symbols those examples import (`WorkerThreadExport`, `WorkerThreadInit`,
`WorkerThreadLaunch`, `WorkerThreadPool`) are real barrel exports, so the
examples are now copy-pasteable. `tsc`, `biome lint`, and all 254 tests pass
after the change.

### New rules

- `maintain-api-surface.md` (new, priority 1) — the utility reshape.
  Five free functions became class statics, the shared `I*` types moved to
  `src/types/`, and deep imports into `dist/src/` are unsupported. Opens with a
  published-`v2.2.0`-versus-`main` comparison so a reader can tell which API
  they have. Also documents the **two independent deny-lists** —
  `DENIED_RPC_METHODS` (exported, dispatcher layer, 10 entries) versus
  `DENIED_RPC_PROPS` (module-private, proxy layer, 6 entries) — which overlap on
  only three names and were previously conflated into one story. Closes with
  `@public` vs `@internal` discipline and the per-file tag counts.
- `errors-visibility.md` (new, priority 5) — the package-wide handler defaults
  to a **silent drop** and the library never writes to the console, so an
  unobserved worker error produces zero output. Covers `setDefault` /
  `resetDefault`, per-instance `error` listener precedence, the `onError`
  override trap (skip `report` and you break package-wide observability), and
  why a throwing user handler is swallowed by design.
- `platform-runtime.md` (new, priority 6) — cross-platform correctness. The
  win32 named-pipe transform escapes dashes **before** mapping slashes, so
  `/tmp/a-b` and `/tmp/a/b` land on distinct pipes; the 104-char POSIX limit
  exists to turn a cryptic bind-time `ENOENT` into a local error; relative paths
  resolve against `os.tmpdir()`. States the verification gap plainly: CI is
  `ubuntu-latest` only and all 9 `.test.ts` files import `bun:test`, so the win32
  branch of `normalize()` and Node support are **both** untested in CI.

### Rewritten

- `SKILL.md` — now declares its target version in `description`,
  `compatibility`, and a body callout (the gramstax pattern). Priority table is
  numbered 1–12 with impact, and a new **Start Here** table routes by symptom:
  broken import after upgrade, silent failure, works-on-Linux-not-Windows,
  `not found` on a method that exists.
- `maintain-style-tests.md` — the `Why` section was materially wrong; see
  defects below. Now separates what Biome's linter genuinely enforces
  (`useTemplate`, `useNodejsImportProtocol`, `useImportType`, `useConst`,
  `noUnused*`) from what is convention only, and names the two `off` switches
  that explain existing code (`noStaticOnlyClass` permitting the all-static
  helper classes, `noNonNullAssertion` permitting `!`). Also documents that the
  gate pins `typescript@7.0.2` via `bunx --package` while the root
  `devDependencies` still hold `^6.0.3`.

### Corrected

- `_sections.md` — new **API Surface** section placed first ("read first when an
  import will not resolve"), plus new **Errors** and **Platform** sections;
  13 rules to 16.
- Test-count claim `242 pass` → the verified **254 pass / 0 fail**.
- Typecheck command `bunx tsc` → `bunx --package typescript@7.0.2 tsc`, which is
  what both `ci:check` and the CI matrix actually run.
- CHANGELOG heading `## v1.0.0` → `## 1.0.0` (dropping the `v` prefix used by
  the gramstax and lmdb skills); this entry is headed with the **package**
  version, `2.2.0`.

### Cross-checked against the v2.2.0 release changelog

Every worker-thread-relevant line in the `## 2.2.0 (2026-10-02)` release notes
was checked against the source; two produced corrections, one confirmed an
existing claim, and one is now recorded as a known gap.

| Release entry | Outcome |
| --- | --- |
| `**worker-thread:** update implementation (6b975fb0)` | Confirmed — this is the `chore` commit already analysed; net −78 lines across `src` + `test`, no behavior change surfaced to rule files |
| `**lmdb:** query-scale epic, class-only src, per-module types (40226b01)` | Confirmed as the pattern `main` then applied to worker-thread — the reason helpers became class statics and types moved to `src/types/`; now cited in `maintain-api-surface.md` |
| `**root:** workspace bin shim, lockfile and tooling config (e23c01e0)` | Surfaced the `typescript@7.0.2` gate pin; corrected (above) |
| `Continuous Integration: build the gramstax dist before the test matrix runs (91fb1551)` | No effect — that step is `matrix.package == 'gramstax'`-gated, so it does not precede the worker-thread job |
| `**gramstax:** group public types per-domain with field-level JSDoc (c4f90855)` | Confirms the per-module `src/types/` + field-JSDoc convention this package now follows |

Re-verified against the release notes and still accurate: CI is
`ubuntu-latest`-only (`runs-on` appears twice, no `os:` matrix dimension), the
`7` `process.platform` guards are unchanged (3 in `gateway.integration.test.ts`,
4 in `gateway.test.ts`), and Node is still used only for npm OIDC publish.

### Defects found while verifying

Verifying each rule against source surfaced wrong import lines in the package's
own JSDoc. **Not yet fixed in source** — recorded here so the skill does not
teach them, and so a follow-up can.

| File | Defect |
| --- | --- |
| `src/export.ts:58,214` | `@example` blocks import from `"gramstax"` — wrong package |
| `src/init.ts:20` | imports from `"gramstax"` **and** names a `log` symbol this package does not export |
| `src/launch.ts:17,33,51` | `@example` blocks import from `"gramstax"` |
| `src/pool.ts:12` | `@example` block imports from `"gramstax"` |

`packages/worker-thread/README.md` is correct in all 8 import statements, so it
is the safe place to copy import lines from. Documented as a caution in
`maintain-api-surface.md`.

Three skill-level defects were corrected in place rather than deferred:

| File | Defect |
| --- | --- |
| `references/maintain-style-tests.md:8` | claimed "Biome enforces the style (… backtick strings)" — `biome.json` sets `plugins: []` and no linter `quoteStyle`; `ci:check` runs `biome lint` only, never `biome format` |
| `references/maintain-style-tests.md:21` | used `import {x} from 'node:y'` as an `Incorrect` example on the premise that single quotes "trip the backtick rule" — no such rule exists; the linter would pass it |
| `SKILL.md` (router) | claimed the reshape "shipped in v2.2.0" and told readers to expect an import failure after upgrading to v2.2.0 — the reshape is **after** the `v2.2.0` tag, so a consumer on the published package is unaffected |

Root `AGENTS.md` had already been corrected for the same backtick misconception
in commit `12df8c83`; this skill had carried the stale claim since `9248268d`.

## 1.0.0

- Initial `worker-thread-best-practices` skill: `SKILL.md` router,
  `references/_sections.md` index, `references/_template.md`, 13 rule files
  (`lifecycle-*`, `rpc-*`, `gateway-*`, `pool-*`, `bench-*`,
  `maintain-style-tests`).
- Encodes the audit→fix→Oracle session: `mtd*` naming contract (public and
  effectively-private), `DENIED_RPC_METHODS` + `Object.prototype` dispatch
  gate, 30s default timeout with `timeoutMs: 0` opt-out, at-least-once
  gateway dedupe (1000-entry FIFO, 64KB skip, in-flight drop), strict token
  + allow-list auth, pool `broadcastSettled`, mitata bench conventions.
