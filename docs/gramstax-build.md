# `gramstax build`

For all deploys: one `gramstax build` freezes a project's `pages/` into a single all-in-one `.gramstax/` consumed per the table below. Only `serverless` deploys auto-load it; every other deploy keeps fs boot unless the `manifest` param is passed explicitly.

| Deploy | Consumes `.gramstax/` how |
| ------ | ------------------------- |
| `polling` | fs boot; ignores `.gramstax/` unless `manifest` param passed explicitly |
| `webhook` | same as `polling` |
| `test` | fs boot |
| `raw` | `build --raw` skips, emits nothing |
| `serverless` (key `aws-lambda-async`) | auto-loads `.gramstax/` (fs fallback) |
| `serverless` (key `cloudflare-mod`) | same auto-load |

Auto-load applies to `serverless` deploys exclusively (matches `Bot._loadBuildManifest` early-return for non-serverless).

`queue` is orthogonal to `build` — it is a runtime knob, never frozen into
`.gramstax/`, and both `optionsDeploy.polling.queue` and
`optionsDeploy.webhook.queue` configure the same `UpdateQueue` class. See
`docs/gramstax-start.md` for the field table and the opt-in default.

```bash
gramstax build
bun run build:gramstax
```

Paths are convention, not configuration: pages always come from `src/pages`
and artifacts always land in `.gramstax/`, both resolved from the project
root (cwd) — like Next.js reading `app/` and emitting `.next/`, so there are
no path knobs to drift between environments.

## Config reference

Optional `gramstax.config.ts` in the project root (default export). Missing file → zero-config defaults.

```ts
import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  optionsDeploy: {
    serverless: {
      'cloudflare-mod': {
        name: `gramstax-worker`,
        url: `https://<your-worker>.workers.dev/webhook`,
        secretToken: process.env.BOT_WEBHOOK_SECRET ?? ``
      }
    }
  }
}

export default config
```

The adapter is the **key**. Exactly one key must be present, and each key accepts
only its own fields — a field that does not apply to an adapter is rejected, not
ignored.

| Key                  | Accepted fields                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `'cloudflare-mod'`   | `url`, `secretToken` (required) + `name`, `compatibilityDate`, `compatibilityFlags`, `toml`                  |
| `'aws-lambda-async'` | `url`, `secretToken` (required) — nothing else, today                                                         |

`secretToken` is runtime-required but type-optional (zero-config build keeps
working); its value comes from an env expression, never a literal. Duality —
config value sets the webhook, edge reads the `BOT_WEBHOOK_SECRET`
binding — is specified once in `docs/serverless-deploy.md`.

The scaffolded `gramstax.config.ts`
(`packages/create-gramstax/src/templates/gramstax.config.ts`) lists all
20 keys and is the canonical full listing.

| Field                                   | Type                     | Default             | Rule                                                                       |
| --------------------------------------- | ------------------------ | ------------------- | -------------------------------------------------------------------------- |
| `…['cloudflare-mod'].name`              | `string`                  | `gramstax-worker`   | Written to the Workers `name`; never emitted as a comment                 |
| `…['cloudflare-mod'].compatibilityDate` | `string`                  | `2026-01-01`        | Always written — it also gates `compatibilityFlags`                       |
| `…['cloudflare-mod'].compatibilityFlags`| `string[]`                | `["nodejs_compat"]` | Required: the dependency graph uses Node builtins                        |
| `…['cloudflare-mod'].toml`              | `Record<string, unknown>` | —                   | Escape hatch; flat-merged last, so it overrides every typed field above    |
| `…[any].url`                            | `string`                  | —                   | Real `https?://` with no `<` placeholder                                  |
| `…[any].secretToken`                    | `string`                  | —                   | `^[A-Za-z0-9_-]{1,256}$`; never baked into a bundle                       |

`url` and `secretToken` are optional in the type so `process.env.X` expressions
typecheck; the loader and the constructor both enforce them with an explicit error.

Invalid shapes throw `Invalid gramstax config at <file>: ...` naming the field. Loader: `GramstaxConfigLoader.loadConfig(cwd)` in `packages/gramstax/src/cli/config.ts`.

## CLI flags

`gramstax build [--target <name>] [--bundle] [--dry-run] [--raw]`

| Flag | Effect |
| ---- | ------ |
| `--target cloudflare-mod\|aws-lambda-async` | Server entry to emit. Same vocabulary as the config key. Wins over the configured key, with a warning when they disagree |
| `--bundle` | Deprecated. Needs `--target cloudflare-mod` or `--target aws-lambda-async`. For lambda it also moves the handler to `server/bundle.js` (see below) |
| `--dry-run` | Print resolved plan with value sources, write nothing |
| `--raw` | Skip: exit 0 with `skip (raw deploy, nothing to build)` |

Preview output (`--dry-run`, exit 0):

```text
gramstax build plan
pagesDir: src/pages
outDir: .gramstax
targets: cloudflare-mod
optionsDeploy.serverless.cloudflare-mod: cloudflare-mod (config)
optionsDeploy.serverless.name: gramstax-worker (default)
optionsDeploy.serverless.url: https://<your-worker>.workers.dev/webhook (default)
dry-run: no files written
```

`pagesDir`/`outDir` always print the `src/pages` + `.gramstax/` convention
with no source annotation (there is nothing to configure); the
`optionsDeploy.serverless` adapter/name/url print from the merged config with the
`config`/`default` rule (no CLI flags exist for them — never `flag`).
`targets` is the effective set: both entries when no `--target` was passed,
else the single named target.

Full-build summary (exit 0):

```text
gramstax build complete
pagesDir: <resolved src/pages>
outDir: <resolved .gramstax>
pages: 3, templates: 0, routes: 3, ms: <n>
```

Exit codes: `0` success/skip, `1` build error (missing `src/pages` without `--raw`, duplicate route, broken page, failed validation), `2` CLI usage error.

## Output tree (all-in-one)

Plain `gramstax build` (no `--target`) emits everything, so one `.gramstax/`
covers all deploys per the consumption table above. Explicit
`--target cloudflare-mod|aws-lambda-async` filters to one server entry
(`LambdaEntry` / `WorkerEntry` classes emit `server/lambda.js` /
`server/worker.js` respectively).

```text
.gramstax/
  routes.json   # frozen route list (pure data, diffable) — always emitted
  manifest.js   # static page-class imports + embedded templates (runnable) — always emitted
  gen/          # AOT modules (always emitted: workers need them, Node ignores them)
  server/
    lambda.js       # `serverless` entry (key `aws-lambda-async`) — `--target aws-lambda-async` only
    worker.js       # `serverless` entry (key `cloudflare-mod`) — `--target cloudflare-mod` only
    wrangler.toml   # complete deployable Workers config (real name + URL from config, token via secret, never in file) — `--target cloudflare-mod` only
    bun-stub.ts     # `bun` resolve stub for the Workers bundler — `--target cloudflare-mod` only
    bundle.js       # single-file bundle — `--bundle` only, deprecated. For aws-lambda-async this replaces lambda.js as the handler
```

Stub rule: `server/bun-stub.ts` is emitted only when the target set includes
`cloudflare-mod` (`--target aws-lambda-async` no; `--raw` / `--dry-run` never). It stubs `Bun.serve` as
resolve-only: imports resolve, any call throws. It stays `.ts` because the
Wrangler `alias` entry resolves and transpiles TS source natively.

`routes.json` entries (`IRouteManifestEntry` in `packages/gramstax/src/types/manifest.ts`):

```json
[{`file`: `start.ts`, `name`: `StartPage`, `routeName`: `start`}]
```

- `file`: posix path relative to `src/pages`.
- `name`: page class name (what `manifest.js` static-imports).
- `routeName`: walk-derived route (`shop/index.ts` → `shop`); computed once by `PageManager.getFileManySync`, never reimplemented.

`manifest.js` shape (same as the 021 generator output, minus types):

```js
import {StartPage} from `../src/pages/start`
export const manifest = {
  pages: [{path: `start.ts`, routeName: `start`, page: StartPage}],
  templates: [{key: `card`, template: `<g-base>...`}],
}
export default manifest
```

`.js` vs `.ts`: `manifest.js` carries no `import type` / `: IAppManifest` annotations (syntax errors in JS). The legacy `bun run build:manifest -- <pagesDir> <outFile.ts>` contract is unchanged and still emits the typed variant.

## Booting from the manifest

Opt-in via the `manifest` param (`IGramstaxParams.manifest?: IAppManifest`):

```ts
import manifest from `./.gramstax/manifest.js`
import routes from `./.gramstax/routes.json`
const bot = new Gramstax({token, deploy: `polling`, templateManager, manifest: {...manifest, routes}})
```

Automatic for serverless: `new Gramstax({deploy: "serverless", optionsDeploy: {serverless: {"cloudflare-mod": {url: "https://<your-worker>.workers.dev/webhook", secretToken: process.env.BOT_WEBHOOK_SECRET!}}}})` with no
`manifest` auto-loads `./.gramstax/` (manifest.js + routes.json) from the
working directory when present, and falls back to the filesystem walk when
absent. Every other deploy keeps fs boot by default. Emitted server entries
(lambda/worker) always wire the manifest explicitly, so they never depend
on this fallback.

- `manifest.routes` present → pages register from the frozen route list, joined to `manifest.pages` classes by `routeName`. No directory is read. An orphan route throws naming its `file` (regenerate the manifest).
- `manifest.routes` absent → exact 021 behavior (register `manifest.pages` directly).
- No `manifest` + non-serverless deploy → default fs boot. Nothing about existing boot paths changed.

## Parity guarantee

Proven by `cli.build-parity.test.ts` + `core.manifest-parity.test.ts` on helloworld-like and `.html` fixture projects: manifest boot produces routing tables deep-equal to fs boot and byte-identical `/start` output. Regenerate after every pages/templates change.

## Raw projects

`deploy: "raw"` projects have no pages. `gramstax build --raw` exits 0, prints the skip message, writes nothing. Without `--raw`, a missing `src/pages` stays an error.

## Relationship to other plans

- **022 (AOT)**: consumes the `manifest.js` convention (static imports + embedded template strings) defined here; 023 emits source-level manifest only.
- **024 (adapters)**: server/lambda/worker entries consume `.gramstax/` (`routes.json` for routing data, `manifest.js` for classes).

## Implementation map

- `packages/gramstax/src/cli/gramstax.ts` — `gramstax` bin (built cli entry)
- `packages/gramstax/src/cli/build.ts` — `GramstaxBuild.run(argv)` orchestration
- `packages/gramstax/src/cli/collect.ts` — `RouteCollector` (collect + atomic `routes.json` write)
- `packages/gramstax/src/cli/config.ts` — config load + validation
- `packages/gramstax/scripts/build-manifest.ts` — `buildManifest()` (single-file, unchanged contract) + `generate(pagesDir, outDir)`
- `packages/gramstax/src/types/manifest.ts` — `IAppManifest` (+ optional `routes`) and `IRouteManifestEntry`
- `packages/gramstax/src/core/bot.ts` — `_pageLoadsFromManifest` routes branch (surgical, opt-in only)
