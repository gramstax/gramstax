# txn-queue

One queue = one schema; every op is a single synchronous transaction.

## Why

`enqueue` bumps the monotonic counter and writes the payload in ONE `rootTransactionSync`; `dequeue` reads the head and deletes it in ONE `rootTransactionSync`. FIFO survives crashes and cross-process contention because there is no window between counter and payload. A split commit would leave gaps (counter bumped, payload missing) or duplicates (payload written, counter lost). The single sync txn removes the window instead of recovering from it.

## What commits together

`enqueue` (`queue.ts:130`) runs five steps inside one synchronous transaction:

| Step | Op |
| --- | --- |
| 1 | `rootTransactionSync` opens one sync write txn |
| 2 | read counter `__queue_seq_<db>` from `__queue_meta` (`get`, `?? 0`) |
| 3 | `putSync` the bumped counter |
| 4 | `String(next).padStart(12, `0`)` derives the id (`queue.ts:135`) |
| 5 | `putSync` the payload under that id, commit makes both visible atomically |

`dequeue` (`queue.ts:175`) mirrors it: `getKeys({limit: 1})` through a synchronous cursor (never an async `first()` held across a microtask), `get` the payload, `removeSync` the id, so read and delete commit as one. An empty queue returns `undefined` and never throws.

## Sync versus async members

| Member | Kind | Notes |
| --- | --- | --- |
| `peek()` | sync | cursor + `get`, head without removing, never takes the write lock |
| `size()` | sync | O(1) `count()` stat read |
| `enqueue(job)` | async | wraps one sync txn, still `await` it |
| `dequeue()` | async | wraps one sync txn, at-least-once, see below |
| `clear()` | async | drain |

The sync members observe while only the async three mutate. The `await` on them is ordering, not work, since the commit itself never crosses a microtask.

## Incorrect

```typescript
// wrong: two commits with a crash window between them, gap or duplicate on failure
// wrong: FIFO needs counter and payload in ONE sync txn, which only `enqueue` provides
await meta.put(`seq`, n + 1)
await queue.put(id, job)
```

```typescript
// wrong: queue ids are zero-padded strings, so a number key breaks the id contract
// wrong: keys must be string-kind (`t.string()` or a string enum), `IQueueSchema` enforces it at the type level
class JobSchema extends LmdbSchema {
  static db = `jobs`
  static key = t.number()
  static value = {type: t.string()}
}
```

```typescript
// wrong: `IQueueSchema` is a constraint type, not a base class, so there is nothing to extend
// wrong: declare your own schema class, the `LmdbQueue` generic checks its key kind
class JobSchema extends IQueueSchema {
  static db = `jobs`
}
```

## Correct

```typescript
// correct: one schema per queue, `static db` is the queue name and `value` is the payload row
// correct: construction is idempotent, a second `LmdbQueue` with the same schema reuses the sub
const queue = new LmdbQueue(env, JobSchema)
const id = await queue.enqueue({type: `email`, data: {to: `a@b.c`}})
const head = queue.peek()
const next = await queue.dequeue()
const n = queue.size()
await queue.clear()
```

```typescript
// correct: at-least-once delivery, a crash between dequeue-read and commit redelivers
// correct: consumers stay idempotent, key side effects by id and skip already-seen ids
const seen = new Set<string>()
let next = await queue.dequeue()
while (next !== undefined) {
  const [id, job] = next
  if (!seen.has(id)) {
    await sendEmail(job)
    seen.add(id)
  }
  next = await queue.dequeue()
}
```

## Notes

- Queue payload shape is the schema `value`; the sequence counter lives in `__queue_meta` under key `__queue_seq_<db>` and counts toward `maxDbs`; ids are zero-padded to 12 (`String(n).padStart(12, `0`)`, `queue.ts:135`).
- At-least-once semantics: a crash between dequeue-read and commit can redeliver, so consumers must be idempotent.
- Single-key atomicity without a queue is cheaper, so reach for `env.transaction()` with a sync callback (see `txn-transactions.md`).
- Locks: `test/queue.test.ts` and `test/queue.v2.test.ts` cover the single-txn enqueue/dequeue contract and idempotent construction.
