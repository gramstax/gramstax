---
title: "LmdbBackupHandle.stop()"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbBackupHandle](./lmdb.lmdbbackuphandle.md) &gt; [stop](./lmdb.lmdbbackuphandle.stop.md)

## LmdbBackupHandle.stop() method

Stop the schedule — no further scheduled ticks.

**Signature:**

```typescript
stop(): Promise<void>;
```
**Returns:**

Promise&lt;void&gt;

## Remarks

Resolves once a snapshot already in flight has settled. Await it before closing the env or deleting the backup directory, or the running native copy races the teardown.

