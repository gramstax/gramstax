---
title: "IIndexDef.composite"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [IIndexDef](./lmdb.iindexdef.md) &gt; [composite](./lmdb.iindexdef.composite.md)

## IIndexDef.composite property

Composite column list for concatenated-key indexes.

**Signature:**

```typescript
composite?: Array<string>;
```

## Remarks

Set by `t.*.index([`a`, `b`])` via [LmdbSchema.deriveIndexes()](./lmdb.lmdbschema.deriveindexes.md) — the extractor returns the ordered tuple and the sub-DB pins `ordered-binary` key/value encoding so tuples seek natively. Custom `attachIndexes` definitions may set it alongside their own extractor.

