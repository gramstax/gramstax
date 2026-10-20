---
title: "LmdbBackupStartOptions.onError"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbBackupStartOptions](./lmdb.lmdbbackupstartoptions.md) &gt; [onError](./lmdb.lmdbbackupstartoptions.onerror.md)

## LmdbBackupStartOptions.onError property

Tick failure handler.

**Signature:**

```typescript
onError?: (err: unknown) => void;
```

## Remarks

Defaults to reporting through the env's diagnostics sink — see [ILmdbEnvOptions.onWarn](./lmdb.ilmdbenvoptions.onwarn.md). Nothing is written to `console`.

