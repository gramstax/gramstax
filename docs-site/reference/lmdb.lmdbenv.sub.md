---
title: "LmdbEnv.sub()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnv](./lmdb.lmdbenv.md) &gt; [sub](./lmdb.lmdbenv.sub.md)

## LmdbEnv.sub() method

Get the cached handle for an already-registered schema class.

**Signature:**

```typescript
sub<S extends typeof LmdbSchema>(schemaClass: S): LmdbEnvSub<S>;
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

schemaClass


</td><td>

S


</td><td>

The [LmdbSchema](./lmdb.lmdbschema.md) subclass.


</td></tr>
</tbody></table>

**Returns:**

[LmdbEnvSub](./lmdb.lmdbenvsub.md)&lt;S&gt;

The cached [LmdbEnvSub](./lmdb.lmdbenvsub.md) handle — the same instance `register` returned.

## Exceptions

[LmdbError](./lmdb.lmdberror.md) when the schema is not registered.

