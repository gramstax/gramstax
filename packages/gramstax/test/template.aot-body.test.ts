import {afterEach, describe, expect, it} from "bun:test"
import {TemplateEngine} from "~/template/engine"

const RealFunction = globalThis.Function
let capturedBodies: string[] = []
let capturedCalls: unknown[][] = []

function installFunctionSpy(): void {
  capturedBodies = []
  capturedCalls = []
  const spy = function (this: unknown, ...args: string[]): unknown {
    const body = args[args.length - 1] as string
    const real = Reflect.construct(RealFunction, args) as (...callArgs: unknown[]) => unknown
    const wrapped = (...callArgs: unknown[]): unknown => {
      capturedCalls.push(callArgs)
      return real(...callArgs)
    }
    capturedBodies.push(body)
    return wrapped
  }
  globalThis.Function = spy as unknown as FunctionConstructor
}

function restoreFunction(): void {
  globalThis.Function = RealFunction
}

function processTemplate(template: string): string {
  return TemplateEngine._processScopeVariables(TemplateEngine._processScopeExec(TemplateEngine._processGSwitchBlocks(TemplateEngine._processGMapBlocks(template))))
}

function lastBody(): string {
  return capturedBodies[capturedBodies.length - 1] as string
}

function lastTriple(): [unknown, unknown, unknown] {
  return capturedCalls[capturedCalls.length - 1] as [unknown, unknown, unknown]
}

function checkSingle(template: string, data: Record<string, unknown>): string {
  installFunctionSpy()
  try {
    const processed = processTemplate(template)
    const expected = TemplateEngine._compileToFunction(processed, false)(data)
    const body = lastBody()
    expect(body).toBe(TemplateEngine._buildFunctionBody(processed, false))
    const run = new RealFunction(`data`, `__esc`, `FILTERS`, body) as unknown as (...callArgs: [unknown, unknown, unknown]) => string
    expect(run(...lastTriple())).toBe(expected)
    return expected
  } finally {
    restoreFunction()
  }
}

function checkArray(templates: string[], data: Record<string, unknown>): string[] {
  installFunctionSpy()
  try {
    const processed = templates.map(processTemplate)
    const expected = TemplateEngine._compileToFunction(processed, true)(data)
    const body = lastBody()
    expect(body).toBe(TemplateEngine._buildFunctionBody(processed, true))
    const run = new RealFunction(`data`, `__esc`, `FILTERS`, body) as unknown as (...callArgs: [unknown, unknown, unknown]) => string[]
    expect(run(...lastTriple())).toEqual(expected)
    return expected
  } finally {
    restoreFunction()
  }
}

afterEach(() => {
  restoreFunction()
})

describe(`_buildFunctionBody JIT parity`, () => {
  it(`filter pipes`, () => {
    expect(checkSingle(`Hello {{name|upper}}, you have {{count|plural:message:messages}}`, {count: 3, name: `alice`})).toBe(`Hello ALICE, you have messages`)
  })

  it(`dotted paths`, () => {
    expect(checkSingle(`{{user.name}} lives in {{user.address.city}}`, {user: {address: {city: `Bandung`}, name: `Budi`}})).toBe(`Budi lives in Bandung`)
  })

  it(`switch blocks`, () => {
    const template = `<g-switch value="status"><g-case is="active">ON</g-case><g-default>OFF</g-default></g-switch>`
    expect(checkSingle(template, {status: `active`})).toBe(`ON`)
    expect(checkSingle(template, {status: `idle`})).toBe(`OFF`)
  })

  it(`map blocks`, () => {
    expect(checkSingle(`<g-map src="items" join=", ">{{e.name}}</g-map>`, {items: [{name: `a`}, {name: `b`}]})).toBe(`a, b`)
  })

  it(`multiple langs`, () => {
    expect(checkSingle(`{{greet}}, {{name}}!`, {greet: `Hello`, name: `Ann`})).toBe(`Hello, Ann!`)
    expect(checkSingle(`{{greet}}, {{name}}!`, {greet: `Halo`, name: `Budi`})).toBe(`Halo, Budi!`)
  })

  it(`array mode`, () => {
    expect(checkArray([`Hi {{name}}`, `Bye {{name|lower}}`], {name: `ZED`})).toEqual([`Hi ZED`, `Bye zed`])
  })
})
