---
title: "IMockTelegramLocationOptions"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IMockTelegramLocationOptions](./gramstax.imocktelegramlocationoptions.md)

## IMockTelegramLocationOptions type

Options for generated mock location updates.

**Signature:**

```typescript
type IMockTelegramLocationOptions = IMockTelegramUpdateOptions & {
    latitude?: number;
    longitude?: number;
};
```
**References:** [IMockTelegramUpdateOptions](./gramstax.imocktelegramupdateoptions.md)

## Remarks

Extends `IMockTelegramUpdateOptions` with `latitude` and `longitude`. Used by `sendLocation`.

