---
title: "TemplateEngine.MAX_WIDGET_DATA_BYTES"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [MAX\_WIDGET\_DATA\_BYTES](./gramstax.templateengine.max_widget_data_bytes.md)

## TemplateEngine.MAX\_WIDGET\_DATA\_BYTES property

Maximum `<g-widget>` `chat_data` / `public_data` size in UTF-8 bytes.

**Signature:**

```typescript
static MAX_WIDGET_DATA_BYTES: number;
```

## Remarks

Matches the Bot API `sendWidget` data limits of 1024 bytes each (source: `https://core.telegram.org/bots/api#sendwidget`). Measured with `Buffer.byteLength`. Enforced at validation time (static values) and re-checked at runtime by `Ctx.assertWidget` (rendered values).

