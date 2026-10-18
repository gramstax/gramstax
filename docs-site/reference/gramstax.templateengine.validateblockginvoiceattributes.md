

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGInvoiceAttributes](./gramstax.templateengine.validateblockginvoiceattributes.md)

## TemplateEngine.validateBlockGInvoiceAttributes() method

Validates attributes and item constraints on `<g-invoice>` blocks.

**Signature:**

```typescript
static validateBlockGInvoiceAttributes(template: string): {
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

The raw template source to validate.


</td></tr>
</tbody></table>

**Returns:**

&#123; valid: boolean; errors: Array&lt;&#123; line: number; message: string; &#125;&gt;; &#125;

`{valid, errors}`; `errors` carry 1-based line numbers.

## Remarks

Checks the block-level attributes (`lang`, `title`, `description`, `payload`, `currency`) via `_validateBlockAttributes`, then delegates structural rules (required attrs, `provider_token` rejection, 1 or more `<g-price>` items, static Bot API length limits where no `{{}}` interpolation is present) to [TemplateEngine.\_validateInvoiceItems()](./gramstax.templateengine._validateinvoiceitems.md). `provider_token` is listed in the allowed set only so the dedicated secrets error (not a generic unknown-attribute error) is reported. Returns `valid: false` with per-line errors instead of throwing, so callers can aggregate across blocks.

