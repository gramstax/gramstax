/**
 * B1+B2 — Env defaults hardening: mapSize 4GB, maxDbs 128, map-full guardrail.
 *
 * 3 cases only — deliberately NO large DB creation (no hang, no 150k writes):
 * 1. mapSize defaults to 4GB — visible via `getMapSizeUsed().total`.
 * 2. maxDbs defaults to 128 — 20 dummy repos register fine in a loop.
 * 3. duplicate `LmdbQueue` on the same dbName is idempotent (no throw).
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbQueue} from "../src/queue"
import {LmdbSchema, t} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

let tmpDir: string
let env: LmdbEnv

beforeEach(() => {
  tmpDir = createTestDir(`lmdb-b2-test-`)
  env = new LmdbEnv({path: tmpDir})
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`B1+B2 env defaults`, () => {
  it(`mapSize defaults to 4GB — getMapSizeUsed().total is 4<<30`, () => {
    const usage = env.getMapSizeUsed()
    expect(usage.total).toBe(4 << 30)
    expect(usage.used).toBeGreaterThanOrEqual(0)
    expect(usage.ratio).toBeGreaterThan(0)
    expect(usage.ratio).toBeLessThanOrEqual(1)
  })

  it(`maxDbs defaults to 128 — 20 dummy repos register fine`, () => {
    expect(env.maxDbs).toBe(128)
    const repos: Array<typeof LmdbSchema> = []
    for (let i = 0; i < 20; i++) {
      const dbName = `dummy_${i}`
      class DummySchema extends LmdbSchema {
        static db = dbName
        static key = t.string()
        static value = {n: t.number()}
      }
      env.register(DummySchema)
      repos.push(DummySchema)
    }
    expect(env.isRegistered(repos[0] as typeof LmdbSchema)).toBe(true)
    expect(env.isRegistered(repos[19] as typeof LmdbSchema)).toBe(true)
  })

  it(`queue is idempotent — second LmdbQueue on same dbName does not throw`, async () => {
    class JobsSchema extends LmdbSchema {
      static db = `jobs`
      static key = t.string()
      static value = {v: t.number()}
    }
    const q1 = new LmdbQueue(env, JobsSchema)
    let q2: LmdbQueue<typeof JobsSchema> | undefined
    expect(() => {
      q2 = new LmdbQueue(env, JobsSchema)
    }).not.toThrow()
    const id = await q1.enqueue({v: 1})
    expect(await q2!.peek()).toEqual([id, {v: 1}])
    expect(await q1.size()).toBe(1)
  })
})
