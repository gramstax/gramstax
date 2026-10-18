

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateTelegramAttributeValuesBlock](./gramstax.templateengine.validatetelegramattributevaluesblock.md)

## TemplateEngine.validateTelegramAttributeValuesBlock() method

Validates that Telegram Rich HTML tag attribute values match their expected formats.

**Signature:**

```typescript
static validateTelegramAttributeValuesBlock(template: string): {
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

Runs after [TemplateEngine.validateTelegramAttributesBlock()](./gramstax.templateengine.validatetelegramattributesblock.md) (which checks presence) to catch format-level issues. Validates: - `<tg-time unix>` must be a positive integer; `<tg-time format>` must be non-empty - `<tg-map lat>` ∈ \[-90, 90\], `<tg-map long>` ∈ \[-180, 180\], `<tg-map zoom>` ∈ \[0, 24\] - `<tg-emoji emoji-id>` must be a numeric string - `<a href>` must use http(s)://, mailto:, tel:, tg://, or \# scheme - `<input type>` must be a known HTML input type

Tags without value validators (e.g. `<b>`, `<p>`, `<table>`) are skipped. See [TemplateEngine.\_TELEGRAM\_ATTR\_VALUE\_VALIDATORS](./gramstax.templateengine._telegram_attr_value_validators.md) for the full spec.

## Example


```typescript
const result = TemplateEngine.validateTelegramAttributeValuesBlock(`
  <g-base>
    <g-message><tg-time unix="1647531900" format="wDT">22:45</tg-time></g-message>
  </g-base>
`);
// Result: { valid: true, errors: [] }

const bad = TemplateEngine.validateTelegramAttributeValuesBlock(`
  <g-base>
    <g-message><tg-time unix="abc" format="wDT">x</tg-time></g-message>
  </g-base>
`);
// Result: { valid: false, errors: [{ line: 3, message: '<tg-time> unix must be a positive integer (got "abc")' }] }
```

