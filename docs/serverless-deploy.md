# Serverless deploy (Cloudflare Workers + AWS Lambda)

Build → secret → deploy → verify for the `11-cloudflare-worker` example and the `lambda` target.
Every command below was executed verbatim during implementation.

## 1. Build

```bash
cd example/11-cloudflare-worker
bun run build
# single command emits .gramstax/manifest.js + .gramstax/routes.json + .gramstax/gen/ + .gramstax/server/
```

Regenerate after every pages/templates change. The edge layer is emitted,
never hand-written (`WorkerEntry` emits `server/worker.js`, `LambdaEntry`
emits `server/lambda.js`); `.gramstax/` is gitignored build output
consumed by the entries — never hand-edited.

## 2. Review `.gramstax/server/wrangler.toml`

`gramstax build` emits a complete deployable Workers config at
`.gramstax/server/wrangler.toml` — no hand-maintained root `wrangler.toml`
exists anymore. `main`/`alias` resolve relative to the config file location,
so it deploys directly via `--config`:

```toml
name = "gramstax-cloudflare-example"
main = "worker.js"
compatibility_date = "2026-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
# BOT_TOKEN is a secret, never a var (a [vars] entry would shadow the real
# secret at runtime — verified live: placeholder var caused error 1101)
BOT_DEPLOY = "serverless"
# adapter + url live in `optionsDeploy.serverless` in code (`serverless: {adapter: "cloudflare-mod", url: "https://gramstax-cloudflare-example.damartripamungkas.workers.dev/webhook"}`)

[alias]
"bun" = "./bun-stub.ts"
```

Name + URL come from `optionsDeploy.serverless` (`adapter` + `name` + `url`) in `gramstax.config.ts`
(defaults keep the `gramstax-worker` + `https://<your-worker>.workers.dev/webhook`
placeholder when unconfigured). `BOT_TOKEN` never appears as a `[vars]` entry —
a vars entry would shadow the real secret at runtime (error 1101, proven by
a live 500 on the first single-toml deploy); the token is set only via
`wrangler secret put BOT_TOKEN --config <emitted toml>`. The legacy
`[observability]` blocks (`enabled = false`, zero runtime effect) were dropped.
The `cloudflare-mod` adapter is verified against grammy 1.46
(`cloudflare-workers-mod` does not exist there).

## 3. Secret (delete-then-put gotcha)

`wrangler secret put` merges — a stale secret survives a plain put. When
rotating, delete first:

```bash
cd example/11-cloudflare-worker
wrangler secret delete BOT_TOKEN
wrangler secret put BOT_TOKEN   # paste the NEW token only here, never in a file
```

**Revoke warning:** the old committed token must be revoked via BotFather
before/after rotation — a committed token is compromised by definition.

**Vars-vs-secret collision (proven live 2026-09-29):** never put `BOT_TOKEN`
(or any secret name) in `[vars]` — not even as a placeholder. A vars entry
occupies the binding name: `secret put` then fails with `already in use`,
`secret list` shows nothing, and the worker throws error 1101 (the var value
reaches the code, not the secret). Recovery: remove the vars line, redeploy
(`--keep-vars` defaults to false, so the stale var is wiped and only
configured vars are set), then `secret put` succeeds. The emitted toml
deliberately carries no `BOT_TOKEN` vars line for this reason.

## 3b. Webhook secret duality (`secretToken`)

`optionsDeploy.serverless` accepts `{adapter?, name?, url?, secretToken?}` —
`secretToken` is runtime-required but type-optional so zero-config `gramstax build`
keeps working. Its VALUE always comes from an env expression
(`secretToken: process.env.TELEGRAM_WEBHOOK_SECRET ?? ```), never a literal.
The config value sets the webhook + local `start`; the deployed edge reads the
`TELEGRAM_WEBHOOK_SECRET` binding instead of the baked bundle — same value both sides:

```bash
cd example/11-cloudflare-worker
wrangler secret put TELEGRAM_WEBHOOK_SECRET   # same value as the config env, never in a file
```

## 4. Deploy (config-resolution gotcha)

Always pass an ABSOLUTE `--config` path — a bare relative path resolves
against the invoker's cwd, not the project:

```bash
wrangler deploy --config <abs path>/.gramstax/server/wrangler.toml
```

## 4b. Single-file bundle (`--bundle`, NOT recommended)

`gramstax build --target cloudflare-workers --bundle` additionally emits
`server/bundle.js` and flips toml `main` to it. Deprecated: prefer the
multi-file output (debuggable, no stub tradeoffs). The bundle exists only
for single-file portability, and stubs four edge-impossible graphs with
fail-fast errors — `bun` (serve), `@keyv/redis` (no TCP sessions),
`chokidar` (no fs to watch), `@grammyjs/transformer-throttler` (bottleneck),
`@grammyjs/files` node file helpers (no fs download; `hydrateFiles` mount
itself works). Anything calling them throws a clear message naming the
multi-file output as the alternative. Default (no flag) stays multi-file.

Pre-flight without credentials:

```bash
wrangler deploy --dry-run --config <abs path>/.gramstax/server/wrangler.toml
# Total Upload: ~19 KiB — exit 0, no writes
```

## 5. Verify

Trigger cold start (first request constructs the bot, registers the
webhook, then routes):

```bash
curl -X POST https://<name>.<sub>.workers.dev/webhook \
  -H 'Content-Type: application/json' -d '{"update_id":1,...}'
```

Then, with the NEW token:

```bash
curl "https://api.telegram.org/bot<NEW>/getWebhookInfo"  # url filled
```

Send real `/start` → correct reply; pending count drains to 0.

## 6. Local edge check (no credentials)

```bash
bunx wrangler dev --config <abs path>/.gramstax/server/wrangler.toml --port 18790 \
  --var BOT_TOKEN:TEST:TOKEN \
  --var BOT_DEPLOY:"serverless" \
  --var BOT_API_ROOT:http://127.0.0.1:18791   # local MockTelegramServer (adapter + url come from `optionsDeploy.serverless` in the emitted entry)
curl http://127.0.0.1:18790/                              # 200, no bot boot
curl -X POST http://127.0.0.1:18790/webhook -d '{...}'    # 200, zero EvalError
```

The mock only accepts loopback webhook URLs, so the dev `optionsDeploy.serverless`
`url` must use a `127.0.0.1` URL — production uses the real workers.dev URL.

## 7. AWS Lambda (`--target lambda`)

Same chain as Cloudflare: build → env → deploy → verify.

Build:

```bash
gramstax build --target lambda
# emits .gramstax/manifest.js + .gramstax/routes.json + .gramstax/gen/ + .gramstax/server/lambda.js
# no `wrangler.toml`, no `bun-stub.ts`
```

Env vars:

| Var | Value |
| --- | ----- |
| `BOT_TOKEN` | Bot token (secret, never in a file) |
| `BOT_DEPLOY` | `serverless` (with `optionsDeploy.serverless` `adapter: "aws-lambda-async"`) |

Handler: `.gramstax/server/lambda.js` (emitted by `LambdaEntry`) exports the
`handler`; wire it as the Lambda function handler. It auto-loads
`.gramstax/` (fs fallback), so package `.gramstax/` with the function.

Deploy, then verify mirroring the Cloudflare chain:

```bash
curl -X POST https://<api-id>.execute-api.<region>.amazonaws.com/webhook \
  -H 'Content-Type: application/json' -d '{"update_id":1,...}'
curl "https://api.telegram.org/bot<NEW>/getWebhookInfo"  # url filled
```

Send real `/start` → correct reply; pending count drains to 0.
