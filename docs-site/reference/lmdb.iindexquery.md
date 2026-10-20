---
title: "IIndexQuery"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [IIndexQuery](./lmdb.iindexquery.md)

## IIndexQuery type

Object query accepted by [LmdbEnvSub.findByIndex()](./lmdb.lmdbenvsub.findbyindex.md): maps declared index names to the values to match. Every supplied key is ANDed.

**Signature:**

```typescript
type IIndexQuery<T, I> = Partial<{
    [P in keyof I]: IndexQueryValue<T, P & string, I[P]>;
}> & {
    [P in keyof I]-?: Record<P, IndexQueryValue<T, P & string, I[P]>>;
}[keyof I];
```
**References:** [IndexQueryValue](./lmdb.indexqueryvalue.md)

## Remarks

At least one key is required — the intersection term forces a non-empty query, so `{}` is a compile-time error. The index definitions come from the schema's index map type: `SchemaIndexesOf<typeof UserSchema[`value`]>` with `static indexes` declared `as const` (so `unique: true` survives as a literal type); without the self-reference or `as const`, queries still type but the return type degrades to `T[]` for every query (runtime unchanged).

