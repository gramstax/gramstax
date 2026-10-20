---
title: "LmdbSchema.isColumnBuilder()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbSchema](./lmdb.lmdbschema.md) &gt; [isColumnBuilder](./lmdb.lmdbschema.iscolumnbuilder.md)

## LmdbSchema.isColumnBuilder() method

Runtime check: is a value a single [IColumnBuilder](./lmdb.icolumnbuilder.md) (scalar) rather than a value-column map?

**Signature:**

```typescript
static isColumnBuilder(value: unknown): value is IAnyColumnBuilder;
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

value


</td><td>

unknown


</td><td>

The `static value` to inspect.


</td></tr>
</tbody></table>

**Returns:**

value is [IAnyColumnBuilder](./lmdb.ianycolumnbuilder.md)

`true` for a single builder, `false` for a column map.

