---
title: "ITransactionLifecycle"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ITransactionLifecycle](./lmdb.itransactionlifecycle.md)

## ITransactionLifecycle type

Lifecycle of a [LmdbTransaction](./lmdb.lmdbtransaction.md).

**Signature:**

```typescript
type ITransactionLifecycle = `active` | `committed` | `aborted` | `released`;
```

## Remarks

`released` is used for read transactions that finished normally — the raw LMDB read transaction is freed but the wrapper was NOT aborted by user code. Distinguishing it from `aborted` matters for `isAborted` consumers.

