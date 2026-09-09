# txn-transactions

One writer at a time — batch work into few transactions with sync callbacks.

## Why

LMDB has exclusive-writer semantics; lmdb-js batches same-turn writes, and the wrapper serializes transactions through a queue. Async callbacks hold the writer lock across microtasks; sync callbacks commit in the same event turn.

## Incorrect

```typescript
// read-then-write without a transaction: interleaving writer corrupts intent
const cur = users.get(`u1`)
await users.put(`u1`, {...cur, age: cur.age + 1})
// async callback: holds the exclusive lock across awaits
await env.transaction(async () => { await users.put(`a`, x); await logs.put(`b`, y) })
```

## Correct

```typescript
await env.transaction(() => {
  const cur = users.get(`k0`, undefined) // reads see the txn snapshot via tx passthrough where needed
  users.putSync(`k0`, {...cur, age: (cur?.age ?? 0) + 1})
})
await env.readTransaction(async () => {
  // every read pinned to one snapshot — batch reports and exports
})
```

## Notes

- Cross-repo atomicity is free inside one `env.transaction()` — no 2PC.
- `findByIndex(query, tx, {limit})` keeps point reads and batch fetches on the snapshot; the sequential path is used under pinning because native batch cannot take a txn.
- Never `await` inside a transaction callback unless you accept holding the writer lock.
