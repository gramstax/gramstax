---
title: "GShippingErrorResult"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [GShippingErrorResult](./gramstax.gshippingerrorresult.md)

## GShippingErrorResult type

Result of `TemplateManager.getGShippingError` for a `<g-shipping-error>` block.

**Signature:**

```typescript
type GShippingErrorResult = {
    kind: `shippingError`;
    text: string;
};
```

## Remarks

`text` is the rendered rejection message; the getter throws when the block is missing (rejected shipping needs an error message).

