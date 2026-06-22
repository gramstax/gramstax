/**
 * Concurrent benchmark for @gramstax/lmdb.
 *
 * Simulates N concurrent users (workers) hitting the repository in parallel.
 * Measures throughput (ops/sec) and per-op latency percentiles (p50/p95/p99/max)
 * across the common public API surface.
 *
 * Concurrency levels: 10, 50, 100 (per the request).
 * Methods under test: get, set, delete, has, count, getMany, findByPrefix,
 * like, first, last, update, deleteByPrefix, countByPrefix.
 *
 * Run with: `bun run packages/lmdb/bench/concurrent-bench.ts`
 *
 * @internal
 */

import {mkdtempSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv, LmdbRepository} from "../src"

interface User {
  id: string
  name: string
  age: number
}

class UserRepo extends LmdbRepository<User, string> {
  static dbName = `user-conc-bench`
}

const CONCURRENCY_LEVELS = [10, 50, 100] as const
const TOTAL_ENTRIES = 5_000
const KEY_SPACE = TOTAL_ENTRIES

const OPS_PER_WORKER_PURE_READ = 30
const OPS_PER_WORKER_MIXED = 20

const nsToMs = (ns: bigint): number => Number(ns) / 1_000_000

function fmtMs(ms: number): string {
  if (ms < 0.001) return `${(ms * 1_000_000).toFixed(0)}ns`
  if (ms < 1) return `${(ms * 1_000).toFixed(1)}us`
  if (ms < 1_000) return `${ms.toFixed(2)}ms`
  return `${(ms / 1_000).toFixed(2)}s`
}

interface PercentileResult {
  p50: number
  p95: number
  p99: number
  max: number
  min: number
  throughput: number
  totalMs: number
  count: number
}

function computeStats(latencies: bigint[], totalNs: bigint): PercentileResult {
  const sorted = [...latencies].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const len = sorted.length
  const at = (p: number): bigint => sorted[Math.min(len - 1, Math.floor((len * p) / 100))] ?? 0n
  const count = len
  const totalMs = nsToMs(totalNs)
  return {
    p50: nsToMs(at(50)),
    p95: nsToMs(at(95)),
    p99: nsToMs(at(99)),
    max: nsToMs(sorted[len - 1] ?? 0n),
    min: nsToMs(sorted[0] ?? 0n),
    throughput: count > 0 ? (count / totalMs) * 1_000 : 0,
    totalMs,
    count
  }
}

function printStats(method: string, stats: PercentileResult): void {
  const fmt = (v: number): string => fmtMs(v).padStart(10)
  const thr = `${stats.throughput.toFixed(0).padStart(8)} ops/s`
  const cnt = `(n=${stats.count})`.padEnd(8)
  console.log(
    `    ${method.padEnd(20)} p50=${fmt(stats.p50)} p95=${fmt(stats.p95)} p99=${fmt(stats.p99)} max=${fmt(stats.max)}  ${thr}  ${cnt}`
  )
}

const randomKey = (): string => `u${Math.floor(Math.random() * KEY_SPACE)}`

async function populate(env: LmdbEnv, users: UserRepo): Promise<void> {
  for (let i = 0; i < TOTAL_ENTRIES; i++) {
    const key = `u${i}`
    await users.set(key, {id: key, name: `name${i}`, age: i % 100})
  }
}

type BenchMethod = (
  users: UserRepo,
  workerId: number
) => Promise<unknown>

const METHODS: Record<string, BenchMethod> = {
  get: async (users) => {
    await users.get(randomKey())
  },
  has: async (users) => {
    await users.has(randomKey())
  },
  set: async (users, wid) => {
    const k = `w${wid}:${Math.random().toString(36).slice(2, 8)}`
    await users.set(k, {id: k, name: `n${wid}`, age: wid})
  },
  delete: async (users) => {
    const k = `tmp:${Math.random().toString(36).slice(2, 8)}`
    await users.set(k, {id: k, name: `tmp`, age: 0})
    await users.delete(k)
  },
  count: async (users) => {
    await users.count()
  },
  getMany: async (users) => {
    const keys = Array.from({length: 10}, () => randomKey())
    await users.getMany(keys)
  },
  findByPrefix: async (users) => {
    await users.findByPrefix(`u${Math.floor(Math.random() * 10)}`)
  },
  countByPrefix: async (users) => {
    await users.countByPrefix(`u${Math.floor(Math.random() * 10)}`)
  },
  like: async (users) => {
    await users.like(`u*`)
  },
  first: async (users) => {
    await users.first()
  },
  last: async (users) => {
    await users.last()
  },
  update: async (users) => {
    const k = `u${Math.floor(Math.random() * 1000)}`
    await users.update(k, (u) => u ?? {id: k, name: `init`, age: 0})
  },
  deleteByPrefix: async (users) => {
    const prefix = `__bench_d:${Math.random().toString(36).slice(2, 6)}:`
    await users.set(`${prefix}a`, {id: `a`, name: `a`, age: 0})
    await users.set(`${prefix}b`, {id: `b`, name: `b`, age: 0})
    await users.deleteByPrefix(prefix)
  },
  iterate: async (users) => {
    let count = 0
    for await (const _ of users.iterate({limit: 50})) {
      count++
      if (count >= 50) break
    }
  }
}

const METHODS_PURE_READ: ReadonlyArray<keyof typeof METHODS> = [
  `get`,
  `has`,
  `count`,
  `getMany`,
  `findByPrefix`,
  `countByPrefix`,
  `like`,
  `first`,
  `last`,
  `iterate`
]

const METHODS_MIXED: ReadonlyArray<keyof typeof METHODS> = [
  `get`,
  `set`,
  `delete`,
  `update`,
  `findByPrefix`,
  `countByPrefix`,
  `like`,
  `getMany`
]

async function runConcurrent(
  users: UserRepo,
  method: keyof typeof METHODS,
  concurrency: number,
  opsPerWorker: number
): Promise<PercentileResult> {
  const fn = METHODS[method]
  if (!fn) throw new Error(`Unknown method: ${method}`)
  const latencies: bigint[] = new Array(concurrency * opsPerWorker)
  const wallStart = process.hrtime.bigint()
  await Promise.all(
    Array.from({length: concurrency}, (_, wid) =>
      (async (): Promise<void> => {
        for (let i = 0; i < opsPerWorker; i++) {
          const t0 = process.hrtime.bigint()
          await fn(users, wid)
          latencies[wid * opsPerWorker + i] = process.hrtime.bigint() - t0
        }
      })()
    )
  )
  const wallNs = process.hrtime.bigint() - wallStart
  return computeStats(latencies, wallNs)
}

async function main(): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), `lmdb-conc-bench-`))
  const env = new LmdbEnv({path: tmp, maxDbs: 5})
  await env.open()
  const users = env.register(UserRepo)

  console.log(`Populating ${TOTAL_ENTRIES} entries...`)
  await populate(env, users)
  console.log(`Ready.\n`)

  for (const mode of [`pure-read`, `mixed`] as const) {
    const methods = mode === `pure-read` ? METHODS_PURE_READ : METHODS_MIXED
    const opsPerWorker = mode === `pure-read` ? OPS_PER_WORKER_PURE_READ : OPS_PER_WORKER_MIXED

    console.log(`\n=== ${mode.toUpperCase()} (${opsPerWorker} ops/worker per method) ===\n`)

    for (const concurrency of CONCURRENCY_LEVELS) {
      console.log(`  Concurrency: ${concurrency}`)
      for (const method of methods) {
        const stats = await runConcurrent(users, method, concurrency, opsPerWorker)
        printStats(method, stats)
      }
      console.log(``)
    }
  }

  console.log(`=== MIXED WORKLOAD (all methods interleaved) ===\n`)
  for (const concurrency of CONCURRENCY_LEVELS) {
    const opsPerWorker = OPS_PER_WORKER_MIXED
    const latencies: bigint[] = []
    const wallStart = process.hrtime.bigint()
    await Promise.all(
      Array.from({length: concurrency}, async (_, wid) => {
        for (let i = 0; i < opsPerWorker; i++) {
          const method = METHODS_MIXED[i % METHODS_MIXED.length] ?? `get`
          const fn = METHODS[method]
          if (!fn) continue
          const t0 = process.hrtime.bigint()
          await fn(users, wid)
          latencies.push(process.hrtime.bigint() - t0)
        }
      })
    )
    const wallNs = process.hrtime.bigint() - wallStart
    const stats = computeStats(latencies, wallNs)
    console.log(
      `  concurrency=${String(concurrency).padStart(3)}  p50=${fmtMs(stats.p50).padStart(10)} p95=${fmtMs(stats.p95).padStart(10)} p99=${fmtMs(stats.p99).padStart(10)} max=${fmtMs(stats.max).padStart(10)}  ${stats.throughput.toFixed(0).padStart(8)} ops/s  (n=${stats.count})`
    )
  }

  await env.close()
  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
