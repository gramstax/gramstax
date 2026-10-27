---
title: gramstax build
description: What gramstax build emits, how each deploy mode consumes the frozen .gramstax output, the config fields it reads, and its CLI flags.
icon: package
---

# `gramstax build`

For all deploys: one `gramstax build` freezes a project's `src/pages` into a single all-in-one `.gramstax/` consumed per the table below. Only `serverless` deploys auto-load it; every other deploy keeps filesystem boot unless the `manifest` param is passed explicitly.

| Deploy | Consumes `.gramstax/` how |
| ------ | ------------------------- |
| `polling` | fs boot; ignores `.gramstax/` unless `manifest` param passed explicitly |
| `webhook` | same as `polling` |
| `test` | fs boot |
| `raw` | `build --raw` skips, emits nothing |
| `serverless` (key `aws-lambda-async`) | auto-loads `.gramstax/` (fs fallback) |
| `serverless` (key `cloudflare-mod`) | same auto-load |

<Note>
  Auto-load applies to `serverless` deploys exclusively (matches
  `Gramstax._loadBuildManifest` early-return for non-serverless). Every other
  deploy keeps the filesystem boot unless you pass the `manifest` param explicitly.
</Note>

<Note>
  `queue` is orthogonal to `build`: it is a runtime knob, never frozen into
  `.gramstax/`. Both `optionsDeploy.polling.queue` and
  `optionsDeploy.webhook.queue` configure the same `UpdateQueue` class; see
  `docs-site/guides/gramstax-start.md` for the field table and the opt-in
  default.
</Note>

```bash
gramstax build
bun run build:gramstax
```

Bun is required: the published `gramstax` binary has a Bun shebang and resolves the TypeScript paths.

Paths are convention, not configuration: pages always come from `src/pages`
and artifacts always land in `.gramstax/`, both resolved from the project
root (cwd): like Next.js reading `app/` and emitting `.next/`, so there are
no path knobs to drift between environments.

## Config reference

Optional `gramstax.config.ts` in the project root (default export). Missing file → zero-config defaults.

```ts
import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  deploy: `serverless`,
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
only its own fields: a field that does not apply to an adapter is rejected, not
ignored.

| Key                  | Accepted fields                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `'cloudflare-mod'`   | `url`, `secretToken` (required) + `name`, `compatibilityDate`, `compatibilityFlags`, `toml`                  |
| `'aws-lambda-async'` | `url`, `secretToken` (required): nothing else, today                                                         |

`secretToken` is runtime-required but type-optional, so a zero-config build still
works. Its value comes from an env expression, never a literal. For the serverless
duality, where the config value sets the webhook and the deployed edge reads the
`BOT_WEBHOOK_SECRET` binding, see
[Serverless deploy](/guides/serverless-deploy).

<Warning>
  Never write `secretToken` as a literal. It is never baked into a bundle and
  never written into `wrangler.toml`: the deployed entry reads the
  `BOT_WEBHOOK_SECRET` binding instead.
</Warning>

The scaffolded `gramstax.config.ts`
(`packages/create-gramstax/src/templates/gramstax.config.ts`) lists all
20 keys and is the canonical full listing.

| Field                                   | Type                     | Default             | Rule                                                                       |
| --------------------------------------- | ------------------------ | ------------------- | -------------------------------------------------------------------------- |
| `…['cloudflare-mod'].name`              | `string`                  | `gramstax-worker`   | Written to the Workers `name`; never emitted as a comment                 |
| `…['cloudflare-mod'].compatibilityDate` | `string`                  | `2026-01-01`        | Always written: it also gates `compatibilityFlags`                       |
| `…['cloudflare-mod'].compatibilityFlags`| `string[]`                | `["nodejs_compat"]` | Required: the dependency graph uses built-in modules                        |
| `…['cloudflare-mod'].toml`              | `Record<string, unknown>` | _none_              | Escape hatch; consulted FIRST for `name`, `compatibility_date` and `compatibility_flags`, so it overrides those three typed values; `toml.main` is rejected outright (the emitter owns `main`); any other non-reserved key is appended after the typed block; `vars` is merged key-by-key under `[vars]`; `[alias]` is emitter-owned |
| `…[any].url`                            | `string`                  | _none_              | Real `https?://` with no `<` placeholder                                  |
| `…[any].secretToken`                    | `string`                  | _none_              | `^[A-Za-z0-9_-]{1,256}$`; never baked into a bundle                       |

`url` and `secretToken` are optional in the type so `process.env.X` expressions
typecheck; the loader and the constructor both enforce them with an explicit error.

Invalid shapes throw `Invalid gramstax config at <file>: ...` naming the field. Loader: `GramstaxConfigLoader.loadConfig(cwd)` in `packages/gramstax/src/cli/config.ts`.

## CLI flags

`gramstax build [--target <name>] [--bundle] [--dry-run] [--raw]`

Both `gramstax build` and `gramstax start` load project-root `.env*` files
using the same precedence; see [Environment files](/guides/gramstax-start#environment-files).

| Flag | Effect |
| ---- | ------ |
| `--target cloudflare-mod\|aws-lambda-async` | Server entry to emit. Same vocabulary as the config key. Wins over the configured key, with a warning when they disagree |
| `--bundle` | Not deprecated as a flag, but not recommended for Cloudflare: `WorkerTarget.emitBundle` is marked `@deprecated Not recommended` in the source (the multi-file output is debuggable and has no stub tradeoffs), while `LambdaTarget.emitBundle` is not deprecated and is the documented way to resolve TypeScript path refs for the Lambda target. Needs `--target cloudflare-mod` or `--target aws-lambda-async`. For lambda it also moves the handler to `server/bundle.js` (see below) |
| `--dry-run` | Print resolved plan with value sources, write nothing |
| `--raw` | Skip: exit 0 with `skip (raw deploy, nothing to build)` |

Preview output (`--dry-run`, exit 0):

```text
gramstax build plan
pagesDir: src/pages
outDir: .gramstax
targets: cloudflare-mod
deploy: serverless (config)
optionsDeploy.serverless.cloudflare-mod: cloudflare-mod (config)
optionsDeploy.serverless.name: gramstax-worker (default)
optionsDeploy.serverless.url: https://example.com/webhook (config)
dry-run: no files written
```

`pagesDir`/`outDir` always print the `src/pages` + `.gramstax/` convention
with no source annotation (there is nothing to configure); the
`optionsDeploy.serverless` adapter/name/url print from the merged config with the
`config`/`default` rule; the adapter additionally prints `flag` when `--target`
supplied it. `targets` is the effective set: the single resolved adapter, or
empty when neither `--target` nor a configured adapter names one.

Full-build summary (exit 0):

```text
gramstax build complete
pagesDir: <resolved src/pages>
outDir: <resolved .gramstax>
pages: 3, templates: 0, routes: 3, ms: <n>
```

Exit codes: `0` success/skip, `1` build error (missing `src/pages` without `--raw`, duplicate route, broken page, failed validation), `2` CLI usage error.

## Output tree (all-in-one)

A build emits ONE server entry, never both. The adapter is resolved from
`--target`, else from the configured `optionsDeploy.serverless` key; with
neither configured, no `server/` directory is written at all. The two targets
are mutually exclusive per build: `LambdaTarget` emits `server/lambda.js`, and
`WorkerTarget` emits `server/worker.js` plus `server/wrangler.toml` and
`server/bun-stub.ts`.

```text
.gramstax/
  routes.json   # frozen route list (pure data, diffable), always emitted
  manifest.js   # static page-class imports + embedded templates (runnable), always emitted
  gen/          # AOT modules (always emitted: workers need them, the Lambda runtime ignores them)
  server/
    lambda.js       # `serverless` entry (key `aws-lambda-async`): `--target aws-lambda-async` only
    worker.js       # `serverless` entry (key `cloudflare-mod`): `--target cloudflare-mod` only
    wrangler.toml   # complete deployable Workers config (real name + URL from config, token via secret, never in file): `--target cloudflare-mod` only
    bun-stub.ts     # `bun` resolve stub for the Workers bundler: `--target cloudflare-mod`, plus `--target aws-lambda-async --bundle`
    bundle.js       # single-file bundle: `--bundle` only; for aws-lambda-async this replaces lambda.js as the handler; for cloudflare-mod the emitter is marked deprecated ("not recommended")
```

Stub rule: `server/bun-stub.ts` is emitted whenever the target set includes
`cloudflare-mod`, and for `aws-lambda-async` only when `--bundle` is used
(`--raw` / `--dry-run` never). It stubs `Bun.serve` as
resolve-only: imports resolve, any call throws. It stays `.ts` because the
Wrangler `alias` entry resolves and transpiles TS source natively.

`routes.json` entries (`IRouteManifestEntry` in `packages/gramstax/src/types/manifest.ts`):

```json
[{"file": "start.ts", "name": "StartPage", "routeName": "start"}]
```

- `file`: posix path relative to `src/pages`.
- `name`: page class name (what `manifest.js` static-imports).
- `routeName`: walk-derived route (`shop/index.ts` → `shop`); computed once by `PageManager.getFileManySync`, never reimplemented.

`manifest.js` shape (the single-file generator's output, minus type annotations):

```js
import {StartPage} from "../src/pages/start"
export const manifest = {
  pages: [{path: "start.ts", routeName: "start", page: StartPage}],
  templates: [{key: "card", template: "<g-base><g-message>Hi.</g-message></g-base>"}]
}
export default manifest
```

`.js` vs `.ts`: `manifest.js` carries no `import type` / `: IAppManifest` annotations (syntax errors in JS). The legacy `bun run build:manifest -- <pagesDir> <outFile.ts>` contract is unchanged and still emits the typed variant.

## Booting from the manifest

Opt-in via the `manifest` param (`IGramstaxParams.manifest?: IAppManifest`):

```ts
import manifest from "./.gramstax/manifest.js"
import routes from "./.gramstax/routes.json"
import {Gramstax, TemplateManager} from "gramstax"

const templateManager = new TemplateManager({path: []})
const bot = new Gramstax({
  token: process.env.BOT_TOKEN ?? ``,
  deploy: `polling`,
  templateManager,
  manifest: {...manifest, routes}
})
```

Automatic for serverless: `new Gramstax({deploy: "serverless", optionsDeploy: {serverless: {"cloudflare-mod": {url: "https://<your-worker>.workers.dev/webhook", secretToken: process.env.BOT_WEBHOOK_SECRET!}}}})` with no
`manifest` auto-loads `./.gramstax/` (manifest.js + routes.json) from the
working directory when present, and falls back to the filesystem walk when
absent. Every other deploy keeps fs boot by default. Emitted server entries
(lambda/worker) always wire the manifest explicitly, so they never depend
on this fallback.

- `manifest.routes` present → pages register from the frozen route list, joined to `manifest.pages` classes by `routeName`. No directory is read. An orphan route throws naming its `file` (regenerate the manifest).
- `manifest.routes` absent → the original behaviour: register `manifest.pages` directly.
- No `manifest` and a non-serverless deploy → the default filesystem boot.

## Parity guarantee

<Check>
  Proven by `cli.build-parity.test.ts` + `core.manifest-parity.test.ts` on
  helloworld-like and `.html` fixture projects: manifest boot produces routing
  tables deep-equal to fs boot and byte-identical `/start` output. Regenerate
  after every pages/templates change.
</Check>

## Raw projects

`deploy: "raw"` projects have no pages. `gramstax build --raw` exits 0, prints the skip message, writes nothing. Without `--raw`, a missing `src/pages` stays an error.

## Implementation map

- `packages/gramstax/src/cli/gramstax.ts`: `gramstax` bin (built cli entry)
- `packages/gramstax/src/cli/build.ts`: `GramstaxBuild.run(argv)` orchestration
- `packages/gramstax/src/cli/collect.ts`: `RouteCollector` (collect + atomic `routes.json` write)
- `packages/gramstax/src/cli/config.ts`: config load + validation
- `packages/gramstax/scripts/build-manifest.ts`: `buildManifest()` (single-file, unchanged contract) + `generate(pagesDir, outDir)`
- `packages/gramstax/src/types/manifest.ts`: `IAppManifest` (+ optional `routes`) and `IRouteManifestEntry`
- `packages/gramstax/src/core/bot.ts`: `_pageLoadsFromManifest` routes branch (surgical, opt-in only)
