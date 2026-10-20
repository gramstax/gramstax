---
title: "ILmdbEnvOptions.cache"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ILmdbEnvOptions](./lmdb.ilmdbenvoptions.md) &gt; [cache](./lmdb.ilmdbenvoptions.cache.md)

## ILmdbEnvOptions.cache property

Enable in-memory caching of frequently accessed entries.

**Signature:**

```typescript
cache?: boolean | Record<string, unknown>;
```

## Remarks

Pass `true` for default settings, or an object for fine-grained control (see `weak-lru-cache` docs). Tends to help most with larger objects that have significant deserialization costs.

