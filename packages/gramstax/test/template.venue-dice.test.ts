import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {TemplateEngine} from "~/template/engine"
import {TemplateManager} from "~/template/manager"

const TEST_DIR = join(import.meta.dir, `views-venue-dice`)

const venueTemplate = `<g-base>
  <g-venue title="{{name}}" address="Jl. Merdeka 1" latitude="-6.2" longitude="106.8"/>
</g-base>`

const venueI18nTemplate = `<g-base id="promo">
  <g-venue title="Cafe" address="Jl. Merdeka 1" latitude="-6.2" longitude="106.8"/>
  <g-venue lang="id" title="Kafe {{name}}" address="Jl. Merdeka {{no}}" latitude="{{lat}}" longitude="{{long}}"/>
</g-base>`

const diceTemplate = `<g-base>
  <g-dice emoji="{{dice}}"/>
</g-base>`

const diceStaticTemplate = `<g-base id="lucky">
  <g-dice emoji="🎯"/>
  <g-dice lang="id" emoji="🏀"/>
</g-base>`

const wrapVenue = (inner: string): string => `<g-base>
  <g-venue${inner}>
</g-base>`

const wrapDice = (inner: string): string => `<g-base>
  <g-dice${inner}>
</g-base>`

describe(`venue-parser`, () => {
  it(`parses all four fields with interpolation spans preserved`, () => {
    const venues = TemplateEngine._processGVenueBlocks(venueTemplate)
    expect(venues.default?.title).toBe(`{{name}}`)
    expect(venues.default?.address).toBe(`Jl. Merdeka 1`)
    expect(venues.default?.latitude).toBe(`-6.2`)
    expect(venues.default?.longitude).toBe(`106.8`)
  })

  it(`parses the pair form identically to the self-closing form`, () => {
    const pair = TemplateEngine._processGVenueBlocks(`<g-base><g-venue title="Cafe" address="Jl. Merdeka 1" latitude="-6.2" longitude="106.8"></g-venue></g-base>`)
    const single = TemplateEngine._processGVenueBlocks(`<g-base><g-venue title="Cafe" address="Jl. Merdeka 1" latitude="-6.2" longitude="106.8"/></g-base>`)
    expect(pair).toEqual(single)
  })

  it(`keys venues by lang with last block winning`, () => {
    const venues = TemplateEngine._processGVenueBlocks(`<g-base><g-venue lang="id" title="Kafe" address="Jl. Merdeka 1" latitude="-6.2" longitude="106.8"/></g-base>`)
    expect(Object.keys(venues)).toEqual([`id`])
  })
})

describe(`dice-parser`, () => {
  it(`parses the emoji with interpolation spans preserved`, () => {
    const blocks = TemplateEngine._processGDiceBlocks(diceTemplate)
    expect(blocks.default?.emoji).toBe(`{{dice}}`)
  })

  it(`defaults a missing emoji to the dice roll`, () => {
    const blocks = TemplateEngine._processGDiceBlocks(`<g-base><g-dice/></g-base>`)
    expect(blocks.default?.emoji).toBe(`🎲`)
  })

  it(`parses the pair form identically to the self-closing form`, () => {
    const pair = TemplateEngine._processGDiceBlocks(`<g-base><g-dice emoji="🎯"></g-dice></g-base>`)
    const single = TemplateEngine._processGDiceBlocks(`<g-base><g-dice emoji="🎯"/></g-base>`)
    expect(pair).toEqual(single)
  })

  it(`keys blocks by lang with last block winning`, () => {
    const blocks = TemplateEngine._processGDiceBlocks(`<g-base><g-dice lang="id" emoji="🏀"/></g-base>`)
    expect(Object.keys(blocks)).toEqual([`id`])
  })
})

describe(`venue-validator`, () => {
  it(`accepts a valid static venue`, () => {
    expect(TemplateEngine.validateTemplate(venueTemplate).valid).toBe(true)
  })

  it(`accepts dynamic coordinates without static range checks`, () => {
    expect(TemplateEngine.validateTemplate(venueI18nTemplate).valid).toBe(true)
  })

  it(`rejects a missing title`, () => {
    const result = TemplateEngine.validateBlockGVenueAttributes(wrapVenue(` address="Jl. Merdeka 1" latitude="-6.2" longitude="106.8"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`"title" on <g-venue> is required`))).toBe(true)
  })

  it(`rejects a missing address`, () => {
    const result = TemplateEngine.validateBlockGVenueAttributes(wrapVenue(` title="Cafe" latitude="-6.2" longitude="106.8"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`"address" on <g-venue> is required`))).toBe(true)
  })

  it(`rejects missing coordinates`, () => {
    const result = TemplateEngine.validateBlockGVenueAttributes(wrapVenue(` title="Cafe" address="Jl. Merdeka 1"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`"latitude" on <g-venue> is required`))).toBe(true)
    expect(result.errors.some((e) => e.message.includes(`"longitude" on <g-venue> is required`))).toBe(true)
  })

  it(`rejects non-numeric coordinates`, () => {
    const result = TemplateEngine.validateBlockGVenueAttributes(wrapVenue(` title="Cafe" address="Jl. Merdeka 1" latitude="north" longitude="east"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`"latitude" on <g-venue> must be a number between -90 and 90`))).toBe(true)
    expect(result.errors.some((e) => e.message.includes(`"longitude" on <g-venue> must be a number between -180 and 180`))).toBe(true)
  })

  it(`rejects out-of-range coordinates`, () => {
    const result = TemplateEngine.validateBlockGVenueAttributes(wrapVenue(` title="Cafe" address="Jl. Merdeka 1" latitude="91" longitude="181"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`between -90 and 90`))).toBe(true)
    expect(result.errors.some((e) => e.message.includes(`between -180 and 180`))).toBe(true)
  })

  it(`rejects an unknown attr`, () => {
    const result = TemplateEngine.validateBlockGVenueAttributes(wrapVenue(` title="Cafe" address="Jl. Merdeka 1" latitude="-6.2" longitude="106.8" foo="1"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`Unknown attribute`))).toBe(true)
  })

  it(`surfaces venue errors through validateTemplate`, () => {
    const result = TemplateEngine.validateTemplate(wrapVenue(` title="Cafe" address="Jl. Merdeka 1" latitude="999" longitude="106.8"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`between -90 and 90`))).toBe(true)
  })
})

describe(`dice-validator`, () => {
  it(`accepts a valid static emoji`, () => {
    expect(TemplateEngine.validateTemplate(diceStaticTemplate).valid).toBe(true)
  })

  it(`accepts a missing emoji and a dynamic emoji`, () => {
    expect(TemplateEngine.validateTemplate(diceTemplate).valid).toBe(true)
    expect(TemplateEngine.validateBlockGDiceAttributes(wrapDice(`/>`)).valid).toBe(true)
    expect(TemplateEngine.validateBlockGDiceAttributes(wrapDice(` emoji=""/>`)).valid).toBe(true)
  })

  it(`rejects a static emoji outside the Bot API set`, () => {
    const result = TemplateEngine.validateBlockGDiceAttributes(wrapDice(` emoji="❌"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`must be one of 🎲🎯🏀⚽🎳🎰`))).toBe(true)
  })

  it(`rejects an unknown attr`, () => {
    const result = TemplateEngine.validateBlockGDiceAttributes(wrapDice(` emoji="🎲" foo="1"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`Unknown attribute`))).toBe(true)
  })

  it(`surfaces dice errors through validateTemplate`, () => {
    const result = TemplateEngine.validateTemplate(wrapDice(` emoji="❌"/>`))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`must be one of`))).toBe(true)
  })
})

describe(`venue-dice-positions-format`, () => {
  it(`accepts both self-closing and pair forms in the format pass`, () => {
    expect(TemplateEngine.validateFormatBlock(venueTemplate).valid).toBe(true)
    expect(TemplateEngine.validateFormatBlock(`<g-base><g-venue title="Cafe" address="Jl. Merdeka 1" latitude="-6.2" longitude="106.8"></g-venue></g-base>`).valid).toBe(true)
    expect(TemplateEngine.validateFormatBlock(diceTemplate).valid).toBe(true)
    expect(TemplateEngine.validateFormatBlock(`<g-base><g-dice emoji="🎲"></g-dice></g-base>`).valid).toBe(true)
  })

  it(`rejects a venue outside a base`, () => {
    const result = TemplateEngine.validatePositionsBlock(`<g-venue title="Cafe" address="Jl. Merdeka 1" latitude="-6.2" longitude="106.8"/>`)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`<g-venue>`))).toBe(true)
  })

  it(`rejects a dice nested inside a message`, () => {
    const result = TemplateEngine.validatePositionsBlock(`<g-base><g-message>Hi<g-dice emoji="🎲"/></g-message></g-base>`)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`<g-dice>`))).toBe(true)
  })

  it(`rejects unknown venue and dice attributes in the centralized value pass`, () => {
    expect(TemplateEngine.validatePageAttributeValuesBlock(venueTemplate).valid).toBe(true)
    const bad = TemplateEngine.validatePageAttributeValuesBlock(`<g-base><g-venue title="Cafe" address="Jl. Merdeka 1" latitude="north" longitude="106.8"/><g-dice emoji="❌"/></g-base>`)
    expect(bad.valid).toBe(false)
    expect(bad.errors.some((e) => e.message.includes(`"latitude"`))).toBe(true)
    expect(bad.errors.some((e) => e.message.includes(`"emoji"`))).toBe(true)
  })
})

describe(`venue-compiler`, () => {
  it(`interpolates every field with filters`, () => {
    const compiled = TemplateEngine.compileBlockGVenue(venueTemplate)
    const venue = compiled.default?.default?.({name: `cafe utama`})
    expect(venue?.title).toBe(`cafe utama`)
    expect(venue?.address).toBe(`Jl. Merdeka 1`)
    expect(venue?.latitude).toBe(`-6.2`)
    expect(venue?.longitude).toBe(`106.8`)
  })

  it(`compiles per-base per-language venues`, () => {
    const compiled = TemplateEngine.compileBlockGVenue(venueI18nTemplate)
    expect(compiled.promo?.default?.({})?.title).toBe(`Cafe`)
    const id = compiled.promo?.id?.({name: `pagi`, no: `10`, lat: `-6.3`, long: `106.9`})
    expect(id?.title).toBe(`Kafe pagi`)
    expect(id?.address).toBe(`Jl. Merdeka 10`)
    expect(id?.latitude).toBe(`-6.3`)
    expect(id?.longitude).toBe(`106.9`)
  })
})

describe(`dice-compiler`, () => {
  it(`interpolates the emoji`, () => {
    const compiled = TemplateEngine.compileBlockGDice(diceTemplate)
    expect(compiled.default?.default?.({dice: `🎯`})?.emoji).toBe(`🎯`)
  })

  it(`compiles per-base per-language dice`, () => {
    const compiled = TemplateEngine.compileBlockGDice(diceStaticTemplate)
    expect(compiled.lucky?.default?.({})?.emoji).toBe(`🎯`)
    expect(compiled.lucky?.id?.({})?.emoji).toBe(`🏀`)
  })
})

describe(`venue-dice-manager`, () => {
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

  it(`compiles and serves a venue via getGVenue`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`cafe`, venueTemplate)
    const venue = manager.getGVenue(`cafe`, `default`, `default`, {name: `Cafe`})
    expect(venue.title).toBe(`Cafe`)
    expect(venue.address).toBe(`Jl. Merdeka 1`)
    expect(venue.latitude).toBe(`-6.2`)
    expect(venue.longitude).toBe(`106.8`)
  })

  it(`serves a per-base per-language venue via getGVenue`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`cafe`, venueI18nTemplate)
    const venue = manager.getGVenue(`cafe`, `promo`, `id`, {name: `pagi`, no: `10`, lat: `-6.3`, long: `106.9`})
    expect(venue.title).toBe(`Kafe pagi`)
    expect(venue.address).toBe(`Jl. Merdeka 10`)
  })

  it(`throws for a missing venue`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`empty`, `<g-base><g-message>Hi</g-message></g-base>`)
    expect(() => manager.getGVenue(`empty`)).toThrow(/Venue function not found/)
  })

  it(`throws on an invalid venue template`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(() => manager.compile(`bad`, wrapVenue(` title="Cafe" address="Jl. Merdeka 1" latitude="999" longitude="106.8"/>`))).toThrow(/between -90 and 90/)
  })

  it(`compiles and serves dice via getGDice`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`lucky`, diceTemplate)
    expect(manager.getGDice(`lucky`, `default`, `default`, {dice: `🎯`}).emoji).toBe(`🎯`)
  })

  it(`serves a per-base per-language dice via getGDice`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`lucky`, diceStaticTemplate)
    expect(manager.getGDice(`lucky`, `lucky`, `id`).emoji).toBe(`🏀`)
  })

  it(`throws for a missing dice`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`empty`, `<g-base><g-message>Hi</g-message></g-base>`)
    expect(() => manager.getGDice(`empty`)).toThrow(/Dice function not found/)
  })

  it(`throws on an invalid dice template`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(() => manager.compile(`bad`, wrapDice(` emoji="❌"/>`))).toThrow(/must be one of/)
  })
})

describe(`venue-dice-item-direct-pins`, () => {
  it(`_validateVenueItems pins required fields and static ranges directly`, () => {
    expect(TemplateEngine._validateVenueItems(venueTemplate)).toEqual([])
    expect(TemplateEngine._validateVenueItems(venueI18nTemplate)).toEqual([])
    const missing = TemplateEngine._validateVenueItems(wrapVenue(` title="Cafe"/>`))
    expect(missing.some((e) => e.message.includes(`"address" on <g-venue> is required`))).toBe(true)
    expect(missing.some((e) => e.message.includes(`"latitude" on <g-venue> is required`))).toBe(true)
    expect(missing.some((e) => e.message.includes(`"longitude" on <g-venue> is required`))).toBe(true)
    const bad = TemplateEngine._validateVenueItems(wrapVenue(` title="Cafe" address="Jl. Merdeka 1" latitude="999" longitude="106.8"/>`))
    expect(bad.some((e) => e.message.includes(`between -90 and 90`))).toBe(true)
    expect(bad.every((e) => e.line === 2)).toBe(true)
  })

  it(`_validateDiceItems pins the static emoji rule directly`, () => {
    expect(TemplateEngine._validateDiceItems(diceTemplate)).toEqual([])
    expect(TemplateEngine._validateDiceItems(wrapDice(`/>`))).toEqual([])
    expect(TemplateEngine._validateDiceItems(wrapDice(` emoji=""/>`))).toEqual([])
    const bad = TemplateEngine._validateDiceItems(wrapDice(` emoji="❌"/>`))
    expect(bad.length).toBe(1)
    expect(bad[0]!.message).toContain(`must be one of 🎲🎯🏀⚽🎳🎰`)
    expect(bad[0]!.line).toBe(2)
  })
})
