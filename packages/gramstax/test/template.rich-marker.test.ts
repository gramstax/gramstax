import {describe, expect, it} from "bun:test"
import {TemplateManager} from "~/template/manager"

const compile = (key: string, template: string): TemplateManager => {
  const manager = new TemplateManager({path: []})
  manager.compile(key, template)
  return manager
}

describe(`g-message rich marker`, () => {
  it(`leaves legacy-only blocks with rich false`, () => {
    const manager = compile(`legacy`, `<g-base><g-message><b>Bold</b> <i>italic</i> <code>c</code> for {{name}}</g-message></g-base>`)
    expect(manager.getGMessage(`legacy`, `default`, `default`, {name: `ann`}).rich).toBe(false)
  })

  it(`marks a block using <h1> as rich`, () => {
    const manager = compile(`heading`, `<g-base><g-message><h1>Title</h1>body</g-message></g-base>`)
    expect(manager.getGMessage(`heading`).rich).toBe(true)
  })

  it(`marks a block using <table> as rich`, () => {
    const manager = compile(`table`, `<g-base><g-message><table><tr><td>cell</td></tr></table></g-message></g-base>`)
    expect(manager.getGMessage(`table`).rich).toBe(true)
  })

  it(`marks a block using <tg-math> as rich`, () => {
    const manager = compile(`math`, `<g-base><g-message><tg-math>x + y</tg-math></g-message></g-base>`)
    expect(manager.getGMessage(`math`).rich).toBe(true)
  })

  it(`marks a block mixing legacy and rich tags as rich`, () => {
    const manager = compile(`mixed`, `<g-base><g-message><b>Bold</b><hr/>after</g-message></g-base>`)
    expect(manager.getGMessage(`mixed`).rich).toBe(true)
  })

  it(`marks a rich tag with attributes as rich (whitespace boundary)`, () => {
    const manager = compile(`attrs`, `<g-base><g-message><tg-emoji emoji-id="5368324170671202286">🎉</tg-emoji></g-message></g-base>`)
    expect(manager.getGMessage(`attrs`).rich).toBe(true)
  })

  it(`matches rich tags case-insensitively`, () => {
    const manager = compile(`upper`, `<g-base><g-message><H1>Title</H1>body</g-message></g-base>`)
    expect(manager.getGMessage(`upper`).rich).toBe(true)
  })

  it(`keeps the rendered text byte-identical to the pre-change string output`, () => {
    const manager = compile(`bytes`, `<g-base><g-message><b>Bold</b> <i>italic</i> <code>c</code> for {{name}}</g-message></g-base>`)
    // Hand-derived from the pre-change compiled leaf: interpolation only replaces
    // the {{name}} span, every marker/tag byte passes through untouched.
    expect(manager.getGMessage(`bytes`, `default`, `default`, {name: `ann`})).toEqual({kind: `message`, text: `<b>Bold</b> <i>italic</i> <code>c</code> for ann`, rich: false})
  })

  it(`returns the empty fallback instead of throwing when the message block is missing`, () => {
    const manager = new TemplateManager({path: []})
    expect(manager.getGMessage(`missing`)).toEqual({kind: `message`, text: ``, rich: false})
  })
})
