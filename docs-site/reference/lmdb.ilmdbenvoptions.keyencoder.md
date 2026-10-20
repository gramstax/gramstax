---
title: "ILmdbEnvOptions.keyEncoder"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ILmdbEnvOptions](./lmdb.ilmdbenvoptions.md) &gt; [keyEncoder](./lmdb.ilmdbenvoptions.keyencoder.md)

## ILmdbEnvOptions.keyEncoder property

Custom key encoder instance.

**Signature:**

```typescript
keyEncoder?: unknown;
```

## Remarks

If set, overrides `keyEncoding`. For advanced use cases (UUIDs, custom binary keys). Most users should use `keyEncoding` instead.

