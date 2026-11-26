---
title: "TemplateEngine._validateWidgetItems()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_validateWidgetItems](./gramstax.templateengine._validatewidgetitems.md)

## TemplateEngine.\_validateWidgetItems() method

Validates `<g-widget-caption>` / `<g-widget-body>` presence and `<g-widget>` size limits.

**Signature:**

```typescript
static _validateWidgetItems(template: string): Array<{
        line: number;
        message: string;
    }>;
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

The raw template source to inspect.


</td></tr>
</tbody></table>

**Returns:**

Array&lt;&#123; line: number; message: string; &#125;&gt;

Validation errors (empty when valid).

## Remarks

Enforces the Bot API `sendWidget` constraints on the RAW template values (the widget HTML carries no interpolation, so the static check is exact): exactly one `<g-widget-caption>` (required — it is the fallback text on clients without widget support), exactly one `<g-widget-body>` (required — it carries the widget HTML), body content at least 1 UTF-8 byte (the API requires HTML of 1–32768 bytes; an empty body used to slip through compile and fail only at Telegram), no stray content inside `<g-widget>` outside the caption and body blocks, caption text 1–1024 characters after entity parsing (HTML tags stripped; skipped when the caption carries `{{}}` / `{~ ~}` interpolation — dynamic lengths are checked at runtime by `Ctx.assertWidget`), HTML at most 32768 UTF-8 bytes raw and at most 4000 bytes after zlib level-9 compression (the safe target — see [TemplateEngine.MAX\_WIDGET\_HTML\_COMPRESSED\_SAFE\_BYTES](./gramstax.templateengine.max_widget_html_compressed_safe_bytes.md); the API hard limit is 4096), `chat_data` / `public_data` at most 1024 UTF-8 bytes each (skipped when dynamic). Called by [TemplateEngine.validateBlockGWidgetAttributes()](./gramstax.templateengine.validateblockgwidgetattributes.md); errors carry 1-based line numbers.

