---
title: "TemplateEngine.validateBlockGDiceAttributes()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGDiceAttributes](./gramstax.templateengine.validateblockgdiceattributes.md)

## TemplateEngine.validateBlockGDiceAttributes() method

Validates attributes and the static emoji rule on `<g-dice>` blocks.

**Signature:**

```typescript
static validateBlockGDiceAttributes(template: string): {
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

Checks the block-level attributes (`lang`, `emoji`) via `_validateBlockAttributes`, then delegates the static emoji membership rule to [TemplateEngine.\_validateDiceItems()](./gramstax.templateengine._validatediceitems.md). `emoji` is optional (defaults to `🎲`); static values must be one of the six Bot API dice emoji, while `{{}}` / `{~ ~}` values skip the static check — dynamic emoji are checked at runtime on the compiled strings. Returns `valid: false` with per-line errors instead of throwing, so callers can aggregate across blocks.

