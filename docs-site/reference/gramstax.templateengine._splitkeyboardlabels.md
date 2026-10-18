---
title: "TemplateEngine._splitKeyboardLabels()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_splitKeyboardLabels](./gramstax.templateengine._splitkeyboardlabels.md)

## TemplateEngine.\_splitKeyboardLabels() method

Compiles keyboard blocks from a template into executable functions.

**Signature:**

```typescript
static _splitKeyboardLabels(content: string): string[];
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


</td></tr>
</tbody></table>

**Returns:**

string\[\]

Compiled keyboard functions organized by base ID, language, and mode

## Remarks

This method parses `<g-keyboard>` blocks from the template and compiles them into functions that generate button label arrays. The result is organized by base ID and language, with separate `inline` and `bottom` keyboard modes. Comma-separated labels are split into individual button strings.

Processing pipeline (in order, per keyboard label): 1. `_processGScriptBlocks` – converts `<g-script>` blocks into executable expressions 2. `_processGMapBlocks` – converts `<g-map>` blocks into array map expressions 3. `_processGSwitchBlocks` – converts `<g-switch>` blocks into switch expressions 4. `_processScopeExec` – evaluates scope execution blocks (implementation-defined) 5. `_processScopeVariables` – resolves scope variables (implementation-defined) 6. `_compileToFunction(processedLabels, true)` – produces the final render function

Notes: - Keyboard content is split by commas into individual labels. - Escaped commas with double backslash (`\\,`) are preserved as literal commas. - Each label is processed independently through the pipeline.

Output shape: - First level key: `AGBaseId` (from `<g-base id="...">`, or `"default"` if omitted) - Second level key: `ALang` (from `<g-keyboard lang="...">`, or `"default"` if omitted) - Third level key: `mode`: - `inline` (default) - `bottom` - Value: `(data?: Record<string, unknown>) => string[]`

## Example


```typescript
const template = `
  <g-base>
    <g-keyboard>Yes, No, {{action}}</g-keyboard>
    <g-keyboard type="bottom">Menu, Help</g-keyboard>
  </g-base>
`;
const keyboards = TemplateEngine.compileBlockGKeyboards(template);
const inline = keyboards.default?.default?.inline?.({ action: 'Cancel' });
// Result: ['Yes', 'No', 'Cancel']
```

