import {describe, expect, it} from "bun:test"
import {LmdbError} from "../src/errors"
import {type KeyOf, LmdbSchema, t, type ValueOf} from "../src/schema"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
function assertType<T extends true>(): T {
  return true as T
}

describe(`t.enum — homogen multi-kind (string|number|bigint)`, () => {
  it(`narrows ValueOf per kind`, () => {
    assertType<Equal<ValueOf<typeof StrEnumSchema>, {status: `a` | `b`}>>()
    assertType<Equal<ValueOf<typeof NumEnumSchema>, {level: 1 | 2}>>()
    assertType<Equal<ValueOf<typeof BigEnumSchema>, {seq: 1n | 2n}>>()
  })

  it(`works as static key`, () => {
    const k: KeyOf<typeof EnumKeySchema> = `x`
    expect(k).toBe(`x`)
  })

  it(`stores enumValues at runtime + survives modifiers`, () => {
    expect(t.enum(`a`, `b`).enumValues).toEqual([`a`, `b`])
    expect(t.enum(1, 2).enumValues).toEqual([1, 2])
    expect(t.enum(1n, 2n).enumValues).toEqual([1n, 2n])
    expect(t.enum(`a`, `b`).unique().enumValues).toEqual([`a`, `b`])
    expect(t.enum(`a`, `b`).index().enumValues).toEqual([`a`, `b`])
    expect(t.enum(`a`, `b`).optional().enumValues).toEqual([`a`, `b`])
  })

  it(`throws on empty call`, () => {
    expect(() => (t.enum as (...args: Array<unknown>) => unknown)()).toThrow(LmdbError)
  })

  it(`throws on heterogen mixed kinds`, () => {
    expect(() => (t.enum as (...args: Array<unknown>) => unknown)(`a`, 1)).toThrow(LmdbError)
    expect(() => (t.enum as (...args: Array<unknown>) => unknown)(1, 2n)).toThrow(LmdbError)
  })
})

class StrEnumSchema extends LmdbSchema {
  static db = `t-enum-str`
  static key = t.number()
  static value = {status: t.enum(`a`, `b`)}
}

class NumEnumSchema extends LmdbSchema {
  static db = `t-enum-num`
  static key = t.number()
  static value = {level: t.enum(1, 2)}
}

class BigEnumSchema extends LmdbSchema {
  static db = `t-enum-big`
  static key = t.number()
  static value = {seq: t.enum(1n, 2n)}
}

class EnumKeySchema extends LmdbSchema {
  static db = `t-enum-key`
  static key = t.enum(`x`, `y`)
  static value = {n: t.number()}
}
