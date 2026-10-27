---
title: Example bots
description: The eleven runnable bots under example/, what each one demonstrates, which files to read, and how to run them.
icon: boxes
---

# Example bots

Eleven complete Telegram bots live under [`example/`](https://github.com/gramstax/gramstax/tree/main/example). Each is a real project with its own `gramstax.config.ts`, its own page tree, and in most cases its own e2e suite.

They are numbered in an order, but the order is a teaching sequence, not a dependency chain. Every example boots on its own and shares nothing with its neighbours except the ideas it is built on. Read them in order if you are learning the framework, and skip to the one you need if you are not.

One warning up front. `1-complex` is numbered first but it is not the first thing to read. It is the kitchen sink: a broad tour of template blocks, every media type, i18n, a worker thread, and a 27 test e2e suite (28 files with `setup.ts`), all wired together. It is the right place to go once you know how a single page works, and the wrong place to start.

Where to start, depending on what you already know:

- **New to Gramstax, or to page-based Telegram bots at all.** Start at `2-helloworld`. It is three pages and one keyboard, and it is the shape a freshly scaffolded project has.
- **Coming from grammY and wondering whether TypeScript is required.** Start at `3-helloworld-js`. It is `2-helloworld` rewritten in plain ESM JavaScript.
- **Know the basics, need media handling.** `4-echo` has an `echo.ts` page that renders back every media type Telegram can send, plus four small support pages around it.
- **Building a menu-heavy bot.** `5-interactive-menu` and `9-substore-bot` are the two to study. They are the biggest, most realistic ones after `1-complex`.
- **Need a database.** `7-crud` for `@gramstax/lmdb` with a schema and repository layer, `8-newsletter` for a smaller single-table version plus an admin gate.
- **Deploying to the edge.** `11-cloudflare-worker` is the only example that runs `gramstax build` and deploys a Worker.

## The eleven at a glance

| # | project | what it demonstrates | gramstax features it exercises |
| - | :------ | :------------------- | :---------------------------- |
| 1 | `1-complex` | Reference bot: a broad tour of template constructs | `<g-import>`, `<g-map>`, `<g-switch>`, `lang="id"` i18n, `CacheExternal`, all media renderers, `hookBeforeRoute`, `hookAfterStart`, `@gramstax/worker-thread` |
| 2 | `2-helloworld` | The minimal TypeScript bot, plus a webhook bench harness | Config-driven boot, the shared page skeleton, `inlineKeyboardT`, `MockTelegramServer` |
| 3 | `3-helloworld-js` | The same bot in plain JavaScript | Proves Gramstax needs no TypeScript; same config, same pages, ESM `.js` imports |
| 4 | `4-echo` | One echo page for every input type, plus four small support pages | `<g-media>` per Telegram type, `handleFreeText` and the `handleFree*` family, media group rendering |
| 5 | `5-interactive-menu` | Menu navigation with pagination and state | Inline and bottom keyboards, multiple `<g-base id>` per page, callback args, `CacheExternal` for navigation state |
| 6 | `6-bank-system` | Stateful multi-step business flow | Shared state injected through a custom `Ctx`, session free-text steps, bigint arithmetic |
| 7 | `7-crud` | Real persistence with LMDB | `@gramstax/lmdb` `LmdbEnv`, `LmdbSchema`, `register()`, transactions, a repository service layer |
| 8 | `8-newsletter` | Subscribers, admin gating, broadcast | LMDB single-table repo, a page base with a `hookBeforeRoute` access gate, broadcast with per-recipient language |
| 9 | `9-substore-bot` | A complete e-commerce bot, catalog to checkout | `CacheExternal` cart state, paginated catalog, multi-step checkout, a unit-tested store module |
| 10 | `10-http-request` | Talking to an external HTTP API | `fetch` with `AbortSignal.timeout`, JSON formatting, a four step session form |
| 11 | `11-cloudflare-worker` | AOT and manifest boot on the edge | `gramstax build`, the `cloudflare-mod` serverless target, `log.override`, a bare `.html` template |

## One section per example

### 1. `1-complex`: the kitchen sink

**Demonstrates.** A lot at once: block templates (`<g-import>`, `<g-map>`, `<g-switch>`), a language picker persisted in `CacheExternal` and re-applied by a guard on every update, an async generator streaming a response, media and media-group replies, a deliberately thrown error page, and a background counter running in a worker thread.

**Read.**
- `example/1-complex/src/core/bot.ts`: the whole extension surface. `CacheExternal`, `createCtx`, `hookBeforeRoute`, `hookAfterStart`.
- `example/1-complex/src/jobs/increment.ts`: a `WorkerThreadInit` subclass plus `WorkerThreadExport.init`, launched from `hookAfterStart` and read back over RPC from `example/1-complex/src/pages/start/counter/thread.ts`.
- `example/1-complex/src/pages/start/block/import.ts`, `example/1-complex/src/pages/start/block/map.ts`, `example/1-complex/src/pages/start/block/switch.ts`: the three block templates, side by side.
- `example/1-complex/src/guards/user.ts`: overriding `from.language_code` from cache before routing.
- `example/1-complex/src/pages/start/test/media-group.ts`: the media gallery. Note that this `test/` folder holds demo pages, not tests.

**Run.** `bun run start`, or `bun run dev` to watch. Needs `BOT_TOKEN`. The e2e suite is the largest in the repo (27 test files, 28 files in all with `setup.ts`, see `example/1-complex/e2e/`).

### 2. `2-helloworld`: the minimal TypeScript bot

**Demonstrates.** Three pages (`start`, `status`, `blank`), one inline keyboard, and nothing else. This is the smallest thing that boots, and the skeleton every other example grows from.

**Read.**
- `example/2-helloworld/src/pages/start.ts`: the whole page, handlers, helpers, `gdefault`, and the template as a `static template` string.
- `example/2-helloworld/src/blocks/g-keyboard.ts`: reusable label and keyboard builders.
- `example/2-helloworld/gramstax.config.ts`: every field present but mostly `undefined`, which is what a real config looks like.

**Run.** `bun run start`, or `bun run dev` to watch. Needs `BOT_TOKEN`.

**Also ships a bench harness.** `bun run bench:webhook` starts `example/2-helloworld/src/bench/webhook-server.ts`, which drives the bot in webhook mode against an in-process `MockTelegramServer` using the fixtures in `example/2-helloworld/src/bench/update.json`. No token needed, it uses `bench-token`. The full harness lives in `example/2-helloworld/scripts/bench.sh` and needs `k6` on your PATH.

### 3. `3-helloworld-js`: the same bot without TypeScript

**Demonstrates.** `2-helloworld` ported to plain ESM JavaScript: no type annotations, `.js` extensions on every import, and a `tsconfig.json` that exists only to satisfy the workspace typecheck. Useful if you are coming from grammY in JavaScript and want to know whether the framework forces a build step on you. It does not.

**Read.** `example/3-helloworld-js/src/pages/start.js` next to `example/2-helloworld/src/pages/start.ts`. The templates are identical, which is the point.

**Run.** `bun run start`, or `bun run dev` to watch. Needs `BOT_TOKEN`. This is the one example with no test scripts at all.

### 4. `4-echo`: media handling on one echo page

**Demonstrates.** An `echo.ts` page with one handler per inbound media type. Every render helper (`renderPhoto`, `renderVideo`, `renderAudio`, `renderDocument`, `renderAnimation`, `renderVoice`, `renderVideoNote`, `renderSticker`, `renderLocation`, `renderContact`, `renderText`) is exercised against the matching `<g-media>` template block. Four small pages sit around it: `start.ts` is the menu that links to it, `help.ts` lists the commands, and `status.ts` and `blank.ts` are the usual scaffolding.

**Read.**
- `example/4-echo/src/pages/echo.ts`: the echo page. Compare `handleFreePhoto` and friends against the `<g-media>` blocks at the bottom.
- `example/4-echo/src/pages/help.ts`: the help menu.

**Run.** `bun run start`, or `bun run dev` to watch. Needs `BOT_TOKEN`.

### 5. `5-interactive-menu`: menus, pagination, and state

**Demonstrates.** A menu bot with inline and bottom keyboards, a paged catalog with a total count, a simpler paged list without one, a category drill-down, a reset button, and navigation state kept in a `CacheExternal` that survives across updates. Every template carries `lang="id"` twins, so switching language re-renders the whole UI.

**Read.**
- `example/5-interactive-menu/src/pages/start/index.ts`: two `<g-base>` blocks on one page, an inline menu plus a bottom "quick actions" keyboard, and the send-then-edit pattern.
- `example/5-interactive-menu/src/pages/start/inline/with-range.ts`: pagination with prev, next, and a `pageNo/totalPages` indicator, all driven by callback args.
- `example/5-interactive-menu/src/pages/start/inline/without-range.ts`: the same idea without the counter.
- `example/5-interactive-menu/src/data/catalog.ts`: the static fixture the menus are built from.
- `example/5-interactive-menu/src/pages/start/reset.ts`: clearing the cached navigation state.
- `example/5-interactive-menu/src/core/bot.ts`: `cacheState = new CacheExternal('memory')` and how it is threaded into the context.

**Run.** `bun run start`, or `bun run dev` to watch. Needs `BOT_TOKEN`.

### 6. `6-bank-system`: shared state and multi-step flows

**Demonstrates.** An in-memory bank with balances, deposits, withdrawals, transfers between users, and a per-user transaction history. Money is handled as `bigint` scaled by `DECIMALS = 6n` and stored as hex strings, so nothing is ever a float. A guard creates the account on the way in, and the deposit and withdraw flows are session free-text steps.

**Read.**
- `example/6-bank-system/src/core/store.ts`: the store, including the hex encoding helpers.
- `example/6-bank-system/src/guards/bank.ts`: `ensureAccount`, called from `hookBeforeRoute`.
- `example/6-bank-system/src/pages/start/deposit.ts` and `start/transfer.ts`: the two-step and three-step flows.
- `example/6-bank-system/src/core/bot.ts`: how the store reaches the context.

**Run.** `bun run start`, or `bun run dev` to watch. Needs `BOT_TOKEN`. State is per-process, restarting clears every balance.

### 7. `7-crud`: persistence with LMDB

**Demonstrates.** The `@gramstax/lmdb` package in its intended shape: one `LmdbEnv` subclass as the root database, `LmdbSchema` subclasses declaring each sub-database, and plain repository classes on top of the typed handles. On top of that sits a full create, read, update, delete UI over per-user item lists.

**Read.**
- `example/7-crud/src/db/index.ts`: the `Db` class. `register(ItemSchema)` materializes a typed handle, which is then wrapped in a repository.
- `example/7-crud/src/db/schema/item.ts` and `example/7-crud/src/db/schema/sequence.ts`: the schemas, written with the `t` type builder.
- `example/7-crud/src/db/repositories/item.ts`: transactions, prefix scans for per-user listing, and the delete of every key under a prefix in `purge`.
- `example/7-crud/src/pages/create.ts`: a two-step session free-text form, the clearest small example of that pattern in the repo.
- `example/7-crud/src/guards/crud.ts` and `example/7-crud/src/utils/time.ts`: the guard and a display formatter.
- `example/7-crud/src/env.ts`: `DB_PATH` points at `example/7-crud/data`.

**Run.** `bun run start`, or `bun run dev` to watch. Needs `BOT_TOKEN`. No extra setup: LMDB creates `data/` under the example directory on first run (`data` and `*.mdb` are gitignored).

### 8. `8-newsletter`: subscribers, admins, and broadcast

**Demonstrates.** A smaller LMDB app with one table, plus the access-control pattern. `PageAdminBase` overrides `hookBeforeRoute` to return `AdminGuard.isAdmin(this)`, and the broadcast page is the only page in the repo that extends it. Subscribers are stored with their Telegram language so a broadcast can render per recipient.

**Read.**
- `example/8-newsletter/src/db/schema/subscriber.ts`: a single schema with optional fields, and `example/8-newsletter/src/db/repositories/subscriber.ts` for the operations.
- `example/8-newsletter/src/base/page-admin.ts`: the four line access gate.
- `example/8-newsletter/src/guards/admin.ts`: the check itself.
- `example/8-newsletter/src/pages/broadcast.ts`: compose a text or media post, confirm, then send.
- `example/8-newsletter/src/pages/stats.ts`: reads straight off the repository.
- `example/8-newsletter/src/env.ts`: `DB_PATH` and `BOT_ADMIN_IDS`. The committed default admin id is a public value kept only so the example boots: replace it with your own from @userinfobot before running it against a real bot.

**Run.** `bun run start`, or `bun run dev` to watch. Needs `BOT_TOKEN`. LMDB writes `data/` under the example directory on first run.

### 9. `9-substore-bot`: a complete application

**Demonstrates.** The largest realistic bot in the repo: a paginated catalog of digital subscription products, product detail, buy now or add to cart, a cart with quantity controls and a subtotal, a multi-step checkout that collects a contact and order notes as free text, order confirmation, and order history. Carts live in a `CacheExternal` keyed by user id, the data layer is static in-memory, and the store module is the only example with real unit tests. `PROMPT.md` is the generation prompt that produced the project, which makes this a useful reference for what a good brief looks like.

**Read.**
- `example/9-substore-bot/src/data/store.ts`: `ProductCatalog`, `CartStore`, `OrderStore`, `OrderHistoryStore`. Pure logic, no Gramstax, and fully unit tested.
- `example/9-substore-bot/test/store.test.ts`: the only real unit test in `example/`.
- `example/9-substore-bot/src/pages/cart.ts`: reading cart state out of `cacheState` and rebuilding the keyboard from the summary.
- `example/9-substore-bot/src/pages/checkout.ts`: validation, the confirm step, and `Env.STORE_ADMIN_USERNAME` as the support handle.
- `example/9-substore-bot/src/core/bot.ts`: `cacheState = new CacheExternal('memory')`.
- `example/9-substore-bot/src/env.ts`: `STORE_ADMIN_USERNAME`, overridable from the environment.

**Run.** `bun run start`, or `bun run dev` to watch. Needs `BOT_TOKEN`. Optionally set `STORE_ADMIN_USERNAME` to point the support link somewhere real.

### 10. `10-http-request`: calling an external API

**Demonstrates.** A bot that issues arbitrary HTTP requests for you, with the awkward parts handled properly: URL validation, a `Content-Type` only where a body is actually sent, a 15 second `AbortSignal.timeout`, elapsed-time measurement, pretty printing for JSON responses, and truncation at 1500 characters so Telegram does not reject the message.

**Read.**
- `example/10-http-request/src/services/http.ts`: `HttpService`, a self-contained static class with no Gramstax dependency.
- `example/10-http-request/src/pages/http-request.ts`: the four step flow (method, URL, optional token, optional body, result) and how each step is a `<g-base>`.

**Run.** `bun run start`, or `bun run dev` to watch. Needs `BOT_TOKEN`.

### 11. `11-cloudflare-worker`: AOT and manifest boot on the edge

**Demonstrates.** The only serverless example. It freezes its pages with `gramstax build` into `.gramstax/`, which produces a `gen/manifest.js` and a self-contained `server/` directory, then deploys that to Cloudflare Workers. Because a Worker isolate has no filesystem, the bot also boots from the frozen manifest rather than from `src/pages`. The config sets the `cloudflare-mod` serverless branch and swaps the logger through `log.override`. One page, `info`, has a bare `info.html` template with no page logic at all, which is the clearest demonstration that the compiled output can render on its own.

**Read.**
- `example/11-cloudflare-worker/gramstax.config.ts`: the `optionsDeploy.serverless['cloudflare-mod']` branch, the `log.override` ref, and `optionsPage.shortCallbackQueryData`.
- `example/11-cloudflare-worker/src/pages/info.ts` and `src/pages/info.html`: a page whose render is a single static file.
- `example/11-cloudflare-worker/src/pages/sum-number.ts`: a two-step session free-text flow.
- `example/11-cloudflare-worker/src/guards/user.ts`: a guard that rejects users with no username before routing.
- `example/11-cloudflare-worker/e2e/manifest-boot.test.ts` and `aot-boot.test.ts`: the tests that boot from the frozen output.

**Run.** Locally, `bun run start` or `bun run dev` with `BOT_TOKEN` set. To deploy:

```bash
bun run build              # gramstax build: freezes src/pages into .gramstax/
bun run deploy:serverless  # builds, then bunx wrangler deploy --config .gramstax/server/wrangler.toml
```

`deploy:serverless` needs `BOT_DEPLOY=serverless`, `BOT_DEPLOY_NAME`, `BOT_DEPLOY_URL` (the public Worker URL, including the webhook path), and the webhook secret. The secret is set on the Worker side with `wrangler secret put BOT_WEBHOOK_SECRET` and read locally from `BOT_WEBHOOK_SECRET`; the two must be the same value and the literal never belongs in the config. See [Serverless deploy](/guides/serverless-deploy) for the full workflow.

## Running the examples

All eleven are members of the root workspace. The root `package.json` declares `workspaces: ["packages/*", "example/*"]`, so a single `bun install` at the repository root installs every example and every package. There is nothing to install per example.

**Build the packages first.** At runtime the examples do not run the TypeScript sources. Bun resolves `gramstax: "workspace:*"` through the workspace symlink to `packages/*/dist/src/index.js`, so a stale or missing build is the usual reason an example fails to boot. (Typechecking is the opposite: the root `tsconfig.json` remaps `gramstax` to `packages/*/src/index.ts`, so `bun run typecheck` inside an example reads source.) Run this once after cloning, and again after changing anything in `packages/`:

```bash
bun install     # also runs the postinstall shim that writes node_modules/.bin/gramstax
bun run build   # nx run-many -t build across packages/*
```

The postinstall step matters: Bun does not link `workspace:*` binaries, so the bare `gramstax` in each example's `start` and `dev` scripts is resolved by a shim that `bun scripts/link-workspace-bins.ts` writes into `node_modules/.bin`.

**Set a token.** Every config reads `process.env.BOT_TOKEN`. Without one, `bun run start` boots nothing. `BOT_DEPLOY` is optional and defaults to `polling`. `CACHE_SESSION_STORE`, `CACHE_SESSION_TTL`, and `CACHE_SESSION_NAMESPACE` are also optional and default to `memory`, four hours, and `s`.

**Run from inside the example directory**, since the scripts are per-project:

```bash
cd example/2-helloworld
bun run start    # gramstax start
bun run dev      # gramstax start --watch
```

Bun is required: the CLI resolves TypeScript paths and the `~/*` alias. The published bin has a Bun shebang and loads project-root `.env*` files automatically.

**Tests.** Every example except `3-helloworld-js` exposes `bun run test:e2e` for the in-process e2e suite and `bun run test:all` for unit plus e2e. `11-cloudflare-worker` has no `test/` directory, so its `test:all` is just `test:e2e`. From the root, `bun run test:example` runs `bun test ./example` across all of them. The e2e harness constructs `BotCore` directly with `deploy: "test"` and `token: "test"`, so no real token is needed. See [E2E testing](/guides/e2e-testing) for the harness API.

**Local state.** `7-crud` and `8-newsletter` write LMDB files into a `data/` directory inside the example. `6-bank-system`, `5-interactive-menu`, `9-substore-bot`, and `1-complex` keep state in memory and lose it on restart. Nothing outside `example/` is modified.
