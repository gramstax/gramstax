---
title: "IColumnBuilder.enumValues"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [IColumnBuilder](./lmdb.icolumnbuilder.md) &gt; [enumValues](./lmdb.icolumnbuilder.enumvalues.md)

## IColumnBuilder.enumValues property

Allowed values for enum columns (`t.enum(...)` and the literal params of `t.string(...)` / `t.number(...)` / `t.bigint(...)`).

**Signature:**

```typescript
readonly enumValues?: readonly unknown[];
```

## Remarks

Carried at runtime so write paths can validate (`LmdbError` on out-of-enum values). `undefined` for non-enum columns (zero-cost: validation is skipped). Preserved by `.unique()` / `.index()` / `.optional()` copies.

