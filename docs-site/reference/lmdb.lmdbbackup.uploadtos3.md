---
title: "LmdbBackup.uploadToS3()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbBackup](./lmdb.lmdbbackup.md) &gt; [uploadToS3](./lmdb.lmdbbackup.uploadtos3.md)

## LmdbBackup.uploadToS3() method

PUT-verified upload of one archive, then remote retention prune.

**Signature:**

```typescript
static uploadToS3(archivePath: string, s3: IBackupS3Options, keep?: number): Promise<string>;
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

archivePath


</td><td>

string


</td><td>

A `backup-*.tar.gz` file.


</td></tr>
<tr><td>

s3


</td><td>

[IBackupS3Options](./lmdb.lmdbbackups3options.md)


</td><td>

Destination (bucket + credentials or prebuilt client).


</td></tr>
<tr><td>

keep


</td><td>

number


</td><td>

_(Optional)_ Remote archives to retain (default `3`).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;string&gt;

The S3 key. Never loses data: failures keep the local file and throw (callers decide — [LmdbBackup.snapshot()](./lmdb.lmdbbackup.snapshot.md) logs and keeps).

