---
title: "TemplateEngine.validateFormatBlock()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateFormatBlock](./gramstax.templateengine.validateformatblock.md)

## TemplateEngine.validateFormatBlock() method

Validates block syntax format (self-closing vs regular open/close).

**Signature:**

```typescript
static validateFormatBlock(template: string): {
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

The raw template string to validate


</td></tr>
</tbody></table>

**Returns:**

\{ valid: boolean; errors: Array&lt;\{ line: number; message: string; }&gt;; }

An object with a `valid` boolean and an `errors` array containing line numbers and descriptive messages for each format violation found

## Remarks

This method checks that each block tag uses the correct syntax format:

\*\*Must be self-closing:\*\* - `<g-space />` — whitespace control block - `<g-import ... />` — import directive block - `<hr/>`, `<img/>`, `<input/>`, `<br/>`, `<tg-map/>` — Telegram Rich HTML void elements

\*\*Must NOT be self-closing (must use open/close tags):\*\* - `<g-base>...</g-base>`, `<g-message>...</g-message>`, `<g-keyboard>...</g-keyboard>`, `<g-media>...</g-media>`, `<g-poll>...</g-poll>`, `<g-question>...</g-question>`, `<g-option>...</g-option>`, `<g-invoice>...</g-invoice>`, `<g-paid-media>...</g-paid-media>`, `<g-description>...</g-description>`, `<g-script>...</g-script>`, `<g-switch>...</g-switch>`, `<g-case>...</g-case>`, `<g-default>...</g-default>`, `<g-map>...</g-map>`, `<g-div>...</g-div>`

Telegram HTML formatting tags with content (e.g. `<b>`, `<p>`, `<table>`) passthrough and are not format-checked — both `<b>text</b>` and `<b/>` are accepted.

## Example


```typescript
const result = TemplateEngine.validateFormatBlock(`<g-space>content</g-space>`);
// Result: { valid: false, errors: [{ line: 1, message: 'Block <g-space> must be self-closing: use <g-space /> instead' }] }
```

