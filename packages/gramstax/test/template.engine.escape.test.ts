import {describe, expect, it} from "bun:test"
import {TemplateEngine} from "~/template/engine"

const render = (template: string, data: Record<string, unknown>) => {
  const processed = TemplateEngine._processScopeVariables(TemplateEngine._processGSwitchBlocks(TemplateEngine._processGMapBlocks(template)))
  return TemplateEngine._compileToFunction(processed, false)(data)
}

describe(`TemplateEngine HTML escaping (K3)`, () => {
  it(`escapes < > & in {{var}} values`, () => {
    expect(render(`{{x}}`, {x: `<b>hello & bye</b>`})).toBe(`&lt;b&gt;hello &amp; bye&lt;/b&gt;`)
  })

  it(`escapes {{var}} in g-map loop items`, () => {
    expect(render(`<g-map src="items" join=", ">{{e.name}}</g-map>`, {items: [{name: `<b>a</b>`}]})).toBe(`&lt;b&gt;a&lt;/b&gt;`)
  })

  it(`keeps {{{var}}} raw`, () => {
    expect(render(`{{{x}}}`, {x: `<b>bold</b>`})).toBe(`<b>bold</b>`)
  })

  it(`keeps {{{var}}} raw inside g-map`, () => {
    expect(render(`<g-map src="items" join=", ">{{{e.name}}}</g-map>`, {items: [{name: `<b>a</b>`}]})).toBe(`<b>a</b>`)
  })

  it(`renders non-string and missing values without crashing`, () => {
    expect(render(`{{n}}|{{u}}`, {n: 42})).toBe(`42|`)
  })

  it(`escapes only the value, not the template literal`, () => {
    expect(render(`x{{y}}z`, {y: `1\\2\``})).toBe(`x1\\2\`z`)
  })
})