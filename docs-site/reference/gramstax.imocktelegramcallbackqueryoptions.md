---
title: "IMockTelegramCallbackQueryOptions"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IMockTelegramCallbackQueryOptions](./gramstax.imocktelegramcallbackqueryoptions.md)

## IMockTelegramCallbackQueryOptions type

Options for generated mock callback query updates.

**Signature:**

```typescript
type IMockTelegramCallbackQueryOptions = IMockTelegramUpdateOptions & {
    id?: string;
    messageText?: string;
};
```
**References:** [IMockTelegramUpdateOptions](./gramstax.imocktelegramupdateoptions.md)

## Remarks

Extends `IMockTelegramUpdateOptions` with callback-specific fields. Used by `sendCallbackQuery`.

