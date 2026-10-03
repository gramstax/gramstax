import {describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbSchema, t} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

describe(`enum runtime validation — write seam`, () => {
  it(`accepts in-enum put, rejects out-of-enum with LmdbError`, async () => {
    const dir = createTestDir(`enum-val-put`)
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    try {
      const subs = env.register(ValSchema)
      await subs.put(1, {status: `a`})
      expect(subs.get(1)).toEqual({status: `a`})
      const raw: any = {status: `z`}
      await expect(subs.put(2, raw)).rejects.toBeInstanceOf(LmdbError)
      await expect(subs.put(2, raw)).rejects.toBeInstanceOf(LmdbError)
      expect(subs.get(2)).toBeUndefined()
    } finally {
      await env.close()
      await rmWithRetry(dir)
    }
  })

  it(`validates t.string literal params too`, async () => {
    const dir = createTestDir(`enum-val-lit`)
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    try {
      const subs = env.register(LitSchema)
      await subs.put(1, {status: `active`})
      const raw: any = {status: `nope`}
      await expect(subs.put(2, raw)).rejects.toBeInstanceOf(LmdbError)
      expect(subs.get(2)).toBeUndefined()
    } finally {
      await env.close()
      await rmWithRetry(dir)
    }
  })

  it(`non-enum columns stay unvalidated (zero-cost)`, async () => {
    const dir = createTestDir(`enum-val-free`)
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    try {
      const subs = env.register(FreeSchema)
      const raw: any = {status: `anything-goes`}
      await subs.put(1, raw)
      expect(subs.get(1)).toEqual({status: `anything-goes`})
    } finally {
      await env.close()
      await rmWithRetry(dir)
    }
  })

  it(`validates dupSort addValue`, async () => {
    const dir = createTestDir(`enum-val-dup`)
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    try {
      const subs = env.register(DupEnumSchema)
      await subs.addValue(`post:1`, `a`)
      const raw: any = `z`
      await expect(subs.addValue(`post:1`, raw)).rejects.toBeInstanceOf(LmdbError)
      expect(await subs.getValues(`post:1`)).toEqual([`a`])
    } finally {
      await env.close()
      await rmWithRetry(dir)
    }
  })

  it(`validates enum keys`, async () => {
    const dir = createTestDir(`enum-val-key`)
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    try {
      const subs = env.register(EnumKeySchema)
      await subs.put(`x`, {n: 1})
      const badKey: any = `z`
      await expect(subs.put(badKey, {n: 2})).rejects.toBeInstanceOf(LmdbError)
      expect(subs.get(badKey)).toBeUndefined()
    } finally {
      await env.close()
      await rmWithRetry(dir)
    }
  })
})

class ValSchema extends LmdbSchema {
  static db = `enum-val`
  static key = t.number()
  static value = {status: t.enum(`a`, `b`)}
}

class LitSchema extends LmdbSchema {
  static db = `enum-val-lit`
  static key = t.number()
  static value = {status: t.string(`active`, `archived`)}
}

class FreeSchema extends LmdbSchema {
  static db = `enum-val-free`
  static key = t.number()
  static value = {status: t.string()}
}

class EnumKeySchema extends LmdbSchema {
  static db = `enum-val-key`
  static key = t.enum(`x`, `y`)
  static value = {n: t.number()}
}

class DupEnumSchema extends LmdbSchema {
  static db = `enum-val-dup`
  static key = t.string()
  static value = t.enum(`a`, `b`)
  static dupSort = true
}
