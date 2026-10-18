---
title: "TemplateEngine.compileBlockGDice()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [compileBlockGDice](./gramstax.templateengine.compileblockgdice.md)

## TemplateEngine.compileBlockGDice() method

Compiles dice blocks from a template into executable functions.

**Signature:**

```typescript
static compileBlockGDice(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>): {
        [AGBaseId: string]: {
            [ALang: string]: (data?: ITemplateData) => IDiceBlock;
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

Raw template string containing `<g-base>` and `<g-dice>` blocks


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

&#123; \[AGBaseId: string\]: &#123; \[ALang: string\]: (data?: ITemplateData) =&gt; [IDiceBlock](./gramstax.idiceblock.md); &#125;; &#125;

Compiled dice functions organized by base ID and language

## Remarks

Parses `<g-dice>` blocks per base and compiles `emoji` through the same pipeline as media captions (script → map → switch → exec → variables), so `{{var|filter}}` works in the emoji field.

## Example


```typescript
const dice = TemplateEngine.compileBlockGDice(`<g-base><g-dice emoji="{{dice}}"/></g-base>`);
const result = dice.default?.default?.({ dice: '🎯' });
// Result: { emoji: '🎯' }
```

