---
title: "LmdbJobRun.(constructor)"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbJobRun](./lmdb.lmdbjobrun.md) &gt; [(constructor)](./lmdb.lmdbjobrun._constructor_.md)

## LmdbJobRun.(constructor)

Bind a run-stamp store and scheduler to an env.

**Signature:**

```typescript
constructor(env: LmdbEnv);
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

env


</td><td>

[LmdbEnv](./lmdb.lmdbenv.md)


</td><td>

Owning env (must stay open for this instance's lifetime).


</td></tr>
</tbody></table>

## Remarks

Registers [JobRunSchema](./lmdb.jobrunschema.md) on first use and reuses it afterwards, so a second `LmdbJobRun` on the same env is safe and does not throw. Costs one `maxDbs` slot.

