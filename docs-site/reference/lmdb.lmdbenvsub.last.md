---
title: "LmdbEnvSub.last()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnvSub](./lmdb.lmdbenvsub.md) &gt; [last](./lmdb.lmdbenvsub.last.md)

## LmdbEnvSub.last() method

Last entry (highest key).

**Signature:**

```typescript
last(tx?: LmdbTransaction): Promise<[KeyOf<S>, ValueOf<S>] | undefined>;
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

tx


</td><td>

[LmdbTransaction](./lmdb.lmdbtransaction.md)


</td><td>

_(Optional)_ Optional active [LmdbTransaction](./lmdb.lmdbtransaction.md) to read from.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;\[[KeyOf](./lmdb.keyof.md)&lt;S&gt;, [ValueOf](./lmdb.valueof.md)&lt;S&gt;\] \| undefined&gt;

The `[key, value]` pair with the highest key, or `undefined` when empty.

