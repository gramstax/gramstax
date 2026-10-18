

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGPriceAttributes](./gramstax.templateengine.validateblockgpriceattributes.md)

## TemplateEngine.validateBlockGPriceAttributes() method

Validates attributes on `<g-price>` line items inside `<g-invoice>` blocks.

**Signature:**

```typescript
static validateBlockGPriceAttributes(template: string): {
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

Allowed attributes are `label` and `amount`; value formats come from [TemplateEngine.\_PAGE\_ATTR\_VALUE\_VALIDATORS](./gramstax.templateengine._page_attr_value_validators.md) (`amount` must be a positive integer in smallest currency units). Presence and static length rules live in [TemplateEngine.\_validateInvoiceItems()](./gramstax.templateengine._validateinvoiceitems.md).

## Example


```typescript
const result = TemplateEngine.validateBlockGPriceAttributes(`<g-price label="VIP" amount="100"/>`);
// Result: { valid: true, errors: [] }
```

