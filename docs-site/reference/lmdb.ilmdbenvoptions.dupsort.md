---
title: "ILmdbEnvOptions.dupSort"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ILmdbEnvOptions](./lmdb.ilmdbenvoptions.md) &gt; [dupSort](./lmdb.ilmdbenvoptions.dupsort.md)

## ILmdbEnvOptions.dupSort property

Allow duplicate entries per key (dupSort).

**Signature:**

```typescript
dupSort?: boolean;
```

## Remarks

Best used for index-style sub-databases where values represent keys to other sub-databases. Recommended to use `keyEncoding: 'ordered-binary'`.

