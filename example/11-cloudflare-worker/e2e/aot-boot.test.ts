import {spawnSync} from "node:child_process"
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {Gramstax, TemplateManager} from "gramstax"
import {FixtureCopy} from "./fixture-copy"

const SCRIPT = join(import.meta.dir, `..`, `..`, `..`, `packages`, `gramstax`, `scripts`, `build-manifest.ts`)

let pages: string
let outDir: string
let emptyDir: string

function linkWorkspace(workspaceRoot: string): void {
  const modules = join(workspaceRoot, `node_modules`)
  mkdirSync(modules, {recursive: true})
  const link = join(modules, `gramstax`)
  if (existsSync(link) === false) symlinkSync(join(import.meta.dir, `../node_modules/gramstax`), link, `junction`)
}

beforeEach(() => {
  const src = FixtureCopy.copySrc()
  pages = join(src, `pages`)
  outDir = mkdtempSync(join(tmpdir(), `aot-e2e-out-`))
  linkWorkspace(outDir)
  emptyDir = mkdtempSync(join(tmpdir(), `aot-e2e-empty-`))
})

afterEach(() => {
  rmSync(join(pages, `..`), {force: true, recursive: true})
  rmSync(outDir, {force: true, recursive: true})
  rmSync(emptyDir, {force: true, recursive: true})
})

describe(`E2E: AOT boot without filesystem`, () => {
  it(`serves /start and /info from regenerated frozen modules`, async () => {
    const res = spawnSync(process.execPath, [SCRIPT, pages, outDir, `--aot`], {encoding: `utf-8`, timeout: 120000})
    expect(res.status).toBe(0)
    const base = (await import(pathToFileURL(join(outDir, `manifest.js`)).href)) as {default?: {pages?: unknown[]}}
    const gen = (await import(pathToFileURL(join(outDir, `gen`, `manifest.js`)).href)) as {templates?: Record<string, unknown>}
    const routes = (await import(pathToFileURL(join(outDir, `routes.json`)).href)) as {default?: unknown[]}
    const bot = new Gramstax({
      token: `test`,
      deploy: `test`,
      templateManager: new TemplateManager({path: [emptyDir]}),
      log: false,
      manifest: {pages: base.default?.pages ?? [], templates: [], routes: routes.default ?? []} as never
    })
    for (const key of Object.keys(gen.templates ?? {})) {
      const compiled = (gen.templates as Record<string, Parameters<TemplateManager[`_registerCompiled`]>[1]>)[key]
      if (compiled !== undefined) bot.templateManager._registerCompiled(key, compiled)
    }
    const start = await bot.e2e!.sendText(`/start`, {user: {id: 4001, username: `testuser`, language_code: `en`}})
    expect(start.length).toBeGreaterThan(0)
    expect((start[0] as any).body.rich_message.html).toContain(`Welcome`)
    const info = await bot.e2e!.sendText(`/info`, {user: {id: 4001, username: `testuser`, language_code: `en`}})
    expect(info.length).toBeGreaterThan(0)
    expect((info[0] as any).body.text).toContain(`no filesystem touched`)
  }, 150000)
})
