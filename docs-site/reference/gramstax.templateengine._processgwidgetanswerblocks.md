---
title: "TemplateEngine._processGWidgetAnswerBlocks()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_processGWidgetAnswerBlocks](./gramstax.templateengine._processgwidgetanswerblocks.md)

## TemplateEngine.\_processGWidgetAnswerBlocks() method

Block: g-widget-answer Extracts `<g-widget-answer>` plain-text blocks from a template string.

**Signature:**

```typescript
static _processGWidgetAnswerBlocks(template: string): {
        [lang: string]: string;
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

The template string containing `<g-widget-answer>` blocks


</td></tr>
</tbody></table>

**Returns:**

&#123; \[lang: string\]: string; &#125;

An object mapping language keys to their raw text content

## Remarks

Children form only (`<g-widget-answer>text</g-widget-answer>`); content is cleaned exactly like `<g-message>` (leading indent stripped, surrounding newlines trimmed) and keyed by `lang` (`"default"` when absent; last block wins per lang). Raw content is preserved verbatim (including `{{var|filter}}` spans) for later compilation. Plain-text and length rules are enforced by `validateBlockGWidgetAnswerAttributes`, not here.

## Example


```typescript
const blocks = TemplateEngine._processGWidgetAnswerBlocks(`<g-widget-answer>ok {{orderId}}</g-widget-answer>`);
// Result: { default: 'ok {{orderId}}' }
```

