import {spawnSync} from "node:child_process"
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {Gramstax, TemplateManager} from "gramstax"
import {FixtureCopy} from "./fixture-copy"

const SCRIPT = join(import.meta.dir, `..`, `..`, `..`, `packages`, `gramstax`, `scripts`, `build-manifest.ts`)

let pages: string
let outDir: string

const user = {user: {id: 4101, username: `manifestuser`, language_code: `en`}}

beforeEach(() => {
  const src = FixtureCopy.copySrc()
  pages = join(src, `pages`)
  outDir = mkdtempSync(join(tmpdir(), `manifest-e2e-out-`))
})

afterEach(() => {
  rmSync(join(pages, `..`), {force: true, recursive: true})
  rmSync(outDir, {force: true, recursive: true})
})

async function bootManifest() {
  const res = spawnSync(process.execPath, [SCRIPT, pages, join(outDir, `manifest.js`)], {encoding: `utf-8`, timeout: 120000})
  expect(res.status).toBe(0)
  const manifest = (await import(pathToFileURL(join(outDir, `manifest.js`)).href)).default
  return new Gramstax({token: `test`, deploy: `test`, templateManager: new TemplateManager({path: []}), log: false, manifest})
}

describe(`E2E: manifest boot without filesystem`, () => {
  it(`serves /start from the embedded manifest`, async () => {
    const bot = await bootManifest()
    const res = await bot.e2e!.sendText(`/start`, user)
    expect(res.length).toBeGreaterThan(0)
    expect((res[0] as any).body.rich_message.html).toContain(`Welcome`)
  })

  it(`serves /info from the embedded html template`, async () => {
    const bot = await bootManifest()
    const res = await bot.e2e!.sendText(`/info`, user)
    expect(res.length).toBeGreaterThan(0)
    expect((res[0] as any).body.text).toContain(`no filesystem touched`)
  })
})
