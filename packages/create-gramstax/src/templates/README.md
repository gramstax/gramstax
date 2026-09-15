# {{projectName}}

A production-ready Telegram bot built with [Gramstax](https://github.com/gramstax/gramstax) — declarative pages, template-driven messages, and end-to-end tested flows.

![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat&logo=typescript&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-26A5E4.svg?style=flat&logo=telegram&logoColor=white)
![Biome](https://img.shields.io/badge/Biome-60A5FA.svg?style=flat&logo=biome&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## Features

- 🧩 **Page-based routing** — each screen is a class with `show`/`process` steps, inline keyboards, and session state
- 🎨 **Template engine** — rich HTML messages, filters, media groups, and multi-language variants
- ✅ **E2E tested** — in-process harness asserts every Telegram API call (`e2e/` mirrors `src/pages/`)
- 💾 **Optional persistence** — LMDB repositories (if enabled)
- ⚙️ **Optional background jobs** — worker threads (if enabled)
- 🛡️ **Guards, throttling & metrics** — route guards, rate limits, and a status server out of the box

## Quick Start

### 1. Install dependencies

```bash
{{installCmd}}
```

### 2. Configure your environment

Edit `.env` (already created for you on scaffold) and set your bot token — get one from [@BotFather](https://t.me/BotFather):

```bash
TELEGRAM_BOT_TOKEN="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
```

### 3. Run in development (watch mode)

```bash
{{runDevCmd}}
```

### 4. Run in production

```bash
{{runStartCmd}}
```

Open Telegram, find your bot, and send `/start`.

## Scripts

| Script          | Description                              |
| :-------------- | :--------------------------------------- |
| `dev`           | Start with file watching                 |
| `start`         | Start in production mode                 |
| `build`         | Bundle to `dist/`                        |
| `typecheck`     | Type-check with `tsc --noEmit`           |
| `lint`          | Lint with Biome                          |
| `lint:fix`      | Lint and auto-fix with Biome             |
| `format`        | Format with Biome                        |
| `test`          | Run unit tests in `test/`                |
| `test:e2e`      | Run end-to-end tests in `e2e/`           |
| `test:all`      | Run unit + e2e tests                     |

## Project Structure

```
├── src/
│   ├── base/          # Shared base classes (PageBase, GuardBase)
│   ├── blocks/        # Reusable keyboard block builders
│   ├── core/          # Bot entry (BotCore) and context (CtxCore)
│   ├── db/            # LMDB schemas + repositories (if enabled)
│   ├── guards/        # Access control and input validation
│   ├── helpers/       # Domain helpers (logging, formatting)
│   ├── pages/         # Bot screens — one file (or folder) per route
│   ├── utils/         # Pure generic utilities
│   ├── workers/       # Background jobs (if enabled)
│   ├── env.ts         # Typed environment config
│   └── index.ts       # Entrypoint
├── e2e/               # End-to-end tests (mirrors src/pages/)
├── test/              # Unit tests for pure logic
├── scripts/           # e2e mirror check + structure generator
└── data/              # LMDB data files (created at runtime, if enabled)
```

New page? Create `src/pages/my-page.ts` plus `e2e/my-page.test.ts` — the mirror is enforced by `scripts/check-e2e-mirror.ts`.

## Configuration

All settings live in `.env` and are read typed via `src/env.ts`:

| Variable                 | Required | Description                                                     |
| :----------------------- | :------- | :-------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`     | Yes      | Bot token from [@BotFather](https://t.me/BotFather)             |
| `TELEGRAM_BOT_DEPLOY`    | Yes      | `polling` (dev) · `webhook:<public-url>` · `serverless:<adapter>` |
| `TELEGRAM_CACHE_SESSION` | No       | `memory` (single instance) or `redis:<url>` (multi-instance)    |

## Testing

```bash
bun run test       # fast unit tests for helpers, stores, validation
bun run test:e2e   # full user journeys: /start → callbacks → free text
bun run test:all   # everything, as CI runs it
```

E2E tests drive the real bot in-process (`deploy: test`) and assert every Telegram API call — message text, keyboards, media, edits, and call order.

## Deployment

- **Development** — `TELEGRAM_BOT_DEPLOY=polling`, then `bun run dev`.
- **Production (webhook)** — point `TELEGRAM_BOT_DEPLOY` at your public URL, e.g. `webhook:https://yourdomain.com/telegram-webhook`, and run `bun run start` behind a process manager.
- **Serverless** — use `serverless:<adapter>` (e.g. `serverless:std/http`) and export the handler from `src/index.ts`.

## Tech Stack

- [Gramstax](https://github.com/gramstax/gramstax) — declarative Telegram bot framework (grammY under the hood)
- [Bun](https://bun.sh) — runtime, test runner, and bundler
- [Biome](https://biomejs.dev) — lint + format (no semicolons, backtick strings, 2-space indent)
- TypeScript 7 in strict mode

## Learn More

- [Gramstax Documentation](https://github.com/gramstax/gramstax)
- [Telegram Bot API](https://core.telegram.org/bots/api)

## License

MIT
