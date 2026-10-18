

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_processGGiftBlocks](./gramstax.templateengine._processggiftblocks.md)

## TemplateEngine.\_processGGiftBlocks() method

Block: g-gift Extracts `<g-gift>` card-text blocks from a template string.

**Signature:**

```typescript
static _processGGiftBlocks(template: string): {
        [lang: string]: string;
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

The template string containing `<g-gift>` blocks


</td></tr>
</tbody></table>

**Returns:**

&#123; \[lang: string\]: string; &#125;

An object mapping language keys to their raw text content

## Remarks

Children form only; content is cleaned exactly like `<g-message>` and keyed by `lang` (`"default"` when absent; last block wins per lang). Raw content is preserved verbatim (including `{{var|filter}}` spans and HTML markup — gifts render with `text_parse_mode: HTML`) for later compilation. Only attribute rules are enforced by `validateBlockGGiftAttributes`, not here.

## Example


```typescript
const blocks = TemplateEngine._processGGiftBlocks(`<g-gift>Hadiah <b>{{item}}</b>!</g-gift>`);
// Result: { default: 'Hadiah <b>{{item}}</b>!' }
```

