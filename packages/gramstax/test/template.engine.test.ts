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
})
