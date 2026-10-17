import {describe, expect, it} from "bun:test"
import {TemplateEngine} from "../src/template/engine"
import {TemplateManager} from "../src/template/manager"

const data = {
  rows: [
    {name: "alice", tags: [{t: "x"}, {t: "y"}]},
    {name: "bob", tags: [{t: "z"}]}
  ],
  title: "Report"
}

const map = (body: string): string => `<g-base><g-message><g-map src="rows">${body}</g-map></g-message></g-base>`

const render = (tpl: string, scope: Record<string, unknown> = data): string => {
  const manager = new TemplateManager({path: []})
  manager.compile("t", tpl)
  const fn = manager.getCompiled("t")?.message?.default?.default
  return fn?.(scope as never)?.text ?? ``
}

describe(`g-map ordinal`, () => {
  it(`should expose a 1-based ordinal alongside the 0-based index`, () => {
    expect(render(map(`{{i}}`))).toBe(`0\n1`)
    expect(render(map(`{{ord}}`))).toBe(`1\n2`)
  })

  it(`should replace the AOT-blocked {~ i - -1 ~} idiom`, () => {
    expect(render(map(`Position: {{ord}}`))).toBe(`Position: 1\nPosition: 2`)
  })

  it(`should support the raw form`, () => {
    expect(render(map(`{{{ord}}}`))).toBe(`1\n2`)
  })

  it(`should accept a filter on the ordinal`, () => {
    expect(render(map(`{{ord|number:2}}`))).toBe(`1.00\n2.00`)
  })

  it(`should combine with the element`, () => {
    expect(render(map(`{{ord}}. {{e.name}}`))).toBe(`1. alice\n2. bob`)
  })

  it(`should stay scoped to g-map so data.ord still resolves outside`, () => {
    expect(render(`<g-base><g-message>{{ord}}</g-message></g-base>`, {ord: `DATA-ORD`})).toBe(`DATA-ORD`)
    expect(render(map(`{{ord}}`), {rows: [{name: "a"}], ord: `DATA-ORD`})).toBe(`1`)
  })

  it(`should bind per depth in nested maps`, () => {
    expect(render(`<g-base><g-message><g-map src="rows"><g-map src="e.tags">{{ord2}}{{e2.t}}</g-map></g-map></g-message></g-base>`)).toBe(`1x\n2y\n1z`)
  })

  it(`should emit an ord binding with no scope and no with(`, () => {
    const processed = TemplateEngine._processGMapBlocks(`<g-map src="rows">{{ord}}</g-map>`)
    expect(processed).toContain(`const ord = i + 1;`)
    expect(processed).not.toContain(`with(`)
  })
})

describe(`g-map filter pipes`, () => {
  it(`should apply a filter to an element property`, () => {
    expect(render(map(`{{e.name|upper}}`))).toBe(`ALICE\nBOB`)
  })

  it(`should apply a filter to the loop index instead of reading data.i`, () => {
    // Regression: the pipe was dropped, the chain fell through to `data.i`, and every
    // row rendered the same number.
    expect(render(map(`{{i|number:2}}`))).toBe(`0.00\n1.00`)
  })

  it(`should apply an argument-taking filter to a loop variable`, () => {
    expect(render(map(`{{e.tags.length|number:3}}`))).toBe(`2.000\n1.000`)
  })

  it(`should leave the unfiltered forms untouched`, () => {
    expect(render(map(`{{e.name}}`))).toBe(`alice\nbob`)
    expect(render(map(`{{i}}`))).toBe(`0\n1`)
  })

  it(`should still apply filters to plain data keys inside g-map`, () => {
    expect(render(map(`{{title|upper}}`))).toBe(`REPORT\nREPORT`)
  })

  it(`should support the raw form`, () => {
    expect(render(map(`{{{e.name|upper}}}`))).toBe(`ALICE\nBOB`)
  })

  it(`should keep a dotted chain reachable under a filter`, () => {
    expect(render(map(`{{e.name}}`))).toBe(`alice\nbob`)
    expect(render(map(`{{e.tags.length}}`))).toBe(`2\n1`)
  })

  it(`should render empty and warn once for a filter outside the whitelist`, () => {
    const warnings: string[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]): void => {
      warnings.push(args.map((arg) => String(arg)).join(` `))
    }
    try {
      expect(render(map(`{{e.name|bogus}}`))).toBe(`\n`)
    } finally {
      console.warn = originalWarn
    }
    expect(warnings.filter((line) => line.includes(`bogus`)).length).toBe(1)
  })

  it(`should still resolve nested depth references`, () => {
    expect(render(`<g-base><g-message><g-map src="rows"><g-map src="e.tags">{{e2.t}}</g-map></g-map></g-message></g-base>`)).toBe(`x\ny\nz`)
  })

  it(`should filter a nested depth reference`, () => {
    expect(render(`<g-base><g-message><g-map src="rows"><g-map src="e.tags">{{e2.t|upper}}</g-map></g-map></g-message></g-base>`)).toBe(`X\nY\nZ`)
  })

  it(`should accept a pipe in a join-bearing map without breaking the split guard`, () => {
    expect(render(`<g-base><g-message><g-map src="rows" join=", ">{{e.name|upper}}</g-map></g-message></g-base>`)).toBe(`ALICE, BOB`)
  })
})