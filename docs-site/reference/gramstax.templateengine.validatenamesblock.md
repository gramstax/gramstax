---
title: "TemplateEngine.validateNamesBlock()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateNamesBlock](./gramstax.templateengine.validatenamesblock.md)

## TemplateEngine.validateNamesBlock() method

Validates that all block tags in a template are recognized.

**Signature:**

```typescript
static validateNamesBlock(template: string): {
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

An object with a `valid` boolean and an `errors` array containing  line numbers and descriptive messages for each unknown block found

## Remarks

Every HTML-like tag in the template must match a known block name from [TemplateEngine.ALLOWED\_BLOCKS](./gramstax.templateengine.allowed_blocks.md). Unknown tags produce an error.

Telegram HTML formatting tags (`<b>`, `<i>`, `<u>`, `<s>`, `<code>`, `<pre>`, `<a>`, `<blockquote>`) are whitelisted and silently ignored.

## Example


```typescript
const result = TemplateEngine.validateNamesBlock(`<custom>text</custom>`);
// Result: { valid: false, errors: [{ line: 1, message: 'Unsupported template block: <custom>' }] }
```

