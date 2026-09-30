import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {__esc, FILTERS} from "~/index"
import {TemplateEngine} from "~/template/engine"
import {TemplateManager} from "~/template/manager"
import type {ICompiledTemplate} from "~/types/template"

const TEMPLATE = [`<g-base>`, `  <g-message>Hello {{name|upper}}!</g-message>`, `  <g-keyboard>`, `    <g-map src="rows">{{e.name}}</g-map>`, `  </g-keyboard>`, `</g-base>`].join(`\n`)

const DATA = {name: `ann`, rows: [{name: `Alice`}, {name: `Bob`}]}

let dir: string

function buildCompiled(template: string): ICompiledTemplate {
  const baseBlocks = TemplateEngine._processGBaseBlocks(template)
  return {
    keyboard: TemplateEngine.compileBlockGKeyboards(template, baseBlocks),
    message: TemplateEngine.compileBlockGMessage(template, baseBlocks)
  } as unknown as ICompiledTemplate
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), `register-compiled-`))
})

afterEach(() => {
  rmSync(dir, {force: true, recursive: true})
})

describe(`_registerCompiled`, () => {
  it(`barrel exposes runtime helpers for generated code`, () => {
    expect(__esc).toBe(TemplateEngine._escapeData)
    expect(typeof FILTERS.upper).toBe(`function`)
    expect(FILTERS.upper?.(`a`)).toBe(`A`)
    expect(__esc(`<b>`)).toBe(`&lt;b&gt;`)
  })

  it(`register-then-render equals compile-then-render`, () => {
    const viaCompile = new TemplateManager({path: [dir]})
    viaCompile._compile(`jit`, TEMPLATE)
    const viaRegister = new TemplateManager({path: [dir]})
    viaRegister._registerCompiled(`aot`, buildCompiled(TEMPLATE))
    expect(viaRegister.getGMessage(`aot`, `default`, `default`, DATA)).toBe(viaCompile.getGMessage(`jit`, `default`, `default`, DATA))
    expect(viaRegister.getGKeyboard(`aot`, `default`, `default`, `inline`, DATA)).toEqual(viaCompile.getGKeyboard(`jit`, `default`, `default`, `inline`, DATA))
    expect(viaRegister.getGMessage(`aot`, `default`, `default`, DATA)).toContain(`ANN`)
    expect(viaRegister.getGKeyboard(`aot`, `default`, `default`, `inline`, DATA)).toEqual([`Alice\nBob`])
  })

  it(`fills _map with no validation and no reload`, () => {
    let reloads = 0
    const manager = new TemplateManager({
      path: [dir],
      onReload: () => {
        reloads += 1
      }
    })
    let validations = 0
    const original = manager._validateTemplate.bind(manager)
    manager._validateTemplate = ((...args: Parameters<typeof manager._validateTemplate>): void => {
      validations += 1
      original(...args)
    }) as typeof manager._validateTemplate
    manager._registerCompiled(`aot`, buildCompiled(TEMPLATE))
    expect((manager as unknown as {_map: Map<string, unknown>})._map.has(`aot`)).toBe(true)
    expect(validations).toBe(0)
    expect(reloads).toBe(0)
    expect(manager.getGMessage(`aot`, `default`, `default`, DATA)).toContain(`ANN`)
  })
})
