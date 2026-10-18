---
title: "TemplateEngine.MAX_MEDIA_GROUP_ITEMS"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [MAX\_MEDIA\_GROUP\_ITEMS](./gramstax.templateengine.max_media_group_items.md)

## TemplateEngine.MAX\_MEDIA\_GROUP\_ITEMS property

Maximum items in a single Telegram media group.

**Signature:**

```typescript
static MAX_MEDIA_GROUP_ITEMS: number;
```

## Remarks

Applies to both authoring paths: pipe-delimited `src` (`<g-media type="photo" src="a|b|c">`) and `<g-media-group>` blocks. Excess items are truncated at compile time (`_splitMediaSources`, `_processGMediaGroupBlocks`) and rejected at validation time (`_validateMediaGroupItems`). Matches the Telegram Bot API `sendMediaGroup` limit of 10 items.

