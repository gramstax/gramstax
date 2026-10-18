

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_isConditionalExpression](./gramstax.templateengine._isconditionalexpression.md)

## TemplateEngine.\_isConditionalExpression() method

Reports whether a `<g-ifelse>` body actually branches.

**Signature:**

```typescript
static _isConditionalExpression(tokens: Array<{
        type: string;
        value: string;
    }>): boolean;
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

tokens


</td><td>

Array&lt;&#123; type: string; value: string; &#125;&gt;


</td><td>

Output of [TemplateEngine.\_tokenizeExpression()](./gramstax.templateengine._tokenizeexpression.md)


</td></tr>
</tbody></table>

**Returns:**

boolean

True when the body contains `?:`, `&&`, `||`, or `??`

## Remarks

`<g-ifelse>` exists for conditionals only, so a body with no ternary and no short-circuit operator is rejected rather than silently becoming an `{~~}` clone.

