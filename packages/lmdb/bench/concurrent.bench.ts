/**
 * Concurrent access benchmark — N workers hitting the repository in parallel.
 *
 * Run: bun run packages/lmdb/bench/concurrent.bench.ts
 *
 * @internal
 */

import {mkdtempSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv, LmdbRepository} from "../src"

const POPULATE = 5_000
const CONCURRENCY = [10, 50, 100] as const
const OPS_PER_WORKER = 30

interface User {
  id: string
  name: string
  age: number
}

class UserRepo extends LmdbRepository<User, string> {
  static dbName = `bench-concurrent`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtMs(ms: number): string {
  if (ms < 0.001) return `${(ms * 1_000_000).toFixed(0)}ns`
  if (ms < 1) return `${(ms * 1_000).toFixed(1)}us`
  if (ms < 1_000) return `${ms.toFixed(2)}ms`
  return `${(ms / 1_000).toFixed(2)}s`
}

interface PResult {
  p50: number
  p95: number
  p99: number
  max: number
  min: number
  throughput: number
  totalMs: number
  count: number
}

function compute(latencies: bigint[], wall: bigint): PResult {
  const sorted = [...latencies].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const len = sorted.length
  const at = (p: number): bigint => sorted[Math.min(len - 1, Math.floor((len * p) / 100))] ?? 0n
  const totalMs = Number(wall) / 1_000_000
  return {
    p50: Number(at(50)) / 1_000_000,
    p95: Number(at(95)) / 1_000_000,
    p99: Number(at(99)) / 1_000_000,
    max: Number(sorted[len - 1] ?? 0n) / 1_000_000,
    min: Number(sorted[0] ?? 0n) / 1_000_000,
    throughput: len > 0 ? (len / totalMs) * 1_000 : 0,
    totalMs,
    count: len
  }
}

function printStats(method: string, s: PResult): void {
  const f = (v: number): string => fmtMs(v).padStart(10)
  console.log(`    ${method.padEnd(20)} p50=${f(s.p50)} p95=${f(s.p95)} p99=${f(s.p99)} max=${f(s.max)}  ${s.throughput.toFixed(0).padStart(8)} ops/s  (n=${s.count})`)
}

interface RankResult {
  method: string
  p50: number
  throughput: number
}

function rankMethods(results: RankResult[], conc: number, mode: string): void {
  const sorted = [...results].sort((a, b) => a.p50 - b.p50)
  const winner = sorted[0]
  const loser = sorted[sorted.length - 1]
  const title = conc === 0 ? `-- Ranking ${mode} (all concurrencies) --` : `-- Ranking ${mode} conc=${conc} --`
  if (!winner) {
    console.log(`\n  ${title} — no results\n`)
    return
  }
  if (sorted.length < 2 || !loser) {
    console.log(`\n  ${title}\n  #1 🏆 ${winner.method}  p50=${fmtMs(winner.p50)}  +0.0% vs winner  (WINNER)\n`)
    return
  }
  const speedup = loser.p50 / winner.p50
  console.log(`\n  ${title}`)
  sorted.forEach((r, i) => {
    const isWinner = i === 0
    const isLoser = i === sorted.length - 1
    const vsWinnerPct = ((r.p50 - winner.p50) / winner.p50) * 100
    const tpDelta = ((r.throughput - winner.throughput) / winner.throughput) * 100
    const tag = isWinner ? `🏆` : isLoser ? `💀` : `  `
    const suffix = isWinner ? `+0.0% vs winner  (WINNER)` : `${vsWinnerPct.toFixed(1)}% slower vs winner${isLoser ? `  (LOSER)` : ``}`
    console.log(`  #${i + 1} ${tag} ${r.method.padEnd(20)} p50=${fmtMs(r.p50).padStart(10)}  ${suffix}  throughput ${tpDelta >= 0 ? `+${tpDelta.toFixed(1)}%` : `${tpDelta.toFixed(1)}%`}  ${r.throughput.toFixed(0).padStart(8)} ops/s`)
  })
  console.log(`Winner is ${speedup.toFixed(2)}x faster than loser: ${fmtMs(loser.p50)} vs ${fmtMs(winner.p50)}`)
}

const randKey = (): string => `u${Math.floor(Math.random() * POPULATE)}`

type BenchFn = (users: UserRepo, wid: number) => Promise<unknown>

const METHODS: Record<string, BenchFn> = {
  get: async (u) => {
    await u.get(randKey())
  },
  has: async (u) => {
    await u.has(randKey())
  },
  put: async (u, w) => {
    await u.put(`w${w}:${Math.random().toString(36).slice(2)}`, {id: `w`, name: `w${w}`, age: w})
  },
  delete: async (u) => {
    const k = `tmp:${Math.random().toString(36).slice(2)}`
    await u.put(k, {id: `t`, name: `t`, age: 0})
    await u.delete(k)
  },
  count: async (u) => {
    await u.count()
  },
  getMany: async (u) => {
    await u.getMany(Array.from({length: 10}, () => randKey()))
  },
  findByPrefix: async (u) => {
    await u.findByPrefix(`u${Math.floor(Math.random() * 10)}`)
  },
  countByPrefix: async (u) => {
    await u.countByPrefix(`u${Math.floor(Math.random() * 10)}`)
  },
  like: async (u) => {
    await u.like(`u*`)
  },
  first: async (u) => {
    await u.first()
  },
  last: async (u) => {
    await u.last()
  },
  update: async (u) => {
    const k = `u${Math.floor(Math.random() * 1000)}`
    await u.update(k, (x) => x ?? {id: k, name: `init`, age: 0})
  },
  iterate: async (u) => {
    let c = 0
    for await (const _ of u.iterate({limit: 50})) {
      c++
      if (c >= 50) break
    }
  }
}

const METHODS_READ: ReadonlyArray<keyof typeof METHODS> = [`get`, `has`, `count`, `getMany`, `findByPrefix`, `countByPrefix`, `like`, `first`, `last`, `iterate`]
const METHODS_MIXED: ReadonlyArray<keyof typeof METHODS> = [`get`, `put`, `delete`, `update`, `findByPrefix`, `countByPrefix`, `like`, `getMany`]

async function runConc(users: UserRepo, method: keyof typeof METHODS, concurrency: number): Promise<PResult> {
  const fn = METHODS[method]!
  const latencies: bigint[] = []
  const wallStart = process.hrtime.bigint()
  const totalOps = concurrency * OPS_PER_WORKER
  latencies.length = totalOps
  await Promise.all(
    Array.from({length: concurrency}, (_, wid) =>
      (async () => {
        for (let i = 0; i < OPS_PER_WORKER; i++) {
          const t0 = process.hrtime.bigint()
          await fn(users, wid)
          latencies[wid * OPS_PER_WORKER + i] = process.hrtime.bigint() - t0
        }
      })()
    )
  )
  const wall = process.hrtime.bigint() - wallStart
  return compute(latencies, wall)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), `lmdb-bench-conc-`))
  const env = new LmdbEnv({path: tmp, maxDbs: 5})
  const users = env.register(UserRepo)

  console.log(`Populating ${POPULATE} entries (txSync)...`)
  const CHUNK = 500
  for (let start = 0; start < POPULATE; start += CHUNK) {
    const end = Math.min(start + CHUNK, POPULATE)
    users.env.transactionSync(() => {
      for (let i = start; i < end; i++) {
        users.env.putSync(`u${i}`, {id: `u${i}`, name: `name${i}`, age: i % 100})
      }
    })
  }
  console.log(`Ready.\n`)

  const grand: Record<string, RankResult[]> = {"pure-read": [], mixed: []}
  for (const mode of [`pure-read`, `mixed`] as const) {
    const methods = mode === `pure-read` ? METHODS_READ : METHODS_MIXED
    console.log(`\n=== ${mode.toUpperCase()} (${OPS_PER_WORKER} ops/worker) ===\n`)
    for (const conc of CONCURRENCY) {
      console.log(`  Concurrency: ${conc}`)
      const concResults: RankResult[] = []
      for (const method of methods) {
        const r = await runConc(users, method, conc)
        printStats(method, r)
        concResults.push({method, p50: r.p50, throughput: r.throughput})
      }
      rankMethods(concResults, conc, mode)
      grand[mode]!.push(...concResults)
      console.log(``)
    }
  }

  // Grand ranking per mode across all concurrency levels
  for (const mode of [`pure-read`, `mixed`] as const) {
    rankMethods(grand[mode]!, 0, mode)
  }

  // Mixed interleaved
  console.log(`=== MIXED INTERLEAVED ===\n`)
  for (const conc of CONCURRENCY) {
    const latencies: bigint[] = []
    const wallStart = process.hrtime.bigint()
    await Promise.all(
      Array.from({length: conc}, async (_, wid) => {
        for (let i = 0; i < OPS_PER_WORKER; i++) {
          const method = METHODS_MIXED[i % METHODS_MIXED.length]!
          const fn = METHODS[method]!
          const t0 = process.hrtime.bigint()
          await fn(users, wid)
          latencies.push(process.hrtime.bigint() - t0)
        }
      })
    )
    const s = compute(latencies, process.hrtime.bigint() - wallStart)
    console.log(`  concurrency=${String(conc).padStart(3)}  p50=${fmtMs(s.p50).padStart(10)} p95=${fmtMs(s.p95).padStart(10)} p99=${fmtMs(s.p99).padStart(10)} max=${fmtMs(s.max).padStart(10)}  ${s.throughput.toFixed(0).padStart(8)} ops/s  (n=${s.count})`)
  }

  await env.close()
  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
