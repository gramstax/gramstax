---
title: "TemplateEngine.validatePageAttributesBlock()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validatePageAttributesBlock](./gramstax.templateengine.validatepageattributesblock.md)

## TemplateEngine.validatePageAttributesBlock() method

Validates that `<g-*>` PAGE blocks in the template carry their required attributes.

**Signature:**

```typescript
static validatePageAttributesBlock(template: string): {
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

PAGE block attributes are mostly optional, so [TemplateEngine.\_PAGE\_REQUIRED\_ATTRS](./gramstax.templateengine._page_required_attrs.md) is currently empty. This method exists to mirror the Telegram validation pattern (`validateTelegramAttributesBlock`) and is reserved for future use — e.g. context-dependent requirements that may be added as the framework evolves.

## Example


```typescript
const result = TemplateEngine.validatePageAttributesBlock(`<g-base id="main"></g-base>`);
// Result: { valid: true, errors: [] }
```

