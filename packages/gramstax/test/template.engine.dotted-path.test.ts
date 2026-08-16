import {describe, expect, it} from "bun:test"
import {TemplateEngine} from "~/template/engine"

const render = (template: string, data: Record<string, unknown>) => {
  const processed = TemplateEngine._processScopeVariables(TemplateEngine._processGSwitchBlocks(TemplateEngine._processGMapBlocks(template)))
  return TemplateEngine._compileToFunction(processed, false)(data)
}

describe(`dotted-path interpolation`, () => {
  it(`interpolates nested data outside g-map`, () => {
    expect(render(`Hello {{user.name}}!`, {user: {name: `Alice`}})).toBe(`Hello Alice!`)
  })

  it(`interpolates deep paths`, () => {
    expect(render(`{{user.profile.name}}`, {user: {profile: {name: `Bob`}}})).toBe(`Bob`)
  })

  it(`escapes HTML in dotted values`, () => {
    expect(render(`{{user.name}}`, {user: {name: `<b>x</b>`}})).toBe(`&lt;b&gt;x&lt;/b&gt;`)
  })

  it(`renders empty string for missing paths`, () => {
    expect(render(`[{{a.b.c}}]`, {a: {}})).toBe(`[]`)
  })

  it(`renders empty string when intermediate segment is null`, () => {
    expect(render(`[{{a.b.c}}]`, {a: null})).toBe(`[]`)
  })

  it(`keeps raw dotted path with triple braces`, () => {
    expect(render(`{{{user.name}}}`, {user: {name: `<b>bold</b>`}})).toBe(`<b>bold</b>`)
  })

  it(`keeps flat interpolation working`, () => {
    expect(render(`{{name}}`, {name: `Bob`})).toBe(`Bob`)
  })
})