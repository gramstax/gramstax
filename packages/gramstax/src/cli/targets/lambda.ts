import {existsSync, mkdirSync, writeFileSync} from "node:fs"
import {dirname, join, relative, resolve, sep} from "node:path"
import type {BunPlugin} from "bun"

export class LambdaTarget {
  /**
   * Emit the AWS Lambda async serverless target into a directory.
   *
   * @remarks
   * Reads the frozen build artifacts written next to the manifest by `gramstax build` and writes
   * a single `lambda.js` handler file. Import specifiers inside it are made relative to
   * `serverDir`, so the directory must be able to reach the frozen artifacts. There is no
   * `wrangler.toml` equivalent — the deploy configuration lives outside the emitted directory.
   *
   * @param serverDir - Directory that receives `lambda.js`; created recursively when missing.
   * @param manifestRef - Path to the frozen manifest module, which also locates `routes.json` and `gen/manifest.js`.
   * @param opts - Emit overrides: adapter, public webhook URL, passthrough constructor fields, and ref slots.
   * @returns Absolute path of the emitted `lambda.js`.
   * @throws Error when the manifest, `routes.json`, or the AOT `gen/manifest.js` is missing.
   *
   * @internal
   */
  emit(serverDir: string, manifestRef: string, opts?: {adapter?: string; url?: string; passthrough?: Record<string, unknown>; refs?: Array<{slot: string; module: string; specifier?: string; exportName?: string; args: unknown[]}>}): Array<string> {
    const manifestFile = resolve(manifestRef)
    if (existsSync(manifestFile) === false) {
      throw new Error(`Lambda manifest not found at ${manifestFile} (run gramstax build first)`)
    }
    const baseDir = dirname(manifestFile)
    const routesFile = join(baseDir, `routes.json`)
    if (existsSync(routesFile) === false) {
      throw new Error(`Lambda routes not found at ${routesFile} (run gramstax build first)`)
    }
    const genFile = join(baseDir, `gen`, `manifest.js`)
    if (existsSync(genFile) === false) {
      throw new Error(`Lambda AOT manifest not found at ${genFile} (run gramstax build with --aot first)`)
    }
    const dir = resolve(serverDir)
    mkdirSync(dir, {recursive: true})
    const toImport = (abs: string): string => {
      const rel = relative(dir, abs).split(sep).join(`/`)
      return rel.startsWith(`.`) ? rel : `./${rel}`
    }
    const refs = (opts?.refs ?? []).map((ref) => ({...ref, specifier: toImport(ref.module)}))
    const out = join(dir, `lambda.js`)
    writeFileSync(out, this._renderBody(toImport(manifestFile), toImport(genFile), toImport(routesFile), {adapter: opts?.adapter ?? `aws-lambda-async`, url: opts?.url ?? `https://<your-lambda>.example.com/webhook`, passthrough: opts?.passthrough, refs}), `utf-8`)
    return [out]
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
   * Bundle `lambda.js` into `bundle.js`.
   *
   * Lambda runs the emitted file as-is, so a path-ref pointing at TypeScript
   * source cannot be imported by Node. Bundling resolves every specifier —
   * including the user's `.ts` module — ahead of the deployment package.
   * The handler becomes `server/bundle.js`.
   */
  async emitBundle(serverDir: string): Promise<string> {
    if (typeof Bun === `undefined` || typeof Bun.build !== `function`) {
      throw new Error(`--bundle needs the Bun runtime (Bun.build is unavailable here)`)
    }
    const dir = resolve(serverDir)
    const entry = join(dir, `lambda.js`)
    if (existsSync(entry) === false) {
      throw new Error(`Lambda entry not found at ${entry} (run emit first)`)
    }
    const stubTs = join(dir, `bun-stub.ts`)
    writeFileSync(stubTs, this._renderBunStub(), `utf-8`)
    const bunStubPlugin: BunPlugin = {
      name: `gramstax-lambda-bundle-stubs`,
      setup(build) {
        build.onResolve({filter: /^bun$/}, () => ({path: stubTs}))
      }
    }
    const result = await Bun.build({entrypoints: [entry], format: `esm`, target: `node`, plugins: [bunStubPlugin]})
    if (result.success === false) {
      const detail = result.logs
        .map((log) => log.message)
        .join(`
`)
      throw new Error(`bundle failed for ${entry}:
${detail}`)
    }
    const output = result.outputs[0]
    if (output === undefined) throw new Error(`bundle produced no output for ${entry}`)
    const bundleJs = join(dir, `bundle.js`)
    writeFileSync(bundleJs, await output.text(), `utf-8`)
    return bundleJs
  }

  /**
   * Render `bun-stub.ts`, the module `--bundle` maps the `bun` specifier to.
   *
   * @remarks
   * A deliberately-failing stub: `serve` and `env` exist only so the bundler can resolve the
   * `bun` specifier inside the gramstax dist. Both throw on call, which is safe because the status
   * server is never constructed in a serverless deploy — the entry is invoked only through the
   * exported `handler`.
   *
   * @returns The `bun-stub.ts` file content.
   *
   * @internal
   */
  _renderBunStub(): string {
    return `// Bun-only APIs are unreachable in a Lambda deploy. The status server is not
// constructed in serverless mode, so these exist only to satisfy resolution.
const unavailable = (name) => () => {
  throw new Error(name + " is unavailable in a Lambda deploy (it is a Bun-only API)")
}
export const serve = unavailable("Bun.serve")
export const env = unavailable("Bun.env")
export default {serve, env}
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
   * Render the `lambda.js` handler source for an AWS Lambda async deploy.
   *
   * @remarks
   * Emits a `LambdaEntry` class that lazily constructs `Gramstax` with `deploy: "serverless"`
   * from the `BOT_TOKEN` and `BOT_WEBHOOK_SECRET` environment variables, registers the AOT
   * templates through `registerCompiled`, and exports a default `handler`. Unlike the Workers
   * entry, the manifest is passed through whole — pages, templates, and routes — because Node
   * can JIT-compile inline templates. `toProxyEvent` wraps a bare payload into the
   * `{body, headers}` shape, and the handler returns 401 unless the
   * `X-Telegram-Bot-Api-Secret-Token` header matches the env secret, echoing an already-shaped
   * response when `handlerBotUpdate` produces one.
   *
   * @param manifestSpec - Import specifier for the frozen manifest module.
   * @param genSpec - Import specifier for the AOT template registry.
   * @param routesSpec - Import specifier for `routes.json`.
   * @param baked - Adapter, public webhook URL, passthrough fields, and ref slots to inline.
   * @returns The `lambda.js` file content.
   *
   * @internal
   */
  _renderBody(manifestSpec: string, genSpec: string, routesSpec: string, baked?: {adapter: string; url: string; passthrough?: Record<string, unknown>; refs?: Array<{slot: string; specifier: string; exportName?: string; args: unknown[]}>}): string {
    const adapter = JSON.stringify(baked?.adapter ?? `aws-lambda-async`)
    const url = JSON.stringify(baked?.url ?? `https://<your-lambda>.example.com/webhook`)
    return `import {Gramstax, TemplateManager} from "gramstax"
import baseManifest from "${manifestSpec}"
import {templates as aotTemplates} from "${genSpec}"
import routes from "${routesSpec}" with {type: "json"}
${this._renderRefImports(baked?.refs)}

${this._renderPickHelper(baked?.refs)}
class LambdaEntry {
  static bot
  static botReady

  static getBot() {
    if (LambdaEntry.bot === undefined) {
      const token = process.env.BOT_TOKEN
      if (token === undefined || token.length === 0) {
        throw new Error("BOT_TOKEN is not set (required to construct the bot)")
      }
      let resolveReady = () => {}
      LambdaEntry.botReady = new Promise((resolve) => { resolveReady = resolve })
      const readyResolve = resolveReady
      LambdaEntry.bot = new Gramstax({
        token: token,
        deploy: "serverless",
        optionsDeploy: {serverless: {${adapter}: {url: ${url}, secretToken: process.env.BOT_WEBHOOK_SECRET}}},
        templateManager: new TemplateManager({path: []}),${this._renderDefaultLog(baked?.passthrough, baked?.refs)}
        manifest: {pages: baseManifest.pages, templates: baseManifest.templates, routes: routes}${this._renderPassthrough(baked?.passthrough)}${this._renderRefSlots(baked?.refs)}
      })
      for (const key of Object.keys(aotTemplates)) {
        LambdaEntry.bot.templateManager.registerCompiled(key, aotTemplates[key])
      }
      const prevHook = LambdaEntry.bot.hookAfterStart?.bind(LambdaEntry.bot)
      LambdaEntry.bot.hookAfterStart = async () => { await prevHook?.(); readyResolve() }
    }
    return LambdaEntry.bot
  }

  static toProxyEvent(event) {
    if (event !== null && typeof event === "object" && typeof event.body === "string") {
      if (event.headers === undefined || event.headers === null) {
        return Object.assign({}, event, {headers: {}})
      }
      return event
    }
    return {body: JSON.stringify(event ?? {}), headers: {}}
  }

  static async handler(event) {
    const expected = process.env.BOT_WEBHOOK_SECRET
    if (expected === undefined || expected.length === 0) {
      return {statusCode: 401, body: "Unauthorized"}
    }
    const headers = event !== null && typeof event === "object" && event.headers !== null && typeof event.headers === "object" ? event.headers : {}
    const provided = headers["X-Telegram-Bot-Api-Secret-Token"] ?? headers["x-telegram-bot-api-secret-token"]
    if (provided !== expected) {
      return {statusCode: 401, body: "Unauthorized"}
    }
    const instance = LambdaEntry.getBot()
    await LambdaEntry.botReady
    const response = await instance.handlerBotUpdate(LambdaEntry.toProxyEvent(event))
    if (response !== null && typeof response === "object" && "statusCode" in response) {
      return response
    }
    return {statusCode: 200, body: JSON.stringify(response ?? {})}
  }
}

export async function handler(event) {
  return await LambdaEntry.handler(event)
}

export function getBot() {
  return LambdaEntry.getBot()
}
`
  }
}
