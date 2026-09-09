# txn-queue

One queue = one schema; every op is a single synchronous transaction.

## Why

`enqueue` bumps the monotonic counter and writes the payload in ONE `transactionSync`; `dequeue` reads the head and deletes it in ONE `transactionSync`. FIFO survives crashes and cross-process contention because there is no window between counter and payload.

## Incorrect

```typescript
// counter bump and payload in separate transactions: crash between them = gap or dup
await meta.put(`seq`, n + 1)
await queue.put(id, job)
```

## Correct

```typescript
const queue = new LmdbQueue(env, JobSchema) // idempotent: reuses registration
const id = await queue.enqueue({type: `email`, data: {to: `a@b.c`}})
const head = await queue.peek() // inspect without removing
const job = await queue.dequeue() // atomic read + delete (at-least-once)
await queue.clear() // drain
```

## Notes

- Queue payload shape is the schema `value`; the sequence counter lives in `__queue_meta` (counts toward `maxDbs`).
- At-least-once semantics: a crash between dequeue-read and commit can redeliver — consumers must be idempotent.
