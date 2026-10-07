/**
 * CDC subscription tests — durable outbox plus in-process delivery.
 *
 * Every put/delete appends `{db, type, key, value}` to `__cdc_log` in the
 * same writer transaction; `env.subscribe` delivers post-commit via
 * `aftercommit` tailing; followers tail/ack explicitly with min-ack prune.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbQueue} from "../src/queue"
import {LmdbSchema, t} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

class CdcUserSchema extends LmdbSchema {
  static db = `cdc-user`
  static key = t.string()
  static value = {
    name: t.string(),
    age: t.number()
  }
}

class CdcOtherSchema extends LmdbSchema {
  static db = `cdc-other`
  static key = t.string()
  static value = {
    v: t.string()
  }
}

class CdcJobSchema extends LmdbSchema {
  static db = `cdc-jobs`
  static key = t.string()
  static value = t.object<{id: string; payload: string}>()
}

const U1 = {name: `Alice`, age: 30}

let tmpDir: string
let env: LmdbEnv

beforeEach(() => {
  tmpDir = createTestDir(`lmdb-cdc-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 20})
})

afterEach(async () => {
  if (env.state !== `closed`) {
    await env.close()
  }
  await rmWithRetry(tmpDir)
})

describe(`subscribe`, () => {
  it(`delivers put events after commit`, async () => {
    const users = env.register(CdcUserSchema)
    const seen: Array<unknown> = []
    env.subscribe(`cdc-user`, (e) => {
      seen.push(e)
    })
    await users.put(`u1`, U1)
    expect(seen).toEqual([{type: `put`, key: `u1`, value: U1}])
  })

  it(`delivers delete and clear events`, async () => {
    const users = env.register(CdcUserSchema)
    const seen: Array<unknown> = []
    env.subscribe(`cdc-user`, (e) => {
      seen.push(e)
    })
    await users.put(`u1`, U1)
    await users.delete(`u1`)
    expect(seen).toEqual([
      {type: `put`, key: `u1`, value: U1},
      {type: `delete`, key: `u1`, value: undefined}
    ])
    await users.put(`u2`, U1)
    await users.clear()
    expect(seen[seen.length - 1]).toEqual({type: `clear`, key: undefined, value: undefined})
  })

  it(`captures putMany in order`, async () => {
    const users = env.register(CdcUserSchema)
    const keys: Array<unknown> = []
    env.subscribe(`cdc-user`, (e) => {
      keys.push((e as {key: unknown}).key)
    })
    await users.putMany([
      [`a`, U1],
      [`b`, U1],
      [`c`, U1]
    ])
    expect(keys).toEqual([`a`, `b`, `c`])
  })

  it(`captures deleteByPrefix per row`, async () => {
    const users = env.register(CdcUserSchema)
    const seen: Array<unknown> = []
    // Filter to deletes rather than clearing `seen` mid-test: put() stages its
    // CDC record in async mode (fire-and-forget), so a late record can surface
    // on a later drain and land after a manual reset. The op filter keeps puts
    // out of the callback entirely, so this asserts only what it means to.
    env.subscribe({db: `cdc-user`, op: `delete`}, (e) => {
      seen.push(e)
    })
    await users.put(`k:1`, U1)
    await users.put(`k:2`, U1)
    await users.deleteByPrefix(`k:`)
    expect(seen).toEqual([
      {type: `delete`, key: `k:1`, value: undefined},
      {type: `delete`, key: `k:2`, value: undefined}
    ])
  })

  it(`publishes nothing on abort`, async () => {
    const users = env.register(CdcUserSchema)
    const seen: Array<unknown> = []
    env.subscribe(`cdc-user`, (e) => {
      seen.push(e)
    })
    await env.transaction((tx) => {
      void users.put(`u9`, {name: `Ghost`, age: 9})
      tx.abort()
    })
    expect(users.get(`u9`)).toBeUndefined()
    expect(seen).toEqual([])
    // The rolled-back sequence leaves no gap.
    await users.put(`u1`, U1)
    expect(seen).toEqual([{type: `put`, key: `u1`, value: U1}])
    const tail = await env.tailCdc()
    expect(tail.map((e) => e.seq)).toEqual([1])
  })

  it(`filters by db and op`, async () => {
    const users = env.register(CdcUserSchema)
    const other = env.register(CdcOtherSchema)
    const seen: Array<unknown> = []
    env.subscribe({db: `cdc-user`, op: `delete`}, (e) => {
      seen.push(e)
    })
    await users.put(`u1`, U1)
    await other.put(`o1`, {v: `x`})
    expect(seen).toEqual([])
    await users.delete(`u1`)
    expect(seen).toHaveLength(1)
  })

  it(`unsubscribe detaches cleanly and twice is safe`, async () => {
    const users = env.register(CdcUserSchema)
    const seen: Array<unknown> = []
    const unsub = env.subscribe(`cdc-user`, (e) => {
      seen.push(e)
    })
    await users.put(`u1`, U1)
    expect(seen).toHaveLength(1)
    unsub()
    unsub()
    await users.put(`u2`, U1)
    expect(seen).toHaveLength(1)
  })

  it(`rejects garbage filters`, () => {
    expect(() => env.subscribe(42 as never, () => {})).toThrow(LmdbError)
    expect(() => env.subscribe({} as never, () => {})).toThrow(LmdbError)
    expect(() => env.subscribe(``, () => {})).toThrow(LmdbError)
    expect(() => env.subscribe({db: `cdc-user`, op: `nope` as never}, () => {})).toThrow(LmdbError)
  })

  it(`delivers sync put/remove after commit`, async () => {
    const users = env.register(CdcUserSchema)
    const seen: Array<unknown> = []
    env.subscribe(`cdc-user`, (e) => {
      seen.push(e)
    })
    users.putSync(`u1`, U1)
    expect(seen).toEqual([{type: `put`, key: `u1`, value: U1}])
    expect(users.removeSync(`u1`)).toBe(true)
    expect(seen).toEqual([
      {type: `put`, key: `u1`, value: U1},
      {type: `delete`, key: `u1`, value: undefined}
    ])
  })

  it(`delivers once for sync writes inside an explicit transaction`, async () => {
    const users = env.register(CdcUserSchema)
    const seen: Array<unknown> = []
    env.subscribe(`cdc-user`, (e) => {
      seen.push(e)
    })
    await env.transaction(() => {
      users.putSync(`u1`, U1)
      users.putSync(`u2`, U1)
    })
    expect(seen).toEqual([
      {type: `put`, key: `u1`, value: U1},
      {type: `put`, key: `u2`, value: U1}
    ])
  })

  it(`a throwing subscriber does not break commits`, async () => {
    const users = env.register(CdcUserSchema)
    const seen: Array<unknown> = []
    const warnings: Array<string> = []
    env.onWarn((message) => warnings.push(message))
    env.subscribe(`cdc-user`, () => {
      throw new Error(`boom`)
    })
    env.subscribe(`cdc-user`, (e) => {
      seen.push(e)
    })
    await users.put(`u1`, U1)
    expect(users.get(`u1`)).toEqual(U1)
    expect(seen).toHaveLength(1)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain(`CDC subscriber`)
  })

  it(`internal queue bookkeeping stays out of the outbox`, async () => {
    const queue = new LmdbQueue(env, CdcJobSchema)
    expect(await env.tailCdc()).toEqual([])
    await queue.enqueue({id: `j1`, payload: `a`})
    const tail = await env.tailCdc()
    expect(tail.map((e) => e.db)).toEqual([`cdc-jobs`])
    expect(tail[0]).toMatchObject({type: `put`})
  })
})

describe(`tail and ack`, () => {
  it(`follower resumes from ack after restart`, async () => {
    const users = env.register(CdcUserSchema)
    expect(await env.tailCdc({consumer: `f1`})).toEqual([])
    await users.put(`u1`, U1)
    await users.put(`u2`, U1)
    const first = await env.tailCdc({consumer: `f1`})
    expect(first.map((e) => e.seq)).toEqual([1, 2])
    expect(first[0]).toMatchObject({db: `cdc-user`, type: `put`, key: `u1`})
    await env.ackCdc(`f1`, 2)
    await users.put(`u3`, U1)
    await env.close()
    const env2 = new LmdbEnv({path: tmpDir, maxDbs: 20})
    try {
      env2.register(CdcUserSchema)
      const resumed = await env2.tailCdc({consumer: `f1`})
      expect(resumed.map((e) => e.key)).toEqual([`u3`])
      await env2.ackCdc(`f1`, 3)
      expect(await env2.tailCdc({consumer: `f1`})).toEqual([])
    } finally {
      await env2.close()
    }
  })

  it(`tail honors from and limit`, async () => {
    const users = env.register(CdcUserSchema)
    await env.tailCdc()
    await users.put(`u1`, U1)
    await users.put(`u2`, U1)
    await users.put(`u3`, U1)
    expect((await env.tailCdc({from: 2})).map((e) => e.seq)).toEqual([2, 3])
    expect((await env.tailCdc({limit: 2})).map((e) => e.seq)).toEqual([1, 2])
    expect(await env.tailCdc({limit: 0})).toEqual([])
  })

  it(`skips outbox holes left by concurrent prune`, async () => {
    const users = env.register(CdcUserSchema)
    await env.tailCdc()
    await users.put(`u1`, U1)
    await users.put(`u2`, U1)
    env.getDb(`__cdc_log`).removeSync(1)
    expect((await env.tailCdc()).map((e) => e.seq)).toEqual([2])
  })

  it(`ack on unknown consumer throws`, async () => {
    await expect(env.ackCdc(`nope`, 1)).rejects.toBeInstanceOf(LmdbError)
  })
})

describe(`prune`, () => {
  it(`min-ack prune drops consumed entries only`, async () => {
    const users = env.register(CdcUserSchema)
    await env.tailCdc({consumer: `f1`})
    await env.tailCdc({consumer: `f2`})
    for (const k of [`u1`, `u2`, `u3`, `u4`, `u5`]) await users.put(k, U1)
    await env.ackCdc(`f1`, 2)
    await env.ackCdc(`f2`, 5)
    expect(await env.pruneCdc(1)).toBe(2)
    expect((await env.tailCdc({from: 0})).map((e) => e.seq)).toEqual([3, 4, 5])
    expect(await env.pruneCdc()).toBe(0)
  })

  it(`unacked consumers block pruning below their start`, async () => {
    const users = env.register(CdcUserSchema)
    await env.tailCdc({consumer: `f3`})
    await users.put(`u1`, U1)
    await users.put(`u2`, U1)
    expect(await env.pruneCdc(0)).toBe(0)
    expect(await env.tailCdc({from: 0})).toHaveLength(2)
  })

  it(`rejects negative keep`, async () => {
    await expect(env.pruneCdc(-1)).rejects.toBeInstanceOf(LmdbError)
  })

  it(`prunes nothing from an empty outbox`, async () => {
    env.register(CdcUserSchema)
    expect(await env.pruneCdc()).toBe(0)
  })

  it(`keep window bounds growth without consumers`, async () => {
    const users = env.register(CdcUserSchema)
    await env.tailCdc()
    await users.put(`u1`, U1)
    await users.put(`u2`, U1)
    await users.put(`u3`, U1)
    expect(await env.pruneCdc(1)).toBe(2)
    expect((await env.tailCdc()).map((e) => e.seq)).toEqual([3])
  })
})
