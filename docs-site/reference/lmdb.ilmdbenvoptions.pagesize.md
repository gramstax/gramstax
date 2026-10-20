---
title: "ILmdbEnvOptions.pageSize"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ILmdbEnvOptions](./lmdb.ilmdbenvoptions.md) &gt; [pageSize](./lmdb.ilmdbenvoptions.pagesize.md)

## ILmdbEnvOptions.pageSize property

Database page size in bytes.

**Signature:**

```typescript
pageSize?: number;
```

## Remarks

Defaults to OS page size (usually 4096, or 16384 on MacOS M-series). Use `8192` for databases larger than RAM with many range queries. Only affects new databases.

