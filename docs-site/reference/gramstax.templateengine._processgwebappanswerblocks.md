---
title: "TemplateEngine._processGWebAppAnswerBlocks()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_processGWebAppAnswerBlocks](./gramstax.templateengine._processgwebappanswerblocks.md)

## TemplateEngine.\_processGWebAppAnswerBlocks() method

Block: g-web-app-answer Extracts `<g-web-app-answer>` marker blocks from a template string.

**Signature:**

```typescript
static _processGWebAppAnswerBlocks(template: string): {
        [lang: string]: string;
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

The template string containing `<g-web-app-answer>` blocks


</td></tr>
</tbody></table>

**Returns:**

&#123; \[lang: string\]: string; &#125;

An object mapping language keys to their raw text content

## Remarks

Children form only; content is cleaned exactly like `<g-message>` and keyed by `lang` (`"default"` when absent; last block wins per lang). Raw content is preserved verbatim (including `{{var|filter}}` spans) for later compilation. The block is a validation marker for `renderWebAppAnswer`, whose result content comes from the caller, not from the template. Plain-text rules are enforced by `validateBlockGWebAppAnswerAttributes`, not here.

## Example


```typescript
const blocks = TemplateEngine._processGWebAppAnswerBlocks(`<g-web-app-answer>Web app note {{kind}}</g-web-app-answer>`);
// Result: { default: 'Web app note {{kind}}' }
```

