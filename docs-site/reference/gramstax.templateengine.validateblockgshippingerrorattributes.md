

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGShippingErrorAttributes](./gramstax.templateengine.validateblockgshippingerrorattributes.md)

## TemplateEngine.validateBlockGShippingErrorAttributes() method

Validates attributes and content on `<g-shipping-error>` blocks.

**Signature:**

```typescript
static validateBlockGShippingErrorAttributes(template: string): {
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
const result = TemplateEngine.validateBlockGShippingErrorAttributes(`<g-base><g-shipping-error>Jauh</g-shipping-error></g-base>`);
// Result: { valid: true, errors: [] }
```

