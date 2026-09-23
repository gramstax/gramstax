# cdc

Subscribe to commits, tail history explicitly — never poll tables.

## Why

Every put/delete appends `{db, type, key, value}` to `__cdc_log` in the same writer transaction (aborts publish nothing, sequences stay gapless). `env.subscribe` delivers post-commit in sequence order; `tailCdc`/`ackCdc` give persistent followers resume across restarts; `pruneCdc` bounds retention by min-ack plus keep-count.

## Incorrect

```typescript
// polling a table for changes — misses deletes, races writers, burns reads
for (;;) { const rows = await users.values(); diff(rows, prev) }
```

## Correct

```typescript
const unsub = env.subscribe(`users`, (e) => mirror.apply(e)) // {type, key, value}
const unsub2 = env.subscribe({db: `users`, op: `put`}, (e) => mirror.apply(e)) // kind-filtered
const batch = await env.tailCdc({consumer: `mirror`}) // {seq, db, type, key, value}
const page = await env.tailCdc({consumer: `mirror`, from: 1000, limit: 500}) // reposition forward + cap
await env.ackCdc(`mirror`, batch[batch.length - 1]!.seq) // unknown consumer throws LmdbError — tail first
await env.pruneCdc() // cutoff min(minAck, newest - keep), default keep 10000; drops entries consumed by every consumer
```

## Notes

- Structural, by construction: same-txn appends make phantom events impossible.
- Capture arms on first subscribe/tail/ack/prune — touch a CDC API at boot; `__`-prefixed internal subs are excluded.
- Deletes carry the key (`value` undefined, except dupSort exact removes); `clear()` emits one `clear` event.
- A throwing subscriber is logged and skipped — it never breaks the writer's commit.
