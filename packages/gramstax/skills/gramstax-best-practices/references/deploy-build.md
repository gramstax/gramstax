# deploy-build

`gramstax build` freezes `src/pages` into `.gramstax/`. Regenerate after every page or template change; never hand-edit the output.

## Why

The build exists for runtimes that cannot scan a filesystem or use `new Function` — Workers and Lambda. It freezes route discovery into pure data and compiles templates ahead-of-time, so a deployed entry boots with no directory read and no runtime codegen. The cost is a stale-artifact failure mode: edit a template, forget the build, and the deployed bot serves the old version with no error anywhere.

## Commands

```bash
gramstax build                              # full build, all deploys
bun run build:gramstax                      # the scaffolded script
gramstax build --dry-run                    # print the resolved plan, write nothing
gramstax build --target cloudflare-mod       # only the Workers entry
gramstax build --target aws-lambda-async    # only the Lambda entry
gramstax build --raw                        # raw projects: skip, exit 0, writes nothing
gramstax build --bundle                     # deprecated single-file bundle
```

Exit codes: `0` success/skip, `1` build error (missing `src/pages` without `--raw`, duplicate route, broken page, failed validation), `2` CLI usage error.

## Paths are convention

`pagesDir` is always `src/pages`, `outDir` is always `.gramstax/`, both resolved from the project root — like Next.js reading `app/` and emitting `.next/`. There are no path knobs, so nothing drifts between environments.

## Output tree

```text
.gramstax/
  routes.json        # frozen route list (pure data, diffable) — always
  manifest.js        # static page-class imports + embedded templates — always
  gen/               # AOT template modules — always
    <key>.g.js       # one module per template key (`sub/note` → `sub_note.g.js`)
    manifest.js      # {templates: Record<key, ITCompiledTemplate>}
  server/            # only for a resolved serverless target
    worker.js        # cloudflare-mod entry
    wrangler.toml    # complete deployable Workers config
    bun-stub.ts      # `bun` resolve stub for the Workers bundler
    lambda.js        # aws-lambda-async entry
    bundle.js        # --bundle only, deprecated
```

`routes.json` entries:

```json
[{`file`: `start.ts`, `name`: `StartPage`, `routeName`: `start`}]
```

`manifest.js` shape — static imports plus embedded template strings, `.js` so it carries no TS annotations:

```js
import {StartPage} from "../src/pages/start"

export const manifest = {
  pages: [{path: `start.ts`, routeName: `start`, page: StartPage}],
  templates: [{key: `card`, template: `<g-base>...`}]
}
export default manifest
```

Emit the edge layer, never hand-write it. `.gramstax/` is gitignored build output.

## Which deploys consume it

| Deploy | Consumes `.gramstax/` |
| --- | --- |
| `polling` | fs boot; ignores it unless the `manifest` param is passed explicitly |
| `webhook` | same as `polling` |
| `test` | fs boot |
| `raw` | `--raw` skips, emits nothing |
| `serverless` (`aws-lambda-async`) | **auto-loads** `.gramstax/`, fs fallback |
| `serverless` (`cloudflare-mod`) | same auto-load |

Only `serverless` auto-loads. On every other deploy the build tells you so:

```text
runs straight from src/pages via gramstax start and ignores this output — skip the build
```

So do not wire `build:gramstax` into a polling deploy pipeline expecting it to change behavior.

## Manifest boot

Auto-load happens only for `deploy: "serverless"` with no explicit `manifest`: it reads `./.gramstax/manifest.js` + `routes.json` from the working directory when present and falls back to the filesystem walk when absent. Emitted `server/worker.js` and `server/lambda.js` always wire the manifest explicitly, so a deployed entry never depends on that fallback.

- `manifest.routes` present → pages register from the frozen list, joined to `manifest.pages` by `routeName`. A missing match throws naming the `file` — regenerate.
- `manifest` is a **constructor** param, not a config field. Putting it in `gramstax.config.ts` throws `unknown field`.

Parity is locked by `cli.build-parity.test.ts` + `core.manifest-parity.test.ts`: manifest boot produces routing tables deep-equal to fs boot and byte-identical `/start` output.

## What reaches a deployed entry

Far less than `gramstax start` materializes, because a deployed entry boots fs-less from the frozen manifest. Each dropped slot is reported per-slot at build time — `--dry-run` is the cheapest place to catch it.

**Passed through:** `autoRetry`, `autoRetryOptions`, `maxTextLength`, `skipDuplicateUpdate`, `updateTimeoutMs`, `optionsPage`, `rateLimit`, `throttle`, builtin-form `cacheSession`, array/plain `cacheKeyboard`, boolean/non-disk `log`.

**Reached via a static top-level import** — `cacheSession`, `cacheKeyboard`, `log` may each be a path-ref; the emitter writes `import * as __ref0 from "../../src/helpers/log.ts"` at the top of the entry and resolves it with `__pick` at the construction site. Because the import is static, a bad path fails the build instead of the first request.

```typescript
log: {override: {module: `./src/helpers/log.ts`, export: `LogHe`}}
```

**Dropped, with a warning naming the reason:**

| Slot | Why |
| --- | --- |
| `templateManager` | resolves template files from disk; the entry uses the frozen manifest |
| `sessionLock` | needs a Redis client over TCP |
| `mediaRoots` | jails local file paths; nothing to jail against |
| `statusServerPort`, `statusServerHostname` | no status server in a deployed entry |
| `log` with `pathFile` / `force: 'file'\|'all'` | writes to disk |

`gramstax start` imports path-refs; `gramstax build` never does — it emits them as static imports instead.

## Target resolution

`--target` overrides the config adapter key with a warning. `name` defaults to `gramstax-worker`. `url` falls back to `optionsDeploy.webhook.url` when the serverless branch omits it. No adapter configured → no `server/` output, manifest only.

`--bundle` requires a serverless `--target`. For `aws-lambda-async` it moves the Lambda handler from `server/lambda.js` to `server/bundle.js`. Deprecated: prefer multi-file — it is debuggable and avoids the stub tradeoffs (the Workers bundle stubs `bun`, `@keyv/redis`, `chokidar`, `@grammyjs/transformer-throttler`, and `@grammyjs/files` node helpers with fail-fast errors).

## Deploying the emitted output

```bash
# Cloudflare — always an ABSOLUTE --config path; a relative one resolves
# against the invoker's cwd, not the project
wrangler deploy --config <abs>/.gramstax/server/wrangler.toml
wrangler secret put BOT_TOKEN
wrangler secret put BOT_WEBHOOK_SECRET
```

Never put `BOT_TOKEN` or `BOT_WEBHOOK_SECRET` in `[vars]` — a vars entry occupies the binding name, `secret put` then fails with `already in use`, and the worker throws error 1101. The emitted toml deliberately carries no such line.

Lambda: package `.gramstax/` with the function and wire `.gramstax/server/lambda.js` (or `bundle.js`) as the handler. Set `BOT_TOKEN` and `BOT_DEPLOY=serverless` in the function env.

## Notes

- `.gramstax/gen/` is always emitted; Node deploys ignore it. It exists for runtimes without the `Function` constructor.
- `bun-stub.ts` is emitted only when the target set includes `cloudflare-mod`; it stubs `Bun.serve` as resolve-only (imports resolve, calls throw).
- AOT rules — the `with()` restriction, the parity suite, and what must be regenerated — are in `template-aot.md`.
- Regenerate on every pages/templates change. There is no staleness check at boot.