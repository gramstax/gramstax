

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGMediaGroupAttributes](./gramstax.templateengine.validateblockgmediagroupattributes.md)

## TemplateEngine.validateBlockGMediaGroupAttributes() method

Validates attributes and item constraints on `<g-media-group>` blocks.

**Signature:**

```typescript
static validateBlockGMediaGroupAttributes(template: string): {
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

Step 12 of the `validateTemplate` pipeline. Checks the block-level `lang` attribute via `_validateBlockAttributes`, then delegates item rules (supported `type`, required `src`, 1–10 items, no `audio`/ `document` mixing) to [TemplateEngine.\_validateMediaGroupItems()](./gramstax.templateengine._validatemediagroupitems.md). Returns `valid: false` with per-line errors instead of throwing, so callers can aggregate across blocks.

