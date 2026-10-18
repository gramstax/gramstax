---
title: "TemplateEngine.validateBlockGImportAttributes()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGImportAttributes](./gramstax.templateengine.validateblockgimportattributes.md)

## TemplateEngine.validateBlockGImportAttributes() method

Validates attributes on `<g-import>` blocks.

**Signature:**

```typescript
static validateBlockGImportAttributes(template: string): {
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

Allowed attributes are `src`, `block`, `base`, `lang`, and `section`.

## Example


```typescript
const result = TemplateEngine.validateBlockGImportAttributes(`<g-import src="other" block="message" />`);
// Result: { valid: true, errors: [] }
```

