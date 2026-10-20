---
title: "IIndexDef.extractor"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [IIndexDef](./lmdb.iindexdef.md) &gt; [extractor](./lmdb.iindexdef.extractor.md)

## IIndexDef.extractor property

Extract the indexed value from a primary value.

**Signature:**

```typescript
extractor?: (value: T) => K | undefined | null;
```

## Remarks

Returning `undefined`/`null` skips the index entry. When omitted, the index name is auto-resolved as a (possibly dotted) field path.

