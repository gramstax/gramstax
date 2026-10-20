---
title: "LmdbEnvSub.purgeExpired()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnvSub](./lmdb.lmdbenvsub.md) &gt; [purgeExpired](./lmdb.lmdbenvsub.purgeexpired.md)

## LmdbEnvSub.purgeExpired() method

Remove expired entries.

**Signature:**

```typescript
purgeExpired(): Promise<number>;
```
**Returns:**

Promise&lt;number&gt;

The number of purged entries (TTL subs only).

