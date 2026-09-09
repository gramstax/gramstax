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

## Incorrect

```typescript
await pool.broadcastRequest(`getStatus`, []) // w2 down → w1/w3 results lost
await pool.execute(`mtdHeavy`, [x]) // 30s default may reject a legit long task
```

## Correct

```typescript
const settled = await pool.broadcastSettled(`getStatus`, []) // per-worker outcomes
await pool.execute(`mtdHeavy`, [x], 0) // opt out for long tasks
```

## Notes

- Empty pool: `execute` throws, `broadcastSettled` rejects — fail fast, loudly.
- `request(threadId, …)` throws on unknown id (typos surface, never `undefined`).
- Dispatch order is round-robin and locked by test — never "optimize" it.
