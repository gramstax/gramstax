/**
 * Differential sync tests — checkpointed keyset copy with verify.
 *
 * `source.syncTo(dest)` copies rows past the persisted cursor in 500-row
 * chunks (resumable via `__sync_state`); the verify step compares counts
 * plus hash spot-checks and throws `LmdbError` on divergence.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbSchema, t, type ValueOf} from "../src/schema"
import {LmdbSyncStream} from "../src/sync"
import {createTestDir, rmWithRetry} from "./test-helpers"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
function assertType<T extends true>(): T {
  return true as T
}

class SyncUserSchema extends LmdbSchema {
  static db = `sync-user`
  static key = t.number()
  static value = {
    name: t.string(),
    age: t.number()
  }
}

type SyncRow = ValueOf<typeof SyncUserSchema>

function row(k: number): SyncRow {
  return {name: `n${k}`, age: k}
}

let dirA: string
let dirB: string
let envA: LmdbEnv
let envB: LmdbEnv

beforeEach(() => {
  dirA = createTestDir(`lmdb-sync-a-`)
  dirB = createTestDir(`lmdb-sync-b-`)
  envA = new LmdbEnv({path: dirA, maxDbs: 20})
  envB = new LmdbEnv({path: dirB, maxDbs: 20})
})

afterEach(async () => {
  if (envA.state !== `closed`) await envA.close()
  if (envB.state !== `closed`) await envB.close()
  await rmWithRetry(dirA)
  await rmWithRetry(dirB)
})

async function seed(source: {putMany: (entries: Array<[number, SyncRow]>) => Promise<void>}, n: number, from = 0): Promise<void> {
  const entries: Array<[number, SyncRow]> = []
  for (let i = from; i < from + n; i++) entries.push([i, row(i)])
  await source.putMany(entries)
}

describe(`hashRowValue`, () => {
  it(`is deterministic and order-insensitive for keys`, () => {
    expect(LmdbSyncStream.hashRowValue({a: 1, b: `x`})).toBe(LmdbSyncStream.hashRowValue({b: `x`, a: 1}))
    expect(LmdbSyncStream.hashRowValue({a: 1})).not.toBe(LmdbSyncStream.hashRowValue({a: 2}))
    expect(LmdbSyncStream.hashRowValue(null)).not.toBe(LmdbSyncStream.hashRowValue(undefined))
    expect(LmdbSyncStream.hashRowValue([1, {d: new Date(`2024-01-02T03:04:05Z`), m: new Map([[`k`, 1]]), s: new Set([2, 1]), b: new Uint8Array([1, 2]), n: 5n}])).toBe(
      LmdbSyncStream.hashRowValue([1, {s: new Set([1, 2]), b: new Uint8Array([1, 2]), n: 5n, d: new Date(`2024-01-02T03:04:05Z`), m: new Map([[`k`, 1]])}])
    )
    expect(LmdbSyncStream.hashRowValue({a: undefined})).not.toBe(LmdbSyncStream.hashRowValue({}))
    expect(LmdbSyncStream.hashRowValue(new Date(`invalid`))).not.toBe(LmdbSyncStream.hashRowValue(new Date(`2024-01-02T03:04:05Z`)))
    expect(LmdbSyncStream.hashRowValue(Symbol.for(`s`))).toBe(LmdbSyncStream.hashRowValue(Symbol.for(`s`)))
  })
})

describe(`syncTo`, () => {
  it(`copies empty to full with verify`, async () => {
    const source = envA.register(SyncUserSchema)
    const dest = envB.register(SyncUserSchema)
    await seed(source, 5)
    const result = await source.syncTo(dest)
    expect(result).toEqual({copied: 5, checkpoint: 4, verified: true})
    expect(dest.count()).toBe(5)
    expect(dest.get(4)).toEqual(row(4))
    assertType<Equal<ValueOf<typeof SyncUserSchema>, SyncRow>>()
  })

  it(`second run copies only the delta`, async () => {
    const source = envA.register(SyncUserSchema)
    const dest = envB.register(SyncUserSchema)
    await seed(source, 5)
    expect((await source.syncTo(dest)).copied).toBe(5)
    await seed(source, 3, 5)
    const delta = await source.syncTo(dest)
    expect(delta.copied).toBe(3)
    expect(delta.checkpoint).toBe(7)
    expect(delta.verified).toBe(true)
    expect(dest.count()).toBe(8)
    expect(dest.get(7)).toEqual(row(7))
  })

  it(`resumes after a limit kill without restarting`, async () => {
    const source = envA.register(SyncUserSchema)
    const dest = envB.register(SyncUserSchema)
    await seed(source, 10)
    const first = await source.syncTo(dest, {name: `r1`, limit: 3})
    expect(first).toEqual({copied: 3, checkpoint: 2, verified: false})
    const second = await source.syncTo(dest, {name: `r1`})
    expect(second.copied).toBe(7)
    expect(second.checkpoint).toBe(9)
    expect(second.verified).toBe(true)
    expect(dest.count()).toBe(10)
  })

  it(`explicit checkpoint overrides the stored cursor one-shot`, async () => {
    const source = envA.register(SyncUserSchema)
    const dest = envB.register(SyncUserSchema)
    await seed(source, 10)
    expect((await source.syncTo(dest)).copied).toBe(10)
    await seed(source, 2, 10)
    const replay = await source.syncTo(dest, {checkpoint: 5})
    expect(replay.copied).toBe(6)
    expect(replay.verified).toBe(true)
    expect(dest.count()).toBe(12)
  })

  it(`tampered dest fails verify on counts`, async () => {
    const source = envA.register(SyncUserSchema)
    const dest = envB.register(SyncUserSchema)
    await seed(source, 3)
    await source.syncTo(dest)
    envB.getDb(`sync-user`).putSync(`rogue`, {name: `x`, age: 0})
    await expect(source.syncTo(dest)).rejects.toBeInstanceOf(LmdbError)
  })

  it(`tampered dest fails verify on hashes`, async () => {
    const source = envA.register(SyncUserSchema)
    const dest = envB.register(SyncUserSchema)
    await seed(source, 12)
    await source.syncTo(dest)
    envB.getDb(`sync-user`).putSync(5, {name: `tampered`, age: 5})
    await expect(source.syncTo(dest)).rejects.toBeInstanceOf(LmdbError)
  })

  it(`verify false skips the check`, async () => {
    const source = envA.register(SyncUserSchema)
    const dest = envB.register(SyncUserSchema)
    await seed(source, 3)
    await source.syncTo(dest)
    envB.getDb(`sync-user`).putSync(`rogue`, {name: `x`, age: 0})
    const result = await source.syncTo(dest, {verify: false})
    expect(result.verified).toBe(false)
    expect(result.copied).toBe(0)
  })

  it(`refuses self sync`, async () => {
    const source = envA.register(SyncUserSchema)
    await expect(source.syncTo(source)).rejects.toBeInstanceOf(LmdbError)
  })

  it(`empty source copies nothing and verifies`, async () => {
    const source = envA.register(SyncUserSchema)
    const dest = envB.register(SyncUserSchema)
    expect(await source.syncTo(dest)).toEqual({copied: 0, checkpoint: undefined, verified: true})
    expect(await source.syncTo(dest, {checkpoint: 99})).toEqual({copied: 0, checkpoint: undefined, verified: true})
  })
})
