---
title: "LmdbEnvSub.removeSync()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnvSub](./lmdb.lmdbenvsub.md) &gt; [removeSync](./lmdb.lmdbenvsub.removesync.md)

## LmdbEnvSub.removeSync() method

Synchronous delete — use inside a transaction callback.

**Signature:**

```typescript
removeSync(key: KeyOf<S>): boolean;
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

boolean

`true` when the key existed and was removed.

