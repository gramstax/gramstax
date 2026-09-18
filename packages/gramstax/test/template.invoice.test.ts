import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {TemplateEngine} from "~/template/engine"
import {TemplateManager} from "~/template/manager"

const TEST_DIR = join(import.meta.dir, `views-invoice`)

const starsTemplate = `<g-base>
  <g-invoice title="VIP {{days}} hari" description="Akses semua konten" payload="{{orderId}}" currency="XTR">
    <g-price label="VIP {{days}} hari" amount="100"/>
  </g-invoice>
</g-base>`

const fiatTemplate = `<g-base>
  <g-invoice title="Pro plan" description="Monthly access" payload="order-2" currency="USD">
    <g-price label="Pro" amount="499"/>
    <g-price label="Tax" amount="50"/>
  </g-invoice>
</g-base>`

const full = (attrs: string, prices = `<g-price label="VIP" amount="100"/>`): string => `<g-base>
  <g-invoice ${attrs}>${prices}</g-invoice>
</g-base>`

const validAttrs = `title="VIP" description="Akses" payload="o-1" currency="XTR"`

describe(`invoice-parser`, () => {
  it(`parses a stars invoice with defaults`, () => {
    const invoices = TemplateEngine._processGInvoiceBlocks(starsTemplate)
    expect(invoices.default?.title).toBe(`VIP {{days}} hari`)
    expect(invoices.default?.description).toBe(`Akses semua konten`)
    expect(invoices.default?.payload).toBe(`{{orderId}}`)
    expect(invoices.default?.currency).toBe(`XTR`)
    expect(invoices.default?.prices).toEqual([{label: `VIP {{days}} hari`, amount: 100}])
  })

  it(`parses a fiat invoice with two prices`, () => {
    const invoices = TemplateEngine._processGInvoiceBlocks(fiatTemplate)
    expect(invoices.default?.currency).toBe(`USD`)
    expect(invoices.default?.prices).toEqual([{label: `Pro`, amount: 499}, {label: `Tax`, amount: 50}])
  })

  it(`keys invoices by lang`, () => {
    const invoices = TemplateEngine._processGInvoiceBlocks(`<g-base><g-invoice lang="id" title="VIP" description="Akses" payload="o-1" currency="XTR"><g-price label="VIP" amount="100"/></g-invoice></g-base>`)
    expect(Object.keys(invoices)).toEqual([`id`])
  })

  it(`parses single-quoted and bare attributes`, () => {
    const invoices = TemplateEngine._processGInvoiceBlocks(`<g-base><g-invoice title='VIP' description=Akses payload="o-1" currency='XTR'><g-price label='VIP' amount='100'/></g-invoice></g-base>`)
    expect(invoices.default?.title).toBe(`VIP`)
    expect(invoices.default?.description).toBe(`Akses`)
    expect(invoices.default?.prices).toEqual([{label: `VIP`, amount: 100}])
  })

  it(`parses an invoice without attributes into empty fields`, () => {
    const invoices = TemplateEngine._processGInvoiceBlocks(`<g-base><g-invoice><g-price label="A" amount="1"/></g-invoice></g-base>`)
    expect(invoices.default?.title).toBe(``)
    expect(invoices.default?.currency).toBe(``)
    expect(invoices.default?.prices).toEqual([{label: `A`, amount: 1}])
  })

  it(`keeps a non-numeric amount as NaN for the validator`, () => {
    const invoices = TemplateEngine._processGInvoiceBlocks(full(validAttrs, `<g-price label="VIP" amount="abc"/>`))
    expect(Number.isNaN(invoices.default?.prices[0]?.amount)).toBe(true)
  })
})

describe(`invoice-validator`, () => {
  it(`accepts a valid stars invoice`, () => {
    expect(TemplateEngine.validateTemplate(starsTemplate).valid).toBe(true)
  })

  it(`accepts a valid fiat invoice`, () => {
    expect(TemplateEngine.validateTemplate(fiatTemplate).valid).toBe(true)
  })

  it(`rejects a missing title`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(`description="Akses" payload="o-1" currency="XTR"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`"title"`))).toBe(true)
  })

  it(`rejects a missing description`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(`title="VIP" payload="o-1" currency="XTR"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`"description"`))).toBe(true)
  })

  it(`rejects a missing payload`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(`title="VIP" description="Akses" currency="XTR"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`"payload"`))).toBe(true)
  })

  it(`rejects a missing currency`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(`title="VIP" description="Akses" payload="o-1"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`"currency"`))).toBe(true)
  })

  it(`rejects provider_token with a secrets-must-come-from-options message`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(`${validAttrs} provider_token="secret"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`provider_token`) && e.message.includes(`never templates`))).toBe(true)
  })

  it(`rejects zero prices`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(validAttrs, ``))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`at least one <g-price>`))).toBe(true)
  })

  it(`rejects a price without label`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(validAttrs, `<g-price amount="100"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`"label" on <g-price> is required`))).toBe(true)
  })

  it(`rejects a price without amount`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(validAttrs, `<g-price label="VIP"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`"amount" on <g-price> is required`))).toBe(true)
  })

  it(`rejects a zero amount`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(validAttrs, `<g-price label="VIP" amount="0"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`positive integer`))).toBe(true)
  })

  it(`rejects a non-integer amount`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(validAttrs, `<g-price label="VIP" amount="1.5"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`positive integer`))).toBe(true)
  })

  it(`rejects a bad currency code`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(`title="VIP" description="Akses" payload="o-1" currency="usd"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`3-letter code`))).toBe(true)
  })

  it(`accepts a dynamic currency without static format check`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(`title="VIP" description="Akses" payload="o-1" currency="{{cur}}"`))
    expect(result.valid).toBe(true)
  })

  it(`rejects an unknown attr on g-invoice`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(`${validAttrs} foo="1"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`Unknown attribute`))).toBe(true)
  })

  it(`rejects an unknown attr on g-price`, () => {
    const result = TemplateEngine.validateBlockGPriceAttributes(full(validAttrs, `<g-price label="VIP" amount="100" foo="1"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`Unknown attribute`))).toBe(true)
  })

  it(`rejects a bad amount value on g-price`, () => {
    const result = TemplateEngine.validateBlockGPriceAttributes(full(validAttrs, `<g-price label="VIP" amount="abc"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`positive integer`))).toBe(true)
  })

  it(`accepts a valid g-price`, () => {
    expect(TemplateEngine.validateBlockGPriceAttributes(`<g-price label="VIP" amount="100"/>`).valid).toBe(true)
  })

  it(`rejects static title overflow`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(`title="${`T`.repeat(33)}" description="Akses" payload="o-1" currency="XTR"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`1-32`))).toBe(true)
  })

  it(`rejects static description overflow`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(`title="VIP" description="${`D`.repeat(256)}" payload="o-1" currency="XTR"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`1-255`))).toBe(true)
  })

  it(`rejects static payload overflow in bytes`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(`title="VIP" description="Akses" payload="${`P`.repeat(129)}" currency="XTR"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`1-128 bytes`))).toBe(true)
  })

  it(`measures payload in bytes not characters`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(`title="VIP" description="Akses" payload="${`é`.repeat(65)}" currency="XTR"`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`1-128 bytes`))).toBe(true)
  })

  it(`skips static length checks for dynamic values`, () => {
    const result = TemplateEngine.validateBlockGInvoiceAttributes(full(`title="{{t}}" description="{{d}}" payload="{{p}}" currency="{{cur}}"`))
    expect(result.valid).toBe(true)
  })

  it(`rejects a self-closing g-invoice`, () => {
    const result = TemplateEngine.validateFormatBlock(`<g-base><g-invoice title="VIP" description="Akses" payload="o-1" currency="XTR"/></g-base>`)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`must not be self-closing`))).toBe(true)
  })

  it(`rejects a g-price outside g-invoice`, () => {
    const result = TemplateEngine.validatePositionsBlock(`<g-base><g-message><g-price label="VIP" amount="100"/></g-message></g-base>`)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`<g-price>`))).toBe(true)
  })

  it(`rejects a g-invoice outside g-base`, () => {
    const result = TemplateEngine.validatePositionsBlock(`<g-base><g-message>Hi</g-message></g-base><g-invoice title="VIP" description="Akses" payload="o-1" currency="XTR"><g-price label="VIP" amount="100"/></g-invoice>`)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`<g-invoice>`))).toBe(true)
  })
})

describe(`invoice-compiler`, () => {
  it(`interpolates title description payload and labels with filters`, () => {
    const compiled = TemplateEngine.compileBlockGInvoice(starsTemplate)
    const invoice = compiled.default?.default?.({days: 30, orderId: `o-1`})
    expect(invoice?.title).toBe(`VIP 30 hari`)
    expect(invoice?.description).toBe(`Akses semua konten`)
    expect(invoice?.payload).toBe(`o-1`)
    expect(invoice?.currency).toBe(`XTR`)
    expect(invoice?.prices).toEqual([{label: `VIP 30 hari`, amount: 100}])
  })

  it(`applies filters inside labels`, () => {
    const compiled = TemplateEngine.compileBlockGInvoice(full(`title="VIP {{plan|upper}}" description="Akses" payload="o-1" currency="XTR"`, `<g-price label="{{plan|upper}}" amount="100"/>`))
    const invoice = compiled.default?.default?.({plan: `vip`})
    expect(invoice?.title).toBe(`VIP VIP`)
    expect(invoice?.prices).toEqual([{label: `VIP`, amount: 100}])
  })

  it(`compiles per-lang variants`, () => {
    const compiled = TemplateEngine.compileBlockGInvoice(`<g-base><g-invoice title="VIP" description="Access" payload="o-1" currency="XTR"><g-price label="VIP" amount="100"/></g-invoice><g-invoice lang="id" title="VIP" description="Akses" payload="o-1" currency="XTR"><g-price label="VIP" amount="100"/></g-invoice></g-base>`)
    expect(compiled.default?.default?.({})?.description).toBe(`Access`)
    expect(compiled.default?.id?.({})?.description).toBe(`Akses`)
  })
})

describe(`invoice-manager`, () => {
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

  it(`compiles and serves an invoice via getGInvoice`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager._compile(`stars`, starsTemplate)
    const invoice = manager.getGInvoice(`stars`, `default`, `default`, {days: 30, orderId: `o-1`})
    expect(invoice.title).toBe(`VIP 30 hari`)
    expect(invoice.payload).toBe(`o-1`)
    expect(invoice.currency).toBe(`XTR`)
    expect(invoice.prices).toEqual([{label: `VIP 30 hari`, amount: 100}])
  })

  it(`throws for a missing invoice`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager._compile(`empty`, `<g-base><g-message>Hi</g-message></g-base>`)
    expect(() => manager.getGInvoice(`empty`)).toThrow(/Invoice function not found/)
  })

  it(`throws on an invoice with a provider_token`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(() => manager._compile(`bad`, full(`${validAttrs} provider_token="secret"`))).toThrow(/never templates/)
  })

  it(`throws on an invoice without prices`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(() => manager._compile(`bad`, full(validAttrs, ``))).toThrow(/at least one <g-price>/)
  })
})
