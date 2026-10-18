---
title: "TemplateEngine._processGBaseBlocks()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_processGBaseBlocks](./gramstax.templateengine._processgbaseblocks.md)

## TemplateEngine.\_processGBaseBlocks() method

Block: g-base Extracts and parses `<g-base>` blocks from a template string.

**Signature:**

```typescript
static _processGBaseBlocks(template: string): {
        [AGBaseId: string]: string;
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

The raw template string containing `<g-base>` blocks


</td></tr>
</tbody></table>

**Returns:**

&#123; \[AGBaseId: string\]: string; &#125;

An object mapping base IDs to their cleaned inner content

## Remarks

This internal method identifies all `<g-base>` blocks in the template and extracts their content, organizing them by their `id` attribute. Blocks without an `id` are stored under the key `"default"`. Leading whitespace and surrounding newlines are trimmed from the inner content.

\*\*Attributes:\*\*  - `id` (optional): Identifier for the base block. If not specified,  defaults to `"default"`. Used to reference specific base blocks when compiling  templates or extracting content.

## Example


```typescript
const template = `
  <g-base id="main">
    <g-message>Hello World</g-message>
  </g-base>
  <g-base id="error">
    <g-message>Error occurred</g-message>
  </g-base>
  <g-base>
    <g-message>Default block</g-message>
  </g-base>
`;
const bases = TemplateEngine._processGBaseBlocks(template);
// Result: {
//   main: '<g-message>Hello World</g-message>',
//   error: '<g-message>Error occurred</g-message>',
//   default: '<g-message>Default block</g-message>'
// }
```

