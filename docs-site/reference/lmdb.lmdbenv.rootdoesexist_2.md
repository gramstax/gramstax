---
title: "LmdbEnv.rootDoesExist()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnv](./lmdb.lmdbenv.md) &gt; [rootDoesExist](./lmdb.lmdbenv.rootdoesexist_2.md)

## LmdbEnv.rootDoesExist() method

Check whether an entry's version matches.

**Signature:**

```typescript
rootDoesExist(key: Key, version: number): boolean;
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

Key


</td><td>

The key to check.


</td></tr>
<tr><td>

version


</td><td>

number


</td><td>

The expected version number.


</td></tr>
</tbody></table>

**Returns:**

boolean

`true` when the stored version equals `version`.

