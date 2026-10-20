---
title: "IndexDescriptor"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [IndexDescriptor](./lmdb.indexdescriptor.md)

## IndexDescriptor type

Runtime shape of one attached embedded-index descriptor.

**Signature:**

```typescript
type IndexDescriptor = {
    name: string;
    extractor: (value: unknown) => ILmdbKey | undefined | null;
    unique: boolean;
    state: LmdbSubState;
    autoResolved: boolean;
    composite: Array<string> | undefined;
};
```
**References:** [ILmdbKey](./lmdb.ilmdbkey.md)

## Remarks

Built at registration from the schema's declared indexes and kept on the sub state — the write path walks `indexes` to maintain index rows in the same writer transaction as the primary write.

