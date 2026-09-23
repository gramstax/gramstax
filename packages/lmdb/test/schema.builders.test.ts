import {describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbSchema, t, type ValueOf} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

describe(`t.* builders — expanded kinds`, () => {
  it(`map/set/any carry their types`, () => {
    class RichSchema extends LmdbSchema {
      static db = `rich`
      static key = t.string()
      static value = {
        m: t.map<string, number>(),
        s: t.set<string>(),
        a: t.any()
      }
    }
    type V = ValueOf<typeof RichSchema>
    const v: V = {m: new Map(), s: new Set(), a: `anything`}
    expect(v.m).toBeInstanceOf(Map)
    expect(v.s).toBeInstanceOf(Set)
    expect(v.a).toBe(`anything`)
  })

  it(`t.array(t.string()) infers string[]`, () => {
    class TagsSchema extends LmdbSchema {
      static db = `array-bare`
      static key = t.string()
      static value = {
        tags: t.array(t.string())
      }
    }
    type V = ValueOf<typeof TagsSchema>
    const v: V = {tags: [`a`, `b`]}
    expect(v.tags).toEqual([`a`, `b`])
  })

  it(`t.array([t.string()]) infers string[][] (nested arrays)`, () => {
    class MatrixSchema extends LmdbSchema {
      static db = `array-nested`
      static key = t.string()
      static value = {
        matrix: t.array([t.string()])
      }
    }
    type V = ValueOf<typeof MatrixSchema>
    const v: V = {matrix: [[`example`], [`example2`]]}
    expect(v.matrix).toEqual([[`example`], [`example2`]])
  })

  it(`t.array(t.number()) infers number[]`, () => {
    class IdsSchema extends LmdbSchema {
      static db = `array-bare-num`
      static key = t.string()
      static value = {
        ids: t.array(t.number())
      }
    }
    type V = ValueOf<typeof IdsSchema>
    const v: V = {ids: [1, 2]}
    expect(v.ids).toEqual([1, 2])
  })

  it(`t.set(t.string()) infers Set<string>`, () => {
    class RolesSchema extends LmdbSchema {
      static db = `set-bare`
      static key = t.string()
      static value = {
        roles: t.set(t.string())
      }
    }
    type V = ValueOf<typeof RolesSchema>
    const v: V = {roles: new Set([`admin`, `user`])}
    expect(v.roles.has(`admin`)).toBe(true)
  })

  it(`t.set([t.string()]) infers Set<string[]> (nested arrays)`, () => {
    class GroupsSchema extends LmdbSchema {
      static db = `set-nested`
      static key = t.string()
      static value = {
        groups: t.set([t.string()])
      }
    }
    type V = ValueOf<typeof GroupsSchema>
    const v: V = {groups: new Set([[`a`, `b`], [`c`]])}
    expect(v.groups.size).toBe(2)
  })
})

describe(`t.object({...}) / t.array({...}) param-based`, () => {
  it(`infers value type from the shape (optional fields honored)`, () => {
    class UserSchema extends LmdbSchema {
      static db = `shape-users`
      static key = t.string()
      static value = {
        bio: t.object({age: t.string().optional(), location: t.string()})
      }
    }
    type V = ValueOf<typeof UserSchema>
    // location is non-optional → string; age is optional → string | undefined
    const ok: V = {bio: {age: `25`, location: `jkt`}}
    const withUndef: V = {bio: {age: undefined, location: `jkt`}}
    expect(ok.bio.location).toBe(`jkt`)
    expect(withUndef.bio.age).toBeUndefined()
  })

  it(`t.array({...}) infers array-of-shape type`, () => {
    class TagSchema extends LmdbSchema {
      static db = `shape-tags`
      static key = t.string()
      static value = {
        tags: t.array({name: t.string()})
      }
    }
    type V = ValueOf<typeof TagSchema>
    const v: V = {tags: [{name: `a`}, {name: `b`}]}
    expect(v.tags).toHaveLength(2)
  })

  it(`t.map({key, value}) infers Map type`, () => {
    class CountersSchema extends LmdbSchema {
      static db = `shape-map`
      static key = t.string()
      static value = {
        counts: t.map({key: t.string(), value: t.number()})
      }
    }
    type V = ValueOf<typeof CountersSchema>
    const v: V = {counts: new Map([[`a`, 1]])}
    expect(v.counts.get(`a`)).toBe(1)
  })

  it(`t.set({...}) infers Set type`, () => {
    class TagsSchema extends LmdbSchema {
      static db = `shape-set`
      static key = t.string()
      static value = {
        tags: t.set({name: t.string()})
      }
    }
    type V = ValueOf<typeof TagsSchema>
    const v: V = {tags: new Set([{name: `a`}])}
    expect(v.tags.size).toBe(1)
  })

  it(`rejects nested unique inside a t.map shape`, async () => {
    class BadMapSchema extends LmdbSchema {
      static db = `bad-map-shape`
      static key = t.string()
      static value = {
        counts: t.map({key: t.string().unique(), value: t.number()})
      }
    }
    const tmpDir = createTestDir(`lmdb-badmap-`)
    const env = new LmdbEnv({path: tmpDir, maxDbs: 10})
    try {
      expect(() => env.register(BadMapSchema)).toThrow(/nested unique\/index/)
    } finally {
      await env.close()
      await rmWithRetry(tmpDir)
    }
  })

  it(`registers and round-trips a param-based object`, async () => {
    const tmpDir = createTestDir(`lmdb-shape-`)
    const env = new LmdbEnv({path: tmpDir, maxDbs: 10})
    try {
      class UserSchema extends LmdbSchema {
        static db = `shape-roundtrip`
        static key = t.string()
        static value = {
          bio: t.object({age: t.number().optional(), location: t.string()})
        }
      }
      const users = env.register(UserSchema)
      await users.put(`u1`, {bio: {age: 25, location: `jkt`}})
      expect(users.get(`u1`)?.bio).toEqual({age: 25, location: `jkt`})
    } finally {
      await env.close()
      await rmWithRetry(tmpDir)
    }
  })

  it(`rejects nested unique/index inside a shape (silent-ignore hazard)`, async () => {
    class BadSchema extends LmdbSchema {
      static db = `bad-shape`
      static key = t.string()
      static value = {
        bio: t.object({email: t.string().unique()})
      }
    }
    const tmpDir = createTestDir(`lmdb-badshape-`)
    const env = new LmdbEnv({path: tmpDir, maxDbs: 10})
    try {
      expect(() => env.register(BadSchema)).toThrow(LmdbError)
      expect(() => env.register(BadSchema)).toThrow(/nested unique\/index/)
    } finally {
      await env.close()
      await rmWithRetry(tmpDir)
    }
  })

  it(`rejects nested unique inside a t.array shape`, async () => {
    class BadArrSchema extends LmdbSchema {
      static db = `bad-arr-shape`
      static key = t.string()
      static value = {
        tags: t.array({email: t.string().index()})
      }
    }
    const tmpDir = createTestDir(`lmdb-badarr-`)
    const env = new LmdbEnv({path: tmpDir, maxDbs: 10})
    try {
      expect(() => env.register(BadArrSchema)).toThrow(/nested unique\/index/)
    } finally {
      await env.close()
      await rmWithRetry(tmpDir)
    }
  })
})
