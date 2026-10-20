---
title: "TemplateEngine.validateBlockGWebAppAnswerAttributes()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGWebAppAnswerAttributes](./gramstax.templateengine.validateblockgwebappanswerattributes.md)

## TemplateEngine.validateBlockGWebAppAnswerAttributes() method

Validates attributes on `<g-web-app-answer>` blocks.

**Signature:**

```typescript
static validateBlockGWebAppAnswerAttributes(template: string): {
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

Allowed attributes are `lang` only. The body is a validation marker for `renderWebAppAnswer`, so HTML markup is rejected.

## Example


```typescript
const result = TemplateEngine.validateBlockGWebAppAnswerAttributes(`<g-base><g-web-app-answer>Note</g-web-app-answer></g-base>`);
// Result: { valid: true, errors: [] }
```

