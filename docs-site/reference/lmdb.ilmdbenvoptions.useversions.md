---
title: "ILmdbEnvOptions.useVersions"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ILmdbEnvOptions](./lmdb.ilmdbenvoptions.md) &gt; [useVersions](./lmdb.ilmdbenvoptions.useversions.md)

## ILmdbEnvOptions.useVersions property

Enable record versioning for optimistic locking.

**Signature:**

```typescript
useVersions?: boolean;
```

## Remarks

Required for atomic conditional writes via `ifVersion`/`ifNoExists` (used by `env.update` when wrapped in `env.transaction`).

