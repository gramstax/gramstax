---
title: "LmdbEnv.rootGetRange()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnv](./lmdb.lmdbenv.md) &gt; [rootGetRange](./lmdb.lmdbenv.rootgetrange.md)

## LmdbEnv.rootGetRange() method

Iterate entries in a key range.

**Signature:**

```typescript
rootGetRange(options?: RangeOptions): RangeIterable<{
        key: Key;
        value: unknown;
        version?: number;
    }>;
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

options


</td><td>

RangeOptions


</td><td>

_(Optional)_ Range bounds, limit, reverse, etc.


</td></tr>
</tbody></table>

**Returns:**

RangeIterable&lt;\{ key: Key; value: unknown; version?: number; }&gt;

A lazy `RangeIterable`.

