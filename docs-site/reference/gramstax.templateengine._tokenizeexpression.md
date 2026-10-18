

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_tokenizeExpression](./gramstax.templateengine._tokenizeexpression.md)

## TemplateEngine.\_tokenizeExpression() method

Splits a `<g-ifelse>` body into tokens so identifiers can be rewritten without a JavaScript parser dependency.

**Signature:**

```typescript
static _tokenizeExpression(expr: string): Array<{
        type: string;
        value: string;
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

expr


</td><td>

string


</td><td>

The raw `<g-ifelse>` body


</td></tr>
</tbody></table>

**Returns:**

Array&lt;&#123; type: string; value: string; &#125;&gt;

The token list

## Remarks

Token types: `word`, `number`, `string`, `template`, `regex`, `punct`. Whitespace and comments are dropped — spacing is not preserved because the output is re-emitted source.

Two constructs are tokenized as opaque single tokens and therefore never rewritten: regex literals, and template literals (so `${...}` inside them cannot be silently reinterpreted). Template literals that do carry `${` interpolation are rejected by [TemplateEngine.validateBlockGIfElseBody()](./gramstax.templateengine.validateblockgifelsebody.md) rather than mis-rewritten here.

A `/` is read as division when the previous token can end a value (word, number, string, template, `)`, `]`, `++`, `--`) and as a regex literal otherwise. This is the standard heuristic and is ambiguous for `if (x) /re/.test(s)`; it resolves toward division, which is the common case in a template conditional.

