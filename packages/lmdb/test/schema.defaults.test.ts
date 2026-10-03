import {describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbSchema, t, type ValueOf} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

describe(`.default() / .$defaultFn() — write-time fill`, () => {
  it(`fills omitted enum field with default`, async () => {
    const dir = createTestDir(`def-enum`)
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    try {
      const subs = env.register(EnumDefaultSchema)
      await subs.put(1, {})
      expect(subs.get(1)).toEqual({status: `a`})
    } finally {
      await env.close()
      await rmWithRetry(dir)
    }
  })

  it(`explicit value wins over default`, async () => {
    const dir = createTestDir(`def-explicit`)
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    try {
      const subs = env.register(EnumDefaultSchema)
      await subs.put(1, {status: `b`})
      expect(subs.get(1)).toEqual({status: `b`})
    } finally {
      await env.close()
      await rmWithRetry(dir)
    }
  })

  it(`.$defaultFn() fills dynamically per put`, async () => {
    const dir = createTestDir(`def-fn`)
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    try {
      const subs = env.register(FnDefaultSchema)
      await subs.put(1, {})
      await subs.put(2, {})
      const a = subs.get(1)?.n
      const b = subs.get(2)?.n
      expect(typeof a).toBe(`number`)
      expect(typeof b).toBe(`number`)
      expect(a).not.toBe(b)
    } finally {
      await env.close()
      await rmWithRetry(dir)
    }
  })

  it(`rejects default outside enum at declaration`, () => {
    expect(() => t.enum(`a`, `b`).default(`z` as any)).toThrow(LmdbError)
  })

  it(`default without .optional() is still omit-able`, async () => {
    const dir = createTestDir(`def-omit`)
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    try {
      const subs = env.register(PlainDefaultSchema)
      await subs.put(1, {})
      expect(subs.get(1)).toEqual({name: `hi`})
    } finally {
      await env.close()
      await rmWithRetry(dir)
    }
  })
})

class EnumDefaultSchema extends LmdbSchema {
  static db = `def-enum`
  static key = t.number()
  static value = {status: t.enum(`a`, `b`).default(`a`)}
}

let counter = 1000

class FnDefaultSchema extends LmdbSchema {
  static db = `def-fn`
  static key = t.number()
  static value = {n: t.number().$defaultFn(() => counter++)}
}

class PlainDefaultSchema extends LmdbSchema {
  static db = `def-plain`
  static key = t.number()
  static value = {name: t.string().default(`hi`)}
}

type _CheckOmit = ValueOf<typeof EnumDefaultSchema>
