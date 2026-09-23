# txn-queue

One queue = one schema; every op is a single synchronous transaction.

## Why

`enqueue` bumps the monotonic counter and writes the payload in ONE `rootTransactionSync`; `dequeue` reads the head and deletes it in ONE `rootTransactionSync`. FIFO survives crashes and cross-process contention because there is no window between counter and payload.

## Incorrect

```typescript
// counter bump and payload in separate transactions: crash between them = gap or dup
await meta.put(`seq`, n + 1)
await queue.put(id, job)
```

## Correct

```typescript
const queue = new LmdbQueue(env, JobSchema) // idempotent: reuses registration
const id = await queue.enqueue({type: `email`, data: {to: `a@b.c`}}) // → zero-padded id
const head = queue.peek() // sync [id, job] | undefined — inspect without removing
const next = await queue.dequeue() // async [id, job] | undefined — atomic read + delete (at-least-once)
const n = queue.size() // sync number
await queue.clear() // async drain
```

## Notes

- Queue payload shape is the schema `value`; the sequence counter lives in `__queue_meta` under key `__queue_seq_<db>` (counts toward `maxDbs`); ids are zero-padded to 12 (`String(n).padStart(12, `0`)`).
- At-least-once semantics: a crash between dequeue-read and commit can redeliver — consumers must be idempotent.
