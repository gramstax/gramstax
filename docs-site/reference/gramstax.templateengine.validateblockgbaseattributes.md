

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGBaseAttributes](./gramstax.templateengine.validateblockgbaseattributes.md)

## TemplateEngine.validateBlockGBaseAttributes() method

Validates attributes on `<g-base>` blocks.

**Signature:**

```typescript
static validateBlockGBaseAttributes(template: string): {
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

The only allowed attribute is `id`.

## Example


```typescript
const result = TemplateEngine.validateBlockGBaseAttributes(`<g-base id="main"></g-base>`);
// Result: { valid: true, errors: [] }
```

