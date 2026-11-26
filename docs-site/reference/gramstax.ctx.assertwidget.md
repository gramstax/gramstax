---
title: "Ctx.assertWidget()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [assertWidget](./gramstax.ctx.assertwidget.md)

## Ctx.assertWidget() method

Fail-fast checks for a compiled `<g-widget>` block against Bot API limits.

**Signature:**

```typescript
static assertWidget(widget: IWidgetBlock): void;
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

widget


</td><td>

[IWidgetBlock](./gramstax.iwidgetblock.md)


</td><td>

Compiled widget block from `getGWidget`.


</td></tr>
</tbody></table>

**Returns:**

void

## Remarks

Measures the COMPILED strings (post-interpolation): HTML at most 32768 UTF-8 bytes raw and at most 4000 bytes after zlib level-9 compression (the safe target — see [Ctx.WIDGET\_HTML\_COMPRESSED\_SAFE\_LIMIT](./gramstax.ctx.widget_html_compressed_safe_limit.md); the API hard limit is 4096), caption required and 1–1024 characters after entity parsing (HTML tags stripped), `chat_data` / `public_data` at most 1024 UTF-8 bytes each, `width` an integer 200–600 and `height` an integer 50–600 when present. Programmer error — always throws, never falls back or notifies.

