---
title: "TemplateEngine.MAX_WIDGET_HTML_COMPRESSED_BYTES"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [MAX\_WIDGET\_HTML\_COMPRESSED\_BYTES](./gramstax.templateengine.max_widget_html_compressed_bytes.md)

## TemplateEngine.MAX\_WIDGET\_HTML\_COMPRESSED\_BYTES property

Maximum `<g-widget>` HTML size after zlib level-9 compression.

**Signature:**

```typescript
static MAX_WIDGET_HTML_COMPRESSED_BYTES: number;
```

## Remarks

The Bot API `sendWidget` hard limit is 4096 bytes compressed (source: `https://core.telegram.org/bots/api#sendwidget`). Enforced at validation time and re-checked at runtime by `Ctx.assertWidget`.

