

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [assertPaidMedia](./gramstax.ctx.assertpaidmedia.md)

## Ctx.assertPaidMedia() method

Fail-fast validation for a compiled `<g-paid-media>` paywall.

**Signature:**

```typescript
static assertPaidMedia(paidMedia: IPaidMediaBlock): void;
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

paidMedia


</td><td>

[IPaidMediaBlock](./gramstax.ipaidmediablock.md)


</td><td>

Compiled paid-media block from `getGPaidMedia`.


</td></tr>
</tbody></table>

**Returns:**

void

## Remarks

Runs on the COMPILED block (after `{{}}` interpolation) BEFORE any API call: `stars` must be an integer within `PAID_MEDIA_STARS_MIN`–`PAID_MEDIA_STARS_MAX`; the block must hold `PAID_MEDIA_ITEMS_MIN`–`PAID_MEDIA_ITEMS_MAX` items, each typed `photo` or `video` with a non-empty `src` and a caption of at most `MEDIA_CAPTION_LIMIT` chars. Programmer error — always throws, never falls back or notifies.

