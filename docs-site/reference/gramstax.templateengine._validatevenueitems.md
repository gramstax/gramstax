---
title: "TemplateEngine._validateVenueItems()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_validateVenueItems](./gramstax.templateengine._validatevenueitems.md)

## TemplateEngine.\_validateVenueItems() method

Validates `<g-venue>` required attributes and static coordinates.

**Signature:**

```typescript
static _validateVenueItems(template: string): Array<{
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

The raw template source to inspect.


</td></tr>
</tbody></table>

**Returns:**

Array&lt;&#123; line: number; message: string; &#125;&gt;

Validation errors (empty when valid).

## Remarks

Enforces the Telegram `sendVenue` constraints: `title`, `address`, `latitude`, and `longitude` must be present and non-empty. Static coordinates (no `{{}}` / `{~ ~}` interpolation) must be finite numbers within latitude -90–90 and longitude -180–180; dynamic coordinates are checked at runtime on the compiled strings. Called by [TemplateEngine.validateBlockGVenueAttributes()](./gramstax.templateengine.validateblockgvenueattributes.md); errors carry 1-based line numbers.

