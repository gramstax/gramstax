# errors-visibility.md

Verdict: install one package-wide handler at process start; the default
is a silent drop and the library never logs on its own.

## Why

**1. The default is a silent drop.** `WorkerThreadErrorHandler._default`
starts as `() => {}`. The library NEVER writes to the console — by design,
so it stays embeddable in a host app that owns its own logging.
Consequence: a worker error with no handler installed disappears with zero
output. This is the package's most common production surprise, so wire a
handler before launching anything. See `references/lifecycle-lifecycle.md`
for where those errors originate in the launch → ready → shutdown flow.

**2. One call covers everything.** `WorkerThreadErrorHandler.setDefault(fn)`
routes every error reported by `WorkerThreadLaunch`, `WorkerThreadInit`,
`WorkerThreadPool`, and gateway peers — 7 call sites across `rpc.ts` (3),
`init.ts` (1), `launch.ts` (1), `gateway-client.ts` (1), and
`gateway-server.ts` (1). Passing `undefined` resets to the silent drop,
and `WorkerThreadErrorHandler.resetDefault()` does the same explicitly. A
non-function non-undefined argument throws `TypeError`.

**3. Per-instance `error` listeners win.** `WorkerThreadLaunch` extends
`EventEmitter`; inside `handleOnMessage` it checks the `error` listener
count first and only falls through to the package-wide default when the
count is zero. When at least one `error` listener exists the error goes
there instead. Use this for per-worker routing, but keep the package-wide
handler as the safety net for workers you forgot to attach to.

**4. The `onError` override trap.** `WorkerThreadInit.onError(err)`
defaults to calling `WorkerThreadErrorHandler.report(err)`. If you
override `onError` and do NOT call `report` (or your own logging), you
silently break package-wide observability. The source JSDoc on `onError`
names `report(err)` as the call that preserves package-wide
observability. The `Correct` block below shows the override that logs
AND preserves routing. Related middleware mistakes live in
`references/rpc-middleware.md`.

**5. `report()` is tagged `@internal` — reach it through the class, not as a routing entry point.** The tag means "not part of the stable public API", so do not treat `report` as the way you route errors: that is `setDefault`'s job. But calling it from inside an `onError` override is exactly what the maintainers intend, and the `Correct` block does precisely that. The barrel does `export *` from `./error-handler`, so the symbol is reachable at runtime — `@internal` here is an intent marker, not access control. See `references/maintain-api-surface.md` for the full `@public` / `@internal` convention.

**6. A throwing handler cannot crash the transport.** `report()` wraps
the call in try/catch and swallows any throw from a user handler, so a
buggy logger never takes down the RPC dispatcher or gateway peer that
reported the error. Consequence: a bug inside your own error handler is
invisible — keep handlers trivial (format + write) and never let them
throw. Gateway reconnect behavior that depends on these reports is
covered in `references/gateway-reliability.md`.

## Error-routing decision table

Three routing layers exist. Only one of them sees any given error, and the
order is fixed — check them top-down when an error goes missing:

| Layer | Where it is checked | Who sees the error | When it fires |
|---|---|---|---|
| Per-instance `error` listener | `WorkerThreadLaunch.handleOnMessage` checks `this.listenerCount('error') > 0` first | only that worker's listener | at least one `error` listener is attached to that instance |
| Package-wide default | `WorkerThreadErrorHandler.report(err)` fall-through | the `setDefault` handler | no per-instance listener exists on that worker |
| `onError` override | `WorkerThreadInit.onError(err)` defaults to `report(err)` | whatever the override calls | worker-side RPC handling raises; override replaces the default |

Precedence is short-circuit: a per-instance listener consumes the error and
the package-wide default never runs for it. An `onError` override that never
calls `report` removes the worker side from the chain entirely — neither the
listener nor the default ever sees that error.

## Silent-failure symptom table

When output is missing, the symptom tells you which layer misfired:

| Symptom | Broken layer | Fix |
|---|---|---|
| RPC fails, zero output anywhere | no `setDefault`, no `error` listener — the silent drop ate it | install `setDefault` at process start |
| One worker is silent, others log | that worker has an `error` listener that swallows | audit that listener, keep the package-wide default as safety net |
| Worker-side errors vanish, main-side errors log | `onError` override dropped the `report(err)` call | add `WorkerThreadErrorHandler.report(err)` back into the override |
| Handler itself seems dead, no crash either | the handler throws and `report()` swallowed it | keep handlers trivial, unit-test the handler with a direct call |

## Incorrect

```typescript
import {WorkerThreadExport} from "@gramstax/worker-thread"

class SilentWorker extends WorkerThreadInit {
  // wrong: never logged, never reported — observability broken package-wide
  override onError(_err: unknown): void {}
}

const Job = WorkerThreadExport.init({path: __filename, WTInit: SilentWorker})
await Job.launchWorker() // wrong: no setDefault, no error listener — silent drop
await Job.mtdBoom() // wrong: fails with zero output anywhere
```

```typescript
import {WorkerThreadErrorHandler} from "@gramstax/worker-thread"

// wrong: importing report as the routing strategy — setDefault is the entry point
import {report} from "@gramstax/worker-thread"

await Job.launchWorker()
report(new Error(`boom`)) // wrong: manual call, nothing installed to receive it
WorkerThreadErrorHandler.setDefault(`not-a-function` as unknown as (err: unknown) => void) // wrong: throws TypeError
```

```typescript
import {WorkerThreadErrorHandler} from "@gramstax/worker-thread"

// wrong: a throwing handler looks fine — report() swallows it, so the bug is invisible
WorkerThreadErrorHandler.setDefault(() => {
  throw new Error(`logger misconfigured`) // wrong: transport survives, error vanishes
})

const worker = await Job.launchWorker()
await worker.request(`mtdBoom`, []) // wrong: rejects nowhere observable, handler already dead
```

## Correct

```typescript
import {WorkerThreadErrorHandler} from "@gramstax/worker-thread"

// right: one call at process start, before the first launchWorker or gateway connect
WorkerThreadErrorHandler.setDefault((err: unknown) => {
  logger.error(`worker error: ${String(err)}`) // right: trivial format + write, never throws
})
```

```typescript
import {WorkerThreadErrorHandler, WorkerThreadExport, WorkerThreadInit} from "@gramstax/worker-thread"

// right: override logs locally AND preserves package-wide observability
class LoudWorker extends WorkerThreadInit {
  override onError(err: unknown): void {
    logger.error(`worker failure: ${String(err)}`) // right: local context captured
    WorkerThreadErrorHandler.report(err) // right: central routing preserved
  }
}

const Job = WorkerThreadExport.init({path: __filename, WTInit: LoudWorker})
```

```typescript
import {WorkerThreadErrorHandler, WorkerThreadExport} from "@gramstax/worker-thread"

// right: process-start wiring in both main-thread and worker entry points
WorkerThreadErrorHandler.setDefault((err: unknown) => logger.error(String(err)))

const Job = WorkerThreadExport.init({path: __filename, WTInit: MyWorker})
const worker = await Job.launchWorker()
worker.on(`error`, (err: unknown) => {
  logger.error(`thread ${String(worker.threadId)} failed: ${String(err)}`) // right: per-worker detail
})
await Job.mtdBoom() // right: surfaces in the per-instance listener AND stays countable centrally
```

## Notes

- **Copy-paste setup block.** Put this at process start, before the first
  `launchWorker` or gateway `connect`, in both main-thread and worker
  entry points that own logging:
  `WorkerThreadErrorHandler.setDefault((err: unknown) => logger.error(String(err)))`
- **Reset semantics.** `setDefault(undefined)` and `resetDefault()` both
  restore the silent drop; use them in tests to avoid leaking a handler
  across cases, then re-install for the next suite.
- **Migration note.** v2.2.0 replaced the removed free functions
  `setDefaultErrorHandler` / `resetDefaultErrorHandler` / `reportError`
  with the static members `WorkerThreadErrorHandler.setDefault`,
  `resetDefault`, and `report`. The old names no longer exist.
- **Keep handlers total.** Because `report()` swallows handler throws,
  validate the handler itself with a direct call in a unit test rather
  than relying on transport errors to expose it.
- **Locking test.** `test/error-handler.test.ts` pins the silent default,
  the `TypeError` on non-function input, the `undefined` reset path, and
  the try/catch around the handler — change routing only by updating that
  file first.
- **Sibling cross-references.** `references/maintain-api-surface.md` for the
  `@public` / `@internal` convention, `references/lifecycle-lifecycle.md`
  for error origins in the launch flow, `references/gateway-reliability.md`
  for reconnect behavior downstream of these reports.
