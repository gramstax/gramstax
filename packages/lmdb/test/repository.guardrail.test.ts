/**
 * B4 — Materialization guardrail (Phase 2).
 *
 * Range queries that would materialize an unbounded or oversized array into
 * memory are rejected with LmdbMaterializationError; iterate() remains the
 * escape hatch. The guard is size-aware: an unbounded query only trips when
 * the repository actually holds more than MAX_MATERIALIZE entries, so small
 * repositories keep working without a limit.
 */
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbMaterializationError} from "../src/errors"
import {LmdbRepository} from "../src/repository"
import {createTestDir, rmWithRetry} from "./test-helpers"

class GuardRepo extends LmdbRepository<{v: number}, string> {
  static dbName = `guardrail-test`
}

const MAX = LmdbRepository.MAX_MATERIALIZE ?? 100_000

describe(`LmdbRepository materialization guardrail`, () => {
  describe(`small repository (under the cap)`, () => {
    let tmpDir: string
    let env: LmdbEnv
    let repo: GuardRepo

    beforeEach(async () => {
      tmpDir = createTestDir(`lmdb-guardrail-small-`)
      env = new LmdbEnv({path: tmpDir, maxDbs: 5})
      repo = env.register(GuardRepo)
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
      await expect(repo.values({limit: MAX + 1})).rejects.toBeInstanceOf(LmdbMaterializationError)
      await expect(repo.values({limit: MAX + 1})).rejects.toThrow(/use {limit} or iterate\(\)/)
    })

    it(`iterate() is never guarded`, async () => {
      const seen: Array<[string, {v: number}]> = []
      for await (const entry of repo.iterate()) seen.push(entry)
      expect(seen).toHaveLength(3)
    })
  })

  describe(`oversized repository (150k entries, over the cap)`, () => {
    let tmpDir: string
    let env: LmdbEnv
    let repo: GuardRepo

    beforeAll(async () => {
      tmpDir = createTestDir(`lmdb-guardrail-big-`)
      env = new LmdbEnv({path: tmpDir, maxDbs: 5})
      repo = env.register(GuardRepo)
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

    it(`values() without a limit rejects with LmdbMaterializationError`, async () => {
      await expect(repo.values()).rejects.toBeInstanceOf(LmdbMaterializationError)
      await expect(repo.values()).rejects.toThrow(/use {limit} or iterate\(\)/)
    })

    it(`keys() and entries() without a limit reject with LmdbMaterializationError`, async () => {
      await expect(repo.keys()).rejects.toBeInstanceOf(LmdbMaterializationError)
      await expect(repo.entries()).rejects.toBeInstanceOf(LmdbMaterializationError)
    })

    it(`like() and findByPrefix() without a limit reject with LmdbMaterializationError`, async () => {
      await expect(repo.like(`pref-*`)).rejects.toBeInstanceOf(LmdbMaterializationError)
      await expect(repo.findByPrefix(`pref-`)).rejects.toBeInstanceOf(LmdbMaterializationError)
    })

    it(`deleteByPrefix() over the cap rejects with LmdbMaterializationError`, async () => {
      await expect(repo.deleteByPrefix(`pref-`)).rejects.toBeInstanceOf(LmdbMaterializationError)
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
