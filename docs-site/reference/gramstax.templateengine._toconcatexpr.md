---
title: "TemplateEngine._toConcatExpr()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_toConcatExpr](./gramstax.templateengine._toconcatexpr.md)

## TemplateEngine.\_toConcatExpr() method

Converts processed template output into a concatenation expression.

**Signature:**

```typescript
static _toConcatExpr(processed: string): string;
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

processed


</td><td>

string


</td><td>

Template output after block/scope processing.


</td></tr>
</tbody></table>

**Returns:**

string

A JS expression evaluating to the rendered string.

## Remarks

Splits `processed` on balanced `${...}` spans (quote-aware, brace-nesting-aware): spans passing [TemplateEngine.\_isGeneratedCode()](./gramstax.templateengine._isgeneratedcode.md) are emitted as parenthesized code, everything else — including attacker-controlled `${...}`-lookalikes — is emitted as `JSON.stringify` string literals joined with `+`. Static segments can therefore never break out into code; this is the core guarantee behind `_compileToFunction`. An unterminated `${` is treated as literal text.

