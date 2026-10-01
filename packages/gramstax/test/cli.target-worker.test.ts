import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {spawnSync} from "node:child_process"
import {existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {GramstaxBuild} from "~/cli/build"
import {WorkerTarget} from "~/cli/targets/worker"
import {Gramstax} from "~/index"
import {generate} from "../scripts/build-manifest"

const PKG_DIR = join(import.meta.dir, `..`)
const EDGE_TOKENS = [`new Function`, `Function(`, `eval(`, `node:fs`, `__filename`]

const START_JS = `import {Ctx} from "gramstax"
export class WStartPage extends Ctx {
  static data = this.buildData({name: \`start\`})
  async handleCommandText() {
    await this.renderAuto(null, {})
  }
  helper = {}
  static template = \`
    <g-base>
      <g-message>START</g-message>
    </g-base>
  \`
}
`

const USERS_JS = `import {Ctx} from "gramstax"
export class WUsersPage extends Ctx {
  static data = this.buildData({name: \`admin/users\`})
  async handleCommandText() {
    await this.renderAuto(null, {})
  }
  helper = {}
  static template = \`
    <g-base>
      <g-message>USERS</g-message>
    </g-base>
  \`
}
`

let root: string
let pages: string
let outDir: string

function writeJsPages(pagesDir: string): void {
  mkdirSync(pagesDir, {recursive: true})
  writeFileSync(join(pagesDir, `start.js`), START_JS)
  mkdirSync(join(pagesDir, `admin`), {recursive: true})
  writeFileSync(join(pagesDir, `admin`, `users.js`), USERS_JS)
  writeFileSync(join(pagesDir, `card.html`), `<g-base><g-message>CARD</g-message></g-base>\n`)
}

function linkWorkspace(workspaceRoot: string): void {
  const modules = join(workspaceRoot, `node_modules`)
  mkdirSync(modules, {recursive: true})
  const link = join(modules, `gramstax`)
  if (existsSync(link) === false) symlinkSync(PKG_DIR, link, `junction`)
}

function emitWorker(): {serverDir: string; files: string[]} {
  generate(pages, outDir, {aot: true})
  const serverDir = join(outDir, `server`)
  return {files: new WorkerTarget().emit(serverDir, join(outDir, `manifest.js`), {adapter: `cloudflare-mod`, name: `gramstax-worker`, url: `https://example.com/webhook`}), serverDir}
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), `worker-root-`))
  pages = join(root, `pages`)
  writeJsPages(pages)
  linkWorkspace(root)
  outDir = join(root, `.gramstax`)
})

afterEach(() => {
  rmSync(root, {force: true, recursive: true})
})

describe(`WorkerTarget`, () => {
  it(`emits worker.js + wrangler.toml + bun-stub.ts edge-clean`, () => {
    const {serverDir, files} = emitWorker()
    expect(files.map((file) => file.slice(serverDir.length + 1))).toEqual([`worker.js`, `wrangler.toml`, `bun-stub.ts`])
    const workerJs = readFileSync(join(serverDir, `worker.js`), `utf-8`)
    for (const token of EDGE_TOKENS) expect(workerJs).not.toContain(token)
    expect(workerJs).toContain(`export default`)
    expect(workerJs).toContain(`class WorkerEntry`)
    expect(workerJs).toContain(`/webhook`)
    expect(workerJs).toContain(`BOT_TOKEN`)
    expect(workerJs).toContain(`BOT_WEBHOOK_SECRET`)
    expect(workerJs).toContain(`401`)
    expect(workerJs).toContain(`optionsDeploy`)
    expect(workerJs).toContain(`cloudflare-mod`)
    expect(workerJs).not.toContain(`BOT_DEPLOY`)
    const toml = readFileSync(join(serverDir, `wrangler.toml`), `utf-8`)
    expect(toml).not.toContain(`BOT_TOKEN = "`)
    expect(toml).not.toContain(`BOT_DEPLOY`)
    expect(toml).not.toContain(`BOT_DEPLOY`)
    expect(toml).toContain(`wrangler secret put BOT_TOKEN`)
    expect(toml).toContain(`wrangler secret put BOT_WEBHOOK_SECRET`)
    expect(toml).not.toMatch(/[0-9]{6,}:[A-Za-z0-9_-]{20,}/)
    const baked = readFileSync(join(serverDir, `worker.js`), `utf-8`)
    expect(baked).toContain(`cloudflare-mod`)
    const stub = readFileSync(join(serverDir, `bun-stub.ts`), `utf-8`)
    expect(stub).toContain(`Bun.serve is unavailable`)
  })
  it(`emits configured worker name + url with no placeholder url`, () => {
    generate(pages, outDir, {aot: true})
    const serverDir = join(outDir, `server`)
    new WorkerTarget().emit(serverDir, join(outDir, `manifest.js`), {adapter: `cloudflare-mod`, name: `gramstax-cloudflare-example`, url: `https://gramstax-cloudflare-example.damartripamungkas.workers.dev/webhook`})
    const toml = readFileSync(join(serverDir, `wrangler.toml`), `utf-8`)
    expect(toml).toContain(`name = "gramstax-cloudflare-example"`)
    expect(toml).not.toContain(`BOT_DEPLOY`)
    const workerJs = readFileSync(join(serverDir, `worker.js`), `utf-8`)
    expect(workerJs).toContain(`deploy: "serverless"`)
    expect(workerJs).toContain(`cloudflare-mod`)
    expect(workerJs).toContain(`gramstax-cloudflare-example`)
    expect(workerJs).toContain(`https://gramstax-cloudflare-example.damartripamungkas.workers.dev/webhook`)
    expect(workerJs).not.toContain(`https://<your-worker>.workers.dev/webhook`)
    expect(toml).not.toContain(`https://<your-worker>.workers.dev/webhook`)
    expect(toml).not.toContain(`BOT_TOKEN = "`)
    expect(toml).toContain(`wrangler secret put BOT_TOKEN`)
    expect(toml).toContain(`main = "worker.js"`)
  })
  it(`missing manifest throws clearly`, () => {
    let message = ``
    try {
      new WorkerTarget().emit(join(outDir, `server`), join(outDir, `no-such-manifest.js`))
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain(`not found`)
  })

  it(`missing routes or gen manifest throws clearly`, () => {
    generate(pages, outDir, {aot: true})
    const serverDir = join(outDir, `server`)
    rmSync(join(outDir, `routes.json`))
    expect(() => new WorkerTarget().emit(serverDir, join(outDir, `manifest.js`))).toThrow(/not found/)
    generate(pages, outDir, {aot: true})
    rmSync(join(outDir, `gen`), {force: true, recursive: true})
    expect(() => new WorkerTarget().emit(serverDir, join(outDir, `manifest.js`))).toThrow(/not found/)
  })

  it(`wrangler deploy --dry-run exits 0`, () => {
    const {serverDir} = emitWorker()
    const res = spawnSync(`bunx`, [`wrangler`, `deploy`, `--dry-run`, `--config`, join(serverDir, `wrangler.toml`)], {encoding: `utf-8`, timeout: 120000})
    expect(res.status).toBe(0)
  }, 150000)

  it(`build --target cloudflare-workers emits server entry end to end`, async () => {
    const proj = mkdtempSync(join(tmpdir(), `worker-proj-`))
    try {
      writeJsPages(join(proj, `src`, `pages`))
      linkWorkspace(proj)
      writeFileSync(join(proj, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {adapter: \`cloudflare-mod\`, name: \`gramstax-worker\`, url: \`https://example.com/webhook\`, secretToken: \`test-secret\`}}}\n`, `utf-8`)
      const code = await new GramstaxBuild().run([`--target`, `cloudflare-workers`], proj)
      expect(code).toBe(0)
      expect(existsSync(join(proj, `.gramstax`, `server`, `worker.js`))).toBe(true)
      expect(existsSync(join(proj, `.gramstax`, `server`, `wrangler.toml`))).toBe(true)
    } finally {
      rmSync(proj, {force: true, recursive: true})
    }
  }, 120000)

  it(`build --target cloudflare-workers --bundle emits bundle.js end to end`, async () => {
    const proj = mkdtempSync(join(tmpdir(), `worker-bundle-`))
    try {
      writeJsPages(join(proj, `src`, `pages`))
      linkWorkspace(proj)
      writeFileSync(join(proj, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {adapter: \`cloudflare-mod\`, name: \`gramstax-worker\`, url: \`https://example.com/webhook\`, secretToken: \`test-secret\`}}}\n`, `utf-8`)
      const code = await new GramstaxBuild().run([`--target`, `cloudflare-workers`, `--bundle`], proj)
      expect(code).toBe(0)
      expect(existsSync(join(proj, `.gramstax`, `server`, `bundle.js`))).toBe(true)
      expect(readFileSync(join(proj, `.gramstax`, `server`, `wrangler.toml`), `utf-8`)).toContain(`main = "bundle.js"`)
    } finally {
      rmSync(proj, {force: true, recursive: true})
    }
  }, 180000)

  it(`--bundle without workers target fails clearly`, async () => {
    const proj = mkdtempSync(join(tmpdir(), `worker-nobundle-`))
    try {
      writeJsPages(join(proj, `src`, `pages`))
      linkWorkspace(proj)
      writeFileSync(join(proj, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {adapter: \`aws-lambda-async\`, url: \`https://example.com/webhook\`, secretToken: \`test-secret\`}}}\n`, `utf-8`)
      const plain = await new GramstaxBuild().run([`--bundle`], proj)
      expect(plain).toBe(1)
      const lambda = await new GramstaxBuild().run([`--target`, `lambda`, `--bundle`], proj)
      expect(lambda).toBe(1)
    } finally {
      rmSync(proj, {force: true, recursive: true})
    }
  }, 180000)

  it(`chains user hookAfterStart before readiness resolves`, async () => {
    const {serverDir} = emitWorker()
    const srcIndex = pathToFileURL(join(PKG_DIR, `src`, `index.ts`)).href
    const relink = (abs: string): void => {
      writeFileSync(abs, readFileSync(abs, `utf-8`).replaceAll(`from "gramstax"`, `from "${srcIndex}"`))
    }
    relink(join(serverDir, `worker.js`))
    relink(join(outDir, `manifest.js`))
    for (const entry of readdirSync(join(outDir, `gen`))) {
      if (entry.endsWith(`.g.js`)) relink(join(outDir, `gen`, entry))
    }
    const calls: Array<string> = []
    const proto = Gramstax.prototype as unknown as Record<string, unknown>
    const original = proto.hookAfterStart
    proto.hookAfterStart = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      calls.push(`user`)
    }
    try {
      const mod = (await import(pathToFileURL(join(serverDir, `worker.js`)).href)) as unknown as {
        default: {fetch: (request: Request, env: Record<string, string>) => Promise<Response>}
        getBot: (env: Record<string, string>) => unknown
      }
      const {E2eHelper: Helper} = await import(`~/e2e/helper`)
      new Helper(mod.getBot({BOT_TOKEN: `test`, BOT_WEBHOOK_SECRET: `test-secret`}) as never)
      const res = await mod.default.fetch(
        new Request(`https://example.com/webhook`, {
          method: `POST`,
          headers: {"Content-Type": `application/json`, "X-Telegram-Bot-Api-Secret-Token": `test-secret`},
          body: JSON.stringify({update_id: 1})
        }),
        {BOT_TOKEN: `test`, BOT_WEBHOOK_SECRET: `test-secret`}
      )
      expect(res.status).toBe(200)
      expect(calls).toEqual([`user`])
    } finally {
      if (original === undefined) delete proto.hookAfterStart
      else proto.hookAfterStart = original
    }
  }, 120000)

  it(`rejects webhook fetch without secret with 401`, async () => {
    const {serverDir} = emitWorker()
    const srcIndex = pathToFileURL(join(PKG_DIR, `src`, `index.ts`)).href
    const workerJs = join(serverDir, `worker.js`)
    writeFileSync(workerJs, readFileSync(workerJs, `utf-8`).replaceAll(`from "gramstax"`, `from "${srcIndex}"`))
    const mod = (await import(pathToFileURL(workerJs).href)) as unknown as {
      default: {fetch: (request: Request, env: Record<string, string>) => Promise<Response>}
    }
    const res = await mod.default.fetch(
      new Request(`https://example.com/webhook`, {
        method: `POST`,
        headers: {"Content-Type": `application/json`},
        body: JSON.stringify({update_id: 1})
      }),
      {BOT_TOKEN: `test`, BOT_WEBHOOK_SECRET: `test-secret`}
    )
    expect(res.status).toBe(401)
  }, 120000)

  it(`rejects webhook fetch with wrong secret with 401`, async () => {
    const {serverDir} = emitWorker()
    const srcIndex = pathToFileURL(join(PKG_DIR, `src`, `index.ts`)).href
    const workerJs = join(serverDir, `worker.js`)
    writeFileSync(workerJs, readFileSync(workerJs, `utf-8`).replaceAll(`from "gramstax"`, `from "${srcIndex}"`))
    const mod = (await import(pathToFileURL(workerJs).href)) as unknown as {
      default: {fetch: (request: Request, env: Record<string, string>) => Promise<Response>}
    }
    const res = await mod.default.fetch(
      new Request(`https://example.com/webhook`, {
        method: `POST`,
        headers: {"Content-Type": `application/json`, "X-Telegram-Bot-Api-Secret-Token": `wrong-secret`},
        body: JSON.stringify({update_id: 1})
      }),
      {BOT_TOKEN: `test`, BOT_WEBHOOK_SECRET: `test-secret`}
    )
    expect(res.status).toBe(401)
  }, 120000)

  it(`rejects webhook fetch when secret binding is missing with 401`, async () => {
    const {serverDir} = emitWorker()
    const srcIndex = pathToFileURL(join(PKG_DIR, `src`, `index.ts`)).href
    const workerJs = join(serverDir, `worker.js`)
    writeFileSync(workerJs, readFileSync(workerJs, `utf-8`).replaceAll(`from "gramstax"`, `from "${srcIndex}"`))
    const mod = (await import(pathToFileURL(workerJs).href)) as unknown as {
      default: {fetch: (request: Request, env: Record<string, string>) => Promise<Response>}
    }
    const res = await mod.default.fetch(
      new Request(`https://example.com/webhook`, {
        method: `POST`,
        headers: {"Content-Type": `application/json`, "X-Telegram-Bot-Api-Secret-Token": `test-secret`},
        body: JSON.stringify({update_id: 1})
      }),
      {BOT_TOKEN: `test`}
    )
    expect(res.status).toBe(401)
  }, 120000)

  it(`--bundle emits single-file bundle.js with routes inlined`, async () => {
    const {serverDir} = emitWorker()
    const bundleJs = await new WorkerTarget().emitBundle(serverDir)
    expect(existsSync(bundleJs)).toBe(true)
    const source = readFileSync(bundleJs, `utf-8`)
    expect(source).toContain(`start`)
    expect(source).not.toMatch(/from\s+["']\.\.\//)
    expect(source).not.toMatch(/from\s+["']\.\//)
    expect(source).not.toContain(`@redis/client`)
    expect(source).not.toContain(`from"chokidar"`)
    expect(source).not.toContain(`from "chokidar"`)
    expect(source).not.toContain(`bottleneck`)
    expect(source).not.toContain(`deps.node`)
    expect(existsSync(join(serverDir, `redis-stub.ts`))).toBe(true)
    expect(existsSync(join(serverDir, `chokidar-stub.ts`))).toBe(true)
    expect(existsSync(join(serverDir, `throttler-stub.ts`))).toBe(true)
    expect(existsSync(join(serverDir, `files-deps-stub.ts`))).toBe(true)
    const toml = readFileSync(join(serverDir, `wrangler.toml`), `utf-8`)
    expect(toml).toContain(`main = "bundle.js"`)
  }, 180000)

  it(`bundle boots and renders with Function sabotaged (edge proof)`, async () => {
    const {serverDir} = emitWorker()
    const bundleJs = await new WorkerTarget().emitBundle(serverDir)
    const RealFunction = globalThis.Function
    globalThis.Function = (() => {
      throw new Error(`codegen disabled on edge`)
    }) as unknown as FunctionConstructor
    try {
      const mod = (await import(pathToFileURL(bundleJs).href)) as unknown as {
        default: {fetch: (request: Request, env: Record<string, string>) => Promise<Response>}
        getBot: (env: Record<string, string>) => unknown
      }
      const {E2eHelper: Helper} = await import(`~/e2e/helper`)
      new Helper(mod.getBot({BOT_TOKEN: `test`, BOT_WEBHOOK_SECRET: `test-secret`}) as never)
      const res = await mod.default.fetch(
        new Request(`https://example.com/webhook`, {
          method: `POST`,
          headers: {"Content-Type": `application/json`, "X-Telegram-Bot-Api-Secret-Token": `test-secret`},
          body: JSON.stringify({update_id: 1})
        }),
        {BOT_TOKEN: `test`, BOT_WEBHOOK_SECRET: `test-secret`}
      )
      expect(res.status).toBe(200)
    } finally {
      globalThis.Function = RealFunction
    }
  }, 180000)
})
