---
title: Sessions
description: The cache entry that parks a user in a step, the shorthand setters, the auto-clear rule, and how one payload can own several handlers at once.
icon: clock
---

# Sessions

A session is one cache entry that names which `handleSession*` method owns the
next update from a particular user in a particular chat. Arming it is one call, and
it changes nothing about how the page renders. What it changes is who receives the
next thing the user sends.

This page is about the mechanism. How an update reaches a session route rather
than a normal one is [routing at runtime](/guides/routing); how a file becomes a
route name is [page routing](/concepts/page-routing). One instance running many
instances of the same bot needs a lease around the whole dispatch, which is a
different subject covered by [the session lock](/guides/session-lock).

## The key

`Ctx.sessionKey()` builds it, and it is deliberately two segments:

```ts
const userId = this.from?.id
const chatId = this.chat?.id
if (userId === undefined || userId === null) return `:${chatId ?? ``}`
return `${userId}:${chatId ?? ``}`
```

The user id and the chat id both matter. A private chat and a group are separate
worlds: the same person typing a city name in a DM is at step one of the flow,
while the same person typing the same thing in a group chat is not the same
pending state, and one key must not overwrite the other.

The two degenerate cases are also handled rather than thrown. An update with no
chat id produces a trailing empty segment, so private chats still key on the user
alone. An update with no user id, such as a channel post or an anonymous admin,
degrades to `` `:${chatId}` ``, which still scopes by chat instead of collapsing
every userless update in that chat into one shared bucket.

<Note>
  This is the same `sessionKey()` that [the session
  lock](/guides/session-lock#where-the-lock-sits) locks by default, and it is not
  the whole cache key. `setSession`, `getSession` and `clearSession` all call the
  store with exactly this string, and the `namespace` you set on `cacheSession`
  prefixes it at the store layer.
</Note>

## What gets stored

`setSession` writes one object, and the shape is `ICacheRpc`:

| Field | Type | Written from |
| :---- | :--- | :----------- |
| `method` | `string \| string[]` | the `methodSession*()` key, or an array of them |
| `params` | `Record<string, unknown>` | the second argument, the payload you pass |
| *any other key* | `unknown` | the third argument, `moreRoot`, merged at the root |

```ts
async setSession(method: string | string[], params?: Record<string, unknown>, moreRoot?: Record<string, unknown>) {
  const id = this.sessionKey()
  const value = {method, params, ...moreRoot}
  const result = await this.cacheSession.set(`${id}`, value)
  // ...
}
```

Two things follow from that literal. `params` is always present as a key, holding
`undefined` when you pass nothing, which is why a reader destructure needs a
fallback. And `moreRoot` lands beside `method` and `params`, not inside `params`,
so anything put there is on the session record itself.

`method` is not a handler name. `Ctx.methodSession(prefix, name)` returns
`` `${prefix}-${name || this.data.name}` ``, where the prefix is the position of
that route in the session route list and the name is the page's own `data.name`.
The full set is one numbered pair per handler, and the first seven are the ones
you will meet first:

| `methodSession…` | Prefix | Armed by |
| :-------------- | :----- | :------- |
| `methodSessionCallbackQueryData` | `"1"` | `setSessionCallbackQueryData` |
| `methodSessionArgsCallbackQueryData` | `"2"` | `setSessionArgsCallbackQueryData` |
| `methodSessionText` | `"3"` | `setSessionText` |
| `methodSessionArgsText` | `"4"` | `setSessionArgsText` |
| `methodSessionCommandText` | `"5"` | `setSessionCommandText` |
| `methodSessionCommandArgsText` | `"6"` | `setSessionCommandArgsText` |
| `methodSessionFreeText` | `"7"` | `setSessionFreeText` |

The numbering continues past seven for the caption, media and event shapes, one
pair per `handleSession*` name. This is why `methodSession(prefix, name)` takes
the prefix as an argument: the builders are generated from one list, and the
number is the list position. Never hand-write one of these strings. The source
comment on `methodSession` is blunt about it: a literal like `"7-PageName"`
depends on listener order, and the helpers exist so it does not have to.

## Arming it

The shorthand setters are the ones to use. Each is exactly two lines:

```ts
setSessionFreeText(this: Ctx & {handleSessionFreeText: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
  return this.setSession(this.methodSessionFreeText(), params)
}
```

There is one per session route, so `setSessionFreePhoto`, `setSessionFreeVideo`,
`setSessionCallbackQueryData`, `setSessionCommandText` and the rest all exist. The
`this` annotation is the type-safety: a page that does not define
`handleSessionFreeText` does not get `setSessionFreeText` either, so you cannot
arm a route that nothing will receive.

The whole page, from
[the example bot](https://github.com/gramstax/gramstax/tree/main/example/1-complex/src/pages/start/input/text):

```ts
export class StartInputTextPage extends PageBase {
  static data = this.buildData({intentCommandText: `input_text`})

  async handleCommandText() {
    await this.gindex.show()
  }

  async handleSessionFreeText() {
    const {step} = this.temp.session.params ?? {}
    if (step === Base.index) {
      await this.gindex.process()
    }
  }

  helper = {
    homeKeyboard: (AGBaseId?: string) => this.inlineKeyboardT([StartPage], `1`, AGBaseId)
  }
  gindex = {
    show: async () => {
      await this.setSessionFreeText({step: Base.index})
      await this.renderText({AGBaseId: Base.index, keyboard: this.helper.homeKeyboard(Base.index)})
    },
    process: async () => {
      await this.gsuccess.show()
    }
  }
  gsuccess = {
    show: async () => {
      await this.renderText({AGBaseId: Base.success, keyboard: this.helper.homeKeyboard(Base.success), data: {res: this.msg?.text}})
    },
    process: () => {}
  }
}
```

`/input_text` arms the session and shows the prompt. The next plain text message
from that user lands in `handleSessionFreeText` instead of anywhere else, and
`step` tells the handler which step of the flow that message belongs to.

## Reading it

Read `this.temp.session`. It is declared on `ITemp` as `Partial<ICacheRpc>`, so
every field is optional and `params` is `Record<string, unknown> | undefined`,
which is where the `?? {}` in the example above comes from.

| Read | Type |
| :--- | :--- |
| `this.temp.session.params` | your payload, or `undefined` |
| `this.temp.session.method` | the key that was armed, or an array of them |
| anything else you wrote | whatever `moreRoot` merged in |

The framework populates it before your handler runs. It does that by calling
`ctx.getSession()` during routing, the id 1 step, and `getSession` assigns the
result to `this.temp.session` as a side effect. So by the time `handleSessionFreeText`
is entered, the session is already on the context and no extra read is needed.

<Note>
  If you do reach for `getSession()` inside a handler, it is memoized rather than
  re-read. `memoization.sessionLoaded` flips to `true` on the first read and
  `sessionValue` holds the payload, so the second call returns the same value with
  no further cache round trip. `setSession` and `clearSession` update the same
  memo, so a write followed by a read inside one update cannot disagree.
</Note>

`getSession()`, `setSession` and `clearSession` all return the store result, and
all three swallow exceptions and return `null` instead. A session store that is
down degrades to "no session", which means the flow does not start rather than the
update throwing.

## Why the session route wins

Session routing is id 1, ahead of the exact-match and prefix-match tables at ids 2
and 3. It looks the method up in `routeStaticSession`, bucketed per listener, and
only then constructs the page.

That ordering is the whole point of arming a session. `handleText`,
`handleCommandText` and `handleCallbackQueryData` on other pages would otherwise
swallow the very message the user is being asked for. Because id 1 runs first and
returns as soon as it matches, the flow gets the update and nothing else sees it.

The per-listener bucketing is the second half. An armed session for
`handleSessionFreeText` only collects text updates; a photo sent in the middle of
the flow does not land in that handler. What it does instead is covered next.

## Four behaviours worth knowing

### Non-session routes clear the session, once

Before any non-session handler runs, the framework clears a pending session. The
rule is interruption cancels the pending flow: if the user taps a button, types a
command, or sends free text that a real route claims, the half-finished wizard is
gone rather than left armed under the next update.

`_clearSessionOnNonSession` is the implementation, and its guards are worth
reading:

| Guard | Effect |
| :----- | :----- |
| `if (!this.pages.hasSessionRoutes) return` | an app with no session handlers anywhere never pays a cache read |
| `if (await ctx.getSession())` | the read is memoized, so at most one external read per update |
| `await ctx.clearSession()` | the write only happens when a session actually existed |

The clear runs **at most once per dispatch**, not once per handler-loop
iteration. A `handleFree*` loop can visit several pages, and the first one that
passes its gate does the clearing; the rest see `sessionClearDone` already set.

Session routes never auto-clear. Routing id 1 does not call the clear at all,
which is what lets a multi-step flow survive from one update to the next.

### Read the context, not the store

Covered above: `this.temp.session` is populated for you, and `getSession()` is
memoized on top of that. Neither is a second source of truth.

### Clear it explicitly when you mean to

`clearSession()` is the deliberate reset. The place for it is the top of a command
handler that starts a fresh flow, because `/start` arriving mid-wizard is the one
case auto-clear has not already handled:

```ts
async handleCommandText() {
  await this.clearSession()
  await this.gindex.show()
}
```

It deletes the key, sets `this.temp.session = {}`, and marks the memo loaded with
`null`, so a later `getSession()` in the same update returns `null` without
touching the store again. It returns `null` when the update carries neither a user
id nor a chat id, since there is no key to delete.

### `setSession([...])` for multi-input

One payload can own several handlers at once. Pass an array of `methodSession*()`
keys and routing tries each in turn:

```ts
await this.setSession(
  [this.methodSessionFreeVideo(), this.methodSessionFreeText()],
  {position: `form`}
)
```

The stored `method` is then a `string[]`, and the id 1 lookup normalises it with
`Array.isArray(mtd) ? mtd : [mtd]` before searching `routeStaticSession`. A form
that accepts either a video or a typed line arms both handlers and reads the same
`params.position` in either one.

`setSession` itself is marked low-level for exactly these two cases: a multi-input
binding, and a method name computed at runtime where `methodSession*()` cannot be
called at all. Everything else should go through the shorthand.

## Expiry

A session is a cache entry, so it expires on the store's terms. `cacheSession`
takes `ttlMs`, and that value is how long an abandoned wizard can sit armed:

```ts
const config: GramstaxConfig = {
  cacheSession: {
    store: process.env.CACHE_SESSION_STORE ?? `memory`,
    ttlMs: 4 * 60 * 60 * 1000,
    namespace: `s`
  }
}
```

The same entry also disappears when the store does. The default `memory` store is
a `Map` in the process, so a restart or a deploy leaves every user stateless. A
`redis://` store is shared across instances and survives one, which is what a flow
that must outlive a deploy needs. Set `ttlMs` to the length of your longest flow
and nothing longer. See [configuration](/guides/configuration) for the full
`cacheSession` reference.

## A flow without a session

Not every input mode needs one. A page with `handleFreeText` receives any text at
all, and a page with a `handleFree` receives anything nothing else claimed. Those
are the id 4 and id 5 passes of the same walk, they are stateless by construction,
and they never touch the cache. [Routing](/guides/routing#the-tables) covers when
to reach for which.

## Where to go next

<Columns cols={2}>
  <Card title="Routing" icon="route" href="/guides/routing">
    The seven ids in priority order, including why the session pass runs before
    exact match.
  </Card>
  <Card title="Pages" icon="file-code" href="/guides/pages">
    Handler naming, the `handleSession*` family, and the argument getters a session
    handler reads.
  </Card>
  <Card title="Keyboards" icon="keyboard" href="/guides/keyboards">
    The reply and inline keyboards that navigate a flow, and how they pair with the
    step objects above.
  </Card>
  <Card title="Session lock" icon="lock" href="/guides/session-lock">
    One user, several instances: the Redis lease that keeps two of them out of the
    same dispatch.
  </Card>
  <Card title="Configuration" icon="settings" href="/guides/configuration">
    `cacheSession`, its `ttlMs` and `namespace`, and every other boot field.
  </Card>
  <Card title="Concurrency" icon="layers" href="/concepts/concurrency">
    The per-chat gate inside the update queue, and how it relates to the lock above.
  </Card>
</Columns>