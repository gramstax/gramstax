---
title: "GWidgetResult"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [GWidgetResult](./gramstax.gwidgetresult.md)

## GWidgetResult type

Result of `TemplateManager.getGWidget` for a `<g-widget>` block.

**Signature:**

```typescript
type GWidgetResult = {
    kind: `widget`;
} & IWidgetBlock;
```
**References:** [IWidgetBlock](./gramstax.iwidgetblock.md)

## Remarks

Extends [IWidgetBlock](./gramstax.iwidgetblock.md) with the `widget` kind discriminator.

