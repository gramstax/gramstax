import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm, writeFile} from "node:fs/promises"
import {join} from "node:path"
import {TemplateManager} from "~/template/manager"

const TEST_DIR = join(import.meta.dir, `views-layout-ns`)

const LAYOUT_TS = `import {PageBase} from "~/base/page"
import {AdminGuard} from "~/guards/admin"

export abstract class AdminLayout extends PageBase {
  async hookBeforeRoute() {
    return (await new AdminGuard(this).ensureAdmin()) ?? false
  }
}
`

describe(`layout namespace safety`, () => {
  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
    await mkdir(TEST_DIR, {recursive: true})
  })

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })

  it(`ignores layout.ts on the disk walk instead of requiring it`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(manager.isLayoutFile(`layout.ts`)).toBe(true)
    expect(manager.isLayoutFile(`admin/layout.ts`)).toBe(true)
    expect(manager.isLayoutFile(`home.html`)).toBe(false)
  })

  it(`never emits page or _layout keys for layout files`, async () => {
    await writeFile(join(TEST_DIR, `layout.ts`), LAYOUT_TS)
    await writeFile(join(TEST_DIR, `home.html`), `<g-base><g-message>HOME</g-message></g-base>`)
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(manager.has(`home`)).toBe(true)
    expect(manager.has(`layout`)).toBe(false)
    expect(manager.hasLayout(`layout`)).toBe(false)
  })

  it(`ignores layout.html on the disk walk`, async () => {
    await writeFile(join(TEST_DIR, `layout.html`), `<g-base><g-message>NAV</g-message></g-base>`)
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(manager.has(`layout`)).toBe(false)
  })

  it(`_loadFile skips layout files without throwing`, async () => {
    await writeFile(join(TEST_DIR, `layout.ts`), LAYOUT_TS)
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager._loadFile(`layout.ts`)
    expect(manager.has(`layout`)).toBe(false)
  })

  it(`deleting a layout file is a no-op for compiled keys`, async () => {
    await writeFile(join(TEST_DIR, `home.html`), `<g-base><g-message>HOME</g-message></g-base>`)
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager._handleFileDelete(join(TEST_DIR, `layout.ts`))
    expect(manager.has(`home`)).toBe(true)
  })
})
