

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_processGDivBlocks](./gramstax.templateengine._processgdivblocks.md)

## TemplateEngine.\_processGDivBlocks() method

Block: g-div Normalizes content within `<g-div>` blocks by removing indentation.

**Signature:**

```typescript
static _processGDivBlocks(template: string): string;
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

The template string containing `<g-div>` blocks


</td></tr>
</tbody></table>

**Returns:**

string

The template with `<g-div>` blocks replaced by their de-indented content

## Remarks

This internal method processes `<g-div>` blocks and cleans their inner content by removing leading tabs/spaces per line and trimming surrounding newlines. The `<g-div>` tags themselves are removed from the output.

\*\*Attributes:\*\*  - none

## Example


```typescript
const template = '<g-div>\n    Line 1\n    Line 2\n</g-div>';
const processed = TemplateEngine._processGDivBlocks(template);
// Result: 'Line 1\nLine 2'
```

