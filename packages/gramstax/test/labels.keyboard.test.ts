import {describe, expect, it} from "bun:test"
import {LabelKeyboard} from "~/labels/keyboard"

describe(`LabelKeyboard`, () => {
  describe(`_reverse`, () => {
    it(`reverses comma-separated labels`, () => {
      expect(LabelKeyboard._reverse(`Back, Next, Submit`)).toBe(`Submit, Next, Back`)
    })

    it(`normalizes missing spaces after commas`, () => {
      expect(LabelKeyboard._reverse(`Back,Next,Submit`)).toBe(`Submit, Next, Back`)
    })

    it(`preserves escaped commas (\\,)`, () => {
      expect(LabelKeyboard._reverse(`Option A\\, B, Option C`)).toBe(`Option C, Option A\\, B`)
    })

    it(`splits on a comma after an escaped backslash (\\\\, is a separator)`, () => {
      expect(LabelKeyboard._reverse(`A\\\\, B, C`)).toBe(`C, B, A\\\\`)
    })

    it(`returns empty string for empty input`, () => {
      expect(LabelKeyboard._reverse(``)).toBe(``)
    })

    it(`returns single item unchanged`, () => {
      expect(LabelKeyboard._reverse(`Only`)).toBe(`Only`)
    })
  })

  describe(`_reverseObj`, () => {
    it(`reverses every language value`, () => {
      const result = LabelKeyboard._reverseObj({en: `Back, Next`, id: `Kembali, Lanjut`})
      expect(result.en).toBe(`Next, Back`)
      expect(result.id).toBe(`Lanjut, Kembali`)
    })

    it(`preserves all keys`, () => {
      const result = LabelKeyboard._reverseObj({en: `A, B`, id: `C, D`})
      expect(Object.keys(result).sort()).toEqual([`en`, `id`])
    })

    it(`preserves escaped commas per language`, () => {
      const result = LabelKeyboard._reverseObj({en: `A\\, B, C`})
      expect(result.en).toBe(`C, A\\, B`)
    })

    it(`is callable from a subclass`, () => {
      class KB extends LabelKeyboard {
        static oneTwo = this._reverseObj({en: `One, Two`, id: `Satu, Dua`})
      }
      expect(KB.oneTwo.en).toBe(`Two, One`)
      expect(KB.oneTwo.id).toBe(`Dua, Satu`)
    })
  })
})
