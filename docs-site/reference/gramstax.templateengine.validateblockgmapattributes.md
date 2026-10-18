---
title: "TemplateEngine.validateBlockGMapAttributes()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGMapAttributes](./gramstax.templateengine.validateblockgmapattributes.md)

## TemplateEngine.validateBlockGMapAttributes() method

Validates attributes on `<g-map>` blocks.

**Signature:**

```typescript
static validateBlockGMapAttributes(template: string): {
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

Allowed attributes are `src` and `join`.

## Example


```typescript
const result = TemplateEngine.validateBlockGMapAttributes(`<g-map src="items" join=", ">{{e}}</g-map>`);
// Result: { valid: true, errors: [] }
```

