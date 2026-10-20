---
title: Extending gramstax
description: The five extension points, page data, context subclassing, middleware, send errors, and filesystem-less boot.
icon: puzzle
---

# Extending gramstax

There are five extension points for going past the defaults. Each one is
independent, so use only the one you need. Each section gives its shape, a
compiling example, and when to leave it alone.

## `buildData`: page routing metadata

`IBuildDataOptions` in `packages/gramstax/src/types/ctx.ts`, overloaded on `Ctx`
in `packages/gramstax/src/core/ctx.ts`. This is the one most page authors need.

| Field | Default | Effect |
| --- | --- | --- |
| `name` | inferred from the route | Page name; uniqueness key across all pages. |
| `callbackQueryData` | zero-arg | Definition side: how call args become the callback string. |
| `intentText` | falls back to `name` | Text intent for `handle*Text`. |
| `intentCommandText` | falls back to `name` | Command intent for `handleCommand*Text`. |

Both intent fields also take a `Record<string, string>` whose `default` key is
the fallback when the user's language is absent.

```ts
import {Ctx} from "gramstax"
import {ban} from "~/services/ban"

export class AdminBanPage extends Ctx {
  static data = this.buildData((action: string, chatId: string) => [action, chatId])

  async handleArgsCallbackQueryData() {
    const [action, chatId] = this.callbackQueryDataArgs
    if (action === `ban` && chatId) await ban(chatId)
  }
}
```

`buildData` returns `IPageData`: `IPageDataBase` plus a typed
`callbackQueryData` returning `{result, page, args}`, with `result` the page
intent and the args colon-joined. That is the **consumption** side of the
definition above. `static data` is optional: a page that omits it gets one
filled in at registration, named after its walk-derived route.

<Note>
  The page class is not carried by `static data` (TypeScript cannot infer it
  without a circular annotation), so pass it explicitly to get the route checked:

  ```ts
  this.inlineKeyboardT([AdminBanPage.data.callbackQueryData<AdminBanPage>(`ban`, chatId)])
  ```

  Omit the type argument and the data is accepted unchecked, resolved only at
  runtime. And never hand-write `IPageData`: `name`, `intentText`,
  `intentCommandText`, `intentCallbackQueryData` and `_positionArgText` are all
  derived, and overriding them is how duplicate-intent boot failures appear.
</Note>

## `ICtxParams`: subclassing `Ctx`

Declared in `packages/gramstax/src/types/ctx.ts`, and the single constructor
input. Required: `cacheSession`, `cacheKeyboard`, `templateManager`, `temp`.
Optional: `ct`, `log`, `mediaRoots`, `onSendError`.

You need a constructor only when pages want an app value.
`Gramstax.buildCtxParams(ct, extra)` is the only assembly point: it merges the
per-update `ct`, the app-wide scope, your `extra`, and a fresh `temp`. Extra keys
named `ct` or `temp` throw.

```ts
// src/core/bot.ts: the app side
import {Gramstax, type ICt, type ICtxParams} from "gramstax"
import {Db} from "~/db"

export class BotCore extends Gramstax {
  db = new Db()

  override buildCtxParams<T extends Record<string, unknown> = Record<string, never>>(ct: ICt, extra?: T): ICtxParams & T & {db: Db} {
    return super.buildCtxParams(ct, {db: this.db}) as ICtxParams & T & {db: Db}
  }
}

// src/core/ctx.ts: the page side
import {Ctx, type ICtxParams} from "gramstax"
import type {Db} from "~/db"

export class CtxCore extends Ctx {
  declare db: Db

  constructor(params: ICtxParams & {db: Db}) {
    super(params)
    this.db = params.db
  }
}
```

Every page extending `CtxCore` has a fully typed `this.db`, no cast at the use
site. The `Ctx` constructor deliberately does **not** attach app extras: assign
each one explicitly so the wiring stays visible. `ct` is optional because of the
redirect pattern: `new KycPage(this)` passes the current page, which is itself a
`Context`, and stream methods are read from `this.api`.

<Warning>
  `buildCtxParams` assigns `onSendError` last, from `hookSendError`: an
  `onSendError` in `extra` is overwritten, and overriding `hookSendError` is the
  only way to set it. Skip this section if pages need nothing extra; a shared
  `PageBase` that only adds template helpers needs no constructor.
</Warning>

## `ICtMiddleware`: per-update middleware

`ICtMiddleware<C extends ICt = ICt>` is an alias for `Middleware<C>`: a
`(ctx, next)` function or a middleware container. Override
`Gramstax.registerLowPlugin(): Array<ICtMiddleware<ICt>>`. The array goes to
`bot.use` **in order**, during construction and before the framework's own update
listeners attach, so the first entry is outermost and wraps routing. There is no
base implementation: not overriding it, or returning an empty array, installs
nothing.

```ts
import {Gramstax, type ICtMiddleware, type ICt} from "gramstax"

export class BotCore extends Gramstax {
  override registerLowPlugin(): Array<ICtMiddleware<ICt>> {
    return [
      async (ct, next) => {
        this.log?.info?.(`update ${ct.update.update_id} from ${ct.from?.id}`)
        await next()
      }
    ]
  }
}
```

<Warning>
  Order is the contract: a middleware that swallows `next()` stops routing
  entirely. When the timing does not fit, use `hookBeforeStart` for one-shot boot
  effects, or `hookBeforeRoute` / `hookAfterRoute` for per-update work *inside*
  the router after a page is chosen. Middleware is for real `next()` semantics.
</Warning>

## `ISendErrorHook`: reacting to send failures

`ISendErrorHook = (err: unknown, info: ISendErrorInfo) => void` and
`ISendErrorInfo = {page, kind, chatId?}`, both in
`packages/gramstax/src/types/ctx.ts`. `kind` is the `Ctx.classifySendError`
outcome: an API error in 400–499 other than 429 is `fallback-text`; 429, network
errors and anything unrecognised are `retryable`.

```ts
import {Gramstax, type ISendErrorInfo} from "gramstax"

const retryQueue: Array<{err: unknown; page: string; chatId?: number}> = []

export class BotCore extends Gramstax {
  override hookSendError(err: unknown, info: ISendErrorInfo): void {
    if (info.kind === `retryable`) retryQueue.push({err, page: info.page, chatId: info.chatId})
    else console.warn(`text fallback on ${info.page} (chat ${info.chatId})`)
  }
}
```

`page` is the template page name (`this.data?.name`, or `unknown`), never file
contents or interpolated data. `chatId` is the broadcast recipient or current
chat, `undefined` when the update carries no chat. The hook fires wherever a send
error is classified; pre-upload validation throws stay hook-free by design, and a
throwing hook is swallowed. It **observes**: a `retryable` failure still rethrows
to your caller, so do not retry inline inside it.

<Note>
  Other hooks cover different sinks. `hookUpdateError` receives updates that
  ended in an error, and `hookTrace` fires at the end of every dispatch that
  passed the bot-level `hookBeforeRoute`. Use `hookSendError` for send failures,
  `hookUpdateError` for terminal update errors and `hookTrace` for tracing. Do
  not use this hook just to count errors already thrown by your own `render*()`
  calls; it is most useful inside a broadcast fan-out, where no single caller
  owns the failure.
</Note>

## `IPageManifestEntry`: booting without a filesystem

One page entry of `IAppManifest`, declared in
`packages/gramstax/src/types/manifest.ts`:

| Field | Meaning |
| --- | --- |
| `path` | POSIX path relative to the pages root, e.g. `./admin/settings.ts` in your own project. |
| `routeName` | Walk-derived route. Must be non-empty: an empty value throws. |
| `page` | The imported page class, `typeof Ctx`. Its `static template` rides along. |

The manifest is `{pages, templates, routes?}`; a `templates` entry is
`{key, template}` and a `routes` entry is `{name, file, routeName}`. Passing
`manifest` to the constructor selects the manifest loader **instead of** the
directory scan: both paths register through the same function, so the routing
tables come out identical with no directory read.

```ts
import {Gramstax, TemplateManager, type IAppManifest} from "gramstax"
import {StartPage} from "~/pages/start"
import {InfoPage} from "~/pages/info"

const manifest: IAppManifest = {
  pages: [
    {path: `start.ts`, routeName: `start`, page: StartPage},
    {path: `info.ts`, routeName: `info`, page: InfoPage}
  ],
  templates: [{key: `info`, template: `<g-message>No filesystem touched.</g-message>`}]
}

export class BotCore extends Gramstax {
  constructor() {
    super({token: process.env.BOT_TOKEN ?? ``, deploy: `serverless`, templateManager: new TemplateManager({path: []}), manifest})
  }
}
```

With `routes` present it is the source of truth, joined to `pages` by
`routeName`; a route with no matching page throws, naming the file, rather than
being silently dropped. Omit it and pages register directly. Class-inline
templates compile under their route name first, then every `templates` entry
under its own key.

<Warning>
  `manifest` is a **constructor** field. The config loader validates
  `gramstax.config.ts` against a closed list of top-level fields that does not
  include it, so putting `manifest` in the config throws `unknown field`. In
  practice you do not hand-write this object: `gramstax build` freezes
  `src/pages` into `.gramstax/`, which only `deploy: "serverless"` consumes:
  `polling`, `webhook` and `test` boot from the filesystem and ignore the output.
</Warning>

## Order of operations

<Tip>
  `registerLowPlugin` middleware runs first, then a `Ctx` is built from
  `buildCtxParams` for the update, then page data picks the route, then
  `hookBeforeRoute` runs inside the router, then the handler renders. Send errors
  classify last and reach `hookSendError` after the fact. Middleware is outside
  the router and so sees updates no page will claim; `hookBeforeRoute` fires only
  once a page is selected. And because `buildCtxParams` assigns `onSendError`
  last, a subclass constructor can never inject its own error hook.
</Tip>