---
title: "Ctx.renderWidgetAnswer()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [renderWidgetAnswer](./gramstax.ctx.renderwidgetanswer.md)

## Ctx.renderWidgetAnswer() method

Answers the active widget query with template data.

Template block: `<g-widget-answer>` (read via `getGWidgetAnswer`).

**Signature:**

```typescript
renderWidgetAnswer(params?: IRenderWidgetAnswerParams): Promise<true>;
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

params


</td><td>

[IRenderWidgetAnswerParams](./gramstax.irenderwidgetanswerparams.md)


</td><td>

_(Optional)_ Answer params: `data` optional template interpolation data (or null to omit); `AGBaseId` optional template base ID position for the answer data (or null to use default).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;true&gt;

True on success.

## Remarks

Template-backed counterpart to answering widget taps: the `<g-widget-answer>` block supplies the answer data (multilang via `data`). There is no message to send, so this takes no keyboard and never falls back to a reply.

The answer is received only by the widget that sent the query and does NOT change the widget's data — that is `renderWidget` mode `update-data`. One method covers both `widget_query` and `shared_widget_query`: the ctx shortcut resolves the query id from either update. The answer must be sent within 15 seconds of the query.

Observe-only send-error coverage (mirrors `renderCallbackAnswer`): failures are classified via `Ctx.classifySendError`, reported to `notifySendError`, and logged (`retryable` → `log.error`, `fallback-text` → `log.warn`). After notify+log the original error is ALWAYS rethrown untouched.

Answer data is limited by Telegram to 1024 bytes — keep the block short (the limit is bytes, not characters; multibyte text counts more).

## Example


```typescript
async handleFreeWidgetQuery() {
  await this.renderWidgetAnswer({AGBaseId: `rate-ack`})
  await this.renderWidget({mode: `update-data`, data: {stars: 4}}) // tap -> new widget state
}
```

