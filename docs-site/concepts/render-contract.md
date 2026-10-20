---
title: The render contract
description: Why render params are a union over delivery routes, and what that buys you.
icon: braces
---

# The render contract

Most frameworks hand you `sendMessage` and leave the send-versus-edit decision
to you, at every call site, forever. gramstax inverts that: you name the
*content*, you name the *route*, and the framework derives which Bot API method
that implies.

## Content and route, not options

A render call takes one flat object. The keys fall into two groups:

**Content**: what the message says. Handled by the `static template` block, so
it is never a string in an API call.

**Route**: how it gets there. This is the part with the type.

```ts
// auto: edit the message the callback came from, reply to anything else
this.renderText({data: {name: `Ada`}})

// forced send, with the keyboard this page's `g-keyboard` block declares
this.renderText({mode: `reply`, keyboard: this.inlineKeyboardT([this])})

// fan-out: the same block, one send per recipient id and language
this.renderText({
  data: {status: `done`},
  broadcast: {ids: [123456], languageCode: [`en`]}
})
```

## The twelve route atoms

`renderText` defaults to `auto`, which edits the message a callback query is
attached to and replies otherwise. Everything else is explicit. The route
vocabulary is written once, as twelve atoms, and every `render*()` params type
is a union over the subset that method can actually take:

`IRouteAuto` · `IRouteReply` · `IRouteEdit` · `IRouteChunked` ·
`IRouteBroadcastSend` · `IRouteForcedReply` · `IRouteMediaAuto` ·
`IRouteMediaReply` · `IRouteMediaBroadcastSend` · `IRouteMediaBroadcastRevise` ·
`IRouteGroupAuto` · `IRouteGroupReply`

<Frame caption="The twelve atoms grouped by the `render*()` method that can take them, and the rule that turns an unread key into a compile error.">
  <img
    src="/images/render-routes.svg"
    alt="Twelve route atoms in four columns, one column per render method family. renderText takes IRouteAuto, IRouteReply, IRouteEdit, IRouteChunked and IRouteBroadcastSend. renderMedia takes IRouteMediaAuto, IRouteMediaReply, IRouteMediaBroadcastSend and IRouteMediaBroadcastRevise. renderMediaGroup takes IRouteGroupAuto and IRouteGroupReply. The send-only render methods, including renderGift, renderInvoice, renderPaidMedia, renderVenue and renderDice, take IRouteForcedReply. Below the columns, two panels contrast a key the winning route reads, IRouteAuto.options typed IOptReply, against a key it never reads, IRouteReply.fallback typed never, ending with the call this.renderText({mode: reply, fallback: reply}) that fails to compile."
  />
</Frame>

You never name these. They are what your call site narrows to.

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
dropped, which is the bug class this design exists to remove.

## `?: never` is load-bearing, not cosmetic

This is easy to get wrong. TypeScript's
excess-property check treats a property as *known* when **any** member of the
union declares it. Simply omitting an unread key from one member would let it
through:

```ts
// NOT enough: this still typechecks
type Bad = {mode: `reply`; data: Record<string, unknown>} | {mode: `edit`; editOptions: X; data: Record<string, unknown>}
this.renderText({mode: `reply`, fallback: `reply`})   // still accepted
```

Only `never` converts "silently ignored" into a compile error:

```ts
type Good = {mode: `reply`; fallback?: never; data: Record<string, unknown>} | {mode: `edit`; fallback?: never; editOptions: X; data: Record<string, unknown>}
this.renderText({mode: `reply`, fallback: `reply`})   // error
```

## Plain JavaScript callers

`never` disappears at runtime, so `Ctx._assertRenderRoute` checks the same
combinations before the API call in `renderText`, `renderMedia` and
`renderMediaGroup`. The other `render*` methods rely on the type checker alone.

## One field per Bot API call

Each call has exactly one options bag for the Bot API method it maps to:
`options`, `editOptions`, `fallbackOptions`, `captionOptions`, `mediaOptions`
or `resendOptions`. There is no bag you have to satisfy for two Telegram methods
at once. `rich` and `richOptions` describe formatting and sit beside that bag;
`media` is the payload, not an options bag.

The same care narrows `keyboard`. A route that always edits types it as
`IInlineKb`, because `editMessageText` rejects a bottom keyboard. Send-capable
routes keep the wider `IInBoKb`.

## Media is a different shape

`renderMedia` takes `media` rather than a text block, because a media send has no
text to merge. Media groups have their own method, `renderMediaGroup`, which
takes no reply markup at all: the Bot API has nowhere to put it.

Every `render*()` JSDoc names the template block it reads, so hovering the method
in an editor tells you which block to fill in.