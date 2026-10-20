---
title: "LmdbSchema.dupSort"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbSchema](./lmdb.lmdbschema.md) &gt; [dupSort](./lmdb.lmdbschema.dupsort.md)

## LmdbSchema.dupSort property

Optional `dupSort` flag for the underlying sub-DB.

**Signature:**

```typescript
static dupSort?: boolean;
```

## Remarks

Set `static dupSort = true` for one-key-to-many-ordered-values collections (e.g. `tag → postId` tables). Requires a scalar `static value` (the stored duplicate values). Defaults to `false`.

