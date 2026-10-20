---
title: "LmdbBackup.pruneArchives()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbBackup](./lmdb.lmdbbackup.md) &gt; [pruneArchives](./lmdb.lmdbbackup.prunearchives.md)

## LmdbBackup.pruneArchives() method

Delete oldest archives beyond `keep`.

**Signature:**

```typescript
static pruneArchives(baseDir: string, keep?: number): Promise<{
        kept: number;
        removed: Array<string>;
    }>;
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

baseDir


</td><td>

string


</td><td>

Directory holding archives.


</td></tr>
<tr><td>

keep


</td><td>

number


</td><td>

_(Optional)_ Archives to retain (default `3`).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;\{ kept: number; removed: Array&lt;string&gt;; }&gt;

Kept count and removed paths.

