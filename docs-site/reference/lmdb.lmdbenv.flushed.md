---
title: "LmdbEnv.flushed"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnv](./lmdb.lmdbenv.md) &gt; [flushed](./lmdb.lmdbenv.flushed.md)

## LmdbEnv.flushed property

Promise resolving when all previous writes have been flushed to disk.

**Signature:**

```typescript
get flushed(): Promise<boolean>;
```

## Remarks

Forwards to the inherited lmdb root-store `flushed`. Stronger than [LmdbEnv.committed](./lmdb.lmdbenv.committed.md) (visibility to readers): await this when durability across process crashes matters.

