---
title: "LmdbEnv.rootPutSync()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnv](./lmdb.lmdbenv.md) &gt; [rootPutSync](./lmdb.lmdbenv.rootputsync_2.md)

## LmdbEnv.rootPutSync() method

Synchronously store a value with native put options.

**Signature:**

```typescript
rootPutSync(id: Key, value: unknown, options: PutOptions): void;
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

id


</td><td>

Key


</td><td>

The key.


</td></tr>
<tr><td>

value


</td><td>

unknown


</td><td>

The value to store.


</td></tr>
<tr><td>

options


</td><td>

PutOptions


</td><td>

`PutOptions` forwarded to the native `putSync`.


</td></tr>
</tbody></table>

**Returns:**

void

