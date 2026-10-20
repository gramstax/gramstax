---
title: "LmdbEnv.openDB()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnv](./lmdb.lmdbenv.md) &gt; [openDB](./lmdb.lmdbenv.opendb.md)

## LmdbEnv.openDB() method

Open or create a sub-database.

**Signature:**

```typescript
openDB(dbName: string, dbOptions?: DatabaseOptions): Database<unknown, Key>;
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

dbName


</td><td>

string


</td><td>

Sub-database name.


</td></tr>
<tr><td>

dbOptions


</td><td>

DatabaseOptions


</td><td>

_(Optional)_ Encoding, cache, dupSort, and other options.


</td></tr>
</tbody></table>

**Returns:**

Database&lt;unknown, Key&gt;

The sub-database handle.

