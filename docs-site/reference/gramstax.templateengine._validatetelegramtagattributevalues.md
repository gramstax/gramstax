---
title: "TemplateEngine._validateTelegramTagAttributeValues()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_validateTelegramTagAttributeValues](./gramstax.templateengine._validatetelegramtagattributevalues.md)

## TemplateEngine.\_validateTelegramTagAttributeValues() method

Scans a template for Telegram Rich HTML tags whose attribute values fail format checks.

**Signature:**

```typescript
static _validateTelegramTagAttributeValues(template: string): Array<{
        line: number;
        message: string;
    }>;
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

The raw template string to scan


</td></tr>
</tbody></table>

**Returns:**

Array&lt;\{ line: number; message: string; }&gt;

Array of `{line, message}` errors (empty if all values are valid)

## Remarks

For every tag in [TemplateEngine.\_TELEGRAM\_ATTR\_VALUE\_VALIDATORS](./gramstax.templateengine._telegram_attr_value_validators.md), each present attribute is extracted and run through its validator. Boolean attributes (without `=value`) are skipped. Only attributes with value declarations are checked. Missing required attributes are NOT reported here — that is [TemplateEngine.\_validateTelegramTagAttributes()](./gramstax.templateengine._validatetelegramtagattributes.md)'s job.

## Example


```typescript
const errors = TemplateEngine._validateTelegramTagAttributeValues(`
  <tg-time unix="abc" format="wDT">x</tg-time>
  <a href="javascript:alert(1)">x</a>
`);
// => [
//   {line: 2, message: '<tg-time> unix must be a positive integer (got "abc")'},
//   {line: 3, message: '<a> href must use http(s)://, mailto:, tel:, tg://, or # scheme (got "javascript:alert(1)")'}
// ]
```

