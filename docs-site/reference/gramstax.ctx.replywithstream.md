---
title: "Ctx.replyWithStream()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [replyWithStream](./gramstax.ctx.replywithstream.md)

## Ctx.replyWithStream() method

Streams an iterator of message pieces to the current chat, making text appear progressively as editing message drafts.

**Signature:**

```typescript
replyWithStream(stream: Iterable<MessageDraftPiece> | AsyncIterable<MessageDraftPiece>, otherMessageDraft?: Parameters<StreamContextExtension[`replyWithStream`]>[1], otherMessage?: Parameters<StreamContextExtension[`replyWithStream`]>[2], signal?: Parameters<StreamContextExtension[`replyWithStream`]>[3]): Promise<unknown>;
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

stream


</td><td>

Iterable&lt;MessageDraftPiece&gt; \| AsyncIterable&lt;MessageDraftPiece&gt;


</td><td>

An iterable of text chunks that make up the message.


</td></tr>
<tr><td>

otherMessageDraft


</td><td>

Parameters&lt;StreamContextExtension\[\`replyWithStream\`\]&gt;\[1\]


</td><td>

_(Optional)_ Optional remaining parameters forwarded to `sendMessageDraft`.


</td></tr>
<tr><td>

otherMessage


</td><td>

Parameters&lt;StreamContextExtension\[\`replyWithStream\`\]&gt;\[2\]


</td><td>

_(Optional)_ Optional remaining parameters forwarded to `sendMessage`.


</td></tr>
<tr><td>

signal


</td><td>

Parameters&lt;StreamContextExtension\[\`replyWithStream\`\]&gt;\[3\]


</td><td>

_(Optional)_ Optional `AbortSignal` to cancel streaming.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;unknown&gt;

Array of sent text messages.

## Remarks

Provided at runtime by the `\@grammyjs/stream` plugin middleware. The `stream()` plugin must be installed on the bot for this method to be available. Gramstax registers it by default.

Each `MessageDraftPiece` is either a plain string or an object `{text, entities?, draft_id?}`. Chunks with the same `draft_id` belong to the same draft; the first chunk crossing 4096 chars is split into a new message. Entities offsets are relative to the entire stream, not per-chunk.

