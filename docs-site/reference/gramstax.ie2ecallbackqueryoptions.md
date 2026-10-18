---
title: "IE2eCallbackQueryOptions"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IE2eCallbackQueryOptions](./gramstax.ie2ecallbackqueryoptions.md)

## IE2eCallbackQueryOptions type

E2E options for callback query updates.

**Signature:**

```typescript
type IE2eCallbackQueryOptions = IE2eUpdateOptions & {
    id?: string;
    messageText?: string;
};
```
**References:** [IE2eUpdateOptions](./gramstax.ie2eupdateoptions.md)

## Remarks

Extends `IE2eUpdateOptions` with callback-query envelope fields. Used by `E2eHelper.sendCallbackQuery` to build the surrounding message stub.

