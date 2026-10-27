---
title: Migrating to v6
description: What breaks between gramstax v5 and v6, and the exact before/after for every call site you have to touch.
icon: code-compare
---

# Migrating to v6

## Who this is for

Anyone whose `package.json` says `"gramstax": "^5"`. There is no runtime shim and
no codemod: v6 removed render methods outright and renamed fields on the public
types, so the compiler points at every call site you have to fix. Read the
`gramstax` entry in your `package.json` to tell which side you are on.
`this.renderAuto(kb, da)` and `this.renderEditAudio(kb)` are v5;
`this.renderText({keyboard, data})` is v6.

## At a glance

| Change | What breaks | How much work |
| --- | --- | --- |
| Render methods take one object | Every `render*()` call site. v6 has 32 methods, `render()` is now `renderText()`. | Largest item, but mechanical. |
| `getG*()` returns an object | Direct `TemplateManager.getG*()` callers. | Small, if you call them at all. |
| Broadcast folded behind `broadcast` | `renderBroadcast`, `renderBroadcastMedia`, `renderBroadcastPoll`, `renderBroadcastEdit` are gone. | Small, one field move. |
| Per-kind media rejects a broadcast send | `renderPhoto({broadcast: {ids}})` and its nine siblings. | Small. |
| Param types prefixed with `I` | Nothing for a v5 user; the un-prefixed names never shipped. | None. |
| Class state grouped | `bot.webhookQueue`, `bot.webhookServer`, `bot.pollingDispatcher`. | Small: tests and deploy wrappers only. |
| Render params are route unions | Field combinations that used to compile and be silently dropped. | Find the errors, delete the dead fields. |
| `keyboardInline` renamed | `renderEditCaption` and `renderEditKeyboard` only. | Trivial. |
| Route field renames | `fallbackEdit`, `broadcastOpts`, the `options1`/`options2` slots. | Mechanical rename. |
| `create-gramstax` flags | `--skip-install` now skips; `--no-lmdb` and friends exist. | Trivial. |

## Render methods take one object

Every render operation is one method taking one params object. The positional
`(keyboard, data, AGBaseId, options)` shape is gone, `render()` is now
`renderText()`, and 38 methods were removed. The mode variants became a field:
`mode` is `'auto' | 'reply' | 'edit'` and defaults to `'auto'`, which reproduces
the old `*Auto` behaviour. `renderChunked` is `renderText({chunkSize})`. The
per-kind wrappers kept their names and gained `mode`. Both pairs below are
lifted from `example/2-helloworld/src/pages/start.ts` and `example/1-complex/src/pages/start/test/audio.ts`:

```ts
// before
show: async () => {
  const kb = this.inlineKeyboardT([this])
  const da = {time: new Date().toString()}
  await this.renderAuto(kb, da)
}

// after
show: async () => {
  await this.renderText({keyboard: this.inlineKeyboardT([this]), data: {time: new Date().toString()}})
}

// before
show: async () => {
  const kb = this.inlineKeyboardT([StartPage.data.callbackQueryData(`3`)])
  await this.renderEditAudio(kb)
}

// after
show: async () => {
  await this.renderAudio({keyboard: this.inlineKeyboardT([StartPage.data.callbackQueryData(`3`)]), mode: "edit"})
}
```

**Why.** Seventy methods for one "send a rendered block" job was not a surface anyone
could hold in their head. It now realigns with the `handle*` / `setSession*` naming convention.

## `getG*()` returns an object

The `getG*` getters on `TemplateManager` returned a mix of `string`, `string[]`
and block objects. All sixteen rendered-block getters now return
`{kind, ...payload}`, backed by the exported `G*Result` types plus `GBlockKind`
in `packages/gramstax/src/types/template.ts`. `getGBaseAtLine` is unchanged: it
is template introspection, not a rendered block. From `packages/gramstax/src/e2e/helper.ts`:

```ts
// before
class E2eHelper {
  gmsg(page: string, aGBaseId: string, data?: Record<string, any>, aLang = `default`): string {
    return this.bot.templateManager.getGMessage(page, aGBaseId, aLang, data)
  }

  gkb(page: string, aGBaseId: string, aType: `inline` | `bottom` = `inline`, data?: Record<string, any>, aLang = `default`): string[] {
    return this.bot.templateManager.getGKeyboard(page, aGBaseId, aLang, aType, data)
  }
}
```

```ts
// after
class E2eHelper {
  gmsg(page: string, aGBaseId: string, data?: Record<string, any>, aLang = `default`): string {
    return this.bot.templateManager.getGMessage(page, aGBaseId, aLang, data).text
  }

  gkb(page: string, aGBaseId: string, aType: `inline` | `bottom` = `inline`, data?: Record<string, any>, aLang = `default`): string[] {
    return this.bot.templateManager.getGKeyboard(page, aGBaseId, aLang, aType, data).rows
  }
}
```

`E2eHelper.gmsg()` and `gkb()` keep their old signatures, so e2e assertions need no
change; only direct `getG*` callers are affected. The new compile-time `rich` flag on
`GMessageResult` also fixed a bug: broadcast text always sent `parse_mode: 'HTML'`, so
a rich template fanned out invalid HTML.

**Why.** A uniform result shape means callers discriminate on `kind` instead of
guessing from the TypeScript return type.

## Broadcast moved behind the `broadcast` param

`renderBroadcast`, `renderBroadcastMedia`, `renderBroadcastPoll` and
`renderBroadcastEdit` are deleted. Their bodies live on as private helpers
reached through the method that owns the kind, with the fan-out controls nested
under `broadcast`. The `before` is v5 as tagged; the `after` is v6, so this one
call moves twice: positional args become an object, then the fan-out fields nest.
From `example/8-newsletter/src/pages/broadcast.ts`:

```ts
// before (v5 positional)
return await this.renderBroadcast(ids, langs, null, {message: draftText}, Base.infoDeliverText)
return await this.renderBroadcastMedia(ids, langs, null, {fileId, caption}, Base.infoDeliverPhoto)

// after
return (await this.renderText({AGBaseId: Base.infoDeliverText, data: {message: draftText}, broadcast: {ids, languageCode: langs}})) as IBroadcastSendResult
return (await this.renderMedia({AGBaseId: Base.infoDeliverPhoto, data: {fileId, caption}, broadcast: {ids, languageCode: langs}})) as IBroadcastSendResult
```

Content fields (`keyboard`, `data`, `AGBaseId`, `options`) stay at the top level.
Only the fan-out controls (`ids`, `languageCode`, `startFrom`, `excludeIds`,
`chunkSize`, `chunkDelayMs`, `concurrency`, `onProgress`, `throwError`) move into
`broadcast`, typed as `IBroadcastSendParams`. The bulk edit loop is the revise
path, `broadcast: {targets, reviseOptions}`, and `renderBroadcastDelete` kept its name
because a delete renders nothing.

**Why.** One method per kind, with the fan-out as an option, replaces a parallel family
that had to track every new render method.

## Per-kind media rejects a broadcast send

The ten per-kind wrappers (`renderPhoto`, `renderVideo`, `renderAudio`,
`renderDocument`, `renderAnimation`, `renderVoice`, `renderVideoNote`,
`renderSticker`, `renderLocation`, `renderContact`) reject `broadcast: {ids, ...}`.
At v5 there was nothing to reject, because the fan-out and the single send were two
different methods: `renderPhoto` sent one chat, `renderBroadcastMedia` sent many.
v6 folds both into `renderMedia`, and that fold hands the per-kind wrappers a
fan-out field they cannot honour. `IRenderMediaKindParams` excludes
`IRouteMediaBroadcastSend`, so `broadcast: {ids}` is a compile error on all ten.
The `fix` line is from `packages/gramstax/test/render-params.type-guard.test.ts`:

```ts
// before (v5): the fan-out was its own method, `renderPhoto` carried no broadcast field at all
await ctx.renderBroadcastMedia(ids, langs, null, {fileId, caption}, Base.infoDeliverPhoto)

// rejected (v6): TS error, `IRenderMediaKindParams` has no `broadcast.ids` route
await ctx.renderPhoto({broadcast: {ids, languageCode: langs}})

// fix (v6)
await ctx.renderMedia({broadcast: {ids: [1], languageCode: [`en`]}})
```

`broadcast: {targets, ...}` (the revise path) is still accepted on the per-kind
wrappers, because that loop forwards the fixed kind.

**Why.** A wrapper whose only job is to fix the kind should not take a send path
that ignores it. On that loop the kind is read from the `<g-media>` block, so
`renderPhoto({broadcast: {ids}})` would send whatever the block held while the
method name said photo.

## Param types carry the `I` prefix

**This section does not apply to you on v5.** The 22 render and broadcast param
types exported from `gramstax` were renamed with an `I` prefix:
`RenderTextParams` became `IRenderTextParams`, `BroadcastSendParams` became
`IBroadcastSendParams`, `RenderMediaParams` became `IRenderMediaParams`, and so
on, because `packages/gramstax/src/types/ctx.ts` exported 81 types of which 58
already carried the prefix, and the un-prefixed 22 were exactly the newest
surface. None of those 22 existed at v5.0.0, because v5 render params were
positional and there was no param type to name. There is nothing for you to
rename. If you built against a pre-release of the v6 line, it applies to you and
nobody else. `StreamFlavor` stays un-prefixed: it is grammy's type re-exported
from `@grammyjs/stream`, not one this package declares.

## Gramstax class state moved into four objects

`Gramstax` carried 42 flat fields. Twenty of them now sit under four
always-present objects, declared in `packages/gramstax/src/types/bot.ts` as
`IGramstaxWebhookState`, `IGramstaxPollingState`, `IGramstaxStatusState` and
`IGramstaxLimitsState`: `webhook`, `polling`, `status`, `limits`.

```ts
// before
;(bot as any).webhookQueue = queue
;(bot as any)?.webhookServer?.stop(true)
expect((bot as any).webhookDispatcher).toBeInstanceOf(UpdateDispatcher)

// after
;(bot as any).webhook.queue = queue
;(bot as any)?.webhook.server?.stop(true)
expect((bot as any).webhook.dispatcher).toBeInstanceOf(UpdateDispatcher)
```

The full mapping: `webhookQueue` becomes `webhook.queue`, `webhookQueueInstance`
becomes `webhook.instance`, `webhookDispatcher` becomes `webhook.dispatcher`,
`webhookDrainTimeoutMs` becomes `webhook.drainTimeoutMs`, `webhookServer` becomes
`webhook.server`, `pollingQueue` becomes `polling.queue`, `pollingDispatcher`
becomes `polling.dispatcher`, and `pollingQueueInstance` becomes
`polling.instance`. Each object is initialised with its defaults, so
`this.webhook.queue` is always safe to assign. The constructor input `IGramstaxParams`
is unchanged and stays flat.

**Why.** Names inside one concern had no grouping, and visibility within a cluster was
inconsistent: `webhookQueue` was public while `_webhookSecretToken` was private.

## Render params are route unions

Each render params type is now the disjoint union of the routes that method can
resolve, and every route declares the same ten universal keys: a real type where
the route reads one, `never` where it does not. At v5 the route was the method you
called, so a mode could never contradict it; v6 keeps one params object per method
and has to type every unreachable key `never` instead. A field the winning route
never reads is a compile error rather than an argument dropped behind a warning, so
expect a batch of "remove this field" errors after upgrading:

```ts
// before (v5): the route was the method you called, so there was no `mode` to contradict
await ctx.renderBroadcastEdit([{chatId: 1, messageId: 2}], `photo`, null, null, null, null, null, {fallbackEdit: `reply`})

// after: TS error, `mode` is unread on the broadcast-revise route
await ctx.renderMedia({type: `photo`, mode: `edit`, broadcast: {targets: [{chatId: 1, messageId: 2}]}})
```

Declaring the field `?: never` is what makes this work. Simply omitting it from
that union member does not, because TypeScript's excess-property check treats a
property as known when any union member declares it. Two smaller consequences:
`AGBaseId` is optional on every params type now, since `IContent` declares
`AGBaseId?: string | null` and no route atom redeclares it, where at v5 ten of the
seventy `async render*` declarations in `core/ctx.ts` took it as a required
positional (`renderEditCaption` and `renderEditKeyboard` among them); and a bottom
keyboard on a route that always edits throws at runtime naming `mode: 'reply'` as
the fix.

**Why.** Each method resolves exactly one route at runtime, so a bag of optional fields
that accepts every combination tells you nothing about what survives. The two
precedence rules (`broadcast` and `chunkSize` each short-circuiting `mode`) used to
live only in the method names; now the winning route is readable off the union itself.

## `keyboardInline` is now `keyboard`

The `keyboardInline` parameter on the v5 `renderEditCaption` and
`renderEditKeyboard` methods is now the `keyboard` field on
`IRenderEditCaptionParams` and `IRenderEditKeyboardParams`, and with the name
unified the constraint moved into the type: on a route that always reaches an edit
call, `keyboard` is narrowed to `IInlineKb`, so a bottom keyboard is a compile
error. v5 enforced the same rule in the method signature
(`renderEditCaption(keyboardInline: IInlineKb, ...)`) rather than in a type, and the
union now states it once for every method that always reaches an edit call.

```ts
// before
await ctx.renderEditCaption(kb, null, `photo-card`)
await ctx.renderEditKeyboard(kb, null, `photo-card`)

// after
await ctx.renderEditCaption({keyboard: kb, AGBaseId: `photo-card`})
await ctx.renderEditKeyboard({keyboard: kb, AGBaseId: `photo-card`})

// now a type error on all three
ctx.renderText({mode: `edit`, keyboard: ctx.bottomKeyboard((k) => k)})
ctx.renderEditCaption({keyboard: ctx.bottomKeyboard((k) => k)})
ctx.renderEditKeyboard({keyboard: ctx.bottomKeyboard((k) => k)})
```

A bottom keyboard still compiles when `mode` is absent, because `auto` decides at
runtime whether it sends or edits, but it is no longer safe there: if the update
resolves to an edit, the runtime guard throws and names `mode: 'reply'` as the fix.
The narrowing deliberately does not apply to the media routes: those delete and
re-send the kinds that cannot be edited in place, and a re-send is a send.

**Why.** The two-name split existed only because the constraint could not be expressed
anywhere else. Route unions can express it, so the names converged.

## Route field renames

The route atoms were rewritten once and their fields renamed. Every `v5` name below
is a parameter name read off the v5.0.0 signatures in
`packages/gramstax/src/core/ctx.ts`: v5 render methods took positional arguments,
so read each row as the argument that became the field.

| v5 | v6 |
| --- | --- |
| `fallbackEdit` | `fallback` |
| `broadcastOpts` (the revise and delete controls bag) | `broadcast.reviseOptions` |
| `broadcastOpts.chunkSize` | `batchSize` |
| `options1` on `renderEditMedia`, on the kinds that edit in place | `media` (the `editMessageMedia` payload) |
| `options1` on `renderEditMedia`, on the kinds that delete and re-send | `resendOptions` (the re-send reply options) |
| `options2` on `renderEditMedia` | `mediaOptions` (the `editMessageMedia` call options) |
| `options1` on `renderRich` and `renderEditRich` | `rich` (the `InputRichMessage` payload) |
| `options2` on `renderRich` and `renderEditRich` | `richOptions` |
| `options` on `renderEdit` | `editOptions` |
| `options` on `renderAuto` | `options` when it replies, `editOptions` when it edits |
| `options` on `renderMedia` | `captionOptions` |

`options1` is one v5 slot feeding two v6 fields, because v5 typed it
conditionally: on `renderEditMedia` it was the `editMessageMedia` payload for
`photo`, `video`, `audio`, `document` and `animation`, and the reply options for
`voice`, `video_note`, `sticker`, `location` and `contact`. v6 names both halves.

`optionsEdit1`, `optionsEdit2` and `IRenderMode` are absent from this table on
purpose. None of the three existed at v5.0.0, and none exists at v6.0.0 either:
they are names that existed only while v6 was being written, between the v5.0.0
and v6.0.0 tags, so if you came from v5.0.0 there is nothing to rename. In v6
`mode` carries its literal on each route atom, with no named type behind it.

```ts
// before
await this.renderBroadcastDelete(sent, {chunkSize: 2, chunkDelayMs: 1, onProgress: progress})
await this.renderEdit(kb, data, AGBaseId, undefined, `reply`)

// after
await this.renderBroadcastDelete({targets: sent, reviseOptions: {batchSize: 2, chunkDelayMs: 1, onProgress: progress}})
await this.renderText({mode: `edit`, keyboard: kb, data, AGBaseId, fallback: `reply`})
```

`batchSize` and `chunkSize` are deliberately different names. `batchSize` paces a
broadcast revise fan-out, a broadcast send fan-out paces with `broadcast.chunkSize`,
and the top-level `chunkSize` on a render params object does a third job: it splits
one long message into pieces.

**Why.** Every route declares the same ten keys, so the same concept had to carry the
same name everywhere. Each of the 20 params types is now `CONTENT & (atom | atom)`.

## create-gramstax

`--skip-install` never skipped. The flag parsed and reached `Create`, but the
value was dropped twice on the way to `executeProjectGeneration`, so generation
installed 61 packages and then printed a "Next steps" line telling you to install
them again. It now skips, and that line no longer repeats the install.

`--lmdb`, `--worker-thread` and `--biome` carried a default of `true`, so the
confirm prompt could never turn a feature off: decline "Would you like to include
@gramstax/lmdb?" and the project got LMDB anyway. The defaults are gone and the
negative spellings now exist, which is what makes non-interactive use possible at
all, since a prompt is unavailable in a pipe. Stating neither spelling prompts;
declining leaves `src/db/`, `src/workers/` and `biome.json` absent, accepting keeps them and adds the dependencies.

The runtime-selection option has been removed. Generated projects are Bun-only,
so drop it from any scripted invocation; the Bun app, test, and build scripts
are now the only output.

```bash
# before: --skip-install was parsed, then dropped; this installed everything
bunx create-gramstax my-bot --skip-install

# after: generates and stops, and there is no way to turn a feature off by prompt
bunx create-gramstax my-bot --no-lmdb --no-worker-thread --no-biome --skip-install
```

**Why.** Both defects were found by generating a project and inspecting the result, not
by reading the code, which looked right.

## License

`gramstax`, `create-gramstax`, `lmdb` and `worker-thread` are now Apache-2.0. The
scaffolded project template stays MIT, so projects you generate keep the licence
they were generated under. Nothing here requires action on your side.
