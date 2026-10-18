---
title: "TemplateEngine.compileBlockGInlineButton()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [compileBlockGInlineButton](./gramstax.templateengine.compileblockginlinebutton.md)

## TemplateEngine.compileBlockGInlineButton() method

Compiles inline-button blocks from a template into executable functions.

**Signature:**

```typescript
static compileBlockGInlineButton(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>): {
        [AGBaseId: string]: {
            [ALang: string]: (data?: ITemplateData) => IInlineButtonBlock;
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

Raw template string containing `<g-base>` and `<g-inline-button>` blocks


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

&#123; \[AGBaseId: string\]: &#123; \[ALang: string\]: (data?: ITemplateData) =&gt; [IInlineButtonBlock](./gramstax.iinlinebuttonblock.md); &#125;; &#125;

Compiled inline-button functions organized by base ID and language

## Remarks

This method parses `<g-inline-button>` blocks from the template and compiles them into functions that generate button definitions. Both `text` and `start-parameter` run the string pipeline (script → map → switch → scope-exec → scope-variables → function), so either may carry `{{var|filter}}` spans; static `start_parameter` format is enforced by `validateBlockGInlineButtonAttributes`, dynamic values at runtime by the caller. The result is organized by base ID and language.

Output shape: - First level key: `AGBaseId` (from `<g-base id="...">`, or `"default"` if omitted) - Second level key: `ALang` (from `lang="..."`, or `"default"` if omitted) - Value: `(data?: Record<string, unknown>) => ITInlineButtonBlock`

## Example


```typescript
const compiled = TemplateEngine.compileBlockGInlineButton(`<g-base><g-inline-button text="Lihat {{item}}" start-parameter="d-1"/></g-base>`);
const button = compiled.default?.default?.({item: `kopi`});
// Result: { text: 'Lihat kopi', startParameter: 'd-1' }
```

