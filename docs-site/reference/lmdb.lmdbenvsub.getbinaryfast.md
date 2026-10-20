---
title: "LmdbEnvSub.getBinaryFast()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnvSub](./lmdb.lmdbenvsub.md) &gt; [getBinaryFast](./lmdb.lmdbenvsub.getbinaryfast.md)

## LmdbEnvSub.getBinaryFast() method

Read raw bytes synchronously.

**Signature:**

```typescript
getBinaryFast(key: KeyOf<S>): Buffer | undefined;
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
</tbody></table>

**Returns:**

Buffer \| undefined

The stored bytes, or `undefined` when absent. No async wrapper.

