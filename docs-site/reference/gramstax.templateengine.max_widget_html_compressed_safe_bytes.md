---
title: "TemplateEngine.MAX_WIDGET_HTML_COMPRESSED_SAFE_BYTES"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [MAX\_WIDGET\_HTML\_COMPRESSED\_SAFE\_BYTES](./gramstax.templateengine.max_widget_html_compressed_safe_bytes.md)

## TemplateEngine.MAX\_WIDGET\_HTML\_COMPRESSED\_SAFE\_BYTES property

Safe compile-time target for `<g-widget>` HTML after zlib level-9 compression.

**Signature:**

```typescript
static MAX_WIDGET_HTML_COMPRESSED_SAFE_BYTES: number;
```

## Remarks

DEFAULT (flip to [TemplateEngine.MAX\_WIDGET\_HTML\_COMPRESSED\_BYTES](./gramstax.templateengine.max_widget_html_compressed_bytes.md) while testing if the stricter target rejects widgets Telegram would accept): Node zlib output can differ from Telegram's server-side compression by tens of bytes, so a widget that compresses to 4050 bytes locally can still fail on the server. The validator errors above this target, not above the 4096-byte hard limit, so a passing template is one that will also pass on Telegram's side.

