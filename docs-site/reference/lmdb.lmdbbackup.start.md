---
title: "LmdbBackup.start()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbBackup](./lmdb.lmdbbackup.md) &gt; [start](./lmdb.lmdbbackup.start.md)

## LmdbBackup.start() method

Run snapshots on a cron schedule, resuming across restarts.

**Signature:**

```typescript
static start(env: LmdbEnv, opts: IBackupStartOptions): IBackupHandle;
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

Writer env to back up (must stay open).


</td></tr>
<tr><td>

opts


</td><td>

[IBackupStartOptions](./lmdb.lmdbbackupstartoptions.md)


</td><td>

`{dir, keep?, pattern, timezone?, runOnStart?, format?, s3?, onError?, persist?, persistKey?}`.


</td></tr>
</tbody></table>

**Returns:**

[IBackupHandle](./lmdb.lmdbbackuphandle.md)

`{stop, runNow, lastRun, nextRun, label}` handle.

## Exceptions

[LmdbError](./lmdb.lmdberror.md) On a bad format, an s3/format pairing mismatch, or a closed env — the job-run store is constructed up front.

## Remarks

A thin wrapper over [LmdbJobRun.start()](./lmdb.lmdbjobrun.start.md): this module owns \*what\* to do (take a snapshot, prune, optionally upload) and the job-run module owns \*when\* to do it. Everything schedule-related — croner, the missed-boundary check, the overlap guard, the run-stamp — lives there, so any other job can opt into the same restart safety without going through this helper.

