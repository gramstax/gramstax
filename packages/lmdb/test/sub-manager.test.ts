/**
 * Registration-path tests for LmdbEnvSubManager (via the LmdbEnv surface).
 *
 * Covers the seams Phase 0 hardens around: cached handle identity,
 * duplicate class/db rejection, index sub-DB collision guardrail,
 * map-full refusal, maxDbs warn-once, and attachIndexes wiring.
 */
import {afterEach, beforeEach, describe, expect, it, spyOn} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbSchema, t} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

class MgrUserSchema extends LmdbSchema {
  static db = `mgr-user`
  static key = t.string()
  static value = {
    name: t.string()
  }
}

class MgrOtherSchema extends LmdbSchema {
  static db = `mgr-other`
  static key = t.string()
  static value = {
    v: t.string()
  }
}

class MgrSameDbSchema extends LmdbSchema {
  static db = `mgr-user`
  static key = t.string()
  static value = {
    v: t.string()
  }
}

class MgrNeverRegisteredSchema extends LmdbSchema {
  static db = `mgr-never`
  static key = t.string()
  static value = {
    v: t.string()
  }
}

class MgrIndexedSchema extends LmdbSchema {
  static db = `mgr-idx-user`
  static key = t.string()
  static value = {
    email: t.string().index()
  }
}

class MgrSquatterSchema extends LmdbSchema {
  static db = `mgr-idx-user:idx:email`
  static key = t.string()
  static value = {
    v: t.string()
  }
}

let tmpDir: string
let env: LmdbEnv

beforeEach(() => {
  tmpDir = createTestDir(`lmdb-sub-manager-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 10})
})

afterEach(async () => {
  if (env.state !== `closed`) {
    await env.close()
  }
  await rmWithRetry(tmpDir)
})

describe(`sub-manager registration`, () => {
  it(`register returns a cached handle shared with sub()`, () => {
    const handle = env.register(MgrUserSchema)
    expect(env.sub(MgrUserSchema)).toBe(handle)
    expect(env.isRegistered(MgrUserSchema)).toBe(true)
    expect(env.isRegistered(MgrNeverRegisteredSchema)).toBe(false)
  })

  it(`rejects duplicate class registration`, () => {
    env.register(MgrUserSchema)
    expect(() => env.register(MgrUserSchema)).toThrow(LmdbError)
  })

  it(`rejects duplicate db names`, () => {
    env.register(MgrUserSchema)
    expect(() => env.register(MgrSameDbSchema)).toThrow(LmdbError)
  })

  it(`sub() throws for unknown schemas`, () => {
    expect(() => env.sub(MgrNeverRegisteredSchema)).toThrow(LmdbError)
  })

  it(`rejects index sub-DB names colliding with registered subs`, () => {
    env.register(MgrSquatterSchema)
    expect(() => env.register(MgrIndexedSchema)).toThrow(LmdbError)
  })

  it(`refuses registration when the map is nearly full`, () => {
    const stubbed = env as unknown as {getMapSizeUsed: () => {total: number; used: number; free: number; ratio: number}}
    stubbed.getMapSizeUsed = () => ({total: 100, used: 95, free: 5, ratio: 0.05})
    expect(() => env.register(MgrOtherSchema)).toThrow(LmdbError)
  })

  it(`warns once when sub-DB slots run low`, async () => {
    const warn = spyOn(console, `warn`).mockImplementation(() => {})
    try {
      const dir = createTestDir(`lmdb-sub-manager-maxdbs-`)
      const big = new LmdbEnv({path: dir, maxDbs: 40})
      try {
        for (let i = 0; i < 10; i++) {
          const cls = class extends LmdbSchema {
            static key = t.string()
            static value = {v: t.string()}
          }
          Object.defineProperty(cls, `db`, {value: `mgr-dyn-${i}`})
          Object.defineProperty(cls, `name`, {value: `MgrDyn${i}`})
          big.register(cls)
        }
        expect(warn).toHaveBeenCalledTimes(1)
        expect(String(warn.mock.calls[0]?.[0])).toContain(`sub-DBs used`)
        const extra = class extends LmdbSchema {
          static key = t.string()
          static value = {v: t.string()}
        }
        Object.defineProperty(extra, `db`, {value: `mgr-dyn-extra`})
        big.register(extra)
        expect(warn).toHaveBeenCalledTimes(1)
      } finally {
        await big.close()
        await rmWithRetry(dir)
      }
    } finally {
      warn.mockRestore()
    }
  })

  it(`attachIndexes throws for unknown subs`, () => {
    expect(() => env._attachIndexes(`mgr-missing`, [])).toThrow(LmdbError)
  })

  it(`attachIndexes wires custom extractors`, async () => {
    const users = env.register(MgrUserSchema)
    env._attachIndexes(`mgr-user`, [{name: `upper`, def: {extractor: (v: unknown) => (v as {name: string}).name.toUpperCase()}, dbName: `mgr-user:idx:upper`}])
    await users.put(`u1`, {name: `Alice`})
    expect(await users.findByIndex({upper: `ALICE`} as never)).toEqual([{name: `Alice`}])
  })
})
