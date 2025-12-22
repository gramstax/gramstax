import { describe, it, expect } from "bun:test"
import { TemplateEngine } from "~/template/engine"

describe(`TemplateEngine`, () => {
  describe(`_processMessageBlocks`, () => {
    it(`should parse message with explicit lang`, () => {
      const template = `<message lang="en">Hello</message>`
      const result = TemplateEngine._processMessageBlocks(template)
      expect(result).toEqual({ en: `Hello` })
    })

    it(`should parse message with default lang (missing attr lang)`, () => {
      const template = `<message>Hello</message>`
      const result = TemplateEngine._processMessageBlocks(template)
      expect(result).toEqual({ default: `Hello` })
    })

    it(`should parse message with mixed attributes`, () => {
      const template = `<message id="1" lang="es">Hola</message>`
      const result = TemplateEngine._processMessageBlocks(template)
      expect(result).toEqual({ es: `Hola` })
    })
  })

  describe(`_processDescriptionBlocks`, () => {
    it(`should parse description with explicit lang and scope`, () => {
      const template = `<description lang="en" scope="private">Desc</description>`
      const result = TemplateEngine._processDescriptionBlocks(template)
      expect(result).toEqual({ en: { private: `Desc` } })
    })

    it(`should parse description with default lang and scope`, () => {
      const template = `<description>Desc</description>`
      const result = TemplateEngine._processDescriptionBlocks(template)
      expect(result).toEqual({ default: { default: `Desc` } })
    })

    it(`should parse description with mixed attributes`, () => {
      const template = `<description scope="group" lang="id">Deskripsi</description>`
      const result = TemplateEngine._processDescriptionBlocks(template)
      expect(result).toEqual({ id: { group: `Deskripsi` } })
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
  })

  describe(`_processMapBlocks`, () => {
    it(`should iterate over a list with default as="e" index="i"`, () => {
      const template = `<map from="users">{{i}}. {{e.name}}</map>`
      const processed = TemplateEngine._processMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        users: [{ name: `Alice` }, { name: `Bob` }]
      }
      expect(fn(data)).toBe(`0. Alice\n1. Bob`)
    })

    it(`should support custom as and index attributes`, () => {
      const template = `<map from="users" as="user" index="idx">{{idx}}. {{user.name}}</map>`
      const processed = TemplateEngine._processMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        users: [{ name: `Alice` }, { name: `Bob` }]
      }
      expect(fn(data)).toBe(`0. Alice\n1. Bob`)
    })

    it(`should support custom join separator`, () => {
      const template = `<map from="tags" as="tag" join=", ">{{tag}}</map>`
      const processed = TemplateEngine._processMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        tags: [`red`, `green`, `blue`]
      }
      expect(fn(data)).toBe(`red, green, blue`)
    })

    it(`should support nested properties and global variables`, () => {
      const template = `<map from="items">{{e.id}}: {{globalPrefix}}-{{e.value}}</map>`
      let processed = TemplateEngine._processMapBlocks(template)
      processed = TemplateEngine._processExec(processed)
      processed = TemplateEngine._processVariables(processed)

      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = {
        items: [
          { id: 1, value: `A` },
          { id: 2, value: `B` }
        ],
        globalPrefix: `G`
      }
      expect(fn(data)).toBe(`1: G-A\n2: G-B`)
    })

    it(`should handle empty list`, () => {
      const template = `List:\n<map from="emptyList">{{e}}</map>`
      const processed = TemplateEngine._processMapBlocks(template)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = { emptyList: [] }
      expect(fn(data)).toBe(`List:\n`)
    })
  })

  describe(`_processExec`, () => {
    it(`should execute inline javascript`, () => {
      const template = `Result: {~ 1 + 2 ~}`
      const processed = TemplateEngine._processExec(template)
      const fn = TemplateEngine._compileToFunction(processed, false)
      expect(fn()).toBe(`Result: 3`)
    })

    it(`should execute without spaces {~1+2~}`, () => {
      const template = `Result: {~1+2~}`
      const processed = TemplateEngine._processExec(template)
      const fn = TemplateEngine._compileToFunction(processed, false)
      expect(fn()).toBe(`Result: 3`)
    })

    it(`should work inside map block`, () => {
      const template = `<map from="nums">{~ e * 2 ~}</map>`
      let processed = TemplateEngine._processMapBlocks(template)
      processed = TemplateEngine._processExec(processed)
      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = { nums: [1, 2, 3] }
      expect(fn(data)).toBe(`2\n4\n6`)
    })

    it(`should support index math inside map`, () => {
      const template = `<map from="nums">{~ i + 1 ~}. {{e}}</map>`
      let processed = TemplateEngine._processMapBlocks(template)
      processed = TemplateEngine._processExec(processed)

      const fn = TemplateEngine._compileToFunction(processed, false)

      const data = { nums: [`a`, `b`] }
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
      const compiled = TemplateEngine.compileMedia(template)
      const data = { avatar: `http://alice.png`, name: `Alice` }
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
      const compiled = TemplateEngine.compileMedia(template)
      const data = { lat: 10, lng: `20` }
      const media = compiled.loc!.default!(data)

      expect(media.latitude).toBe(`11`)
      expect(media.longitude).toBe(`20`)
    })

    it(`should prioritize local variables for both {{...}} and {~ ... ~} syntax`, () => {
      // Test {{e}}
      const template1 = `<map from="arr">{{e}}</map>`
      const fn1 = TemplateEngine._compileToFunction(TemplateEngine._processVariables(TemplateEngine._processMapBlocks(template1)), false)

      // Test {~ e ~}
      const template2 = `<map from="arr">{~ e ~}</map>`
      const fn2 = TemplateEngine._compileToFunction(TemplateEngine._processExec(TemplateEngine._processMapBlocks(template2)), false)

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
            <map from="users" join=", ">{~ i + 1 ~}. {{e.name}}</map>
          </message>
        </base>
      `
      const compiled = TemplateEngine.compileMessages(template)
      const fn = compiled[`list`]![`default`]

      const data = { users: [{ name: `X` }, { name: `Y` }] }
      expect(fn!(data).trim()).toBe(`1. X, 2. Y`)
    })
  })
})
