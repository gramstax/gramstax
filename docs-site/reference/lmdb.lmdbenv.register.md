---
title: "LmdbEnv.register()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnv](./lmdb.lmdbenv.md) &gt; [register](./lmdb.lmdbenv.register.md)

## LmdbEnv.register() method

Register a [LmdbSchema](./lmdb.lmdbschema.md) subclass as a sub-DB collection.

**Signature:**

```typescript
register<S extends typeof LmdbSchema>(schemaClass: S): LmdbEnvSub<S>;
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

A typed [LmdbEnvSub](./lmdb.lmdbenvsub.md) handle bound to the schema — cached, so `env.register(Schema) === env.sub(Schema)`.

## Exceptions

[LmdbError](./lmdb.lmdberror.md) When the schema fails [LmdbSchema.validate()](./lmdb.lmdbschema.validate.md) (missing `db`/`key`/`value`, encode without decode or vice versa, a unique or indexed `key`, duplicate index names).

[LmdbError](./lmdb.lmdberror.md) if the same schema class is registered twice.

[LmdbError](./lmdb.lmdberror.md) if another sub uses the same `db`.

## Remarks

Validates the schema, materializes the sub-DB state through the internal `LmdbEnvSubManager` (no anonymous-class synthesis, no class-registration re-entry): the schema's `static db` becomes the sub-DB name, and its derived indexes (from `static value`, via [LmdbSchema.deriveIndexes()](./lmdb.lmdbschema.deriveindexes.md)) are attached at registration. Optional `static hookBeforeWrite`/`static hookBeforeRead` transforms are forwarded as the sub's codec, and `static ttl` (ms) materializes a TTL sub — per-put `{ttlMs}` overrides still apply. The returned handle is typed from the schema class — value type via [ValueOf](./lmdb.valueof.md), key type via [KeyOf](./lmdb.keyof.md), and the index map via [ISchemaIndexesOf](./lmdb.ischemaindexesof.md) — so `findByIndex({name: value})` queries type-check against the declared index names.

Registration is STRICT: re-registering the same schema class throws [LmdbError](./lmdb.lmdberror.md), and a schema whose `static db` is already taken throws [LmdbError](./lmdb.lmdberror.md). `register` is the ONLY registration path.

## Example


```typescript
class UserSchema extends LmdbSchema {
  static db = `users`
  static key = t.number()
  static value = {id: t.number().unique(), username: t.string().index()}
}
const users = env.register(UserSchema)
```

