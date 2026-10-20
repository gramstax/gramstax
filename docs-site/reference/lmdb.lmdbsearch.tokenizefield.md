---
title: "LmdbSearch.tokenizeField()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbSearch](./lmdb.lmdbsearch.md) &gt; [tokenizeField](./lmdb.lmdbsearch.tokenizefield.md)

## LmdbSearch.tokenizeField() method

Tokenize a searched-column field value.

**Signature:**

```typescript
static tokenizeField(value: unknown): Array<string>;
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

value


</td><td>

unknown


</td><td>

The raw field value.


</td></tr>
</tbody></table>

**Returns:**

Array&lt;string&gt;

Terms for strings, `[]` otherwise.

## Remarks

Non-string values (absent fields, `null`, or off-kind rows written around the type system) contribute no terms — mirroring how `null`/`undefined` extracts skip embedded indexes.

