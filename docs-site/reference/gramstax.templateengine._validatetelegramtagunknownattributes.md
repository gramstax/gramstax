---
title: "TemplateEngine._validateTelegramTagUnknownAttributes()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_validateTelegramTagUnknownAttributes](./gramstax.templateengine._validatetelegramtagunknownattributes.md)

## TemplateEngine.\_validateTelegramTagUnknownAttributes() method

Scans a template for Telegram Rich HTML tags carrying attribute names outside their per-tag allowlist.

**Signature:**

```typescript
static _validateTelegramTagUnknownAttributes(template: string): Array<{
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

Array of `{line, message}` errors (empty if all attributes are known)

## Remarks

For every Telegram rich tag (see [TemplateEngine.\_TELEGRAM\_ALLOWED\_ATTRS](./gramstax.templateengine._telegram_allowed_attrs.md)), each attribute name present is checked against the allowlist. Unknown attribute names — including `{{placeholder}}` used as a NAME — produce errors. Tags with an empty allowlist reject every attribute. Attribute VALUES (including `{{placeholder}}` values) are NOT checked here — that is [TemplateEngine.\_validateTelegramTagAttributeValues()](./gramstax.templateengine._validatetelegramtagattributevalues.md)'s job.

## Example


```typescript
const errors = TemplateEngine._validateTelegramTagUnknownAttributes(`
  <table ngasal="x"><tr><td>a</td></tr></table>
  <b class="y">bold</b>
`);
// => [
//   {line: 2, message: '<table> has unknown attribute(s): ngasal (allowed: bordered, striped)'},
//   {line: 3, message: '<b> does not support any attributes'}
// ]
```

