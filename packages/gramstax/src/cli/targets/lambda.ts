import {existsSync, mkdirSync, writeFileSync} from "node:fs"
import {dirname, join, relative, resolve, sep} from "node:path"
import type {BunPlugin} from "bun"

export class LambdaTarget {
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

  _renderRefImports(refs: Array<{specifier: string}> | undefined): string {
    if (refs === undefined || refs.length === 0) return ``
    return refs
      .map((ref, index) => `import * as __ref${index} from "${ref.specifier}"`)
      .join(`
`)
  }

  _renderPickHelper(refs: Array<unknown> | undefined): string {
    if (refs === undefined || refs.length === 0) return ``
    return `const __pick = (mod, name, args) => {
  const value = name === undefined ? (mod.default ?? Object.values(mod)[0]) : mod[name]
  if (value === undefined) throw new Error("gramstax serverless ref: no export for " + String(name))
  return typeof value === "function" ? new value(...args) : value
}
`
  }

  _renderRefSlots(refs: Array<{slot: string; exportName?: string; args: unknown[]}> | undefined): string {
    if (refs === undefined || refs.length === 0) return ``
    return refs
      .map(
        (ref, index) => `,
        ${ref.slot}: __pick(__ref${index}, ${ref.exportName === undefined ? `undefined` : JSON.stringify(ref.exportName)}, ${JSON.stringify(ref.args)})`
      )
      .join(``)
  }

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
