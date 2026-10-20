---
title: "LmdbBackupHandle"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbBackupHandle](./lmdb.lmdbbackuphandle.md)

## LmdbBackupHandle interface

Handle returned by [LmdbBackup.start()](./lmdb.lmdbbackup.start.md).

**Signature:**

```typescript
interface IBackupHandle 
```

## Methods

<table><thead><tr><th>

Method


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[label()](./lmdb.lmdbbackuphandle.label.md)


</td><td>

Cron pattern plus the last-run stamp (`0 3 * * *, last run <ISO>`).


</td></tr>
<tr><td>

[lastRun()](./lmdb.lmdbbackuphandle.lastrun.md)


</td><td>

Epoch ms of the last successful snapshot, or `undefined` before the first.


</td></tr>
<tr><td>

[nextRun()](./lmdb.lmdbbackuphandle.nextrun.md)


</td><td>

Next scheduled snapshot, or `undefined` once stopped.


</td></tr>
<tr><td>

[runNow()](./lmdb.lmdbbackuphandle.runnow.md)


</td><td>

Take a snapshot now and record the run, without disturbing the schedule.


</td></tr>
<tr><td>

[stop()](./lmdb.lmdbbackuphandle.stop.md)


</td><td>

Stop the schedule — no further scheduled ticks.


</td></tr>
</tbody></table>

