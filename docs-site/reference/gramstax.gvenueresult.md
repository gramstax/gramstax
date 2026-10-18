---
title: "GVenueResult"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [GVenueResult](./gramstax.gvenueresult.md)

## GVenueResult type

Result of `TemplateManager.getGVenue` for a `<g-venue>` block.

**Signature:**

```typescript
type GVenueResult = {
    kind: `venue`;
} & IVenueBlock;
```
**References:** [IVenueBlock](./gramstax.ivenueblock.md)

## Remarks

Extends [IVenueBlock](./gramstax.ivenueblock.md) with the `venue` kind discriminator.

