---
title: "TemplateEngine._processGImportBlocks()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_processGImportBlocks](./gramstax.templateengine._processgimportblocks.md)

## TemplateEngine.\_processGImportBlocks() method

Parses `<g-import>` directives from a template and extracts import metadata.

**Signature:**

```typescript
static _processGImportBlocks(template: string): {
        processed: string;
        imports: {
            src: string;
            blocks?: string | string[];
            base: string;
            lang?: string;
            section: `all` | `value`;
            indent: string;
        }[];
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

The template string containing `<g-import>` directives


</td></tr>
</tbody></table>

**Returns:**

&#123; processed: string; imports: &#123; src: string; blocks?: string \| string\[\]; base: string; lang?: string; section: \`all\` \| \`value\`; indent: string; &#125;\[\]; &#125;

An object containing the processed template with placeholders and an array of import metadata

## Remarks

This internal method identifies all `<g-import>` tags in a template and replaces them with placeholders while collecting their metadata (src, blocks, base, lang, section, indent). The placeholders are later resolved by `processGImportBlocks`.

\*\*Attributes:\*\*  - `src` (required): Import source identifier (e.g., template/page key). If missing, the tag is removed (replaced with an empty string).  - `block` (optional): Block selector. Supported forms:  - `"all"`: import all supported blocks  - `"block1"`: import a single block  - `"block1,block2"` / `"block1, block2"`: import multiple blocks (comma-separated)  - `base` (optional): Base id selector for the imported template. Defaults to `"default"`.  - `lang` (optional): Language selector for the imported content (passed through as metadata).  - `section` (optional): Import section selector. Supported values:  - `"all"` (default): include block  - `"value"`: only value

## Example


```typescript
const template = '<g-import src="other-page" block="message" />';
const { processed, imports } = TemplateEngine._processGImportBlocks(template);
// processed: '__IMPORT_0__'
// imports: [{ src: 'other-page', blocks: 'message', base: 'default', ... }]
```

