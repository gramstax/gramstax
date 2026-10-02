import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs"
import {builtinModules} from "node:module"
import {dirname, join, relative, resolve, sep} from "node:path"
import type {BunPlugin} from "bun"

export class WorkerTarget {
  /**
   * Emit the Cloudflare Workers serverless target into a directory.
   *
   * @remarks
   * Reads the frozen build artifacts written next to the manifest by `gramstax build` and writes
   * three files: `worker.js` (the Workers module entry), `wrangler.toml`, and `bun-stub.ts`.
   * Import specifiers inside `worker.js` are made relative to `serverDir`, so the directory must
   * be able to reach the frozen artifacts.
   *
   * @param serverDir - Directory that receives the emitted files; created recursively when missing.
   * @param manifestRef - Path to the frozen manifest module, which also locates `routes.json` and `gen/manifest.js`.
   * @param opts - Emit overrides: adapter, worker name, public webhook URL, compatibility date and flags, extra `wrangler.toml` keys, passthrough constructor fields, and ref slots.
   * @returns Absolute paths of `worker.js`, `wrangler.toml`, and `bun-stub.ts`, in that order.
   * @throws Error when the manifest, `routes.json`, or the AOT `gen/manifest.js` is missing.
   *
   * @internal
   */
  emit(
    serverDir: string,
    manifestRef: string,
    opts?: {adapter?: string; name?: string; url?: string; compatibilityDate?: string; compatibilityFlags?: string[]; toml?: Record<string, unknown>; passthrough?: Record<string, unknown>; refs?: Array<{slot: string; module: string; specifier?: string; exportName?: string; args: unknown[]}>}
  ): Array<string> {
    const manifestFile = resolve(manifestRef)
    if (existsSync(manifestFile) === false) {
      throw new Error(`Worker manifest not found at ${manifestFile} (run gramstax build first)`)
    }
    const baseDir = dirname(manifestFile)
    const routesFile = join(baseDir, `routes.json`)
    if (existsSync(routesFile) === false) {
      throw new Error(`Worker routes not found at ${routesFile} (run gramstax build first)`)
    }
    const genFile = join(baseDir, `gen`, `manifest.js`)
    if (existsSync(genFile) === false) {
      throw new Error(`Worker AOT manifest not found at ${genFile} (run gramstax build with --aot first)`)
    }
    const dir = resolve(serverDir)
    mkdirSync(dir, {recursive: true})
    const toImport = (abs: string): string => {
      const rel = relative(dir, abs).split(sep).join(`/`)
      return rel.startsWith(`.`) ? rel : `./${rel}`
    }
    const adapter = opts?.adapter ?? `cloudflare-mod`
    const name = opts?.name ?? `gramstax-worker`
    const url = opts?.url ?? `https://<your-worker>.workers.dev/webhook`
    const refs = (opts?.refs ?? []).map((ref) => ({...ref, specifier: toImport(ref.module)}))
    const workerJs = join(dir, `worker.js`)
    writeFileSync(workerJs, this._renderWorker(toImport(manifestFile), toImport(genFile), toImport(routesFile), {adapter, name, url, passthrough: opts?.passthrough, refs}), `utf-8`)
    const toml = join(dir, `wrangler.toml`)
    writeFileSync(toml, this._renderToml(name, {compatibilityDate: opts?.compatibilityDate, compatibilityFlags: opts?.compatibilityFlags, toml: opts?.toml}), `utf-8`)
    const stub = join(dir, `bun-stub.ts`)
    writeFileSync(stub, this._renderStub(), `utf-8`)
    return [workerJs, toml, stub]
  }

  /**
   * Bundle the server entry into single-file `bundle.js`.
   *
   * @deprecated Not recommended: the multi-file output is debuggable and
   * has no stub tradeoffs (watch/redis/throttler/file-download keep working
   * wherever the runtime allows). Use only for single-file portability.
   */
  async emitBundle(serverDir: string): Promise<string> {
    if (typeof Bun === `undefined` || typeof Bun.build !== `function`) {
      throw new Error(`--bundle needs the Bun runtime (Bun.build is unavailable here)`)
    }
    const dir = resolve(serverDir)
    const workerJs = join(dir, `worker.js`)
    if (existsSync(workerJs) === false) {
      throw new Error(`Worker entry not found at ${workerJs} (run emit first)`)
    }
    const stubTs = join(dir, `bun-stub.ts`)
    const redisStubTs = join(dir, `redis-stub.ts`)
    writeFileSync(redisStubTs, this._renderRedisStub(), `utf-8`)
    const chokidarStubTs = join(dir, `chokidar-stub.ts`)
    writeFileSync(chokidarStubTs, this._renderChokidarStub(), `utf-8`)
    const throttlerStubTs = join(dir, `throttler-stub.ts`)
    writeFileSync(throttlerStubTs, this._renderThrottlerStub(), `utf-8`)
    const filesDepStubTs = join(dir, `files-deps-stub.ts`)
    writeFileSync(filesDepStubTs, this._renderFilesDepStub(), `utf-8`)
    const builtins = new Set<string>([...builtinModules, ...builtinModules.map((name) => `node:${name}`)])
    const bunStubPlugin: BunPlugin = {
      name: `gramstax-bundle-stubs`,
      setup(build) {
        build.onResolve({filter: /^bun$/}, () => ({path: stubTs}))
        build.onResolve({filter: /^@keyv\/redis$/}, () => ({path: redisStubTs}))
        build.onResolve({filter: /^chokidar$/}, () => ({path: chokidarStubTs}))
        build.onResolve({filter: /^@grammyjs\/transformer-throttler$/}, () => ({path: throttlerStubTs}))
        build.onResolve({filter: /deps\.node\.js$/}, () => ({path: filesDepStubTs}))
        build.onResolve({filter: /.*/}, (args) => (builtins.has(args.path) ? {external: true, path: args.path} : undefined))
      }
    }
    const result = await Bun.build({
      entrypoints: [workerJs],
      format: `esm`,
      target: `browser`,
      plugins: [bunStubPlugin]
    })
    if (result.success === false) {
      const detail = result.logs.map((log) => log.message).join(`\n`)
      throw new Error(`bundle failed for ${workerJs}:\n${detail}`)
    }
    const output = result.outputs[0]
    if (output === undefined) throw new Error(`bundle produced no output for ${workerJs}`)
    const bundleJs = join(dir, `bundle.js`)
    writeFileSync(bundleJs, await output.text(), `utf-8`)
    const toml = join(dir, `wrangler.toml`)
    writeFileSync(toml, readFileSync(toml, `utf-8`).replace(/^main = "worker\.js"$/m, `main = "bundle.js"`), `utf-8`)
    return bundleJs
  }

  /**
   * Render the `worker.js` module source for a Cloudflare Workers deploy.
   *
   * @remarks
   * Emits a `WorkerEntry` class that lazily constructs `Gramstax` from the `env` bindings
   * (`BOT_TOKEN`, `BOT_WEBHOOK_SECRET`, optional `BOT_API_ROOT` as the API root override),
   * registers the AOT templates through `registerCompiled`, and exports a default `fetch`. Each
   * page's inline `template` is deleted first so boot cannot JIT-compile templates on the edge —
   * the frozen AOT modules serve those keys instead. `POST /webhook` returns 401 unless the
   * `X-Telegram-Bot-Api-Secret-Token` header matches the secret binding; every other path returns
   * a plain 200. Deploy values (`adapter`, `name`, `url`) are baked into the constructor.
   *
   * @param manifestSpec - Import specifier for the frozen manifest module.
   * @param genSpec - Import specifier for the AOT template registry.
   * @param routesSpec - Import specifier for `routes.json`.
   * @param baked - Adapter, worker name, public webhook URL, passthrough fields, and ref slots to inline.
   * @returns The `worker.js` file content.
   *
   * @internal
   */
  _renderWorker(manifestSpec: string, genSpec: string, routesSpec: string, baked?: {adapter: string; name: string; url: string; passthrough?: Record<string, unknown>; refs?: Array<{slot: string; specifier: string; exportName?: string; args: unknown[]}>}): string {
    const adapter = JSON.stringify(baked?.adapter ?? `cloudflare-mod`)
    const name = JSON.stringify(baked?.name ?? `gramstax-worker`)
    const url = JSON.stringify(baked?.url ?? `https://<your-worker>.workers.dev/webhook`)
    return `import {Gramstax, TemplateManager} from "gramstax"
import baseManifest from "${manifestSpec}"
import {templates as aotTemplates} from "${genSpec}"
import routes from "${routesSpec}"
${this._renderRefImports(baked?.refs)}

${this._renderPickHelper(baked?.refs)}
for (const entry of baseManifest.pages) {
  // Edge-safety: boot would JIT-compile inline templates otherwise;
  // frozen AOT modules registered below serve these keys instead.
  // (Page classes are functions, not objects — check accordingly.)
  const page = entry === null || entry === undefined ? undefined : entry.page
  if (typeof page === "function") delete page.template
}

class WorkerEntry {
  static bot
  static botReady

  static requiredEnv(env, name) {
    const value = env === null || env === undefined ? undefined : env[name]
    if (value === undefined || value.length === 0) {
      throw new Error(name + " is not set (required worker secret/var)")
    }
    return value
  }

  static getBot(env) {
    if (WorkerEntry.bot === undefined) {    
      const token = WorkerEntry.requiredEnv(env, "BOT_TOKEN")
      const apiRoot = env === null || env === undefined ? undefined : env.BOT_API_ROOT
      const botConfig = apiRoot === undefined ? undefined : {client: {apiRoot: apiRoot}}
      let resolveReady = () => {}
      WorkerEntry.botReady = new Promise((resolve) => { resolveReady = resolve })
      const readyResolve = resolveReady
      WorkerEntry.bot = new Gramstax({
        token: token,
        deploy: "serverless",
        optionsDeploy: {serverless: {${adapter}: {name: ${name}, url: ${url}, secretToken: env === null || env === undefined ? undefined : env.BOT_WEBHOOK_SECRET}}},
        templateManager: new TemplateManager({path: []}),${this._renderDefaultLog(baked?.passthrough, baked?.refs)}
        manifest: {pages: baseManifest.pages, templates: [], routes: routes},
        botConfig: botConfig${this._renderPassthrough(baked?.passthrough)}${this._renderRefSlots(baked?.refs)}
      })
      for (const key of Object.keys(aotTemplates)) {
        WorkerEntry.bot.templateManager.registerCompiled(key, aotTemplates[key])
      }
      const prevHook = WorkerEntry.bot.hookAfterStart?.bind(WorkerEntry.bot)
      WorkerEntry.bot.hookAfterStart = async () => { await prevHook?.(); readyResolve() }
    }
    return WorkerEntry.bot
  }

  static async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === \`/webhook\`) {
      let expected
      try {
        expected = WorkerEntry.requiredEnv(env, "BOT_WEBHOOK_SECRET")
      } catch {
        return new Response("Unauthorized", {status: 401})
      }
      const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
      if (provided !== expected) {
        return new Response("Unauthorized", {status: 401})
      }
      const instance = WorkerEntry.getBot(env)
      await WorkerEntry.botReady
      return await instance.handlerBotUpdate(request)
    }
    return new Response(\`OK\`)
  }
}

export default {
  async fetch(request, env) {
    return await WorkerEntry.fetch(request, env)
  }
}

export function getBot(env) {
  return WorkerEntry.getBot(env)
}
`
  }

  /**
   * Render the namespace imports that back the emitted ref slots.
   *
   * @remarks
   * Each ref becomes `import * as __ref<index> from "<specifier>"`, so the slot expressions
   * emitted by `_renderRefSlots` can read a named export off the module. The index must match
   * the one `_renderRefSlots` uses, so both are driven by the same refs array.
   *
   * @param refs - Refs carrying an already-relative import `specifier`.
   * @returns The import block, or an empty string when `refs` is undefined or empty.
   *
   * @internal
   */
  _renderRefImports(refs: Array<{specifier: string}> | undefined): string {
    if (refs === undefined || refs.length === 0) return ``
    return refs
      .map((ref, index) => `import * as __ref${index} from "${ref.specifier}"`)
      .join(`
`)
  }

  /**
   * Render the `__pick` helper that the emitted ref slots call.
   *
   * @remarks
   * Resolves a ref to a value and instantiates it when that value is a function, so a config ref
   * may point at either an instance or a class. With no `name` it falls back to the module's
   * `default` export and then to its first export, and throws when the named export is missing.
   *
   * @param refs - Presence check only — the emitted helper is shared by every ref.
   * @returns The `__pick` function declaration, or an empty string when `refs` is empty.
   *
   * @internal
   */
  _renderPickHelper(refs: Array<unknown> | undefined): string {
    if (refs === undefined || refs.length === 0) return ``
    return `const __pick = (mod, name, args) => {
  const value = name === undefined ? (mod.default ?? Object.values(mod)[0]) : mod[name]
  if (value === undefined) throw new Error("gramstax serverless ref: no export for " + String(name))
  return typeof value === "function" ? new value(...args) : value
}
`
  }

  /**
   * Render the constructor properties that populate the emitted ref slots.
   *
   * @remarks
   * Each ref becomes `<slot>: __pick(__ref<index>, <exportName or undefined>, <args>)`, appended as
   * extra properties on the `Gramstax` call. `args` is `JSON.stringify`-serialized, so ref
   * constructor arguments must be JSON-representable.
   *
   * @param refs - Refs to materialize, each with a slot name, an optional export name, and constructor args.
   * @returns The slot properties including their leading commas, or an empty string when `refs` is empty.
   *
   * @internal
   */
  _renderRefSlots(refs: Array<{slot: string; exportName?: string; args: unknown[]}> | undefined): string {
    if (refs === undefined || refs.length === 0) return ``
    return refs
      .map(
        (ref, index) => `,
        ${ref.slot}: __pick(__ref${index}, ${ref.exportName === undefined ? `undefined` : JSON.stringify(ref.exportName)}, ${JSON.stringify(ref.args)})`
      )
      .join(``)
  }

  /**
   * Render the `log: false` constructor field unless the project supplies its own logger.
   *
   * @remarks
   * A serverless deploy has no console to log to by default, so the field is emitted only when
   * neither a `log` passthrough entry nor a `log` ref slot was provided — supplying either one
   * suppresses the field so the project's own logger wins.
   *
   * @param passthrough - Passthrough constructor fields keyed by name.
   * @param refs - Refs to materialize; only their slot names matter here.
   * @returns The `log: false` constructor property when no logger was provided, otherwise an empty string.
   *
   * @internal
   */
  _renderDefaultLog(passthrough: Record<string, unknown> | undefined, refs: Array<{slot: string}> | undefined): string {
    const provided = passthrough?.log !== undefined || refs?.some((ref) => ref.slot === `log`) === true
    return provided === true
      ? ``
      : `
        log: false,`
  }

  /**
   * Render the extra `Gramstax` constructor properties carried by the deploy passthrough.
   *
   * @remarks
   * Each key becomes one `<key>: <json>` constructor property, `JSON.stringify`-serialized so
   * strings and nested values survive verbatim. The build command has already narrowed the map to
   * edge-safe config slots before it reaches here.
   *
   * @param passthrough - Plain data merged into the emitted `Gramstax` constructor call.
   * @returns The properties including their leading comma, or an empty string when `passthrough` is undefined or empty.
   *
   * @internal
   */
  _renderPassthrough(passthrough: Record<string, unknown> | undefined): string {
    if (passthrough === undefined) return ``
    const keys = Object.keys(passthrough)
    if (keys.length === 0) return ``
    const body = keys
      .map((key) => `        ${key}: ${JSON.stringify(passthrough[key])}`)
      .join(`,
`)
    return `,
${body}`
  }

  /**
   * Render the `wrangler.toml` file content for a Workers deploy.
   *
   * @remarks
   * Always writes `name`, `main`, `compatibility_date`, and `compatibility_flags` uncommented:
   * wrangler treats an absent key as absent rather than falling back to a default, and
   * `nodejs_compat` is date-gated, so a commented `compatibility_date` silently disables the flag
   * and the build fails with unresolvable-builtin errors. Remaining keys from `opts.toml` are
   * appended verbatim, followed by a `[vars]` block of comments steering `BOT_TOKEN` and
   * `BOT_WEBHOOK_SECRET` to `wrangler secret put` (a `[vars]` entry would shadow the real secret),
   * then an `[alias]` mapping `"bun"` to the emitted `bun-stub.ts`.
   *
   * @param name - Worker name for the `name` key, unless `opts.toml` overrides it.
   * @param opts - Compatibility date and flags, plus extra top-level TOML keys.
   * @returns The `wrangler.toml` file content.
   * @throws Error when `opts.toml` sets `main`, which the emitter owns because `--bundle` rewrites it to `bundle.js`.
   *
   * @internal
   */
  _renderToml(name: string, opts?: {compatibilityDate?: string; compatibilityFlags?: string[]; toml?: Record<string, unknown>}): string {
    const extras = opts?.toml ?? {}
    if (Object.hasOwn(extras, `main`) === true) {
      throw new Error(`gramstax build: \`optionsDeploy.serverless['cloudflare-mod'].toml.main\` cannot be set — \`main\` is owned by the emitter because --bundle rewrites it to bundle.js`)
    }
    const extra = (key: string): unknown => (Object.hasOwn(extras, key) === true ? extras[key] : undefined)
    const lines: Array<string> = []
    const resolvedName = extra(`name`) ?? name
    lines.push(`name = ${this._tomlValue(resolvedName)}`)
    lines.push(`main = "worker.js"`)
    // Both keys are always written, never commented. wrangler treats an absent
    // key as absent rather than falling back to a default, and nodejs_compat is
    // date-gated: with compatibility_date commented out the flag silently does
    // nothing and the build fails with 23 "Could not resolve <builtin>" errors.
    const compatDate = extra(`compatibility_date`) ?? opts?.compatibilityDate ?? `2026-01-01`
    if (opts?.compatibilityDate === undefined && extra(`compatibility_date`) === undefined) {
      lines.push(`# Default. Also gates compatibility_flags below — keep the two in sync.`)
    }
    lines.push(`compatibility_date = ${this._tomlValue(compatDate)}`)
    const compatFlags = extra(`compatibility_flags`) ?? opts?.compatibilityFlags ?? [`nodejs_compat`]
    if (opts?.compatibilityFlags === undefined && extra(`compatibility_flags`) === undefined) {
      lines.push(`# Required: gramstax's dependency graph uses node builtins (@grammyjs/files,`)
      lines.push(`# readdirp, @redis/client). Omitting it fails the build with "Could not resolve".`)
      lines.push(`# Set compatibilityFlags: [] in the config to opt out.`)
    }
    lines.push(`compatibility_flags = ${this._tomlValue(compatFlags)}`)
    const reserved = new Set([`name`, `main`, `compatibility_date`, `compatibility_flags`, `vars`, `alias`])
    for (const [key, value] of Object.entries(extras)) {
      if (reserved.has(key) === false) lines.push(`${this._tomlKey(key)} = ${this._tomlValue(value)}`)
    }
    lines.push(``, `[vars]`)
    lines.push(`# BOT_TOKEN is a secret, never a var: a [vars] entry here would shadow the`)
    lines.push(`# real secret at runtime (verified live: placeholder var caused error 1101).`)
    lines.push(`# Set it via: wrangler secret put BOT_TOKEN --config <this file>`)
    lines.push(`# BOT_WEBHOOK_SECRET is a secret, never a var: same shadowing rule.`)
    lines.push(`# Set it via: wrangler secret put BOT_WEBHOOK_SECRET --config <this file>`)
    lines.push(`# Deploy values are baked into worker.js optionsDeploy at build time.`)
    const vars = extra(`vars`)
    if (this._isPlainObject(vars) === true) {
      for (const [key, value] of Object.entries(vars as Record<string, unknown>)) lines.push(`${this._tomlKey(key)} = ${this._tomlValue(value)}`)
    }
    lines.push(``, `[alias]`, `"bun" = "./bun-stub.ts"`)
    return `${lines.join(`
`)}
`
  }

  /**
   * Serialize a value into TOML syntax.
   *
   * @remarks
   * Strings and keys are quoted with `JSON.stringify` (a valid TOML subset for the values this
   * emitter writes), arrays become inline arrays, plain objects become inline tables, and numbers
   * must be finite. Applies recursively to array entries and object values.
   *
   * @param value - Value to serialize.
   * @returns The TOML literal for `value`.
   * @throws Error for a non-finite number, or for a value that is neither string, number, boolean, array, nor plain object.
   *
   * @internal
   */
  _tomlValue(value: unknown): string {
    if (typeof value === `string`) return JSON.stringify(value)
    if (typeof value === `number`) {
      if (Number.isFinite(value) === false) throw new Error(`gramstax build: cannot serialize a non-finite number into wrangler.toml`)
      return String(value)
    }
    if (typeof value === `boolean`) return String(value)
    if (Array.isArray(value)) return `[${value.map((entry) => this._tomlValue(entry)).join(`, `)}]`
    if (this._isPlainObject(value) === true) {
      return `{${Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => `${this._tomlKey(key)} = ${this._tomlValue(entry)}`)
        .join(`, `)}}`
    }
    throw new Error(`gramstax build: cannot serialize a ${value === null ? `null` : typeof value} into wrangler.toml`)
  }

  /**
   * Render a TOML key, quoting it only when a bare key would be invalid.
   *
   * @remarks
   * A key made solely of letters, digits, underscores, and hyphens is emitted bare; anything else
   * falls back to `JSON.stringify` quoting.
   *
   * @param key - Key to render.
   * @returns The bare key when it matches `/^[A-Za-z0-9_-]+$/`, otherwise a quoted key.
   *
   * @internal
   */
  _tomlKey(key: string): string {
    return /^[A-Za-z0-9_-]+$/.test(key) === true ? key : JSON.stringify(key)
  }

  /**
   * Test whether a value is a non-null, non-array object.
   *
   * @remarks
   * Deliberately shallow — it only narrows `unknown` to a record so the TOML serializer can read
   * entries off it without treating arrays as objects.
   *
   * @param value - Value to test.
   * @returns `true` for a non-null object that is not an array.
   *
   * @internal
   */
  _isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === `object` && value !== null && Array.isArray(value) === false
  }

  /**
   * Render `bun-stub.ts`, the module the emitted `[alias]` table maps `"bun"` to.
   *
   * @remarks
   * A deliberately-failing stub: `serve` exists only so the Workers bundler can resolve the `bun`
   * specifier inside the gramstax dist. It throws on call, which is safe because the status server
   * and the webhook listener never start in a serverless deploy — the entry is invoked only
   * through `fetch`.
   *
   * @returns The `bun-stub.ts` file content.
   *
   * @internal
   */
  _renderStub(): string {
    return `// Bun-only APIs are unreachable in serverless deploys: the status server
// (_startStatusServer) and the webhook listener (_runWebhook, webhook
// deploy only) never start there. This stub exists solely so the Workers
// bundler (esbuild) can resolve the \`bun\` specifier inside gramstax dist;
// any actual call throws.
export function serve(..._args: Array<unknown>): never {
  throw new Error(\`Bun.serve is unavailable on Cloudflare Workers\`)
}
`
  }

  /**
   * Render `redis-stub.ts`, the module `--bundle` maps `@keyv/redis` to.
   *
   * @remarks
   * A deliberately-failing stub: the `@keyv/redis` dependency graph reaches node builtins
   * through dynamic `require()`, which workerd rejects. Memory sessions — the only store that
   * works on Workers — never load this module. The constructor throws so an accidental Redis
   * session in a single-file bundle fails loudly instead of silently losing state; use the
   * multi-file deploy output when Redis sessions are required.
   *
   * @returns The `redis-stub.ts` file content.
   *
   * @internal
   */
  _renderRedisStub(): string {
    return `// Redis is unreachable from single-file edge bundles: the @redis/client
// graph uses dynamic require() of node builtins, which workerd rejects.
// Memory sessions (the only store that works on Workers) never touch this
// module. Use the multi-file deploy output if you need Redis sessions.
export default class KeyvRedisStub {
  constructor(..._args: Array<unknown>) {
    throw new Error(\`@keyv/redis is unavailable in single-file edge bundles; use memory sessions\`)
  }
}
`
  }

  /**
   * Render `chokidar-stub.ts`, the module `--bundle` maps `chokidar` to.
   *
   * @remarks
   * A deliberately-failing stub: an edge isolate has no filesystem to watch, and the chokidar
   * graph reaches node builtins through dynamic `require()`, which workerd rejects. Watcher
   * paths never run in a serverless deploy because the emitted entry constructs `TemplateManager`
   * with an empty path list, so only an accidental `watch()` call reaches the throw.
   *
   * @returns The `chokidar-stub.ts` file content.
   *
   * @internal
   */
  _renderChokidarStub(): string {
    return `// File watching is unreachable in single-file edge bundles: there is
// no filesystem to watch, and the chokidar graph uses dynamic require()
// of node builtins, which workerd rejects. Watcher paths never run here
// (TemplateManager boots with an empty path list); any actual call throws.
export type FSWatcher = {close: () => Promise<void>}
export function watch(..._args: Array<unknown>): never {
  throw new Error(\`chokidar watch is unavailable in single-file edge bundles\`)
}
`
  }

  /**
   * Render `throttler-stub.ts`, the module `--bundle` maps `@grammyjs/transformer-throttler` to.
   *
   * @remarks
   * A deliberately-failing stub: the `@grammyjs/transformer-throttler` dependency graph reaches
   * node builtins through dynamic `require()`, which workerd rejects. `apiThrottler` throws on
   * call, so outgoing throttling is unavailable in a single-file bundle rather than silently
   * unthrottled. Use the multi-file deploy output when the `throttle` param is required.
   *
   * @returns The `throttler-stub.ts` file content.
   *
   * @internal
   */
  _renderThrottlerStub(): string {
    return `// Outgoing throttling is unreachable in single-file edge bundles: the
// bottleneck graph uses dynamic require() of node builtins, which workerd
// rejects. The throttle param never applies here; any actual call throws.
// Use the multi-file deploy output if you need throttler sessions.
export function apiThrottler(..._args: Array<unknown>): never {
  throw new Error(\`throttler is unavailable in single-file edge bundles\`)
}
`
  }

  /**
   * Render `files-deps-stub.ts`, the module `--bundle` maps the `@grammyjs/files` `deps.node.js` entry to.
   *
   * @remarks
   * A deliberately-failing stub: its dependency graph reaches node builtins through dynamic
   * `require()`, which workerd rejects. Mounting `hydrateFiles` never touches these exports —
   * only `ctx.download()` would, and downloading to a filesystem cannot work on Workers anyway.
   *
   * @returns The `files-deps-stub.ts` file content.
   *
   * @internal
   */
  _renderFilesDepStub(): string {
    return `// Node file helpers are unreachable in single-file edge bundles: the
// dependency graph uses dynamic require() of node builtins, which workerd
// rejects. Mounting (hydrateFiles) never touches these; only ctx.download()
// would, and downloading to a filesystem cannot work on Workers anyway.
export class Api {}
export class Context {}
function edgeFileError(): never {
  throw new Error(\`file download is unavailable in single-file edge bundles\`)
}
export function isAbsolutePath(..._args: Array<unknown>): never {
  return edgeFileError()
}
export function createTempFile(..._args: Array<unknown>): never {
  return edgeFileError()
}
export function copyFile(..._args: Array<unknown>): never {
  return edgeFileError()
}
export function downloadFile(..._args: Array<unknown>): never {
  return edgeFileError()
}
export function fetchFile(..._args: Array<unknown>): never {
  return edgeFileError()
}
export function readFile(..._args: Array<unknown>): never {
  return edgeFileError()
}
`
  }
}
