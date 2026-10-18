---
title: "TemplateEngine._processGSpaceBlocks()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_processGSpaceBlocks](./gramstax.templateengine._processgspaceblocks.md)

## TemplateEngine.\_processGSpaceBlocks() method

Block: g-space Removes lines containing self-closing `<g-space />` tags.

**Signature:**

```typescript
static _processGSpaceBlocks(template: string): string;
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

The template string containing `<g-space />` tags


</td></tr>
</tbody></table>

**Returns:**

string

The template with `<g-space />` lines removed

## Remarks

This internal method identifies lines that contain only a `<g-space />` tag (with optional surrounding whitespace) and removes the entire line. This is useful for controlling whitespace in templates.

\*\*Attributes:\*\* - none

## Example


```typescript
const template = 'Line 1\n<g-space />\nLine 2';
const processed = TemplateEngine._processGSpaceBlocks(template);
// Result: 'Line 1\n\nLine 2'
```

