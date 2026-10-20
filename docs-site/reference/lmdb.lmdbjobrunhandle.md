---
title: "LmdbJobRunHandle"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbJobRunHandle](./lmdb.lmdbjobrunhandle.md)

## LmdbJobRunHandle interface

Handle returned by [LmdbJobRun.start()](./lmdb.lmdbjobrun.start.md).

**Signature:**

```typescript
interface IJobRunHandle 
```

## Methods

<table><thead><tr><th>

Method


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[label()](./lmdb.lmdbjobrunhandle.label.md)


</td><td>

Cron pattern plus the last-run stamp (`0 3 * * *, last run <ISO>`).


</td></tr>
<tr><td>

[lastRun()](./lmdb.lmdbjobrunhandle.lastrun.md)


</td><td>

Epoch ms of the last successful run, or `undefined` before the first one.


</td></tr>
<tr><td>

[nextRun()](./lmdb.lmdbjobrunhandle.nextrun.md)


</td><td>

Next scheduled run, or `undefined` once stopped.


</td></tr>
<tr><td>

[runNow()](./lmdb.lmdbjobrunhandle.runnow.md)


</td><td>

Run the task now and record the run, without disturbing the schedule.


</td></tr>
<tr><td>

[stop()](./lmdb.lmdbjobrunhandle.stop.md)


</td><td>

Stop the schedule — no further scheduled ticks.


</td></tr>
</tbody></table>

