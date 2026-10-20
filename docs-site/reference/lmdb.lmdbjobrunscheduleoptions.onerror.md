---
title: "LmdbJobRunScheduleOptions.onError"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbJobRunScheduleOptions](./lmdb.lmdbjobrunscheduleoptions.md) &gt; [onError](./lmdb.lmdbjobrunscheduleoptions.onerror.md)

## LmdbJobRunScheduleOptions.onError property

Tick failure handler.

**Signature:**

```typescript
onError?: (err: unknown) => void;
```

## Remarks

Defaults to reporting through the env's diagnostics sink — see [ILmdbEnvOptions.onWarn](./lmdb.ilmdbenvoptions.onwarn.md). Nothing is written to `console`.

