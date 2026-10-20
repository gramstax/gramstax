---
title: "LmdbEnv.rootPutSync()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnv](./lmdb.lmdbenv.md) &gt; [rootPutSync](./lmdb.lmdbenv.rootputsync_1.md)

## LmdbEnv.rootPutSync() method

Synchronously store a value with an explicit version.

**Signature:**

```typescript
rootPutSync(id: Key, value: unknown, version: number): void;
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

version


</td><td>

number


</td><td>

Version number stamped on the write.


</td></tr>
</tbody></table>

**Returns:**

void

## Remarks

Requires the env to be opened with `useVersions`. Unlike the async [LmdbEnv.rootPut()](./lmdb.lmdbenv.rootput_1.md) conditional form there is no `ifVersion` gate — `version` is stamped on the write.

