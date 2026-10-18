---
title: "IGramstaxSessionLockRef"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IGramstaxSessionLockRef](./gramstax.igramstaxsessionlockref.md)

## IGramstaxSessionLockRef type

`sessionLock` slot: scalars plus an optional `key` factory given as a path-ref resolving to `(ctx) => string`.

**Signature:**

```typescript
type IGramstaxSessionLockRef = {
    enabled?: boolean;
    leaseMs?: number;
    onContended?: ISessionLockOnContended;
    key?: IGramstaxPathRef;
};
```
**References:** [ISessionLockOnContended](./gramstax.isessionlockoncontended.md), [IGramstaxPathRef](./gramstax.igramstaxpathref.md)

## Remarks

Must be an object when present — unknown fields are rejected by the loader. The optional `key` factory is a path-ref (bare string or `{override: {module, export?, args?}}`) resolving to a `(ctx) => string` function.

## Example


```typescript
const lock: IGramstaxSessionLockRef = {enabled: true, leaseMs: 5000, onContended: `skip`}
```

