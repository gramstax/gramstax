---
title: "LmdbBackupSnapshotOptions.s3Keep"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbBackupSnapshotOptions](./lmdb.lmdbbackupsnapshotoptions.md) &gt; [s3Keep](./lmdb.lmdbbackupsnapshotoptions.s3keep.md)

## LmdbBackupSnapshotOptions.s3Keep property

Remote archives to retain after each tick (default: `keep`).

**Signature:**

```typescript
s3Keep?: number;
```

## Remarks

Separate from [LmdbBackupSnapshotOptions.keep](./lmdb.lmdbbackupsnapshotoptions.keep.md) because off-host retention is usually longer than local — you prune local copies aggressively to save disk and keep the archive you can restore from anywhere. Falls back to `keep`, so a caller that never sets it behaves exactly as before.

