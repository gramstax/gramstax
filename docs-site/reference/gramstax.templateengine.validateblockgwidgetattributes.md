---
title: "TemplateEngine.validateBlockGWidgetAttributes()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGWidgetAttributes](./gramstax.templateengine.validateblockgwidgetattributes.md)

## TemplateEngine.validateBlockGWidgetAttributes() method

Validates attributes and structural rules on `<g-widget>` blocks.

**Signature:**

```typescript
static validateBlockGWidgetAttributes(template: string): {
        valid: boolean;
        errors: Array<{
            line: number;
            message: string;
        }>;
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

The raw template source to validate.


</td></tr>
</tbody></table>

**Returns:**

&#123; valid: boolean; errors: Array&lt;&#123; line: number; message: string; &#125;&gt;; &#125;

`{valid, errors}`; `errors` carry 1-based line numbers.

## Remarks

Step 14 of the `validateTemplate` pipeline. Checks the block-level attributes (`lang`, `allow_queries`, `is_shared`, `show_caption_above_media`, `chat_data`, `public_data`, `width`, `height`) via `_validateBlockAttributes` — note there is deliberately no `caption` attribute: the caption comes only from the required `<g-widget-caption>` child block — then delegates structural rules (exactly one caption, exactly one body, non-empty body, no stray content outside caption + body, caption length, HTML raw/compressed byte sizes, data byte sizes) to [TemplateEngine.\_validateWidgetItems()](./gramstax.templateengine._validatewidgetitems.md). Returns `valid: false` with per-line errors instead of throwing, so callers can aggregate across blocks.

