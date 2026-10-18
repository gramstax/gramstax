---
title: "TemplateEngine.DICE_EMOJI"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [DICE\_EMOJI](./gramstax.templateengine.dice_emoji.md)

## TemplateEngine.DICE\_EMOJI property

Bot API dice emoji values accepted by `<g-dice emoji>`.

**Signature:**

```typescript
static DICE_EMOJI: ReadonlySet<string>;
```

## Remarks

Single source of truth shared by the `g-dice` validators and `Ctx.DICE_EMOJI`/`Ctx.assertDiceEmoji`: exactly the six `sendDice` emoji (`🎲🎯🏀⚽🎳🎰`).

