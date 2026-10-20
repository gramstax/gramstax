---
title: "LmdbSchema"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbSchema](./lmdb.lmdbschema.md)

## LmdbSchema class

Declarative schema base class — extend it to describe a collection.

**Signature:**

```typescript
declare abstract class LmdbSchema 
```

## Remarks

Subclass with `static db` (used as the collection's `dbName`), `static key` (a single [IColumnBuilder](./lmdb.icolumnbuilder.md) from the [t](./lmdb.t.md) builders for the primary key), and `static value` (a map of value columns, each a [IColumnBuilder](./lmdb.icolumnbuilder.md)). The `key` column must NOT carry `unique`/`index` — the key is implicitly the primary index and is excluded from the derived `indexes`.

Pass the class to [LmdbEnv.register()](./lmdb.lmdbenv.register.md) to materialize a typed collection:

```typescript
class UserSchema extends LmdbSchema {
  static db = `users`
  static key = t.number()
  static value = {
    id: t.number().unique(),
    username: t.string().index(),
    email: t.string(),
    tags: t.array().optional(),
    createdAt: t.date()
  }
}

const users = env.register(UserSchema) // → registers the collection
type UserValue = ValueOf<typeof UserSchema>
```
Derived indexes match the [LmdbEnv](./lmdb.lmdbenv.md) index attachment input shape: each value column with `unique` or an index flag becomes `{name: indexName ?? columnName, def: {unique}, dbName: undefined}` (see [LmdbSchema.deriveIndexes()](./lmdb.lmdbschema.deriveindexes.md)). The `attachIndexes` machinery auto-resolves the index name as a (possibly dotted) field path on the value, so the column name doubles as the field path.

Optional `static hookBeforeWrite`/`static hookBeforeRead` functions transform rows at the collection boundary — `hookBeforeWrite` runs before LMDB serializes the value and `hookBeforeRead` after it deserializes it (e.g. `Date → number`). They must be declared TOGETHER or registration throws.

[LmdbSchema.validate()](./lmdb.lmdbschema.validate.md) enforces the schema rules at registration time (missing `db`/`key`/`value`, write-hook without read-hook or vice versa, a unique or indexed `key`, duplicate index names); it is called lazily by [LmdbEnv.register()](./lmdb.lmdbenv.register.md). The inherited `static _schemaBrand` lets [LmdbEnv.register()](./lmdb.lmdbenv.register.md) recognize schema classes at runtime.

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

[\_schemaBrand](./lmdb.lmdbschema._schemabrand.md)


</td><td>

`static`

`readonly`


</td><td>

true


</td><td>

Runtime discriminator for [LmdbEnv.register()](./lmdb.lmdbenv.register.md) — inherited by subclasses, never read by user code.


</td></tr>
<tr><td>

[db](./lmdb.lmdbschema.db.md)


</td><td>

`static`


</td><td>

string


</td><td>

Sub-database name — used as the registered collection's `dbName`.


</td></tr>
<tr><td>

[dupSort?](./lmdb.lmdbschema.dupsort.md)


</td><td>

`static`


</td><td>

boolean


</td><td>

_(Optional)_ Optional `dupSort` flag for the underlying sub-DB.


</td></tr>
<tr><td>

[encoding?](./lmdb.lmdbschema.encoding.md)


</td><td>

`static`


</td><td>

string


</td><td>

_(Optional)_ Optional value encoding for the underlying sub-DB.


</td></tr>
<tr><td>

[hookBeforeRead?](./lmdb.lmdbschema.hookbeforeread.md)


</td><td>

`static`


</td><td>

(raw: unknown) =&gt; unknown


</td><td>

_(Optional)_ Optional read hook — converts the stored form back to a typed row.


</td></tr>
<tr><td>

[hookBeforeWrite?](./lmdb.lmdbschema.hookbeforewrite.md)


</td><td>

`static`


</td><td>

(value: unknown) =&gt; unknown


</td><td>

_(Optional)_ Optional write hook — converts a typed row to its stored form.


</td></tr>
<tr><td>

[key](./lmdb.lmdbschema.key.md)


</td><td>

`static`


</td><td>

[IAnyColumnBuilder](./lmdb.ianycolumnbuilder.md)


</td><td>

Key column builder — the collection's primary key.


</td></tr>
<tr><td>

[ttl?](./lmdb.lmdbschema.ttl.md)


</td><td>

`static`


</td><td>

number


</td><td>

_(Optional)_ Optional collection-wide default TTL in milliseconds.


</td></tr>
<tr><td>

[useVersions?](./lmdb.lmdbschema.useversions.md)


</td><td>

`static`


</td><td>

boolean


</td><td>

_(Optional)_ Optional `useVersions` flag for the underlying sub-DB.


</td></tr>
<tr><td>

[value](./lmdb.lmdbschema.value.md)


</td><td>

`static`


</td><td>

[IAnyColumnBuilder](./lmdb.ianycolumnbuilder.md) \| Record&lt;string, [IAnyColumnBuilder](./lmdb.ianycolumnbuilder.md)&gt;


</td><td>

Value column definition — either a single [IColumnBuilder](./lmdb.icolumnbuilder.md) (scalar value collections: `static value = t.number()`, `t.buffer()`, `t.array<T>()`, `t.object<T>()`) or a map of [IColumnBuilder](./lmdb.icolumnbuilder.md)s (row-shaped collections). Scalar values carry no derived indexes.


</td></tr>
<tr><td>

[version?](./lmdb.lmdbschema.version.md)


</td><td>

`static`


</td><td>

number


</td><td>

_(Optional)_ Optional shape version for migration transforms.


</td></tr>
</tbody></table>

## Methods

<table><thead><tr><th>

Method


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[deriveIndexes(columns)](./lmdb.lmdbschema.deriveindexes.md)


</td><td>

`static`


</td><td>

Derive index descriptors from a schema's columns.


</td></tr>
<tr><td>

[deriveRecordColumns(columns)](./lmdb.lmdbschema.deriverecordcolumns.md)


</td><td>

`static`


</td><td>

Derive positional record columns from a schema's value map.


</td></tr>
<tr><td>

[deriveSearch(columns)](./lmdb.lmdbschema.derivesearch.md)


</td><td>

`static`


</td><td>

Derive searchable column names from a schema's columns.


</td></tr>
<tr><td>

[isColumnBuilder(value)](./lmdb.lmdbschema.iscolumnbuilder.md)


</td><td>

`static`


</td><td>

Runtime check: is a value a single [IColumnBuilder](./lmdb.icolumnbuilder.md) (scalar) rather than a value-column map?


</td></tr>
<tr><td>

[validate(schemaClass)](./lmdb.lmdbschema.validate.md)


</td><td>

`static`


</td><td>

Validate a schema subclass before registration.


</td></tr>
</tbody></table>

