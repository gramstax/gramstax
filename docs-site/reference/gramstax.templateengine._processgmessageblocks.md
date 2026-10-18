---
title: "TemplateEngine._processGMessageBlocks()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_processGMessageBlocks](./gramstax.templateengine._processgmessageblocks.md)

## TemplateEngine.\_processGMessageBlocks() method

Block: g-message Extracts and parses `<g-message>` blocks from a template string.

**Signature:**

```typescript
static _processGMessageBlocks(template: string): {
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

The template string containing `<g-message>` blocks


</td></tr>
</tbody></table>

**Returns:**

&#123; \[lang: string\]: string; &#125;

An object mapping language keys to their cleaned message content

## Remarks

This internal method identifies all `<g-message>` blocks and extracts their content organized by language. Blocks without a `lang` attribute are stored under `"default"`. Leading whitespace and surrounding newlines are trimmed.

\*\*Attributes:\*\*  - `lang` (optional): Language key for the output map. Defaults to `"default"`.

## Example


```typescript
const template = `
  <g-message>Hello World</g-message>
  <g-message lang="id">Halo Dunia</g-message>
`;
const messages = TemplateEngine._processGMessageBlocks(template);
// Result: { default: 'Hello World', id: 'Halo Dunia' }
```

