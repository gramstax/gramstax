# maintain-api-surface.md

Verdict: helpers are **static members of the class that owns them**, shared
types live in `src/types/`, and consumers import from the package root only —
`@gramstax/worker-thread`, never `gramstax`.

## Why

The utility API was reshaped: five free functions became class statics and every
shared `I*` type moved into `src/types/`, mirroring `lmdb/src/types`. The old
names were not aliases — they were deleted, so a stale import is a compile
error, not a deprecation warning.

**Check which side of the reshape you are on before changing anything.** The
`package.json` version is `2.2.0`, but the `v2.2.0` tag was cut *before* the
reshape landed, and `main` sits 12 commits ahead of it:

| | `v2.2.0` tag (published) | `main` (unreleased) |
|---|---|---|
| path helper | `export function normalizeGatewayPath(path)` | `WorkerThreadGatewayPath.normalize(path)` |
| size estimator | `export function estimatePayloadSize(v)` | `WorkerThreadRpc.estimatePayloadSize(v)` |
| error routing | `export function setDefaultErrorHandler(fn)` | `WorkerThreadErrorHandler.setDefault(fn)` |
| reset | `export function resetDefaultErrorHandler()` | `WorkerThreadErrorHandler.resetDefault()` |
| report | `export function reportError(err)` | `WorkerThreadErrorHandler.report(err)` |
| shared types | none — types sit in their source modules | `src/types/` (4 files, 9 types) |

A consumer pinned to the published `v2.2.0` still uses the free functions and
will see no error. Only code built from `main` (or whatever release ships the
reshape) needs the class form. Since the package version did **not** change at
the reshape commit, the version string alone cannot tell you which API you have.

Putting a helper on its owning class is what makes the barrel honest:
`src/index.ts` is nine `export *` lines plus nine `export type` lines, so what
a consumer can reach is exactly what a class exports. A free function had no
owner and drifted; `normalizeGatewayPath` became
`WorkerThreadGatewayPath.normalize` precisely so path rules live in one place
that both the gateway server and client are forced to share.

## Migration Table (landed on `main`, unreleased)

Free function → class static. Applies when building from `main`; not yet needed
for the published `v2.2.0`.

| Removed export | Replacement | Owner |
|----------------|-------------|-------|
| `setDefaultErrorHandler(fn)` | `WorkerThreadErrorHandler.setDefault(fn)` | `error-handler.ts` |
| `resetDefaultErrorHandler()` | `WorkerThreadErrorHandler.resetDefault()` | `error-handler.ts` |
| `reportError(err)` | `WorkerThreadErrorHandler.report(err)` | `error-handler.ts` |
| `normalizeGatewayPath(p)` | `WorkerThreadGatewayPath.normalize(p)` | `gateway-path.ts` |
| `estimatePayloadSize(v)` | `WorkerThreadRpc.estimatePayloadSize(v)` | `rpc.ts` |

Unchanged and still exported: `DEFAULT_MAX_MESSAGE_SIZE`,
`DEFAULT_REQUEST_TIMEOUT_MS`, `DENIED_RPC_METHODS`, `WorkerThreadInit`,
`WorkerThreadLaunch`, `WorkerThreadExport`, `WorkerThreadPool`,
`WorkerThreadRpc`, `WorkerThreadGatewayServer`, `WorkerThreadGatewayClient`,
`WorkerThreadGatewayPath`, `WorkerThreadErrorHandler`.

## Wrong-vs-right import pair per renamed symbol

One row per renamed symbol — the left column is the deleted `main`-era import,
the right column is its replacement. Never mix columns in one file:

| # | Wrong (deleted on `main`) | Right (on `main`) |
|---|---|---|
| 1 | `import {normalizeGatewayPath} from "@gramstax/worker-thread"` | `import {WorkerThreadGatewayPath} from "@gramstax/worker-thread"` then `WorkerThreadGatewayPath.normalize(p)` |
| 2 | `import {estimatePayloadSize} from "@gramstax/worker-thread"` | `import {WorkerThreadRpc} from "@gramstax/worker-thread"` then `WorkerThreadRpc.estimatePayloadSize(v)` |
| 3 | `import {setDefaultErrorHandler} from "@gramstax/worker-thread"` | `import {WorkerThreadErrorHandler} from "@gramstax/worker-thread"` then `WorkerThreadErrorHandler.setDefault(fn)` |
| 4 | `import {resetDefaultErrorHandler} from "@gramstax/worker-thread"` | `WorkerThreadErrorHandler.resetDefault()` on the same class |
| 5 | `import {reportError} from "@gramstax/worker-thread"` | `WorkerThreadErrorHandler.report(err)` — inside `onError` only, never as a routing strategy |

## Shared Types Live in `src/types/`

One file per source module, re-exported from the barrel with `export type` so
the runtime bundle never carries them:

| File | Types |
|------|-------|
| `src/types/export.ts` | `IWorkerThreadExportOpt`, `IWorkerThreadExportResult`, `IWorkerThreadGatewayProxy`, `IWorkerThreadAsyncMethods`, `IWorkerThreadGatewayClientFactory` |
| `src/types/rpc.ts` | `IMapRpc`, `IRpcContext`, `IRpcMiddleware` |
| `src/types/gateway-client.ts` | `IGatewayClientOptions` |
| `src/types/gateway-server.ts` | `IGatewayServerOptions` |

```typescript
import type {IGatewayServerOptions} from "@gramstax/worker-thread" // ✅ barrel, type-only
import type {IGatewayServerOptions} from "@gramstax/worker-thread/dist/src/types/gateway-server" // ❌ deep import
```

Deep imports break silently on a patch bump — `dist/src/` layout is a tsup
implementation detail, and only `dist` is published (`files: ["dist"]`).

## Two Deny-Lists, Two Layers

The package blocks RPC dispatch at **two independent layers**. Confusing them
produces "why is my method rejected?" confusion that no amount of reading one
file will resolve.

| List | Location | Exported | Blocks |
|------|----------|----------|--------|
| `DENIED_RPC_METHODS` | `rpc.ts` (dispatcher) | yes | `__proto__`, `constructor`, `prototype`, `send`, `request`, `kill`, `init`, `handleOnMessage`, `createGatewayServer`, `createGatewayClient` |
| `DENIED_RPC_PROPS` | `export.ts` (proxy) | no | `then`, `toString`, `constructor`, `__proto__`, `prototype`, `inspect` |

`DENIED_RPC_METHODS` guards the **dispatcher**: it stops a peer from invoking
plumbing as if it were business logic. `DENIED_RPC_PROPS` guards the **proxy
`get` trap**: it keeps the proxy non-thenable (`then`) and defuses
introspection gadgets (`toString`, `inspect`) before a closure is ever built.

Only three names overlap. A method can pass the proxy layer and still be denied
by the dispatcher, which is why a typo'd or plumbing-looking name fails with
`not found` rather than dispatching.

## `@public` vs `@internal` decision table

The tag is an intent marker, not access control — the barrel uses `export *`,
so `@internal` members are reachable at runtime. Decide by role, not by
reachability:

| You want to | Tag | Entry point | Never do this |
|---|---|---|---|
| route errors package-wide | `@public` | `WorkerThreadErrorHandler.setDefault` | assign `WorkerThreadErrorHandler.report = myFn` directly |
| preserve observability in an override | `@internal` (intended call) | `WorkerThreadErrorHandler.report(err)` inside `onError` | import `report` as a routing strategy elsewhere |
| validate a timeout value | `@internal` | pass `timeoutMs` to `makeRequest` / `request` | call `WorkerThreadRpc.assertTimeout` yourself |
| dispatch a worker method | `@public` | `request` / `execute` / `broadcastRequest` | invoke `rpc.make` / `_runMiddleware` directly |

Counts across `src/*.ts`: `launch.ts` 10 public / 0 internal, `rpc.ts` 14 / 5,
`error-handler.ts` 3 / 2, `init.ts` 8 public. Consumers extend behavior through
`@public` entry points (`setDefault`, `onError`), never by calling an
`@internal` member directly — except `report` inside `onError`, which is the
one intended exception.

## Which API am I on — diagnostic checklist

Run this checklist before touching an import that will not resolve:

1. Read the import error first: `has no exported member` naming a free
   function means the file was written for the other side of the reshape.
2. Check the checkout: does `src/types/` exist with 4 files? Present means
   `main` (class statics); absent means published `v2.2.0` (free functions).
3. Check the consumer: `from "gramstax"` is always wrong for this package —
   seven `@example` blocks across `export.ts:58,214`, `init.ts:20`,
   `launch.ts:17,33,51`, `pool.ts:12` carry that stale path (and `init.ts:20`
   imports a `log` symbol this package does not export). Copy import lines
   from `README.md`, which is correct in all 8 import statements.
4. Check the tail: a deep `dist/src/types/...` import means the type came from
   build output — rewrite it as a barrel `import type`.
5. Check the tag: if the symbol resolves but is `@internal`, route through the
   `@public` entry point in the decision table above instead.

## Incorrect

```typescript
import {normalizeGatewayPath, estimatePayloadSize} from "@gramstax/worker-thread" // wrong: deleted on main, compile error
import {setDefaultErrorHandler} from "@gramstax/worker-thread" // wrong: now WorkerThreadErrorHandler.setDefault
import {reportError} from "@gramstax/worker-thread" // wrong: now WorkerThreadErrorHandler.report

normalizeGatewayPath(`gateway-main`) // wrong: free function no longer exists
```

```typescript
import type {IGatewayClientOptions} from "@gramstax/worker-thread/dist/src/types/gateway-client" // wrong: deep import into tsup output
import type {IGatewayServerOptions} from "@gramstax/worker-thread/dist/src/types/gateway-server" // wrong: breaks on any dist layout change

// wrong: only dist is published (files: ["dist"]), so this path is an implementation detail
```

```typescript
import {WorkerThreadInit} from "gramstax" // wrong: wrong package entirely
import {WorkerThreadInit, WorkerThreadExport, log} from "gramstax" // wrong: log is not exported here either

WorkerThreadErrorHandler.report = myFn // wrong: @internal member, not part of the stable API
```

## Correct

```typescript
import {WorkerThreadErrorHandler, WorkerThreadGatewayPath, WorkerThreadRpc} from "@gramstax/worker-thread"

WorkerThreadErrorHandler.setDefault((err) => logger.error(err)) // right: @public entry point
const pipe = WorkerThreadGatewayPath.normalize("gateway-main") // right: static on the owning class
const bytes = WorkerThreadRpc.estimatePayloadSize(payload) // right: static on the owning class
```

```typescript
import type {IGatewayClientOptions, IGatewayServerOptions} from "@gramstax/worker-thread" // right: barrel, type-only

// right: runtime bundle never carries types — export type keeps them erasable
const opts: IGatewayClientOptions = {token: `shared-secret`} // right: typed against the barrel
```

```typescript
import {WorkerThreadExport, WorkerThreadInit} from "@gramstax/worker-thread" // right: package root, copied from README.md

class MyWorker extends WorkerThreadInit { // right: stateless helpers never instantiated
  mtdPing() { // right: GatewayPath and ErrorHandler stay all-static
    return `pong`
  }
}

export const Job = WorkerThreadExport.init({path: __filename, WTInit: MyWorker}) // right: class form on main
```

## Notes

- **`@public` vs `@internal`.** Counts across `src/*.ts`: `launch.ts` 10 public
  / 0 internal, `rpc.ts` 14 / 5, `error-handler.ts` 3 / 2. `@internal` marks a
  member the package calls on your behalf — `WorkerThreadErrorHandler.report`
  is invoked by `onError`, `WorkerThreadRpc.assertTimeout` by `makeRequest`.
  Consumers extend behavior through `@public` entry points (`setDefault`,
  `onError`), never by calling an `@internal` member directly. Note the barrel
  uses `export *`, so `@internal` members *are* reachable at runtime; the tag
  is an intent marker, not an access control.
- **Stateless classes are never instantiated.** `WorkerThreadGatewayPath` is
  all-static and its JSDoc says so: "Stateless helper — every member is static,
  so the class is never instantiated."
- **`DENIED_RPC_METHODS` is a `ReadonlySet<string>`** and is exported so you can
  assert against it in your own tests. `DENIED_RPC_PROPS` is module-private and
  deliberately has no export — the proxy layer is not a contract.
- **Do not trust this package's JSDoc examples for import paths.** Seven
  `@example` blocks across `export.ts`, `init.ts`, `launch.ts`, and `pool.ts`
  still write `from "gramstax"` (and `init.ts` imports a `log` symbol this
  package does not export). The prose is correct; the import lines are wrong.
  Copy import lines from `README.md`, which is right 8/8.
- Locked by `test/error-handler.test.ts`, `test/coverage.test.ts`,
  `test/gateway.integration.test.ts` (the win32 branch of `normalize`), and the
  `has`-trap test in `test/export.test.ts`.

## References

- `packages/worker-thread/src/index.ts` — the authoritative barrel
- `packages/worker-thread/AGENTS.md` — module map and terminology
- `references/errors-visibility.md` — `setDefault` / `onError` wiring
- `references/platform-runtime.md` — `normalize` platform behavior
- `references/rpc-naming.md` — the `mtd*` dispatch contract
