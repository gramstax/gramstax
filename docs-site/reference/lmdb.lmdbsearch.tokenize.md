---
title: "LmdbSearch.tokenize()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbSearch](./lmdb.lmdbsearch.md) &gt; [tokenize](./lmdb.lmdbsearch.tokenize.md)

## LmdbSearch.tokenize() method

Split text into lowercase alphanumeric terms.

**Signature:**

```typescript
static tokenize(text: string): Array<string>;
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

text


</td><td>

string


</td><td>

Raw field text.


</td></tr>
</tbody></table>

**Returns:**

Array&lt;string&gt;

Lowercase terms (`a-z`, `0-9`); `[]` for empty/punctuation-only input.

