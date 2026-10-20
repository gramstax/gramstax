---
title: "LmdbSyncStream.(constructor)"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbSyncStream](./lmdb.lmdbsyncstream.md) &gt; [(constructor)](./lmdb.lmdbsyncstream._constructor_.md)

## LmdbSyncStream.(constructor)

Create a sync stream for one run (instances are single-use).

**Signature:**

```typescript
constructor(_source: LmdbEnvSub<S>, _dest: LmdbEnvSub<S>, _options?: ISyncOptions<S> | undefined);
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

\_source


</td><td>

[LmdbEnvSub](./lmdb.lmdbenvsub.md)&lt;S&gt;


</td><td>

Sub to copy from.


</td></tr>
<tr><td>

\_dest


</td><td>

[LmdbEnvSub](./lmdb.lmdbenvsub.md)&lt;S&gt;


</td><td>

Sub to copy to (same schema class, any env; must differ).


</td></tr>
<tr><td>

\_options


</td><td>

[ISyncOptions](./lmdb.isyncoptions.md)&lt;S&gt; \| undefined


</td><td>

_(Optional)_ `{name?, checkpoint?, limit?, verify?}`.


</td></tr>
</tbody></table>

