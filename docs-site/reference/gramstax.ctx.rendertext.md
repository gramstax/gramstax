---
title: "Ctx.renderText()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [renderText](./gramstax.ctx.rendertext.md)

## Ctx.renderText() method

Sends or edits a text message using the page template.

Template block: `<g-message>` (read via `getGMessage`).

**Signature:**

```typescript
renderText(params?: IRenderTextParams): Promise<Message | Message[] | true | IBroadcastSendResult>;
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

[IRenderTextParams](./gramstax.irendertextparams.md)


</td><td>

_(Optional)_ Optional render params (defaults to `{}`), resolved as one of four routes — see [IRenderTextParams](./gramstax.irendertextparams.md) for the exact field set of each route: route 1 single message (`auto`/`edit`); route 2 forced reply (`mode: 'reply'`); route 3 chunked reply (`chunkSize`, reply-only); route 4 broadcast send (`broadcast`, send-only).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;Message \| Message\[\] \| true \| [IBroadcastSendResult](./gramstax.ibroadcastsendresult.md)&gt;

The sent or edited message object, the array of sent message objects when `chunkSize` selects the chunked reply path, or the [IBroadcastSendResult](./gramstax.ibroadcastsendresult.md) counts when `broadcast` is present.

## Remarks

One method covers every text send/edit path. `mode` resolves the send-versus-edit decision: `auto` (default) edits when `this.callbackQuery` exists, `reply` always sends, `edit` always edits. Broadcast fan-out is a route option (`broadcast`), not a separate method.

Rich content is chosen at COMPILE time: when the `<g-message>` block contains Telegram Rich HTML tags, the message is sent or edited through `replyWithRichMessage`/`editMessageText` with an `InputRichMessage` payload (Telegram Bot API [TemplateEngine.BOT\_API\_VERSION](./gramstax.templateengine.bot_api_version.md)) instead of plain HTML text. Rich message limits: - Up to 32,768 UTF-8 characters - Up to 500 blocks - Up to 16 nesting levels - Up to 20 table columns

If editing fails (e.g. message too old), the fallback behavior is controlled by `fallback` (default `delete-reply`: deletes the original message and sends a new reply — the result looks like an in-place edit).

Observe-only send-error coverage (mirrors `renderMedia`): reply failures are classified via `Ctx.classifySendError`, reported to `notifySendError`, and logged (`retryable` → `log.error`, `fallback-text` → `log.warn`). Unlike the media paths there is no degraded fallback content for text, so after notify+log the original error is ALWAYS rethrown untouched.

When `chunkSize` is present (not `undefined`/`null`) the fully-rendered block is sent as sequential reply chunks instead (see the `chunkSize` field of [IRenderTextParams](./gramstax.irendertextparams.md)): the keyboard lands ONLY on the last chunk. The chunked route is a REPLY route — a multi-message split cannot be edited in place — so the params type accepts only `mode: 'reply'` (or no `mode`) alongside `chunkSize`; passing `mode: 'auto'`/`'edit'` with a `chunkSize` is a compile error (and throws for plain-JS callers) because that `mode` would never be read.

When `broadcast` is present, the block is SENT to every `broadcast.ids` entry instead (see [IBroadcastSendParams](./gramstax.ibroadcastsendparams.md)): rich templates through `api.sendRichMessage`, plain templates through `api.sendMessage` with `parse_mode: HTML`. The broadcast route is send-only, so its params type rejects `mode`, `fallback`, and `chunkSize` outright (pacing uses `broadcast.chunkSize`).

A bottom (reply) keyboard is rejected on an edit route before any API call — `editMessageText` accepts inline keyboards only, so the throw names `mode: 'reply'` as the fix.

## Example


```typescript
async handleCallbackQueryData() {
  // Automatic reply/edit with content from this.template
  await this.renderText()

  // With keyboard builder and data
  const kb = this.inlineKeyboard((k) => k.text("OK", "ok"))
  await this.renderText({keyboard: kb, data: {name: "John"}})

  // Force a new reply even from a callback query, with a custom base
  await this.renderText({keyboard: kb, data: {name: "John"}, AGBaseId: "id-hello-world", mode: "reply"})

  // Long message: send in chunks of 4096 characters (keyboard on the last chunk only)
  await this.renderText({keyboard: kb, AGBaseId: "id-hello-world", chunkSize: 4096})

  // Broadcast: send the block to many users (rich templates send rich)
  await this.renderText({data: {name: "John"}, broadcast: {ids: [123456, 789012], languageCode: [`en`, `id`]}})
}
```

