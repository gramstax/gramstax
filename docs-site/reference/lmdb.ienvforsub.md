---
title: "IEnvForSub"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [IEnvForSub](./lmdb.ienvforsub.md)

## IEnvForSub type

Subset of [LmdbEnv](./lmdb.lmdbenv.md) exposed to  sub-DB handles.

**Signature:**

```typescript
type IEnvForSub = Database<unknown, Key> & {
    transaction: LmdbEnv[`transaction`];
    readTransaction: LmdbEnv[`readTransaction`];
    readOnly: boolean;
};
```
**References:** [LmdbEnv](./lmdb.lmdbenv.md)

## Remarks

Picked directly from `LmdbEnv` so method signatures are always in sync. At runtime the sub receives a combined object that delegates data operations to its sub-DB handle and root-env methods to the owning env.

