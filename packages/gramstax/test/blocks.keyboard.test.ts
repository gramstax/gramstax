import {describe, expect, it} from "bun:test"
import {BlockKeyboard} from "~/blocks/keyboard"
import {LabelKeyboard} from "~/labels/keyboard"

class KB extends LabelKeyboard {
  static home = {en: `Home`, id: `Rumah`}
}

class NoLabel extends BlockKeyboard {}

describe(`BlockKeyboard`, () => {
  describe(`_build`, () => {
    it(`throws when label is not set`, () => {
      expect(() => NoLabel._build(`home`)).toThrow(/Label not found/)
    })

    it(`throws when the key does not exist`, () => {
      expect(() => BlockKeyboard._build.call({label: KB}, `missing`)).toThrow(/Object value missing not found/)
    })

    it(`throws for prototype-chain keys instead of returning empty output`, () => {
      expect(() => BlockKeyboard._build.call({label: KB}, `constructor`)).toThrow(/Object value constructor not found/)
      expect(() => BlockKeyboard._build.call({label: KB}, `toString`)).toThrow(/Object value toString not found/)
    })

    it(`builds all language blocks when lang is omitted`, () => {
      const out = BlockKeyboard._build.call({label: KB}, `home`)
      expect(out).toBe(`<g-keyboard type="inline" lang="en">Home</g-keyboard> <g-keyboard type="inline" lang="id">Rumah</g-keyboard>`)
    })

    it(`builds a single language block when lang is set`, () => {
      const out = BlockKeyboard._build.call({label: KB}, `home`, `id`)
      expect(out).toBe(`<g-keyboard type="inline" lang="id">Rumah</g-keyboard>`)
    })

    it(`throws when the requested lang does not exist in the label`, () => {
      expect(() => BlockKeyboard._build.call({label: KB}, `home`, `fr`)).toThrow(/not found/)
      expect(() => BlockKeyboard._build.call({label: KB}, `home`, `default`)).toThrow(/not found/)
    })

    it(`defaults type to inline`, () => {
      const out = BlockKeyboard._build.call({label: KB}, `home`, `en`)
      expect(out).toContain(`type="inline"`)
    })

    it(`builds bottom type when requested`, () => {
      const out = BlockKeyboard._build.call({label: KB}, `home`, `en`, `bottom`)
      expect(out).toBe(`<g-keyboard type="bottom" lang="en">Home</g-keyboard>`)
    })

    it(`reverses button order when reverse is true`, () => {
      class KBNav extends LabelKeyboard {
        static nav = {en: `Back, Next`}
      }
      const out = BlockKeyboard._build.call({label: KBNav}, `nav`, `en`, `inline`, true)
      expect(out).toBe(`<g-keyboard type="inline" lang="en">Next, Back</g-keyboard>`)
    })

    it(`supports a lang key named default when explicitly defined`, () => {
      class KBDefault extends LabelKeyboard {
        static menu = {default: `Back, Next`, en: `Back, Next`}
      }
      const out = BlockKeyboard._build.call({label: KBDefault}, `menu`, `default`)
      expect(out).toBe(`<g-keyboard type="inline" lang="default">Back, Next</g-keyboard>`)
    })
  })
})
