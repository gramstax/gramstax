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

## Incorrect

```typescript
pool.add(w); pool.add(w) // old code: threadCount 2, one live worker, leaked listener
for (const w of workers) pool.add(w) // then never killAll: threads + sockets linger
```

## Correct

```typescript
const pool = new WorkerThreadPool(workers) // addMany once
// ... dispatch ...
pool.killAll() // every worker terminated, errors aggregated not aborted
pool.threadCount // live workers only
```

## Notes

- Exited workers remove themselves via the stored exit handler — no polling.
- `getInstance(threadId)` returns the live handle or `undefined`; `request`
  on it throws for unknown ids (see `pool-dispatch`).
- Mock-based pool tests prove accounting; real-worker tests prove dispatch.
