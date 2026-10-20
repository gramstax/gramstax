---
title: "LmdbEnv.rootPut()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnv](./lmdb.lmdbenv.md) &gt; [rootPut](./lmdb.lmdbenv.rootput_1.md)

## LmdbEnv.rootPut() method

Store a value only when its version check passes.

**Signature:**

```typescript
rootPut(id: Key, value: unknown, version: number, ifVersion?: number): Promise<boolean>;
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

Version number stamped on a successful write.


</td></tr>
<tr><td>

ifVersion


</td><td>

number


</td><td>

_(Optional)_ Only write when the existing version matches this.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;boolean&gt;

Resolves `true` when written, `false` when the version check failed.

## Remarks

Requires the env to be opened with `useVersions`. The write applies and stamps `version` when the stored version equals `ifVersion` (or when the key holds no version yet); otherwise the write is skipped.

