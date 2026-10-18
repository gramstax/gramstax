<div align="center">
  <p><img src="https://avatars.githubusercontent.com/u/187108398?s=200&v=4" alt="Gramstax logo" width="120" height="120" /></p>
  <h1>Gramstax</h1>

  <p>A declarative Telegram bot framework for <a href="https://grammy.dev/">grammY</a> — template-driven pages, a route-aware render API, and config-driven boot.</p>
  <p>
    <img alt="Bun" src="https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white"/>
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat&logo=typescript&logoColor=white"/>
    <img alt="Telegram" src="https://img.shields.io/badge/Telegram-26A5E4.svg?style=flat&logo=telegram&logoColor=white"/>
    <img alt="Biome" src="https://img.shields.io/badge/Biome-60A5FA.svg?style=flat&logo=biome&logoColor=white"/>
    <img alt="Nx" src="https://img.shields.io/badge/Nx-143C20.svg?style=flat&logo=nx&logoColor=white"/>
    <img alt="License" src="https://img.shields.io/badge/License-Proprietary-lightgrey.svg"/>
  </p>
</div>

---

Gramstax turns a Telegram bot into a set of **pages**: classes that own a chunk of markup, a keyboard, and a set of handlers. Markup lives in the page as a template block, not in a string passed to an API call, so the same source renders in every language the page declares and stays translatable.

```typescript
import {PageBase} from "~/base/page"

export class StartPage extends PageBase {
  static data = this.buildData()

  async handleCommandText() {
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
    </g-base>
  `
}
```

## Getting Started

Requires [Bun](https://bun.sh) v1.0+. The CLI resolves TypeScript paths and the `~/*` alias, which plain `node` cannot.

```bash
bunx create-gramstax@latest my-bot
cd my-bot
bun install
bun --bun gramstax start
```

New projects are born with a config file, a page base class, a lint config, and an e2e harness that asserts the exact Telegram API calls your bot makes.

## Packages

| Package | Version | What it is |
| --- | --- | --- |
| [`gramstax`](./packages/gramstax) | 5.0.0 | The framework — page routing, templates, the render API, the CLI |
| [`create-gramstax`](./packages/create-gramstax) | 5.0.0 | Scaffolds a new project; `--lmdb` / `--worker-thread` wire the optional packages in |
| [`@gramstax/lmdb`](./packages/lmdb) | 5.0.0 | LMDB storage with schema-declared repositories and typed sub-DBs |
| [`@gramstax/worker-thread`](./packages/worker-thread) | 5.0.0 | Worker lifecycle, typed RPC, and a Unix-socket gateway for inter-worker comms |

## Deploy modes

One config field, five behaviours:

| `deploy` | What boots |
| --- | --- |
| `polling` | Long-polling against the Bot API |
| `webhook` | Express webhook server with a health/status endpoint |
| `serverless` | Cloudflare Workers (`cloudflare-mod`) or AWS Lambda (`aws-lambda-async`) |
| `test` | In-process mock Telegram server for e2e |
| `raw` | A bare grammY bot — no pages, no templates, no routing |

## Examples

Eleven runnable projects under [`example/`](./example), ordered as a progression:

`1-complex` → `2-helloworld` → `3-helloworld-js` → `4-echo` → `5-interactive-menu` → `6-bank-system` → `7-crud` → `8-newsletter` → `9-substore-bot` → `10-http-request` → `11-cloudflare-worker`

There is also a standalone, non-workspace app in [`real-projects/`](./real-projects).

## Development

```bash
bun install
bun run ci:test        # typecheck + lint + full suite
bun run build          # all packages
bun run lint:fix       # biome
```

| Area | Command |
| --- | --- |
| Typecheck + lint | `bun run ci:check:packages` |
| Tests | `bun run test` |
| Single test file | `bun test packages/gramstax/test/<file>.ts` |
| Build one package | `bun run build:gramstax` |

Tests use `bun:test`. Linting and formatting are Biome.

## Documentation

- [`docs/`](./docs) — API reference and guides
- [`packages/gramstax/skills/`](./packages/gramstax/skills) — agent-facing rules for building with Gramstax, shipped with the package
- [`CONTEXT-MAP.md`](./CONTEXT-MAP.md) — domain docs per package, with ADRs under `docs/adr/`

## License

Proprietary. All rights reserved. This repository is private and unlicensed for redistribution.