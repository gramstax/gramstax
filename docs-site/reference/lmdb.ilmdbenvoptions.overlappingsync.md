---
title: "ILmdbEnvOptions.overlappingSync"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ILmdbEnvOptions](./lmdb.ilmdbenvoptions.md) &gt; [overlappingSync](./lmdb.ilmdbenvoptions.overlappingsync.md)

## ILmdbEnvOptions.overlappingSync property

Enable LMDB's overlapping-sync mode for durability.

**Signature:**

```typescript
overlappingSync?: boolean;
```

## Remarks

Disk flushing happens off the write lock, allowing parallel writes. Enabled by default on non-Windows. Not recommended on Windows.

