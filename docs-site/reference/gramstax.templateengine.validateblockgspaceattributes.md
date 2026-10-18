---
title: "TemplateEngine.validateBlockGSpaceAttributes()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGSpaceAttributes](./gramstax.templateengine.validateblockgspaceattributes.md)

## TemplateEngine.validateBlockGSpaceAttributes() method

Validates attributes on `<g-space>` blocks.

**Signature:**

```typescript
static validateBlockGSpaceAttributes(template: string): {
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

No attributes are allowed on `<g-space>` blocks.

## Example


```typescript
const result = TemplateEngine.validateBlockGSpaceAttributes(`<g-space />`);
// Result: { valid: true, errors: [] }
```

