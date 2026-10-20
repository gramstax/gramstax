---
title: "LmdbSchema.validate()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbSchema](./lmdb.lmdbschema.md) &gt; [validate](./lmdb.lmdbschema.validate.md)

## LmdbSchema.validate() method

Validate a schema subclass before registration.

**Signature:**

```typescript
static validate(schemaClass: typeof LmdbSchema): void;
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

The schema subclass to validate.


</td></tr>
</tbody></table>

**Returns:**

void

## Exceptions

[LmdbError](./lmdb.lmdberror.md) On any of the rules above.

## Remarks

Called lazily by [LmdbEnv.register()](./lmdb.lmdbenv.register.md) on every schema-class registration (registration is once-per-class anyway). Throws [LmdbError](./lmdb.lmdberror.md) when: - `static db` is missing or empty - only one of `static hookBeforeWrite` / `static hookBeforeRead` is declared - `static key` is missing - the `key` builder carries `unique`/`index` - `static value` is missing or not a plain record - two columns resolve to the same index name (explicit `.index("x")` names and derived column names)

