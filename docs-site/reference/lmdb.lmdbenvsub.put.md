---
title: "LmdbEnvSub.put()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnvSub](./lmdb.lmdbenvsub.md) &gt; [put](./lmdb.lmdbenvsub.put.md)

## LmdbEnvSub.put() method

Write a value.

**Signature:**

```typescript
put(key: KeyOf<S>, value: ValueOf<S>, ttlOrTx?: number | {
        ttlMs: number;
    } | LmdbTransaction): Promise<void>;
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

key


</td><td>

[KeyOf](./lmdb.keyof.md)&lt;S&gt;


</td><td>

The primary key.


</td></tr>
<tr><td>

value


</td><td>

[ValueOf](./lmdb.valueof.md)&lt;S&gt;


</td><td>

The row value to store.


</td></tr>
<tr><td>

ttlOrTx


</td><td>

number \| &#123; ttlMs: number; &#125; \| [LmdbTransaction](./lmdb.lmdbtransaction.md)


</td><td>

_(Optional)_ Optional TTL (`number` ms or `{ttlMs}`) or an active [LmdbTransaction](./lmdb.lmdbtransaction.md).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;void&gt;

Resolves when the queued put is flushed.

