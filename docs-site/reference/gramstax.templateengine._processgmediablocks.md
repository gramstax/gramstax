---
title: "TemplateEngine._processGMediaBlocks()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_processGMediaBlocks](./gramstax.templateengine._processgmediablocks.md)

## TemplateEngine.\_processGMediaBlocks() method

Block: g-media Extracts and parses `<g-media>` blocks from a template string.

**Signature:**

```typescript
static _processGMediaBlocks(template: string): {
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

The template string containing `<g-media>` blocks


</td></tr>
</tbody></table>

**Returns:**

&#123; \[lang: string\]: [IMediaBlock](./gramstax.imediablock.md); &#125;

An object mapping language keys to their corresponding media block configurations

## Remarks

This internal method identifies all `<g-media>` blocks and extracts their attributes and content. It supports various media types including photo, video, audio, document, animation, voice, video\_note, sticker, location, and contact. The inner content becomes the caption for supported types.

\*\*Attributes:\*\* - `lang` (optional): Language key for the output map. Defaults to `"default"`. - `type` (required): Media type discriminator. Expected values: - `photo`, `video`, `audio`, `document`, `animation`, `voice`, `video_note`, - `sticker`, `location`, `contact`. - `src` (optional): File path / URL / file identifier for file-based media. - `latitude` (optional): Location latitude (used when `type="location"`). - `longitude` (optional): Location longitude (used when `type="location"`). - `phone` (optional): Contact phone number (used when `type="contact"`). - `first_name` (optional): Contact first name (used when `type="contact"`). - `last_name` (optional): Contact last name (used when `type="contact"`). - `vcard` (optional): Contact vCard payload (used when `type="contact"`).

Media rules (based on `type`): - If `src` exists, it is assigned as `mediaBlock.src` (for any type). - If `src` contains pipe-delimited values, `mediaBlock.srcList` is populated with up to 10 trimmed entries for Telegram media groups. - If caption exists and `type !== "video_note"` and `type !== "sticker"`, it is assigned as `mediaBlock.caption`. - If `type === "location"`, `latitude` and `longitude` are copied if present, and caption (if present) is also allowed. - If `type === "contact"`, `phone`, `first_name`, `last_name`, and `vcard` are copied if present, and caption (if present) is also allowed.

Note: - If multiple `<g-media>` blocks share the same `lang`, the last one wins (it overwrites the previous entry).

## Example


```typescript
const template = '<g-media type="photo" src="image.jpg|image-2.jpg" lang="en">Hello</g-media>';
const media = TemplateEngine._processGMediaBlocks(template);
// Result: { en: { type: 'photo', src: 'image.jpg|image-2.jpg', srcList: ['image.jpg', 'image-2.jpg'], caption: 'Hello' } }
```

