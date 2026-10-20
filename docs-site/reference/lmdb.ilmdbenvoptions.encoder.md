---
title: "ILmdbEnvOptions.encoder"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ILmdbEnvOptions](./lmdb.ilmdbenvoptions.md) &gt; [encoder](./lmdb.ilmdbenvoptions.encoder.md)

## ILmdbEnvOptions.encoder property

Custom encoder instance for value serialization.

**Signature:**

```typescript
encoder?: unknown;
```

## Remarks

If set, overrides `encoding`. For advanced use cases (cbor-x, custom binary formats). Most users should use `encoding` instead.

