---
title: "TemplateEngine._escapeData()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_escapeData](./gramstax.templateengine._escapedata.md)

## TemplateEngine.\_escapeData() method

HTML-escapes a runtime value for safe interpolation into rich-HTML messages.

**Signature:**

```typescript
static _escapeData(value: unknown): string;
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

value


</td><td>

unknown


</td><td>

The runtime value to escape.


</td></tr>
</tbody></table>

**Returns:**

string

The escaped string.

## Remarks

Non-string values are stringified; `null`/`undefined` become empty string. Escaped code points: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`. `_processScopeVariables` rewrites every `{{}}` span to call this function before the template is parsed, so an attribute value written as `{{x}}` is escaped too. Only the `{{{}}}` form is raw.

