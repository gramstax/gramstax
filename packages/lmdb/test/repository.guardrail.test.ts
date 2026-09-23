/**
 * B4 — Materialization guardrail (Phase 2).
 *
 * Range queries that would materialize an unbounded or oversized array into
 * memory are rejected with LmdbError; iterate() remains the
 * escape hatch. The guard is size-aware: an unbounded query only trips when
 * the repository actually holds more than MAX_MATERIALIZE entries, so small
 * repositories keep working without a limit.
 */
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbSchema, t} from "../src/schema"
import {MAX_MATERIALIZE} from "../src/sub"
import type {LmdbEnvSub} from "../src/sub"

import {createTestDir, rmWithRetry} from "./test-helpers"

class GuardSchema extends LmdbSchema { static db = `guardrail-test`; static key = t.string(); static value = t.object<{v: number}>() }

const MAX = MAX_MATERIALIZE

describe(`LmdbRepository materialization guardrail`, () => {
  describe(`small repository (under the cap)`, () => {
    let tmpDir: string
    let env: LmdbEnv
    let repo: LmdbEnvSub<typeof GuardSchema>

    beforeEach(async () => {
      tmpDir = createTestDir(`lmdb-guardrail-small-`)
      env = new LmdbEnv({path: tmpDir, maxDbs: 5})
      repo = env.register(GuardSchema)
      await repo.putMany([
        [`pref-1`, {v: 1}],
        [`pref-2`, {v: 2}],
        [`other-1`, {v: 3}]
      ])
    })

    afterEach(async () => {
      await env.close()
      await rmWithRetry(tmpDir)
    })

    it(`values() without a limit still works when the repo is under the cap`, async () => {
      expect(await repo.values()).toHaveLength(3)
    })

    it(`keys() and entries() without a limit still work when the repo is under the cap`, async () => {
      expect(await repo.keys()).toHaveLength(3)
      expect(await repo.entries()).toHaveLength(3)
    })

    it(`like() and findByPrefix() without a limit still work when the repo is under the cap`, async () => {
      expect(await repo.like(`pref-*`)).toHaveLength(2)
      expect(await repo.findByPrefix(`pref-`)).toHaveLength(2)
    })

    it(`deleteByPrefix() without a limit still works when the repo is under the cap`, async () => {
      expect(await repo.deleteByPrefix(`pref-`)).toBe(2)
    })

    it(`a limit above MAX_MATERIALIZE is rejected even on a small repo`, async () => {
      await expect(repo.values({limit: MAX + 1})).rejects.toBeInstanceOf(LmdbError)
      await expect(repo.values({limit: MAX + 1})).rejects.toThrow(/use {limit} or iterate\(\)/)
    })

    it(`iterate() is never guarded`, async () => {
      const seen: Array<[string, {v: number}]> = []
      for await (const entry of repo.iterate()) {
        if (entry) seen.push(entry as [string, {v: number}])
      }
      expect(seen).toHaveLength(3)
    })
  })

  describe(`oversized repository (150k entries, over the cap)`, () => {
    let tmpDir: string
    let env: LmdbEnv
    let repo: LmdbEnvSub<typeof GuardSchema>

    beforeAll(async () => {
      tmpDir = createTestDir(`lmdb-guardrail-big-`)
      env = new LmdbEnv({path: tmpDir, maxDbs: 5})
      repo = env.register(GuardSchema)
      const entries: Array<[string, {v: number}]> = []
      for (let i = 0; i < 150_000; i++) {
        entries.push([`pref-${String(i).padStart(6, `0`)}`, {v: i}])
      }
      await repo.putMany(entries)
    }, 120_000)

    afterAll(async () => {
      await env.close()
      await rmWithRetry(tmpDir)
    })

    it(`values() without a limit rejects with LmdbError`, async () => {
      await expect(repo.values()).rejects.toBeInstanceOf(LmdbError)
      await expect(repo.values()).rejects.toThrow(/use {limit} or iterate\(\)/)
    })

    it(`keys() and entries() without a limit reject with LmdbError`, async () => {
      await expect(repo.keys()).rejects.toBeInstanceOf(LmdbError)
      await expect(repo.entries()).rejects.toBeInstanceOf(LmdbError)
    })

    it(`like() and findByPrefix() without a limit reject with LmdbError`, async () => {
      await expect(repo.like(`pref-*`)).rejects.toBeInstanceOf(LmdbError)
      await expect(repo.findByPrefix(`pref-`)).rejects.toBeInstanceOf(LmdbError)
    })

    it(`bounded scans below the cap pass on an oversized repo (bounded guard)`, async () => {
      expect(await repo.findByPrefix(`zzz-`)).toHaveLength(0)
      expect(await repo.like(`zzz-*`)).toHaveLength(0)
      expect(await repo.keys({start: `zzz-`, end: `zzz0`})).toHaveLength(0)
      expect(await repo.values({start: `zzz-`, end: `zzz0`})).toHaveLength(0)
    })

    it(`deleteByPrefix() over the cap rejects with LmdbError`, async () => {
      await expect(repo.deleteByPrefix(`pref-`)).rejects.toBeInstanceOf(LmdbError)
    })

    it(`values({limit: 10}) passes the guard`, async () => {
      const values = await repo.values({limit: 10})
      expect(values).toHaveLength(10)
    })

    it(`like('pref:*', {limit: 10}) passes the guard`, async () => {
      const matched = await repo.like(`pref-*`, {limit: 10})
      expect(matched).toHaveLength(10)
    })

    it(`findByPrefix('pref-', {limit: 10}) passes the guard`, async () => {
      const matched = await repo.findByPrefix(`pref-`, {limit: 10})
      expect(matched).toHaveLength(10)
    })

    it(`iterate({limit: 10}) is not guarded`, async () => {
      let count = 0
      for await (const _ of repo.iterate({limit: 10})) count++
      expect(count).toBe(10)
    })

    it(`iterate() without a limit is the escape hatch`, async () => {
      let count = 0
      for await (const _ of repo.iterate()) count++
      expect(count).toBe(150_000)
    })
  })
})
