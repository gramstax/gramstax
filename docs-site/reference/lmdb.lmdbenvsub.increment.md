---
title: "LmdbEnvSub.increment()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnvSub](./lmdb.lmdbenvsub.md) &gt; [increment](./lmdb.lmdbenvsub.increment.md)

## LmdbEnvSub.increment() method

Atomic increment.

**Signature:**

```typescript
increment(key: KeyOf<S>, delta?: number): Promise<number>;
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

delta


</td><td>

number


</td><td>

_(Optional)_ Increment amount (default `1`).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;number&gt;

The new value; absent keys start at `0`.

