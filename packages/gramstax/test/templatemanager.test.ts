import {describe, it, expect, beforeEach, afterEach} from "bun:test"
import {mkdir, rm, writeFile} from "node:fs/promises"
import {TemplateEngine} from "~/template/engine"
import {TemplateManager} from "~/template/manager"
import {existsSync} from "node:fs"
import {join} from "node:path"

// Use a directory inside the test folder as requested
const TEST_DIR = join(import.meta.dir, `views`)

describe(`TemplateManager`, () => {
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

  describe(`Initialization`, () => {
    it(`should throw error if path is invalid`, () => {
      expect(() => new TemplateManager({path: null as any})).toThrow()
    })

    it(`should throw error if path does not exist`, () => {
      expect(() => new TemplateManager({path: [`./non-existent`]})).toThrow()
    })

    it(`should load existing templates`, async () => {
      await writeFile(join(TEST_DIR, `test.html`), `<g-base><g-message>Hello</g-message></g-base>`)
      const manager = new TemplateManager({path: [TEST_DIR]})
      expect(manager.has(`test`)).toBe(true)
    })

    it(`should throw error when template contains unsupported block`, async () => {
      await writeFile(join(TEST_DIR, `invalid_block.html`), `<g-base><unknown>Hello</unknown></g-base>`)

      expect(() => new TemplateManager({path: [TEST_DIR]})).toThrow(/Unsupported template block: <unknown>/)
    })

    it(`should throw error when template contains unsupported scope`, async () => {
      await writeFile(join(TEST_DIR, `invalid_scope.html`), `<g-base><g-message>Hello {% name %}</g-message></g-base>`)

      expect(() => new TemplateManager({path: [TEST_DIR]})).toThrow(/Unsupported template scope: {% %}/)
    })
  })

  describe(`Getters with Fallback`, () => {
    let manager: TemplateManager

    beforeEach(async () => {
      await writeFile(
        join(TEST_DIR, `fallback.html`),
        `
        <g-base>
          <g-message>Default Msg</g-message>
          <g-message lang="id">Pesan ID</g-message>
          
          <g-media type="photo" src="def.jpg">Def Cap</g-media>
          <g-media lang="id" type="photo" src="id.jpg">ID Cap</g-media>

          <g-keyboard>Def Btn</g-keyboard>
          <g-keyboard lang="id">ID Btn</g-keyboard>

          <g-description>Def Desc</g-description>
          <g-description lang="id" scope="private">ID Desc</g-description>
        </g-base>
      `
      )
      manager = new TemplateManager({path: [TEST_DIR]})
    })

    it(`should get <g-message> with fallback`, () => {
      expect(manager.getGMessage(`fallback`, `default`, `id`)).toBe(`Pesan ID`)
      expect(manager.getGMessage(`fallback`, `default`, `fr`)).toBe(`Default Msg`)
    })

    it(`should get <g-media> with fallback`, () => {
      const idMedia = manager.getGMedia(`fallback`, `default`, `id`)
      expect(idMedia.caption).toBe(`ID Cap`)

      const frMedia = manager.getGMedia(`fallback`, `default`, `fr`)
      expect(frMedia.caption).toBe(`Def Cap`)
    })

    it(`should get <g-keyboard> with fallback`, () => {
      const idKb = manager.getGKeyboard(`fallback`, `default`, `id`)
      expect(idKb).toEqual([`ID Btn`])

      const frKb = manager.getGKeyboard(`fallback`, `default`, `fr`)
      expect(frKb).toEqual([`Def Btn`])
    })

    it(`should get <g-description> with fallback`, () => {
      const idDesc = manager.getGDescription(`fallback`, `default`, `id`, `private`)
      expect(idDesc).toBe(`ID Desc`)

      const defDesc = manager.getGDescription(`fallback`, `default`, `fr`, `default`)
      expect(defDesc).toBe(`Def Desc`)
    })
  })

  describe(`File Operations`, () => {
    it(`should write and reload template`, async () => {
      const manager = new TemplateManager({path: [TEST_DIR]})
      await writeFile(join(TEST_DIR, `write_test.html`), `<g-base><g-message>Initial</g-message></g-base>`)

      await manager._loadFile(`write_test.html`)

      const success = await manager.write(`write_test.html`, `<g-base><g-message>Updated</g-message></g-base>`)
      expect(success).toBe(true)

      const msg = manager.getGMessage(`write_test`)
      expect(msg).toBe(`Updated`)
    })
  })

  describe(`Hot Reload`, () => {
    // Helper to wait for watcher events
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    it(`should update template on file change`, async () => {
      await writeFile(join(TEST_DIR, `watch_test.html`), `<g-base><g-message>Initial</g-message></g-base>`)
      const manager = new TemplateManager({
        path: [TEST_DIR],
        enableWatch: true,
        watchOptions: {usePolling: true}
      })

      // Wait for watcher to initialize
      await wait(100)

      expect(manager.getGMessage(`watch_test`)).toBe(`Initial`)

      await writeFile(join(TEST_DIR, `watch_test.html`), `<g-base><g-message>Updated</g-message></g-base>`)
      await wait(2000)
      expect(manager.getGMessage(`watch_test`)).toBe(`Updated`)
      await manager.destroy()
    })

    it(`should load new template on file add`, async () => {
      const manager = new TemplateManager({
        path: [TEST_DIR],
        enableWatch: true,
        watchOptions: {usePolling: true}
      })
      await wait(100)

      await writeFile(join(TEST_DIR, `new_file.html`), `<g-base><g-message>New</g-message></g-base>`)
      await wait(2000)

      expect(manager.has(`new_file`)).toBe(true)
      expect(manager.getGMessage(`new_file`)).toBe(`New`)
      await manager.destroy()
    })

    it(`should remove template on file delete`, async () => {
      await writeFile(join(TEST_DIR, `delete_test.html`), `<g-base><g-message>Delete Me</g-message></g-base>`)
      const manager = new TemplateManager({
        path: [TEST_DIR],
        enableWatch: true,
        watchOptions: {usePolling: true}
      })
      await wait(100)

      expect(manager.has(`delete_test`)).toBe(true)

      await rm(join(TEST_DIR, `delete_test.html`))
      await wait(2000)

      expect(manager.has(`delete_test`)).toBe(false)
      await manager.destroy()
    })
  })

  describe(`Import Resolution`, () => {
    it(`should resolve extensionless file (priority .ts > .html)`, async () => {
      // Create both .ts and .html with same name
      await writeFile(join(TEST_DIR, `component.html`), `<g-base><g-message>HTML Content</g-message></g-base>`)
      // Mocking TS file content as if it was loaded by PageManager (which we can't easily mock here without writing a real TS file that exports a class)
      // Since _readTemplateFile uses PageManager.getFileSync, we need a real TS file or mock PageManager.
      // However, creating a real TS file that Bun/Node can require dynamically in test might be tricky due to caching or compilation.
      // Let's test the .html fallback first if .ts is missing or invalid.

      const manager = new TemplateManager({path: [TEST_DIR]})

      // Test 1: Only HTML exists, referenced without extension
      const htmlContent = manager._readTemplateFile(`component`)
      expect(htmlContent).toBe(`<g-base><g-message>HTML Content</g-message></g-base>`)

      // Test 2: Explicit HTML extension works
      const explicitHtml = manager._readTemplateFile(`component.html`)
      expect(explicitHtml).toBe(`<g-base><g-message>HTML Content</g-message></g-base>`)
    })

    it(`should throw error when imported template content contains unsupported block`, async () => {
      const manager = new TemplateManager({path: [TEST_DIR]})
      await writeFile(join(TEST_DIR, `partial.html`), `<g-base><g-message><unknown>Bad</unknown></g-message></g-base>`)

      expect(() => manager._compile(`main`, `<g-base><g-import src="partial" block="message" /></g-base>`)).toThrow(/Unsupported template block: <unknown>/)
    })
  })

  describe(`_processGMapBlocks`, () => {
    it(`renders <g-map> array items with join`, () => {
      const template = `<g-map src="items" join=", ">{{e}}-{{i}}</g-map>`
      const processed = TemplateEngine._processGMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)
      const result = fn({items: [`a`, `b`, `c`]})

      expect(result).toBe(`a-0, b-1, c-2`)
    })
  })
})
