

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [compileBlockGMessage](./gramstax.templateengine.compileblockgmessage.md)

## TemplateEngine.compileBlockGMessage() method

Compiles message blocks from a template into executable functions.

**Signature:**

```typescript
static compileBlockGMessage(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>): {
        [AGBaseId: string]: {
            [ALang: string]: (data?: ITemplateData) => {
                text: string;
                rich: boolean;
            };
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

Raw template string containing `<g-base>` and `<g-message>` blocks


</td></tr>
<tr><td>

baseBlocks


</td><td>

ReturnType&lt;typeof TemplateEngine.\_processGBaseBlocks&gt;


</td><td>

_(Optional)_ Optional pre-parsed base blocks for reuse


</td></tr>
</tbody></table>

**Returns:**

&#123; \[AGBaseId: string\]: &#123; \[ALang: string\]: (data?: ITemplateData) =&gt; &#123; text: string; rich: boolean; &#125;; &#125;; &#125;

Compiled message functions organized by base ID and language

## Remarks

This method parses `<g-message>` blocks from the template and compiles them into functions that generate rendered message strings. The result is organized by base ID and language. Pre-parsed base blocks can be provided for efficiency.

Processing pipeline (in order, per message): 1. `_processGScriptBlocks` - converts `<g-script>` blocks into executable expressions 2. `_processGMapBlocks` - converts `<g-map>` blocks into array map expressions 3. `_processGSwitchBlocks` - converts `<g-switch>` blocks into switch expressions 4. `_processScopeExec` - evaluates scope execution blocks (implementation-defined) 5. `_processScopeVariables` - resolves scope variables (implementation-defined) 6. `_compileToFunction(processed, false)` - produces the final render function

Output shape: - First level key: `AGBaseId` (from `<g-base id="...">`, or `"default"` if omitted) - Second level key: `ALang` (from `<g-message lang="...">`, or `"default"` if omitted) - Value: `(data?: Record<string, unknown>) => {text: string; rich: boolean}` —  `text` is the rendered message string, `rich` is computed once from the  raw block body (`true` when it contains at least one Telegram Rich HTML tag)

## Example


```typescript
const template = `
  <g-base>
    <g-message>Hello {{name}}!</g-message>
    <g-message lang="id">Halo {{name}}!</g-message>
  </g-base>
`;
const messages = TemplateEngine.compileBlockGMessages(template);
const result = messages.default?.default?.({ name: 'John' });
// Result: {text: 'Hello John!', rich: false}
```

