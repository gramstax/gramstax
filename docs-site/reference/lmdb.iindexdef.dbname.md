---
title: "IIndexDef.dbName"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [IIndexDef](./lmdb.iindexdef.md) &gt; [dbName](./lmdb.iindexdef.dbname.md)

## IIndexDef.dbName property

Override the auto-generated index sub-DB name.

**Signature:**

```typescript
dbName?: string;
```

## Remarks

Default is `${dbName}:idx:${name}` (Q3). Must not collide with any other registered sub-DB name.

