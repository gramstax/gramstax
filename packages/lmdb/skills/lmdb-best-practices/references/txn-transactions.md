# txn-transactions

One writer at a time, so batch work into few transactions with sync callbacks.

## Why

LMDB has exclusive-writer semantics; lmdb-js batches same-turn writes, and the wrapper serializes transactions through a queue. Async callbacks hold the writer lock across microtasks while the event loop waits; sync callbacks commit in the same event turn with no promise overhead. Every read-then-write without a transaction is a race: the `get` and the `put` are two separate commits, and an interleaving writer can land between them.

## Which patterns need a transaction

| Pattern | Needs `transaction()` | Reason |
| --- | --- | --- |
| Single `put` / `delete` | no | lmdb async writes are atomic per key |
| `get` then `put` on one key | yes | interleaving writer corrupts intent |
| Writes across repos | yes | one native write txn, otherwise nothing is atomic |
| `putMany` / `importJSONL` batch | no | already chunked and committed per batch |
| Consistent multi-read report | `readTransaction()` | snapshot pinned at open, writers cannot disturb it |

The table is a triage shortcut: single-key writes and chunked bulk imports are already atomic, so wrapping them buys nothing. Everything that reads first and writes second needs the lock.

## Transaction lifecycle

| `lifecycle` | Meaning |
| --- | --- |
| `active` | open, work is allowed |
| `committed` | write txn committed, or `commit()` called |
| `aborted` | `abort()` rolled back the native txn |
| `released` | read txn finished normally, NOT `aborted` (`transaction.ts:222`) |

Members: `tx.done` (true once `lifecycle` leaves `active`), `tx.isCommitted`, `tx.isAborted` (false for normally finished reads), `tx.raw` (the underlying read txn, `undefined` on write txns), `tx.commit()`, `tx.abort()`.

## Sync versus async callbacks

Both flavors are atomic, since the native write txn stays open until the callback settles. The difference is lock duration and batching: a sync callback commits in the same event turn, so queued same-turn writes batch into one native commit; an async callback holds the exclusive lock across every `await`, serializing the whole process behind it. Sub methods are non-async, which makes sync callbacks natural. Reach for `putSync` / `removeSync` inside, and never `await` unless the wait is worth the lock.

## Incorrect

```typescript
// wrong: `get` and `put` are two commits, an interleaving writer lands between them
// wrong: the increment silently loses updates under concurrency
const cur = users.get(`u1`)
await users.put(`u1`, {...cur, count: (cur?.count ?? 0) + 1})
```

```typescript
// wrong: atomic but slow, the exclusive writer lock is held across every `await`
// wrong: the whole process serializes behind this callback
await env.transaction(async () => {
  await users.put(`a`, x)
  await logs.put(`b`, y)
})
```

```typescript
// wrong: a normally finished read txn reports `released`, never `aborted`
// wrong: `isAborted` is false here, so detect failure with throw/catch instead of lifecycle polling
await env.readTransaction(async (tx) => {
  await users.entries({}, tx)
  if (tx.isAborted) {
    throw new Error(`unreachable, reads release, they never abort`)
  }
})
```

## Correct

```typescript
// correct: sync callback commits same-turn, one native txn with no promise overhead
// correct: reads take `tx` so they see the txn snapshot, writes ride `putSync`
await env.transaction((tx) => {
  const cur = users.get(`k0`, tx)
  users.putSync(`k0`, {...cur, count: (cur?.count ?? 0) + 1})
})
```

```typescript
// correct: every read pinned to one snapshot, suited to batch reports and exports
// correct: each read method takes trailing `tx`, so concurrent writers cannot disturb the view
await env.readTransaction(async (tx) => {
  await users.entries({}, tx)
  await logs.count(tx)
})
```

```typescript
// correct: explicit `abort()` rolls back the whole native txn, staged CDC outbox rows publish nothing
// correct: `aftercommit` observes only committed work, `off()` detaches when done
let commits = 0
const onCommit = () => {
  commits++
}
env.on(`aftercommit`, onCommit)
await env.transaction((tx) => {
  users.putSync(`k0`, row)
  if (row.invalid) {
    tx.abort()
  }
})
env.off(`aftercommit`, onCommit)
```

## Notes

- Cross-sub atomicity is free inside one `env.transaction()`, with no 2PC.
- `findByIndex(query, tx, {limit})` keeps point reads and batch fetches on the snapshot; the sequential path is used under pinning because native batch cannot take a txn.
- Never `await` inside a transaction callback unless you accept holding the writer lock.
- Commits publish CDC outbox rows staged in the same txn (`cdc.md`); aborted txns publish nothing.
- Locks: `test/transaction.test.ts` covers sync/async callbacks, abort, and the `released` read lifecycle.
- Queues are single-sync-txn ops built on the same primitives, see `txn-queue.md`.
