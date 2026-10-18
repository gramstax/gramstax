---
title: "IMockTelegramContactOptions"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IMockTelegramContactOptions](./gramstax.imocktelegramcontactoptions.md)

## IMockTelegramContactOptions type

Options for generated mock contact updates.

**Signature:**

```typescript
type IMockTelegramContactOptions = IMockTelegramUpdateOptions & {
    phone_number?: string;
    first_name?: string;
    last_name?: string;
    user_id?: number;
};
```
**References:** [IMockTelegramUpdateOptions](./gramstax.imocktelegramupdateoptions.md)

## Remarks

Extends `IMockTelegramUpdateOptions` with contact fields. Used by `sendContact`.

