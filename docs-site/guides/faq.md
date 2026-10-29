---
title: FAQ
description: The design questions newcomers ask, answered from the ADRs and the guides, including the limitations.
icon: circle-question
---

# FAQ

Answers to the questions that come up before someone writes their first page.
Each points at the guide or decision record it comes from, limitations included.

## Getting started

### Why pages instead of a router?

Because a page's route is its path. There is no router to register, so adding a
page cannot change an unrelated route at runtime, and deleting one is `rm`. A
duplicate page name or intent still fails the whole boot. There is no generated
menu, but the routing tables are public through `bot.pages.routeStatic` and
`bot.pages.all`. See [ADR-0004](/guides/adr/0004-convention-routing).

### Why a template DSL instead of plain strings?

Because a template is one thing a build can validate, a translator can translate
and a test can assert against. `static template` holds message text, keyboards,
captions, polls, invoices and error toasts together, with `lang` per block giving
a second language without a branch in the handler. The price is a block
vocabulary: you cannot hand Telegram markup strings to the API directly. See
[templates](/concepts/templates).

### Can I use it without TypeScript?

Yes. The types catch an impossible combination at compile time. For
`renderText`, `renderMedia` and `renderMediaGroup`, `Ctx._assertRenderRoute` also
throws the same error at runtime, which covers callers who are not typechecked.
`example/3-helloworld-js` is a complete bot in plain JavaScript. See
[render contract](/concepts/render-contract).

## Design choices

### Why build on grammY rather than the raw Bot API?

Transport, `Context` and the media builders are not the interesting part, and
reimplementing them is a large, error-prone effort distinct from pages and
templates. The cost of inheriting grammY is tight coupling: a major bump can
ripple into `Ctx` and `Bot` signatures. See [ADR-0001](/guides/adr/0001-build-on-grammy).

### Why does `renderText({mode: "reply", fallback: "reply"})` not compile?

A forced reply never edits an existing message, so a fallback has nothing to
fall back from. Every union member declares all ten universal keys, with
`?: never` where the route does not read one. Omitting the key would not be
enough, because TypeScript treats a property as known when any member declares
it. See [render contract](/concepts/render-contract).

### What can I not put in a template?

`<g-script>` and any `{~~ ... ~~}` scope. Both compile to `with(data ...)`,
which ESM forbids, so they work under `gramstax start` and hard-fail
`gramstax build`. `<g-ifelse>` is the AOT-safe conditional. See
[AOT contract](/guides/aot-contract).

### How do I handle per-user state?

A session is a cache entry keyed by user id and chat id that names which
`handleSession*` method owns the next update. Arm one with `setSession`, read it
from `this.temp.session`, and clear it on `/start`. See
[page routing](/concepts/page-routing).

## Operations

### Does it scale?

Partly, and the update queue is opt-in because it should be. Without
`optionsDeploy.polling.queue` or `optionsDeploy.webhook.queue`, updates drain
sequentially. With it, handlers run in a bounded pool, and the per-chat gate keeps
one conversation's updates in order. The repository ships a benchmark at
`packages/gramstax/bench/bench.ts` but does not commit a result table, because the
numbers depend on the host and the handlers. Run it on your own bot. See
[concurrency](/concepts/concurrency).

Across instances, a Redis-backed `sessionLock` holds an atomic lease for the
whole update dispatch, so two instances do not handle the same user's update at
once. It is Redis only: on any store that is not a `KeyvRedis` instance, the
built-in `memory` store or a custom one, it is disabled with a warning. See
[session lock](/guides/session-lock).

### What happens on deploy, and what can fail?

`deploy` selects one of five modes and `optionsDeploy` holds that mode's settings
in a nested branch. At most one branch may be non-empty and it must equal
`deploy`, so the config cannot claim one mode and run another.

`serverless` is the only mode that auto-loads the frozen `.gramstax/` artifact,
because a serverless isolate has no filesystem to scan. That artifact has no
staleness check at boot, so a stale build serves the old version with no error.
Regenerate it after every template change. See
[serverless deploy](/guides/serverless-deploy).

### Which Telegram features are supported?

30 PAGE blocks covering message, keyboards, media, media groups, polls, invoices,
paid media, venues, dice, gifts, descriptions, answers and imports, plus 54
Telegram Rich HTML tags validated against Bot API 10.3. The vocabulary is in
[templates](/concepts/templates).

The gap: the test mock implements the Bot API methods gramstax
actually calls, not the whole API, and it does not model Telegram's own
behaviour such as rate limits or flood waits, so a passing test can still hit a
rate limit in production. See [E2E testing](/guides/e2e-testing).

### How do I see what the bot is doing?

Set `log: true` in `gramstax.config.ts`, then read `GET /stats` (JSON) and `GET
/metrics` (Prometheus) from the status server. The counters that answer "why did
nothing happen" are `noMatch`, `noHandler` and `dropped`. See
[troubleshooting](/guides/troubleshooting).

## Testing

### How do I test a bot?

`deploy: "test"` mounts an in-process `E2eHelper`; no HTTP server is involved.
Tests send updates through the helper, which builds a raw Telegram `Update` and
feeds it to the bot, then assert on captured Bot API calls: no token, no network,
no port binding, and the same result on a laptop and on CI. The helper can render
the page's own compiled template, so drift between template and handler fails the
test. See [ADR-0006](/guides/adr/0006-in-process-e2e).

## Project status and community

### Is it production ready?

Judge the evidence rather than take a claim. The package is published and at
latest, it carries 118 unit test files under `packages/gramstax/test` plus a
per-example e2e suite, and the public API has a generated reference. Against
that: it is young, and the conventions are strict (named exports in package
source, no `@ts-ignore`, `bun:test` only). The lint rules and the type checker
enforce most of them; the rest are rules of thumb the toolchain does not police.
`bunx create-gramstax` generates 9 page templates plus an e2e suite mirroring the
page tree, the fastest way to judge the shape. See
[ADR-0008](/guides/adr/0008-lint-export-dep-conventions).

### Can I use it with a bot I already have?

Yes, through `deploy: "raw"`: a bare grammY `Bot` with no pages, no templates, no
routing and no auto-start. Write raw handlers on `bot.bot` and start it
yourself. That is the supported way to depend on gramstax without adopting its
model. See [deploy](/concepts/deploy).

### What is the license?

Apache-2.0 for `gramstax`, `create-gramstax`, `@gramstax/lmdb` and
`@gramstax/worker-thread`, but only from `6.0.0` onward. Before that,
`gramstax` and `create-gramstax` were published under MIT from `0.0.1` through
`0.3.19` and then under proprietary terms from `0.3.20` through `5.0.0`, while
`@gramstax/lmdb` and `@gramstax/worker-thread` were proprietary from their
first release (`0.9.0`) through `5.0.0`. The MIT grant stays MIT, because that
grant is perpetual. The scaffolded project template is MIT, so projects you
generate keep the licence they came with. See
[migrating to v6](/guides/migrating-to-6).

### How do I contribute?

Issues and specs live as GitHub issues and are worked through the `gh` CLI. The
repo carries `AGENTS.md` guidance at the root and per package, `biome lint` is
the style gate and `bun run ci:check` is the type gate. The eight
[decision records](/guides/adr/index) state what each choice cost as well as
what it bought, and are open to disagreement.