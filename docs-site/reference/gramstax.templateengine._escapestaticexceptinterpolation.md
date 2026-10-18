---
title: "TemplateEngine._escapeStaticExceptInterpolation()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_escapeStaticExceptInterpolation](./gramstax.templateengine._escapestaticexceptinterpolation.md)

## TemplateEngine.\_escapeStaticExceptInterpolation() method

Escapes static template text while preserving template syntax spans.

**Signature:**

```typescript
static _escapeStaticExceptInterpolation(content: string): string;
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

content


</td><td>

string


</td><td>

Raw static block content to escape.


</td></tr>
</tbody></table>

**Returns:**

string

The content with non-syntax characters escaped.

## Remarks

Walks `content` char-by-char: `{{{...}}}`, `{{...}}`, and `{~...~}` spans pass through untouched (they are converted to generated code later). A balanced `${...}` span is preserved live only when its inner code passes [TemplateEngine.\_isGeneratedCode()](./gramstax.templateengine._isgeneratedcode.md) — i.e. it was produced by an inner block processor (nested `<g-map>` bodies carry `${(() => ...)}` / `${__esc(...)}` spans through outer escaping). Any other `${` sequence (untrusted/static text, unterminated spans) is neutralized via [TemplateEngine.\_escape()](./gramstax.templateengine._escape.md), consistent with top-level static text. Every other character goes through [TemplateEngine.\_escape()](./gramstax.templateengine._escape.md), neutralizing breakout payloads (backticks, backslashes) in untrusted static text. Used by `_processGSwitchBlocks` and `_processGMapBlocks` for case/default and loop bodies.

