

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGMessageAttributes](./gramstax.templateengine.validateblockgmessageattributes.md)

## TemplateEngine.validateBlockGMessageAttributes() method

Validates attributes on `<g-message>` blocks.

**Signature:**

```typescript
static validateBlockGMessageAttributes(template: string): {
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

The only allowed attribute is `lang`.

## Example


```typescript
const result = TemplateEngine.validateBlockGMessageAttributes(`<g-message lang="en">Hi</g-message>`);
// Result: { valid: true, errors: [] }
```

