---
title: "GPreCheckoutErrorResult"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [GPreCheckoutErrorResult](./gramstax.gprecheckouterrorresult.md)

## GPreCheckoutErrorResult type

Result of `TemplateManager.getGPrecheckoutError` for a `<g-precheckout-error>` block.

**Signature:**

```typescript
type GPreCheckoutErrorResult = {
    kind: `preCheckoutError`;
    text: string;
};
```

## Remarks

`text` is the rendered decline message; the getter throws when the block is missing (declined payments need an error message).

