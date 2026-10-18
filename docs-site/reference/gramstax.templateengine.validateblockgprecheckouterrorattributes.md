---
title: "TemplateEngine.validateBlockGPrecheckoutErrorAttributes()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGPrecheckoutErrorAttributes](./gramstax.templateengine.validateblockgprecheckouterrorattributes.md)

## TemplateEngine.validateBlockGPrecheckoutErrorAttributes() method

Validates attributes and content on `<g-precheckout-error>` blocks.

**Signature:**

```typescript
static validateBlockGPrecheckoutErrorAttributes(template: string): {
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

Allowed attributes are `lang` only. Content must be plain text without HTML (`error_message` accepts no markup); `{{}}` spans skip the static checks (runtime-enforced).

## Example


```typescript
const result = TemplateEngine.validateBlockGPrecheckoutErrorAttributes(`<g-base><g-precheckout-error>Habis</g-precheckout-error></g-base>`);
// Result: { valid: true, errors: [] }
```

