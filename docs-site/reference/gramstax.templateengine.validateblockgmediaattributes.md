---
title: "TemplateEngine.validateBlockGMediaAttributes()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGMediaAttributes](./gramstax.templateengine.validateblockgmediaattributes.md)

## TemplateEngine.validateBlockGMediaAttributes() method

Validates attributes on `<g-media>` blocks.

**Signature:**

```typescript
static validateBlockGMediaAttributes(template: string): {
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

Allowed attributes are `lang`, `type`, `src`, `shared`, `filename`, `latitude`, `longitude`, `live`, `phone`, `first_name`, `last_name`, and `vcard`.

`shared` is a boolean attribute — it can be written as `shared`, `shared="true"`, or `shared="false"`. When `true`, the media item is included in all language variants of the enclosing `<g-media-group>`. Only valid inside `<g-media-group>`.

## Example


```typescript
const result = TemplateEngine.validateBlockGMediaAttributes(`<g-media type="photo" src="img.jpg">Caption</g-media>`);
// Result: { valid: true, errors: [] }
```

