import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {GramstaxBuild} from "~/cli/build"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"
import type {IAppManifest} from "~/types/manifest"
import {generate} from "../scripts/build-manifest"

const FIXTURES = join(import.meta.dir, `fixtures`, `manifest`, `pages`)
const CTX_ABS = pathToFileURL(join(import.meta.dir, `..`, `src`, `core`, `ctx.ts`)).href

let helloDir: string
let diskDir: string
let htmlDiskDir: string
let htmlGenDir: string
let emptyDir: string

function pageSource(className: string, name: string, message: string): string {
  return `import {Ctx} from "${CTX_ABS}"\nexport class ${className} extends Ctx {\n  static data = this.buildData({name: \`${name}\`})\n  async handleCommandText() {\n    await this.renderAuto(null, {})\n  }\n  helper = {}\n  static template = \`\n    <g-base>\n      <g-message>${message}</g-message>\n    </g-base>\n  \`\n}\n`
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

function captureConsole(): {logs: string[]; errors: string[]; restore: () => void} {
  const logs: string[] = []
  const errors: string[] = []
  const originalLog = console.log
  const originalError = console.error
  console.log = (...args: unknown[]): void => {
    logs.push(args.map((arg) => String(arg)).join(` `))
  }
  console.error = (...args: unknown[]): void => {
    errors.push(args.map((arg) => String(arg)).join(` `))
  }
  return {
    errors,
    logs,
    restore: (): void => {
      console.log = originalLog
      console.error = originalError
    }
  }
}

async function loadManifestJs(outDir: string): Promise<IAppManifest> {
  const loaded = (await import(pathToFileURL(join(outDir, `manifest.js`)).href)) as {default?: IAppManifest}
  const manifest = loaded.default
  if (manifest === undefined) throw new Error(`manifest.js has no default export`)
  return manifest
}

beforeEach(() => {
  helloDir = mkdtempSync(join(tmpdir(), `parity-hello-`))
  writeFileSync(join(helloDir, `start.ts`), pageSource(`HStartPage`, `start`, `HSTART`))
  writeFileSync(join(helloDir, `hello.ts`), pageSource(`HHelloPage`, `hello`, `HHELLO`))
  diskDir = mkdtempSync(join(tmpdir(), `parity-hello-disk-`))
  writeFileSync(join(diskDir, `start.ts`), pageSource(`HStartPage`, `start`, `HSTART`))
  writeFileSync(join(diskDir, `hello.ts`), pageSource(`HHelloPage`, `hello`, `HHELLO`))
  htmlDiskDir = mkdtempSync(join(tmpdir(), `parity-html-disk-`))
  cpSync(FIXTURES, htmlDiskDir, {recursive: true})
  relinkCtx(htmlDiskDir)
  htmlGenDir = mkdtempSync(join(tmpdir(), `parity-html-gen-`))
  cpSync(FIXTURES, htmlGenDir, {recursive: true})
  relinkCtx(htmlGenDir)
  emptyDir = mkdtempSync(join(tmpdir(), `parity-empty-`))
})

afterEach(() => {
  rmSync(helloDir, {force: true, recursive: true})
  rmSync(diskDir, {force: true, recursive: true})
  rmSync(htmlDiskDir, {force: true, recursive: true})
  rmSync(htmlGenDir, {force: true, recursive: true})
  rmSync(emptyDir, {force: true, recursive: true})
})

describe(`gramstax build parity`, () => {
  it(`generate emits manifest.js and routes.json`, () => {
    const outDir = mkdtempSync(join(tmpdir(), `parity-out-`))
    try {
      const stats = generate(helloDir, outDir)
      expect(stats).toEqual({pages: 2, routes: 2, templates: 0})
      const manifestJs = readFileSync(join(outDir, `manifest.js`), `utf-8`)
      expect(manifestJs).not.toContain(`import type`)
      expect(manifestJs).toContain(`export const manifest = {`)
      expect(manifestJs).toContain(`HStartPage`)
      const routes = JSON.parse(readFileSync(join(outDir, `routes.json`), `utf-8`)) as Array<{routeName: string}>
      expect(routes.map((entry) => entry.routeName).sort()).toEqual([`hello`, `start`])
    } finally {
      rmSync(outDir, {force: true, recursive: true})
    }
  })

  it(`full build emits artifacts with summary`, async () => {
    const proj = mkdtempSync(join(tmpdir(), `parity-proj-`))
    const capture = captureConsole()
    try {
      mkdirSync(join(proj, `src`, `pages`), {recursive: true})
      cpSync(helloDir, join(proj, `src`, `pages`), {recursive: true})
      const code = await new GramstaxBuild().run([], proj)
      expect(code).toBe(0)
      const printed = capture.logs.join(`\n`)
      expect(printed).toContain(`complete`)
      expect(printed).toContain(`pages: 2`)
      expect(printed).toContain(`routes: 2`)
      expect(existsSync(join(proj, `.gramstax`, `manifest.js`))).toBe(true)
      expect(existsSync(join(proj, `.gramstax`, `routes.json`))).toBe(true)
    } finally {
      capture.restore()
      rmSync(proj, {force: true, recursive: true})
    }
  })

  it(`helloworld fs boot vs manifest boot parity`, async () => {
    const outDir = mkdtempSync(join(tmpdir(), `parity-out-`))
    try {
      generate(helloDir, outDir)
      const manifest = await loadManifestJs(outDir)
      const diskBot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [diskDir]}), log: false})
      const manifestBot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [emptyDir]}), log: false, manifest})
      expect(snapPages(manifestBot)).toEqual(snapPages(diskBot))
      const fromDisk = await diskBot.e2e!.sendText(`/start`)
      const fromManifest = await manifestBot.e2e!.sendText(`/start`)
      expect(fromManifest.length).toBeGreaterThan(0)
      expect((fromManifest[0] as any).body.text).toBe((fromDisk[0] as any).body.text)
    } finally {
      rmSync(outDir, {force: true, recursive: true})
    }
  })

  it(`html-project fs boot vs manifest boot parity`, async () => {
    const outDir = mkdtempSync(join(tmpdir(), `parity-out-`))
    try {
      const stats = generate(htmlGenDir, outDir)
      expect(stats).toEqual({pages: 3, routes: 3, templates: 1})
      const manifest = await loadManifestJs(outDir)
      const diskBot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [htmlDiskDir]}), log: false})
      const manifestBot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [emptyDir]}), log: false, manifest})
      expect(snapPages(manifestBot)).toEqual(snapPages(diskBot))
      const fromDisk = await diskBot.e2e!.sendText(`/start`)
      const fromManifest = await manifestBot.e2e!.sendText(`/start`)
      expect(fromManifest.length).toBeGreaterThan(0)
      expect((fromManifest[0] as any).body.text).toBe((fromDisk[0] as any).body.text)
    } finally {
      rmSync(outDir, {force: true, recursive: true})
    }
  })

  it(`raw project skips with exit 0 and writes nothing`, async () => {
    const proj = mkdtempSync(join(tmpdir(), `parity-raw-`))
    const capture = captureConsole()
    try {
      const code = await new GramstaxBuild().run([`--raw`], proj)
      expect(code).toBe(0)
      const printed = capture.logs.join(`\n`)
      expect(printed).toContain(`skip`)
      expect(printed).toContain(`raw`)
      expect(existsSync(join(proj, `.gramstax`))).toBe(false)
    } finally {
      capture.restore()
      rmSync(proj, {force: true, recursive: true})
    }
  })

  it(`missing src/pages without --raw stays an error`, async () => {
    const proj = mkdtempSync(join(tmpdir(), `parity-missing-`))
    const capture = captureConsole()
    try {
      const code = await new GramstaxBuild().run([], proj)
      expect(code).not.toBe(0)
      expect(capture.logs.join(`\n`)).toContain(`pages directory`)
    } finally {
      capture.restore()
      rmSync(proj, {force: true, recursive: true})
    }
  })

  it(`broken page fails the build with exit 1`, async () => {
    const proj = mkdtempSync(join(tmpdir(), `parity-bad-`))
    const capture = captureConsole()
    try {
      mkdirSync(join(proj, `src`, `pages`), {recursive: true})
      writeFileSync(join(proj, `src`, `pages`, `bad.ts`), `export class Broken {{\n`)
      const code = await new GramstaxBuild().run([], proj)
      expect(code).toBe(1)
      expect(capture.logs.join(`\n`)).toContain(`failed`)
    } finally {
      capture.restore()
      rmSync(proj, {force: true, recursive: true})
    }
  })
})
