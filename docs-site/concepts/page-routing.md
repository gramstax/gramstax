---
title: Page routing
description: How a file under src/pages becomes a route, and how handlers bind to it.
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
`admin/ban.ts` works at any depth because the scanner walks the tree.

One rule: a root-level `src/pages/index.ts` has no parent route and is rejected
rather than silently swallowing the whole tree.

<Note>
  This is deliberate. A stray root `index.ts` is the natural place to put shared
  code, and the failure mode of allowing it (every route resolving to the same
  page) is invisible until someone deploys.
</Note>

## The page class

The scanner takes the **first named export** as the page class. There are no
default exports in this framework, so a class you forget to export is a page that
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
| `handleFree*()` | the same shapes, outside a session | `routeDynamic` |

The `Args` in the name and the `/cmd` in the input are **independent**. That is
the part most get wrong: `handleArgsText` is *not* `/cmd <args>`. Args without a
command is `handleArgsText`; `/cmd <args>` is `handleCommandArgsText`.

<Note>
  The `Args*` variants resolve by `startsWith` after the separator rather than by
  exact match, so `handleArgsText` also catches longer inputs. The no-`Args`
  variants are exact-match.
</Note>

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

A guard is a base class whose method returns a value to proceed, or something
falsy to stop. The scaffold puts one at `src/guards/user.ts`.

```ts
export class UserGuard extends GuardBase {
  check() {
    return this.from ? true : undefined
  }
}
```

Because it is a class rather than a call, a whole family of routes can be gated by
extending it once. See [Guards](/guides/getting-started) for the shape the
scaffold writes.

## Page context

Every handler runs with a `Ctx` already built: `this.from`, `this.chat`,
`this.callbackQueryData`, `this.renderText`, `this.setSession`, `this.reply*`.
You never construct one, and you never pass the update along by hand.