---
title: Pages
description: The four moving parts of a page class, how static data declares a route's identity, and how a handler name lands in the right routing table.
icon: file-code
---

# Pages

A page is one file under `src/pages` holding a class that extends `Ctx`. Everything
the bot does with one screen lives there: which inputs reach it, what the message
says, and the steps that run when it does. There is no registration call and no
central route table, so a page is found by being in the tree and its path is its
route name.

This page is about what a page *is*, piece by piece. How a filename becomes a
route is [page routing](/concepts/page-routing). How an incoming Telegram update
decides which page gets it is [routing](/guides/routing).

## The four moving parts

Read them in this order. The first decides whether the page is reachable at all,
the second is what the user sees, and the last two are where your own logic lives.

| Piece | Declared as | What it is |
| :---- | :---------- | :--------- |
| `static data` | `this.buildData(...)` | Route identity: the page name, the text, command and callback intents, and the typed `callbackQueryData(...)` signature |
| `static template` | a template literal | The markup: `<g-base>` blocks containing `<g-message>`, `<g-keyboard>`, `<g-media>` and friends |
| handlers | `handle*` methods | The entry points routing dispatches to; each stays thin and delegates to a `g*` step |
| `helper` / `g*` | instance fields | Page-local closures and the `{show, process}` step objects |

The last row is a convention, not framework API. `helper` and `g*` are names you
pick, and the framework never looks at them. What the convention buys is that a
handler is one line long and the interesting code is somewhere you can name and
reuse. [`example/1-complex`](https://github.com/gramstax/gramstax/tree/main/example/1-complex)
follows it throughout.

## `static data` is the route identity

`buildData` is a static on `Ctx` with four overloads. It returns a `static data`
object, and it is the only place a page declares which inputs it answers to.

```ts
// no args: callbackQueryData() takes zero arguments
static data = this.buildData()

// a callback-arg mapper: types data.callbackQueryData(id)
static data = this.buildData((id: string) => [id])

// optional args
static data = this.buildData((exe?: string) => [exe])

// a name override plus per-language intents
static data = this.buildData({name: `lang`, intentText: {en: `hello`, default: `hello`}})
```

`IBuildDataOptions` is small, and every field is optional:

| Field | Type | What it changes |
| :---- | :--- | :-------------- |
| `name` | `string` | The page name, which is also the default for all three intents |
| `callbackQueryData` | `(...args: string[]) => Array<string \| undefined>` | The definition side: how positional args are encoded into the callback string |
| `intentText` | `string` or `Record<string, string>` | The text that reaches `handleText` and `handleArgsText` |
| `intentCommandText` | `string` or `Record<string, string>` | The command that reaches `handleCommandText` and `handleCommandArgsText` |

`intentText` and `intentCommandText` each accept either a single string or a
`{lang: intent}` record. Hand a record and `buildData` normalises it: `default` (or
the page name) becomes the plain intent that later reads back, and the whole record
is kept as `intentTextMap` or `intentCommandTextMap` so every language variant gets
its own routing key. That is how one page serves `/balance` and `/saldo` without
two handlers.

### What a page without `static data` gets

`static data` is optional on `Ctx`, and a page that omits it still routes and
still has a working `callbackQueryData` at runtime, because the framework fills
the gap: `Gramstax._pageBuildData` assigns `Page.data = Page.buildData()` and
then fills the name and the intents from the file path.

What is missing is only the static type. `Ctx` declares
`static data?: IPageDataBase`, and `IPageDataBase` has no `callbackQueryData`
member, so the instance property is typed through a cast
(`this.constructor as unknown as {data: IPageData}`) and
`this.data.callbackQueryData(…)` typechecks on every page. Declare
`static data = this.buildData()` when you want a typed `callbackQueryData`
signature, or when you want to override the derived name and intents.

### The three intents and where they default to

| `data` field | Defaults to | Matched against | Registered key |
| :----------- | :---------- | :-------------- | :------------- |
| `name` | the route name taken from the file path | a media caption, which has no intent of its own | the bare name |
| `intentText` | `name` | message text | `intentText`, or `lang:intent` per entry of `intentTextMap` |
| `intentCommandText` | `name` | a `/command` | `/intentCommandText`, prefixed with the slash |
| `intentCallbackQueryData` | `name` | `callback_query.data` | `intentCallbackQueryData`, verbatim |

Defaults are filled in at boot, after your `buildData` call has run, so anything
you leave empty takes the route name from the path. Read the last column before
naming a page. A caption is matched on the bare route name, so
`src/pages/admin/ban.ts` answers a photo captioned `admin/ban` whether or not you
declare anything. A command is matched on `/` plus whatever you declared, and a
callback on the bare intent, so a nested route name is fine for captions and a
choice you should think about for the other two. And a project that sets
`optionsPage.shortCallbackQueryData` gets numeric `intentCallbackQueryData`
values instead of names, which is how the Cloudflare example keeps its callback
strings short.

### What `callbackQueryData(...)` returns

It is the consumption side, the mirror of the definition above, and it returns an
object rather than a bare string:

```ts
// example/1-complex/src/pages/start/counter/index.ts
helper = {
  counterKeyboard: () => this.inlineKeyboardT([this.data.callbackQueryData(`I`), this.data.callbackQueryData(`D`), StartPage], `2`)
}
```

| Field | Type | Meaning |
| :---- | :--- | :------ |
| `result` | `string` | The string Telegram carries in `callback_query.data`: the intent, then `:` and each arg |
| `page` | the page class | The destination, carried so the keyboard builder can validate it before anything is sent |
| `args` | the tuple you passed | The positional args exactly as given, `[]` when none |

Because `buildData` is typed by the mapper you give it, `callbackQueryData` has
the same arity. Declare `(id: string) => [id]` and the call site is checked;
declare no mapper at all and passing an argument is an error.

## Wiring a keyboard to a page

`inlineKeyboardT` builds an inline keyboard whose button labels come from the
template and whose callback payloads come from a list of destinations. The list is
positional: the Nth destination backs the Nth label in the `<g-keyboard>` block.

```ts
// example/1-complex/src/pages/start/counter/index.ts
helper = {
  counterKeyboard: () => this.inlineKeyboardT([this.data.callbackQueryData(`I`), this.data.callbackQueryData(`D`), StartPage], `2`)
}
```

| Destination in the array | What goes to Telegram |
| :------------------------ | :--------------------- |
| an `IKbCallbackData` object | its `result`, so `Page.data.callbackQueryData(…)` |
| a page class or instance | its `callbackQueryData()` result, called for you |
| a plain string | the string, unchanged |

Passing a bare page class is the ergonomic form: the counter keyboard above
appends `StartPage` after two explicit payloads and `StartPage.data.callbackQueryData()`
is invoked automatically. It is also the form that carries a guarantee, because
resolving a page destination runs `Helper.ensurePageHasCallback` first.

<Warning>
  `Helper.ensurePageHasCallback` throws when a page destination does not define
  `handleCallbackQueryData`, naming the page and the method to add. A button
  pointing at a page with no callback handler would tap through to nothing, so the
  framework refuses to build the keyboard rather than shipping a dead button.
</Warning>

The remaining parameters match the template-backed builders: the second is the
column layout (`1` by default), the third is the `<g-base id>` to resolve, and the
fourth is interpolation data. [Templates](/concepts/templates) covers what those
bases contain.

## Handlers are named, not registered

A handler is a method whose name says what it handles. Nothing registers it;
`_pageSorts` reads the prototype once at boot and files each name into a table.

| Handler | Fires on |
| :------ | :-------- |
| `handleText` / `handleArgsText` | a plain text message matching `data.intentText` and its `lang` variants |
| `handleCommandText` / `handleCommandArgsText` | a `/command` matching `data.intentCommandText` |
| `handleCallbackQueryData` / `handleArgsCallbackQueryData` | a callback query matching `data.intentCallbackQueryData` |
| `handleCaptionPhoto` / `handleCommandCaptionPhoto` and the rest of the media kinds | a caption on that media kind |
| `handleFree*` | any update of that kind, whatever the intent (dynamic route) |
| `handleSession*` | the update the armed session points at |
| `handleChatMember*` / `handleMyChatMember*` | a status transition, e.g. `handleMyChatMemberOutAdmin` |
| `handleFree()` | the last-resort fallback, run for every page that defines it |

Three rules about the name:

`Args` and the presence of a `/command` in the input are **independent**.
`handleArgsText` is text with no command, and `/cmd <args>` is
`handleCommandArgsText`. Both are on the same input format and they are different
methods.

The no-`Args` names match the raw payload exactly; the `Args` names match the
segment before the separator, also by exact lookup, so `handleArgsText` still
catches `start counter` because the head is `start`.

`handleCallbackQueryData` is the handler that makes `this.callbackQueryDataArg`
and `this.callbackQueryDataArgs` meaningful, which is also why `renderText`
behaves differently on that path. See [the render
contract](/concepts/render-contract).

### Reading the input

Args come after the intent, and the singular getters return the first token.

| Getter | Returns |
| :----- | :------ |
| `this.msg?.text` | `string \| undefined`: always optional-chain, because a caption update carries no text |
| `this.msgTextArg` / `this.msgTextArgs` | the first token / all tokens after the text intent |
| `this.msgTextCommandArg` / `this.msgTextCommandArgs` | the same for a command payload |
| `this.msgCaptionArg` / `this.msgCaptionArgs` | the same for captions |
| `this.msgCommandCaptionArg` / `this.msgCommandCaptionArgs` | the same for a command carried on a caption |
| `this.callbackQueryDataArg` / `this.callbackQueryDataArgs` | the first callback argument / all of them |

Text, commands and captions split on a space; callback data splits on a colon.
That split is the whole reason the two getter families exist and never mix.

## A page, end to end

The counter page from `example/1-complex`, reduced to the parts this page covers.
The `cacheData` and `kbl` fields belong to that example's own base class, not to
the framework.

```ts
// example/1-complex/src/pages/start/counter/index.ts
import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

export class StartCounterPage extends PageBase {
  static data = this.buildData((exe?: string) => [exe])

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  async handleArgsCallbackQueryData() {
    await this.gdefault.process()
  }

  helper = {
    counterKeyboard: () => this.inlineKeyboardT([this.data.callbackQueryData(`I`), this.data.callbackQueryData(`D`), StartPage], `2`)
  }

  gdefault = {
    show: async () => {
      const key = `${this.from!.id}`
      const count = (await this.cacheData.get(key)) || `0`
      await this.renderText({keyboard: this.helper.counterKeyboard(), data: {count}})
    },
    process: async () => {
      const exe = this.callbackQueryDataArg
      await this.renderText({keyboard: this.helper.counterKeyboard(), data: {exe}})
    }
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">Increase, Decrease, ${this.kbl.back.default}</g-keyboard>
      <g-message>Counter: {{count}}</g-message>
    </g-base>
  `
}
```

Trace one tap of the first button. The template supplies the label, the keyboard
array supplies `start/counter:I`, routing finds the page, and `handleArgsCallbackQueryData`
runs. Nothing about that path was registered anywhere.

## Where to go next

<Columns cols={2}>
  <Card title="Routing" icon="route" href="/guides/routing">
    How an update walks the tables and reaches one of these handlers.
  </Card>
  <Card title="Page routing" icon="map" href="/concepts/page-routing">
    The file-path rules this page assumes.
  </Card>
  <Card title="The render contract" icon="shapes" href="/concepts/render-contract">
    What `renderText` does with a route, and why the wrong key is a compile error.
  </Card>
  <Card title="Templates" icon="code" href="/concepts/templates">
    The block vocabulary behind `static template`.
  </Card>
  <Card title="Configuration reference" icon="settings" href="/guides/configuration">
    The config fields a page depends on, including `optionsPage`.
  </Card>
  <Card title="Example bots" icon="boxes" href="/guides/examples">
    Runnable bots to read the shapes above in place.
  </Card>
</Columns>
