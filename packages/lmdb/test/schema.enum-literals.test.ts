import {describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {type KeyOf, LmdbSchema, t, type ValueOf} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
function assertType<T extends true>(): T {
  return true as T
}

describe(`t.* literal params — drizzle-style enum (type-only)`, () => {
  it(`t.string() stays wide, t.string('a','b') narrows`, () => {
    assertType<Equal<ValueOf<typeof WideSchema>, {status: string}>>()
    assertType<Equal<ValueOf<typeof EnumSchema>, {status: `active` | `archived`}>>()
    assertType<Equal<ValueOf<typeof SingleSchema>, {status: `only`}>>()
  })

  it(`t.number / t.bigint literals narrow`, () => {
    assertType<Equal<ValueOf<typeof NumSchema>, {level: 1 | 2}>>()
    assertType<Equal<ValueOf<typeof BigSchema>, {seq: 1n | 2n}>>()
    assertType<Equal<ValueOf<typeof WideNumSchema>, {level: number}>>()
  })

  it(`optional/unique/index/key preserve literal union`, () => {
    assertType<Equal<ValueOf<typeof OptionalSchema>, {status?: `a` | `b` | undefined}>>()
    assertType<Equal<ValueOf<typeof IndexedSchema>, {status: `a` | `b`}>>()
    const kx: KeyOf<typeof LiteralKeySchema> = `x`
    const ky: KeyOf<typeof LiteralKeySchema> = `y`
    expect([kx, ky]).toEqual([`x`, `y`])
  })

  it(`runtime smoke: put/get works, invalid literal rejected`, async () => {
    const dir = createTestDir(`enum-literals`)
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    try {
      const subs = env.register(EnumSchema)
      await subs.put(1, {status: `active`})
      expect(subs.get(1)).toEqual({status: `active`})
      const raw: any = {status: `nope`}
      await expect(subs.put(2, raw)).rejects.toBeInstanceOf(LmdbError)
      expect(subs.get(2)).toBeUndefined()
    } finally {
      await env.close()
      await rmWithRetry(dir)
    }
  })
})

class WideSchema extends LmdbSchema {
  static db = `enum-wide`
  static key = t.number()
  static value = {status: t.string()}
}

class EnumSchema extends LmdbSchema {
  static db = `enum-status`
  static key = t.number()
  static value = {status: t.string(`active`, `archived`)}
}

class SingleSchema extends LmdbSchema {
  static db = `enum-single`
  static key = t.number()
  static value = {status: t.string(`only`)}
}

class NumSchema extends LmdbSchema {
  static db = `enum-num`
  static key = t.number()
  static value = {level: t.number(1, 2)}
}

class BigSchema extends LmdbSchema {
  static db = `enum-big`
  static key = t.number()
  static value = {seq: t.bigint(1n, 2n)}
}

class WideNumSchema extends LmdbSchema {
  static db = `enum-wide-num`
  static key = t.number()
  static value = {level: t.number()}
}

class OptionalSchema extends LmdbSchema {
  static db = `enum-optional`
  static key = t.number()
  static value = {status: t.string(`a`, `b`).optional()}
}

class IndexedSchema extends LmdbSchema {
  static db = `enum-indexed`
  static key = t.number()
  static value = {status: t.string(`a`, `b`).unique()}
}

class LiteralKeySchema extends LmdbSchema {
  static db = `enum-key`
  static key = t.string(`x`, `y`)
  static value = {n: t.number()}
}
