---
title: "LmdbEnvSub.search()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnvSub](./lmdb.lmdbenvsub.md) &gt; [search](./lmdb.lmdbenvsub.search.md)

## LmdbEnvSub.search() method

Full-text search over `t.string().search()` columns.

**Signature:**

```typescript
search(query: string, options?: {
        limit?: number;
    }): Promise<KeyOf<S>[]>;
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

query


</td><td>

string


</td><td>

Raw query text (at least one term required).


</td></tr>
<tr><td>

options


</td><td>

&#123; limit?: number; &#125;


</td><td>

_(Optional)_ `{limit}` caps the returned keys with flat memory.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[KeyOf](./lmdb.keyof.md)&lt;S&gt;\[\]&gt;

Matching primary keys, best first.

## Exceptions

[LmdbError](./lmdb.lmdberror.md) On empty queries or subs without searchable columns.

## Remarks

Tokenizes the query (lowercase + split) and ANDs the terms: only rows containing every term match. A match in N searched columns scores N, so rows matching in more columns rank first; ties keep native key order.

