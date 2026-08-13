import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync, readFileSync} from "node:fs"
import {mkdir, rm, writeFile} from "node:fs/promises"
import {join, resolve} from "node:path"
import {TemplateManager} from "~/template/manager"

const TEST_DIR = join(import.meta.dir, `tm_security_views`)
const OUTSIDE_FILE = join(import.meta.dir, `tm_security_outside.html`)

describe(`TemplateManager path traversal`, () => {
  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
    if (existsSync(OUTSIDE_FILE)) {
      await rm(OUTSIDE_FILE, {force: true})
    }
    await mkdir(TEST_DIR, {recursive: true})
    await writeFile(OUTSIDE_FILE, `<g-base><g-message>OUTSIDE SECRET</g-message></g-base>`)
  })

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
    if (existsSync(OUTSIDE_FILE)) {
      await rm(OUTSIDE_FILE, {force: true})
    }
  })

  it(`rejects _readTemplateFile with ../ traversal`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(manager._readTemplateFile(`../tm_security_outside.html`)).toBeNull()
  })

  it(`rejects _readTemplateFile with absolute path`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(manager._readTemplateFile(resolve(OUTSIDE_FILE))).toBeNull()
  })

  it(`rejects _readTemplateFile with nested ../ traversal`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(manager._readTemplateFile(`sub/../tm_security_outside.html`)).toBeNull()
  })

  it(`still reads files inside the template root`, async () => {
    await writeFile(join(TEST_DIR, `inside.html`), `<g-base><g-message>INSIDE</g-message></g-base>`)
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(manager._readTemplateFile(`inside.html`)).toContain(`INSIDE`)
  })

  it(`rejects write() with ../ traversal`, async () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    const result = await manager.write(`../tm_security_outside.html`, `<g-base><g-message>PWNED</g-message></g-base>`)
    expect(result).toBeNull()
    expect(existsSync(OUTSIDE_FILE)).toBe(true)
    expect(readFileSync(OUTSIDE_FILE, `utf8`)).toContain(`OUTSIDE SECRET`)
  })
})