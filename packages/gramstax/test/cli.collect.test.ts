import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {RouteCollector} from "~/cli/collect"
import {Gramstax} from "~/core/bot"
import type {ITAppManifest} from "~/page/manifest"
import {PageManager} from "~/page/manager"
import {TemplateManager} from "~/template/manager"

const FIXTURES = join(import.meta.dir, `fixtures`, `manifest`, `pages`)
const CTX_ABS = pathToFileURL(join(import.meta.dir, `..`, `src`, `core`, `ctx.ts`)).href

let dir: string
let diskDir: string
let manifestDir: string
let emptyDir: string

function pageSource(className: string, name: string): string {
  return `import {Ctx} from "${CTX_ABS}"\nexport class ${className} extends Ctx {\n  static data = this.buildData({name: \`${name}\`})\n  helper = {}\n}\n`
}

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

function snapPages(bot: Gramstax): unknown {
  const seen = bot.pages as unknown as {routeStatic: unknown; routeStaticIntent: unknown; routeStaticSession: unknown; routeDynamic: unknown; routeDynamicSpesific: unknown}
  const norm = (value: unknown): string => JSON.stringify(value, Object.keys((value ?? {}) as object).sort())
  return {
    all: Object.keys(bot.pages.all).sort(),
    routeDynamic: norm(seen.routeDynamic),
    routeDynamicSpesific: norm(seen.routeDynamicSpesific),
    routeStatic: norm(seen.routeStatic),
    routeStaticIntent: norm(seen.routeStaticIntent),
    routeStaticSession: norm(seen.routeStaticSession)
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), `collect-pages-`))
  diskDir = mkdtempSync(join(tmpdir(), `collect-disk-`))
  manifestDir = mkdtempSync(join(tmpdir(), `collect-src-`))
  emptyDir = mkdtempSync(join(tmpdir(), `collect-empty-`))
})

afterEach(() => {
  rmSync(dir, {force: true, recursive: true})
  rmSync(diskDir, {force: true, recursive: true})
  rmSync(manifestDir, {force: true, recursive: true})
  rmSync(emptyDir, {force: true, recursive: true})
})

describe(`RouteCollector`, () => {
  it(`collects routes with parent mirror and nested paths`, () => {
    writeFileSync(join(dir, `start.ts`), pageSource(`TStartPage`, `start`))
    mkdirSync(join(dir, `shop`), {recursive: true})
    writeFileSync(join(dir, `shop`, `index.ts`), pageSource(`TShopPage`, `shop`))
    writeFileSync(join(dir, `shop`, `cart.ts`), pageSource(`TCartPage`, `shop/cart`))
    writeFileSync(join(dir, `shop`, `index.html`), `<g-base><g-message>SHOP</g-message></g-base>`)
    const routes = new RouteCollector().collect(dir).sort((left, right) => (left.file < right.file ? -1 : 1))
    expect(routes).toEqual([
      {file: `shop/cart.ts`, name: `TCartPage`, routeName: `shop/cart`},
      {file: `shop/index.ts`, name: `TShopPage`, routeName: `shop`},
      {file: `start.ts`, name: `TStartPage`, routeName: `start`}
    ])
  })

  it(`duplicate routeName throws`, () => {
    writeFileSync(join(dir, `dup.ts`), pageSource(`TDupTsPage`, `dup`))
    writeFileSync(join(dir, `dup.js`), pageSource(`TDupJsPage`, `dup`))
    let message = ``
    try {
      new RouteCollector().collect(dir)
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain(`dup`)
  })

  it(`file-vs-folder conflict rejects`, () => {
    writeFileSync(join(dir, `clash.ts`), pageSource(`TClashPage`, `clash`))
    mkdirSync(join(dir, `clash`), {recursive: true})
    writeFileSync(join(dir, `clash`, `index.ts`), pageSource(`TClashIndexPage`, `clash`))
    let message = ``
    try {
      new RouteCollector().collect(dir)
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain(`Duplicate page`)
  })

  it(`writes routes.json atomically`, () => {
    writeFileSync(join(dir, `start.ts`), pageSource(`TStartPage`, `start`))
    const collector = new RouteCollector()
    const routes = collector.collect(dir)
    const outDir = join(dir, `.gramstax`)
    collector.write(outDir, routes)
    const written = join(outDir, `routes.json`)
    expect(existsSync(written)).toBe(true)
    expect(existsSync(join(outDir, `routes.json.tmp`))).toBe(false)
    expect(JSON.parse(readFileSync(written, `utf-8`))).toEqual(routes)
  })

  it(`manifest.routes boot deep-equals fs boot with zero fs walk`, async () => {
    cpSync(FIXTURES, diskDir, {recursive: true})
    cpSync(FIXTURES, manifestDir, {recursive: true})
    relinkCtx(diskDir)
    relinkCtx(manifestDir)
    const routes = new RouteCollector().collect(manifestDir)
    expect(routes.map((entry) => entry.routeName).sort()).toEqual([`admin/users`, `card`, `start`])
    const start = (await import(join(manifestDir, `start.ts`))) as {MStartPage: typeof import("~/core/ctx").Ctx}
    const users = (await import(join(manifestDir, `admin`, `users.ts`))) as {MUsersPage: typeof import("~/core/ctx").Ctx}
    const card = (await import(join(manifestDir, `card.ts`))) as {MCardPage: typeof import("~/core/ctx").Ctx}
    const manifest: ITAppManifest = {
      pages: [
        {path: `src/pages/start.ts`, routeName: `start`, page: start.MStartPage},
        {path: `src/pages/admin/users.ts`, routeName: `admin/users`, page: users.MUsersPage},
        {path: `src/pages/card.ts`, routeName: `card`, page: card.MCardPage}
      ],
      routes,
      templates: [{key: `card`, template: readFileSync(join(manifestDir, `card.html`), `utf-8`)}]
    }
    const calls: string[] = []
    const original = PageManager.getFileManySync
    PageManager.getFileManySync = ((path?: string, positionModule = 0): ReturnType<typeof original> => {
      calls.push(path ?? ``)
      return original.call(PageManager, path, positionModule)
    }) as typeof original
    try {
      const diskBot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [diskDir]}), log: false})
      const manifestBot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [emptyDir]}), log: false, manifest})
      expect(snapPages(manifestBot)).toEqual(snapPages(diskBot))
      const fromDisk = await diskBot.e2e!.sendText(`/start`)
      const fromManifest = await manifestBot.e2e!.sendText(`/start`)
      expect(fromManifest.length).toBeGreaterThan(0)
      expect((fromManifest[0] as any).body.text).toBe((fromDisk[0] as any).body.text)
      expect(calls.filter((path) => path === emptyDir)).toEqual([])
    } finally {
      PageManager.getFileManySync = original
    }
  })

  it(`manifest.routes entry without matching page throws`, () => {
    const manifest: ITAppManifest = {pages: [], routes: [{file: `ghost.ts`, name: `TGhostPage`, routeName: `ghost`}], templates: []}
    let message = ``
    try {
      new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [emptyDir]}), log: false, manifest})
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain(`ghost`)
  })
})
