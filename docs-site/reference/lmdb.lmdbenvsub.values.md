---
title: "LmdbEnvSub.values()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnvSub](./lmdb.lmdbenvsub.md) &gt; [values](./lmdb.lmdbenvsub.values.md)

## LmdbEnvSub.values() method

Materialize all values.

**Signature:**

```typescript
values(options?: IRangeOptions, tx?: LmdbTransaction): Promise<ValueOf<S>[]>;
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

options


</td><td>

[IRangeOptions](./lmdb.irangeoptions.md)


</td><td>

_(Optional)_ Range bounds (`start`/`end`), `limit`, `reverse`.


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

Promise&lt;[ValueOf](./lmdb.valueof.md)&lt;S&gt;\[\]&gt;

All values in the range — guarded by [MAX\_MATERIALIZE](./lmdb.max_materialize.md).

