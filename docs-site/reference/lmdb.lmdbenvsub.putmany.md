---
title: "LmdbEnvSub.putMany()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnvSub](./lmdb.lmdbenvsub.md) &gt; [putMany](./lmdb.lmdbenvsub.putmany.md)

## LmdbEnvSub.putMany() method

Write many entries.

**Signature:**

```typescript
putMany(entries: [KeyOf<S>, ValueOf<S>][], chunkSize?: number, options?: {
        sorted?: boolean;
        onProgress?: (done: number, total: number) => void;
    }): Promise<void>;
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

entries


</td><td>

\[[KeyOf](./lmdb.keyof.md)&lt;S&gt;, [ValueOf](./lmdb.valueof.md)&lt;S&gt;\]\[\]


</td><td>

`[key, value]` pairs to write.


</td></tr>
<tr><td>

chunkSize


</td><td>

number


</td><td>

_(Optional)_ Entries per transaction chunk (default `500`).


</td></tr>
<tr><td>

options


</td><td>

&#123; sorted?: boolean; onProgress?: (done: number, total: number) =&gt; void; &#125;


</td><td>

_(Optional)_ `{sorted?, onProgress?}`.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;void&gt;

Resolves when all chunks are committed.

## Exceptions

[LmdbError](./lmdb.lmdberror.md) On the first out-of-order key when sorted.

## Remarks

Pass `{sorted: true}` when entries ascend by key (strictly, or non-decreasing for dupSort primaries) to skip the B-tree search per put (MDB\_APPEND) — the first inversion aborts with `LmdbError`. `onProgress` fires per committed chunk as `(done, total)`.

