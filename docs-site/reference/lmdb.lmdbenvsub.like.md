---
title: "LmdbEnvSub.like()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnvSub](./lmdb.lmdbenvsub.md) &gt; [like](./lmdb.lmdbenvsub.like.md)

## LmdbEnvSub.like() method

Glob-pattern scan.

**Signature:**

```typescript
like(pattern: string, options?: IRangeOptions, tx?: LmdbTransaction): Promise<[KeyOf<S>, ValueOf<S>][]>;
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

pattern


</td><td>

string


</td><td>

Glob pattern (`*` wildcards); prefix shapes become bounded range scans.


</td></tr>
<tr><td>

options


</td><td>

[IRangeOptions](./lmdb.irangeoptions.md)


</td><td>

_(Optional)_ Range bounds and `limit`.


</td></tr>
<tr><td>

tx


</td><td>

[LmdbTransaction](./lmdb.lmdbtransaction.md)


</td><td>

_(Optional)_ Optional active [LmdbTransaction](./lmdb.lmdbtransaction.md) to scan within.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;\[[KeyOf](./lmdb.keyof.md)&lt;S&gt;, [ValueOf](./lmdb.valueof.md)&lt;S&gt;\]\[\]&gt;

Matching `[key, value]` pairs.

