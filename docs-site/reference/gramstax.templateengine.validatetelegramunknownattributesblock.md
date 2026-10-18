---
title: "TemplateEngine.validateTelegramUnknownAttributesBlock()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateTelegramUnknownAttributesBlock](./gramstax.templateengine.validatetelegramunknownattributesblock.md)

## TemplateEngine.validateTelegramUnknownAttributesBlock() method

Validates that Telegram Rich HTML tags carry only their allowed attributes.

**Signature:**

```typescript
static validateTelegramUnknownAttributesBlock(template: string): {
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

\{ valid: boolean; errors: Array&lt;\{ line: number; message: string; }&gt;; }

An object with a `valid` boolean and an `errors` array

## Remarks

Runs after [TemplateEngine.validateTelegramAttributeValuesBlock()](./gramstax.templateengine.validatetelegramattributevaluesblock.md) as a dedicated unknown-attribute pass. Rejects attribute names outside the per-tag allowlist [TemplateEngine.\_TELEGRAM\_ALLOWED\_ATTRS](./gramstax.templateengine._telegram_allowed_attrs.md) — including `{{placeholder}}` used as a name, and ANY attribute on no-attribute tags. `<g-*>` PAGE blocks are unaffected (validated by `validateBlockG*Attributes`).

## Example


```typescript
const result = TemplateEngine.validateTelegramUnknownAttributesBlock(`<table ngasal="x"></table>`);
// Result: { valid: false, errors: [{ line: 1, message: '<table> has unknown attribute(s): ngasal (allowed: bordered, striped)' }] }
```

