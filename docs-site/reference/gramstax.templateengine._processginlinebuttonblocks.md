

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_processGInlineButtonBlocks](./gramstax.templateengine._processginlinebuttonblocks.md)

## TemplateEngine.\_processGInlineButtonBlocks() method

Block: g-inline-button Extracts `<g-inline-button>` definitions from a template string.

**Signature:**

```typescript
static _processGInlineButtonBlocks(template: string): {
        [lang: string]: IInlineButtonBlock;
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

The template string containing `<g-inline-button>` blocks


</td></tr>
</tbody></table>

**Returns:**

&#123; \[lang: string\]: [IInlineButtonBlock](./gramstax.iinlinebuttonblock.md); &#125;

An object mapping language keys to their button definitions

## Remarks

Attribute form only (`<g-inline-button text="..." start-parameter="..."/>`, both pair and self-closing spellings parse identically); the block carries no children. `text` becomes the inline `button.text` label and `start-parameter` (optional) the deep-link `start_parameter`. Raw attribute strings are preserved verbatim (including `{{var|filter}}` spans) for later compilation. Blocks are keyed by `lang` (`"default"` when absent; last block wins per lang). Structural rules (required `text`, `start_parameter` format) are enforced by `validateBlockGInlineButtonAttributes`, not here.

## Example


```typescript
const blocks = TemplateEngine._processGInlineButtonBlocks(`<g-inline-button text="Lihat {{item}}" start-parameter="detail-1"/>`);
// Result: { default: { text: 'Lihat {{item}}', startParameter: 'detail-1' } }
```

