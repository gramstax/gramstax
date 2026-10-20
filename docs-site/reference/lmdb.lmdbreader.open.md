---
title: "LmdbReader.open()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbReader](./lmdb.lmdbreader.md) &gt; [open](./lmdb.lmdbreader.open.md)

## LmdbReader.open() method

Open a read-only replica of an existing env at `path`.

**Signature:**

```typescript
static open(path: string, opts?: {
        maxDbs?: number;
        pollMs?: number;
    }): Promise<LmdbEnv>;
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

path


</td><td>

string


</td><td>

Same path as the writer env.


</td></tr>
<tr><td>

opts


</td><td>

&#123; maxDbs?: number; pollMs?: number; &#125;


</td><td>

_(Optional)_ Optional `maxDbs` and `pollMs` for periodic `resetReadTxn`.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[LmdbEnv](./lmdb.lmdbenv.md)&gt;

A read-only [LmdbEnv](./lmdb.lmdbenv.md) — caller must `close()` it.

