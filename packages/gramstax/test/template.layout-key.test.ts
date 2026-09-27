import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {TemplateManager} from "~/template/manager"
import type {ITLayoutFragment} from "~/types/t.template"

const TEST_DIR = join(import.meta.dir, `views-layout`)

describe(`layout keys`, () => {
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

  it(`layoutKey prefixes a group with the reserved namespace`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(manager.layoutKey(`admin`)).toBe(`_layout:admin`)
  })

  it(`isLayoutKey detects reserved keys only`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(manager.isLayoutKey(`_layout:admin`)).toBe(true)
    expect(manager.isLayoutKey(`admin`)).toBe(false)
    expect(manager.isLayoutKey(`_layout:`)).toBe(false)
  })

  it(`compileLayout stores a fragment readable via getGMessage`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compileLayout(`admin`, `<g-base><g-message>NAV</g-message></g-base>`)
    expect(manager.hasLayout(`admin`)).toBe(true)
    expect(manager.getGMessage(`_layout:admin`)).toBe(`NAV`)
  })

  it(`compileLayout throws on unsafe groups`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    const bad = `<g-base><g-message>x</g-message></g-base>`
    expect(() => manager.compileLayout(`a/b`, bad)).toThrow()
    expect(() => manager.compileLayout(`a.b`, bad)).toThrow()
    expect(() => manager.compileLayout(``, bad)).toThrow()
  })

  it(`ITLayoutFragment shapes the compile input`, () => {
    const frag: ITLayoutFragment = {template: `<g-base><g-message>x</g-message></g-base>`}
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compileLayout(`shop`, frag.template)
    expect(manager.hasLayout(`shop`)).toBe(true)
  })
})
