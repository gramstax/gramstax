import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {spawnSync} from "node:child_process"
import {cpSync, mkdtempSync, rmSync} from "node:fs"
import {mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {Gramstax} from "~/core/bot"
import type {ITAppManifest} from "~/page/manifest"
import {TemplateManager} from "~/template/manager"

const FIXTURES = join(import.meta.dir, `fixtures`, `manifest`, `pages`)
const CTX_ABS = pathToFileURL(join(import.meta.dir, `..`, `src`, `core`, `ctx.ts`)).href
const SCRIPT = join(import.meta.dir, `..`, `scripts`, `build-manifest.ts`)

function runGen(pagesDir: string, outFile: string): {pages: number; templates: number} {
  const res = spawnSync(process.execPath, [SCRIPT, pagesDir, outFile], {encoding: `utf-8`})
  if (res.status !== 0) {
    throw new Error(`build-manifest failed: ${res.stderr}`)
  }
  const m = /(\d+) pages, (\d+) templates/.exec(res.stdout)
  if (!m) throw new Error(`build-manifest printed no stats: ${res.stdout}`)
  return {pages: Number(m[1]), templates: Number(m[2])}
}

let dir: string
let genDir: string
let emptyDir: string

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
  dir = mkdtempSync(join(tmpdir(), `gen-manifest-`))
  cpSync(FIXTURES, dir, {recursive: true})
  relinkCtx(dir)
  genDir = mkdtempSync(join(tmpdir(), `gen-manifest-src-`))
  cpSync(FIXTURES, genDir, {recursive: true})
  relinkCtx(genDir)
  emptyDir = mkdtempSync(join(tmpdir(), `gen-manifest-empty-`))
})

afterEach(() => {
  rmSync(dir, {recursive: true, force: true})
  rmSync(genDir, {recursive: true, force: true})
  rmSync(emptyDir, {recursive: true, force: true})
})

describe(`build-manifest generator`, () => {
  it(`emits an importable manifest that boots an identical bot`, async () => {
    const outFile = join(genDir, `manifest.ts`)
    const stats = runGen(genDir, outFile)
    expect(stats.pages).toBe(3)
    expect(stats.templates).toBe(1)

    const manifest = (await import(outFile)) as {default?: ITAppManifest} & ITAppManifest
    const data: ITAppManifest = manifest.default ?? manifest
    expect(data.pages.map((entry) => entry.routeName).sort()).toEqual([`admin/users`, `card`, `start`])
    expect(data.templates.map((entry) => entry.key)).toEqual([`card`])
    expect(data.templates[0]!.template).toBe(readFileSync(join(genDir, `card.html`), `utf-8`))

    const diskBot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [dir]}), log: false})
    const manifestBot = new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: [emptyDir]}), log: false, manifest: data})
    for (const route of [`/start`, `/card`]) {
      const fromDisk = await diskBot.e2e!.sendText(route)
      const fromManifest = await manifestBot.e2e!.sendText(route)
      expect(fromManifest.length).toBeGreaterThan(0)
      expect((fromManifest[0] as any).body.text).toBe((fromDisk[0] as any).body.text)
    }
  })

  it(`rejects the walk duplicate file-vs-directory conflict`, () => {
    const conflict = mkdtempSync(join(tmpdir(), `gen-manifest-dup-`))
    try {
      mkdirSync(join(conflict, `dup`))
      writeFileSync(join(conflict, `dup.ts`), `export class DupPage {}\n`)
      writeFileSync(join(conflict, `dup`, `index.ts`), `export class DupIndexPage {}\n`)
      const res = spawnSync(process.execPath, [SCRIPT, conflict, join(conflict, `manifest.ts`)], {encoding: `utf-8`})
      expect(res.status).not.toBe(0)
      expect(res.stderr).toMatch(/Duplicate page/)
    } finally {
      rmSync(conflict, {recursive: true, force: true})
    }
  })
})
