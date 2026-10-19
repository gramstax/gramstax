---
title: Guards
description: The three places a check can live, the strict-false rule that decides allow from deny, and why a denial is silent unless you make it speak.
icon: shield
---

# Guards

A guard is a check that runs before a handler does. Gramstax has three places to
put one, and they differ in more than scope: they get different arguments, they
run at different points in the dispatch, and they are counted differently. Getting
that wrong is how an admin route stays open, or how a deny turns into a dead
button.

This page is about those three gates and the exact rule each one tests. How an
update reaches the point where a gate is consulted is [routing at
runtime](/guides/routing); what a page looks like once it is reached is
[pages](/guides/pages).

## The three levels

<Tabs>
  <Tab title="Page family">

A `hookBeforeRoute()` on a base class that a whole folder of pages extends. The
framework calls it on every matched route, so a new page cannot opt out by
forgetting to repeat the check.

```ts
// src/base/page-admin.ts
export abstract class PageAdminBase extends PageBase {
  async hookBeforeRoute() {
    if (AdminGuard.isAdmin(this)) return true
    await this.renderCallbackAnswer({showAlert: true, AGBaseId: Base.denied})
    return false
  }
}
```

  </Tab>
  <Tab title="One handler">

A small class you call from inside a handler or a step, whose method returns a
value you branch on. Nothing is automatic; the check runs exactly where you put
the call.

```ts
// src/guards/user.ts
export class UserGuard extends GuardBase {
  async overrideLang() {
    const lang = await this.cacheData.get(`${this.from!.id}:lang`)
    if (lang) {
      this.from!.language_code = lang as string
    }
    return true
  }
}
```

  </Tab>
  <Tab title="Whole bot">

`BotCore.hookBeforeRoute(ctx, data)`, on the `Gramstax` subclass in
`src/core/bot.ts`. It runs once per update, before routing, for every listener.

```ts
// src/core/bot.ts
export class BotCore extends Gramstax {
  async hookBeforeRoute(ctx: CtxCore) {
    const user = await new UserGuard(ctx).overrideLang()
    return user !== null
  }
}
```

  </Tab>
</Tabs>

| You want | Use | Signature |
| :------ | :-- | :-------- |
| every route in a page family gated | `hookBeforeRoute()` on a base class | `(): Promise<boolean>`, no arguments |
| one check inside one handler or step | a guard class whose method you call | yours |
| every route in the whole bot gated | `BotCore.hookBeforeRoute(ctx, data)` | `(ctx, data?: {listenerName, isEdit}) => Promise<boolean>` |

<Note>
  `GuardBase` is not framework API. It is a small class that eight of the eleven
  examples carry at `src/base/guard.ts`; `3-helloworld-js` carries the same class
  as `guard.js`, and `8-newsletter` and `9-substore-bot` have no copy. Its whole
  job is to take an already-constructed context and stash the page data somewhere
  a guard can read it, since a guard is not a page and has no `static data` of its
  own:

```ts
// example/1-complex/src/base/guard.ts
export abstract class GuardBase extends CtxCore {
  constructor(ctx: CtxCore) {
    super(ctx)
    if (ctx?.data) {
      // save as temporary because guard should not save this.data or class.data
      // because it is intended for Page only.
      this.temp.data = ctx.data
    }
  }
}
```

  Copy it, rename it, or skip it. What matters is the shape: a guard receives a
  context it did not construct, so it renders with that context rather than
  creating its own.

  One more thing the sample relies on: `cacheData` is `example/1-complex`'s own
  field, added by that project's `CtxCore`. `Ctx` does not have it, and the bare
  scaffold's `CtxCore` is empty, so copy the pattern rather than the field.
</Note>

## The rule is strict `false`

Both automatic gates test the same thing, and neither is a truthiness check. At
every one of the five page-level call sites in `_pageRoutes` the test is:

```ts
if ((await initPage.hookBeforeRoute?.()) !== false) {
  // run the handler
}
return {state: `blocked`}
```

And `_handleCtx` runs the bot-level gate as:

```ts
const before = await this.hookBeforeRoute?.(ctx, {listenerName, isEdit})
if (before === false) {
  this.metrics.counts.blocked += 1
  return
}
```

`!== false` and `=== false` are the same predicate written from the two sides, and
the rule that falls out of both is: **only the boolean `false` denies.**

| Return value | Result |
| :------------ | :----- |
| `false` | denied |
| `true` | allowed |
| `undefined` | allowed |
| `null` | allowed |
| `0` | allowed |
| `""` | allowed |
| hook not defined at all | allowed, `?.()` yields `undefined` |

Read that table before writing a guard. An optional-chaining mistake that returns
`undefined`, a `find` that returns nothing, or a guard that falls off the end of a
function without a `return` all allow the update through, silently. This is the
single most likely way an admin gate ships open.

<Warning>
  The same strictness is what makes an inherited gate composable. A base class
  that always returns `true` is a neutral gate, so a subclass can return a real
  value without having to call anything to keep the parent happy. The flip side is
  that a subclass that forgets its `return` also inherits "allow", which is the
  failure mode above wearing a different hat.
</Warning>

## Denying is silent

Neither gate sends anything on your behalf. Returning `false` stops the handler;
it does not answer the user.

That matters most for a callback query. Telegram holds a tapped inline button in
its loading state until the callback is answered, so if the handler never runs
there is no `answerCallbackQuery` to settle it. The button sits there until it
times out, and the user has no idea whether the bot is broken or refusing.

So a deny that means anything to the user has to say something:

```ts
// on a callback route
await this.renderCallbackAnswer({showAlert: true, AGBaseId: Base.denied})
return false
```

`renderCallbackAnswer` takes the notification text from a `<g-callback-answer>`
block, so the refusal is localizable and lives with the rest of the page markup.
`showAlert: true` makes it a modal alert rather than a toast. On a text route the
equivalent is any `render*` call, or nothing at all if the silence is the intent.

## What the page-level gate can still do

`Ctx.hookBeforeRoute` is a full context method, not a predicate. Returning `false`
skips **only the target route handler**; it does not freeze the page. Inside the
hook you can still call `renderText`, `renderCallbackAnswer` and every other
method, which is exactly what the deny pattern above relies on.

The TSDoc on the hook names three uses directly:

| Use | Shape |
| :--- | :---- |
| per-page cooldown | check a timestamp, answer "please wait", return `false` |
| precondition | send a redirect page, return `false` |
| session validity | return `false` when the armed session is the wrong one |

## Overriding replaces, not adds

A page that defines `hookBeforeRoute` replaces whatever it inherited. It does not
chain. If you want both, say so:

```ts
export class BroadcastPage extends PageAdminBase {
  async hookBeforeRoute() {
    return (await super.hookBeforeRoute!()) && (await this.checkQuota())
  }
}
```

The `&&` short-circuits, which is usually what you want: if the parent already
denied, the quota check does not run either.

One typing detail, for when you call `super` from a class whose base does not
define the hook. The declaration on `Ctx` is optional
(`async hookBeforeRoute?(): Promise<boolean>`), so reaching it through a base that
did not implement it needs the non-null assertion. `PageAdminBase` above does
implement it, so a subclass of that one calls `super.hookBeforeRoute()` directly.

The same method name on the bot class is a **different** gate, not a parent of the
page one. `Gramstax.hookBeforeRoute` runs once, before routing, for every update
from every listener. `Ctx.hookBeforeRoute` runs once per constructed page, after
routing has picked a page and a method. They do not compose, and one never stands
in for the other.

## Where each gate is consulted

The page-level gate is not consulted in a single place. `_pageRoutes` has seven
ids and the gate appears at five of them, and the consequence of a deny is not the
same at each:

| Id | Route family | On deny |
| :- | :----------- | :------ |
| 0 | chat member status | returns `{state: "blocked"}` immediately |
| 1 | static session | the main run site, same early return |
| 2 | static (exact intent) | the main run site |
| 3 | static intent (prefix) | the main run site |
| 4 | `handleFree*` specific | skips that handler and continues the loop |
| 5 | `handleFree` global | skips that handler and continues the loop |
| 6 | custom routes | returns `{state: "blocked"}` immediately |

The difference at ids 4 and 5 is the one to internalise. Those ids are loops over
several pages, so a deny there means "this page declines, keep asking the rest".
A gated page that returns `false` from `handleFree` does not set the `blocked`
state and does not stop the loop. If you need a hard stop, gate it at the bot
level.

The bot-level gate is consulted once, in `_handleCtx`, before `_pageRoutes` runs
at all. A deny there means no page is constructed and no routing table is walked.

## Counting

Denials are counted, and the two gates count differently.

The bot-level gate increments `metrics.counts.blocked` directly on a deny. The
page-level gate does not: it returns `{state: "blocked"}`, and the outcome counter
table in `_handleCtx` only maps `matched`, `no-match` and `no-handler`, so a
page-level block increments none of them.

| Deny | `counts.blocked` | A routing outcome counter | `hookAfterRoute` fires |
| :---- | :--------------- | :----------------------- | :--------------------- |
| bot-level `hookBeforeRoute` | +1 | no | **no**, `_handleCtx` returns before it |
| page-level `hookBeforeRoute` | no | no | yes, with `state: "blocked"` |
| session-lock contention, `skip` mode | +1 | no | no, the update never reaches routing |

So `gramstax_updates_blocked_total` on `/metrics` counts two things: bot-level
denials, and updates dropped because a contended session lock was in `skip` mode.
Page-level denials are visible only through `hookAfterRoute`, where `data.state`
is `"blocked"`. Zero-valued counters are skipped from the Prometheus exposition,
so a counter at zero is absent from the scrape rather than printed as `0`.

If you want a page-level denial on the dashboard, record it yourself in
`hookAfterRoute`:

```ts
async hookAfterRoute(ctx: CtxCore, data: NonNullable<Parameters<NonNullable<Gramstax[`hookAfterRoute`]>>[1]>) {
  if (data.state === `blocked`) {
    this.log?.warn?.(`blocked ${data.listenerName}`)
  }
}
```

## Throwing from a gate

A throw is not a denial. Both gates run inside `_handleCtx`'s try block, so a
throw from either becomes the `error` state and is routed to `hookErrorPage`, and
`counts.updatesFailed` goes up. Routing itself never runs.

That is the right behaviour for a guard whose database is down, and it is a
behaviour change worth knowing: a guard that throws stops the bot, a guard that
fails closed stops the user. Decide which you mean. A guard that catches, answers,
and returns `false` gives the user an answer; one that lets the throw escape gives
you a page instead.

## Where to go next

<Columns cols={2}>
  <Card title="Routing" icon="route" href="/guides/routing">
    The seven ids, the four outcomes including `blocked`, and the dispatch shape
    this page quotes.
  </Card>
  <Card title="Pages" icon="file-code" href="/guides/pages">
    Handler naming and the `static data` a page-level guard can read.
  </Card>
  <Card title="The render contract" icon="shapes" href="/concepts/render-contract">
    The other render methods, including the six answer methods that take their text
    from a template block.
  </Card>
  <Card title="Sessions" icon="clock" href="/guides/sessions">
    Session validity is one of the three uses a page-level gate is written for.
  </Card>
  <Card title="Configuration" icon="settings" href="/guides/configuration">
    `rateLimit` and `throttle`, the two guards that are configuration rather than
    code.
  </Card>
  <Card title="Extending" icon="puzzle" href="/concepts/extending">
    Where a guard class, a shared keyboard block and a `CtxCore` subclass belong.
  </Card>
</Columns>