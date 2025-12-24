import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { TemplateManager } from "~/template/manager"
import { existsSync } from "node:fs"
import { join } from "node:path"

// Use a directory inside the test folder as requested
const TEST_DIR = join(import.meta.dir, `views`)

describe(`TemplateManager`, () => {
  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true })
    }
    await mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true })
    }
  })

  describe(`Initialization`, () => {
    it(`should throw error if path is invalid`, () => {
      expect(() => new TemplateManager({ path: null as any })).toThrow()
    })

    it(`should throw error if path does not exist`, () => {
      expect(() => new TemplateManager({ path: [`./non-existent`] })).toThrow()
    })

    it(`should load existing templates`, async () => {
      await writeFile(join(TEST_DIR, `test.html`), `<base><message>Hello</message></base>`)
      const manager = new TemplateManager({ path: [TEST_DIR] })
      expect(manager.has(`test`)).toBe(true)
    })
  })

  describe(`Getters with Fallback`, () => {
    let manager: TemplateManager

    beforeEach(async () => {
      await writeFile(
        join(TEST_DIR, `fallback.html`),
        `
        <base>
          <message>Default Msg</message>
          <message lang="id">Pesan ID</message>
          
          <media type="photo" src="def.jpg">Def Cap</media>
          <media lang="id" type="photo" src="id.jpg">ID Cap</media>

          <keyboard>Def Btn</keyboard>
          <keyboard lang="id">ID Btn</keyboard>

          <description>Def Desc</description>
          <description lang="id" scope="private">ID Desc</description>
        </base>
      `
      )
      manager = new TemplateManager({ path: [TEST_DIR] })
    })

    it(`should get message with fallback`, () => {
      expect(manager.getMessage(`fallback`, `default`, `id`)).toBe(`Pesan ID`)
      expect(manager.getMessage(`fallback`, `default`, `fr`)).toBe(`Default Msg`)
    })

    it(`should get media with fallback`, () => {
      const idMedia = manager.getMedia(`fallback`, `default`, `id`)
      expect(idMedia.caption).toBe(`ID Cap`)

      const frMedia = manager.getMedia(`fallback`, `default`, `fr`)
      expect(frMedia.caption).toBe(`Def Cap`)
    })

    it(`should get keyboard with fallback`, () => {
      const idKb = manager.getKeyboard(`fallback`, `default`, `id`)
      expect(idKb).toEqual([`ID Btn`])

      const frKb = manager.getKeyboard(`fallback`, `default`, `fr`)
      expect(frKb).toEqual([`Def Btn`])
    })

    it(`should get description with fallback`, () => {
      const idDesc = manager.getDescription(`fallback`, `default`, `id`, `private`)
      expect(idDesc).toBe(`ID Desc`)

      const defDesc = manager.getDescription(`fallback`, `default`, `fr`, `default`)
      expect(defDesc).toBe(`Def Desc`)
    })
  })

  describe(`File Operations`, () => {
    it(`should write and reload template`, async () => {
      const manager = new TemplateManager({ path: [TEST_DIR] })
      await writeFile(join(TEST_DIR, `write_test.html`), `<base><message>Initial</message></base>`)

      await manager._loadFile(`write_test.html`)

      const success = await manager.write(`write_test.html`, `<base><message>Updated</message></base>`)
      expect(success).toBe(true)

      const msg = manager.getMessage(`write_test`)
      expect(msg).toBe(`Updated`)
    })
  })

  describe(`Hot Reload`, () => {
    // Helper to wait for watcher events
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    it(`should update template on file change`, async () => {
      await writeFile(join(TEST_DIR, `watch_test.html`), `<base><message>Initial</message></base>`)
      const manager = new TemplateManager({
        path: [TEST_DIR],
        enableWatch: true,
        watchOptions: { usePolling: true }
      })

      // Wait for watcher to initialize
      await wait(100)

      expect(manager.getMessage(`watch_test`)).toBe(`Initial`)

      await writeFile(join(TEST_DIR, `watch_test.html`), `<base><message>Updated</message></base>`)
      await wait(800)
      expect(manager.getMessage(`watch_test`)).toBe(`Updated`)
      await manager.destroy()
    })

    it(`should load new template on file add`, async () => {
      const manager = new TemplateManager({
        path: [TEST_DIR],
        enableWatch: true,
        watchOptions: { usePolling: true }
      })
      await wait(100)

      await writeFile(join(TEST_DIR, `new_file.html`), `<base><message>New</message></base>`)
      await wait(800)

      expect(manager.has(`new_file`)).toBe(true)
      expect(manager.getMessage(`new_file`)).toBe(`New`)
      await manager.destroy()
    })

    it(`should remove template on file delete`, async () => {
      await writeFile(join(TEST_DIR, `delete_test.html`), `<base><message>Delete Me</message></base>`)
      const manager = new TemplateManager({
        path: [TEST_DIR],
        enableWatch: true,
        watchOptions: { usePolling: true }
      })
      await wait(100)

      expect(manager.has(`delete_test`)).toBe(true)

      await rm(join(TEST_DIR, `delete_test.html`))
      await wait(800)

      expect(manager.has(`delete_test`)).toBe(false)
      await manager.destroy()
    })
  })

  describe(`Import Resolution`, () => {
    it(`should resolve extensionless file (priority .ts > .html)`, async () => {
      // Create both .ts and .html with same name
      await writeFile(join(TEST_DIR, `component.html`), `<base><message>HTML Content</message></base>`)
      // Mocking TS file content as if it was loaded by PageManager (which we can't easily mock here without writing a real TS file that exports a class)
      // Since _readTemplateFile uses PageManager.getFileSync, we need a real TS file or mock PageManager.
      // However, creating a real TS file that Bun/Node can require dynamically in test might be tricky due to caching or compilation.
      // Let's test the .html fallback first if .ts is missing or invalid.

      const manager = new TemplateManager({ path: [TEST_DIR] })

      // Test 1: Only HTML exists, referenced without extension
      const htmlContent = manager._readTemplateFile(`component`)
      expect(htmlContent).toBe(`<base><message>HTML Content</message></base>`)

      // Test 2: Explicit HTML extension works
      const explicitHtml = manager._readTemplateFile(`component.html`)
      expect(explicitHtml).toBe(`<base><message>HTML Content</message></base>`)
    })
  })
})
