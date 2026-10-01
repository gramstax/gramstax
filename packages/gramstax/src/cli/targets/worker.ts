import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs"
import {builtinModules} from "node:module"
import {dirname, join, relative, resolve, sep} from "node:path"
import type {BunPlugin} from "bun"

export class WorkerTarget {
  emit(serverDir: string, manifestRef: string, opts?: {adapter?: string; name?: string; url?: string}): Array<string> {
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
    const workerJs = join(dir, `worker.js`)
    writeFileSync(workerJs, this._renderWorker(toImport(manifestFile), toImport(genFile), toImport(routesFile), {adapter, name, url}), `utf-8`)
    const toml = join(dir, `wrangler.toml`)
    writeFileSync(toml, this._renderToml(name), `utf-8`)
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

  _renderWorker(manifestSpec: string, genSpec: string, routesSpec: string, baked?: {adapter: string; name: string; url: string}): string {
    const adapter = JSON.stringify(baked?.adapter ?? `cloudflare-mod`)
    const name = JSON.stringify(baked?.name ?? `gramstax-worker`)
    const url = JSON.stringify(baked?.url ?? `https://<your-worker>.workers.dev/webhook`)
    return `import {Gramstax, TemplateManager} from "gramstax"
import baseManifest from "${manifestSpec}"
import {templates as aotTemplates} from "${genSpec}"
import routes from "${routesSpec}"

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
        optionsDeploy: {serverless: {adapter: ${adapter}, name: ${name}, url: ${url}, secretToken: env === null || env === undefined ? undefined : env.BOT_WEBHOOK_SECRET}},
        templateManager: new TemplateManager({path: []}),
        log: false,
        manifest: {pages: baseManifest.pages, templates: [], routes: routes},
        botConfig: botConfig
      })
      for (const key of Object.keys(aotTemplates)) {
        WorkerEntry.bot.templateManager._registerCompiled(key, aotTemplates[key])
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

  _renderToml(name: string): string {
    return `name = "${name}"
main = "worker.js"
compatibility_date = "2026-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
# BOT_TOKEN is a secret, never a var: a [vars] entry here would shadow the
# real secret at runtime (verified live: placeholder var caused error 1101).
# Set it via: wrangler secret put BOT_TOKEN --config <this file>
# BOT_WEBHOOK_SECRET is a secret, never a var: same shadowing rule.
# Set it via: wrangler secret put BOT_WEBHOOK_SECRET --config <this file>
# Deploy values are baked into worker.js optionsDeploy at build time.

[alias]
"bun" = "./bun-stub.ts"
`
  }

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
