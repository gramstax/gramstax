---
title: "IColumnBuilder.indexFlag"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [IColumnBuilder](./lmdb.icolumnbuilder.md) &gt; [indexFlag](./lmdb.icolumnbuilder.indexflag.md)

## IColumnBuilder.indexFlag property

Literal index marker — see [IColumnIndexFlag](./lmdb.icolumnindexflag.md).

**Signature:**

```typescript
readonly indexFlag: I;
```

## Remarks

The type-level counterpart of `isUnique`/`indexName`: `"unique"` for columns built with `.unique()`, `"index"` for columns built with `.index(...)`, `"none"` otherwise. This is what keeps per-index keys literal in [ISchemaIndexesOf](./lmdb.ischemaindexesof.md).

