# gramstax

> Declarative Telegram bot framework with template-driven page routing, session management, inline keyboards, caching, and a mock server for testing.

## What Is This?

`gramstax` (package name `gramstax`) is a TypeScript library that lets you build Telegram bots by declaring **pages** as classes with **HTML-like templates** rather than hand-wiring grammY handler callbacks. It is built directly on top of [`grammy`](https://grammy.dev) — the underlying `Bot` and `Context` types are extended, not replaced.

- **Why it exists:** Writing Telegram bots with raw handlers leads to scattered routing, repetitive keyboard construction, and ad-hoc session storage. `gramstax` centralizes these into a convention-based page system with a small template DSL (`<g-base>`, `<g-message>`, `<g-keyboard>`, `<g-media>`, …) and a unified cache/session layer.
- **What it is:** A framework library (`type: module`, ESM + CJS dual build). It is consumed by application code (and by the `create-gramstax` CLI scaffolds in `example/*`).
- **Who it is for:** Developers building Telegram bots in TypeScript/Bun who want declarative page routing, multilingual keyboards, and pluggable session storage (in-memory or Redis) without reimplementing the boilerplate.

## Key Features

| Feature                    | Description                                                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Page-based routing**     | Define a class per screen extending `Ctx`; the framework auto-discovers `src/pages/*` and routes updates by convention (`handle*`, `handleSession*`, `handleFree*`, intent/callback naming). |
| **Template DSL**           | HTML-like `<g-*>` markup compiled to render functions via `new Function()`. Supports multilingual blocks, keyboards, media, descriptions, and scopes/interpolation.                          |
| **Multilingual keyboards** | `LabelKeyboard` + `BlockKeyboard` build inline/bottom keyboards from label maps keyed by language.                                                                                           |
| **Sessions & cache**       | `CacheExternal` (keyv) with memory / Redis / custom store modes for per-user session and keyboard caching.                                                                                   |
| **Rich validation**        | Two-layer validators for Telegram Rich HTML (53 tags) and `<g-*>` PAGE blocks — required attributes + value formats.                                                                         |
| **Hot reload**             | `TemplateManager` watches template files with `chokidar` and recompiles on change.                                                                                                           |
| **Webhook backpressure**   | `WebhookQueue` bounds and serializes incoming updates for webhook/serverless deploys.                                                                                                        |
| **In-process E2E tests**   | `deploy: "test"` activates `E2eHelper` + `MockTelegramServer` so bots can be tested with zero HTTP.                                                                                          |
| **Multiple deploy modes**  | `polling`, `webhook:<url>`, `serverless:<adapter>`, and `test`.                                                                                                                              |

## Project Status

| Attribute            | Value                                            |
| -------------------- | ------------------------------------------------ |
| **Stage**            | Active (published to npm as `gramstax`, v0.11.3) |
| **License**          | `PROPRIETARY` (per `package.json`)               |
| **Primary Language** | TypeScript (strict, `noUncheckedIndexedAccess`)  |
| **Framework**        | Built on `grammy` (Telegram Bot API framework)   |
| **Runtime**          | Bun (`bun:test`, `Bun.serve` for webhooks)       |

## Quick Links

- [Getting Started](getting-started.md) - Set up and run a bot locally
- [Architecture](architecture.md) - How the system is structured
- [Development](development.md) - Contributing, testing, building
- [Decisions](adr/README.md) - Architecture Decision Records
- [Glossary](glossary.md) - Project terminology
