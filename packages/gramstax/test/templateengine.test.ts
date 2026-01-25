import {describe, it, expect} from "bun:test"
import {TemplateEngine} from "~/template/engine"

describe(`TemplateEngine`, () => {
  describe(`_processMessageBlocks`, () => {
    it(`should parse message with explicit lang`, () => {
      const template = `<message lang="en">Hello</message>`
      const result = TemplateEngine._processMessageBlocks(template)
      expect(result).toEqual({en: `Hello`})
    })

    it(`should parse message with default lang (missing attr lang)`, () => {
      const template = `<message>Hello</message>`
      const result = TemplateEngine._processMessageBlocks(template)
      expect(result).toEqual({default: `Hello`})
    })

    it(`should parse message with mixed attributes`, () => {
      const template = `<message id="1" lang="es">Hola</message>`
      const result = TemplateEngine._processMessageBlocks(template)
      expect(result).toEqual({es: `Hola`})
    })
  })

  describe(`_processDescriptionBlocks`, () => {
    it(`should parse description with explicit lang and scope`, () => {
      const template = `<description lang="en" scope="private">Desc</description>`
      const result = TemplateEngine._processDescriptionBlocks(template)
      expect(result).toEqual({en: {private: `Desc`}})
    })

    it(`should parse description with default lang and scope`, () => {
      const template = `<description>Desc</description>`
      const result = TemplateEngine._processDescriptionBlocks(template)
      expect(result).toEqual({default: {default: `Desc`}})
    })

    it(`should parse description with mixed attributes`, () => {
      const template = `<description scope="group" lang="id">Deskripsi</description>`
      const result = TemplateEngine._processDescriptionBlocks(template)
      expect(result).toEqual({id: {group: `Deskripsi`}})
    })
  })

  describe(`_processMediaBlocks`, () => {
    it(`should parse media with explicit lang`, () => {
      const template = `<media lang="en" type="photo" src="url">Caption</media>`
      const result = TemplateEngine._processMediaBlocks(template)
      expect(result.en).toBeDefined()
      expect(result.en?.type).toBe(`photo`)
      expect(result.en?.caption).toBe(`Caption`)
    })

    it(`should parse media with default lang`, () => {
      const template = `<media type="photo" src="url">Caption</media>`
      const result = TemplateEngine._processMediaBlocks(template)
      expect(result.default).toBeDefined()
      expect(result?.default?.type).toBe(`photo`)
    })
  })

  describe(`_processKeyboardBlocks`, () => {
    it(`should parse keyboard with explicit lang`, () => {
      const template = `<keyboard lang="en">Button</keyboard>`
      const result = TemplateEngine._processKeyboardBlocks(template)
      expect(result.en).toBeDefined()
      expect(result?.en?.inline).toBe(`Button`)
    })

    it(`should parse keyboard with default lang`, () => {
      const template = `<keyboard>Button</keyboard>`
      const result = TemplateEngine._processKeyboardBlocks(template)
      expect(result.default).toBeDefined()
      expect(result?.default?.inline).toBe(`Button`)
    })

    it(`should parse comma-separated buttons`, () => {
      const template = `<keyboard>test, 1, 666, 27</keyboard>`
      const result = TemplateEngine._processKeyboardBlocks(template)
      const labels = result.default?.inline?.split(/(?<!\\),\s*/).map((l: string) => l.trim())
      expect(labels).toEqual([`test`, `1`, `666`, `27`])
    })
  })

  describe(`_processMapBlocks`, () => {
    it(`should iterate over a list with e and i`, () => {
      const template = `<map src="users">{{i}}. {{e.name}}</map>`
      const processed = TemplateEngine._processMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        users: [{name: `Alice`}, {name: `Bob`}]
      }
      expect(fn(data)).toBe(`0. Alice\n1. Bob`)
    })

    it(`should support custom join separator`, () => {
      const template = `<map src="tags" join=", ">{{e}}</map>`
      const processed = TemplateEngine._processMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        tags: [`red`, `green`, `blue`]
      }
      expect(fn(data)).toBe(`red, green, blue`)
    })

    it(`should support nested properties and global variables`, () => {
      const template = `<map src="items">{{e.id}}: {{globalPrefix}}-{{e.value}}</map>`
      let processed = TemplateEngine._processMapBlocks(template)
      processed = TemplateEngine._processScopeExec(processed)
      processed = TemplateEngine._processScopeVariables(processed)

      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        items: [
          {id: 1, value: `A`},
          {id: 2, value: `B`}
        ],
        globalPrefix: `G`
      }
      expect(fn(data)).toBe(`1: G-A\n2: G-B`)
    })

    it(`should handle empty list`, () => {
      const template = `List:\n<map src="emptyList">{{e}}</map>`
      const processed = TemplateEngine._processMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {emptyList: []}
      expect(fn(data)).toBe(`List:\n`)
    })
  })

  describe(`_processExec`, () => {
    it(`should execute inline javascript`, () => {
      const template = `Result: {~ 1 + 2 ~}`
      const processed = TemplateEngine._processScopeExec(template)
      const fn = TemplateEngine._compileToFunction(processed, false)
      expect(fn()).toBe(`Result: 3`)
    })

    it(`should execute without spaces {~1+2~}`, () => {
      const template = `Result: {~1+2~}`
      const processed = TemplateEngine._processScopeExec(template)
      const fn = TemplateEngine._compileToFunction(processed, false)
      expect(fn()).toBe(`Result: 3`)
    })

    it(`should work inside map block`, () => {
      const template = `<map src="nums">{~ e * 2 ~}</map>`
      let processed = TemplateEngine._processMapBlocks(template)
      processed = TemplateEngine._processScopeExec(processed)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {nums: [1, 2, 3]}
      expect(fn(data)).toBe(`2\n4\n6`)
    })

    it(`should support index math inside map`, () => {
      const template = `<map src="nums">{~ i + 1 ~}. {{e}}</map>`
      let processed = TemplateEngine._processMapBlocks(template)
      processed = TemplateEngine._processScopeExec(processed)

      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {nums: [`a`, `b`]}
      expect(fn(data)).toBe(`1. a\n2. b`)
    })
  })

  describe(`compileMedia`, () => {
    it(`should compile dynamic attributes in media blocks`, () => {
      const template = `
        <base id="profile">
          <media type="photo" src="{{avatar}}">Name: {{name}}</media>
        </base>
      `
      const compiled = TemplateEngine.compileBlockMedia(template)
      const data = {avatar: `http://alice.png`, name: `Alice`}
      const media = compiled.profile!.default!(data)

      expect(media.type).toBe(`photo`)
      expect(media.src).toBe(`http://alice.png`)
      expect(media.caption).toBe(`Name: Alice`)
    })

    it(`should support expressions in coordinates`, () => {
      const template = `
        <base id="loc">
          <media type="location" latitude="{~ lat + 1 ~}" longitude="{{lng}}"></media>
        </base>
      `
      const compiled = TemplateEngine.compileBlockMedia(template)
      const data = {lat: 10, lng: `20`}
      const media = compiled.loc!.default!(data)

      expect(media.latitude).toBe(`11`)
      expect(media.longitude).toBe(`20`)
    })

    it(`should prioritize local variables for both {{...}} and {~ ... ~} syntax`, () => {
      // Test {{e}}
      const template1 = `<map src="arr">{{e}}</map>`
      const fn1 = TemplateEngine._compileToFunction(TemplateEngine._processScopeVariables(TemplateEngine._processMapBlocks(template1)), false)

      // Test {~ e ~}
      const template2 = `<map src="arr">{~ e ~}</map>`
      const fn2 = TemplateEngine._compileToFunction(TemplateEngine._processScopeExec(TemplateEngine._processMapBlocks(template2)), false)

      const data = {
        arr: [`local`],
        e: `global`
      }
      expect(fn1(data)).toBe(`local`)
      expect(fn2(data)).toBe(`local`)
    })
  })

  describe(`Integration in compileMessages`, () => {
    it(`should compile messages with map and exec`, () => {
      const template = `
        <base id="list">
          <message>
            <map src="users" join=", ">{~ i + 1 ~}. {{e.name}}</map>
          </message>
        </base>
      `
      const compiled = TemplateEngine.compileBlockMessage(template)
      const fn = compiled[`list`]![`default`]

      const data = {users: [{name: `X`}, {name: `Y`}]}
      expect(fn!(data).trim()).toBe(`1. X, 2. Y`)
    })
  })
  describe(`_extractBlock`, () => {
    it(`should extract default base content`, () => {
      const content = `<base>Content</base>`
      expect(TemplateEngine._extractBlock(content)).toBe(`Content`)
    })

    it(`should extract named base content`, () => {
      const content = `<base id="other">Other</base><base id="main">Main</base>`
      expect(TemplateEngine._extractBlock(content, undefined, `main`)).toBe(`Main`)
    })

    it(`should return empty if base not found`, () => {
      const content = `<base id="other">Other</base>`
      expect(TemplateEngine._extractBlock(content, undefined, `main`)).toBe(``)
    })

    it(`should extract specific block`, () => {
      const content = `<base><message>Msg</message><media>Med</media></base>`
      expect(TemplateEngine._extractBlock(content, `message`)).toBe(`<message>Msg</message>`)
    })

    it(`should return inner content if section is value`, () => {
      const content = `<base><message>Msg</message></base>`
      expect(TemplateEngine._extractBlock(content, `message`, `default`, `value`)).toBe(`Msg`)
    })

    // New tests for multi-block support
    it(`should extract all blocks when blocks="all"`, () => {
      const content = `<base><message>Msg</message><keyboard>Btn</keyboard></base>`
      const result = TemplateEngine._extractBlock(content, `all`)
      expect(result).toContain(`<message>Msg</message>`)
      expect(result).toContain(`<keyboard>Btn</keyboard>`)
    })

    it(`should extract multiple specific blocks with array`, () => {
      const content = `<base><message>Msg</message><keyboard>Btn</keyboard><media>Med</media></base>`
      const result = TemplateEngine._extractBlock(content, [`message`, `keyboard`])
      expect(result).toContain(`<message>Msg</message>`)
      expect(result).toContain(`<keyboard>Btn</keyboard>`)
      expect(result).not.toContain(`<media>Med</media>`)
    })

    it(`should handle multi-block with section="value"`, () => {
      const content = `<base><message>Msg</message><keyboard>Btn</keyboard></base>`
      const result = TemplateEngine._extractBlock(content, [`message`, `keyboard`], `default`, `value`)
      expect(result).toContain(`Msg`)
      expect(result).toContain(`Btn`)
    })

    it(`should filter blocks by lang if specified`, () => {
      const content = `<base><message lang="en">En</message><message lang="id">Id</message></base>`
      const result = TemplateEngine._extractBlock(content, `message`, `default`, `value`, `en`)
      expect(result).toBe(`En`)
      const resultId = TemplateEngine._extractBlock(content, `message`, `default`, `value`, `id`)
      expect(resultId).toBe(`Id`)
    })
  })

  describe(`_parseImportBlocks`, () => {
    it(`should extract import info and return placeholders`, () => {
      const template = `Start <import src="file" /> End`
      const result = TemplateEngine._processImportBlocks(template)
      expect(result.processed).toBe(`Start __IMPORT_0__ End`)
      expect(result.imports.length).toBe(1)
      expect(result.imports[0]?.src).toBe(`file`)
    })

    it(`should parse all attributes correctly`, () => {
      const template = `<import src="file" block="message" base="main" section="value" />`
      const result = TemplateEngine._processImportBlocks(template)
      expect(result.imports[0]).toEqual({
        src: `file`,
        blocks: `message`,
        base: `main`,
        section: `value`,
        indent: ``
      })
    })

    it(`should handle multiple imports`, () => {
      const template = `<import src="A" /><import src="B" />`
      const result = TemplateEngine._processImportBlocks(template)
      expect(result.processed).toBe(`__IMPORT_0____IMPORT_1__`)
      expect(result.imports.length).toBe(2)
      expect(result.imports[0]?.src).toBe(`A`)
      expect(result.imports[1]?.src).toBe(`B`)
    })

    it(`should parse lang attribute correctly`, () => {
      const template = `<import src="file" lang="en" />`
      const result = TemplateEngine._processImportBlocks(template)
      expect(result.imports[0]?.lang).toBe(`en`)
    })

    // New tests for multi-block parsing
    it(`should parse block="all" as string "all"`, () => {
      const template = `<import src="file" block="all" />`
      const result = TemplateEngine._processImportBlocks(template)
      expect(result.imports[0]?.blocks).toBe(`all`)
    })

    it(`should parse comma-separated blocks without spaces`, () => {
      const template = `<import src="file" block="keyboard,message" />`
      const result = TemplateEngine._processImportBlocks(template)
      expect(result.imports[0]?.blocks).toEqual([`keyboard`, `message`])
    })

    it(`should parse comma-separated blocks with spaces`, () => {
      const template = `<import src="file" block="keyboard, message" />`
      const result = TemplateEngine._processImportBlocks(template)
      expect(result.imports[0]?.blocks).toEqual([`keyboard`, `message`])
    })

    it(`should parse comma-separated blocks with mixed spaces`, () => {
      const template = `<import src="file" block="keyboard,  message, media" />`
      const result = TemplateEngine._processImportBlocks(template)
      expect(result.imports[0]?.blocks).toEqual([`keyboard`, `message`, `media`])
    })
  })

  describe(`processImports`, () => {
    it(`should resolve imports using file resolver callback`, () => {
      const template = `Start <import src="header" /> End`
      const fileResolver = (src: string) => (src === `header` ? `<message>Hello</message>` : null)
      const result = TemplateEngine.processImportBlocks(template, fileResolver)
      expect(result).toBe(`Start <message>Hello</message> End`)
    })

    it(`should resolve imports with block="all"`, () => {
      const template = `<import src="shared" block="all" />`
      const fileResolver = (src: string) => (src === `shared` ? `<base><message>Msg</message><keyboard>Btn</keyboard></base>` : null)
      const result = TemplateEngine.processImportBlocks(template, fileResolver)
      expect(result).toContain(`<message>Msg</message>`)
      expect(result).toContain(`<keyboard>Btn</keyboard>`)
    })

    it(`should resolve imports with multi-block`, () => {
      const template = `<import src="shared" block="keyboard,message" />`
      const fileResolver = (src: string) => (src === `shared` ? `<base><message>Msg</message><keyboard>Btn</keyboard><media>Med</media></base>` : null)
      const result = TemplateEngine.processImportBlocks(template, fileResolver)
      expect(result).toContain(`<message>Msg</message>`)
      expect(result).toContain(`<keyboard>Btn</keyboard>`)
      expect(result).not.toContain(`<media>Med</media>`)
    })

    it(`should resolve imports recursively`, () => {
      const template = `<import src="A" />`
      const fileResolver = (src: string) => {
        if (src === `A`) return `<import src="B" />`
        if (src === `B`) return `Resolved B`
        return null
      }
      const result = TemplateEngine.processImportBlocks(template, fileResolver)
      expect(result.trim()).toBe(`Resolved B`)
    })

    it(`should prevent infinite recursion`, () => {
      const template = `<import src="loop" />`
      const fileResolver = (src: string) => (src === `loop` ? `<import src="loop" />` : null)
      const result = TemplateEngine.processImportBlocks(template, fileResolver)
      expect(result.trim()).toBe(``)
    })

    it(`should filter imports by lang`, () => {
      const template = `<import src="shared" block="message" lang="id" section="value" />`
      const fileResolver = (src: string) => (src === `shared` ? `<base><message lang="en">En</message><message lang="id">Id</message></base>` : null)
      const result = TemplateEngine.processImportBlocks(template, fileResolver)
      expect(result).toBe(`Id`)
    })
  })
})
