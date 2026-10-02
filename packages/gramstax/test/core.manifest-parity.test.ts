import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"
import type {IAppManifest} from "~/types/manifest"

const FIXTURES = join(import.meta.dir, `fixtures`, `manifest`, `pages`)
const CTX_ABS = pathToFileURL(join(import.meta.dir, `..`, `src`, `core`, `ctx.ts`)).href

let dir: string
let manifestDir: string
let emptyDir: string

function snapPages(bot: Gramstax) {
  const p = bot.pages
  const norm = (v: unknown): string => JSON.stringify(v, Object.keys((v ?? {}) as object).sort())
  return {
    all: Object.keys(bot.pages.all).sort(),
    routeStatic: norm(p.routeStatic),
    routeStaticIntent: norm(p.routeStaticIntent),
    routeStaticSession: norm(p.routeStaticSession),
    routeDynamic: norm(p.routeDynamic),
    routeDynamicSpesific: norm(p.routeDynamicSpesific)
  }
}

function templateKeys(bot: Gramstax) {
  const tm = bot.templateManager
  return [...tm.keysCompiled()].sort()
}

async function buildManifest(root: string): Promise<IAppManifest> {
  const start = (await import(join(root, `start.ts`))) as {MStartPage: typeof import("~/core/ctx").Ctx}
  const users = (await import(join(root, `admin`, `users.ts`))) as {MUsersPage: typeof import("~/core/ctx").Ctx}
  const card = (await import(join(root, `card.ts`))) as {MCardPage: typeof import("~/core/ctx").Ctx}
  return {
    pages: [
      {path: `src/pages/start.ts`, routeName: `start`, page: start.MStartPage},
      {path: `src/pages/admin/users.ts`, routeName: `admin/users`, page: users.MUsersPage},
      {path: `src/pages/card.ts`, routeName: `card`, page: card.MCardPage}
    ],
    templates: [{key: `card`, template: readFileSync(join(root, `card.html`), `utf-8`)}]
  }
}

function relinkCtx(root: string) {
  const walk = (dirPath: string) => {
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

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), `manifest-disk-`))
  cpSync(FIXTURES, dir, {recursive: true})
  relinkCtx(dir)
  manifestDir = mkdtempSync(join(tmpdir(), `manifest-src-`))
  cpSync(FIXTURES, manifestDir, {recursive: true})
  relinkCtx(manifestDir)
  emptyDir = mkdtempSync(join(tmpdir(), `manifest-empty-`))
})

afterEach(() => {
  rmSync(dir, {recursive: true, force: true})
  rmSync(manifestDir, {recursive: true, force: true})
  rmSync(emptyDir, {recursive: true, force: true})
})

describe(`manifest boot parity`, () => {
  it(`registers identical routing tables from disk and from manifest`, async () => {
    const diskBot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [dir]}), log: false})
    const manifest = await buildManifest(manifestDir)
    const manifestBot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [emptyDir]}), log: false, manifest})
    expect(snapPages(manifestBot)).toEqual(snapPages(diskBot))
  })

  it(`compiles identical template keys from disk and from manifest`, async () => {
    const diskBot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [dir]}), log: false})
    const manifest = await buildManifest(manifestDir)
    const manifestBot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [emptyDir]}), log: false, manifest})
    expect(templateKeys(manifestBot)).toEqual(templateKeys(diskBot))
  })

  it(`serves the same route output from disk and from manifest`, async () => {
    const diskBot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [dir]}), log: false})
    const manifest = await buildManifest(manifestDir)
    const manifestBot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [emptyDir]}), log: false, manifest})
    const fromDisk = await diskBot.e2e!.sendText(`/start`)
    const fromManifest = await manifestBot.e2e!.sendText(`/start`)
    expect(fromManifest.length).toBeGreaterThan(0)
    expect((fromManifest[0] as any).body.text).toBe((fromDisk[0] as any).body.text)
  })
})
