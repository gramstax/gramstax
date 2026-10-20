---
title: "ILmdbEnvOptions.noMemInit"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ILmdbEnvOptions](./lmdb.ilmdbenvoptions.md) &gt; [noMemInit](./lmdb.ilmdbenvoptions.nomeminit.md)

## ILmdbEnvOptions.noMemInit property

Skip zero-ing malloc'ed data on writes (small perf boost).

**Signature:**

```typescript
noMemInit?: boolean;
```

## Remarks

May leave application data in unused portions of the DB file. Safe unless the DB files might be accessed by untrusted parties.

