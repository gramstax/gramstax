import {existsSync, mkdirSync, writeFileSync} from "node:fs"
import {dirname, join, relative, resolve, sep} from "node:path"

export class LambdaTarget {
  emit(serverDir: string, manifestRef: string, opts?: {adapter?: string; url?: string}): Array<string> {
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
    const out = join(dir, `lambda.js`)
    writeFileSync(out, this._renderBody(toImport(manifestFile), toImport(genFile), toImport(routesFile), {adapter: opts?.adapter ?? `aws-lambda-async`, url: opts?.url ?? `https://<your-lambda>.example.com/webhook`}), `utf-8`)
    return [out]
  }

  _renderBody(manifestSpec: string, genSpec: string, routesSpec: string, baked?: {adapter: string; url: string}): string {
    const adapter = JSON.stringify(baked?.adapter ?? `aws-lambda-async`)
    const url = JSON.stringify(baked?.url ?? `https://<your-lambda>.example.com/webhook`)
    return `import {Gramstax, TemplateManager} from "gramstax"
import baseManifest from "${manifestSpec}"
import {templates as aotTemplates} from "${genSpec}"
import routes from "${routesSpec}" with {type: "json"}

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
        optionsDeploy: {serverless: {adapter: ${adapter}, url: ${url}, secretToken: process.env.TELEGRAM_WEBHOOK_SECRET}},
        templateManager: new TemplateManager({path: []}),
        log: false,
        manifest: {pages: baseManifest.pages, templates: baseManifest.templates, routes: routes}
      })
      for (const key of Object.keys(aotTemplates)) {
        LambdaEntry.bot.templateManager._registerCompiled(key, aotTemplates[key])
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
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET
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
