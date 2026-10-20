---
title: "LmdbBackup.clearStaleStaging()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbBackup](./lmdb.lmdbbackup.md) &gt; [clearStaleStaging](./lmdb.lmdbbackup.clearstalestaging.md)

## LmdbBackup.clearStaleStaging() method

Delete crash leftovers: raw staging dirs with no matching archive.

**Signature:**

```typescript
static clearStaleStaging(dir: string): Promise<void>;
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

dir


</td><td>

string


</td><td>

Directory holding backups.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;void&gt;

