import {describe, it, expect} from "bun:test"
import {TemplateEngine} from "~/template/engine"

describe(`TemplateEngine map block`, () => {
  it(`renders array items with join`, () => {
    const template = `<map src="items" join=", ">{{e}}-{{i}}</map>`
    const processed = TemplateEngine._processMapBlocks(template)
    const fn = TemplateEngine._compileToFunction(processed, false)
    const result = fn({items: [`a`, `b`, `c`]})

    expect(result).toBe(`a-0, b-1, c-2`)
  })
})
