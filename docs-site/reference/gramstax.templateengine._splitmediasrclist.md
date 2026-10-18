

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_splitMediaSrcList](./gramstax.templateengine._splitmediasrclist.md)

## TemplateEngine.\_splitMediaSrcList() method

Splits a pipe-delimited `src` attribute into media-group items.

**Signature:**

```typescript
static _splitMediaSrcList(src: string): string[];
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

src


</td><td>

string


</td><td>

Raw `src` attribute value from the parsed template.


</td></tr>
</tbody></table>

**Returns:**

string\[\]

Trimmed, non-empty sources, truncated to the album limit.

## Remarks

A `src` without a pipe is NOT a group and yields an empty array, so the caller can treat "no pipe" and "empty list" identically. Entries are trimmed and blanks dropped, then the list is capped at [TemplateEngine.MAX\_MEDIA\_GROUP\_ITEMS](./gramstax.templateengine.max_media_group_items.md) — Telegram rejects larger albums, so the surplus is dropped rather than reported.

