import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {GramstaxBuild} from "~/cli/build"
import {LambdaTarget} from "~/cli/targets/lambda"
import {E2eHelper} from "~/e2e/helper"
import {Gramstax} from "~/index"
import {generate} from "../scripts/build-manifest"

const FIXTURES = join(import.meta.dir, `fixtures`, `manifest`, `pages`)
const CTX_ABS = pathToFileURL(join(import.meta.dir, `..`, `src`, `core`, `ctx.ts`)).href
const SRC_INDEX = pathToFileURL(join(import.meta.dir, `..`, `src`, `index.ts`)).href
const EDGE_TOKENS = [`new Function`, `Function(`, `eval(`, `node:fs`, `__filename`]

let pages: string
let outDir: string
let savedToken: string | undefined
let savedSecret: string | undefined

function relinkCtx(root: string): void {
  const walk = (dirPath: string): void => {
    for (const entry of readdirSync(dirPath)) {
      const full = join(dirPath, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      if (!full.endsWith(`.ts`)) continue
      writeFileSync(full, readFileSync(full, `utf-8`).replaceAll(`~/core/ctx`, CTX_ABS))
    }
  }
  walk(root)
}

function relinkGramstaxToSrc(file: string): void {
  const source = readFileSync(file, `utf-8`)
  expect(source).toContain(`from "gramstax"`)
  writeFileSync(file, source.replaceAll(`from "gramstax"`, `from "${SRC_INDEX}"`))
}

function startUpdate(): Record<string, unknown> {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: {id: 7, type: `private`},
      from: {id: 7, is_bot: false, first_name: `U`},
      text: `/start`,
      entities: [{offset: 0, length: 6, type: `bot_command`}]
    }
  }
}

function apiGatewayEvent(update: Record<string, unknown>, secret = `test-secret`): Record<string, unknown> {
  return {body: JSON.stringify(update), headers: secret === `` ? {} : {"X-Telegram-Bot-Api-Secret-Token": secret}, httpMethod: `POST`, path: `/webhook`}
}

async function emitLambda(): Promise<{lambdaJs: string; serverDir: string}> {
  generate(pages, outDir, {aot: true})
  const serverDir = join(outDir, `server`)
  const [lambdaJs] = new LambdaTarget().emit(serverDir, join(outDir, `manifest.js`), {adapter: `aws-lambda-async`, url: `https://example.com/webhook`})
  if (lambdaJs === undefined) throw new Error(`emit returned no files`)
  const genDir = join(outDir, `gen`)
  for (const entry of readdirSync(genDir)) {
    if (entry.endsWith(`.g.js`)) relinkGramstaxToSrc(join(genDir, entry))
  }
  relinkGramstaxToSrc(lambdaJs)
  return {lambdaJs, serverDir}
}

type LambdaModule = {
  handler: (event: unknown) => Promise<{statusCode?: unknown}>
  getBot: () => {e2e?: unknown} & Record<string, unknown>
}

async function loadLambda(lambdaJs: string): Promise<LambdaModule> {
  return (await import(pathToFileURL(lambdaJs).href)) as unknown as LambdaModule
}

beforeEach(() => {
  pages = mkdtempSync(join(tmpdir(), `lambda-pages-`))
  cpSync(FIXTURES, pages, {recursive: true})
  relinkCtx(pages)
  outDir = mkdtempSync(join(tmpdir(), `lambda-out-`))
  savedToken = process.env.BOT_TOKEN
  process.env.BOT_TOKEN = `test`
  savedSecret = process.env.BOT_WEBHOOK_SECRET
  process.env.BOT_WEBHOOK_SECRET = `test-secret`
})

afterEach(() => {
  if (savedToken === undefined) delete process.env.BOT_TOKEN
  else process.env.BOT_TOKEN = savedToken
  if (savedSecret === undefined) delete process.env.BOT_WEBHOOK_SECRET
  else process.env.BOT_WEBHOOK_SECRET = savedSecret
  rmSync(pages, {force: true, recursive: true})
  rmSync(outDir, {force: true, recursive: true})
})

describe(`LambdaTarget`, () => {
  it(`emits edge-clean lambda.js`, async () => {
    const {lambdaJs} = await emitLambda()
    expect(existsSync(lambdaJs)).toBe(true)
    const source = readFileSync(lambdaJs, `utf-8`)
    for (const token of EDGE_TOKENS) expect(source).not.toContain(token)
    expect(source).toContain(`export async function handler`)
    expect(source).toContain(`class LambdaEntry`)
    expect(source).toContain(`BOT_WEBHOOK_SECRET`)
    expect(source).toContain(`401`)
    expect(source).toContain(`Unauthorized`)
    expect(source).not.toMatch(/[0-9]{6,}:[A-Za-z0-9_-]{20,}/)
  })

  it(`local invoke routes /start to 200 with template output`, async () => {
    const {lambdaJs} = await emitLambda()
    const mod = await loadLambda(lambdaJs)
    const e2e = new E2eHelper(mod.getBot() as never)
    const first = await mod.handler(apiGatewayEvent(startUpdate()))
    expect(first.statusCode).toBe(200)
    const call = e2e.lastCall(`sendMessage`) as {body?: {text?: string}} | undefined
    expect(call?.body?.text).toContain(`START`)
    const second = await mod.handler(apiGatewayEvent(startUpdate()))
    expect(second.statusCode).toBe(200)
  })

  it(`raw update invokes to 200 without throw`, async () => {
    const {lambdaJs} = await emitLambda()
    const mod = await loadLambda(lambdaJs)
    new E2eHelper(mod.getBot() as never)
    const res = await mod.handler({...startUpdate(), headers: {"X-Telegram-Bot-Api-Secret-Token": `test-secret`}})
    expect(res.statusCode).toBe(200)
  })

  it(`rejects invoke without secret header with 401`, async () => {
    const {lambdaJs} = await emitLambda()
    const mod = await loadLambda(lambdaJs)
    new E2eHelper(mod.getBot() as never)
    const res = await mod.handler(apiGatewayEvent(startUpdate(), ``))
    expect(res.statusCode).toBe(401)
  })

  it(`rejects invoke with wrong secret with 401`, async () => {
    const {lambdaJs} = await emitLambda()
    const mod = await loadLambda(lambdaJs)
    new E2eHelper(mod.getBot() as never)
    const res = await mod.handler(apiGatewayEvent(startUpdate(), `wrong-secret`))
    expect(res.statusCode).toBe(401)
  })

  it(`missing manifest throws clearly`, () => {
    const serverDir = join(outDir, `server`)
    let message = ``
    try {
      new LambdaTarget().emit(serverDir, join(outDir, `no-such-manifest.js`))
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain(`not found`)
  })

  it(`missing routes or gen manifest throws clearly`, () => {
    generate(pages, outDir, {aot: true})
    const serverDir = join(outDir, `server`)
    rmSync(join(outDir, `routes.json`))
    expect(() => new LambdaTarget().emit(serverDir, join(outDir, `manifest.js`))).toThrow(/not found/)
    generate(pages, outDir, {aot: true})
    rmSync(join(outDir, `gen`), {force: true, recursive: true})
    expect(() => new LambdaTarget().emit(serverDir, join(outDir, `manifest.js`))).toThrow(/not found/)
  })

  it(`build --target lambda emits server entry end to end`, async () => {
    const proj = mkdtempSync(join(tmpdir(), `lambda-proj-`))
    try {
      mkdirSync(join(proj, `src`, `pages`), {recursive: true})
      cpSync(pages, join(proj, `src`, `pages`), {recursive: true})
      writeFileSync(join(proj, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {adapter: \`aws-lambda-async\`, url: \`https://example.com/webhook\`, secretToken: \`test-secret\`}}}\n`, `utf-8`)
      const code = await new GramstaxBuild().run([`--target`, `lambda`], proj)
      expect(code).toBe(0)
      expect(existsSync(join(proj, `.gramstax`, `server`, `lambda.js`))).toBe(true)
    } finally {
      rmSync(proj, {force: true, recursive: true})
    }
  })

  it(`unknown target throws clearly`, async () => {
    let message = ``
    try {
      await new GramstaxBuild().run([`--target`, `workers`])
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain(`unknown target`)
  })

  it(`missing BOT_TOKEN throws clearly`, async () => {
    const {lambdaJs} = await emitLambda()
    delete process.env.BOT_TOKEN
    const mod = await loadLambda(lambdaJs)
    let message = ``
    try {
      await mod.handler(apiGatewayEvent(startUpdate()))
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain(`BOT_TOKEN`)
  })

  it(`emitted entry bakes structured serverless deploy`, async () => {
    const {lambdaJs} = await emitLambda()
    const source = readFileSync(lambdaJs, `utf-8`)
    expect(source).toContain(`deploy: "serverless"`)
    expect(source).toContain(`aws-lambda-async`)
    expect(source).toContain(`https://example.com/webhook`)
    expect(source).not.toContain(`BOT_DEPLOY`)
  })

  it(`chains user hookAfterStart before readiness resolves`, async () => {
    const {lambdaJs} = await emitLambda()
    const calls: Array<string> = []
    const proto = Gramstax.prototype as unknown as Record<string, unknown>
    const original = proto.hookAfterStart
    proto.hookAfterStart = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      calls.push(`user`)
    }
    try {
      const mod = await loadLambda(lambdaJs)
      new E2eHelper(mod.getBot() as never)
      const res = await mod.handler(apiGatewayEvent(startUpdate()))
      expect(res.statusCode).toBe(200)
      expect(calls).toEqual([`user`])
    } finally {
      if (original === undefined) delete proto.hookAfterStart
      else proto.hookAfterStart = original
    }
  })
})
