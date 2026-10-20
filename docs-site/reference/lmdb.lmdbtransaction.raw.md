---
title: "LmdbTransaction.raw"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbTransaction](./lmdb.lmdbtransaction.md) &gt; [raw](./lmdb.lmdbtransaction.raw.md)

## LmdbTransaction.raw property

Underlying LMDB read transaction object (only present for read transactions).

**Signature:**

```typescript
get raw(): IRawReadTransaction | undefined;
```

## Remarks

Low-level escape hatch. Most callers should not need this.

