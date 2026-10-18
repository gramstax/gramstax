

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGIfElseAttributes](./gramstax.templateengine.validateblockgifelseattributes.md)

## TemplateEngine.validateBlockGIfElseAttributes() method

Validates attributes on `<g-ifelse>` blocks.

**Signature:**

```typescript
static validateBlockGIfElseAttributes(template: string): {
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

`<g-ifelse>` takes no attributes — the whole conditional is the block body, so there is nothing for an attribute to configure.

## Example


```typescript
const result = TemplateEngine.validateBlockGIfElseAttributes(`<g-ifelse>a ? "x" : "y"</g-ifelse>`);
// Result: { valid: true, errors: [] }
```

