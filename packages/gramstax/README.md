<div align="center">
  <p><img src="https://avatars.githubusercontent.com/u/187108398?s=200&v=4" alt="Gramstax logo" width="120" height="120" /></p>
  <h1>gramstax</h1>

  <p>The framework package: page routing, the template engine, the route-aware render API, and the <code>gramstax</code> CLI.</p>
  <p>
    <img alt="Bun" src="https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white"/>
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat&logo=typescript&logoColor=white"/>
    <img alt="Telegram" src="https://img.shields.io/badge/Telegram-26A5E4.svg?style=flat&logo=telegram&logoColor=white"/>
    <img alt="Biome" src="https://img.shields.io/badge/Biome-60A5FA.svg?style=flat&logo=biome&logoColor=white"/>
    <img alt="npm" src="https://img.shields.io/badge/npm-5.0.0-CB3837.svg?style=flat&logo=npm&logoColor=white"/>
    <img alt="License" src="https://img.shields.io/badge/License-Proprietary-lightgrey.svg"/>
  </p>
</div>

---

`gramstax` is the core of the [Gramstax](../../README.md) monorepo. It turns a bot into **pages**: classes that own a slice of markup, a keyboard, and a set of handlers, discovered from `src/pages` and routed by convention.

## Install

Requires [Bun](https://bun.sh) v1.0+ — the CLI resolves TypeScript paths and the `~/*` alias, which plain `node` cannot.

```bash
bun add gramstax
```

Peer dependency: `typescript ^6.0.3`.

## Quick start

A page is a class. The markup is a static template, and the keyboard is built from the page's own blocks.

```typescript
import {PageBase} from "~/base/page"

export class StartPage extends PageBase {
  static data = this.buildData()

  async handleCommandText() {
    await this.gdefault.show()
  }

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  gdefault = {
    show: async () => {
      await this.renderText({keyboard: this.inlineKeyboardT([this]), data: {time: new Date().toString()}})
    },
    process: () => {}
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">Refresh</g-keyboard>
      <g-keyboard type="inline" lang="id">Segarkan</g-keyboard>
      <g-message>
        Hello World!
        Time now: {{time}}
      </g-message>
      <g-message lang="id">
        Halo Dunia!
        Waktu sekarang: {{time}}
      </g-message>
    </g-base>
  `
}
```

Because both languages live in the same block set, the bot renders Indonesian for an Indonesian Telegram client and English for everyone else — without a branch in the handler.

## The render contract

`renderText`, `renderMedia`, `renderMediaGroup` and friends share one rule, and it is the part worth knowing before anything else.

**Params are a union over delivery routes.** Each route declares the same ten keys — a real type where the route reads the key, `never` where it does not:

```typescript
await this.renderText({mode: `edit`, keyboard: this.inlineKeyboardT([this]), editOptions: {parse_mode: `HTML`}})
```

- `mode` picks the route: `auto` (default — edit when the update is a callback query, reply otherwise), `edit`, or `reply`.
- A combination the winning route would ignore is a **compile error**, not a field quietly dropped. `{mode: 'reply', fallback: 'reply'}` does not typecheck, because a forced reply never edits and so never reaches a fallback.

**One field, one call.** There is no options bag that has to satisfy two Telegram methods at once:

| Field | Feeds |
| --- | --- |
| `options` | the send call |
| `editOptions` | `editMessageText` |
| `fallback` / `fallbackOptions` | what to do when the edit fails, and with which options to resend |
| `keyboard` | reply markup — narrowed to `IInlineKb` where the call is always an edit |
| `captionOptions` / `media` / `mediaOptions` / `resendOptions` | the media calls, in place of one overloaded field |

The route atoms are exported (`IRouteAuto`, `IRouteEdit`, `IRouteMediaAuto`, …), so the contract is documented per route rather than only per method.

**The runtime backs it up.** `_assertRenderRoute` throws on the same combinations for plain-JS callers, naming the offending field and the fix. Fields the types reject are caught in review; this catches what slips past the compiler.

## Template blocks

Markup is parsed at build time into typed blocks — there is no regex-at-runtime, and `{{var}}` interpolates a declared scope:

| Group | Blocks |
| --- | --- |
| Structure | `g-base`, `g-import`, `g-space`, `g-div` |
| Logic | `g-ifelse`, `g-switch`, `g-case`, `g-default`, `g-script`, `g-option` |
| Keyboard | `g-keyboard` (`type="inline"` or `bottom`) |
| Content | `g-message`, `g-media`, `g-media-group`, `g-gift`, `g-poll`, `g-invoice`, `g-paid-media`, `g-venue`, `g-dice` |
| Answers | `g-callback-answer`, `g-inline-button`, `g-precheckout-error`, `g-shipping-error`, `g-answer-note` |
| Metadata | `g-description`, `g-question`, `g-price`, `g-map` |

Filters run at compile time: `{{name|upper}}`, `{{price|number:2}}`, `{{createdAt|date:YYYY-MM-DD}}`, `{{count|plural:item:items}}`. An unknown filter renders empty and warns once — the whitelist cannot execute arbitrary code.

## Boot

There is no `src/index.ts` and no hand-written `new Gramstax({...})`. Configuration is data:

```typescript
import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  token: process.env.BOT_TOKEN,
  deploy: process.env.BOT_DEPLOY ?? `polling`,
  cacheSession: {store: `memory`, ttlMs: 4 * 60 * 60 * 1000, namespace: `s`},
  log: true
}

export default config
```

| `deploy` | What boots |
| --- | --- |
| `polling` | Long-polling against the Bot API |
| `webhook` | Express webhook server with a health/status endpoint |
| `serverless` | Cloudflare Workers (`cloudflare-mod`) or AWS Lambda (`aws-lambda-async`); reads the frozen `.gramstax/` output |
| `test` | In-process mock Telegram server for e2e |
| `raw` | A bare grammY bot — no pages, no templates, no routing |

`gramstax build` freezes `src/pages` into `.gramstax/` (routes, manifest, ahead-of-time compiled templates). Only `serverless` consumes it; the others read the filesystem so hot reload keeps working.

## CLI

```bash
bun --bun gramstax start                # boot from gramstax.config.ts
bun --bun gramstax start --watch        # reload templates and pages on change
bun --bun gramstax build                # freeze into .gramstax/
```

## Runtime features

Optional, configured in `gramstax.config.ts`:

- **Rate limiting** — `@grammyjs/ratelimiter`, with `hookRateLimited(ctx)` to control what happens on a drop.
- **Outgoing throttling** — `@grammyjs/transformer-throttler` via `throttle: {global, group, out}`.
- **File download** — `@grammyjs/files`, mounted by default; `ctx.download()` saves the current message's file.
- **Prometheus metrics** — `GET /metrics` on the status server, with an optional `onTrace` span hook.
- **Distributed session lock** — Redis-only atomic lease (`SET NX PX`) held for the whole update dispatch, so concurrent updates for one user serialise across instances. Memory store disables it with a warning.

## Examples

Eleven runnable projects live in [`example/`](../../example) at the repository root, from `1-complex` through `11-cloudflare-worker`.

## Development

Run from the repository root:

```bash
bun run ci:check:packages       # typecheck every package + biome lint
bun run test                    # full suite
bun run build:gramstax          # tsup → packages/gramstax/dist/src
```

Inside this package, the suite is simply `bun test test` and the build is `nx build gramstax`.

`bun:test` only — no Jest, no Vitest. Biome for lint and format. The build ships a full API reference under [`docs/`](./docs).

## Agent skills

[`skills/gramstax-best-practices/`](./skills) ships with the package: a router plus per-topic rules on pages, rendering, e2e, deploy, guards and caching. It is the same guidance the reference docs use.

## License

Proprietary. All rights reserved.