---
title: "TemplateEngine._processGWidgetBlocks()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_processGWidgetBlocks](./gramstax.templateengine._processgwidgetblocks.md)

## TemplateEngine.\_processGWidgetBlocks() method

Block: g-widget Extracts and parses `<g-widget>` blocks from a template string.

**Signature:**

```typescript
static _processGWidgetBlocks(template: string): {
        [lang: string]: IWidgetBlock;
    };
```

## Parameters

<table><thead><tr><th>

Parameter


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

template


</td><td>

string


</td><td>

The template string containing `<g-widget>` blocks


</td></tr>
</tbody></table>

**Returns:**

&#123; \[lang: string\]: [IWidgetBlock](./gramstax.iwidgetblock.md); &#125;

An object mapping language keys to their widget configurations

## Remarks

Each block declares one widget per language (`lang` defaults to `"default"`; last block wins per lang). The inner `<g-widget-caption>` becomes `caption` and the inner `<g-widget-body>` becomes the widget `html`, which is carried RAW — it never runs the scope pipeline, so JS object literals, `${}` template strings, and `<div>` / `<button>` / `<script>` / `<style>` tags survive verbatim. Dynamic data rides `chat_data` / `public_data` (compiled like any attribute string), never interpolation inside the HTML.

Boolean flags (`allow_queries`, `is_shared`, `show_caption_above_media`) accept a bare attribute (`<g-widget allow_queries>`) or an explicit value (`allow_queries="false"`); a bare flag is `true`, an explicit value must be `"true"` or `"false"`. `width` / `height` parse to numbers when static integers and stay raw strings when dynamic (`{{}}`), for runtime range checks. Structural rules (exactly one caption, exactly one body, non-empty body, no stray content outside caption + body, caption length, HTML byte sizes, data byte sizes) are enforced by `validateBlockGWidgetAttributes`, not here.

## Example


```typescript
const widgets = TemplateEngine._processGWidgetBlocks(`<g-widget allow_queries><g-widget-caption>Order <b>#1042</b></g-widget-caption><g-widget-body><div id="row"></div><script>TelegramWidget.request("tap")</script></g-widget-body></g-widget>`);
// Result: { default: { html: '<div id="row"></div><script>TelegramWidget.request("tap")</script>', caption: 'Order <b>#1042</b>', allow_queries: true } }
```

