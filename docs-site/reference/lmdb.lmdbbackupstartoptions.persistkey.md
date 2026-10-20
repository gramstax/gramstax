---
title: "LmdbBackupStartOptions.persistKey"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [LmdbBackupStartOptions](./lmdb.lmdbbackupstartoptions.md) &gt; [persistKey](./lmdb.lmdbbackupstartoptions.persistkey.md)

## LmdbBackupStartOptions.persistKey property

Job name for the persisted stamp (default `'backup'`).

**Signature:**

```typescript
persistKey?: string;
```

## Remarks

Use distinct names for schedules sharing one env, so they do not overwrite each other's stamp.

