# pool-dispatch.md

Verdict: `execute` for point work (round-robin), `broadcastRequest` only when
one failure may fail all — else `broadcastSettled`.

## Why

`execute` claims indices synchronously, so concurrent dispatches never collide;
the cursor rebalances on removal but a worker killed between snapshot and
`request()` still gets the call (its rejection surfaces from `launch`).
`broadcastRequest` is fail-fast `Promise.all` with no settlement and no
default timeout of its own — one hung worker hangs the fan-out (it inherits
the 30s RPC default only via pass-through). `broadcastSettled` resolves
per-worker `{threadId, ok, result?, error?}` envelopes and rejects solely on
an empty pool (a programming error, not a worker failure).

## Method selection

| Method (`pool.ts`) | Fan-out | Failure mode | Return shape | Reach for it when |
| --- | --- | --- | --- | --- |
| `execute(method, params, timeoutMs?)` (`:333`) | one worker, round-robin | throws on empty pool; a dead pick rejects via `launch` | the picked worker's response | spreading point work evenly |
| `broadcastRequest(method, params, timeoutMs?)` (`:249`) | every worker via `Promise.all` | FAIL-FAST: first rejection rejects everything, other results discarded | `unknown[]` in insertion order | all-or-nothing fan-out, e.g. a barrier config push |
| `broadcastSettled(method, params, timeoutMs?)` (`:283`) | every worker, settled one by one | never rejects per worker; rejects only on an empty pool | `Array<{threadId, ok, result?, error?}>` | a sweep where one failure must not hide the rest |
| `request(threadId, method, params, _wait, _others?, timeoutMs?)` (`:369`) | one pinned worker | throws `unknown threadId` on a miss | that worker's response | sticky follow-up work on a known worker |

`execute` takes exactly three parameters — no `maxInFlight` option, no
options object, no per-worker concurrency cap. Fairness is positional, not
load-aware: a slow worker still takes its turn in the rotation.

## Round-robin fairness and the empty pool

The cursor is an index into a per-call snapshot (`Array.from` at `:334`), so
concurrent `execute` calls each see a stable list and never dispatch out of
bounds. After a shrink the cursor is rebalanced with modulo against the live
size (`:338`) — dispatch stays strictly round-robin from the rebalanced
position, but the pre-shrink phase is not preserved. An `execute` on an empty
pool throws immediately:

```typescript
`WorkerThreadPool is empty — add workers before calling execute()`
```

Both broadcast methods forward `timeoutMs` to the same 30s RPC default as
`execute` — pass `0` to opt a genuinely long task out. Pool broadcast still
routes through the main thread by design — it fans out over `parentPort` RPC,
never over the inter-worker gateway.

## Incorrect

```typescript
// wrong: fail-fast discards the healthy workers' results when one is down
await pool.broadcastRequest(`getStatus`, []) // w2 down → w1/w3 results lost
```

```typescript
// wrong: the 30s RPC default rejects a legit long task mid-run
// wrong: the handler keeps running, so a retry double-executes the work
await pool.execute(`mtdHeavy`, [x]) // caller rejects at 30s, work still runs
```

```typescript
// wrong: `execute(method, params, timeoutMs?)` takes exactly three parameters
// wrong: no `maxInFlight` exists — fairness stays positional round-robin
await pool.execute(`mtdHeavy`, [x], {maxInFlight: 1})
```

## Correct

```typescript
// correct: per-worker envelopes survive individual failures
const settled = await pool.broadcastSettled(`getStatus`, []) // never rejects per worker
for (const outcome of settled) { // correct: branch on `ok`, log `error` per `threadId`
  if (outcome.ok) console.log(outcome.threadId, outcome.result)
  else console.error(outcome.threadId, outcome.error)
}
```

```typescript
// correct: opt a long task out of the 30s default with `0`
await pool.execute(`mtdHeavy`, [x], 0) // correct: no caller-side timeout
```

```typescript
// correct: all-or-nothing fan-out is the one job `broadcastRequest` owns
const configs = await pool.broadcastRequest(`mtdApplyConfig`, [cfg]) // correct: barrier push
```

```typescript
// correct: pin follow-up work to a known worker, never re-roll the cursor
const worker = pool.getInstance(threadId) // correct: live handle or `undefined`
if (worker !== undefined) { // correct: presence check before the pinned call
  await pool.request(threadId, `mtdJobStatus`, [jobId]) // correct: same worker
}
```

## Notes

- Empty pool: `execute` throws, `broadcastSettled` rejects — fail fast, loudly.
- `request(threadId, …)` throws on unknown id (typos surface, never `undefined`).
- Dispatch order is round-robin and locked by test — never "optimize" it.
- Sequence lock: `regression: execute dispatch order lock` in `test/pool.test.ts`
  pins the round-robin order — a cursor "improvement" that reorders breaks it.
- Timeouts are an RPC concern, not a pool concern — see `lifecycle-timeouts`
  for the 30s default and the `0` opt-out; see `lifecycle-lifecycle` for
  crash/kill races between snapshot and `request()`.
