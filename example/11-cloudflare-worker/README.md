# 11-cloudflare-worker

Gramstax bot for Cloudflare Workers: standard template skeleton
(`BotCore`/`PageBase`, polling entry for local dev) plus an emitted edge
entry that boots from frozen build output — no filesystem reads, no
runtime codegen, no hand-written worker.

## Structure

```text
src/
  base/ guards via GuardBase (unused here — kept for shape)
  blocks/ keyboard builders
  core/bot.ts      BotCore extends Gramstax (UserGuard + error hooks)
  core/ctx.ts      CtxCore
  env.ts           BOT_* vars for local dev (worker uses fetch env)
  index.ts         polling entry for local dev
  pages/           template pages (blank/help/start/*/status/...) + info.ts/html
  guards/user.ts   username guard wired in BotCore.hookBeforeRoute
e2e/               setup (fs boot) + per-page mirror tests + manifest/AOT boot tests
.gramstax/         build output (manifest.js + routes.json + gen/ + server/) — gitignored,
                   NEVER hand-edited
```

`src/` is maintained source (mirrors `create-gramstax` template layout);
`.gramstax/` is build output. One regen command produces the full output:

```bash
bun run build
```

Regenerate after every pages/templates change. The legacy single-file
`src/manifest.ts` generator is superseded (deleted).

## Edge layer (emitted, never hand-written)

`bun run build` emits `.gramstax/server/` (`worker.js` + `wrangler.toml` +
`bun-stub.ts`) alongside the manifest. The worker boots
`{pages, templates: [], routes}` (never JIT-compiles: edge runtimes forbid
`new Function`), registers AOT modules per key, and serves `GET /`
(health, no bot boot) plus `POST /webhook`. Env comes from the request (`BOT_TOKEN`,
`BOT_DEPLOY` as `serverless` with `optionsDeploy` (`adapter` + `public-url`); `BOT_API_ROOT`
is an optional test-only override. Adapter `cloudflare-mod` is verified
against grammy 1.46 (`cloudflare-workers-mod` does not exist there).

## Local dev

```bash
BOT_TOKEN=test BOT_DEPLOY=polling bun --bun gramstax start  # polling
bun run test:e2e                                      # e2e (deploy:test)
```

## Edge deploy

See `docs/serverless-deploy.md` for the full chain
(build → secret → deploy → verify). Quick pointer (secret duality: config
`secretToken` sets the webhook, edge reads the binding — same value both sides):

```bash
wrangler secret put BOT_TOKEN                 # then: wrangler deploy --config <abs path>/.gramstax/server/wrangler.toml
wrangler secret put BOT_WEBHOOK_SECRET   # same value as `secretToken` in `gramstax.config.ts`
```

## Limits (by design)

- In-memory sessions do not survive across isolates. For multi-request
  state, front the bot with an HTTP session store, e.g. a minimal
  Keyv-compatible REST backend passed as `cacheSession`.
- No LMDB, no worker-thread timers, no file watcher here. Move jobs
  and persistence to services that have them.
