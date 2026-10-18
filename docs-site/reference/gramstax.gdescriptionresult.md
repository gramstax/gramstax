---
title: "GDescriptionResult"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [GDescriptionResult](./gramstax.gdescriptionresult.md)

## GDescriptionResult type

Result of `TemplateManager.getGDescription` for a `<g-description>` block.

**Signature:**

```typescript
type GDescriptionResult = {
    kind: `description`;
    text: string;
};
```

## Remarks

`text` is the rendered command description; a missing block yields `{kind: "description", text: ""}`.

