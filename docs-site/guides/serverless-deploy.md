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
# the adapter is the KEY, and url lives inside it (`serverless: {"cloudflare-mod": {url: "https://gramstax-cloudflare-example.damartripamungkas.workers.dev/webhook", secretToken: …}}`)

[alias]
"bun" = "./bun-stub.ts"
```

Name + URL come from `optionsDeploy.serverless['cloudflare-mod']` (`name` + `url`)
in `gramstax.config.ts`; unconfigured they default to `gramstax-worker` +
`https://<your-worker>.workers.dev/webhook`. `BOT_TOKEN` never appears as a `[vars]` entry —
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

`optionsDeploy.serverless` is keyed by adapter — exactly one of `'cloudflare-mod'`
or `'aws-lambda-async'`, each accepting only its own fields (see
`docs-site/guides/gramstax-build.md`). `secretToken` is runtime-required but type-optional so
zero-config `gramstax build` keeps working. Its VALUE always comes from an env expression
(`secretToken: process.env.BOT_WEBHOOK_SECRET ?? ```), never a literal.
The config value sets the webhook + local `start`; the deployed edge reads the
`BOT_WEBHOOK_SECRET` binding instead of the baked bundle — same value both sides:

```bash
cd example/11-cloudflare-worker
wrangler secret put BOT_WEBHOOK_SECRET   # same value as the config env, never in a file
```

## 3c. What actually reaches the deployed entry

`gramstax start` materializes 20 config fields into `GramstaxParams`. A deployed
entry receives fewer, because it boots fs-less from the frozen manifest. Anything
dropped is reported per-slot at build time, with the reason — including under
`--dry-run`, which is the cheapest place to catch it.

**Passed through** (plain data, works without a filesystem):

| Slot | Notes |
| --- | --- |
| `autoRetry`, `autoRetryOptions`, `maxTextLength`, `skipDuplicateUpdate`, `updateTimeoutMs` | scalars / pure logic |
| `optionsPage`, `rateLimit`, `throttle` | plain objects, in-memory |
| `cacheSession` | only the `{store, ttlMs, namespace}` form |
| `cacheKeyboard` | only the array / plain-object form |
| `log` | only `true`/`false`, or options without `pathFile` and without `force: 'file'\|'all'` |

**Reached via a static top-level import** — `cacheSession`, `cacheKeyboard` and
`log` may each be a path-ref:

```ts
log: {override: {module: `./src/helpers/log.ts`, export: `LogHe`}}
```

The emitter writes `import * as __ref0 from "../../src/helpers/log.ts"` at the
top of `worker.js` / `lambda.js` and resolves it at the construction site:

```js
log: __pick(__ref0, "LogHe", [])
```

`__pick` mirrors `gramstax start`: the named `export` if given, else
`default ?? first export`, then instantiated if it is a constructor. Because the
import is static, the platform bundler resolves — and, for `.ts`, compiles — it at
build time, so a bad path fails the build instead of the first request. For the
lambda target this requires `--bundle` (see §4b), since Node cannot import `.ts`
itself.

**Dropped, with a warning naming the reason:**

| Slot | Why |
| --- | --- |
| `templateManager` | resolves template files from disk; the entry uses the frozen manifest |
| `sessionLock` | needs a redis client over TCP |
| `mediaRoots` | jails local file paths; there is nothing to jail against |
| `statusServerPort`, `statusServerHostname` | there is no status server in a deployed entry |
| `log` with `pathFile` / `force: 'file'\|'all'` | writes to disk |



Always pass an ABSOLUTE `--config` path — a bare relative path resolves
against the invoker's cwd, not the project:

```bash
wrangler deploy --config <abs path>/.gramstax/server/wrangler.toml
```

## 4b. Single-file bundle (`--bundle`, NOT recommended)

Works for both targets. `--target cloudflare-mod --bundle` emits
`server/bundle.js` and flips toml `main` to it; `--target aws-lambda-async
--bundle` emits `server/bundle.js` and **changes the Lambda handler path** from
`server/lambda.js` to `server/bundle.js`. Default (no flag) stays multi-file.

Deprecated: prefer the multi-file output (debuggable, no stub tradeoffs). The
bundle exists only for single-file portability.

**Lambda gains the most from it.** The unbundled `lambda.js` runs as-is, so a
`pathFile`/`pathRef` pointing at `.ts` source could not be imported by Node.
Bundling resolves and compiles every specifier ahead of the deployment package.
It still needs `gramstax` resolvable from the emit dir — true in a real project,
which walks up to its own `node_modules`, but a constraint if you emit elsewhere.

For `cloudflare-mod`, the bundle stubs four edge-impossible graphs with fail-fast
errors — `bun` (serve), `@keyv/redis` (no TCP sessions), `chokidar` (no fs to
watch), `@grammyjs/transformer-throttler` (bottleneck), `@grammyjs/files` node
file helpers (no fs download; `hydrateFiles` mount itself works). Anything
calling them throws a clear message naming the multi-file output as the
alternative. The lambda bundle stubs only `bun`, since Lambda is real Node.

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
  --var BOT_API_ROOT:http://127.0.0.1:18791   # local MockTelegramServer (the adapter key + url come from the baked optionsDeploy in the emitted entry)
curl http://127.0.0.1:18790/                              # 200, no bot boot
curl -X POST http://127.0.0.1:18790/webhook -d '{...}'    # 200, zero EvalError
```

The mock only accepts loopback webhook URLs, so the dev `optionsDeploy.serverless`
`url` must use a `127.0.0.1` URL — production uses the real workers.dev URL.

## 7. AWS Lambda (`--target aws-lambda-async`)

Same chain as Cloudflare: build → env → deploy → verify.

Build:

```bash
gramstax build --target aws-lambda-async
# emits .gramstax/manifest.js + .gramstax/routes.json + .gramstax/gen/ + .gramstax/server/lambda.js
# no `wrangler.toml`, no `bun-stub.ts`
```

Env vars:

| Var | Value |
| --- | ----- |
| `BOT_TOKEN` | Bot token (secret, never in a file) |
| `BOT_DEPLOY` | `serverless` (with `optionsDeploy.serverless` keyed `aws-lambda-async`) |

Handler: `.gramstax/server/lambda.js` (emitted by `LambdaEntry`) exports the
`handler`; wire it as the Lambda function handler. It auto-loads
`.gramstax/` (fs fallback), so package `.gramstax/` with the function.

Adding `--bundle` switches the handler to `.gramstax/server/bundle.js` — see §4b.

Deploy, then verify mirroring the Cloudflare chain:

```bash
curl -X POST https://<api-id>.execute-api.<region>.amazonaws.com/webhook \
  -H 'Content-Type: application/json' -d '{"update_id":1,...}'
curl "https://api.telegram.org/bot<NEW>/getWebhookInfo"  # url filled
```

Send real `/start` → correct reply; pending count drains to 0.
