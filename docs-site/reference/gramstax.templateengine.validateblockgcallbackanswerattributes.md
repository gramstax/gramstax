---
title: "TemplateEngine.validateBlockGCallbackAnswerAttributes()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateBlockGCallbackAnswerAttributes](./gramstax.templateengine.validateblockgcallbackanswerattributes.md)

## TemplateEngine.validateBlockGCallbackAnswerAttributes() method

Validates attributes and content on `<g-callback-answer>` blocks.

**Signature:**

```typescript
static validateBlockGCallbackAnswerAttributes(template: string): {
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

Allowed attributes are `lang` only. Content must be plain text without HTML and at most 200 chars of static text (Bot API toast limits); `{{}}` spans skip the static checks (runtime-enforced).

## Example


```typescript
const result = TemplateEngine.validateBlockGCallbackAnswerAttributes(`<g-base><g-callback-answer>OK</g-callback-answer></g-base>`);
// Result: { valid: true, errors: [] }
```

