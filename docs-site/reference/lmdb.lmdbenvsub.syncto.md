---
title: "LmdbEnvSub.syncTo()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbEnvSub](./lmdb.lmdbenvsub.md) &gt; [syncTo](./lmdb.lmdbenvsub.syncto.md)

## LmdbEnvSub.syncTo() method

Differentially copy this sub to a destination sub (any env, same schema).

**Signature:**

```typescript
syncTo(dest: LmdbEnvSub<S>, options?: ISyncOptions<S>): Promise<ISyncResult<S>>;
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

dest


</td><td>

[LmdbEnvSub](./lmdb.lmdbenvsub.md)&lt;S&gt;


</td><td>

Destination handle (same schema class, must differ).


</td></tr>
<tr><td>

options


</td><td>

[ISyncOptions](./lmdb.isyncoptions.md)&lt;S&gt;


</td><td>

_(Optional)_ `{name?, checkpoint?, limit?, verify?}`.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[ISyncResult](./lmdb.isyncresult.md)&lt;S&gt;&gt;

`{copied, checkpoint, verified}`.

## Exceptions

[LmdbError](./lmdb.lmdberror.md) On self-sync and verify divergence.

## Remarks

Copies rows past the checkpoint (explicit option or the persisted cursor for `name`, defaulting to the destination db) through a keyset cursor in 500-row chunks; each committed chunk advances the cursor, so kills resume mid-stream. An explicit `checkpoint` runs one-shot without touching the stored cursor. Sync upserts — destination-only rows are never deleted. Quiesce writes on both subs first: the verify step (counts plus hash spot-checks, on by default) throws `LmdbError` on divergence.

