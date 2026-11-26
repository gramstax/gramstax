---
title: "Ctx.renderWidget()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [renderWidget](./gramstax.ctx.renderwidget.md)

## Ctx.renderWidget() method

Sends, edits, or data-updates a template-driven HTML widget using the page `<g-widget>` block.

Template block: `<g-widget>` (read via `getGWidget`).

**Signature:**

```typescript
renderWidget(params?: IRenderWidgetParams): Promise<Awaited<ReturnType<Ctx[`replyWithWidget`]>> | Awaited<ReturnType<Ctx[`reply`]>> | true | undefined | IBroadcastSendResult | IBroadcastEditResult>;
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

[IRenderWidgetParams](./gramstax.irenderwidgetparams.md)


</td><td>

_(Optional)_ Optional params object (defaults to `{}`): `mode` one of `reply` (default), `edit`, `update-data`; `keyboard` optional keyboard markup (or null to omit) — inline-only on the `edit` route, `editMessageReplyMarkup` rejects a bottom keyboard; `data` optional template interpolation data (or null to omit); `AGBaseId` optional template base ID position for block widget (or null to use default); `options` optional extra `sendWidget` fields, spread last over the template fields (or null to omit); `is_shared` optional first-class override of the template block's `is_shared` on the send routes (reply and broadcast-send; or null to keep the template value); `broadcast` optional fan-out — `{ids, languageCode, ...}` sends to many recipients, `{targets, reviseOptions}` data-updates stored widget messages (non-shared widgets only).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;Awaited&lt;ReturnType&lt;[Ctx](./gramstax.ctx.md)\[\`replyWithWidget\`\]&gt;&gt; \| Awaited&lt;ReturnType&lt;[Ctx](./gramstax.ctx.md)\[\`reply\`\]&gt;&gt; \| true \| undefined \| [IBroadcastSendResult](./gramstax.ibroadcastsendresult.md) \| [IBroadcastEditResult](./gramstax.ibroadcasteditresult.md)&gt;

The sent widget message, `true` for an edit / data-update, `undefined` when the send fell back to the caption text, or the broadcast counts.

## Remarks

Modes are explicit — there is NO `auto` mode: a tap inside the widget (`widget_query`) wants `update-data` while a keyboard button under it (`callbackQuery`) wants `edit`, so no single runtime guess is honest. `mode` defaults to `reply`.

- `reply` (default): sends a new widget via `replyWithWidget` with the template caption and a hardcoded `parse_mode: "HTML"` (never `caption_entities`, like `renderMedia` / `renderPoll`). The chat resolves from `widgetQuery.chat` on a tap update too, so a tap handler can reply with a fresh widget in the same chat. - `edit`: re-applies the template's state, caption, and keyboard to the widget message held by the context — never the HTML, which the Bot API cannot replace (there is no `editMessageWidget`). NOT atomic: up to three API calls (`editMessageWidgetData` / `editSharedWidgetData`, `editMessageCaption`, `editMessageReplyMarkup`), so a failure mid-way leaves part of the message updated and the error is rethrown. Whether the widget is shared is auto-detected from the update (see `_isSharedWidget`) — the template's `is_shared` is ignored here. On a detected shared widget the state edit goes to `editSharedWidgetData` (public data, every message showing the widget) while the caption and keyboard edits still target only the context-held message. Target resolution uses the ctx shortcuts: `chatId` / `msgId` resolve from `widgetQuery.chat` / `widgetQuery.message_id` on a tap update (verified in grammY 1.48.0 `context.js` and `@grammyjs/types` 5.2.0), so the tapped message is the edit target with no manual resolution. (One edge: a widget inside an INLINE message carries neither — the query has `inline_message_id` instead — and the data edit then takes grammY's Inline variant while the caption/keyboard edits throw grammY's "Missing information" error.) - `update-data`: changes only the widget state in exactly one API call (atomic) — `chat_data` via `editMessageWidgetData` for a regular widget, `public_data` via `editSharedWidgetData` for a shared one. Shared-ness is auto-detected from the update (see `_isSharedWidget`); the template's `is_shared` is ignored here. This is the hot path for widget taps and the only mode meaningful for shared widgets. It does NOT answer the widget query: the handler must still call `ctx.answerWidgetQuery` within 15 seconds. Target resolution uses the ctx shortcuts (see the edit route above): the regular-widget target comes from `widgetQuery.chat` / `widgetQuery.message_id`, the shared target from `widgetQuery.widget_id ?? sharedWidgetQuery.widget_id ?? msg.widget.id` (the widget\_id path grammY resolves).

`is_shared` is a send-time declaration only: it is passed to `replyWithWidget` when a new widget is created — the `is_shared` render param (reply and broadcast-send routes) overrides the template block's value, and the `options` bag is still spread last, so `options.is_shared` wins over the param. The broadcast-revise route still reads it from the template (stored targets carry no update to detect from). The `edit` and `update-data` routes ignore it and detect shared-ness from the context instead.

Fail-fast validation (`Ctx.assertWidget`) runs BEFORE any API call on the COMPILED strings — programmer errors always throw, never fall back.

Send failures follow `Ctx.classifySendError`, except the fallback content is the widget caption (sent as text with `parse_mode: "HTML"`) instead of the generic page fallback text — DEFAULT (flip to rethrow, `renderPoll` style, while testing if needed): the caption is designed to stand alone as the widget's replacement on clients without widget support.

## Example 1


```typescript
async handleCallbackQueryData() {
  await this.renderWidget() // send the widget from the <g-widget> block
}
```

## Example 2


```typescript
async handleFreeWidgetQuery() {
  await this.renderWidgetAnswer({AGBaseId: `rate-ack`}) // template-backed answer (underlying call: ctx.answerWidgetQuery)
  await this.renderWidget({mode: "update-data", data: {stars: 4}}) // tap -> new widget state
}
```

