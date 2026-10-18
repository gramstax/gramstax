---
title: "TemplateEngine.compileBlockGMedia()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [compileBlockGMedia](./gramstax.templateengine.compileblockgmedia.md)

## TemplateEngine.compileBlockGMedia() method

Compiles media blocks from a template into executable functions.

**Signature:**

```typescript
static compileBlockGMedia(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>): {
        [AGBaseId: string]: {
            [ALang: string]: (data?: ITemplateData) => IMediaBlock;
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

Raw template string containing `<g-base>` and `<g-media>` blocks


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

&#123; \[AGBaseId: string\]: &#123; \[ALang: string\]: (data?: ITemplateData) =&gt; [IMediaBlock](./gramstax.imediablock.md); &#125;; &#125;

Compiled media functions organized by base ID and language

## Remarks

This method parses `<g-media>` blocks from the template and compiles them into functions that generate `ITMediaBlock` objects. The result is organized by base ID and language. Pre-parsed base blocks can be provided for efficiency.

## Example


```typescript
const template = `
  <g-base>
    <g-media type="photo" src="{{image}}">{{caption}}</g-media>
  </g-base>
`;
const media = TemplateEngine.compileBlockGMedia(template);
const result = media.default?.default?.({ image: 'photo.jpg', caption: 'Hello' });
// Result: { type: 'photo', src: 'photo.jpg', caption: 'Hello' }
```

