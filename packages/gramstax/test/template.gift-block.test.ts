import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {TemplateEngine} from "~/template/engine"
import {TemplateManager} from "~/template/manager"

const TEST_DIR = join(import.meta.dir, `views-gift`)

const giftTemplate = `<g-base id="gift">
  <g-gift>Hadiah <b>{{item}}</b> untukmu!</g-gift>
  <g-gift lang="id">Hadiah <b>{{item}}</b> untukmu ya!</g-gift>
</g-base>`

describe(`gift-block-parser`, () => {
  it(`parses gift children with lang keys, HTML and interpolation preserved`, () => {
    const blocks = TemplateEngine._processGGiftBlocks(giftTemplate)
    expect(blocks.default).toBe(`Hadiah <b>{{item}}</b> untukmu!`)
    expect(blocks.id).toBe(`Hadiah <b>{{item}}</b> untukmu ya!`)
  })
})

describe(`gift-block-compile`, () => {
  it(`compiles gift per base and lang with data interpolation`, () => {
    const compiled = TemplateEngine.compileBlockGGift(giftTemplate)
    expect(compiled.gift?.default?.({item: `kopi`})).toBe(`Hadiah <b>kopi</b> untukmu!`)
    expect(compiled.gift?.id?.({item: `kopi`})).toBe(`Hadiah <b>kopi</b> untukmu ya!`)
  })
})

describe(`gift-block-validate`, () => {
  it(`accepts HTML content (gift text supports HTML parse mode)`, () => {
    const result = TemplateEngine.validateTemplate(`<g-base>
  <g-gift>Hadiah <b>{{item}}</b>!</g-gift>
</g-base>`)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it(`rejects unknown attributes`, () => {
    const result = TemplateEngine.validateBlockGGiftAttributes(`<g-base><g-gift bogus="1">Hi</g-gift></g-base>`)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe(`gift-manager`, () => {
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

  it(`compiles and serves gift text via getGGift`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`present`, giftTemplate)
    expect(manager.getGGift(`present`, `gift`, `default`, {item: `kopi`}).text).toBe(`Hadiah <b>kopi</b> untukmu!`)
    expect(manager.getGGift(`present`, `gift`, `id`, {item: `kopi`}).text).toBe(`Hadiah <b>kopi</b> untukmu ya!`)
  })

  it(`throws for a missing gift block (strict, never empty text)`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`empty`, `<g-base><g-message>Hi</g-message></g-base>`)
    expect(() => manager.getGGift(`empty`)).toThrow(/Gift function not found/)
  })
})
