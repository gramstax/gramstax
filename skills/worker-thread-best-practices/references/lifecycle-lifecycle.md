# lifecycle-lifecycle.md

Verdict: follow launch → ready → request → shutdown; `kill()` is for dead
workers only, never the happy path.

## Why

`shutdown()` sends the `shutdown` RPC so the worker runs `onBeforeExit()` — flush state, persist data, close gateway sockets — before the main thread terminates it (`launch.ts:354`); `kill()` calls `terminate()` immediately with no drain hook (`launch.ts:324`), so sockets leak and in-flight writes die mid-frame.
Concurrent `shutdown()` calls share one in-flight drain through `_shutdownPromise`, which makes it idempotent: a second call returns the same promise instead of re-running the hook, and a call on an exited worker resolves immediately with no 5s stall.
`ready()` rejects when the worker exits before signaling ready (`launch.ts:196`), and the `exit` handler rejects every pending RPC — so a dead worker fails loudly instead of hanging its callers.
On the worker side, `send()` returns `false` — never throws — when there is no `parentPort` (`init.ts:217`), while the main-thread `send()` throws once the worker is exiting or exited (`launch.ts:393`).

## The five phases

| Phase | Main thread (`launch.ts`) | Worker (`init.ts`) | Guarantee | How it fails |
| --- | --- | --- | --- | --- |
| `spawn` | `constructor(path, argv)` (`:165`) validates `path` in `init()` (`:229`) | constructor (`:161`): `init()` → build `rpc` → defer the ready signal | an empty path throws before any thread spawns | a bad path is a constructor throw, never a hung `ready()` |
| `ready` | `ready()` (`:196`), resolved exactly once by `readyResolve()` (`:212`) via `_readyResolved` | `queueMicrotask` defers the `readyResolve` send until subclass fields exist | the signal lands after subclass field initializers exist | crash-before-ready rejects `ready()`; `ready()` after exit rejects with the stored `exitCode` |
| `request` | `send()` (`:393`) throws when exiting/exited; `request()` (`:421`) | `handleOnMessage` (`:197`) → `rpc.make(data).catch(err => this.onError(err))` | every message is dispatched or routed to `onError()` → `WorkerThreadErrorHandler.report` (`:125`) | `send()` after exit throws; worker-side `send()` with no `parentPort` returns `false` |
| `shutdown` | `shutdown(timeoutMs = 5000)` (`:354`) sends the `shutdown` RPC, then `kill()` | `shutdown()` (`:344`) awaits `onBeforeExit()` (`:116`), then closes the gateway server and EVERY client in a `finally` and clears the maps | the hook runs at most once (`_shutdownDone`); gateway cleanup always runs even when the hook throws | hook exceeds `timeoutMs` → force-terminated; call on an exited worker → resolves immediately |
| `exit` | `exit` handler rejects all pending RPCs, rejects `ready()` when unresolved, detaches SIGINT/SIGTERM (`:266` / `:270`) | thread terminated | no caller hangs: every waiter settles | `kill()` on an exited worker resolves immediately instead of hanging in `terminate()` |

## `kill()` vs `shutdown()`

| | `kill()` (`launch.ts:324`) | `shutdown()` (`launch.ts:354`) |
| --- | --- | --- |
| Drain hook | never runs — `onBeforeExit()` is skipped | runs `onBeforeExit()` (`init.ts:116`) inside the worker first |
| Gateway | server socket and clients leak | server closed, every client closed, maps cleared (`init.ts:344`) |
| Force | immediate `terminate()` | waits `timeoutMs` (default `5000`), then force-terminates |
| Repeat calls | guarded by `_exited` only | guarded by `_exited` AND `_shutdownPromise` — concurrent callers share one drain |
| Signal handlers | detached (`launch.ts:266`) | detached, via the `kill()` tail |
| Use when | the worker is wedged and the drain will never answer | every happy path, and anything holding sockets or unsaved state |

## Construction order is load-bearing

The `WorkerThreadInit` constructor (`init.ts:161`) runs, IN THIS ORDER: `this.init()` (`init.ts:182`, guarded by `_initDone` so duplicate listeners cannot attach) → `this.rpc = new WorkerThreadRpc(this.send.bind(this), …)` → `queueMicrotask` defers the `readyResolve` send.
The deferral is the point: the class-field JSDoc (`init.ts:158-159`) states that subclass field initializers run after `super()` returns but BEFORE main-thread RPCs can observe worker state, so the ready signal waits a microtask until those fields exist.
Signal ready synchronously and the main thread can invoke an `mtd*` method whose backing field is still `undefined`.
The error path mirrors the same care: `handleOnMessage` (`launch.ts:282`) routes failures through `_safeEmitError`, which checks `this.listenerCount(`error`) > 0` (`launch.ts:301`) and only falls through to the package-wide handler when the count is zero.

## `argv` slots

`WorkerThreadExport.init` passes `[uniqueArg, ...userArgs]` where `uniqueArg` is `` `for-${path}` `` (`export.ts:239`):

```
process.argv: [runtime, file, `for-<path>`, ...userArgs]
                 [0]     [1]       [2]           [3]+
worker view:  this.argv[3]... are the user's values (`init.ts:49`)
```

`launchWorker` normalizes an explicit `[undefined]` to no arguments (`launch.ts:175`), so only `launchWorker` owns this convention — hand-rolled `argv` risks the worker misdetecting itself and spawning nested.

## Incorrect

```typescript
const worker = await Job.launchWorker()
// wrong: happy-path `kill()` skips `onBeforeExit()` — unsaved state is lost
// wrong: the gateway server socket and clients leak (only `shutdown()` closes them)
await worker.kill()
```

```typescript
await worker.kill()
// wrong: `ready()` rejects after death (it stores the `exitCode`) — this line
// throws instead of confirming health, so poll `exited`, never `ready()`
await worker.ready()
```

```typescript
// wrong: raw construction bypasses the export routing convention — only
// `launchWorker` owns the `[uniqueArg, ...userArgs]` slot layout, so a
// hand-rolled `argv` risks the worker misdetecting itself and spawning nested
const worker = new WorkerThreadLaunch(file, [undefined])
```

## Correct

```typescript
const worker = await Job.launchWorker()
await worker.ready() // correct: rejects if the worker crashed before signaling
await Job.mtdCompute(1)
await worker.shutdown(5_000) // correct: drains `onBeforeExit`, closes gateway, terminates
```

```typescript
// correct: `kill()` is the escape hatch for a wedged worker whose drain hook
// will never answer — and the `error` listener keeps the failure observable
worker.on(`error`, (err) => log.error(err)) // correct: with a listener the error is emitted; with zero listeners it falls through to the package-wide handler (`launch.ts:301`)
await worker.kill() // correct: immediate `terminate()`, no cleanup attempted
```

```typescript
// correct: override the drain hook — `shutdown()` runs it at most once
// (`_shutdownDone`), and the gateway cleanup in the `finally` always runs
// even when the hook throws (`init.ts:344`)
class FlushWorker extends WorkerThreadInit {
  async onBeforeExit() {
    await this.flushState() // correct: persist state and close connections here — never in `kill()`
  }
}
```

## Notes

- `ready()` rejects after death (stores `exitCode`); poll `exited`, not `ready()`.
- `argv` slots: `export` reserves `process.argv[2]` for its routing token — user args start at `argv[3]`; explicit `[undefined]` normalizes to no-args.
- `shutdown()` on an exited worker resolves immediately (no 5s stall).
- `init()` (`init.ts:182`) re-attaches only when the port changed (`_initPort` check), and `createGatewayServer` (`init.ts:277`) throws when `register` is omitted without a non-empty `allowedMethods` — it closes any previous server first so a socket never leaks; `createGatewayClient` (`init.ts:309`) replaces and closes the existing client per path.
- Locked by `test/launch.test.ts`: crash/kill race, `shutdown()` idempotency, SIGINT/SIGTERM listener removal, `send` after exit.
- Timeouts bound every `request()` — see `lifecycle-timeouts.md`; pool dispatch and broadcast fan-out — see the pool rules.
