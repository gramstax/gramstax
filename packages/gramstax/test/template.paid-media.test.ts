import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {TemplateEngine} from "~/template/engine"
import {TemplateManager} from "~/template/manager"

const TEST_DIR = join(import.meta.dir, `views-paid-media`)

const wallTemplate = `<g-base>
  <g-paid-media stars="100">
    <g-media type="photo" src="{{teaser}}">Bayar untuk membuka</g-media>
    <g-media type="video" src="{{full}}">Konten full</g-media>
  </g-paid-media>
</g-base>`

const full = (attrs: string, media = `<g-media type="photo" src="t.jpg">Teaser</g-media>`): string => `<g-base>
  <g-paid-media ${attrs}>${media}</g-paid-media>
</g-base>`

const validAttrs = `stars="100"`

const tenItems = Array.from({length: 10}, (_, i) => `<g-media type="photo" src="t${i}.jpg">C${i}</g-media>`).join(``)

const elevenItems = Array.from({length: 11}, (_, i) => `<g-media type="photo" src="t${i}.jpg">C${i}</g-media>`).join(``)

describe(`paid-media-parser`, () => {
  it(`parses a paywall with defaults`, () => {
    const walls = TemplateEngine._processGPaidMediaBlocks(wallTemplate)
    expect(walls.default?.stars).toBe(100)
    expect(walls.default?.media).toEqual([
      {type: `photo`, src: `{{teaser}}`, caption: `Bayar untuk membuka`},
      {type: `video`, src: `{{full}}`, caption: `Konten full`}
    ])
  })

  it(`keys paywalls by lang`, () => {
    const walls = TemplateEngine._processGPaidMediaBlocks(`<g-base><g-paid-media lang="id" stars="100"><g-media type="photo" src="t.jpg">Teaser</g-media></g-paid-media></g-base>`)
    expect(Object.keys(walls)).toEqual([`id`])
  })

  it(`parses single-quoted and bare attributes`, () => {
    const walls = TemplateEngine._processGPaidMediaBlocks(`<g-base><g-paid-media stars='100'><g-media type='photo' src=t.jpg>Teaser</g-media></g-paid-media></g-base>`)
    expect(walls.default?.stars).toBe(100)
    expect(walls.default?.media).toEqual([{type: `photo`, src: `t.jpg`, caption: `Teaser`}])
  })

  it(`parses a block without attributes into NaN stars and empty media`, () => {
    const walls = TemplateEngine._processGPaidMediaBlocks(`<g-base><g-paid-media></g-paid-media></g-base>`)
    expect(Number.isNaN(walls.default?.stars)).toBe(true)
    expect(walls.default?.media).toEqual([])
  })

  it(`parses a bare g-media child without attributes`, () => {
    const walls = TemplateEngine._processGPaidMediaBlocks(full(validAttrs, `<g-media>Teaser</g-media>`))
    expect(walls.default?.media.length).toBe(1)
    expect(String(walls.default?.media[0]?.type)).toBe(``)
    expect(walls.default?.media[0]?.src).toBe(``)
    expect(walls.default?.media[0]?.caption).toBe(`Teaser`)
  })

  it(`omits the caption key for a captionless item`, () => {
    const walls = TemplateEngine._processGPaidMediaBlocks(full(validAttrs, `<g-media type="video" src="v.mp4"></g-media>`))
    expect(walls.default?.media).toEqual([{type: `video`, src: `v.mp4`}])
    expect(`caption` in (walls.default?.media[0] as Record<string, unknown>)).toBe(false)
  })

  it(`keeps non-numeric stars as NaN for the validator`, () => {
    const walls = TemplateEngine._processGPaidMediaBlocks(full(`stars="abc"`))
    expect(Number.isNaN(walls.default?.stars)).toBe(true)
  })
})

describe(`paid-media-validator`, () => {
  it(`accepts a valid paywall`, () => {
    expect(TemplateEngine.validateTemplate(wallTemplate).valid).toBe(true)
  })

  it(`rejects missing stars`, () => {
    const result = TemplateEngine.validateBlockGPaidMediaAttributes(full(`lang="id"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`"stars" on <g-paid-media> is required`))).toBe(true)
  })

  it(`rejects empty stars`, () => {
    const result = TemplateEngine.validateBlockGPaidMediaAttributes(full(`stars=""`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`"stars" on <g-paid-media> is required`))).toBe(true)
  })

  it(`rejects zero stars`, () => {
    const result = TemplateEngine.validateBlockGPaidMediaAttributes(full(`stars="0"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`1-25000`))).toBe(true)
  })

  it(`rejects non-numeric stars`, () => {
    const result = TemplateEngine.validateBlockGPaidMediaAttributes(full(`stars="abc"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`1-25000`))).toBe(true)
  })

  it(`rejects decimal stars`, () => {
    const result = TemplateEngine.validateBlockGPaidMediaAttributes(full(`stars="1.5"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`1-25000`))).toBe(true)
  })

  it(`rejects stars above the Bot API maximum`, () => {
    const result = TemplateEngine.validateBlockGPaidMediaAttributes(full(`stars="25001"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`1-25000`))).toBe(true)
  })

  it(`accepts the Bot API maximum stars`, () => {
    expect(TemplateEngine.validateBlockGPaidMediaAttributes(full(`stars="25000"`)).valid).toBe(true)
  })

  it(`accepts dynamic stars without static range check`, () => {
    expect(TemplateEngine.validateBlockGPaidMediaAttributes(full(`stars="{{price}}"`)).valid).toBe(true)
  })

  it(`rejects zero children`, () => {
    const result = TemplateEngine.validateBlockGPaidMediaAttributes(full(validAttrs, ``))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`1-10 <g-media> items`))).toBe(true)
  })

  it(`rejects eleven children`, () => {
    const result = TemplateEngine.validateBlockGPaidMediaAttributes(full(validAttrs, elevenItems))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`1-10 <g-media> items (got 11)`))).toBe(true)
  })

  it(`accepts ten children`, () => {
    expect(TemplateEngine.validateBlockGPaidMediaAttributes(full(validAttrs, tenItems)).valid).toBe(true)
  })

  it(`rejects an audio child`, () => {
    const result = TemplateEngine.validateBlockGPaidMediaAttributes(full(validAttrs, `<g-media type="audio" src="a.mp3">Lagu</g-media>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`must be "photo" or "video"`))).toBe(true)
  })

  it(`rejects a child without type`, () => {
    const result = TemplateEngine.validateBlockGPaidMediaAttributes(full(validAttrs, `<g-media src="t.jpg">Teaser</g-media>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`must be "photo" or "video"`))).toBe(true)
  })

  it(`accepts a dynamic child type without static check`, () => {
    expect(TemplateEngine.validateBlockGPaidMediaAttributes(full(validAttrs, `<g-media type="{{t}}" src="t.jpg">Teaser</g-media>`)).valid).toBe(true)
  })

  it(`rejects a child without src`, () => {
    const result = TemplateEngine.validateBlockGPaidMediaAttributes(full(validAttrs, `<g-media type="photo">Teaser</g-media>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`"src" on <g-media> inside <g-paid-media> is required`))).toBe(true)
  })

  it(`rejects an unknown attr on g-paid-media`, () => {
    const result = TemplateEngine.validateBlockGPaidMediaAttributes(full(`${validAttrs} foo="1"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`Unknown attribute`))).toBe(true)
  })

  it(`rejects bad stars through the centralized page value step`, () => {
    const result = TemplateEngine.validatePageAttributeValuesBlock(full(`stars="abc"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`1-25000`))).toBe(true)
  })

  it(`rejects a self-closing g-paid-media`, () => {
    const result = TemplateEngine.validateFormatBlock(`<g-base><g-paid-media stars="100"/></g-base>`)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`must not be self-closing`))).toBe(true)
  })

  it(`allows g-media inside g-paid-media`, () => {
    expect(TemplateEngine.validatePositionsBlock(wallTemplate).valid).toBe(true)
  })

  it(`rejects a g-paid-media outside g-base`, () => {
    const result = TemplateEngine.validatePositionsBlock(`<g-base><g-message>Hi</g-message></g-base><g-paid-media stars="100"><g-media type="photo" src="t.jpg">Teaser</g-media></g-paid-media>`)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`<g-paid-media>`))).toBe(true)
  })
})

describe(`paid-media-compiler`, () => {
  it(`interpolates src and caption with filters`, () => {
    const compiled = TemplateEngine.compileBlockGPaidMedia(wallTemplate)
    const wall = compiled.default?.default?.({teaser: `t.jpg`, full: `v.mp4`})
    expect(wall?.stars).toBe(100)
    expect(wall?.media).toEqual([
      {type: `photo`, src: `t.jpg`, caption: `Bayar untuk membuka`},
      {type: `video`, src: `v.mp4`, caption: `Konten full`}
    ])
  })

  it(`applies filters inside src and caption`, () => {
    const compiled = TemplateEngine.compileBlockGPaidMedia(full(validAttrs, `<g-media type="photo" src="{{file|lower}}">{{cap|upper}}</g-media>`))
    const wall = compiled.default?.default?.({file: `T.JPG`, cap: `teaser`})
    expect(wall?.media).toEqual([{type: `photo`, src: `t.jpg`, caption: `TEASER`}])
  })

  it(`keeps a captionless item captionless`, () => {
    const compiled = TemplateEngine.compileBlockGPaidMedia(full(validAttrs, `<g-media type="video" src="{{full}}"></g-media>`))
    const wall = compiled.default?.default?.({full: `v.mp4`})
    expect(wall?.media).toEqual([{type: `video`, src: `v.mp4`}])
  })

  it(`compiles per-lang variants`, () => {
    const compiled = TemplateEngine.compileBlockGPaidMedia(`<g-base><g-paid-media stars="100"><g-media type="photo" src="t.jpg">Teaser</g-media></g-paid-media><g-paid-media lang="id" stars="100"><g-media type="photo" src="t.jpg">Intip</g-media></g-paid-media></g-base>`)
    expect(compiled.default?.default?.({})?.media[0]?.caption).toBe(`Teaser`)
    expect(compiled.default?.id?.({})?.media[0]?.caption).toBe(`Intip`)
  })
})

describe(`paid-media-manager`, () => {
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

  it(`compiles and serves a paywall via getGPaidMedia`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`stars`, wallTemplate)
    const wall = manager.getGPaidMedia(`stars`, `default`, `default`, {teaser: `t.jpg`, full: `v.mp4`})
    expect(wall.stars).toBe(100)
    expect(wall.media).toEqual([
      {type: `photo`, src: `t.jpg`, caption: `Bayar untuk membuka`},
      {type: `video`, src: `v.mp4`, caption: `Konten full`}
    ])
  })

  it(`throws for a missing paywall`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`empty`, `<g-base><g-message>Hi</g-message></g-base>`)
    expect(() => manager.getGPaidMedia(`empty`)).toThrow(/Paid media function not found/)
  })

  it(`throws on a paywall with bad stars`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(() => manager.compile(`bad`, full(`stars="abc"`))).toThrow(/1-25000/)
  })

  it(`throws on a paywall with an audio child`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(() => manager.compile(`bad`, full(validAttrs, `<g-media type="audio" src="a.mp3">Lagu</g-media>`))).toThrow(/must be "photo" or "video"/)
  })

  it(`throws on a paywall without items`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(() => manager.compile(`bad`, full(validAttrs, ``))).toThrow(/1-10 <g-media> items/)
  })
})
