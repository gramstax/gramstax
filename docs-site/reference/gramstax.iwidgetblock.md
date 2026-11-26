---
title: "IWidgetBlock"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IWidgetBlock](./gramstax.iwidgetblock.md)

## IWidgetBlock type

Widget block for Telegram HTML widgets (Bot API 10.4).

**Signature:**

```typescript
type IWidgetBlock = {
    html: string;
    caption: string;
    allow_queries?: boolean;
    is_shared?: boolean;
    show_caption_above_media?: boolean;
    chat_data?: string;
    public_data?: string;
    width?: number | string;
    height?: number | string;
};
```

## Remarks

Declared with `<g-widget>` blocks. The widget HTML comes from the required `<g-widget-body>` child block and is carried RAW — it never runs the scope pipeline (`{{}}` interpolation, `<g-script>`, `<g-switch>` and friends are inert text inside the widget), so JS object literals and `${}` template strings survive compilation untouched. Dynamic data rides `chat_data` / `public_data` instead. The caption comes from the required `<g-widget-caption>` child block and runs the same rich pipeline as poll questions (HTML tags + `{{var|filter}}` interpolation); it is sent with a hardcoded `parse_mode: "HTML"`, never `caption_entities`.

There is no way to replace the HTML of a sent widget — the Bot API offers no `editMessageWidget`. "Edit" only re-applies `chat_data` / `public_data`, the caption, and the keyboard to the message that holds the widget.

## Example


```typescript
const block: IWidgetBlock = {html: `<div id="row"></div><script>TelegramWidget.request("tap")</script>`, caption: `Order <b>#1042</b>`, allow_queries: true}
```

