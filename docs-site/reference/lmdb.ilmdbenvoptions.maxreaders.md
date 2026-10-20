---
title: "ILmdbEnvOptions.maxReaders"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ILmdbEnvOptions](./lmdb.ilmdbenvoptions.md) &gt; [maxReaders](./lmdb.ilmdbenvoptions.maxreaders.md)

## ILmdbEnvOptions.maxReaders property

Maximum number of concurrent readers.

**Signature:**

```typescript
maxReaders?: number;
```

## Remarks

LMDB uses a readers table sized at startup. Each concurrent reader (including read-only transactions) takes one slot.

