---
title: "LmdbBackupSnapshotResult"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbBackupSnapshotResult](./lmdb.lmdbbackupsnapshotresult.md)

## LmdbBackupSnapshotResult interface

Result of [LmdbBackup.snapshot()](./lmdb.lmdbbackup.snapshot.md).

**Signature:**

```typescript
interface IBackupSnapshotResult 
```

## Properties

<table><thead><tr><th>

Property


</th><th>

Modifiers


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[path](./lmdb.lmdbbackupsnapshotresult.path.md)


</td><td>


</td><td>

string


</td><td>

Archive path (tar.gz) or backup dir (dir format).


</td></tr>
<tr><td>

[uploaded?](./lmdb.lmdbbackupsnapshotresult.uploaded.md)


</td><td>


</td><td>

string


</td><td>

_(Optional)_ S3 key when uploaded.


</td></tr>
</tbody></table>

