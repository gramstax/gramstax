---
title: "IGramstaxBotClass"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IGramstaxBotClass](./gramstax.igramstaxbotclass.md)

## IGramstaxBotClass type

Constructor of the project `BotCore` class.

**Signature:**

```typescript
type IGramstaxBotClass = new (params: IGramstaxParams) => Gramstax;
```
**References:** [IGramstaxParams](./gramstax.igramstaxparams.md), [Gramstax](./gramstax.gramstax.md)

## Remarks

Discovered by `GramstaxStart._discoverBotCore` from `src/core/bot.ts` (or `.js`): the first export whose prototype extends `Gramstax`. Instantiated with the materialized `IGramstaxParams` in `GramstaxStart.boot`.

