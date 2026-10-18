---
title: "TemplateEngine.compileBlockGGift()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [compileBlockGGift](./gramstax.templateengine.compileblockggift.md)

## TemplateEngine.compileBlockGGift() method

Compiles gift blocks from a template into executable functions.

**Signature:**

```typescript
static compileBlockGGift(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>): {
        [AGBaseId: string]: {
            [ALang: string]: (data?: ITemplateData) => string;
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

Raw template string containing `<g-base>` and `<g-gift>` blocks


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

&#123; \[AGBaseId: string\]: &#123; \[ALang: string\]: (data?: ITemplateData) =&gt; string; &#125;; &#125;

Compiled gift functions organized by base ID and language

## Remarks

This method parses `<g-gift>` blocks from the template and compiles them into functions that generate rendered card text. Same organization and pipeline as `compileBlockGCallbackAnswer`. HTML markup is preserved — gifts render with `text_parse_mode: HTML`.

## Example


```typescript
const compiled = TemplateEngine.compileBlockGGift(`<g-base><g-gift>Hadiah <b>{{item}}</b>!</g-gift></g-base>`);
const text = compiled.default?.default?.({item: `kopi`});
// Result: 'Hadiah <b>kopi</b>!'
```

