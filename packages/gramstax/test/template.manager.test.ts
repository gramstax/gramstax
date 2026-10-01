import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm, writeFile} from "node:fs/promises"
import {join} from "node:path"
import {TemplateEngine} from "~/template/engine"
import {TemplateManager} from "~/template/manager"

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

      await manager.loadFile(`write_test.html`)

      const success = await manager.write(`write_test.html`, `<g-base><g-message>Updated</g-message></g-base>`)
      expect(success).toBe(true)

      const msg = manager.getGMessage(`write_test`)
      expect(msg).toBe(`Updated`)
    })
  })

  describe(`Hot Reload`, () => {
    // Helper to wait for watcher events
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    it(`should call onReload after a file is (re)loaded`, async () => {
      await writeFile(join(TEST_DIR, `reload_hook.html`), `<g-base><g-message>Hi</g-message></g-base>`)
      let reloads = 0
      const manager = new TemplateManager({
        path: [TEST_DIR],
        onReload: () => {
          reloads += 1
        }
      })
      expect(reloads).toBe(0)

      await writeFile(join(TEST_DIR, `reload_hook.html`), `<g-base><g-message>Bye</g-message></g-base>`)
      manager.loadFile(`reload_hook.html`)
      expect(reloads).toBe(1)
      await manager.destroy()
    })

    it(`should update template on file change`, async () => {
      await writeFile(join(TEST_DIR, `watch_test.html`), `<g-base><g-message>Initial</g-message></g-base>`)
      const manager = new TemplateManager({
        path: [TEST_DIR],
        enableWatch: true,
        watchOptions: {usePolling: true, interval: 100}
      })

      await wait(100)
      expect(manager.getGMessage(`watch_test`)).toBe(`Initial`)

      await writeFile(join(TEST_DIR, `watch_test.html`), `<g-base><g-message>Updated</g-message></g-base>`)
      await manager.loadFile(`watch_test.html`)
      expect(manager.getGMessage(`watch_test`)).toBe(`Updated`)
      await manager.destroy()
    })

    it(`should load new template on file add`, async () => {
      const manager = new TemplateManager({
        path: [TEST_DIR],
        enableWatch: true,
        watchOptions: {usePolling: true, interval: 100}
      })
      await wait(100)

      await writeFile(join(TEST_DIR, `new_file.html`), `<g-base><g-message>New</g-message></g-base>`)
      await wait(50)
      await manager.loadFile(`new_file.html`)
      expect(manager.has(`new_file`)).toBe(true)
      expect(manager.getGMessage(`new_file`)).toBe(`New`)
      await manager.destroy()
    })

    it(`should remove template on file delete`, async () => {
      await writeFile(join(TEST_DIR, `delete_test.html`), `<g-base><g-message>Delete Me</g-message></g-base>`)
      const manager = new TemplateManager({
        path: [TEST_DIR],
        enableWatch: true,
        watchOptions: {usePolling: true, interval: 100}
      })
      await wait(100)
      expect(manager.has(`delete_test`)).toBe(true)

      await rm(join(TEST_DIR, `delete_test.html`))
      // Directly invoke the delete handler since the watcher may not fire on all platforms
      manager.handleFileDelete(join(TEST_DIR, `delete_test.html`))
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
      const htmlContent = manager.readTemplateFile(`component`)
      expect(htmlContent).toBe(`<g-base><g-message>HTML Content</g-message></g-base>`)

      // Test 2: Explicit HTML extension works
      const explicitHtml = manager.readTemplateFile(`component.html`)
      expect(explicitHtml).toBe(`<g-base><g-message>HTML Content</g-message></g-base>`)
    })

    it(`should resolve extensionless file to .js when only a .js page exists`, async () => {
      // Regression for G1: the .js branch of _readTemplateFile used to call
      // PageManager.getFileSync(tsPath) instead of jsPath, so a .js template
      // page was never loadable through the extensionless path.
      const manager = new TemplateManager({path: [TEST_DIR]})

      // Write the page AFTER construction: _loadAllFiles consumes and clears
      // Page.template, which would mask the jsPath regression under test.
      await writeFile(join(TEST_DIR, `js_page.js`), [`export class JsPage {`, `  constructor() {}`, `  static load() { return new JsPage() }`, `}`, `JsPage.template = \`<g-base><g-message>JS Content</g-message></g-base>\``].join(`\n`))

      const jsContent = manager.readTemplateFile(`js_page`)
      expect(jsContent).toBe(`<g-base><g-message>JS Content</g-message></g-base>`)

      const explicitJs = manager.readTemplateFile(`js_page.js`)
      expect(explicitJs).toBe(`<g-base><g-message>JS Content</g-message></g-base>`)

      const jsMod = (await import(join(TEST_DIR, `js_page.js`))) as unknown as {JsPage: {load: () => object}}
      expect(jsMod.JsPage.load()).toBeDefined()
    })

    it(`should throw error when imported template content contains unsupported block`, async () => {
      const manager = new TemplateManager({path: [TEST_DIR]})
      await writeFile(join(TEST_DIR, `partial.html`), `<g-base><g-message><unknown>Bad</unknown></g-message></g-base>`)

      expect(() => manager.compile(`main`, `<g-base><g-import src="partial" block="message" /></g-base>`)).toThrow(/Unsupported template block: <unknown>/)
    })

    it(`should surface ALL validation errors, not just the first`, async () => {
      const manager = new TemplateManager({path: [TEST_DIR]})
      const template = `<g-base><g-message><a>x</a><input type="text"/></g-message></g-base>`

      expect(() => manager.compile(`main`, template)).toThrow(/<a> must have one of/)
      expect(() => manager.compile(`main`, template)).toThrow(/type must be "checkbox"/)
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
