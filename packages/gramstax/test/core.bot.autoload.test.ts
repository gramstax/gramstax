import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {generate} from "../scripts/build-manifest"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"

const FIXTURES = join(import.meta.dir, `fixtures`, `manifest`, `pages`)
const CTX_ABS = pathToFileURL(join(import.meta.dir, `..`, `src`, `core`, `ctx.ts`)).href
const DEPLOY = `serverless`
const DEPLOY_OPTS = {serverless: {adapter: `cloudflare-mod`, url: `https://example.com/webhook`, secretToken: `test-secret`}}

let root: string
let cwd: string

function relinkCtx(dir: string): void {
  const walk = (dirPath: string): void => {
    for (const entry of readdirSync(dirPath)) {
      const full = join(dirPath, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      if (full.endsWith(`.ts`)) {
        writeFileSync(full, readFileSync(full, `utf-8`).replaceAll(`~/core/ctx`, CTX_ABS))
      }
    }
  }
  walk(dir)
}

beforeEach(() => {
  cwd = process.cwd()
  root = mkdtempSync(join(tmpdir(), `autoload-`))
  const pages = join(root, `pages`)
  cpSync(FIXTURES, pages, {recursive: true})
  relinkCtx(pages)
  generate(pages, join(root, `.gramstax`), {aot: true})
  process.chdir(root)
})

afterEach(() => {
  process.chdir(cwd)
  rmSync(root, {force: true, recursive: true})
})

function snapRoutes(bot: Gramstax): Array<string> {
  return Object.keys(bot.pages.all).sort()
}

describe(`manifest autoload from deploy`, () => {
  it(`serverless deploy without manifest boots from .gramstax`, async () => {
    const auto = new Gramstax({token: `test`, deploy: DEPLOY, optionsDeploy: DEPLOY_OPTS, templateManager: new TemplateManager({path: []}), log: false})
    const routes = snapRoutes(auto)
    expect(routes.length).toBeGreaterThan(0)
    expect(routes).toContain(`start`)
    const loaded = (await import(pathToFileURL(join(root, `.gramstax`, `manifest.js`)).href)).default
    const explicit = new Gramstax({token: `test`, deploy: DEPLOY, optionsDeploy: DEPLOY_OPTS, templateManager: new TemplateManager({path: []}), log: false, manifest: loaded})
    expect(snapRoutes(auto)).toEqual(snapRoutes(explicit))
  })

  it(`serverless deploy without .gramstax falls back to previous behavior`, () => {
    rmSync(join(root, `.gramstax`), {force: true, recursive: true})
    expect(() => new Gramstax({token: `test`, deploy: DEPLOY, optionsDeploy: DEPLOY_OPTS, templateManager: new TemplateManager({path: []}), log: false})).toThrow()
  })

  it(`polling deploy ignores .gramstax and uses fs boot`, () => {
    expect(
      () =>
        new Gramstax({token: `test`, deploy: `polling`, templateManager: new TemplateManager({path: [join(root, `no-such-dir`)]}), log: false})
    ).toThrow()
  })
})
