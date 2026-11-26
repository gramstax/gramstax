---
title: "IOptWidget"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IOptWidget](./gramstax.ioptwidget.md)

## IOptWidget type

Widget send options — `Ctx.replyWithWidget` argument index `[1]` (the `other` bag of `sendWidget`).

**Signature:**

```typescript
type IOptWidget = Parameters<Ctx[`replyWithWidget`]>[1];
```
**References:** [Ctx](./gramstax.ctx.md)

## Remarks

Spread LAST over the template fields, like `renderPoll`'s `options`: a caller-supplied `caption` / `parse_mode` / `chat_data` overrides the template value. The template defaults are the contract — `caption` with a hardcoded `parse_mode: "HTML"` — and `options` is the power-user escape hatch, not a second template.

