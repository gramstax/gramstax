---
title: "IColumnBuilder"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [IColumnBuilder](./lmdb.icolumnbuilder.md)

## IColumnBuilder interface

Immutable column descriptor produced by the [t](./lmdb.t.md) builders.

**Signature:**

```typescript
interface IColumnBuilder<K extends IColumnKind = IColumnKind, I extends IColumnIndexFlag = `none`, N extends string | undefined = undefined, V = unknown, Nl extends boolean = false, C = unknown> 
```

## Remarks

Metadata object carrying the column's kind, index flags, and nullability. Every modifier returns a NEW builder (spread-copy semantics) — the original is never mutated. `kind` is carried as a generic type parameter so [ValueOf](./lmdb.valueof.md) can map columns back to their TypeScript types. `I` carries the [IColumnIndexFlag](./lmdb.icolumnindexflag.md) literal and `N` the explicit index name literal, so [ISchemaIndexesOf](./lmdb.ischemaindexesof.md) can produce narrow per-index keys. `V` carries the element/value type for `object`/`array` columns — set via `t.object<T>()` / `t.array<T>()` (defaults: `Record<string, unknown>` / `unknown`). `Nl` carries the nullability literal (`false` by default, `true` after `.optional()`).

## Properties

<table><thead><tr><th>

Property


</th><th>

Modifiers


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[compositeColumns?](./lmdb.icolumnbuilder.compositecolumns.md)


</td><td>

`readonly`


</td><td>

Array&lt;string&gt;


</td><td>

_(Optional)_ Composite column list for concatenated-key indexes.


</td></tr>
<tr><td>

[defaultFn?](./lmdb.icolumnbuilder.defaultfn.md)


</td><td>

`readonly`


</td><td>

() =&gt; unknown


</td><td>

_(Optional)_ Dynamic default factory applied at write time (wins over `.default()`).


</td></tr>
<tr><td>

[defaultValue?](./lmdb.icolumnbuilder.defaultvalue.md)


</td><td>

`readonly`


</td><td>

unknown


</td><td>

_(Optional)_ Static default applied at write time when the field is `undefined`.


</td></tr>
<tr><td>

[enumValues?](./lmdb.icolumnbuilder.enumvalues.md)


</td><td>

`readonly`


</td><td>

readonly unknown\[\]


</td><td>

_(Optional)_ Allowed values for enum columns (`t.enum(...)` and the literal params of `t.string(...)` / `t.number(...)` / `t.bigint(...)`).


</td></tr>
<tr><td>

[hasDefault?](./lmdb.icolumnbuilder.hasdefault.md)


</td><td>

`readonly`


</td><td>

boolean


</td><td>

_(Optional)_ Whether a static default was declared via `.default()`.


</td></tr>
<tr><td>

[indexFlag](./lmdb.icolumnbuilder.indexflag.md)


</td><td>

`readonly`


</td><td>

I


</td><td>

Literal index marker — see [IColumnIndexFlag](./lmdb.icolumnindexflag.md).


</td></tr>
<tr><td>

[indexName](./lmdb.icolumnbuilder.indexname.md)


</td><td>

`readonly`


</td><td>

N


</td><td>

Explicit index name.


</td></tr>
<tr><td>

[isOptional](./lmdb.icolumnbuilder.isoptional.md)


</td><td>

`readonly`


</td><td>

Nl


</td><td>

Whether the column accepts `null`/`undefined` values.


</td></tr>
<tr><td>

[isSearchable](./lmdb.icolumnbuilder.issearchable.md)


</td><td>

`readonly`


</td><td>

boolean


</td><td>

Whether the column is full-text searchable.


</td></tr>
<tr><td>

[isUnique](./lmdb.icolumnbuilder.isunique.md)


</td><td>

`readonly`


</td><td>

boolean


</td><td>

Whether the column participates in a unique index.


</td></tr>
<tr><td>

[kind](./lmdb.icolumnbuilder.kind.md)


</td><td>

`readonly`


</td><td>

K


</td><td>

The column's value kind.


</td></tr>
</tbody></table>

## Methods

<table><thead><tr><th>

Method


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[$defaultFn(fn)](./lmdb.icolumnbuilder._defaultfn.md)


</td><td>

Dynamic write-time default factory, called per write.


</td></tr>
<tr><td>

[default(value)](./lmdb.icolumnbuilder.default.md)


</td><td>

Static write-time default — applied when the field is `undefined`.


</td></tr>
<tr><td>

[index(name)](./lmdb.icolumnbuilder.index.md)


</td><td>

Mark the column as an index.


</td></tr>
<tr><td>

[optional()](./lmdb.icolumnbuilder.optional.md)


</td><td>

Mark the column as optional.


</td></tr>
<tr><td>

[search()](./lmdb.icolumnbuilder.search.md)


</td><td>

Mark the column as full-text searchable.


</td></tr>
<tr><td>

[unique()](./lmdb.icolumnbuilder.unique.md)


</td><td>

Mark the column as a unique index.


</td></tr>
</tbody></table>

