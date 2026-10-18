---
title: "TemplateEngine._processGDescriptionBlocks()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_processGDescriptionBlocks](./gramstax.templateengine._processgdescriptionblocks.md)

## TemplateEngine.\_processGDescriptionBlocks() method

Block: g-description Extracts and parses `<g-description>` blocks from a template string.

This internal method identifies all `<g-description>` blocks and extracts their content organized by language and scope. Blocks without a `lang` attribute are stored under `"default"` language, and blocks without a `scope` attribute are stored under `"default"` scope.

\*\*Attributes:\*\*  - `lang` (optional): Language key for the output map. Defaults to `"default"`.  - `scope` (optional): Scope key for the nested output map. Defaults to `"default"`.

**Signature:**

```typescript
static _processGDescriptionBlocks(template: string): {
        [lang: string]: {
            [scope: string]: string;
        };
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

The template string containing `<g-description>` blocks


</td></tr>
</tbody></table>

**Returns:**

&#123; \[lang: string\]: &#123; \[scope: string\]: string; &#125;; &#125;

A nested object mapping language keys to scopes to their cleaned content

## Example


```typescript
const template = `
  <g-description>Start the bot</g-description>
  <g-description lang="id">Mulai bot</g-description>
  <g-description scope="chat_administrators">Admin command</g-description>
`;
const descriptions = TemplateEngine._processGDescriptionBlocks(template);
// Result: {
//   default: { default: 'Start the bot', chat_administrators: 'Admin command' },
//   id: { default: 'Mulai bot' }
// }
```

