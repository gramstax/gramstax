---
title: "LmdbSearch"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbSearch](./lmdb.lmdbsearch.md)

## LmdbSearch class

Full-text search primitives for `@gramstax/lmdb`.

**Signature:**

```typescript
declare class LmdbSearch 
```

## Remarks

The search index is an inverted table per searched column (`{db}:search:{column}`, dupSort): each term maps to the primary keys of the rows containing it. Posting maintenance rides the embedded-index write path (same writer transaction); ranking happens at read time in [LmdbEnvSub.search()](./lmdb.lmdbenvsub.search.md).

Tokenization is deliberately minimal for v1 (lowercase + split on non-alphanumerics, no stemming, ASCII fold-free) — non-ASCII letters act as separators.

A class of pure statics (rather than bare functions) so every helper in `src` lives on a class. No instance state — never construct it.

## Methods

<table><thead><tr><th>

Method


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[fingerprintPk(pk)](./lmdb.lmdbsearch.fingerprintpk.md)


</td><td>

`static`


</td><td>

Fingerprint a primary key by value for score-map lookups.


</td></tr>
<tr><td>

[tokenize(text)](./lmdb.lmdbsearch.tokenize.md)


</td><td>

`static`


</td><td>

Split text into lowercase alphanumeric terms.


</td></tr>
<tr><td>

[tokenizeField(value)](./lmdb.lmdbsearch.tokenizefield.md)


</td><td>

`static`


</td><td>

Tokenize a searched-column field value.


</td></tr>
</tbody></table>

