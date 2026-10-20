---
title: Broadcast
description: Fan-out to many recipients from a template block, and the revise and delete paths that reach back into already-sent messages.
icon: send
---

# Broadcast

Sending one message to ten thousand people is not a loop you write. It is a route
on a render call, with its own params object, its own result object, and its own
error rules, and it is worth learning as a unit because the three shapes (send,
revise, delete) look alike and behave differently.

Pacing, checkpoints, a re-drive list and bounded concurrency exist because a
restart halfway through is normal, and re-sending to someone who already got the
message is the failure that matters.

<Note>
  This page is about fan-out. A single-chat send is the render contract, and the
  failures on both are covered in [Errors](/guides/errors).
</Note>

## Two shapes, not one

| Shape | Carries | Resolves to |
| :---- | :------ | :---------- |
| `broadcast.ids` | recipient user ids | **fan-out**: a fresh send to each recipient |
| `broadcast.targets` | stored `{chatId, messageId}` rows | **revise**: an edit or re-send of what was already sent |

`ids` is for the first send. `targets` is for the second conversation: you kept
the `{chatId, messageId}` of each delivered message, and now the price changed,
the poll closed, or the promotion expired and those messages should come down.

They are different unions, so they are mutually exclusive at compile time. There
is no `ids` on a revise route and no `targets` on a send route.

## The five entry points

| Where | Method |
| :---- | :----- |
| text fan-out | `renderText({broadcast: {ids, languageCode}})` |
| media fan-out | `renderMedia({broadcast: {ids, languageCode}})`: no `type`; the kind comes from the `<g-media>` block |
| poll fan-out | `renderPoll({broadcast})` |
| revise stored messages | `renderMedia({type, broadcast: {targets}})` |
| delete stored messages | `renderBroadcastDelete({targets})` |

Two differences matter.

**A media fan-out has no `type`.** The single-chat media route needs `type` to
pick the Bot API method, but on the fan-out route the kind is read from the
`<g-media>` block the template already declares. Passing `type` there is a
compile error, not an override.

**A revise does need `type`.** It is the one media case where the block cannot
decide, because the stored rows do not know what they were. `renderMedia` throws
before any API call if `type` is missing:

```text
renderMedia illegal combination: broadcast.targets + type is required
```

## A text fan-out

The shape is one step object that returns the result, so the caller never casts
at the call site. This is the `ginfoDeliverText` step from
`example/8-newsletter`, with the render call spread over several lines.

```ts
// example/8-newsletter/src/pages/broadcast.ts
ginfoDeliverText = {
  show: async (ids: number[], langs: string[], draftText?: string) => {
    return (await this.renderText({
      AGBaseId: Base.infoDeliverText,
      data: {message: draftText},
      broadcast: {ids, languageCode: langs}
    })) as IBroadcastSendResult
  },
  process: () => {}
}
```

```html
<g-base id="i-deliver-text">
  <g-message>{{message}}</g-message>
  <g-message lang="id">{{message}}</g-message>
</g-base>
```

`ids` and `languageCode` are **parallel arrays**. The template for recipient *n*
is resolved from `languageCode[n]`, which is why the newsletter builds both from
the same subscriber list:

```ts
const ids = subscribers.map((item) => item.id)
const langs = subscribers.map((item) => item.language || `default`)
```

A length mismatch does not throw. The message map is built from `languageCode`,
and a recipient index past its end falls back to the last resolved language, so a
`languageCode` shorter than `ids` quietly sends the final language to the tail.
An empty `languageCode` is the one that bites: there is no template to fall back
to, and every recipient counts as failed.

<Note>
  `renderText` has four routes and `broadcast` is one of them, so its return
  type is `Message | Message[] | true | IBroadcastSendResult`. The `as
  IBroadcastSendResult` in the example is the honest way to narrow that at a step
  boundary. There is no overload that removes the cast.
</Note>

## `IBroadcastSendParams`

The `broadcast` field of `renderText`, `renderPoll` and `renderMedia`. Two
required, seven optional.

| Field | Type | Default | What it does |
| :---- | :--- | :------ | :----------- |
| `ids` | `number[]` | required | Recipient user ids, in stable order. The array index *is* the checkpoint index. |
| `languageCode` | `string[]` | required | One language per recipient, parallel to `ids`. |
| `startFrom` | `number \| null` | `null` (start at `0`) | Absolute index to resume from. Everything below counts as skipped and is never resent. |
| `excludeIds` | `number[] \| null` | `null` (send to all) | Ids to skip. Counted in `skippedCount`, not sent, not failed. |
| `chunkSize` | `number \| null` | `null` (free-limit pacing only) | Messages per pacing chunk, as distinct from the render-level `chunkSize` that splits one message. |
| `chunkDelayMs` | `number \| null` | `500` | Sleep in ms after each `chunkSize` chunk. |
| `concurrency` | `number \| null` | `1` | Parallel send workers. Floored at 1, capped at 10, non-finite becomes 1. |
| `onProgress` | `(done, total) => void \| Promise<void> \| null` | `null` | Checkpoint callback. May be async. Fires after every pacing chunk and once at completion. |
| `throwError` | `boolean \| null` | `false` | Throw instead of swallowing when anything failed. |

<Warning>
  Two different `chunkSize` fields exist and they mean opposite things. The
  render-level `chunkSize` splits one long message into sequential replies; the
  broadcast `chunkSize` paces a fan-out by sleeping every N recipients. They
  cannot be used together: the broadcast route rejects the render-level one at
  compile time and at runtime.
</Warning>

### Pacing

Telegram's free-tier allowance is what drives the default. Every broadcast loop
sleeps **1200 ms after every 30 recipients**, regardless of configuration, and
fires `onProgress` at each of those boundaries. `chunkSize` adds a second, shorter
boundary: sleep `chunkDelayMs` after every N recipients. When both boundaries land
on the same recipient, the 30-recipient boundary wins. The 30-boundary also sleeps
after the final batch; the chunk boundary does not sleep after the last chunk.

```ts
broadcast: {
  ids,
  languageCode: langs,
  chunkSize: 10,
  chunkDelayMs: 300,
  onProgress: async (done, total) => {
    await saveCheckpoint(done) // `done` is a resumable startFrom for next time
  }
}
```

`onProgress` is where a checkpoint belongs. `done` counts processed recipients,
so persisting it is what makes `startFrom` safe to resume from after a restart.

### Concurrency

`concurrency` greater than 1 splits the remaining indices into that many lanes
and runs them with `Promise.all`. Values outside 1 to 10 are clamped rather than
rejected, and a non-finite value becomes 1. Media is cloned per recipient inside
the worker (`Ctx.cloneMediaInput`), so parallel lanes never share one mutable
`InputFile`.

## `IBroadcastSendResult`

What every `ids` route returns.

| Field | Meaning |
| :---- | :------ |
| `successCount` | Recipients the block was delivered to. |
| `failedCount` | Recipients that failed, retryable and fallback-text alike. |
| `totalCount` | `ids.length`. Always the full list, not the number attempted, so a resumed run still reports the whole campaign. |
| `skippedCount` | Indexes skipped by `startFrom`, plus ids excluded by `excludeIds`. |
| `retryable` | `Array<{index, id, error}>`, in completion order, for a re-drive pass. |

```ts
const res = await this.ginfoDeliverText.show(ids, langs, draftText)
if (res.retryable.length > 0) {
  await this.retryQueue.push(res.retryable) // index + id + the raw error
}
await this.gsuccess.show(res.successCount, res.totalCount)
```

### The rules that matter

**A retryable failure never aborts the run.** This is the rule the whole design
turns on. A 429, a 5xx or a network blip on recipient 4,000 of 10,000 is recorded
in `retryable` and the loop keeps going, with the checkpoint still advancing. A
single unreachable recipient cannot cost you the other 9,999.

**`fallback-text` is counted but not retryable.** A 400-family rejection such as
a blocked bot gets one best-effort fallback-text send to that recipient
(`resolveFallbackText()`, nested failure ignored) and increments `failedCount`.
It produces no `retryable` entry, because retrying a 403 does not help.

**An empty block is a failure, not a skip.** On the text route, a recipient whose
resolved block is missing or renders to an empty string increments `failedCount`
and stops there: no API call, no `retryable` entry. An undeclared language is not
this case: it falls back to the `default` block and is sent in the default
language. Only an empty render, or an empty `languageCode`, counts as failed.

**`throwError` throws after the run, not during it.** With `throwError: true`, a
completed run whose `failedCount > 0` throws `{...res, err: firstError}`, where
`firstError` is the first failure of any kind. The campaign still finishes
first.

## Revising what was already sent

The revise route is `renderMedia` with `broadcast.targets`, and its type is the
edit-capable one.

| Target shape | Behaviour |
| :------------ | :-------- |
| `IBroadcastEditTarget` | `{chatId, messageId}`: the stored row of a delivered message |

```ts
const sent = await this.db.sentRepo.listByCode(`vip-drop-7`)
await this.renderMedia({type: `photo`, data: {price: `99`}, broadcast: {targets: sent}})
```

| Media kind | Revise path |
| :--------- | :---------- |
| `photo`, `video`, `audio`, `document`, `animation` | edited in place via `editMessageMedia` |
| `voice`, `video_note`, `sticker`, `location`, `contact` | old message deleted, a new one sent |
| `photo`, `video`, `audio` or `document` with two or more files in a pipe-delimited `src` | old message deleted, `sendMediaGroup` sends the set; this branch wins over the in-place edit above |

So `fallback` on a revise covers two different failures that look identical: a
failed `editMessageMedia`, and a delete plus re-send that then failed. The
revise controls live on `broadcast.reviseOptions` and are `IBroadcastEditOpts`.

| Field | Type | Default | What it does |
| :---- | :--- | :------ | :----------- |
| `startFrom` | `number \| null` | `null` | Checkpoint index into `targets`. |
| `concurrency` | `number \| null` | `1` | Stride lanes, clamped to 1 to 10. |
| `batchSize` | `number \| null` | `null` | **Named `batchSize` here**, the pacing equivalent of the send route's `chunkSize`. |
| `chunkDelayMs` | `number \| null` | `500` | Sleep after each `batchSize` batch. |
| `onProgress` | `(done, total) => … \| null` | `null` | Progress tick per pacing sleep and at completion. |
| `fallback` | `IOptFallbackEdit \| null` | `delete-reply` | What to do when the in-place edit fails. Same three modes as a single-chat edit. |

<Note>
  `fallback` is absent from the type on `renderBroadcastDelete`, not merely
  ignored: it is `Omit<IBroadcastEditOpts, \`fallback\`>`. A delete has no resend
  to fall back to, so accepting the field would be a lie about what it does.
</Note>

<Warning>
  A revise fallback drops the edit options. `media` and `mediaOptions` describe
  `editMessageMedia`, and the fallback path re-sends instead, so passing them logs
  `broadcast revise fallback drops edit options (media/mediaOptions do not map to
  reply options)` and those fields are not applied.
</Warning>

`IBroadcastEditResult` mirrors the send result with `targets` in place of `ids`:
`{successCount, failedCount, totalCount, skippedCount, retryable: [{index,
chatId, messageId, error}]}`. Same checkpoint-first contract, same rule that a
retryable failure is recorded rather than raised.

## Deleting stored messages

`renderBroadcastDelete` is the expiry path, and it is the only one of the five
that reads no template block at all.

```ts
async handleExpireVip() {
  const sent = await this.db.sentRepo.listByCode(`vip-drop-7`)
  await this.renderBroadcastDelete({targets: sent})
}
```

It runs `api.deleteMessage(chatId, messageId)` per row with the same checkpoint,
pacing, concurrency and re-drive behaviour as the revise fan-out. A failed delete
has no text fallback by design, so a `fallback-text` classification only logs
`broadcast delete fallback-text (no text fallback)` and counts as failed. There
is nothing to say to a chat whose message you were removing.

## What the fan-out route rejects

The broadcast routes are send-only, so every edit-side key is a compile error
rather than a field quietly dropped. `renderText`, `renderMedia` and
`renderMediaGroup` share `Ctx._assertRenderRoute` for the runtime half.

```ts
// ❌ the broadcast-send route never edits
await this.renderText({broadcast: {ids, languageCode: langs}, mode: `edit`})

// ✅
await this.renderText({broadcast: {ids, languageCode: langs}})
```

The revise route has its own exclusion set, which is longer because it edits but
takes none of the send options: `mode`, `options`, `captionOptions`,
`editOptions`, `fallbackOptions`, `chunkSize`, plus the two rich keys `rich`
and `richOptions`, which are dead on every media route. Its `fallback` lives in
`broadcast.reviseOptions.fallback`, not at the top level. See [the render
contract](/concepts/render-contract) for the route atoms, and [Errors](/guides/errors)
for what the runtime check throws when a plain-JS caller reaches it.

## Where to go next

<Columns cols={2}>
  <Card title="The render contract" icon="shapes" href="/concepts/render-contract">
    The route atoms, and why a dropped key is a compile error.
  </Card>
  <Card title="Errors" icon="alert-triangle" href="/guides/errors">
    How a fan-out classifies a per-recipient failure.
  </Card>
  <Card title="Pages" icon="file-code" href="/guides/pages">
    The step-object shape the fan-out lives in.
  </Card>
  <Card title="Example bots" icon="boxes" href="/guides/examples">
    `8-newsletter` is the broadcast bot; read the page this example came from.
  </Card>
  <Card title="Template blocks" icon="blocks" href="/guides/template-blocks">
    Per-block languages, which is what `languageCode` selects.
  </Card>
  <Card title="Deploy" icon="server" href="/concepts/deploy">
    Running a fan-out from a webhook or a serverless isolate.
  </Card>
</Columns>