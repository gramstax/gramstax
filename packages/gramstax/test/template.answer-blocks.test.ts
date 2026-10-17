import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {TemplateEngine} from "~/template/engine"
import {TemplateManager} from "~/template/manager"

const TEST_DIR = join(import.meta.dir, `views-answer-blocks`)

const callbackTemplate = `<g-base>
  <g-callback-answer>Pesanan {{orderId}} diproses</g-callback-answer>
  <g-callback-answer lang="id">Pesanan {{orderId}} diproses ya</g-callback-answer>
</g-base>`

const precheckoutTemplate = `<g-base id="pay">
  <g-precheckout-error>Stok {{item}} habis</g-precheckout-error>
</g-base>`

const shippingTemplate = `<g-base id="ship">
  <g-shipping-error>Di luar zona {{city}}</g-shipping-error>
</g-base>`

describe(`answer-blocks-parser`, () => {
  it(`parses callback-answer children with lang keys and interpolation preserved`, () => {
    const blocks = TemplateEngine._processGCallbackAnswerBlocks(callbackTemplate)
    expect(blocks.default).toBe(`Pesanan {{orderId}} diproses`)
    expect(blocks.id).toBe(`Pesanan {{orderId}} diproses ya`)
  })

  it(`parses precheckout-error children with interpolation preserved`, () => {
    const blocks = TemplateEngine._processGPrecheckoutErrorBlocks(precheckoutTemplate)
    expect(blocks.default).toBe(`Stok {{item}} habis`)
  })

  it(`parses shipping-error children with interpolation preserved`, () => {
    const blocks = TemplateEngine._processGShippingErrorBlocks(shippingTemplate)
    expect(blocks.default).toBe(`Di luar zona {{city}}`)
  })
})

describe(`answer-blocks-compile`, () => {
  it(`compiles callback-answer per base and lang with data interpolation`, () => {
    const compiled = TemplateEngine.compileBlockGCallbackAnswer(callbackTemplate)
    expect(compiled.default?.default?.({orderId: `7`})).toBe(`Pesanan 7 diproses`)
    expect(compiled.default?.id?.({orderId: `7`})).toBe(`Pesanan 7 diproses ya`)
  })

  it(`compiles precheckout-error under its base id`, () => {
    const compiled = TemplateEngine.compileBlockGPrecheckoutError(precheckoutTemplate)
    expect(compiled.pay?.default?.({item: `kopi`})).toBe(`Stok kopi habis`)
  })

  it(`compiles shipping-error under its base id`, () => {
    const compiled = TemplateEngine.compileBlockGShippingError(shippingTemplate)
    expect(compiled.ship?.default?.({city: `Bandung`})).toBe(`Di luar zona Bandung`)
  })
})

describe(`answer-blocks-validate`, () => {
  it(`accepts a valid template with all three blocks`, () => {
    const result = TemplateEngine.validateTemplate(`<g-base>
  <g-callback-answer>OK {{x}}</g-callback-answer>
  <g-precheckout-error>E {{x}}</g-precheckout-error>
  <g-shipping-error>S {{x}}</g-shipping-error>
</g-base>`)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it(`rejects unknown attributes on the new blocks`, () => {
    const result = TemplateEngine.validateBlockGCallbackAnswerAttributes(`<g-base><g-callback-answer bogus="1">OK</g-callback-answer></g-base>`)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it(`rejects HTML inside callback-answer (toast is plain text)`, () => {
    const result = TemplateEngine.validateBlockGCallbackAnswerAttributes(`<g-base><g-callback-answer>Hi <b>x</b></g-callback-answer></g-base>`)
    expect(result.valid).toBe(false)
  })

  it(`rejects callback-answer text over 200 chars`, () => {
    const long = `x`.repeat(201)
    const result = TemplateEngine.validateBlockGCallbackAnswerAttributes(`<g-base><g-callback-answer>${long}</g-callback-answer></g-base>`)
    expect(result.valid).toBe(false)
  })

  it(`rejects HTML inside payment error blocks`, () => {
    const pre = TemplateEngine.validateBlockGPrecheckoutErrorAttributes(`<g-base><g-precheckout-error>E <i>y</i></g-precheckout-error></g-base>`)
    expect(pre.valid).toBe(false)
    const ship = TemplateEngine.validateBlockGShippingErrorAttributes(`<g-base><g-shipping-error>S <i>y</i></g-shipping-error></g-base>`)
    expect(ship.valid).toBe(false)
  })
})

const inlineButtonTemplate = `<g-base id="inline">
  <g-inline-button text="Lihat {{item}}" start-parameter="detail-1"/>
  <g-inline-button lang="id" text="Lihat {{item}} ya"/>
</g-base>`

const answerNoteTemplate = `<g-base id="guest">
  <g-answer-note>Guest fallback {{kind}}</g-answer-note>
</g-base>`

describe(`answer-blocks-struct-parser`, () => {
  it(`parses inline-button attrs with lang keys and spans preserved`, () => {
    const blocks = TemplateEngine._processGInlineButtonBlocks(inlineButtonTemplate)
    expect(blocks.default?.text).toBe(`Lihat {{item}}`)
    expect(blocks.default?.startParameter).toBe(`detail-1`)
    expect(blocks.id?.text).toBe(`Lihat {{item}} ya`)
    expect(blocks.id?.startParameter).toBeUndefined()
  })

  it(`parses answer-note children with interpolation preserved`, () => {
    const blocks = TemplateEngine._processGAnswerNoteBlocks(answerNoteTemplate)
    expect(blocks.default).toBe(`Guest fallback {{kind}}`)
  })
})

describe(`answer-blocks-struct-compile`, () => {
  it(`compiles inline-button per base and lang with interpolation`, () => {
    const compiled = TemplateEngine.compileBlockGInlineButton(inlineButtonTemplate)
    expect(compiled.inline?.default?.({item: `kopi`})).toEqual({text: `Lihat kopi`, startParameter: `detail-1`})
    expect(compiled.inline?.id?.({item: `kopi`})).toEqual({text: `Lihat kopi ya`, startParameter: undefined})
  })

  it(`compiles answer-note under its base id`, () => {
    const compiled = TemplateEngine.compileBlockGAnswerNote(answerNoteTemplate)
    expect(compiled.guest?.default?.({kind: `vip`})).toBe(`Guest fallback vip`)
  })
})

describe(`answer-blocks-struct-validate`, () => {
  it(`accepts a valid template with both new blocks`, () => {
    const result = TemplateEngine.validateTemplate(`<g-base>
  <g-inline-button text="Lihat" start-parameter="detail-1"/>
  <g-answer-note>Note</g-answer-note>
</g-base>`)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it(`rejects inline-button without text`, () => {
    const result = TemplateEngine.validateBlockGInlineButtonAttributes(`<g-base><g-inline-button start-parameter="x"/></g-base>`)
    expect(result.valid).toBe(false)
  })

  it(`rejects illegal start-parameter format`, () => {
    const result = TemplateEngine.validateBlockGInlineButtonAttributes(`<g-base><g-inline-button text="T" start-parameter="no spaces!"/></g-base>`)
    expect(result.valid).toBe(false)
  })

  it(`accepts dynamic start-parameter spans (runtime-enforced)`, () => {
    const result = TemplateEngine.validateBlockGInlineButtonAttributes(`<g-base><g-inline-button text="T" start-parameter="{{param}}"/></g-base>`)
    expect(result.valid).toBe(true)
  })

  it(`rejects HTML inside answer-note`, () => {
    const result = TemplateEngine.validateBlockGAnswerNoteAttributes(`<g-base><g-answer-note>N <b>x</b></g-answer-note></g-base>`)
    expect(result.valid).toBe(false)
  })
})

describe(`answer-blocks-manager`, () => {
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

  const fullTemplate = `<g-base id="card">
  <g-callback-answer>Tap {{x}}</g-callback-answer>
  <g-precheckout-error>No {{x}}</g-precheckout-error>
  <g-shipping-error>Far {{x}}</g-shipping-error>
  <g-inline-button text="Lihat {{x}}" start-parameter="d-1"/>
  <g-answer-note>Note {{x}}</g-answer-note>
</g-base>`

  it(`compiles and serves all five answer blocks via their getters`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`answers`, fullTemplate)
    expect(manager.getGCallbackAnswer(`answers`, `card`, `default`, {x: `A`}).text).toBe(`Tap A`)
    expect(manager.getGPrecheckoutError(`answers`, `card`, `default`, {x: `B`}).text).toBe(`No B`)
    expect(manager.getGShippingError(`answers`, `card`, `default`, {x: `C`}).text).toBe(`Far C`)
    expect(manager.getGInlineButton(`answers`, `card`, `default`, {x: `D`})).toEqual({kind: `inlineButton`, text: `Lihat D`, startParameter: `d-1`})
    expect(manager.getGAnswerNote(`answers`, `card`, `default`, {x: `E`}).text).toBe(`Note E`)
  })

  it(`throws for each missing answer block (strict, never empty)`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`empty`, `<g-base><g-message>Hi</g-message></g-base>`)
    expect(() => manager.getGCallbackAnswer(`empty`)).toThrow(/CallbackAnswer function not found/)
    expect(() => manager.getGPrecheckoutError(`empty`)).toThrow(/PrecheckoutError function not found/)
    expect(() => manager.getGShippingError(`empty`)).toThrow(/ShippingError function not found/)
    expect(() => manager.getGInlineButton(`empty`)).toThrow(/InlineButton function not found/)
    expect(() => manager.getGAnswerNote(`empty`)).toThrow(/AnswerNote function not found/)
  })
})
