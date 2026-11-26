---
title: "TemplateEngine.MAX_WIDGET_HTML_RAW_BYTES"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [MAX\_WIDGET\_HTML\_RAW\_BYTES](./gramstax.templateengine.max_widget_html_raw_bytes.md)

## TemplateEngine.MAX\_WIDGET\_HTML\_RAW\_BYTES property

Maximum raw `<g-widget>` HTML size in UTF-8 bytes.

**Signature:**

```typescript
static MAX_WIDGET_HTML_RAW_BYTES: number;
```

## Remarks

Matches the Bot API `sendWidget` `html` limit of 32768 bytes (source: `https://core.telegram.org/bots/api#sendwidget`). Measured with `Buffer.byteLength` — character `.length` is wrong for UTF-8. Enforced at validation time and re-checked at runtime by `Ctx.assertWidget`.

