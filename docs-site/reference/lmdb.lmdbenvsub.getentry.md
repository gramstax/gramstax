---
title: "LmdbEnvSub.getEntry()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnvSub](./lmdb.lmdbenvsub.md) &gt; [getEntry](./lmdb.lmdbenvsub.getentry.md)

## LmdbEnvSub.getEntry() method

Raw entry with version.

**Signature:**

```typescript
getEntry(key: KeyOf<S>): {
        version: number;
        value: ValueOf<S>;
    } | undefined;
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

\{ version: number; value: [ValueOf](./lmdb.valueof.md)&lt;S&gt;; } \| undefined

`{version, value}` for optimistic-locking reads, or `undefined` when absent.

