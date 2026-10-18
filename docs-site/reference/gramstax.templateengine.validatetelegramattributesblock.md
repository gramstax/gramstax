---
title: "TemplateEngine.validateTelegramAttributesBlock()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateTelegramAttributesBlock](./gramstax.templateengine.validatetelegramattributesblock.md)

## TemplateEngine.validateTelegramAttributesBlock() method

Validates that Telegram Rich HTML tags in the template carry their required attributes.

**Signature:**

```typescript
static validateTelegramAttributesBlock(template: string): {
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

Telegram tags with required attributes (per the Rich HTML spec) are checked: `<a>` (href or name), `<img/>`, `<video>`, `<audio>` (src), `<tg-emoji>` (emoji-id), `<tg-time>` (unix, format), `<tg-map/>` (lat, long, zoom), `<tg-reference>` (name), `<input/>` (type). For `<a>`, at least one of `href` (link) or `name` (anchor) must be present.

Tags without required attributes (e.g. `<b>`, `<table>`, `<p>`) are not checked. See [TemplateEngine.\_TELEGRAM\_REQUIRED\_ATTRS](./gramstax.templateengine._telegram_required_attrs.md) for the full spec.

## Example


```typescript
const result = TemplateEngine.validateTelegramAttributesBlock(`
  <g-base>
    <g-message><a href="https://t.me/">link</a></g-message>
  </g-base>
`);
// Result: { valid: true, errors: [] }

const bad = TemplateEngine.validateTelegramAttributesBlock(`
  <g-base>
    <g-message><a>broken</a></g-message>
  </g-base>
`);
// Result: { valid: false, errors: [{ line: 3, message: '<a> must have one of: href | name' }] }
```

