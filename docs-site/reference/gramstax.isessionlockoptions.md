---
title: "ISessionLockOptions"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [ISessionLockOptions](./gramstax.isessionlockoptions.md)

## ISessionLockOptions type

Configuration for the distributed session lock.

**Signature:**

```typescript
type ISessionLockOptions = {
    enabled?: boolean;
    leaseMs?: number;
    onContended?: ISessionLockOnContended;
    key?: (ctx: Ctx) => string;
};
```
**References:** [ISessionLockOnContended](./gramstax.isessionlockoncontended.md), [Ctx](./gramstax.ctx.md)

## Remarks

Redis-only: the lock uses atomic `SET NX PX` leases on the session key so concurrent updates for the same user/chat are serialized or skipped across instances. When the bots cache is NOT Redis-backed, the feature is auto-disabled with a warning (single-instance deployments do not need it).

