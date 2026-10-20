---
title: "IColumnBuilder.$defaultFn()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [IColumnBuilder](./lmdb.icolumnbuilder.md) &gt; [$defaultFn](./lmdb.icolumnbuilder._defaultfn.md)

## IColumnBuilder.$defaultFn() method

Dynamic write-time default factory, called per write.

**Signature:**

```typescript
$defaultFn(fn: () => unknown): IColumnBuilder<K, I, N, V, true>;
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

fn


</td><td>

() =&gt; unknown


</td><td>

Factory producing the default per write.


</td></tr>
</tbody></table>

**Returns:**

[IColumnBuilder](./lmdb.icolumnbuilder.md)&lt;K, I, N, V, true&gt;

A new builder with `isOptional: true` carrying the factory.

## Remarks

Same optionality as [IColumnBuilder.default()](./lmdb.icolumnbuilder.default.md). Replaces any `.default()` set before it (last call wins). The produced value is validated like any write.

