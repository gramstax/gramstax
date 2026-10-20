---
title: "LmdbEnvSub.countByPrefix()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnvSub](./lmdb.lmdbenvsub.md) &gt; [countByPrefix](./lmdb.lmdbenvsub.countbyprefix.md)

## LmdbEnvSub.countByPrefix() method

Count entries under a prefix.

**Signature:**

```typescript
countByPrefix(prefix: KeyOf<S>): Promise<number>;
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

prefix


</td><td>

[KeyOf](./lmdb.keyof.md)&lt;S&gt;


</td><td>

The prefix to count.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;number&gt;

The number of matching entries.

