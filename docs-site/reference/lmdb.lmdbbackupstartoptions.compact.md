---
title: "LmdbBackupStartOptions.compact"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbBackupStartOptions](./lmdb.lmdbbackupstartoptions.md) &gt; [compact](./lmdb.lmdbbackupstartoptions.compact.md)

## LmdbBackupStartOptions.compact property

Compact each snapshot while copying (default `false`).

**Signature:**

```typescript
compact?: boolean;
```

## Remarks

`true` rewrites the copy densely, so it is slower but smaller on disk and cheaper to restore from later. Worth it for archives you retain or ship off-host; leave it off for local snapshots you will replace soon.

