---
title: The render contract
description: Why render params are a union over delivery routes, and what that buys you.
---

# The render contract

Most frameworks hand you `sendMessage` and leave the send-versus-edit decision
to you, at every call site, forever. gramstax inverts that: you name the
*content*, you name the *route*, and the framework derives which Bot API method
that implies.

## Content and route, not options

A render call takes one flat object. The keys fall into two groups:

**Content** — what the message says. Handled by the `static template` block, so
it is never a string in an API call.

**Route** — how it gets there. This is the part with the type.

```ts
this.renderText({args: [`Saved.`]})
this.renderText({mode: `edit`, options: {parse_mode: `HTML`}})
this.renderText({broadcast: {chatIds}, args: [`Deploy finished.`]})
```

## The thirteen route atoms

`renderText` defaults to `auto`, which edits the message a callback query is
attached to and replies otherwise. Everything else is explicit. The route
vocabulary is written once, as thirteen atoms, and every `render*()` params type
is a union over the subset that method can actually take:

`IRouteAuto` · `IRouteReply` · `IRouteEdit` · `IRouteChunked` ·
`IRouteBroadcastSend` · `IRouteForcedReply` · `IRouteMediaAuto` ·
`IRouteMediaReply` · `IRouteMediaBroadcastSend` · `IRouteMediaBroadcastRevise` ·
`IRouteGroupAuto` · `IRouteGroupReply`

You never name these — they are what your call site narrows to.

## Why a field that would be ignored is a compile error

Each union member declares all ten universal keys. Where the route reads a key,
it is a real type. Where the route does not read it, it is `?: never`.

That is what makes this:

```ts
// does not compile
this.renderText({mode: `reply`, fallback: `reply`})
```

A forced reply never edits an existing message, so a fallback has nothing to
fall back *from*. Under a plain options bag this would be accepted and silently
dropped — which is the bug class this design exists to remove.

## `?: never` is load-bearing, not cosmetic

This is worth stating plainly because it is easy to get wrong. TypeScript's
excess-property check treats a property as *known* when **any** member of the
union declares it. Simply omitting an unread key from one member would let it
through:

```ts
// NOT enough — this still typechecks
type Bad = {mode: `reply`; args: string[]} | {mode: `edit`; editOptions: X; args: string[]}
this.renderText({mode: `reply`, fallback: `reply`})   // still accepted
```

Only `never` converts "silently ignored" into a compile error:

```ts
type Good = {mode: `reply`; fallback?: never; args: string[]} | {mode: `edit`; fallback?: never; editOptions: X; args: string[]}
this.renderText({mode: `reply`, fallback: `reply`})   // error
```

## Plain JavaScript callers

`never` disappears at runtime, so `Ctx._assertRenderRoute` enforces the same
combinations before any API call for callers who are not typechecked. Same rule,
both sides.

## One field per Bot API call

Each call has exactly one options field, named for the Telegram parameter it maps
to — `options`, `editOptions`, `fallbackOptions`, `captionOptions`, `media`,
`mediaOptions`, `resendOptions`. There is no bag you have to satisfy for two
Telegram methods at once.

The same care narrows `keyboard`: it is typed `IInBoKb` where the call is
always an edit, because an edit can only carry an inline or bottom keyboard —
and stays the wider type on media, where a delete-and-resend is a send.

## Media is a different shape

`renderMedia` takes `media`, not `args`, because a media send has no text to
merge. Media groups have their own method, `renderMediaGroup`, which takes no
reply markup at all — the Bot API has nowhere to put it.

Every `render*()` JSDoc names the template block it reads, so hovering the method
in an editor tells you which block to fill in.