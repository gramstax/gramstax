import {describe, expect, it} from "bun:test"
import {InputFile} from "grammy"
import {TemplateEngine} from "~/template/engine"

describe(`TemplateEngine`, () => {
  describe(`_processGMessageBlocks`, () => {
    it(`should parse message with explicit lang`, () => {
      const template = `<g-message lang="en">Hello</g-message>`
      const result = TemplateEngine._processGMessageBlocks(template)
      expect(result).toEqual({en: `Hello`})
    })

    it(`should parse <g-message> with default lang (missing attr lang)`, () => {
      const template = `<g-message>Hello</g-message>`
      const result = TemplateEngine._processGMessageBlocks(template)
      expect(result).toEqual({default: `Hello`})
    })

    it(`should parse <g-message> with mixed attributes`, () => {
      const template = `<g-message id="1" lang="es">Hola</g-message>`
      const result = TemplateEngine._processGMessageBlocks(template)
      expect(result).toEqual({es: `Hola`})
    })
  })

  describe(`_processGDescriptionBlocks`, () => {
    it(`should parse <g-description> with explicit lang and scope`, () => {
      const template = `<g-description lang="en" scope="private">Desc</g-description>`
      const result = TemplateEngine._processGDescriptionBlocks(template)
      expect(result).toEqual({en: {private: `Desc`}})
    })

    it(`should parse <g-description> with default lang and scope`, () => {
      const template = `<g-description>Desc</g-description>`
      const result = TemplateEngine._processGDescriptionBlocks(template)
      expect(result).toEqual({default: {default: `Desc`}})
    })

    it(`should parse <g-description> with mixed attributes`, () => {
      const template = `<g-description scope="group" lang="id">Deskripsi</g-description>`
      const result = TemplateEngine._processGDescriptionBlocks(template)
      expect(result).toEqual({id: {group: `Deskripsi`}})
    })
  })

  describe(`_processGMediaBlocks`, () => {
    it(`should parse <g-media> with explicit lang`, () => {
      const template = `<g-media lang="en" type="photo" src="url">Caption</g-media>`
      const result = TemplateEngine._processGMediaBlocks(template)
      expect(result.en).toBeDefined()
      expect(result.en?.type).toBe(`photo`)
      expect(result.en?.caption).toBe(`Caption`)
    })

    it(`should parse <g-media> with default lang`, () => {
      const template = `<g-media type="photo" src="url">Caption</g-media>`
      const result = TemplateEngine._processGMediaBlocks(template)
      expect(result.default).toBeDefined()
      expect(result?.default?.type).toBe(`photo`)
    })

    it(`should parse pipe-delimited <g-media> src values as srcList`, () => {
      const template = `<g-media type="photo" src="a.jpg | b.jpg | c.jpg">Album</g-media>`
      const result = TemplateEngine._processGMediaBlocks(template)

      expect(result.default?.src).toBe(`a.jpg | b.jpg | c.jpg`)
      expect(result.default?.srcList).toEqual([`a.jpg`, `b.jpg`, `c.jpg`])
    })

    it(`should cap pipe-delimited <g-media> srcList to Telegram media group limit`, () => {
      const src = Array.from({length: 12}, (_, index) => `file-${index + 1}.jpg`).join(`|`)
      const template = `<g-media type="photo" src="${src}">Album</g-media>`
      const result = TemplateEngine._processGMediaBlocks(template)

      expect(result.default?.srcList).toHaveLength(10)
      expect(result.default?.srcList?.at(0)).toBe(`file-1.jpg`)
      expect(result.default?.srcList?.at(9)).toBe(`file-10.jpg`)
    })
  })

  describe(`_processGKeyboardBlocks`, () => {
    it(`should parse <g=keyboard> with explicit lang`, () => {
      const template = `<g-keyboard lang="en">Button</g-keyboard>`
      const result = TemplateEngine._processGKeyboardBlocks(template)
      expect(result.en).toBeDefined()
      expect(result?.en?.inline).toBe(`Button`)
    })

    it(`should parse <g=keyboard> with default lang`, () => {
      const template = `<g-keyboard>Button</g-keyboard>`
      const result = TemplateEngine._processGKeyboardBlocks(template)
      expect(result.default).toBeDefined()
      expect(result?.default?.inline).toBe(`Button`)
    })

    it(`should parse <g=keyboard> with comma-separated buttons`, () => {
      const template = `<g-keyboard>test, 1, 666, 27</g-keyboard>`
      const result = TemplateEngine._processGKeyboardBlocks(template)
      const labels = result.default?.inline?.split(/(?<!\\),\s*/).map((l: string) => l.trim())
      expect(labels).toEqual([`test`, `1`, `666`, `27`])
    })
  })

  describe(`_splitKeyboardLabels`, () => {
    it(`should split simple comma-separated labels`, () => {
      const result = TemplateEngine._splitKeyboardLabels(`Yes, No, Cancel`)
      expect(result).toEqual([`Yes`, `No`, `Cancel`])
    })

    it(`should NOT split on commas inside double-quoted HTML attribute values`, () => {
      const result = TemplateEngine._splitKeyboardLabels(
        `Btn1, <g-map src="items" join=", ">{{e.name}}</g-map>, Done`
      )
      expect(result).toEqual([
        `Btn1`,
        `<g-map src="items" join=", ">{{e.name}}</g-map>`,
        `Done`
      ])
    })

    it(`should NOT split on commas inside nested g-map blocks`, () => {
      const result = TemplateEngine._splitKeyboardLabels(
        `<g-map src="outer" join="|"><g-map src="e.items" join=", ">{{e2}}</g-map></g-map>, Last`
      )
      expect(result).toEqual([
        `<g-map src="outer" join="|"><g-map src="e.items" join=", ">{{e2}}</g-map></g-map>`,
        `Last`
      ])
    })

    it(`should handle escaped commas as literal characters`, () => {
      const result = TemplateEngine._splitKeyboardLabels(`a\\, b, c`)
      expect(result).toEqual([`a\\, b`, `c`])
    })

    it(`should handle single label with no commas`, () => {
      const result = TemplateEngine._splitKeyboardLabels(`JustOneButton`)
      expect(result).toEqual([`JustOneButton`])
    })

    it(`should handle empty string`, () => {
      const result = TemplateEngine._splitKeyboardLabels(``)
      expect(result).toEqual([``])
    })

    it(`should handle g-map with multiple attributes containing commas`, () => {
      const result = TemplateEngine._splitKeyboardLabels(
        `<g-map src="data" join=", " filter="a,b,c">{{e}}</g-map>`
      )
      expect(result).toEqual([
        `<g-map src="data" join=", " filter="a,b,c">{{e}}</g-map>`
      ])
    })

    it(`should handle multiple g-map blocks separated by commas`, () => {
      const result = TemplateEngine._splitKeyboardLabels(
        `<g-map src="a">{{e}}</g-map>, <g-map src="b" join=", ">{{e}}</g-map>`
      )
      expect(result).toEqual([
        `<g-map src="a">{{e}}</g-map>`,
        `<g-map src="b" join=", ">{{e}}</g-map>`
      ])
    })

    it(`should handle self-closing tags with attributes`, () => {
      const result = TemplateEngine._splitKeyboardLabels(
        `<g-media type="photo" src="x"/>, Next`
      )
      expect(result).toEqual([
        `<g-media type="photo" src="x"/>`,
        `Next`
      ])
    })

    it(`should trim whitespace from labels`, () => {
      const result = TemplateEngine._splitKeyboardLabels(`  A  ,  B  ,  C  `)
      expect(result).toEqual([`A`, `B`, `C`])
    })
  })

  describe(`_processGMapBlocks`, () => {
    it(`should iterate over a list with e and i`, () => {
      const template = `<g-map src="users">{{i}}. {{e.name}}</g-map>`
      const processed = TemplateEngine._processGMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        users: [{name: `Alice`}, {name: `Bob`}]
      }
      expect(fn(data)).toBe(`0. Alice\n1. Bob`)
    })

    it(`should support custom join separator`, () => {
      const template = `<g-map src="tags" join=", ">{{e}}</g-map>`
      const processed = TemplateEngine._processGMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        tags: [`red`, `green`, `blue`]
      }
      expect(fn(data)).toBe(`red, green, blue`)
    })

    it(`should support nested properties and global variables`, () => {
      const template = `<g-map src="items">{{e.id}}: {{globalPrefix}}-{{e.value}}</g-map>`
      let processed = TemplateEngine._processGMapBlocks(template)
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
      const template = `List:\n<g-map src="emptyList">{{e}}</g-map>`
      const processed = TemplateEngine._processGMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {emptyList: []}
      expect(fn(data)).toBe(`List:\n`)
    })
  })

  describe(`_processGSwitchBlocks with g-map`, () => {
    it(`should compile <g-switch> with <g-map> in <g-case>`, () => {
      const template = `<g-switch value="status"><g-case is="active"><g-map src="items">{{e}}</g-map></g-case><g-default>none</g-default></g-switch>`
      let processed = TemplateEngine._processGMapBlocks(template)
      processed = TemplateEngine._processGSwitchBlocks(processed)
      processed = TemplateEngine._processScopeExec(processed)
      processed = TemplateEngine._processScopeVariables(processed)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        status: `active`,
        items: [`a`, `b`, `c`]
      }
      expect(fn(data)).toBe(`a\nb\nc`)
    })

    it(`should compile <g-switch> with <g-map> in <g-default>`, () => {
      const template = `<g-switch value="status"><g-case is="inactive">none</g-case><g-default><g-map src="items">{{e}}</g-map></g-default></g-switch>`
      let processed = TemplateEngine._processGMapBlocks(template)
      processed = TemplateEngine._processGSwitchBlocks(processed)
      processed = TemplateEngine._processScopeExec(processed)
      processed = TemplateEngine._processScopeVariables(processed)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        status: `unknown`,
        items: [`x`, `y`]
      }
      expect(fn(data)).toBe(`x\ny`)
    })

    it(`should fall back to default case when no match`, () => {
      const template = `<g-switch value="status"><g-case is="active"><g-map src="items">{{e}}</g-map></g-case><g-default>fallback</g-default></g-switch>`
      let processed = TemplateEngine._processGMapBlocks(template)
      processed = TemplateEngine._processGSwitchBlocks(processed)
      processed = TemplateEngine._processScopeExec(processed)
      processed = TemplateEngine._processScopeVariables(processed)
      const fn = TemplateEngine._compileToFunction(processed, false)

      expect(fn({status: `unknown`, items: [`a`]})).toBe(`fallback`)
    })
  })

  describe(`g-map inside g-switch children (integration)`, () => {
    it(`should compile a full <g-message> with <g-switch> containing <g-map> in <g-case>`, () => {
      const template = `
        <g-base>
          <g-message>
            Status: <g-switch value="status">
              <g-case is="active"><g-map src="users" join=", ">{{e.name}}</g-map></g-case>
              <g-default>inactive</g-default>
            </g-switch>
          </g-message>
        </g-base>
      `
      const result = TemplateEngine.compileBlockGMessage(template)
      const fn = result.default!.default!

      const activeData = {
        status: `active`,
        users: [{name: `Alice`}, {name: `Bob`}]
      }
      expect(fn(activeData)).toBe(`Status: Alice, Bob`)

      const inactiveData = {
        status: `offline`,
        users: [{name: `Charlie`}]
      }
      expect(fn(inactiveData)).toBe(`Status: inactive`)
    })

    it(`should compile a full <g-message> with <g-map> in <g-default>`, () => {
      const template = `
        <g-base>
          <g-message>
            <g-switch value="role">
              <g-case is="admin">Admin panel</g-case>
              <g-default>
                <g-map src="notifications">{{e.title}}</g-map>
              </g-default>
            </g-switch>
          </g-message>
        </g-base>
      `
      const result = TemplateEngine.compileBlockGMessage(template)
      const fn = result.default!.default!

      const userData = {
        role: `user`,
        notifications: [{title: `New message`}, {title: `System update`}]
      }
      expect(fn(userData)).toBe(`New message\nSystem update`)

      const adminData = {role: `admin`}
      expect(fn(adminData)).toBe(`Admin panel`)
    })

    it(`should handle <g-map> with scope exec inside <g-case>`, () => {
      const template = `
        <g-base>
          <g-message>
            <g-switch value="show">
              <g-case is="true"><g-map src="nums">{~ e * 2 ~}</g-map></g-case>
              <g-default>hidden</g-default>
            </g-switch>
          </g-message>
        </g-base>
      `
      const result = TemplateEngine.compileBlockGMessage(template)
      const fn = result.default!.default!

      expect(fn({show: `true`, nums: [1, 2, 3]})).toBe(`2\n4\n6`)
      expect(fn({show: `false`, nums: [5]})).toBe(`hidden`)
    })

    it(`should handle <g-map> with custom join inside <g-case>`, () => {
      const template = `<g-switch value="t"><g-case is="yes"><g-map src="tags" join=" | ">{{e}}</g-map></g-case><g-default>no</g-default></g-switch>`
      let processed = TemplateEngine._processGMapBlocks(template)
      processed = TemplateEngine._processGSwitchBlocks(processed)
      processed = TemplateEngine._processScopeExec(processed)
      processed = TemplateEngine._processScopeVariables(processed)
      const fn = TemplateEngine._compileToFunction(processed, false)

      expect(fn({t: `yes`, tags: [`a`, `b`, `c`]})).toBe(`a | b | c`)
      expect(fn({t: `no`})).toBe(`no`)
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
      const template = `<g-map src="nums">{~ e * 2 ~}</g-map>`
      let processed = TemplateEngine._processGMapBlocks(template)
      processed = TemplateEngine._processScopeExec(processed)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {nums: [1, 2, 3]}
      expect(fn(data)).toBe(`2\n4\n6`)
    })

    it(`should support index math inside map`, () => {
      const template = `<g-map src="nums">{~ i + 1 ~}. {{e}}</g-map>`
      let processed = TemplateEngine._processGMapBlocks(template)
      processed = TemplateEngine._processScopeExec(processed)

      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {nums: [`a`, `b`]}
      expect(fn(data)).toBe(`1. a\n2. b`)
    })
  })

  describe(`compileMedia`, () => {
    it(`should compile dynamic attributes in <g-media> blocks`, () => {
      const template = `
        <g-base id="profile">
          <g-media type="photo" src="{{avatar}}">Name: {{name}}</g-media>
        </g-base>
      `
      const compiled = TemplateEngine.compileBlockGMedia(template)
      const data = {avatar: `http://alice.png`, name: `Alice`}
      const media = compiled.profile!.default!(data)

      expect(media.type).toBe(`photo`)
      expect(media.src).toBe(`http://alice.png`)
      expect(media.caption).toBe(`Name: Alice`)
    })

    it(`should keep bare-placeholder string src byte-identical incl. escaping`, () => {
      const template = `<g-base><g-media type="document" src="{{file}}">cap</g-media></g-base>`
      const compiled = TemplateEngine.compileBlockGMedia(template)
      expect(compiled.default!.default!({file: `./x.log`}).src).toBe(`./x.log`)
      expect(compiled.default!.default!({file: `a&b<c>.jpg`}).src).toBe(`a&amp;b&lt;c&gt;.jpg`)
    })

    it(`should pass Buffer src by reference through a bare placeholder`, () => {
      const template = `<g-base><g-media type="document" src="{{file}}">cap</g-media></g-base>`
      const compiled = TemplateEngine.compileBlockGMedia(template)
      const buf = Buffer.from(`hello`)
      expect(compiled.default!.default!({file: buf}).src).toBe(buf)
    })

    it(`should pass InputFile src by reference through a bare placeholder`, () => {
      const template = `<g-base><g-media type="document" src="{{file}}">cap</g-media></g-base>`
      const compiled = TemplateEngine.compileBlockGMedia(template)
      const file = new InputFile(Buffer.from(`hello`), `a.txt`)
      expect(compiled.default!.default!({file}).src).toBe(file)
    })

    it(`should pass dummy object src by reference through a bare placeholder`, () => {
      const template = `<g-base><g-media type="document" src="{{file}}">cap</g-media></g-base>`
      const compiled = TemplateEngine.compileBlockGMedia(template)
      const obj = {custom: `payload`} as any
      expect(compiled.default!.default!({file: obj}).src).toBe(obj)
    })

    it(`should render empty string for missing bare-placeholder src key`, () => {
      const template = `<g-base><g-media type="document" src="{{file}}">cap</g-media></g-base>`
      const compiled = TemplateEngine.compileBlockGMedia(template)
      expect(compiled.default!.default!({}).src).toBe(``)
    })

    it(`should pass objects by reference through dotted bare-placeholder paths`, () => {
      const template = `<g-base><g-media type="document" src="  {{a.b}}  ">cap</g-media></g-base>`
      const compiled = TemplateEngine.compileBlockGMedia(template)
      const buf = Buffer.from(`nested`)
      expect(compiled.default!.default!({a: {b: buf}}).src).toBe(buf)
      expect(compiled.default!.default!({a: {b: `./x.log`}}).src).toBe(`  ./x.log  `)
      expect(compiled.default!.default!({}).src).toBe(`    `)
    })

    it(`should keep non-bare src stringified when data holds an object`, () => {
      const template = `<g-base><g-media type="document" src="pre-{{x}}">cap</g-media></g-base>`
      const compiled = TemplateEngine.compileBlockGMedia(template)
      expect(compiled.default!.default!({x: {custom: 1}}).src).toBe(`pre-[object Object]`)
    })

    it(`should pass media-group item src objects by reference`, () => {
      const template = `<g-base><g-media-group><g-media type="photo" src="{{pic}}">Cap</g-media><g-media type="photo" src="static.jpg"></g-media></g-media-group></g-base>`
      const compiled = TemplateEngine.compileBlockGMedia(template)
      const buf = Buffer.from(`group-bytes`)
      const media = compiled.default!.default!({pic: buf})
      expect(media.mediaGroup![0]!.src).toBe(buf)
      expect(media.mediaGroup![1]!.src).toBe(`static.jpg`)
    })

    it(`should compile dynamic pipe-delimited <g-media> src values as srcList`, () => {
      const template = `
        <g-base id="album">
          <g-media type="photo" src="{{first}}|{{second}}">Album: {{title}}</g-media>
        </g-base>
      `
      const compiled = TemplateEngine.compileBlockGMedia(template)
      const media = compiled.album!.default!({first: `a.jpg`, second: `b.jpg`, title: `Photos`})

      expect(media.src).toBe(`a.jpg|b.jpg`)
      expect(media.srcList).toEqual([`a.jpg`, `b.jpg`])
      expect(media.caption).toBe(`Album: Photos`)
    })

    it(`should compile static <g-media> filename`, () => {
      const template = `
        <g-base id="doc">
          <g-media type="document" src="./a.tar.gz" filename="backup.tar.gz">cap</g-media>
        </g-base>
      `
      const compiled = TemplateEngine.compileBlockGMedia(template)
      const media = compiled.doc!.default!({})

      expect(media.src).toBe(`./a.tar.gz`)
      expect(media.filename).toBe(`backup.tar.gz`)
      expect(media.caption).toBe(`cap`)
    })

    it(`should interpolate {{var}} in <g-media> filename`, () => {
      const template = `
        <g-base id="doc">
          <g-media type="document" src="./a.tar.gz" filename="backup-{{date}}.tar.gz">cap</g-media>
        </g-base>
      `
      const compiled = TemplateEngine.compileBlockGMedia(template)
      const media = compiled.doc!.default!({date: `2026-09-17`})

      expect(media.src).toBe(`./a.tar.gz`)
      expect(media.filename).toBe(`backup-2026-09-17.tar.gz`)
      expect(media.caption).toBe(`cap`)
    })

    it(`should apply filter pipe in <g-media> filename`, () => {
      const template = `
        <g-base id="doc">
          <g-media type="document" src="./a.tar.gz" filename="{{name|upper}}.tar.gz">cap</g-media>
        </g-base>
      `
      const compiled = TemplateEngine.compileBlockGMedia(template)
      const media = compiled.doc!.default!({name: `backup`})

      expect(media.filename).toBe(`BACKUP.tar.gz`)
    })

    it(`should leave filename undefined when <g-media> has no filename attr`, () => {
      const template = `
        <g-base id="doc">
          <g-media type="document" src="./a.tar.gz">cap</g-media>
        </g-base>
      `
      const compiled = TemplateEngine.compileBlockGMedia(template)
      const media = compiled.doc!.default!({})

      expect(media.filename).toBeUndefined()
    })

    it(`should accept filename attr (incl. placeholder) and still reject unknown attrs on <g-media>`, () => {
      const valid = TemplateEngine.validateBlockGMediaAttributes(`<g-media type="document" src="./a.tar.gz" filename="backup-{{date}}.tar.gz">cap</g-media>`)
      expect(valid.valid).toBe(true)
      expect(valid.errors).toEqual([])

      const invalid = TemplateEngine.validateBlockGMediaAttributes(`<g-media type="document" src="./a.tar.gz" filename="x.tar.gz" bogus="1">cap</g-media>`)
      expect(invalid.valid).toBe(false)
      expect(invalid.errors.some((e) => e.message.includes(`bogus`))).toBe(true)
    })

    it(`should compile <g-media-group> blocks with mixed photo and video items`, () => {
      const template = `
        <g-base id="album">
          <g-media-group>
            <g-media type="photo" src="{{photoUrl}}">Album: {{title}}</g-media>
            <g-media type="video" src="{{videoUrl}}"></g-media>
            <g-media type="photo" src="static.jpg"></g-media>
          </g-media-group>
        </g-base>
      `
      const compiled = TemplateEngine.compileBlockGMedia(template)
      const media = compiled.album!.default!({photoUrl: `photo.jpg`, videoUrl: `video.mp4`, title: `Trip`})

      expect(media.type).toBe(`group`)
      expect(media.caption).toBe(`Album: Trip`)
      expect(media.mediaGroup).toEqual([
        {type: `photo`, src: `photo.jpg`, caption: `Album: Trip`},
        {type: `video`, src: `video.mp4`},
        {type: `photo`, src: `static.jpg`}
      ])
    })

    it(`should filter inner <g-media> items by lang attribute inside <g-media-group>`, () => {
      const template = `
        <g-base id="langGroup">
          <g-media-group>
            <g-media type="photo" src="en.jpg">English caption</g-media>
            <g-media lang="wkwkland" type="photo" src="wkwk.jpg">Wkwkland caption</g-media>
            <g-media type="photo" src="shared.jpg"></g-media>
          </g-media-group>
        </g-base>
      `
      const compiled = TemplateEngine.compileBlockGMedia(template)

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
      expect(wkwkMedia.mediaGroup).toEqual([{type: `photo`, src: `wkwk.jpg`, caption: `Wkwkland caption`}])
    })

    it(`should filter inner <g-media> items by lang id exclusive (user's exact template)`, () => {
      const template = `
        <g-base id="s1">
          <g-media-group>
            <g-media type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
              🖼️ Photo group demo

              ENGLISH This is caption first photo
            </g-media>
            <g-media lang="id" type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
              🖼️ Demo grup foto

              Ini adalah caption pertama.
            </g-media>
            <g-media type="photo" src="https://www.w3schools.com/html/pic_trulli.jpg"></g-media>
          </g-media-group>
        </g-base>
      `
      const compiled = TemplateEngine.compileBlockGMedia(template)

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

    it(`should include shared items in all language variants inside <g-media-group>, preserving document order`, () => {
      const template = `
        <g-base id="shareTest">
          <g-media-group>
            <g-media shared type="photo" src="shared.jpg">Shared caption</g-media>
            <g-media type="photo" src="default.jpg">Default only</g-media>
            <g-media lang="id" type="photo" src="id.jpg">ID only</g-media>
          </g-media-group>
        </g-base>
      `
      const compiled = TemplateEngine.compileBlockGMedia(template)

      // Default: items where !lang OR shared — e.g. shared.jpg (shared) + default.jpg (no lang)
      // Order: pic_trulli.jpg (index 0), default.jpg (index 1)
      const defaultMedia = compiled.shareTest!.default!({})
      expect(defaultMedia.type).toBe(`group`)
      expect(defaultMedia.mediaGroup).toHaveLength(2)
      expect(defaultMedia.caption).toBe(`Shared caption`)
      expect(defaultMedia.mediaGroup).toEqual([
        {type: `photo`, src: `shared.jpg`, caption: `Shared caption`},
        {type: `photo`, src: `default.jpg`, caption: `Default only`}
      ])

      // id: items where lang=id OR shared — e.g. shared.jpg (shared) + id.jpg (lang=id)
      const idMedia = compiled.shareTest!.id!({})
      expect(idMedia.type).toBe(`group`)
      expect(idMedia.mediaGroup).toHaveLength(2)
      expect(idMedia.mediaGroup).toEqual([
        {type: `photo`, src: `shared.jpg`, caption: `Shared caption`},
        {type: `photo`, src: `id.jpg`, caption: `ID only`}
      ])
    })

    it(`should respect shared="false" as not shared`, () => {
      const template = `
        <g-base id="shareFalse">
          <g-media-group>
            <g-media type="photo" src="default.jpg">Default</g-media>
            <g-media lang="id" type="photo" src="id.jpg">ID</g-media>
            <g-media shared="false" type="photo" src="notshared.jpg">Not shared</g-media>
          </g-media-group>
        </g-base>
      `
      const compiled = TemplateEngine.compileBlockGMedia(template)

      const idMedia = compiled.shareFalse!.id!({})
      // shared="false" item should NOT appear in id variant
      expect(idMedia.mediaGroup).toHaveLength(1)
      expect(idMedia.mediaGroup![0]!.src).toContain(`id.jpg`)
    })

    it(`should support expressions in coordinates`, () => {
      const template = `
        <g-base id="loc">
          <g-media type="location" latitude="{~ lat + 1 ~}" longitude="{{lng}}"></g-media>
        </g-base>
      `
      const compiled = TemplateEngine.compileBlockGMedia(template)
      const data = {lat: 10, lng: `20`}
      const media = compiled.loc!.default!(data)

      expect(media.latitude).toBe(`11`)
      expect(media.longitude).toBe(`20`)
    })

    it(`should prioritize local variables for both {{...}} and {~ ... ~} syntax`, () => {
      // Test {{e}}
      const template1 = `<g-map src="arr">{{e}}</g-map>`
      const fn1 = TemplateEngine._compileToFunction(TemplateEngine._processScopeVariables(TemplateEngine._processGMapBlocks(template1)), false)

      // Test {~ e ~}
      const template2 = `<g-map src="arr">{~ e ~}</g-map>`
      const fn2 = TemplateEngine._compileToFunction(TemplateEngine._processScopeExec(TemplateEngine._processGMapBlocks(template2)), false)

      const data = {
        arr: [`local`],
        e: `global`
      }
      expect(fn1(data)).toBe(`local`)
      expect(fn2(data)).toBe(`local`)
    })
  })

  describe(`nested g-map blocks`, () => {
    it(`should iterate over nested g-map blocks with depth indexing`, () => {
      const template = [
        `<g-map src="orders">`,
        `  {{e.id}}:`,
        `  <g-map src="e.items" join=", ">{{e2.name}}</g-map>`,
        `</g-map>`
      ].join(`\n`)
      const processed = TemplateEngine._processGMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        orders: [
          {id: 1, items: [{name: `A`}, {name: `B`}]},
          {id: 2, items: [{name: `C`}]}
        ]
      }
      expect(fn(data).trim()).toBe(`1:\nA, B\n2:\nC`)
    })

    it(`should handle three levels of nested g-map`, () => {
      const template = [
        `<g-map src="groups">`,
        `  {{e.name}}:`,
        `  <g-map src="e.items">`,
        `    - {{e2.name}}`,
        `    <g-map src="e2.tags" join=", ">{{e3}}</g-map>`,
        `  </g-map>`,
        `</g-map>`
      ].join(`\n`)
      const processed = TemplateEngine._processGMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        groups: [
          {
            name: `Fruits`,
            items: [
              {name: `Apple`, tags: [`red`, `sweet`]},
              {name: `Lemon`, tags: [`yellow`, `sour`]}
            ]
          }
        ]
      }
      const result = fn(data).trim()
      expect(result).toContain(`Fruits:`)
      expect(result).toContain(`- Apple`)
      expect(result).toContain(`red, sweet`)
      expect(result).toContain(`- Lemon`)
      expect(result).toContain(`yellow, sour`)
    })

    it(`should produce identical output for non-nested maps (backward compat)`, () => {
      const template = `<g-map src="users" join=", ">{{e.name}} ({{i}})</g-map>`
      const processed = TemplateEngine._processGMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {users: [{name: `Alice`}, {name: `Bob`}]}
      expect(fn(data)).toBe(`Alice (0), Bob (1)`)
    })

    it(`should work with scope exec inside nested maps`, () => {
      const template = [
        `<g-map src="orders">`,
        `  <g-map src="e.items" join=", ">{~ e2.price * e2.qty ~}</g-map>`,
        `</g-map>`
      ].join(`\n`)
      let processed = TemplateEngine._processGMapBlocks(template)
      processed = TemplateEngine._processScopeExec(processed)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        orders: [
          {items: [{price: 10, qty: 2}, {price: 5, qty: 3}]}
        ]
      }
      expect(fn(data).trim()).toBe(`20, 15`)
    })

    it(`should work with global variables in nested maps`, () => {
      const template = [
        `<g-map src="orders">`,
        `  <g-map src="e.items" join=", ">{{e2.name}}-{{prefix}}</g-map>`,
        `</g-map>`
      ].join(`\n`)
      let processed = TemplateEngine._processGMapBlocks(template)
      processed = TemplateEngine._processScopeVariables(processed)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        orders: [{items: [{name: `A`}, {name: `B`}]}],
        prefix: `#`
      }
      expect(fn(data).trim()).toBe(`A-#, B-#`)
    })

    it(`should handle empty arrays at outer level`, () => {
      const template = [
        `<g-map src="orders">`,
        `  {{e.id}}:`,
        `  <g-map src="e.items">{{e2.name}}</g-map>`,
        `</g-map>`
      ].join(`\n`)
      const processed = TemplateEngine._processGMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      expect(fn({orders: []}).trim()).toBe(``)
    })

    it(`should handle empty arrays at inner level`, () => {
      const template = [
        `<g-map src="orders">`,
        `  {{e.id}}:`,
        `  <g-map src="e.items">{{e2.name}}</g-map>`,
        `</g-map>`
      ].join(`\n`)
      const processed = TemplateEngine._processGMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {orders: [{id: 1, items: []}]}
      expect(fn(data).trim()).toBe(`1:`)
    })

    it(`should support join at both outer and inner levels`, () => {
      const template = [
        `<g-map src="categories" join="\\n---\\n">`,
        `  {{e.cat}}: <g-map src="e.items" join=", ">{{e2}}</g-map>`,
        `</g-map>`
      ].join(`\n`)
      const processed = TemplateEngine._processGMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        categories: [
          {cat: `A`, items: [`x`, `y`]},
          {cat: `B`, items: [`z`]}
        ]
      }
      expect(fn(data).trim()).toBe(`A: x, y\n---\nB: z`)
    })

    it(`should compile full <g-message> with nested g-map`, () => {
      const template = [
        `<g-base>`,
        `  <g-message>`,
        `    <g-map src="orders">`,
        `      Order {{i}}: {{e.name}}`,
        `      <g-map src="e.items" join="\\n">- {{e2.name}} ({{e2.qty}})</g-map>`,
        `    </g-map>`,
        `  </g-message>`,
        `</g-base>`
      ].join(`\n`)
      const compiled = TemplateEngine.compileBlockGMessage(template)
      const fn = compiled.default!.default!

      const data = {
        orders: [{
          name: `Order1`,
          items: [{name: `ItemA`, qty: 2}, {name: `ItemB`, qty: 1}]
        }]
      }
      const result = fn(data)
      expect(result).toContain(`Order 0: Order1`)
      expect(result).toContain(`- ItemA (2)`)
      expect(result).toContain(`- ItemB (1)`)
    })
  })

  describe(`nested g-map validation and integration`, () => {
    it(`should validate nested g-map inside g-map`, () => {
      const template = [
        `<g-base>`,
        `  <g-message>`,
        `    <g-map src="outer">`,
        `      <g-map src="e.inner">{{e2}}</g-map>`,
        `    </g-map>`,
        `  </g-message>`,
        `</g-base>`
      ].join(`\n`)
      const result = TemplateEngine.validateTemplate(template)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should validate nested g-map inside g-case`, () => {
      const template = [
        `<g-base>`,
        `  <g-message>`,
        `    <g-switch value="s">`,
        `      <g-case is="a"><g-map src="items"><g-map src="e.sub">{{e2}}</g-map></g-map></g-case>`,
        `      <g-default>none</g-default>`,
        `    </g-switch>`,
        `  </g-message>`,
        `</g-base>`
      ].join(`\n`)
      const result = TemplateEngine.validateTemplate(template)
      expect(result.valid).toBe(true)
    })

    it(`should compile nested g-map in keyboard pipeline`, () => {
      const template = [
        `<g-base>`,
        `  <g-keyboard>`,
        `    <g-map src="rows">{{e.name}}</g-map>`,
        `  </g-keyboard>`,
        `</g-base>`
      ].join(`\n`)
      const compiled = TemplateEngine.compileBlockGKeyboards(template)
      const fn = compiled.default!.default!.inline!
      const result = fn({rows: [{name: `Alice`}, {name: `Bob`}]})
      expect(result).toEqual([`Alice\nBob`])
    })

    it(`should handle g-map with join attribute inside keyboard`, () => {
      const template = [
        `<g-base>`,
        `  <g-keyboard>`,
        `    Fixed, <g-map src="items" join=", ">{{e}}</g-map>, Done`,
        `  </g-keyboard>`,
        `</g-base>`
      ].join(`\n`)
      const compiled = TemplateEngine.compileBlockGKeyboards(template)
      const fn = compiled.default!.default!.inline!
      const result = fn({items: [`A`, `B`, `C`]})
      expect(result).toEqual([`Fixed`, `A, B, C`, `Done`])
    })

    it(`should handle g-div inside nested g-map`, () => {
      const template = [
        `<g-map src="outer" join="\\n">`,
        `  <g-div>{{e.name}}</g-div>`,
        `  <g-map src="e.inner" join=", "><g-div>{{e2}}</g-div></g-map>`,
        `</g-map>`
      ].join(`\n`)
      let processed = TemplateEngine._processGMapBlocks(template)
      processed = TemplateEngine._processGDivBlocks(processed)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        outer: [
          {name: `X`, inner: [`a`, `b`]},
          {name: `Y`, inner: [`c`]}
        ]
      }
      expect(fn(data).trim()).toBe(`X\na, b\nY\nc`)
    })
  })

  describe(`Integration in compileMessages`, () => {
    it(`should compile <g-message> with <g-map> and exec`, () => {
      const template = `
        <g-base id="list">
          <g-message>
            <g-map src="users" join=", ">{~ i + 1 ~}. {{e.name}}</g-map>
          </g-message>
        </g-base>
      `
      const compiled = TemplateEngine.compileBlockGMessage(template)
      const fn = compiled.list!.default

      const data = {users: [{name: `X`}, {name: `Y`}]}
      expect(fn!(data).trim()).toBe(`1. X, 2. Y`)
    })
  })

  describe(`validateBlockMediaGroup`, () => {
    it(`should allow <g-media-group> blocks directly inside <g-base>`, () => {
      const template = `
        <g-base>
          <g-media-group>
            <g-media type="photo" src="a.jpg">Caption</g-media>
            <g-media type="video" src="b.mp4"></g-media>
          </g-media-group>
        </g-base>
      `

      expect(TemplateEngine.validateTemplate(template).valid).toBe(true)
    })

    it(`should reject unknown <g-media-group> attributes`, () => {
      const template = `<g-base><g-media-group id="bad"><g-media type="photo" src="a.jpg"></g-media></g-media-group></g-base>`
      const result = TemplateEngine.validateTemplate(template)

      expect(result.valid).toBe(false)
      expect(result.errors.some((error) => error.message.includes(`Unknown attribute "id" on <g-media-group>`))).toBe(true)
    })

    it(`should reject unsupported <g-media> types inside <g-media-group>`, () => {
      const template = `<g-base><g-media-group><g-media type="animation" src="a.gif"></g-media></g-media-group></g-base>`
      const result = TemplateEngine.validateTemplate(template)

      expect(result.valid).toBe(false)
      expect(result.errors.some((error) => error.message.includes(`Attribute "type" on <g-media> inside <g-media-group>`))).toBe(true)
    })
  })
  describe(`_extractBlock`, () => {
    it(`should extract default <g-base> content`, () => {
      const content = `<g-base>Content</g-base>`
      expect(TemplateEngine._extractBlock(content)).toBe(`Content`)
    })

    it(`should extract named <g-base> content`, () => {
      const content = `<g-base id="other">Other</g-base><g-base id="main">Main</g-base>`
      expect(TemplateEngine._extractBlock(content, undefined, `main`)).toBe(`Main`)
    })

    it(`should return empty if <g-base> not found`, () => {
      const content = `<g-base id="other">Other</g-base>`
      expect(TemplateEngine._extractBlock(content, undefined, `main`)).toBe(``)
    })

    it(`should extract specific block`, () => {
      const content = `<g-base><g-message>Msg</g-message><g-media>Med</g-media></g-base>`
      expect(TemplateEngine._extractBlock(content, `g-message`)).toBe(`<g-message>Msg</g-message>`)
    })

    it(`should return inner content if section is value`, () => {
      const content = `<g-base><g-message>Msg</g-message></g-base>`
      expect(TemplateEngine._extractBlock(content, `g-message`, `default`, `value`)).toBe(`Msg`)
    })

    // New tests for multi-block support
    it(`should extract all blocks when blocks="all"`, () => {
      const content = `<g-base><g-message>Msg</g-message><g-keyboard>Btn</g-keyboard></g-base>`
      const result = TemplateEngine._extractBlock(content, `all`)
      expect(result).toContain(`<g-message>Msg</g-message>`)
      expect(result).toContain(`<g-keyboard>Btn</g-keyboard>`)
    })

    it(`should extract multiple specific blocks with array`, () => {
      const content = `<g-base><g-message>Msg</g-message><g-keyboard>Btn</g-keyboard><g-media>Med</g-media></g-base>`
      const result = TemplateEngine._extractBlock(content, [`g-message`, `g-keyboard`])
      expect(result).toContain(`<g-message>Msg</g-message>`)
      expect(result).toContain(`<g-keyboard>Btn</g-keyboard>`)
      expect(result).not.toContain(`<g-media>Med</g-media>`)
    })

    it(`should handle multi-block with section="value"`, () => {
      const content = `<g-base><g-message>Msg</g-message><g-keyboard>Btn</g-keyboard></g-base>`
      const result = TemplateEngine._extractBlock(content, [`g-message`, `g-keyboard`], `default`, `value`)
      expect(result).toContain(`Msg`)
      expect(result).toContain(`Btn`)
    })

    it(`should filter blocks by lang if specified`, () => {
      const content = `<g-base><g-message lang="en">En</g-message><g-message lang="id">Id</g-message></g-base>`
      const result = TemplateEngine._extractBlock(content, `g-message`, `default`, `value`, `en`)
      expect(result).toBe(`En`)
      const resultId = TemplateEngine._extractBlock(content, `g-message`, `default`, `value`, `id`)
      expect(resultId).toBe(`Id`)
    })
  })

  describe(`_parseImportBlocks`, () => {
    it(`should extract import info and return placeholders`, () => {
      const template = `Start <g-import src="file" /> End`
      const result = TemplateEngine._processGImportBlocks(template)
      expect(result.processed).toBe(`Start __IMPORT_0__ End`)
      expect(result.imports.length).toBe(1)
      expect(result.imports[0]?.src).toBe(`file`)
    })

    it(`should parse all attributes correctly`, () => {
      const template = `<g-import src="file" block="g-message" base="main" section="value" />`
      const result = TemplateEngine._processGImportBlocks(template)
      expect(result.imports[0]).toEqual({
        src: `file`,
        blocks: `g-message`,
        base: `main`,
        section: `value`,
        indent: ``
      })
    })

    it(`should handle multiple imports`, () => {
      const template = `<g-import src="A" /><g-import src="B" />`
      const result = TemplateEngine._processGImportBlocks(template)
      expect(result.processed).toBe(`__IMPORT_0____IMPORT_1__`)
      expect(result.imports.length).toBe(2)
      expect(result.imports[0]?.src).toBe(`A`)
      expect(result.imports[1]?.src).toBe(`B`)
    })

    it(`should parse lang attribute correctly`, () => {
      const template = `<g-import src="file" lang="en" />`
      const result = TemplateEngine._processGImportBlocks(template)
      expect(result.imports[0]?.lang).toBe(`en`)
    })

    // New tests for multi-block parsing
    it(`should parse block="all" as string "all"`, () => {
      const template = `<g-import src="file" block="all" />`
      const result = TemplateEngine._processGImportBlocks(template)
      expect(result.imports[0]?.blocks).toBe(`all`)
    })

    it(`should parse comma-separated blocks without spaces`, () => {
      const template = `<g-import src="file" block="keyboard,message" />`
      const result = TemplateEngine._processGImportBlocks(template)
      expect(result.imports[0]?.blocks).toEqual([`g-keyboard`, `g-message`])
    })

    it(`should parse comma-separated blocks with spaces`, () => {
      const template = `<g-import src="file" block="keyboard, message" />`
      const result = TemplateEngine._processGImportBlocks(template)
      expect(result.imports[0]?.blocks).toEqual([`g-keyboard`, `g-message`])
    })

    it(`should parse comma-separated blocks with mixed spaces`, () => {
      const template = `<g-import src="file" block="keyboard,  message, media" />`
      const result = TemplateEngine._processGImportBlocks(template)
      expect(result.imports[0]?.blocks).toEqual([`g-keyboard`, `g-message`, `g-media`])
    })
  })

  describe(`processImports`, () => {
    it(`should resolve <g-imports> using file resolver callback`, () => {
      const template = `Start <g-import src="header" /> End`
      const fileResolver = (src: string) => (src === `header` ? `<g-message>Hello</g-message>` : null)
      const result = TemplateEngine.processGImportBlocks(template, fileResolver)
      expect(result).toBe(`Start <g-message>Hello</g-message> End`)
    })

    it(`should resolve <g-imports> with block="all"`, () => {
      const template = `<g-import src="shared" block="all" />`
      const fileResolver = (src: string) => (src === `shared` ? `<g-base><g-message>Msg</g-message><g-keyboard>Btn</g-keyboard></g-base>` : null)
      const result = TemplateEngine.processGImportBlocks(template, fileResolver)
      expect(result).toContain(`<g-message>Msg</g-message>`)
      expect(result).toContain(`<g-keyboard>Btn</g-keyboard>`)
    })

    it(`should resolve <g-imports> with multi-block`, () => {
      const template = `<g-import src="shared" block="keyboard,message" />`
      const fileResolver = (src: string) => (src === `shared` ? `<g-base><g-message>Msg</g-message><g-keyboard>Btn</g-keyboard><g-media>Med</g-media></g-base>` : null)
      const result = TemplateEngine.processGImportBlocks(template, fileResolver)
      expect(result).toContain(`<g-message>Msg</g-message>`)
      expect(result).toContain(`<g-keyboard>Btn</g-keyboard>`)
      expect(result).not.toContain(`<g-media>Med</g-media>`)
    })

    it(`should resolve <g-imports> recursively`, () => {
      const template = `<g-import src="A" />`
      const fileResolver = (src: string) => {
        if (src === `A`) return `<g-import src="B" />`
        if (src === `B`) return `Resolved B`
        return null
      }
      const result = TemplateEngine.processGImportBlocks(template, fileResolver)
      expect(result.trim()).toBe(`Resolved B`)
    })

    it(`should prevent infinite recursion`, () => {
      const template = `<g-import src="loop" />`
      const fileResolver = (src: string) => (src === `loop` ? `<g-import src="loop" />` : null)
      const result = TemplateEngine.processGImportBlocks(template, fileResolver)
      expect(result.trim()).toBe(``)
    })

    it(`should filter <g-imports> by lang`, () => {
      const template = `<g-import src="shared" block="g-message" lang="id" section="value" />`
      const fileResolver = (src: string) => (src === `shared` ? `<g-base><g-message lang="en">En</g-message><g-message lang="id">Id</g-message></g-base>` : null)
      const result = TemplateEngine.processGImportBlocks(template, fileResolver)
      expect(result).toBe(`Id`)
    })
  })

  describe(`validateBlockPositions`, () => {
    it(`should return valid for empty template`, () => {
      const result = TemplateEngine.validatePositionsBlock(``)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for plain text without <g-base> block`, () => {
      const result = TemplateEngine.validatePositionsBlock(`Just some text`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]!.message).toContain(`Missing <g-base> block`)
    })

    it(`should return valid for a well-formed template`, () => {
      const template = `
        <g-base>
          <g-message>Hello {{name}}!</g-message>
          <g-keyboard>Yes, No</g-keyboard>
        </g-base>
      `
      const result = TemplateEngine.validatePositionsBlock(template)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for multiple <g-base> blocks`, () => {
      const template = `
        <g-base id="main">
          <g-message>Hello</g-message>
        </g-base>
        <g-base id="error">
          <g-message>Error</g-message>
        </g-base>
      `
      const result = TemplateEngine.validatePositionsBlock(template)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <g-switch> with <g-case> and <g-default> inside <g-message>`, () => {
      const template = `
        <g-base>
          <g-message>
            <g-switch value="status">
              <g-case is="active">Active</g-case>
              <g-default>Unknown</g-default>
            </g-switch>
          </g-message>
        </g-base>
      `
      const result = TemplateEngine.validatePositionsBlock(template)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <g-map> and <g-div> blocks inside <g-message>`, () => {
      const template = `
        <g-base>
          <g-message>
            <g-map src="items">
              <g-div>{{e.name}}</g-div>
            </g-map>
          </g-message>
        </g-base>
      `
      const result = TemplateEngine.validatePositionsBlock(template)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <g-map> inside <g-case>`, () => {
      const template = `
        <g-base>
          <g-message>
            <g-switch value="status">
              <g-case is="active"><g-map src="items">{{e}}</g-map></g-case>
            </g-switch>
          </g-message>
        </g-base>
      `
      const result = TemplateEngine.validatePositionsBlock(template)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <g-map> inside <g-default>`, () => {
      const template = `
        <g-base>
          <g-message>
            <g-switch value="status">
              <g-default><g-map src="items">{{e}}</g-map></g-default>
            </g-switch>
          </g-message>
        </g-base>
      `
      const result = TemplateEngine.validatePositionsBlock(template)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should inherit allowed parents: <g-div> inside <g-case>`, () => {
      const result = TemplateEngine.validatePositionsBlock(`
        <g-base>
          <g-message>
            <g-switch value="x">
              <g-case is="test"><g-div>content</g-div></g-case>
            </g-switch>
          </g-message>
        </g-base>
      `)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should NOT inherit across levels: <g-base> inside <g-case>`, () => {
      const result = TemplateEngine.validatePositionsBlock(`
        <g-base>
          <g-message>
            <g-switch value="x">
              <g-case is="test"><g-base>nested</g-base></g-case>
            </g-switch>
          </g-message>
        </g-base>
      `)
      expect(result.valid).toBe(false)
    })

    it(`should return valid for <g-import> and <g-space> blocks`, () => {
      const template = `
        <g-base>
          <g-import src="header" block="g-message" />
          <g-message>Content</g-message>
          <g-space />
        </g-base>
      `
      const result = TemplateEngine.validatePositionsBlock(template)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should ignore passthrough Telegram HTML tags`, () => {
      const template = `
        <g-base>
          <g-message><b>Bold</b> and <i>italic</i></g-message>
        </g-base>
      `
      const result = TemplateEngine.validatePositionsBlock(template)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should detect base nested inside <g-message>`, () => {
      const result = TemplateEngine.validatePositionsBlock(`
        <g-base>
          <g-message>
            <g-base>Nested base</g-base>
          </g-message>
        </g-base>
      `)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0]?.message).toContain(`g-base`)
      expect(result.errors[0]?.message).toContain(`g-message`)
    })

    it(`should detect message inside <g-message>`, () => {
      const result = TemplateEngine.validatePositionsBlock(`
        <g-base>
          <g-message>
            <g-message>Nested message</g-message>
          </g-message>
        </g-base>
      `)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0]?.message).toContain(`g-message`)
    })

    it(`should detect <g-case> outside <g-switch>`, () => {
      const result = TemplateEngine.validatePositionsBlock(`
        <g-base>
          <g-case is="test">Outside</g-case>
        </g-base>
      `)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0]?.message).toContain(`g-case`)
    })

    it(`should detect mismatched closing tags`, () => {
      const result = TemplateEngine.validatePositionsBlock(`
        <g-base>
          <g-message>Hello</g-message>
          </g-keyboard>
        </g-base>
      `)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0]?.message).toContain(`Mismatched`)
    })

    it(`should detect unexpected closing tag`, () => {
      const result = TemplateEngine.validatePositionsBlock(`
        <g-base>
          <g-message>Hello</g-message>
        </g-base>
        </g-message>
      `)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0]?.message).toContain(`Unexpected closing`)
    })

    it(`should detect unclosed block`, () => {
      const result = TemplateEngine.validatePositionsBlock(`
        <g-base>
          <g-message>Unclosed
        </g-base>
      `)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors.some((e) => e.message.includes(`Unclosed`) && e.message.includes(`g-message`))).toBe(true)
    })

    it(`should return correct line numbers for errors`, () => {
      const result = TemplateEngine.validatePositionsBlock(`<g-base>\n  <g-message>\n    <g-base>Inner</g-base>\n  </g-message>\n</g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0]?.line).toBe(3)
    })
  })

  describe(`validateBaseAttributes`, () => {
    it(`should return valid for <g-base> with no attributes`, () => {
      const result = TemplateEngine.validateBlockGBaseAttributes(`<g-base></g-base>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <g-base> with valid id attribute`, () => {
      const result = TemplateEngine.validateBlockGBaseAttributes(`<g-base id="main"></g-base>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <g-base> with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockGBaseAttributes(`<g-base lang="en"></g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`lang`)
    })

    it(`should return invalid for <g-base> with empty id`, () => {
      const result = TemplateEngine.validateBlockGBaseAttributes(`<g-base id=""></g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
      expect(result.errors[0]?.message).toContain(`empty`)
    })

    it(`should report all invalid attributes on a single <g-base>`, () => {
      const result = TemplateEngine.validateBlockGBaseAttributes(`<g-base id="x" class="y" data-x="z"></g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(2)
      expect(result.errors[0]?.message).toContain(`class`)
      expect(result.errors[1]?.message).toContain(`data-x`)
    })

    it(`should report unknown attribute on the correct line`, () => {
      const result = TemplateEngine.validateBlockGBaseAttributes(`<g-base></g-base>\n<g-base lang="en"></g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.line).toBe(2)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<g-base lang="en"><g-message>Hi</g-message></g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`lang`))).toBe(true)
    })
  })

  describe(`validateMessageAttributes`, () => {
    it(`should return valid for <g-message> with no attributes`, () => {
      const result = TemplateEngine.validateBlockGMessageAttributes(`<g-message>Hello</g-message>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <g-message> with valid lang attribute`, () => {
      const result = TemplateEngine.validateBlockGMessageAttributes(`<g-message lang="en">Hello</g-message>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <g-message> with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockGMessageAttributes(`<g-message id="1">Hello</g-message>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })

    it(`should report unknown attribute on the correct line`, () => {
      const result = TemplateEngine.validateBlockGMessageAttributes(`<g-message>Ok</g-message>\n<g-message class="x">Bad</g-message>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.line).toBe(2)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<g-base><g-message id="x">Hi</g-message></g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateKeyboardAttributes`, () => {
    it(`should return valid for <g-keyboard> with no attributes`, () => {
      const result = TemplateEngine.validateBlockGKeyboardAttributes(`<g-keyboard>A, B</g-keyboard>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <g-keyboard> with type inline`, () => {
      const result = TemplateEngine.validateBlockGKeyboardAttributes(`<g-keyboard type="inline">A, B</g-keyboard>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <g-keyboard> with type bottom`, () => {
      const result = TemplateEngine.validateBlockGKeyboardAttributes(`<g-keyboard type="bottom">A, B</g-keyboard>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <g-keyboard> with valid lang and type`, () => {
      const result = TemplateEngine.validateBlockGKeyboardAttributes(`<g-keyboard lang="id" type="bottom">Ya, Tidak</g-keyboard>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <g-keyboard> with invalid type value`, () => {
      const result = TemplateEngine.validateBlockGKeyboardAttributes(`<g-keyboard type="top">A, B</g-keyboard>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`must be "inline" or "bottom"`)
    })

    it(`should return invalid for <g-keyboard> with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockGKeyboardAttributes(`<g-keyboard id="x">A, B</g-keyboard>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<g-base><g-keyboard id="x">A</g-keyboard></g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateMediaAttributes`, () => {
    it(`should return valid for <g-media> with all valid attributes`, () => {
      const result = TemplateEngine.validateBlockGMediaAttributes(`<g-media type="photo" src="img.jpg" lang="en">Caption</g-media>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <g-media> with location attributes`, () => {
      const result = TemplateEngine.validateBlockGMediaAttributes(`<g-media type="location" latitude="-6.2" longitude="106.8">Loc</g-media>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <g-media> with contact attributes`, () => {
      const result = TemplateEngine.validateBlockGMediaAttributes(`<g-media type="contact" phone="123" first_name="John" last_name="Doe" vcard="BEGIN:VCARD">Contact</g-media>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <g-media> with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockGMediaAttributes(`<g-media type="photo" id="x">Cap</g-media>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })

    it(`should return invalid for <g-media> with invalid type value`, () => {
      const result = TemplateEngine.validateBlockGMediaAttributes(`<g-media type="gif">Cap</g-media>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`must be one of`)
      expect(result.errors[0]?.message).toContain(`gif`)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<g-base><g-media type="photo" id="x">Cap</g-media></g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateDescriptionAttributes`, () => {
    it(`should return valid for <g-description> with no attributes`, () => {
      const result = TemplateEngine.validateBlockGDescriptionAttributes(`<g-description>Start</g-description>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <g-description> with lang and scope`, () => {
      const result = TemplateEngine.validateBlockGDescriptionAttributes(`<g-description lang="id" scope="chat_administrators">Mulai</g-description>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <g-description> with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockGDescriptionAttributes(`<g-description id="x">Start</g-description>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<g-base><g-description id="x">Start</g-description></g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateScriptAttributes`, () => {
    it(`should return valid for <g-script> with no attributes`, () => {
      const result = TemplateEngine.validateBlockGScriptAttributes(`<g-script>return x;</g-script>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <g-script> with any attribute`, () => {
      const result = TemplateEngine.validateBlockGScriptAttributes(`<g-script lang="en">return x;</g-script>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`lang`)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<g-base><g-script id="x">return 1;</g-script></g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateSwitchAttributes`, () => {
    it(`should return valid for <g-switch> with value attribute`, () => {
      const result = TemplateEngine.validateBlockGSwitchAttributes(`<g-switch value="status"><g-case is="a">A</g-case></g-switch>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <g-switch> with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockGSwitchAttributes(`<g-switch value="status" id="x"><g-case is="a">A</g-case></g-switch>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<g-base><g-message><g-switch id="x"><g-case is="a">A</g-case></g-switch></g-message></g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateCaseAttributes`, () => {
    it(`should return valid for <g-case> with is attribute`, () => {
      const result = TemplateEngine.validateBlockGCaseAttributes(`<g-case is="active">Active</g-case>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <g-case> with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockGCaseAttributes(`<g-case is="a" id="x">A</g-case>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })
  })

  describe(`validateDefaultAttributes`, () => {
    it(`should return valid for <g-default> with no attributes`, () => {
      const result = TemplateEngine.validateBlockGDefaultAttributes(`<g-default>Unknown</g-default>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <g-default> with any attribute`, () => {
      const result = TemplateEngine.validateBlockGDefaultAttributes(`<g-default id="x">Unknown</g-default>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })
  })

  describe(`validateMapAttributes`, () => {
    it(`should return valid for <g-map> with src and join`, () => {
      const result = TemplateEngine.validateBlockGMapAttributes(`<g-map src="items" join=", ">{{e}}</g-map>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <g-map> with src only`, () => {
      const result = TemplateEngine.validateBlockGMapAttributes(`<g-map src="items">{{e}}</g-map>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <g-map> with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockGMapAttributes(`<g-map src="items" id="x">{{e}}</g-map>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<g-base><g-message><g-map src="x" id="y">{{e}}</g-map></g-message></g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateDivAttributes`, () => {
    it(`should return valid for <g-div> with no attributes`, () => {
      const result = TemplateEngine.validateBlockGDivAttributes(`<g-div>content</g-div>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <g-div> with any attribute`, () => {
      const result = TemplateEngine.validateBlockGDivAttributes(`<g-div class="x">content</g-div>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`class`)
    })
  })

  describe(`validateImportAttributes`, () => {
    it(`should return valid for <g-import/> with src only`, () => {
      const result = TemplateEngine.validateBlockGImportAttributes(`<g-import src="other" />`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <g-import/> with all valid attributes`, () => {
      const result = TemplateEngine.validateBlockGImportAttributes(`<g-import src="other" block="g-message" base="main" lang="en" section="value" />`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <g-import/> with unknown attribute`, () => {
      const result = TemplateEngine.validateBlockGImportAttributes(`<g-import src="other" id="x" />`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<g-base><g-import src="x" id="y" /></g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`id`))).toBe(true)
    })
  })

  describe(`validateSpaceAttributes`, () => {
    it(`should return valid for <g-space/> with no attributes`, () => {
      const result = TemplateEngine.validateBlockGSpaceAttributes(`<g-space />`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <g-space/> with any attribute`, () => {
      const result = TemplateEngine.validateBlockGSpaceAttributes(`<g-space id="x" />`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toContain(`id`)
    })
  })

  describe(`validateTelegramAttributes`, () => {
    it(`should return valid for empty template`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(``)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for plain text without any tags`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`Just some text`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <a> with href (link)`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<a href="https://t.me/">link</a>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <a> with name (anchor)`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<a name="chapter-1"></a>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <a> with both href and name`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<a href="x" name="y">x</a>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <a> with neither href nor name`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<a>broken</a>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toBe(`<a> must have one of: href | name`)
    })

    it(`should return valid for <img/> with src`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<img src="https://telegram.org/x.jpg"/>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <img/> without src`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<img/>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toBe(`<img/> is missing required attribute(s): src`)
    })

    it(`should return valid for <video> with src`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<video src="https://x/v.mp4"></video>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <video> without src`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<video></video>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`src`)
    })

    it(`should return valid for <audio> with src`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<audio src="https://x/a.mp3"></audio>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <audio> without src`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<audio></audio>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`src`)
    })

    it(`should return valid for <tg-emoji> with emoji-id`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<tg-emoji emoji-id="5368324170671202286">👍</tg-emoji>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <tg-emoji> without emoji-id`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<tg-emoji>👍</tg-emoji>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toBe(`<tg-emoji> is missing required attribute(s): emoji-id`)
    })

    it(`should return valid for <tg-time> with unix and format`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<tg-time unix="1647531900" format="wDT">22:45</tg-time>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for <tg-time> with only unix (format is optional per Bot API 10.3)`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<tg-time unix="1647531900">x</tg-time>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <tg-time> with only format`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<tg-time format="wDT">x</tg-time>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toBe(`<tg-time> is missing required attribute(s): unix`)
    })

    it(`should return valid for <tg-map> with all three required attrs`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<tg-map lat="41.9" long="12.5" zoom="14"/>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <tg-map/> missing one required attr`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<tg-map lat="41.9" long="12.5"/>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toBe(`<tg-map/> is missing required attribute(s): zoom`)
    })

    it(`should return valid for <tg-reference> with name`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<tg-reference name="note-1">x</tg-reference>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <tg-reference> without name`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<tg-reference>x</tg-reference>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toBe(`<tg-reference> is missing required attribute(s): name`)
    })

    it(`should return valid for <input type="checkbox" checked/> (boolean attr)`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<input type="checkbox" checked>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return invalid for <input/> without type`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<input/>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toBe(`<input/> is missing required attribute(s): type`)
    })

    it(`should not flag tags without required attrs (<b>, <p>, <hr/>, <table>)`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<b>bold</b> <p>para</p> <hr/> <table></table>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should not flag <g-base>, <g-message>, etc. (different validator)`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<g-base><g-message>Hi</g-message></g-base>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should report correct line number for multiline template`, () => {
      const template = `<g-base>
  <g-message>
    <a>broken</a>
  </g-message>
</g-base>`
      const result = TemplateEngine.validateTelegramAttributesBlock(template)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.line).toBe(3)
    })

    it(`should report multiple errors for multiple bad tags`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<a>x</a><img/><video></video>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(3)
    })

    it(`should accept single-quoted attribute values`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<a href='https://t.me/'>x</a>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should accept unquoted attribute values`, () => {
      const result = TemplateEngine.validateTelegramAttributesBlock(`<a href=https://t.me/>x</a>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should be included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<g-base><g-message><a>broken</a></g-message></g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes(`<a> must have one of:`))).toBe(true)
    })
  })

  describe(`validateFormatBlock with Rich HTML void tags`, () => {
    it(`<hr/> is valid (self-closing)`, () => {
      const result = TemplateEngine.validateFormatBlock(`<hr/>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`<hr> is invalid (not self-closing)`, () => {
      const result = TemplateEngine.validateFormatBlock(`<hr>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.message).toBe(`Block <hr> must be self-closing: use <hr /> instead`)
    })

    it(`<hr></hr> is invalid (open+close, void must be self-closing)`, () => {
      const result = TemplateEngine.validateFormatBlock(`<hr></hr>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`must be self-closing`)
    })

    it(`<img src="x.jpg"/> is valid`, () => {
      const result = TemplateEngine.validateFormatBlock(`<img src="x.jpg"/>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`<img src="x.jpg"> is invalid (not self-closing)`, () => {
      const result = TemplateEngine.validateFormatBlock(`<img src="x.jpg">`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toBe(`Block <img> must be self-closing: use <img /> instead`)
    })

    it(`<input type="checkbox"/> is valid (self-closing)`, () => {
      const result = TemplateEngine.validateFormatBlock(`<input type="checkbox"/>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`<input type="checkbox"> is invalid (not self-closing)`, () => {
      const result = TemplateEngine.validateFormatBlock(`<input type="checkbox">`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`must be self-closing`)
    })

    it(`<br/> is valid`, () => {
      const result = TemplateEngine.validateFormatBlock(`<br/>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`<br> is invalid (not self-closing)`, () => {
      const result = TemplateEngine.validateFormatBlock(`<br>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toBe(`Block <br> must be self-closing: use <br /> instead`)
    })

    it(`<tg-map lat="1" long="2" zoom="3"/> is valid`, () => {
      const result = TemplateEngine.validateFormatBlock(`<tg-map lat="1" long="2" zoom="3"/>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`<tg-map lat="1" long="2" zoom="3"></tg-map> is invalid (not self-closing)`, () => {
      const result = TemplateEngine.validateFormatBlock(`<tg-map lat="1" long="2" zoom="3"></tg-map>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`must be self-closing`)
    })

    it(`content tags (<b>, <p>, <table>) are not format-checked — both forms accepted`, () => {
      const result1 = TemplateEngine.validateFormatBlock(`<b>bold</b>`)
      const result2 = TemplateEngine.validateFormatBlock(`<b/>`)
      const result3 = TemplateEngine.validateFormatBlock(`<p>para</p>`)
      const result4 = TemplateEngine.validateFormatBlock(`<p/>`)
      const result5 = TemplateEngine.validateFormatBlock(`<table></table>`)
      const result6 = TemplateEngine.validateFormatBlock(`<table/>`)
      expect(result1.valid).toBe(true)
      expect(result2.valid).toBe(true)
      expect(result3.valid).toBe(true)
      expect(result4.valid).toBe(true)
      expect(result5.valid).toBe(true)
      expect(result6.valid).toBe(true)
    })

    it(`multiple void tag errors are all reported`, () => {
      const result = TemplateEngine.validateFormatBlock(`<hr><img src="x"><br><input type="checkbox">`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(4)
    })
  })

  describe(`validateNamesBlock recognizes all Rich HTML tags`, () => {
    for (const tagLiteral of TemplateEngine.ALLOWED_BLOCKS_TELEGRAM) {
      it(`should recognize ${tagLiteral}`, () => {
        const template = `<g-base><g-message>${tagLiteral}</g-message></g-base>`
        const result = TemplateEngine.validateNamesBlock(template)
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })
    }
  })

  describe(`validateTelegramAttributeValues`, () => {
    it(`should return valid for empty template`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(``)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for plain text`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`just text`)
      expect(result.valid).toBe(true)
    })

    it(`<tg-time unix> accepts valid positive integer`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-time unix="1647531900" format="wDT">x</tg-time>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`<tg-time unix> rejects non-numeric value`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-time unix="abc" format="wDT">x</tg-time>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`unix must be a positive integer`)
    })

    it(`<tg-time unix> rejects negative value`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-time unix="-1" format="wDT">x</tg-time>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`unix must be a positive integer`)
    })

    it(`<tg-time format> rejects empty value`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-time unix="1" format="">x</tg-time>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`format must match r, or an optional weekday/date/time combo like wDT`)
    })

    it(`<tg-time format> accepts valid r|w?[dD]?[tT]? formats`, () => {
      for (const f of [`r`, `w`, `d`, `D`, `t`, `T`, `wD`, `wdt`, `wDT`]) {
        expect(TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-time unix="1" format="${f}">x</tg-time>`).valid).toBe(true)
      }
    })

    it(`<tg-time format> rejects unknown format token`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-time unix="1" format="X">x</tg-time>`)
      expect(result.valid).toBe(false)
    })

    it(`<tg-map lat> accepts valid number in range`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-map lat="41.9" long="12.5" zoom="14"/>`)
      expect(result.valid).toBe(true)
    })

    it(`<tg-map lat> rejects out-of-range value (>90)`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-map lat="91" long="12.5" zoom="14"/>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`lat must be a number between -90 and 90`)
    })

    it(`<tg-map lat> rejects non-numeric value`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-map lat="x" long="12.5" zoom="14"/>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`lat must be a number between -90 and 90`)
    })

    it(`<tg-map long> accepts boundary values -180 and 180`, () => {
      const result1 = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-map lat="0" long="-180" zoom="14"/>`)
      const result2 = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-map lat="0" long="180" zoom="14"/>`)
      expect(result1.valid).toBe(true)
      expect(result2.valid).toBe(true)
    })

    it(`<tg-map long> rejects out-of-range value`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-map lat="0" long="181" zoom="14"/>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`long must be a number between -180 and 180`)
    })

    it(`<tg-map zoom> accepts 13 and 20`, () => {
      const result1 = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-map lat="0" long="0" zoom="13"/>`)
      const result2 = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-map lat="0" long="0" zoom="20"/>`)
      expect(result1.valid).toBe(true)
      expect(result2.valid).toBe(true)
    })

    it(`<tg-map zoom> rejects values outside 13..20`, () => {
      for (const z of [`0`, `12`, `21`, `24`, `25`]) {
        expect(TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-map lat="0" long="0" zoom="${z}"/>`).valid).toBe(false)
      }
    })

    it(`<tg-map zoom> rejects non-integer value`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-map lat="0" long="0" zoom="1.5"/>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`zoom must be an integer between 13 and 20`)
    })

    it(`<tg-emoji emoji-id> accepts valid numeric string`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-emoji emoji-id="5368324170671202286">👍</tg-emoji>`)
      expect(result.valid).toBe(true)
    })

    it(`<tg-emoji emoji-id> rejects non-numeric value`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-emoji emoji-id="abc">👍</tg-emoji>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`emoji-id must be a numeric string`)
    })

    it(`<a href> accepts http, https, mailto, tel, tg schemes`, () => {
      const cases = [`<a href="https://t.me/">x</a>`, `<a href="http://example.com">x</a>`, `<a href="mailto:user@example.com">x</a>`, `<a href="tel:+123456789">x</a>`, `<a href="tg://user?id=123">x</a>`, `<a href="#chapter-1">x</a>`]
      for (const c of cases) {
        expect(TemplateEngine.validateTelegramAttributeValuesBlock(c).valid).toBe(true)
      }
    })

    it(`<a href> rejects javascript: and unknown schemes`, () => {
      const result1 = TemplateEngine.validateTelegramAttributeValuesBlock(`<a href="javascript:alert(1)">x</a>`)
      const result2 = TemplateEngine.validateTelegramAttributeValuesBlock(`<a href="data:text/html,x">x</a>`)
      const result3 = TemplateEngine.validateTelegramAttributeValuesBlock(`<a href="relative/path">x</a>`)
      expect(result1.valid).toBe(false)
      expect(result2.valid).toBe(false)
      expect(result3.valid).toBe(false)
    })

    it(`<a name> must not be empty`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<a name="">x</a>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`name must not be empty`)
    })

    it(`<img src> requires an http(s) URL`, () => {
      const ok1 = TemplateEngine.validateTelegramAttributeValuesBlock(`<img src="https://example.com/a.jpg"/>`)
      const ok2 = TemplateEngine.validateTelegramAttributeValuesBlock(`<img src="http://example.com/a.jpg"/>`)
      const bad1 = TemplateEngine.validateTelegramAttributeValuesBlock(`<img src="ftp://example.com/a.jpg"/>`)
      const bad2 = TemplateEngine.validateTelegramAttributeValuesBlock(`<img src="relative/a.jpg"/>`)
      expect(ok1.valid).toBe(true)
      expect(ok2.valid).toBe(true)
      expect(bad1.valid).toBe(false)
      expect(bad2.valid).toBe(false)
    })

    it(`<video> and <audio> src require an http(s) URL`, () => {
      const okV = TemplateEngine.validateTelegramAttributeValuesBlock(`<video src="https://example.com/a.mp4">x</video>`)
      const okA = TemplateEngine.validateTelegramAttributeValuesBlock(`<audio src="https://example.com/a.mp3">x</audio>`)
      const badV = TemplateEngine.validateTelegramAttributeValuesBlock(`<video src="file:///a.mp4">x</video>`)
      expect(okV.valid).toBe(true)
      expect(okA.valid).toBe(true)
      expect(badV.valid).toBe(false)
    })

    it(`<input type> accepts only checkbox (per Bot API 10.3 rich spec)`, () => {
      const ok = TemplateEngine.validateTelegramAttributeValuesBlock(`<input type="checkbox"/>`)
      expect(ok.valid).toBe(true)
      for (const t of [`text`, `number`, `email`, `password`, `submit`, `radio`, `hidden`, `tel`, `url`]) {
        expect(TemplateEngine.validateTelegramAttributeValuesBlock(`<input type="${t}"/>`).valid).toBe(false)
      }
    })

    it(`<input type> rejects unknown input type`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<input type="foobar"/>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`type must be "checkbox"`)
    })

    it(`boolean attributes are skipped (not validated as values)`, () => {
      // <input type="checkbox" checked> — checked is boolean, no value
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<input type="checkbox" checked>`)
      expect(result.valid).toBe(true)
    })

    it(`{{placeholder}} attribute values skip value validation`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-emoji emoji-id="{{thumbsEmojiId}}">👍</tg-emoji>`)
      expect(result.valid).toBe(true)
    })

    it(`<ol start/type/reversed> validates`, () => {
      const ok = TemplateEngine.validateTelegramAttributeValuesBlock(`<ol start="3" type="A" reversed><li>a</li></ol>`)
      expect(ok.valid).toBe(true)
      const badStart = TemplateEngine.validateTelegramAttributeValuesBlock(`<ol start="x">x</ol>`)
      const badType = TemplateEngine.validateTelegramAttributeValuesBlock(`<ol type="Z">x</ol>`)
      expect(badStart.valid).toBe(false)
      expect(badType.valid).toBe(false)
    })

    it(`<li value/type/checkbox> validates`, () => {
      const ok = TemplateEngine.validateTelegramAttributeValuesBlock(`<ul><li type="checkbox" checked>a</li></ul>`)
      expect(ok.valid).toBe(true)
      const badValue = TemplateEngine.validateTelegramAttributeValuesBlock(`<ul><li value="x">a</li></ul>`)
      const badType = TemplateEngine.validateTelegramAttributeValuesBlock(`<ul><li type="z">a</li></ul>`)
      expect(badValue.valid).toBe(false)
      expect(badType.valid).toBe(false)
    })

    it(`<table bordered/striped> and <td colspan/align> validate`, () => {
      const ok = TemplateEngine.validateTelegramAttributeValuesBlock(`<table bordered><tr><td colspan="2" align="center">x</td></tr></table>`)
      expect(ok.valid).toBe(true)
      const badColspan = TemplateEngine.validateTelegramAttributeValuesBlock(`<table striped><tr><td colspan="0">x</td></tr></table>`)
      const badAlign = TemplateEngine.validateTelegramAttributeValuesBlock(`<table><tr><td align="middle">x</td></tr></table>`)
      const badValign = TemplateEngine.validateTelegramAttributeValuesBlock(`<table><tr><td valign="center">x</td></tr></table>`)
      expect(badColspan.valid).toBe(false)
      expect(badAlign.valid).toBe(false)
      expect(badValign.valid).toBe(false)
    })

    it(`<th colspan/rowspan> validate`, () => {
      const ok = TemplateEngine.validateTelegramAttributeValuesBlock(`<table><tr><th colspan="2" rowspan="3">h</th></tr></table>`)
      expect(ok.valid).toBe(true)
      const bad = TemplateEngine.validateTelegramAttributeValuesBlock(`<table><tr><th colspan="0">h</th></tr></table>`)
      expect(bad.valid).toBe(false)
    })

    it(`<blockquote cite expandable> validates`, () => {
      const ok = TemplateEngine.validateTelegramAttributeValuesBlock(`<blockquote expandable cite="https://example.com">q</blockquote>`)
      expect(ok.valid).toBe(true)
      const bad = TemplateEngine.validateTelegramAttributeValuesBlock(`<blockquote cite="x.com">q</blockquote>`)
      expect(bad.valid).toBe(false)
    })

    it(`<aside cite> validates`, () => {
      const ok = TemplateEngine.validateTelegramAttributeValuesBlock(`<aside cite="https://example.com">q</aside>`)
      expect(ok.valid).toBe(true)
      const bad = TemplateEngine.validateTelegramAttributeValuesBlock(`<aside cite="x.com">q</aside>`)
      expect(bad.valid).toBe(false)
    })

    it(`<details open> boolean validates`, () => {
      const ok = TemplateEngine.validateTelegramAttributeValuesBlock(`<details open><summary>s</summary>d</details>`)
      expect(ok.valid).toBe(true)
    })

    it(`<tg-reference name> must not be empty`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-reference name="">x</tg-reference>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`name must not be empty`)
    })

    it(`<tg-reference name> accepts a non-empty name`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-reference name="note-1">x</tg-reference>`)
      expect(result.valid).toBe(true)
    })

    it(`<code class="language-x"> validates inside pre`, () => {
      const ok = TemplateEngine.validateTelegramAttributeValuesBlock(`<pre><code class="language-ts">const x = 1</code></pre>`)
      expect(ok.valid).toBe(true)
      const bad = TemplateEngine.validateTelegramAttributeValuesBlock(`<code class="foo">x</code>`)
      expect(bad.valid).toBe(false)
    })

    it(`tags without value validators are skipped`, () => {
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(`<b>bold</b> <p>x</p> <table></table> <h1>h</h1>`)
      expect(result.valid).toBe(true)
    })

    it(`single-quoted and unquoted values are also validated`, () => {
      const result1 = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-time unix='abc' format="wDT">x</tg-time>`)
      const result2 = TemplateEngine.validateTelegramAttributeValuesBlock(`<tg-time unix=abc format="wDT">x</tg-time>`)
      expect(result1.valid).toBe(false)
      expect(result2.valid).toBe(false)
    })

    it(`reports correct line number for multiline template`, () => {
      const template = `<g-base>
  <g-message>
    <tg-time unix="abc" format="wDT">x</tg-time>
  </g-message>
</g-base>`
      const result = TemplateEngine.validateTelegramAttributeValuesBlock(template)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.line).toBe(3)
    })

    it(`value errors and required-attr errors are independent (both reported by validateTemplate)`, () => {
      const result = TemplateEngine.validateTemplate(`<g-base><g-message><a>x</a><tg-time unix="abc" format="wDT">x</tg-time></g-message></g-base>`)
      expect(result.valid).toBe(false)
      const messages = result.errors.map((e) => e.message)
      expect(messages.some((m) => m.includes(`<a> must have one of:`))).toBe(true)
      expect(messages.some((m) => m.includes(`<tg-time> unix must be a positive integer`))).toBe(true)
    })
  })

  describe(`validatePageAttributes`, () => {
    it(`should return valid for empty template (no required attrs in spec)`, () => {
      const result = TemplateEngine.validatePageAttributesBlock(``)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`should return valid for typical templates (all PAGE attrs are optional)`, () => {
      const result = TemplateEngine.validatePageAttributesBlock(`<g-base><g-message lang="en">Hi</g-message></g-base>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`exposes the empty spec as a public static for future use`, () => {
      expect(TemplateEngine._PAGE_REQUIRED_ATTRS).toEqual({})
    })

    it(`is included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<g-base><g-message>Hi</g-message></g-base>`)
      expect(result.valid).toBe(true)
    })
  })

  describe(`validatePageAttributeValues`, () => {
    it(`should return valid for empty template`, () => {
      const result = TemplateEngine.validatePageAttributeValuesBlock(``)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`<g-base id> rejects empty value`, () => {
      const result = TemplateEngine.validatePageAttributeValuesBlock(`<g-base id=""></g-base>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toBe(`Attribute "id" on <g-base> must not be empty`)
    })

    it(`<g-base id> as boolean (no =value) is skipped, not treated as empty`, () => {
      // Consistent with <g-media shared> — boolean attrs without =value are not
      // validated as empty strings; the spec only fires on name=value declarations.
      const result = TemplateEngine.validatePageAttributeValuesBlock(`<g-base id></g-base>`)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it(`<g-base id> accepts non-empty value`, () => {
      const result = TemplateEngine.validatePageAttributeValuesBlock(`<g-base id="main"></g-base>`)
      expect(result.valid).toBe(true)
    })

    it(`<g-keyboard type> accepts "inline"`, () => {
      const result = TemplateEngine.validatePageAttributeValuesBlock(`<g-keyboard type="inline">A, B</g-keyboard>`)
      expect(result.valid).toBe(true)
    })

    it(`<g-keyboard type> accepts "bottom"`, () => {
      const result = TemplateEngine.validatePageAttributeValuesBlock(`<g-keyboard type="bottom">A, B</g-keyboard>`)
      expect(result.valid).toBe(true)
    })

    it(`<g-keyboard type> rejects invalid value`, () => {
      const result = TemplateEngine.validatePageAttributeValuesBlock(`<g-keyboard type="sidebar">A, B</g-keyboard>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toBe(`Attribute "type" on <g-keyboard> must be "inline" or "bottom", got "sidebar"`)
    })

    it(`<g-media type> accepts all 10 valid types`, () => {
      const types = [`photo`, `video`, `audio`, `document`, `animation`, `voice`, `video_note`, `sticker`, `location`, `contact`]
      for (const t of types) {
        const result = TemplateEngine.validatePageAttributeValuesBlock(`<g-media type="${t}" src="x"/>`)
        expect(result.valid).toBe(true)
      }
    })

    it(`<g-media type> rejects invalid type`, () => {
      const result = TemplateEngine.validatePageAttributeValuesBlock(`<g-media type="unknown" src="x"/>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toContain(`Attribute "type" on <g-media> must be one of`)
      expect(result.errors[0]?.message).toContain(`got "unknown"`)
    })

    it(`<g-media shared> accepts "true"`, () => {
      const result = TemplateEngine.validatePageAttributeValuesBlock(`<g-media type="photo" src="x" shared="true"/>`)
      expect(result.valid).toBe(true)
    })

    it(`<g-media shared> accepts "false"`, () => {
      const result = TemplateEngine.validatePageAttributeValuesBlock(`<g-media type="photo" src="x" shared="false"/>`)
      expect(result.valid).toBe(true)
    })

    it(`<g-media shared> rejects non-boolean value`, () => {
      const result = TemplateEngine.validatePageAttributeValuesBlock(`<g-media type="photo" src="x" shared="yes"/>`)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.message).toBe(`Attribute "shared" on <g-media> must be "true" or "false", got "yes"`)
    })

    it(`tags without value validators are skipped (<g-message>, <g-script>, <g-div>)`, () => {
      const result = TemplateEngine.validatePageAttributeValuesBlock(`<g-message lang="en">x</g-message><g-script>y</g-script><g-div>z</g-div>`)
      expect(result.valid).toBe(true)
    })

    it(`single-quoted and unquoted values are also validated`, () => {
      const result1 = TemplateEngine.validatePageAttributeValuesBlock(`<g-keyboard type='sidebar'>A, B</g-keyboard>`)
      const result2 = TemplateEngine.validatePageAttributeValuesBlock(`<g-keyboard type=sidebar>A, B</g-keyboard>`)
      expect(result1.valid).toBe(false)
      expect(result2.valid).toBe(false)
    })

    it(`boolean attributes (without =value) are skipped, not validated as empty strings`, () => {
      // <g-media type="photo" src="x" shared> — shared is boolean, no value
      const result = TemplateEngine.validatePageAttributeValuesBlock(`<g-media type="photo" src="x" shared></g-media>`)
      expect(result.valid).toBe(true)
    })

    it(`reports correct line number for multiline template`, () => {
      const template = `<g-base>
  <g-message>
    <g-keyboard type="sidebar">A, B</g-keyboard>
  </g-message>
</g-base>`
      const result = TemplateEngine.validatePageAttributeValuesBlock(template)
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.line).toBe(3)
    })

    it(`multiple value errors are all reported`, () => {
      const result = TemplateEngine.validatePageAttributeValuesBlock(`<g-base id=""></g-base><g-keyboard type="sidebar">A</g-keyboard><g-media type="bad" src="x"/>`)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(3)
    })

    it(`exposes the spec as a public static`, () => {
      expect(TemplateEngine._PAGE_ATTR_VALUE_VALIDATORS[`g-base`]).toBeDefined()
      expect(TemplateEngine._PAGE_ATTR_VALUE_VALIDATORS[`g-keyboard`]).toBeDefined()
      expect(TemplateEngine._PAGE_ATTR_VALUE_VALIDATORS[`g-media`]).toBeDefined()
      expect(TemplateEngine._PAGE_ATTR_VALUE_VALIDATORS[`g-message`]).toBeUndefined()
    })

    it(`per-block validators and centralized validator produce consistent value errors (same spec)`, () => {
      const template = `<g-keyboard type="sidebar">A, B</g-keyboard>`
      const perBlock = TemplateEngine.validateBlockGKeyboardAttributes(template)
      const centralized = TemplateEngine.validatePageAttributeValuesBlock(template)
      expect(perBlock.errors[0]?.message).toBe(centralized.errors[0]?.message)
    })

    it(`is included in validateTemplate full validation`, () => {
      const result = TemplateEngine.validateTemplate(`<g-base id=""><g-message>x</g-message></g-base>`)
      expect(result.valid).toBe(false)
      const messages = result.errors.map((e) => e.message)
      expect(messages.some((m) => m.includes(`Attribute "id" on <g-base> must not be empty`))).toBe(true)
    })
  })
})
