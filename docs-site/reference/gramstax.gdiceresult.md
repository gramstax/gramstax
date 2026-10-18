---
title: "GDiceResult"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [GDiceResult](./gramstax.gdiceresult.md)

## GDiceResult type

Result of `TemplateManager.getGDice` for a `<g-dice>` block.

**Signature:**

```typescript
type GDiceResult = {
    kind: `dice`;
} & IDiceBlock;
```
**References:** [IDiceBlock](./gramstax.idiceblock.md)

## Remarks

Extends [IDiceBlock](./gramstax.idiceblock.md) with the `dice` kind discriminator.

