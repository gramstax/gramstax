---
title: "TemplateEngine.validateBlockGInlineButtonAttributes()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGInlineButtonAttributes](./gramstax.templateengine.validateblockginlinebuttonattributes.md)

## TemplateEngine.validateBlockGInlineButtonAttributes() method

Validates attributes on `<g-inline-button>` blocks.

**Signature:**

```typescript
static validateBlockGInlineButtonAttributes(template: string): {
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

&#123; valid: boolean; errors: Array&lt;&#123; line: number; message: string; &#125;&gt;; &#125;

An object with a `valid` boolean and an `errors` array

## Remarks

Allowed attributes are `lang`, `text`, and `start-parameter`. `text` is required and must be non-empty; a static `start-parameter` must match the Bot API deep-link format (`[A-Za-z0-9_-]`, at most 64 chars) while `{{}}` / `{~ ~}` spans skip the static check and are not re-checked by the framework. Unlike the `_validateDiceItems` split, there is no runtime assertion for this value.

## Example


```typescript
const result = TemplateEngine.validateBlockGInlineButtonAttributes(`<g-base><g-inline-button text="Lihat" start-parameter="d-1"/></g-base>`);
// Result: { valid: true, errors: [] }
```

