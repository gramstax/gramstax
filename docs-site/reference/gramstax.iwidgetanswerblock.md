---
title: "IWidgetAnswerBlock"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IWidgetAnswerBlock](./gramstax.iwidgetanswerblock.md)

## IWidgetAnswerBlock type

Widget-answer block for Telegram widget-query feedback.

**Signature:**

```typescript
type IWidgetAnswerBlock = {
    text: string;
};
```

## Remarks

Declared with `<g-widget-answer>` blocks. `text` supports the same `{{var|filter}}` interpolation pipeline as callback answers; the compiled value is an opaque data payload for the widget's JS (not user-facing copy), plain text without HTML, at most 1024 UTF-8 bytes per the Bot API `answerWidgetQuery` limits.

## Example


```typescript
const answer: IWidgetAnswerBlock = {
  text: `ok {{orderId}}`
}
```

