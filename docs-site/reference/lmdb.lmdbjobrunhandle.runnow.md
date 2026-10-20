---
title: "LmdbJobRunHandle.runNow()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbJobRunHandle](./lmdb.lmdbjobrunhandle.md) &gt; [runNow](./lmdb.lmdbjobrunhandle.runnow.md)

## LmdbJobRunHandle.runNow() method

Run the task now and record the run, without disturbing the schedule.

**Signature:**

```typescript
runNow(): Promise<void>;
```
**Returns:**

Promise&lt;void&gt;

## Remarks

Resolves when the task has completed, so it is safe to assert on the result straight after awaiting. A call arriving while a run is in flight \*\*joins\*\* that run rather than skipping, so the resolved value always means real work finished. Still works after [LmdbJobRunHandle.stop()](./lmdb.lmdbjobrunhandle.stop.md).

