---
title: "TemplateEngine._matchBareMediaPlaceholder()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_matchBareMediaPlaceholder](./gramstax.templateengine._matchbaremediaplaceholder.md)

## TemplateEngine.\_matchBareMediaPlaceholder() method

Matches a bare `src` placeholder with no pipes or surrounding text.

**Signature:**

```typescript
static _matchBareMediaPlaceholder(rawSrc: string): string | null;
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

rawSrc


</td><td>

string


</td><td>

Raw `src` attribute value from the parsed template.


</td></tr>
</tbody></table>

**Returns:**

string \| null

Dotted path when bare, otherwise `null`.

## Remarks

Only `{{dotted.path}}` (optional surrounding whitespace) qualifies — filtered (`{{x|upper}}`) or embedded (`pre-{{x}}`) values keep the existing string pipeline untouched.

