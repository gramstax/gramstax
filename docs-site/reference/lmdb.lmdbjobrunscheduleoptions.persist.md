---
title: "LmdbJobRunScheduleOptions.persist"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbJobRunScheduleOptions](./lmdb.lmdbjobrunscheduleoptions.md) &gt; [persist](./lmdb.lmdbjobrunscheduleoptions.persist.md)

## LmdbJobRunScheduleOptions.persist property

Read and write the run-stamp (default `true`).

**Signature:**

```typescript
persist?: boolean;
```

## Remarks

`false` keeps `lastRun` in memory only: no catch-up decision is made and nothing is written, so the schedule cannot survive a restart. The `__job_run` schema is still registered by the constructor.

