# pool-membership.md

Verdict: add once, kill explicitly, `killAll` for teardown; `threadCount`
always equals live workers.

## Why

Re-adding the same instance stacked exit listeners and inflated the count
(Map overwrite + unconditional increment) — now guarded: same id replaces
without counting, old listener detached. `kill()` detaches its listener so
late exits cannot double-decrement. `killAll()` snapshots keys (no Iterator
Helpers dependency), isolates per-worker errors into one `AggregateError`,
and resets the cursor. Process SIGINT/SIGTERM handlers are removed on
`kill()`/`exit` — pools no longer trip `MaxListenersExceededWarning`.

## The two-step duplicate check

`add(instance)` at `pool.ts:89` compares by identity first, then by id — the
distinction is the whole point, so read the table before guessing:

| What you pass | Check at `:91` | Check at `:94` | Effect |
| --- | --- | --- | --- |
| same object already registered | `known === instance` hits | skipped | no-op return — no recount, no second listener |
| DIFFERENT object, same `threadId` | misses | `known !== undefined` hits | old listener detached, entry replaced, count unchanged |
| new `threadId` | misses | misses | registered, fresh `exit` listener, `threadCount += 1` |

Re-adding the same object is a no-op. A different object carrying an
already-registered `threadId` **replaces** the entry — the old exit listener is
detached first and `threadCount` is left unchanged, so a swap can never
double-count. Only a genuinely new `threadId` increments it.
Both paths are locked by
`regression: re-add guard (no count inflation, no listener leak)` in
`test/pool.test.ts`, and the detach path by
`regression: kill/remove detaches the stored exit listener`.

## Membership lifecycle

```
add / addMany → live → exit-removes → kill → gone
```

| Transition | Where | What happens |
| --- | --- | --- |
| `addMany(instance[])` (`:120`) | construction / scale-up | fans out to `add()` per worker — same guards, no fast path |
| live | `thread: Map` (`:38`) | `threadCount` (`:46`) reflects LIVE workers only |
| worker exits on its own | `exit` listener at registration | `_onWorkerExit` removes the entry only if the stored instance still matches, then detaches the listener |
| `kill(threadId)` (`:158`) | explicit removal | unknown id returns `undefined` (never throws); known id detaches the listener, terminates, deletes, decrements |
| `getInstance(threadId)` (`:141`) | lookup | live handle or `undefined` — presence-check before a pinned call |
| `killAll()` (`:211`) | teardown | snapshots keys, kills every worker, collects failures into one `AggregateError`, resets the round-robin cursor |

`killAll` never aborts on the first error — one stuck worker cannot strand
the rest. The snapshot matters: removals during the loop cannot skip workers.

## Listener-leak checklist

Every registration installs exactly one `exit` handler, and every removal
path detaches it — audit a change against all four:

- `add()` stores the bound handler in `_exitHandlers` (`:103`) and the
  duplicate-replace path detaches the old one first (`:95`).
- `kill()` detaches before terminating (`:161`), so a late exit from the
  dying worker finds no listener and cannot double-decrement.
- `_onWorkerExit` detaches as it removes (`:188`) — self-cleaning, no polling.
- Per-worker SIGINT/SIGTERM handlers live on the `launch` side
  (`launch.ts:119`) and are removed on `kill`/`exit` (`launch.ts:266`) —
  locked by `(d) kill() removes SIGINT/SIGTERM listeners` in
  `test/launch.test.ts`, so pools never trip `MaxListenersExceededWarning`.

## Incorrect

```typescript
pool.add(w); pool.add(w) // old code: threadCount 2, one live worker, leaked listener
```

```typescript
// wrong: threads and sockets linger past the end of the run
for (const w of workers) pool.add(w) // then never killAll: threads + sockets linger
```

```typescript
// wrong: unknown ids return `undefined` — the throw is on `pool.request`, not here
const dead = pool.getInstance(9999) // wrong: assuming this throws on a miss
await dead.request(`mtdPing`, []) // wrong: `TypeError` on `undefined`, not the pool error
```

## Correct

```typescript
const pool = new WorkerThreadPool<Worker>(workers) // addMany once
// ... dispatch ...
await pool.killAll() // every worker terminated, errors aggregated not aborted
pool.threadCount // live workers only
```

```typescript
// correct: explicit kill per id, unknown ids surface as `undefined`
const killed = pool.kill(threadId) // correct: `threadId` or `undefined`, never throws
if (killed === undefined) console.warn(`already gone: ${threadId}`) // correct: branch the miss
```

```typescript
// correct: presence-check the lookup before a pinned dispatch
const worker = pool.getInstance(threadId) // correct: live handle or `undefined`
if (worker === undefined) return // correct: raced removal handled at the call site
await pool.request(threadId, `mtdWork`, [job]) // correct: throws `unknown threadId` on a miss
```

## Notes

- Exited workers remove themselves via the stored exit handler — no polling.
- `getInstance(threadId)` returns the live handle or `undefined`; `request`
  on it throws for unknown ids (see `pool-dispatch`).
- Mock-based pool tests prove accounting; real-worker tests prove dispatch.
- `killAll` resets the round-robin cursor — post-teardown `execute` order
  restarts from index 0 (see `pool-dispatch`).
- Lifecycle races (crash between snapshot and `request`, `shutdown()`
  idempotency) belong to `lifecycle-lifecycle`; the 30s default behind every
  pool call belongs to `lifecycle-timeouts`.
