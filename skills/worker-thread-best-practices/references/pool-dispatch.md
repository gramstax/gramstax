# pool-dispatch.md

Verdict: call the worker's own method on the pool — `pool.mtdX(...args)` — and
put the fan-out in the trailing options object: no options for round-robin,
`{mode: "broadcast"}` for fail-fast fan-out, `{mode: "settled"}` when one
failure must not hide the rest.

## Why

A pool is called the way a single worker is called. The constructor returns a
`Proxy` (`pool.ts:139`), and every property whose name starts with `mtd`
resolves to a memoised dispatch closure (`pool.ts:90-104`), so
`pool.mtdAdd(2, 3)` is the pool-wide equivalent of `EchoWorker.mtdAdd(2, 3)`.
The string form still exists underneath and is what the proxy calls —

| Proxy call | Routes to |
| --- | --- |
| `pool.mtdX(...args)` | `execute(method, params, timeoutMs?)` |
| `pool.mtdX(...args, {mode: "broadcast"})` | `broadcastRequest(method, params, timeoutMs?)` |
| `pool.mtdX(...args, {mode: "settled"})` | `broadcastSettled(method, params, timeoutMs?)` |

Reach for the string form only when the method name is genuinely dynamic or
when a worker parameter would collide with the trailing options object (see
"The trailing options object" below). Targeted dispatch keeps
`pool.request(threadId, …)` — the proxy has no way to express "this one
worker".

## Construction and inference

`launchWorker()` returns `WorkerThreadLaunch & IWorkerThreadWorkerClass<T>`. The
second half is a phantom (optional `__workerClass`, never assigned at runtime)
that survives the trip through an array, so the pool infers the worker class
from the handles it is given:

```typescript
const pool = new WorkerThreadPool(
  await Promise.all([1, 2, 3].map(() => EchoWorker.launchWorker()))
)
// no type argument, no cast: pool.mtdAdd(2, 3) is typed Promise<number>
```

Every mode returns a `Promise` — `await` it. Without `await` the request still
dispatches, but the result is dropped and a rejection surfaces as an unhandled
rejection; for true fire-and-forget use `pool.request(threadId, "mtdX", params,
false)`, which the proxy does not expose.

`new WorkerThreadPool<Worker>(workers)` still compiles when the array has
already been widened to plain `WorkerThreadLaunch[]` and the phantom is gone —
but then the type argument is doing the work, not inference.

## Dispatch modes

| Call | Substrate (`pool.ts`) | Fan-out | Return shape | Fails when |
| --- | --- | --- | --- | --- |
| `pool.mtdX(…args)` | `execute` (`:412`) | one worker, round-robin | the picked worker's response | empty pool; the picked worker rejects |
| `pool.mtdX(…args, {mode: "broadcast"})` | `broadcastRequest` (`:325`) | every worker via `Promise.all` | `unknown[]` in insertion order | empty pool; ANY worker rejects (fail-fast, other results discarded) |
| `pool.mtdX(…args, {mode: "settled"})` | `broadcastSettled` (`:362`) | every worker, settled one by one | `Array<{threadId, ok, result?, error?}>` | empty pool only; a peer failure becomes an envelope |
| `pool.request(threadId, "mtdX", params)` | `request` (`:448`) | one pinned worker | that worker's response | `unknown threadId` |

The proxy is typed from the worker class: only `mtd*` members appear in the
type, and the result shape follows the mode literal. The runtime filter is the
prefix alone — any `mtd*` property is dispatched, so a typo in the method name
fails at the worker as an unknown method, not with `TypeError` on the pool.

## The trailing options object

`{mode?, timeoutMs?}` is always the **last** argument, after the worker's own
arguments:

- **A worker method with a trailing optional parameter owns that position
  first.** Pass a placeholder to reach the options:
  `pool.mtdBroadcast(text, undefined, {mode: "broadcast"})`.
- **Pass `mode` inline as a literal.** Widening it to
  `IWorkerThreadPoolMode` widens the result to a union of all three shapes:
  `const mode: IWorkerThreadPoolMode = "broadcast"` loses the `Promise<R[]>`
  typing.
- **The runtime identifies options by key, not by position alone.**
  `_isPoolOptions` (`pool.ts:71`) treats a trailing plain object as options when
  it carries `mode` or `timeoutMs`; an unrecognised `mode` throws instead of
  silently falling back to round-robin. A worker parameter whose own keys are
  `mode`/`timeoutMs` therefore collides — call that method through
  `pool.execute("mtdX", [param])` instead.
- **`timeoutMs` rides in the same object** and is forwarded to the underlying
  RPC request — `0` opts out of the 30s default, exactly as it does for a
  single worker (see `lifecycle-timeouts`).

## Round-robin fairness and the empty pool

`execute` claims indices synchronously, so concurrent dispatches never collide.
The cursor is an index into a per-call snapshot (`Array.from` at `:413`), so
concurrent calls each see a stable list; after a shrink the cursor is
rebalanced with modulo against the live size (`:417`) — dispatch stays strictly
round-robin from the rebalanced position, but the pre-shrink phase is not
preserved. Fairness is positional, not load-aware: a slow worker still takes its
turn.

Every mode fails fast on an empty pool — there is no worker to dispatch to:

```text
WorkerThreadPool is empty — add workers before calling execute()
WorkerThreadPool is empty — add workers before calling broadcastRequest()
WorkerThreadPool is empty — add workers before calling broadcastSettled()
```

Broadcast still routes through the main thread by design — it fans out over
`parentPort` RPC, never over the inter-worker gateway.

## Incorrect

```typescript
// wrong: a sweep needs every outcome; one down worker rejects the whole call
await pool.mtdGetStatus({mode: "broadcast"}) // w2 down → w1/w3 results lost
```

```typescript
// wrong: the 30s RPC default rejects a legit long task mid-run
// wrong: the handler keeps running, so a retry double-executes the work
await pool.mtdHeavy(x) // caller rejects at 30s, work still runs
```

```typescript
// wrong: options must be last; this object occupies the worker's optional slot
// mtdBroadcast(text: string, key?: string)
await pool.mtdBroadcast(text, {mode: "broadcast"}) // TS2345

// wrong: widening the mode loses the mode-specific result type
const mode: IWorkerThreadPoolMode = "broadcast"
const results = await pool.mtdAdd(2, 3, {mode}) // Promise<number | number[] | Outcome[]>
```

```typescript
// wrong: only `mtd*` methods exist on the pool surface
await pool.getStatus() // TypeError: pool.getStatus is not a function
```

## Correct

```typescript
// correct: no options means round-robin — one worker per call
const pool = new WorkerThreadPool(
  await Promise.all([1, 2, 3].map(() => EchoWorker.launchWorker()))
)
console.log(await pool.mtdAdd(2, 3)) // 5, from the next worker in rotation
```

```typescript
// correct: per-worker envelopes survive individual failures
const settled = await pool.mtdGetStatus({mode: "settled"}) // never rejects per worker
for (const outcome of settled) {
  if (outcome.ok) console.log(outcome.threadId, outcome.result)
  else console.error(outcome.threadId, outcome.error)
}
```

```typescript
// correct: all-or-nothing fan-out is the one job broadcast owns
const configs = await pool.mtdApplyConfig(cfg, {mode: "broadcast"}) // barrier push
```

```typescript
// correct: opt a long task out of the 30s default with `0`
await pool.mtdHeavy(x, {timeoutMs: 0}) // no caller-side timeout

// correct: a placeholder reaches the options past a trailing optional parameter
await pool.mtdBroadcast(text, undefined, {mode: "broadcast"})
```

```typescript
// correct: pin follow-up work to a known worker, never re-roll the cursor
const worker = pool.getInstance(threadId) // live handle or `undefined`
if (worker !== undefined) { // presence check before the pinned call
  await pool.request(threadId, "mtdJobStatus", [jobId]) // same worker
}
```

## Notes

- Empty pool: every mode throws — fail fast, loudly.
- `request(threadId, …)` throws on unknown id (typos surface, never `undefined`).
- Dispatch order is round-robin and locked by test — never "optimize" it. Locks:
  `dispatches round-robin across all workers` and `wraps around to the first
  worker` (`test/pool.test.ts`), plus `bare mtd call goes round-robin`
  (`test/pool-proxy.test.ts`).
- The dispatch closure is memoised per method (`pool.ts:90-104`), so
  `pool.mtdX` is a stable reference — reading it in a hot loop does not
  re-allocate.
- `pool.mtdX` mirrors a single-worker call, so transport concerns stay the
  same: serializability (`rpc-payloads`), timeout defaults
  (`lifecycle-timeouts`), and crash/kill races (`lifecycle-lifecycle`).
- Membership — `add`/`addMany` return ids, `kill`/`killAll` are async,
  `threadCount` is live-only — belongs to `pool-membership`.
