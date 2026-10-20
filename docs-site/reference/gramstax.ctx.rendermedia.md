---
title: "Ctx.renderMedia()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [renderMedia](./gramstax.ctx.rendermedia.md)

## Ctx.renderMedia() method

Sends or edits a media message with dynamic type selection.

Template block: `<g-media>` (read via `getGMedia`).

**Signature:**

```typescript
renderMedia<T extends Exclude<IMediaBlock[`type`], `group`>>(params: IRenderMediaParams<T>): Promise<Message | Message[] | true | undefined | IBroadcastSendResult | IBroadcastEditResult>;
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

[IRenderMediaParams](./gramstax.irendermediaparams.md)&lt;T&gt;


</td><td>

Media params, resolved as one of four routes — see [IRenderMediaParams](./gramstax.irendermediaparams.md) for the exact field set of each route: route 1 single chat (`auto`/`edit`); route 2 single chat forced reply (`mode: 'reply'`); route 3 broadcast send (`broadcast.ids`, kind from the block); route 4 broadcast revise (`broadcast.targets`, `type` required).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;Message \| Message\[\] \| true \| undefined \| [IBroadcastSendResult](./gramstax.ibroadcastsendresult.md) \| [IBroadcastEditResult](./gramstax.ibroadcasteditresult.md)&gt;

The sent or edited message object, or the [IBroadcastSendResult](./gramstax.ibroadcastsendresult.md)/ [IBroadcastEditResult](./gramstax.ibroadcasteditresult.md) counts on the broadcast paths.

## Remarks

One method covers every media send/edit path; the per-kind wrappers (`renderPhoto`, `renderVideo`, and so on) sit on top. `mode` resolves the send-versus-edit decision: `auto` (default) edits when `this.callbackQuery` exists, `reply` always sends, `edit` always edits. This is the base method for all media methods. Use specific methods like [Ctx.renderPhoto()](./gramstax.ctx.renderphoto.md) or [Ctx.renderVideo()](./gramstax.ctx.rendervideo.md) for simpler usage.

Edit-mode semantics for media types that cannot be edited (`voice`, `video_note`, `sticker`, `location`, `contact`) delete the original message and send a new one. Multi-src media groups cannot replace a single message, so supported pipe-delimited media groups also delete the original message and send a new media group.

Fail-fast validation (`Ctx.assertMediaPreconditions`, plus `Ctx.assertLocation`/`Ctx.assertContact` in their branches) runs BEFORE any API call — programmer errors always throw, never fall back. Send failures follow `Ctx.classifySendError`: `retryable` rethrows the original error untouched; `fallback-text` best-effort replies with `resolveFallbackText()` (nested failures ignored) and returns it.

If the edit itself fails, the fallback behavior is controlled by `fallback` (default `delete-reply`: deletes the original message and re-sends the same media — the result looks like an in-place edit). The fallback re-send drops `media`/ `mediaOptions` (edit options do not map to reply options) and logs a `log.warn` when non-empty options are dropped; the re-send itself follows `Ctx.classifySendError` via the reply branch (`retryable` rethrows the original error untouched, `fallback-text` replies with fallback text).

When `broadcast` is present, multi-recipient fan-out replaces the single-chat path (see [IBroadcastSendParams](./gramstax.ibroadcastsendparams.md) / [IBroadcastReviseParams](./gramstax.ibroadcastreviseparams.md)): `broadcast.ids` runs the send loop and `broadcast.targets` runs the revise loop. The send loop reads the media kind from the template `<g-media>` block, so its route type rejects `type` (and `mode`, `fallback`, and the `options*` fields — it never edits); the revise loop requires `type` and rejects `mode`, `options`, and `fallback` (its per-recipient fallback lives in `broadcast.reviseOptions.fallback`).

A bottom (reply) keyboard is rejected before any API call when the route edits in place — `editMessageMedia` accepts inline keyboards only, so the throw names `mode: 'reply'` as the fix. The delete-then-resend kinds are plain sends and keep accepting either keyboard type.

## Example


```typescript
async handleCallbackQueryData() {
  // Automatic reply/edit with content from this.template
  await this.renderMedia({type: "photo"})

  // Force a new reply even from a callback query
  await this.renderMedia({type: "photo", mode: "reply"})

  // Broadcast: fan out to many users (kind read from the <g-media> block)
  await this.renderMedia({broadcast: {ids: [123456, 789012], languageCode: [`en`, `id`]}})

  // Broadcast revise: edit already-sent messages to a new media payload
  await this.renderMedia({type: "photo", data: {price: "99"}, broadcast: {targets: sent}})
}
```

