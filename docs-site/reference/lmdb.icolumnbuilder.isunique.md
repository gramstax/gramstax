---
title: "IColumnBuilder.isUnique"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [IColumnBuilder](./lmdb.icolumnbuilder.md) &gt; [isUnique](./lmdb.icolumnbuilder.isunique.md)

## IColumnBuilder.isUnique property

Whether the column participates in a unique index.

**Signature:**

```typescript
readonly isUnique: boolean;
```

## Remarks

Flag form of the [IColumnBuilder.unique()](./lmdb.icolumnbuilder.unique.md) modifier — named `isUnique` so it cannot collide with the `unique()` method on the same object.

