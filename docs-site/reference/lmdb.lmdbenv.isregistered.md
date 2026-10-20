---
title: "LmdbEnv.isRegistered()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnv](./lmdb.lmdbenv.md) &gt; [isRegistered](./lmdb.lmdbenv.isregistered.md)

## LmdbEnv.isRegistered() method

Check whether a LmdbSchema class has been registered.

**Signature:**

```typescript
isRegistered(schemaClass: typeof LmdbSchema): boolean;
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

typeof [LmdbSchema](./lmdb.lmdbschema.md)


</td><td>

The LmdbSchema subclass constructor.


</td></tr>
</tbody></table>

**Returns:**

boolean

`true` if registered, `false` otherwise.

