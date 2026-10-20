---
title: "IIndexDefs"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [IIndexDefs](./lmdb.iindexdefs.md)

## IIndexDefs type

Declarative index definition map: `static indexes` shape.

**Signature:**

```typescript
type IIndexDefs<T = unknown> = Record<string, IIndexDef<T, ILmdbKey>>;
```
**References:** [IIndexDef](./lmdb.iindexdef.md), [ILmdbKey](./lmdb.ilmdbkey.md)

## Remarks

`Record<string, IIndexDef<T, ILmdbKey>>` — every declared index name maps to its [IIndexDef](./lmdb.iindexdef.md). Used as the third type parameter of a schema class so the subclass can bind its own `static indexes` type: `class UserSchema extends LmdbSchema` with `static value` columns.

