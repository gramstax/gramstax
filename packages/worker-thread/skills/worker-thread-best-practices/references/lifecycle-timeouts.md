# lifecycle-timeouts.md

Verdict: omitting `timeoutMs` applies the 30s instance default — pass
`timeoutMs: 0` for genuinely long tasks.

## Why

Omitting `timeoutMs` does NOT wait forever: the call applies the 30s instance default (`DEFAULT_REQUEST_TIMEOUT_MS`, `src/rpc.ts:31`) and the caller rejects while the handler keeps running — a retry then DOUBLE-EXECUTES, which is the single most expensive mistake in this file.
A timeout rejects the caller AND deletes the pending map entry, so the pending map cannot grow unbounded no matter how many peers never answer.
The timer is `unref()`d (`src/rpc.ts:443`) so a pending request never pins the process open, and `0` opts a genuinely long task OUT of the timeout entirely — while any other value must be a non-negative finite number or `WorkerThreadRpc.assertTimeout` (`src/rpc.ts:184`, `@internal`) throws `TypeError`.
When a worker exits, ALL pending requests reject automatically and `ready()` rejects when the crash happened before the ready signal — and `kill()` never runs `onBeforeExit()`, only `shutdown()` does.

## Timeout precedence

| Source | Value | Effect |
| --- | --- | --- |
| Per-call `timeoutMs` | e.g. `500` | this call rejects after 500ms; the pending entry is cleaned (`src/rpc.ts:415`) |
| Instance `defaultTimeoutMs` | assignable, initialized from `DEFAULT_REQUEST_TIMEOUT_MS` (`src/rpc.ts:154`) | applies to every call that omits `timeoutMs` |
| Omitted everywhere | `30000` (`DEFAULT_REQUEST_TIMEOUT_MS`, `src/rpc.ts:31`) | caller rejects at 30s WHILE THE HANDLER KEEPS RUNNING |
| `timeoutMs: 0` | `0` | opts OUT — waits indefinitely, for genuinely long tasks |
| Negative / `NaN` / non-number | invalid | `WorkerThreadRpc.assertTimeout` throws `TypeError` (`src/rpc.ts:184`, `@internal`) |

Resolution is `effectiveTimeout = timeoutMs ?? this.defaultTimeoutMs`: per-call wins only when defined, and the `??` (not `||`) is why `0` survives as the opt-out instead of collapsing to the default.
`makeRequest(method, params, wait, others?, timeoutMs?)` takes exactly five parameters — there is no options object and no `AbortSignal`.

## The double-execution timeline

```
t=0s    caller: request(`mtdBroadcast`, [tenThousandUsers]) — no `timeoutMs`, 30s default applies
t=30s   caller: REJECTS with timeout — pending entry deleted, but the handler is untouched
        handler: STILL RUNNING (the timeout never reaches the worker)
t=31s   caller: retries the broadcast — a SECOND handler invocation starts
t=35s   handler #1 completes: ten thousand users mailed
t=40s   handler #2 completes: the same ten thousand users mailed AGAIN
```

The fix is never just a longer timeout: either opt out with `0` for tasks you know are slow, or make the handler idempotent so a retry is safe — because any timeout, however long, only ever rejects the caller.

## Every way a request can end

| Ending | Who settles the caller | Pending entry | Handler |
| --- | --- | --- | --- |
| Resolve | callee replies with the result | deleted | ran exactly once |
| Timeout | the `unref()`d timer rejects the caller | deleted — the map cannot grow unbounded | KEEPS RUNNING — a retry double-executes |
| Worker exit | `rejectAllPending` rejects every waiter (`src/rpc.ts:486`) | all deleted at once | dead with the worker |
| Crash before ready | `ready()` rejects (`launch.ts:196`) | never created | never started |
| Fire-and-forget (`wait: false`) | nobody — there is no waiter | none | runs; a crash loses it silently |

## Incorrect

```typescript
// wrong: no `timeoutMs` means the caller rejects at 30s while the handler
// keeps running — so this retry mails every user TWICE (see the timeline above)
await worker.request(`mtdBroadcast`, [tenThousandUsers])
await worker.request(`mtdBroadcast`, [tenThousandUsers]) // wrong: double-execution, make the handler idempotent or pass `0`
```

```typescript
// wrong: negative timeouts never reach the worker — validation throws first
await worker.request(`mtdFast`, [], true, undefined, -1) // wrong: `TypeError` from `assertTimeout`, the call never dispatches
```

```typescript
// wrong: the timeout only rejects the CALLER — the handler keeps running, so
// `kill()` here also skips `onBeforeExit()` and the work is left half-applied
await worker.request(`mtdSlow`, [job], true, undefined, 500).catch(() => worker.kill()) // wrong: caller-side reject mistaken for handler cancellation
```

## Correct

```typescript
await worker.request(`mtdBroadcast`, [users], true, undefined, 0) // correct: opt out — waits indefinitely for a genuinely long task
await worker.request(`mtdFast`, [], true, undefined, 500) // correct: bounded — rejects after 500ms, entry cleaned
```

```typescript
worker.rpc.defaultTimeoutMs = 10_000 // correct: every omitted-`timeoutMs` call now bounds at 10s; an explicit per-call `timeoutMs` still wins when defined
await worker.request(`mtdSteady`, [job]) // correct: rejects at 10s instead of 30s, entry cleaned
```

```typescript
// correct: idempotent handler — safe under at-least-once retry whether the
// retry comes from a caller-side timeout or a gateway redelivery
async mtdBroadcast(users: User[]) {
  const fresh = await this.dedupe(users) // correct: second execution is a no-op for already-mailed users
  return await this.mailAll(fresh)
}
```

## Notes

- Pool `execute`/`broadcastRequest` forward `timeoutMs` to the same default.
- Crash-before-ready rejects `ready()`; exit rejects all pending requests.
- Fire-and-forget (`wait: false`) has no waiter — a crash loses it silently.
- The gateway replays in-flight requests across reconnects, so the same double-execution hazard applies there — idempotent handlers cover both transports.
- Locked by `test/rpc.test.ts`: `calls unref on the timer right after creation` (the timer cannot hold the process open) and the send-failure routing tests `reports synchronous send throws from make()` / `reports async send rejections from make()` (a refused send fails the request instead of leaving it pending).
- Lifecycle pairing (`kill()` vs `shutdown()`, the `ready()` contract) — see `lifecycle-lifecycle.md`; pool dispatch and broadcast fan-out — see the pool rules.
