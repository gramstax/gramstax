---
title: "LmdbEnv.resetReadTxn()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnv](./lmdb.lmdbenv.md) &gt; [resetReadTxn](./lmdb.lmdbenv.resetreadtxn.md)

## LmdbEnv.resetReadTxn() method

Force a reset of the auto-managed read transaction to the latest snapshot.

**Signature:**

```typescript
resetReadTxn(): void;
```
**Returns:**

void

## Remarks

By default LMDB renews the read transaction on new event turns. Call this to force an immediate refresh — useful in multi-process scenarios where another process has just written data you need to read without waiting for the next event turn.

