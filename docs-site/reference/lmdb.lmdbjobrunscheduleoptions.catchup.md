---
title: "LmdbJobRunScheduleOptions.catchUp"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbJobRunScheduleOptions](./lmdb.lmdbjobrunscheduleoptions.md) &gt; [catchUp](./lmdb.lmdbjobrunscheduleoptions.catchup.md)

## LmdbJobRunScheduleOptions.catchUp property

Run once at start if a boundary passed while the process was down (default `true`).

**Signature:**

```typescript
catchUp?: boolean;
```

## Remarks

Exactly one run, never one per missed boundary — otherwise three days of downtime against a daily schedule would burn through a retention count with copies of near-identical data.

