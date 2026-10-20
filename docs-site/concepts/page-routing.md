---
title: Page routing
description: How a file under src/pages becomes a route, and how handlers bind to it.
icon: map
---

# Page routing

gramstax has no router. There is nothing to register, and therefore nothing that
can fall out of sync with the tree.

## The route is the path

A file under `src/pages` *is* its route:

| File | Route |
| --- | --- |
| `src/pages/start.ts` | `start` |
| `src/pages/start/index.ts` | `start` |
| `src/pages/start/random/number.ts` | `start/random/number` |
| `src/pages/admin/ban.ts` | `admin/ban` |

Depth is not a convention you have to remember. It is the directory nesting.
`src/pages/admin/ban.ts` works at any depth because the scanner walks the tree.

One rule: a root-level `src/pages/index.ts` has no parent route and is rejected
rather than silently swallowing the whole tree.

<Note>
  This is deliberate. A stray root `index.ts` is the natural place to put shared
  code, and the failure mode of allowing it (every route resolving to the same
  page) is invisible until someone deploys.
</Note>

<Frame caption="The scanner walks `src/pages` and takes the route name from the path. There is no table to add a row to.">
  <img
    src="/images/routing.svg"
    alt="Four files under src/pages on the left, each joined by an arrow to the route name it resolves to on the right. start.ts and start/index.ts both resolve to start, start/random/number.ts resolves to start/random/number, and admin/ban.ts resolves to admin/ban."
  />
</Frame>

## The page class

The scanner takes the **first value the module exports** as the page class, and
it does not filter out a default export, so a module whose only export is a
default still loads. The moment a second export appears, the loaded value is
whichever one the namespace sorts first, which is why every page declares
exactly one named export. A module that exports nothing at all is a page that
does not exist, and you find out at boot, not at runtime in production.

```ts
import {PageBase} from "../../src/base/page"

export class Hi extends PageBase {
  static template = `<g-message>Hi.</g-message>`
}
```

Extend `PageBase` (or `PageAdminBase` from the scaffold) to inherit the render,
session and reply helpers.

## Handlers bind by convention

You do not register handlers. You name methods, and the naming says what they
handle. The name is assembled in a fixed order (`handle` · `Session`/`Free` ·
`Command` · `Caption` · `Args` · kind), and each piece changes which route table
the method lands in.

| Method | Fires on | Route table |
| --- | --- | --- |
| `handleText()` | plain text matching `intentText` | `routeStatic` |
| `handleCommandText()` | `/cmd`: command, **no** args | `routeStatic` |
| `handleArgsText()` | `<args>`: args **without** a command | `routeStaticIntent` |
| `handleCommandArgsText()` | `/cmd <args>`: command **with** args | `routeStaticIntent` |
| `handleCallbackQueryData()` | a callback query, exact match | `routeStatic` |
| `handleArgsCallbackQueryData()` | a callback query with args | `routeStaticIntent` |
| `handleCaption*()` | a media caption | `routeStatic` |
| `handleCaptionArgs*()` | a media caption with args | `routeStaticIntent` |
| `handleCommandCaption*()` | `/cmd` on a media caption | `routeStatic` |
| `handleCommandCaptionArgs*()` | `/cmd <args>` on a media caption | `routeStaticIntent` |
| `handleSession*()` | the matching session step | `routeStaticSession` |
| `handleFree*()` | the same shapes, outside a session | `routeDynamicSpesific` |

`routeDynamicSpesific` is where the `handleFree*` shapes land. `routeDynamic` is
the other table, and it holds the global `handleFree()` fallback.

The `Args` in the name and the `/cmd` in the input are **independent**. That is
the part most get wrong: `handleArgsText` is *not* `/cmd <args>`. Args without a
command is `handleArgsText`; `/cmd <args>` is `handleCommandArgsText`.

<Note>
  The `Args*` variants do not use `startsWith`. The payload is split on the
  separator first and the head is looked up exactly in the intent table, with
  `lang:`-prefixed fallbacks for text. So `handleArgsText` still catches
  `start counter` because the head is `start`, not because the intent is a
  prefix of the payload. The no-`Args` variants are exact-match too, on the raw
  payload.
</Note>

<Frame caption="The name decides the table. `Args` moves a handler into `routeStaticIntent`, `Session` into `routeStaticSession`, and `Free` into `routeDynamic`.">
  <img
    src="/images/handler-tables.svg"
    alt="Four columns, one per route table. routeStatic holds the handleText, handleCommandText, handleCallbackQueryData, handleCaption and handleCommandCaption shapes and resolves them by exact match. routeStaticIntent holds the Args variants of the same shapes and resolves them by an exact lookup of the segment before the separator. routeStaticSession holds the handleSession shapes, and routeDynamic the handleFree shapes."
  />
</Frame>

The `handle*` / `handleSession*` / `handleFree*` split is not decoration. A
session step and a free-form message reach the page by different paths, and the
framework refuses to guess which one you meant.

`handleCallbackQueryData` is where `this.callbackQueryData` becomes available,
which is also why `renderText` behaves differently on that path. See
[the render contract](/concepts/render-contract).

## Naming a method is registering it

This is the part worth internalising. There is no central table of pages and no
central table of handlers. Adding a page cannot break an unrelated page, because
the only thing it touches is its own file.

The cost is that you cannot enumerate handlers at runtime to build a menu. But
in exchange, deleting a page is `rm`, and no stale registration survives to fire
against a user.

## Guards

A guard is project code, not framework API, which is worth knowing before you go
looking for `GuardBase` in the package. The scaffold writes a small `Ctx` subclass
to `src/base/guard.ts` and the guard itself to `src/guards/user.ts`:

```ts
export class UserGuard extends GuardBase {
  async ensureUsername() {
    if (!this.from?.username || this.from.username.length === 0) return null
    return {status: true}
  }
}
```

Calling it is your job. Nothing routes to a guard, and extending one gates
nothing: the framework only gates on `hookBeforeRoute`, whether on a page base
class or on your `Gramstax` subclass. What the class buys you is the context
plumbing, since a guard receives a context it did not build and can render with
it. See [Guards](/guides/guards) for the three levels side by side.

## Page context

Every handler runs with a `Ctx` already built: `this.from`, `this.chat`,
`this.callbackQueryData`, `this.renderText`, `this.setSession`, `this.reply*`.
You never construct one, and you never pass the update along by hand.