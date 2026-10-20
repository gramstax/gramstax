---
title: "LmdbSchema.deriveRecordColumns()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbSchema](./lmdb.lmdbschema.md) &gt; [deriveRecordColumns](./lmdb.lmdbschema.deriverecordcolumns.md)

## LmdbSchema.deriveRecordColumns() method

Derive positional record columns from a schema's value map.

**Signature:**

```typescript
static deriveRecordColumns(columns: IAnyColumnBuilder | Record<string, IAnyColumnBuilder>): Array<string>;
```

## Parameters

<table><thead><tr><th>

Parameter


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

columns


</td><td>

[IAnyColumnBuilder](./lmdb.ianycolumnbuilder.md) \| Record&lt;string, [IAnyColumnBuilder](./lmdb.ianycolumnbuilder.md)&gt;


</td><td>

The schema's `static value` map.


</td></tr>
</tbody></table>

**Returns:**

Array&lt;string&gt;

Column names in declaration order, or `[]` for scalars.

## Remarks

Every key in declaration order — unlike [LmdbSchema.deriveIndexes()](./lmdb.lmdbschema.deriveindexes.md) nothing is skipped, since dropping a column would corrupt the positional layout. Scalar values carry no columns (no codec).

