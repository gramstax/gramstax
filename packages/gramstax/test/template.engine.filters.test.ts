import {describe, expect, it} from "bun:test"
import {TemplateEngine} from "~/template/engine"

const render = (template: string, data: Record<string, unknown>) => {
  const processed = TemplateEngine._processScopeVariables(TemplateEngine._processGSwitchBlocks(TemplateEngine._processGMapBlocks(template)))
  return TemplateEngine._compileToFunction(processed, false)(data)
}

describe(`filter pipes (Tier 2)`, () => {
  it(`upper/lower`, () => {
    expect(render(`{{name|upper}}`, {name: `alice`})).toBe(`ALICE`)
    expect(render(`{{name|lower}}`, {name: `ALICE`})).toBe(`alice`)
  })

  it(`number with decimals`, () => {
    expect(render(`{{price|number:2}}`, {price: 12.3456})).toBe(`12.35`)
  })

  it(`date with format`, () => {
    expect(render(`{{d|date:YYYY-MM-DD}}`, {d: `2026-08-15T00:00:00Z`})).toBe(`2026-08-15`)
  })

  it(`plural`, () => {
    expect(render(`{{n|plural:item:items}}`, {n: 1})).toBe(`item`)
    expect(render(`{{n|plural:item:items}}`, {n: 3})).toBe(`items`)
  })

  it(`chained filters`, () => {
    expect(render(`{{name|upper|default:N/A}}`, {})).toBe(`N/A`)
  })

  it(`escapes filter output`, () => {
    expect(render(`{{name|upper}}`, {name: `<b>`})).toBe(`&lt;B&gt;`)
  })

  it(`works with dotted paths`, () => {
    expect(render(`{{user.name|upper}}`, {user: {name: `alice`}})).toBe(`ALICE`)
  })

  it(`raw scope supports pipes without escaping`, () => {
    expect(render(`{{{name|upper}}}`, {name: `<b>`})).toBe(`<B>`)
  })

  it(`unknown filter renders empty`, () => {
    expect(render(`{{name|nope}}`, {name: `x`})).toBe(``)
  })
})