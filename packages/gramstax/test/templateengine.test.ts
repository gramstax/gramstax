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

    it(`should parse pipe-delimited media src values as srcList`, () => {
      const template = `<media type="photo" src="a.jpg | b.jpg | c.jpg">Album</media>`
      const result = TemplateEngine._processMediaBlocks(template)

      expect(result.default?.src).toBe(`a.jpg | b.jpg | c.jpg`)
      expect(result.default?.srcList).toEqual([`a.jpg`, `b.jpg`, `c.jpg`])
    })

    it(`should cap pipe-delimited media srcList to Telegram media group limit`, () => {
      const src = Array.from({length: 12}, (_, index) => `file-${index + 1}.jpg`).join(`|`)
      const template = `<media type="photo" src="${src}">Album</media>`
      const result = TemplateEngine._processMediaBlocks(template)

      expect(result.default?.srcList).toHaveLength(10)
      expect(result.default?.srcList?.at(0)).toBe(`file-1.jpg`)
      expect(result.default?.srcList?.at(9)).toBe(`file-10.jpg`)
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

    it(`should compile dynamic pipe-delimited media src values as srcList`, () => {
      const template = `
        <base id="album">
          <media type="photo" src="{{first}}|{{second}}">Album: {{title}}</media>
        </base>
      `
      const compiled = TemplateEngine.compileBlockMedia(template)
      const media = compiled.album!.default!({first: `a.jpg`, second: `b.jpg`, title: `Photos`})

      expect(media.src).toBe(`a.jpg|b.jpg`)
      expect(media.srcList).toEqual([`a.jpg`, `b.jpg`])
      expect(media.caption).toBe(`Album: Photos`)
    })

    it(`should compile media-group blocks with mixed photo and video items`, () => {
      const template = `
        <base id="album">
          <media-group>
            <media type="photo" src="{{photoUrl}}">Album: {{title}}</media>
            <media type="video" src="{{videoUrl}}"></media>
            <media type="photo" src="static.jpg"></media>
          </media-group>
        </base>
      `
      const compiled = TemplateEngine.compileBlockMedia(template)
      const media = compiled.album!.default!({photoUrl: `photo.jpg`, videoUrl: `video.mp4`, title: `Trip`})

      expect(media.type).toBe(`group`)
      expect(media.caption).toBe(`Album: Trip`)
      expect(media.mediaGroup).toEqual([
        {type: `photo`, src: `photo.jpg`, caption: `Album: Trip`},
        {type: `video`, src: `video.mp4`},
        {type: `photo`, src: `static.jpg`}
      ])
    })

    it(`should filter inner media items by lang attribute inside media-group`, () => {
      const template = `
        <base id="langGroup">
          <media-group>
            <media type="photo" src="en.jpg">English caption</media>
            <media lang="wkwkland" type="photo" src="wkwk.jpg">Wkwkland caption</media>
            <media type="photo" src="shared.jpg"></media>
          </media-group>
        </base>
      `
      const compiled = TemplateEngine.compileBlockMedia(template)

      // Default language: only items without lang
      const defaultMedia = compiled.langGroup!.default!({})
      expect(defaultMedia.type).toBe(`group`)
      expect(defaultMedia.mediaGroup).toHaveLength(2)
      expect(defaultMedia.caption).toBe(`English caption`)
      expect(defaultMedia.mediaGroup).toEqual([
        {type: `photo`, src: `en.jpg`, caption: `English caption`},
        {type: `photo`, src: `shared.jpg`}
      ])

      // wkwkland language: ONLY items matching that lang (exclusive)
      const wkwkMedia = compiled.langGroup!.wkwkland!({})
      expect(wkwkMedia.type).toBe(`group`)
      expect(wkwkMedia.mediaGroup).toHaveLength(1)
      expect(wkwkMedia.caption).toBe(`Wkwkland caption`)
      expect(wkwkMedia.mediaGroup).toEqual([
        {type: `photo`, src: `wkwk.jpg`, caption: `Wkwkland caption`}
      ])
    })

    it(`should filter inner media items by lang id exclusive (user's exact template)`, () => {
      const template = `
        <base id="s1">
          <media-group>
            <media type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
              🖼️ Photo group demo

              ENGLISH This is caption first photo
            </media>
            <media lang="id" type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
              🖼️ Demo grup foto

              Ini adalah caption pertama.
            </media>
            <media type="photo" src="https://www.w3schools.com/html/pic_trulli.jpg"></media>
          </media-group>
        </base>
      `
      const compiled = TemplateEngine.compileBlockMedia(template)

      // Default language: only items without lang
      const defaultMedia = compiled.s1!.default!({})
      expect(defaultMedia.type).toBe(`group`)
      expect(defaultMedia.mediaGroup).toHaveLength(2)
      expect(defaultMedia.caption).toContain(`ENGLISH`)

      // id language: ONLY the item with lang="id"
      const idMedia = compiled.s1!.id!({})
      expect(idMedia.type).toBe(`group`)
      expect(idMedia.mediaGroup).toHaveLength(1)
      expect(idMedia.caption).toContain(`Ini adalah caption pertama.`)
      expect(idMedia.mediaGroup![0]!.type).toBe(`photo`)
      expect(idMedia.mediaGroup![0]!.src).toContain(`img_girl.jpg`)
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

  describe(`validateBlockMediaGroup`, () => {
    it(`should allow media-group blocks directly inside base`, () => {
      const template = `
        <base>
          <media-group>
            <media type="photo" src="a.jpg">Caption</media>
            <media type="video" src="b.mp4"></media>
          </media-group>
        </base>
      `

      expect(TemplateEngine.validateTemplate(template).valid).toBe(true)
    })

    it(`should reject unknown media-group attributes`, () => {
      const template = `<base><media-group id="bad"><media type="photo" src="a.jpg"></media></media-group></base>`
      const result = TemplateEngine.validateTemplate(template)

      expect(result.valid).toBe(false)
      expect(result.errors.some((error) => error.message.includes(`Unknown attribute "id" on <media-group>`))).toBe(true)
    })

    it(`should reject unsupported media types inside media-group`, () => {
      const template = `<base><media-group><media type="animation" src="a.gif"></media></media-group></base>`
      const result = TemplateEngine.validateTemplate(template)

      expect(result.valid).toBe(false)
      expect(result.errors.some((error) => error.message.includes(`Attribute "type" on <media> inside <media-group>`))).toBe(true)
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

  describe(`validateBlockPositions`, () => {
    it(`should return valid for empty template`, () => {
      const result = TemplateEngine.validatePositionsBlock(``)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for plain text without <base> block`, () => {
      const result = TemplateEngine.validatePositionsBlock(`Just some text`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]!.message).toContain(`Missing <base> block`)
    })

    it(`should return valid for a well-formed template`, () => {
      const template = `
        <base>
          <message>Hello {{name}}!</message>
          <keyboard>Yes, No</keyboard>
        </base>
      `
      const result = TemplateEngine.validatePositionsBlock(template)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for multiple base blocks`, () => {
      const template = `
        <base id="main">
          <message>Hello</message>
        </base>
        <base id="error">
          <message>Error</message>
        </base>
      `
      const result = TemplateEngine.validatePositionsBlock(template)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for switch with case and default inside message`, () => {
      const template = `
        <base>
          <message>
            <switch value="status">
              <case is="active">Active</case>
              <default>Unknown</default>
            </switch>
          </message>
        </base>
      `
      const result = TemplateEngine.validatePositionsBlock(template)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for map and div blocks inside message`, () => {
      const template = `
        <base>
          <message>
            <map src="items">
              <div>{{e.name}}</div>
            </map>
          </message>
        </base>
      `
      const result = TemplateEngine.validatePositionsBlock(template)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for import and space blocks`, () => {
      const template = `
        <base>
          <import src="header" block="message" />
          <message>Content</message>
          <space />
        </base>
      `
      const result = TemplateEngine.validatePositionsBlock(template)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should ignore passthrough Telegram HTML tags`, () => {
      const template = `
        <base>
          <message><b>Bold</b> and <i>italic</i></message>
        </base>
      `
      const result = TemplateEngine.validatePositionsBlock(template)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should detect base nested inside message`, () => {
      const result = TemplateEngine.validatePositionsBlock(`
        <base>
          <message>
            <base>Nested base</base>
          </message>
        </base>
      `)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0]?.message).toContain(`base`)
      expect(result.errors[0]?.message).toContain(`message`)
    })

    it(`should detect message inside message`, () => {
      const result = TemplateEngine.validatePositionsBlock(`
        <base>
          <message>
            <message>Nested message</message>
          </message>
        </base>
      `)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0]?.message).toContain(`message`)
    })

    it(`should detect case outside switch`, () => {
      const result = TemplateEngine.validatePositionsBlock(`
        <base>
          <case is="test">Outside</case>
        </base>
      `)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0]?.message).toContain(`case`)
    })

    it(`should detect mismatched closing tags`, () => {
      const result = TemplateEngine.validatePositionsBlock(`
        <base>
          <message>Hello</message>
          </keyboard>
        </base>
      `)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0]?.message).toContain(`Mismatched`)
    })

    it(`should detect unexpected closing tag`, () => {
      const result = TemplateEngine.validatePositionsBlock(`
        <base>
          <message>Hello</message>
        </base>
        </message>
      `)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0]?.message).toContain(`Unexpected closing`)
    })

    it(`should detect unclosed block`, () => {
      const result = TemplateEngine.validatePositionsBlock(`
        <base>
          <message>Unclosed
        </base>
      `)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors.some((e) => e.message.includes(`Unclosed`) && e.message.includes(`message`))).toBe(true)
    })

    it(`should return correct line numbers for errors`, () => {
      const result = TemplateEngine.validatePositionsBlock(`<base>\n  <message>\n    <base>Inner</base>\n  </message>\n</base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0]?.line).toBe(3)
    })
  })

  describe(`validateBaseAttributes`, () => {
    it(`should return valid for base with no attributes`, () => {
      const result = TemplateEngine.validateBlockBaseAttributes(`<base></base>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for base with valid id attribute`, () => {
      const result = TemplateEngine.validateBlockBaseAttributes(`<base id="main"></base>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for base with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockBaseAttributes(`<base lang="en"></base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`lang`)
    })

    it(`should return invalid for base with empty id`, () => {
      const result = TemplateEngine.validateBlockBaseAttributes(`<base id=""></base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
      expect(result.errors[0]?.message).toContain(`empty`)
    })

    it(`should report all invalid attributes on a single base`, () => {
      const result = TemplateEngine.validateBlockBaseAttributes(`<base id="x" class="y" data-x="z"></base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(2)
      expect(result.errors[0]?.message).toContain(`class`)
      expect(result.errors[1]?.message).toContain(`data-x`)
    })

    it(`should report unknown attribute on the correct line`, () => {
      const result = TemplateEngine.validateBlockBaseAttributes(`<base></base>\n<base lang="en"></base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.line).toBe(2)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<base lang="en"><message>Hi</message></base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`lang`))).toBe(true)
    })
  })

  describe(`validateMessageAttributes`, () => {
    it(`should return valid for message with no attributes`, () => {
      const result = TemplateEngine.validateBlockMessageAttributes(`<message>Hello</message>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for message with valid lang attribute`, () => {
      const result = TemplateEngine.validateBlockMessageAttributes(`<message lang="en">Hello</message>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for message with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockMessageAttributes(`<message id="1">Hello</message>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })

    it(`should report unknown attribute on the correct line`, () => {
      const result = TemplateEngine.validateBlockMessageAttributes(`<message>Ok</message>\n<message class="x">Bad</message>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.line).toBe(2)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<base><message id="x">Hi</message></base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateKeyboardAttributes`, () => {
    it(`should return valid for keyboard with no attributes`, () => {
      const result = TemplateEngine.validateBlockKeyboardAttributes(`<keyboard>A, B</keyboard>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for keyboard with type inline`, () => {
      const result = TemplateEngine.validateBlockKeyboardAttributes(`<keyboard type="inline">A, B</keyboard>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for keyboard with type bottom`, () => {
      const result = TemplateEngine.validateBlockKeyboardAttributes(`<keyboard type="bottom">A, B</keyboard>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for keyboard with valid lang and type`, () => {
      const result = TemplateEngine.validateBlockKeyboardAttributes(`<keyboard lang="id" type="bottom">Ya, Tidak</keyboard>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for keyboard with invalid type value`, () => {
      const result = TemplateEngine.validateBlockKeyboardAttributes(`<keyboard type="top">A, B</keyboard>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`must be "inline" or "bottom"`)
    })

    it(`should return invalid for keyboard with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockKeyboardAttributes(`<keyboard id="x">A, B</keyboard>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<base><keyboard id="x">A</keyboard></base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateMediaAttributes`, () => {
    it(`should return valid for media with all valid attributes`, () => {
      const result = TemplateEngine.validateBlockMediaAttributes(`<media type="photo" src="img.jpg" lang="en">Caption</media>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for media with location attributes`, () => {
      const result = TemplateEngine.validateBlockMediaAttributes(`<media type="location" latitude="-6.2" longitude="106.8">Loc</media>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for media with contact attributes`, () => {
      const result = TemplateEngine.validateBlockMediaAttributes(`<media type="contact" phone="123" first_name="John" last_name="Doe" vcard="BEGIN:VCARD">Contact</media>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for media with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockMediaAttributes(`<media type="photo" id="x">Cap</media>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })

    it(`should return invalid for media with invalid type value`, () => {
      const result = TemplateEngine.validateBlockMediaAttributes(`<media type="gif">Cap</media>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`must be one of`)
      expect(result.errors[0]?.message).toContain(`gif`)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<base><media type="photo" id="x">Cap</media></base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateDescriptionAttributes`, () => {
    it(`should return valid for description with no attributes`, () => {
      const result = TemplateEngine.validateBlockDescriptionAttributes(`<description>Start</description>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for description with lang and scope`, () => {
      const result = TemplateEngine.validateBlockDescriptionAttributes(`<description lang="id" scope="chat_administrators">Mulai</description>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for description with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockDescriptionAttributes(`<description id="x">Start</description>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<base><description id="x">Start</description></base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateScriptAttributes`, () => {
    it(`should return valid for script with no attributes`, () => {
      const result = TemplateEngine.validateBlockScriptAttributes(`<script>return x;</script>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for script with any attribute`, () => {
      const result = TemplateEngine.validateBlockScriptAttributes(`<script lang="en">return x;</script>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`lang`)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<base><script id="x">return 1;</script></base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateSwitchAttributes`, () => {
    it(`should return valid for switch with value attribute`, () => {
      const result = TemplateEngine.validateBlockSwitchAttributes(`<switch value="status"><case is="a">A</case></switch>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for switch with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockSwitchAttributes(`<switch value="status" id="x"><case is="a">A</case></switch>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<base><message><switch id="x"><case is="a">A</case></switch></message></base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateCaseAttributes`, () => {
    it(`should return valid for case with is attribute`, () => {
      const result = TemplateEngine.validateBlockCaseAttributes(`<case is="active">Active</case>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for case with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockCaseAttributes(`<case is="a" id="x">A</case>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })
  })

  describe(`validateDefaultAttributes`, () => {
    it(`should return valid for default with no attributes`, () => {
      const result = TemplateEngine.validateBlockDefaultAttributes(`<default>Unknown</default>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for default with any attribute`, () => {
      const result = TemplateEngine.validateBlockDefaultAttributes(`<default id="x">Unknown</default>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })
  })

  describe(`validateMapAttributes`, () => {
    it(`should return valid for map with src and join`, () => {
      const result = TemplateEngine.validateBlockMapAttributes(`<map src="items" join=", ">{{e}}</map>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for map with src only`, () => {
      const result = TemplateEngine.validateBlockMapAttributes(`<map src="items">{{e}}</map>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for map with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockMapAttributes(`<map src="items" id="x">{{e}}</map>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<base><message><map src="x" id="y">{{e}}</map></message></base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateDivAttributes`, () => {
    it(`should return valid for div with no attributes`, () => {
      const result = TemplateEngine.validateBlockDivAttributes(`<div>content</div>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for div with any attribute`, () => {
      const result = TemplateEngine.validateBlockDivAttributes(`<div class="x">content</div>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`class`)
    })
  })

  describe(`validateImportAttributes`, () => {
    it(`should return valid for import with src only`, () => {
      const result = TemplateEngine.validateBlockImportAttributes(`<import src="other" />`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for import with all valid attributes`, () => {
      const result = TemplateEngine.validateBlockImportAttributes(`<import src="other" block="message" base="main" lang="en" section="value" />`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for import with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockImportAttributes(`<import src="other" id="x" />`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<base><import src="x" id="y" /></base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateSpaceAttributes`, () => {
    it(`should return valid for space with no attributes`, () => {
      const result = TemplateEngine.validateBlockSpaceAttributes(`<space />`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for space with any attribute`, () => {
      const result = TemplateEngine.validateBlockSpaceAttributes(`<space id="x" />`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })
  })
})
