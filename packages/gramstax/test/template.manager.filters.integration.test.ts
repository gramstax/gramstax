import {describe, expect, it} from "bun:test"
import {mkdtempSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {TemplateManager} from "~/template/manager"

const makeManager = (files: Array<[string, string]>) => {
  const dir = mkdtempSync(join(tmpdir(), `gramstax-filters-`))
  for (const [name, content] of files) {
    writeFileSync(join(dir, name), content)
  }
  return new TemplateManager({path: [dir]})
}

describe(`filter pipes — full TemplateManager integration`, () => {
  it(`renders formatted pipes through the real loader + compiler pipeline`, () => {
    const manager = makeManager([
      [
        `filters.html`,
        `
        <g-base>
          <g-message>Price {{price|number:2}} on {{d|date:YYYY-MM-DD}}: {{count|plural:item:items}} — {{name|upper|default:N/A}}</g-message>
        </g-base>
        `
      ]
    ])
    const out = manager.getGMessage(`filters`, `default`, `default`, {
      price: 12.3456,
      d: `2026-08-15T00:00:00Z`,
      count: 1,
      name: `alice`
    })
    expect(out.text).toBe(`Price 12.35 on 2026-08-15: item — ALICE`)
  })

  it(`plural picks many for non-1 counts`, () => {
    const manager = makeManager([[`plural.html`, `<g-base><g-message>{{count|plural:item:items}}</g-message></g-base>`]])
    expect(manager.getGMessage(`plural`, `default`, `default`, {count: 3}).text).toBe(`items`)
  })

  it(`chained default applies when value is missing`, () => {
    const manager = makeManager([[`chain.html`, `<g-base><g-message>{{name|upper|default:N/A}}</g-message></g-base>`]])
    expect(manager.getGMessage(`chain`, `default`, `default`, {}).text).toBe(`N/A`)
  })

  it(`escapes filter output in {{}} scope`, () => {
    const manager = makeManager([[`escape.html`, `<g-base><g-message>{{name|upper}}</g-message></g-base>`]])
    expect(manager.getGMessage(`escape`, `default`, `default`, {name: `<b>`}).text).toBe(`&lt;B&gt;`)
  })

  it(`raw {{{var|filter}}} scope does not escape`, () => {
    const manager = makeManager([[`raw.html`, `<g-base><g-message>{{{name|upper}}}</g-message></g-base>`]])
    expect(manager.getGMessage(`raw`, `default`, `default`, {name: `<b>`}).text).toBe(`<B>`)
  })

  it(`unknown filter renders empty in the real pipeline`, () => {
    const manager = makeManager([[`unknown.html`, `<g-base><g-message>[{{name|nope}}]</g-message></g-base>`]])
    expect(manager.getGMessage(`unknown`, `default`, `default`, {name: `x`}).text).toBe(`[]`)
  })
})