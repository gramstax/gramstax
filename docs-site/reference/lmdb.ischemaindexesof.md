---
title: "ISchemaIndexesOf"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ISchemaIndexesOf](./lmdb.ischemaindexesof.md)

## ISchemaIndexesOf type

Index-definition map of a schema's VALUE columns.

**Signature:**

```typescript
type ISchemaIndexesOf<D extends IAnyColumnBuilder | Record<string, IAnyColumnBuilder>> = IIndexMapOf<D>;
```
**References:** [IAnyColumnBuilder](./lmdb.ianycolumnbuilder.md)

## Remarks

Key-remaps a value-column definition map `D` (whose keys are literal when the user declares `static value` as an object literal) into an `IIndexDefs`-compatible map (`Record<string, IIndexDef<unknown, ILmdbKey>>`), i.e. the schema index map (`SchemaIndexesOf`). Only columns whose [IColumnBuilder.indexFlag](./lmdb.icolumnbuilder.indexflag.md) is `"index"` or `"unique"` produce entries; the index name is the explicit `.index("name")` literal when set, otherwise the column key. Unique columns carry `{unique: true}` so `findByIndex`'s return type narrows per query exactly like a class collection's `as const` `static indexes`. Unknown keys (`coll.findByIndex({nope: 1})`) are therefore compile errors instead of silently passing. Scalar schemas (`static value = t.number()`) yield the empty map `{}`.

