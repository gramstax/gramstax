---
title: Introduction
description: What gramstax is, what it removes, and who it is for.
icon: book
---

# gramstax

gramstax turns the remaining half of a Telegram bot (the part every project
reinvents) into a fixed shape.

A typical framework gives you `bot.command("start", …)` and a template literal.
What happens after that is yours: where markup lives, how a second language gets
added, whether a tap edits the message it came from or orphans it, how you prove
the bot called the Bot API the way you thought. Those get decided again, in every
file, by every project.

gramstax's answer is to decide once, in the type system and in the build.

<Columns cols={2}>
  <Card title="Quickstart" icon="rocket" href="/quickstart">
    A running bot in five minutes: scaffold, edit one page, run it.
  </Card>
  <Card title="The render contract" icon="shapes" href="/concepts/render-contract">
    Why a key the winning route would ignore is a compile error, not a silent drop.
  </Card>
  <Card title="Deploy" icon="server" href="/concepts/deploy">
    Polling, webhook, serverless, raw, test: one field selects the mode.
  </Card>
  <Card title="Configuration reference" icon="settings" href="/guides/configuration">
    Every `gramstax.config.ts` field. Twenty of them, all optional.
  </Card>
</Columns>

## Four decisions it makes for you

**A page's route is its path.** No router exists. `src/pages/admin/ban.ts` is the
`admin/ban` route because that is what the file is called. Naming a `handle*`
method is what registers it. Adding a page cannot break an unrelated one.
See [page routing](/concepts/page-routing).

<Frame caption="Four files, four route names. The scanner walks the tree and takes the name from the path; nothing is registered by hand.">
  <img
    src="/images/routing.svg"
    alt="Four files under src/pages on the left, each joined by an arrow to the route name it resolves to on the right. start.ts and start/index.ts both resolve to start, start/random/number.ts resolves to start/random/number, and admin/ban.ts resolves to admin/ban."
  />
</Frame>

**Markup lives in a block, not in a string.** Message text, keyboards, media
captions, poll options, invoices and error toasts live in one `static template`,
compiled ahead of time. `lang="id"` beside a block gives you a second language
with no branch in the handler. See [templates](/concepts/templates).

**Render params are a union over delivery routes.** Each `render*()` method
accepts only the keys its winning route reads; the rest are `?: never`, so
`{mode: "reply", fallback: "reply"}` is a compile error rather than a field
quietly dropped. See [the render contract](/concepts/render-contract).

**One deploy field, five behaviours.** `polling`, `webhook`, `serverless`,
`raw`, `test`, with settings in nested `optionsDeploy` branches where at most one
branch may be non-empty and it must equal `deploy`. See [deploy](/concepts/deploy).

## Who it is for

- A bot whose UI is more than a few text messages, and where keyboards and
  media have to behave consistently.
- A team shipping the same bot to several languages, where `lang` per block is
  cheaper than a branch per string.
- A serverless target, where cold-start cost makes ahead-of-time template
  compilation worth the constraint it imposes.

## Who it is not for

- A bot that sends a few messages on command. A hand-written handler is shorter.
- Anyone who wants to hand Telegram markup strings to the API directly. That is
  the trade being made, deliberately.

## The honest trade

The block vocabulary is a constraint. `<g-script>` is rejected by ahead-of-time
compilation, because it compiles to `with(data …)` and ESM forbids that. Logic
belongs in the page class, returning plain data.

In exchange you get pages that fail at build rather than at send, templates that
a test can assert against, and markup a non-programmer can translate. That trade
suits a product surface. It does not suit a script.

## Where to start

[Quickstart](/quickstart) gets a bot answering messages in five minutes. The
[API reference](/reference/gramstax) covers every exported symbol and is
generated from the TypeScript declarations.