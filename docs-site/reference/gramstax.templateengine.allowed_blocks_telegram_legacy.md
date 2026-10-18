---
title: "TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_LEGACY"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [ALLOWED\_BLOCKS\_TELEGRAM\_LEGACY](./gramstax.templateengine.allowed_blocks_telegram_legacy.md)

## TemplateEngine.ALLOWED\_BLOCKS\_TELEGRAM\_LEGACY property

Telegram HTML-mode tags from the pre-Rich spec (`parse_mode="HTML"`).

**Signature:**

```typescript
static ALLOWED_BLOCKS_TELEGRAM_LEGACY: ReadonlySet<string>;
```

## Remarks

The original 9-tag set: `b`, `i`, `u`, `s`, `code`, `pre`, `a`, `blockquote`, `blockquote expandable`. Combined with [TemplateEngine.ALLOWED\_BLOCKS\_TELEGRAM\_RICH](./gramstax.templateengine.allowed_blocks_telegram_rich.md) into [TemplateEngine.ALLOWED\_BLOCKS\_TELEGRAM](./gramstax.templateengine.allowed_blocks_telegram.md), which feeds the validator allowlist (`validateTemplate`) and the passthrough tag extraction (`_extractBlockNames`).

