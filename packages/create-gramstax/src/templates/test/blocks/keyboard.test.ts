import {describe, it, expect} from "bun:test"
import {KeyboardBlock} from "~/blocks/keyboard"

describe(`KeyboardBlock`, () => {
  describe(`labels`, () => {
    it(`has home label with default and id variants`, () => {
      expect(KeyboardBlock.label.home.default).toBe(`🏠 Home`)
      expect(KeyboardBlock.label.home.id).toBe(`🏠 Beranda`)
    })

    it(`has back label with default and id variants`, () => {
      expect(KeyboardBlock.label.back.default).toBe(`⬅️ Back`)
      expect(KeyboardBlock.label.back.id).toBe(`⬅️ Kembali`)
    })

    it(`has cancel label with default and id variants`, () => {
      expect(KeyboardBlock.label.cancel.default).toBe(`✖️ Cancel`)
      expect(KeyboardBlock.label.cancel.id).toBe(`✖️ Batal`)
    })

    it(`has backHome label combining back and home`, () => {
      expect(KeyboardBlock.label.backHome.default).toBe(`⬅️ Back, 🏠 Home`)
      expect(KeyboardBlock.label.backHome.id).toBe(`⬅️ Kembali, 🏠 Beranda`)
    })
  })

  describe(`_build`, () => {
    it(`home() returns a keyboard block string`, () => {
      const kb = KeyboardBlock.home()
      expect(kb).toBeDefined()
      expect(typeof kb).toBe(`string`)
      expect(kb).toContain(`<keyboard`)
      expect(kb).toContain(`Home`)
    })

    it(`back() returns a keyboard block string`, () => {
      const kb = KeyboardBlock.back()
      expect(kb).toBeDefined()
      expect(typeof kb).toBe(`string`)
      expect(kb).toContain(`<keyboard`)
      expect(kb).toContain(`Back`)
    })

    it(`cancel() returns a keyboard block string`, () => {
      const kb = KeyboardBlock.cancel()
      expect(kb).toBeDefined()
      expect(typeof kb).toBe(`string`)
      expect(kb).toContain(`<keyboard`)
      expect(kb).toContain(`Cancel`)
    })

    it(`backHome() returns a keyboard block string`, () => {
      const kb = KeyboardBlock.backHome()
      expect(kb).toBeDefined()
      expect(typeof kb).toBe(`string`)
      expect(kb).toContain(`<keyboard`)
      expect(kb).toContain(`Back`)
      expect(kb).toContain(`Home`)
    })

    it(`home() with id language returns Indonesian label`, () => {
      const kb = KeyboardBlock.home(`id`)
      expect(kb).toBeDefined()
      expect(typeof kb).toBe(`string`)
      expect(kb).toContain(`Beranda`)
    })

    it(`back() with id language returns Indonesian label`, () => {
      const kb = KeyboardBlock.back(`id`)
      expect(kb).toBeDefined()
      expect(typeof kb).toBe(`string`)
      expect(kb).toContain(`Kembali`)
    })

    it(`home() with bottom type returns bottom keyboard`, () => {
      const kb = KeyboardBlock.home(`default`, `bottom`)
      expect(kb).toBeDefined()
      expect(typeof kb).toBe(`string`)
      expect(kb).toContain(`type="bottom"`)
    })

    it(`back() with inline type returns inline keyboard`, () => {
      const kb = KeyboardBlock.back(`default`, `inline`)
      expect(kb).toBeDefined()
      expect(typeof kb).toBe(`string`)
      expect(kb).toContain(`type="inline"`)
    })
  })
})
