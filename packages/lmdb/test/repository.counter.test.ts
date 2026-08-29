/**
 * F3 — Atomic counter primitive.
 *
 * Built over env.transaction() — read + write in one LMDB writer txn,
 * therefore safe against concurrent writers in other processes.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"
import type {LmdbEnvSub} from "../src/sub"

import {createTestDir, rmWithRetry} from "./test-helpers"

class CounterSchema extends LmdbSchema { static db = `counter-f3-test`; static key = t.string(); static value = t.number() }

let tmpDir: string
let env: LmdbEnv
let counters: LmdbEnvSub<typeof CounterSchema>

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-counter-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  counters = env.register(CounterSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbRepository.increment`, () => {
  it(`stores delta when the key is absent`, async () => {
    const next = await counters.increment(`hits`)
    expect(next).toBe(1)
    expect(await counters.get(`hits`)).toBe(1)
  })

  it(`increments an existing numeric value`, async () => {
    await counters.put(`hits`, 5)
    const next = await counters.increment(`hits`, 1)
    expect(next).toBe(6)
    expect(await counters.get(`hits`)).toBe(6)
  })

  it(`respects a custom delta`, async () => {
    await counters.put(`hits`, 10)
    const next = await counters.increment(`hits`, 5)
    expect(next).toBe(15)
  })

  it(`supports negative delta as a decrement`, async () => {
    await counters.put(`hits`, 10)
    const next = await counters.increment(`hits`, -3)
    expect(next).toBe(7)
  })

  it(`is atomic under concurrent increments`, async () => {
    await counters.put(`hits`, 0)
    const ops = Array.from({length: 10}, () => counters.increment(`hits`, 1))
    const results = await Promise.all(ops)
    // 10 increments must each return a distinct 1..10 in some order
    expect(results.sort((a: number, b: number) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(await counters.get(`hits`)).toBe(10)
  })

  it(`throws when the existing value is not a number`, async () => {
    // Force a non-numeric value via raw put bypassing the number-typed repo
    await counters.owner.getDb(counters.dbName).put(`bad`, `not-a-number` as unknown as number)
    let err: unknown
    try {
      await counters.increment(`bad`)
      expect.unreachable(`expected increment to throw`)
    } catch (e) {
      err = e
    }
    expect(String((err as Error & {cause?: unknown}).cause ?? err)).toMatch(/numeric/)
  })
})

describe(`LmdbRepository.decrement`, () => {
  it(`decrements an existing numeric value`, async () => {
    await counters.put(`hits`, 10)
    const next = await counters.decrement(`hits`, 3)
    expect(next).toBe(7)
    expect(await counters.get(`hits`)).toBe(7)
  })

  it(`stores negative when decrementing absent key (0 - amount)`, async () => {
    const next = await counters.decrement(`hits`, 2)
    expect(next).toBe(-2)
    expect(await counters.get(`hits`)).toBe(-2)
  })

  it(`defaults amount to 1`, async () => {
    await counters.put(`hits`, 5)
    expect(await counters.decrement(`hits`)).toBe(4)
  })

  it(`throws when the existing value is not a number`, async () => {
    await counters.owner.getDb(counters.dbName).put(`bad2`, `not-a-number` as unknown as number)
    let err: unknown
    try {
      await counters.decrement(`bad2`)
      expect.unreachable(`expected decrement to throw`)
    } catch (e) {
      err = e
    }
    expect(String((err as Error & {cause?: unknown}).cause ?? err)).toMatch(/numeric/)
  })
})
