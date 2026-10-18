---
title: "TemplateEngine.validateScopes()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [validateScopes](./gramstax.templateengine.validatescopes.md)

## TemplateEngine.validateScopes() method

Validates that all interpolation scope syntaxes in a template are recognized.

**Signature:**

```typescript
static validateScopes(template: string): {
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

An object with a `valid` boolean and an `errors` array containing line numbers and descriptive messages for each unsupported scope found

## Remarks

Every interpolation scope delimited by `{X...X}` (where X is a non-word character) must match a known scope name from [TemplateEngine.ALLOWED\_SCOPE](./gramstax.templateengine.allowed_scope.md).

For example, `{{variable}}` uses scope `{{}}` and `{~ expr ~}` uses `{~~}`. Any other delimiter like `{# comment #}` would be reported as unsupported.

## Example


```typescript
const result = TemplateEngine.validateScopes(`{# comment #}`);
// Result: { valid: false, errors: [{ line: 1, message: 'Unsupported template scope: {# #}' }] }
```

