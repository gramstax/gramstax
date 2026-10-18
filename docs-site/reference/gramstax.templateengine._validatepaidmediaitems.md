

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_validatePaidMediaItems](./gramstax.templateengine._validatepaidmediaitems.md)

## TemplateEngine.\_validatePaidMediaItems() method

Validates `<g-paid-media>` required attributes and `<g-media>` items.

**Signature:**

```typescript
static _validatePaidMediaItems(template: string): Array<{
        line: number;
        message: string;
    }>;
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

The raw template source to inspect.


</td></tr>
</tbody></table>

**Returns:**

Array&lt;&#123; line: number; message: string; &#125;&gt;

Validation errors (empty when valid).

## Remarks

Enforces the Telegram `sendPaidMedia` constraints: `stars` must be present and a positive integer within 1–`MAX_PAID_MEDIA_STARS` (the Bot API `star_count` range, 1–25000 per `https://core.telegram.org/bots/api#sendpaidmedia`); the block must hold 1–`MAX_PAID_MEDIA_ITEMS` `<g-media>` children, each typed `photo` or `video` with a non-empty `src`. Static checks apply only when the value carries no `{{}}` / `{~ ~}` interpolation — dynamic values are checked at runtime on the compiled block. Called by [TemplateEngine.validateBlockGPaidMediaAttributes()](./gramstax.templateengine.validateblockgpaidmediaattributes.md); errors carry 1-based line numbers.

