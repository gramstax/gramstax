import {describe, expect, it} from "bun:test"
import {LabelGKeyboard} from "~/labels/g-keyboard"

describe(`LabelGKeyboard`, () => {
  describe(`_reverse`, () => {
    it(`reverses comma-separated labels`, () => {
      expect(LabelGKeyboard._reverse(`Back, Next, Submit`)).toBe(`Submit, Next, Back`)
    })

    it(`normalizes missing spaces after commas`, () => {
      expect(LabelGKeyboard._reverse(`Back,Next,Submit`)).toBe(`Submit, Next, Back`)
    })

    it(`preserves escaped commas (\\,)`, () => {
      expect(LabelGKeyboard._reverse(`Option A\\, B, Option C`)).toBe(`Option C, Option A\\, B`)
    })

    it(`splits on a comma after an escaped backslash (\\\\, is a separator)`, () => {
      expect(LabelGKeyboard._reverse(`A\\\\, B, C`)).toBe(`C, B, A\\\\`)
    })

    it(`returns empty string for empty input`, () => {
      expect(LabelGKeyboard._reverse(``)).toBe(``)
    })

    it(`returns single item unchanged`, () => {
      expect(LabelGKeyboard._reverse(`Only`)).toBe(`Only`)
    })
  })

  describe(`_reverseObj`, () => {
    it(`reverses every language value`, () => {
      const result = LabelGKeyboard._reverseObj({en: `Back, Next`, id: `Kembali, Lanjut`})
      expect(result.en).toBe(`Next, Back`)
      expect(result.id).toBe(`Lanjut, Kembali`)
    })

    it(`preserves all keys`, () => {
      const result = LabelGKeyboard._reverseObj({en: `A, B`, id: `C, D`})
      expect(Object.keys(result).sort()).toEqual([`en`, `id`])
    })

    it(`preserves escaped commas per language`, () => {
      const result = LabelGKeyboard._reverseObj({en: `A\\, B, C`})
      expect(result.en).toBe(`C, A\\, B`)
    })

    it(`is callable from a subclass`, () => {
      class KB extends LabelGKeyboard {
        static oneTwo = this._reverseObj({en: `One, Two`, id: `Satu, Dua`})
      }
      expect(KB.oneTwo.en).toBe(`Two, One`)
      expect(KB.oneTwo.id).toBe(`Dua, Satu`)
    })
  })
})
