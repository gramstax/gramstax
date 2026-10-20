---
title: "ILmdbKey"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ILmdbKey](./lmdb.ilmdbkey.md)

## ILmdbKey type

Anything that can be used as a key in LMDB.

**Signature:**

```typescript
type ILmdbKey = Key;
```

## Remarks

LMDB natively accepts strings, numbers, Buffers, and arrays of primitives (ordered-binary composite keys). The array form enables multi-tenant / namespaced keys like `["tenant-a", 42]` that sort lexicographically. Re-exported from `lmdb` for convenience.

