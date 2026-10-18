---
title: "TemplateEngine._processGMediaGroupBlocks()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_processGMediaGroupBlocks](./gramstax.templateengine._processgmediagroupblocks.md)

## TemplateEngine.\_processGMediaGroupBlocks() method

Parses `<g-media-group>` blocks into Telegram media group item definitions.

**Signature:**

```typescript
static _processGMediaGroupBlocks(template: string): {
        [lang: string]: IMediaBlock;
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

The template source containing `<g-media-group>` blocks.


</td></tr>
</tbody></table>

**Returns:**

&#123; \[lang: string\]: [IMediaBlock](./gramstax.imediablock.md); &#125;

Map of lang → `{type: "group", mediaGroup, caption?}` definitions.

## Remarks

Groups inner `<g-media>` items (via `_processMediaGroupItems`, truncated to [TemplateEngine.MAX\_MEDIA\_GROUP\_ITEMS](./gramstax.templateengine.max_media_group_items.md)) into lang variants preserving document order: the block-`lang` (default `default`) variant holds un-languaged or `shared` items, plus one variant per item `lang` holding matching or `shared` items. Each variant takes its caption from the first captioned item; a block with no items still yields an empty default variant unless lang items exist. Attribute values accept double-quoted, single-quoted, or bare syntax.

