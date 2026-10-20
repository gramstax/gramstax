---
title: "IRawReadTransaction"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [IRawReadTransaction](./lmdb.irawreadtransaction.md)

## IRawReadTransaction type

Raw LMDB read transaction augmented with optional lifecycle hooks.

**Signature:**

```typescript
type IRawReadTransaction = Transaction & {
    done?: () => void;
    abort?: () => void;
};
```

## Remarks

`useReadTransaction()` returns a plain `Transaction`; the optional hooks below are probed defensively (`typeof x.done === 'function'`) before use.

