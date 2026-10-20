---
title: "LmdbQueue.peek()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbQueue](./lmdb.lmdbqueue.md) &gt; [peek](./lmdb.lmdbqueue.peek.md)

## LmdbQueue.peek() method

Peek at the head without removing.

**Signature:**

```typescript
peek(): [string, ValueOf<S>] | undefined;
```
**Returns:**

\[string, [ValueOf](./lmdb.valueof.md)&lt;S&gt;\] \| undefined

The head `[id, job]`, or `undefined` when empty.

## Remarks

Synchronous — reads through a cursor plus a point `get`, like [LmdbQueue.dequeue()](./lmdb.lmdbqueue.dequeue.md) minus the delete. Never held a write lock.

