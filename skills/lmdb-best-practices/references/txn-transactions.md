# txn-transactions

One writer at a time, so batch work into few transactions with sync callbacks.

## Why

LMDB has exclusive-writer semantics; lmdb-js batches same-turn writes, and the wrapper serializes transactions through a queue. Async callbacks hold the writer lock across microtasks while the event loop waits; sync callbacks leave no `await` inside the open transaction, which is what keeps `abort()` and throw-rollback reliable. Every read-then-write without a transaction is a race: the `get` and the `put` are two separate commits, and an interleaving writer can land between them.

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

Both flavors are atomic, since the native write txn stays open until the callback settles. The difference is lock duration: a sync callback performs its writes and commits without an intervening microtask, so nothing else can interleave; an async callback holds the exclusive lock across every `await`, serializing the whole process behind it. Sub methods are non-async, which makes sync callbacks natural. Reach for `putSync` / `removeSync` inside, and never `await` unless the wait is worth the lock.

An async callback is legal on every method in this package — the signature is `T | Promise<T>` — so this is a recommendation, not a restriction. The concrete cost of ignoring it: an `await` keeps the write transaction open, writes queued by unrelated code during that window are pulled into it, and on `transaction()` a later `abort()` rolls those foreign writes back too.

Note that `env.transaction()` defers to a microtask before the native txn opens — it is not synchronous at the call site. What the sync callback buys is the absence of a microtask *inside* the open transaction.

## `transactionFast`: no rollback

`env.transactionFast()` commits through lmdb-js `db.transaction()`, handing the commit to the writer thread instead of blocking the main thread. Same commit-visibility atomicity, but **no rollback is possible** — that lmdb-js path records a callback error and rethrows it without ever calling `mdb_txn_abort`, so the native txn commits either way.

| | `transaction()` | `transactionFast()` |
| --- | --- | --- |
| `tx.abort()` | rolls back | throws `LmdbError` |
| callback throws | rolls back | writes already made are committed |
| commit blocks main thread | yes | no |

Both failure modes are loud rather than silent, so the mistake cannot pass unnoticed. Use it only where partial application is harmless; the package uses it for `deleteByPrefix`, `putMany` and CDC `pruneCdc`, and deliberately not for unique-index conflict handling, `migrate`, `purgeExpired` or `increment`.

Same rule on `async` callbacks as on `transaction()`, and for the same reason: an `await` holds the write transaction open and pulls in writes queued by other code. Off-thread commit relocates the window rather than shortening it — and here you cannot roll the foreign writes back either. Do not read the softer upstream wording under `db.transactionSync()` as meaning the leak does not apply; measured on this package, both methods leak identically.

## Incorrect

```typescript
// wrong: every `await` holds the single writer lock open, and unrelated
// writes queued meanwhile are pulled into this transaction
await env.transaction(async (tx) => {
  await callSomethingSlow()
  users.putSync(`k0`, row)
})

// wrong: `transactionFast` cannot roll back — these writes are committed, not discarded
await env.transactionFast((tx) => {
  users.putSync(`k0`, row)
  if (!isValid(row)) {
    tx.abort() // throws; and the write above still commits
  }
})

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
// correct: sync callback, one native txn with no microtask inside it
// correct: reads take `tx` so they see the txn snapshot, writes ride `putSync`
await env.transaction((tx) => {
  const cur = users.get(`k0`, tx)
  users.putSync(`k0`, {...cur, count: (cur?.count ?? 0) + 1})
})
```

```typescript
// correct: bulk work that cannot fail partway may commit off the main thread
// correct: `transactionFast` cannot roll back, so NEVER branch on `tx.abort()` here
await env.transactionFast(() => {
  users.putSync(`k0`, row)
  sessions.putSync(`s0`, row)
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
