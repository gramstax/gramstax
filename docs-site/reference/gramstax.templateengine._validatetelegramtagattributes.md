---
title: "TemplateEngine._validateTelegramTagAttributes()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_validateTelegramTagAttributes](./gramstax.templateengine._validatetelegramtagattributes.md)

## TemplateEngine.\_validateTelegramTagAttributes() method

Scans a template for Telegram Rich HTML tags that are missing required attributes.

**Signature:**

```typescript
static _validateTelegramTagAttributes(template: string): Array<{
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

Array of `{line, message}` errors (empty if all required attrs are present)

## Remarks

Iterates every opening tag in the template and, for any tag listed in [TemplateEngine.\_TELEGRAM\_REQUIRED\_ATTRS](./gramstax.templateengine._telegram_required_attrs.md), checks that the required attribute set is fully present. Both value attributes (`href="..."`) and boolean attributes (`checked`, `reversed`, `open`) are recognized.

For tags with `oneOf` spec (e.g. `<a>`), at least one of the listed sets must be fully present. Returns one error per offending tag with the 1-based line number.

## Example


```typescript
const errors = TemplateEngine._validateTelegramTagAttributes(`
  <a>link</a>
  <img src="x.png"/>
  <tg-time unix="1" format="wDT">x</tg-time>
`);
// => [{line: 2, message: "<a> must have one of: href | name"}]
```

