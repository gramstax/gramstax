---
title: "IColumnBuilder.indexName"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [IColumnBuilder](./lmdb.icolumnbuilder.md) &gt; [indexName](./lmdb.icolumnbuilder.indexname.md)

## IColumnBuilder.indexName property

Explicit index name.

**Signature:**

```typescript
readonly indexName: N;
```

## Remarks

`""` (set by a no-argument `.index()` call) means "index under the column name" — see [LmdbSchema.deriveIndexes()](./lmdb.lmdbschema.deriveindexes.md). The literal (when supplied via `.index("name")`) is carried by the generic `N`.

