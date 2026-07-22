/**
 * Encoding benchmark — msgpack vs json vs binary across object sizes.
 *
 * Run: bun run packages/lmdb/bench/codec.bench.ts
 *
 * @internal
 */

import {mkdtempSync, statSync, rmSync, readdirSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv, LmdbRepository} from "../src"

const N = 2_000
const WARMUP = 200

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

interface Small {
  id: string
  name: string
  age: number
  active: boolean
}
interface Medium {
  id: string
  name: string
  email: string
  bio: string
  age: number
  score: number
  active: boolean
  verified: boolean
  tags: string[]
  roles: string[]
  address: {street: string; city: string; country: string; zip: string}
  meta: {loginCount: number; lastSeen: number}
}
interface Large {
  id: string
  title: string
  description: string
  tags: string[]
  categories: string[]
  author: {id: string; name: string; bio: string; avatar: string}
  stats: {views: number; likes: number; shares: number; comments: number}
  content: string
  metadata: Record<string, string>
  timestamps: {created: number; updated: number; published: number}
  flags: {draft: boolean; archived: boolean; featured: boolean; pinned: boolean}
  relatedIds: number[]
  versions: Array<{v: number; hash: string; author: string; msg: string}>
}
interface Huge {
  id: string
  payload: string
  metadata: Record<string, number>
  rows: Array<{id: number; values: number[]; tags: string[]; nested: {x: number; y: number; z: number}}>
}

const SMALL: Small = {id: `u1`, name: `Alice`, age: 30, active: true}
const MEDIUM: Medium = {
  id: `u1`,
  name: `Alice`,
  email: `alice@example.com`,
  bio: `Senior engineer, 10 years exp.`,
  age: 30,
  score: 98.5,
  active: true,
  verified: true,
  tags: [`premium`, `beta`, `early-access`, `admin`],
  roles: [`user`, `moderator`],
  address: {street: `123 Main St`, city: `SF`, country: `USA`, zip: `94105`},
  meta: {loginCount: 142, lastSeen: 1700000000}
}
const LARGE: Large = {
  id: `art-1`,
  title: `Building a KV Store on LMDB`,
  description: `Deep dive into building a high-performance KV store.`.repeat(5),
  tags: [`lmdb`, `database`, `performance`],
  categories: [`engineering`, `tutorial`],
  author: {id: `u1`, name: `Alice`, bio: `Engineer`, avatar: `https://example.com/avatar.png`},
  stats: {views: 15234, likes: 892, shares: 145, comments: 67},
  content: `Lorem ipsum dolor sit amet. `.repeat(50),
  metadata: {version: `1.0.0`, license: `MIT`},
  timestamps: {created: 1700000000, updated: 1700100000, published: 1700200000},
  flags: {draft: false, archived: false, featured: true, pinned: false},
  relatedIds: Array.from({length: 20}, (_, i) => i + 1),
  versions: Array.from({length: 5}, (_, i) => ({v: i + 1, hash: `abc${i}def`, author: `u${i}`, msg: `v${i + 1}`}))
}
const HUGE: Huge = {
  id: `huge-1`,
  payload: `x`.repeat(2000),
  metadata: Object.fromEntries(Array.from({length: 50}, (_, i) => [`k${i}`, i * 100])),
  rows: Array.from({length: 100}, (_, i) => ({id: i, values: Array.from({length: 10}, (_, j) => i * 10 + j), tags: [`tag${i}`], nested: {x: i * 0.1, y: i * 0.2, z: i * 0.3}}))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtMs(ms: number): string {
  if (ms < 0.001) return `${Math.round(ms * 1_000_000)}ns`
  if (ms < 1) return `${(ms * 1_000).toFixed(1)}us`
  if (ms < 1_000) return `${ms.toFixed(2)}ms`
  return `${(ms / 1_000).toFixed(2)}s`
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b}B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`
  return `${(b / 1024 / 1024).toFixed(2)}MB`
}

interface BenchResult {
  writeP50: number
  writeP95: number
  writeP99: number
  writeMax: number
  readP50: number
  readP95: number
  readP99: number
  readMax: number
  writeOps: number
  readOps: number
  bytesPerValue: number
}

function dirSize(path: string): number {
  let total = 0
  const walk = (p: string): void => {
    const stat = statSync(p)
    if (stat.isDirectory()) {
      for (const e of readdirSync(p)) walk(join(p, e))
    } else {
      total += stat.size
    }
  }
  walk(path)
  return total
}

function printResult(label: string, enc: string, r: BenchResult): void {
  const f = (v: number): string => fmtMs(v).padStart(10)
  const o = (v: number): string => v.toFixed(0).padStart(8)
  console.log(`  ${label.padEnd(6)} ${enc.padEnd(8)} write: p50=${f(r.writeP50)} p95=${f(r.writeP95)} p99=${f(r.writeP99)} max=${f(r.writeMax)}  ${o(r.writeOps)} ops/s  |  read: p50=${f(r.readP50)} p95=${f(r.readP95)} p99=${f(r.readP99)} max=${f(r.readMax)}  ${o(r.readOps)} ops/s`)
}

async function benchEncoding<T>(data: T, encoding: `msgpack` | `json` | `binary`): Promise<BenchResult> {
  const dir = mkdtempSync(join(tmpdir(), `enc-${encoding}-`))
  const env = new LmdbEnv({path: dir, maxDbs: 5})

  class BenchRepo extends LmdbRepository<T, string> {
    static dbName = `bench-${encoding}`
    static encoding = encoding
  }
  const repo = env.register(BenchRepo)

  // Warmup writes (transactionSync), reads sequential
  const CHUNK = 500
  for (let start = 0; start < WARMUP; start += CHUNK) {
    const end = Math.min(start + CHUNK, WARMUP)
    repo.env.transactionSync(() => {
      for (let j = start; j < end; j++) repo.env.putSync(`w${j}`, data)
    })
  }

  // console.log(111111111, repo.get(`w5`))
  // process.exit()

  for (let i = 0; i < WARMUP; i++) await repo.get(`w${i}`)

  // Timed writes (transactionSync), reads sequential
  const writeLat: bigint[] = []
  const readLat: bigint[] = []
  for (let start = 0; start < N; start += CHUNK) {
    const end = Math.min(start + CHUNK, N)
    const t0 = process.hrtime.bigint()
    repo.env.transactionSync(() => {
      for (let j = start; j < end; j++) repo.env.putSync(`k${j}`, data)
    })
    writeLat.push(process.hrtime.bigint() - t0)
    for (let i = start; i < end; i++) {
      const t1 = process.hrtime.bigint()
      await repo.get(`k${i}`)
      readLat.push(process.hrtime.bigint() - t1)
    }
  }

  const srt = (arr: bigint[]): bigint[] => [...arr].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const at = (s: bigint[], p: number): bigint => s[Math.min(s.length - 1, Math.floor((s.length * p) / 100))] ?? 0n
  const ws = srt(writeLat)
  const rs = srt(readLat)
  const wallW = ws.reduce((a, b) => a + b, 0n)
  const wallR = rs.reduce((a, b) => a + b, 0n)
  const size = dirSize(dir)

  await env.close()
  try {
    rmSync(dir, {recursive: true, force: true})
  } catch {
    /* ignore */
  }

  const nsToMs = (n: bigint): number => Number(n) / 1_000_000
  return {
    writeP50: nsToMs(at(ws, 50)),
    writeP95: nsToMs(at(ws, 95)),
    writeP99: nsToMs(at(ws, 99)),
    writeMax: nsToMs(ws[ws.length - 1] ?? 0n),
    readP50: nsToMs(at(rs, 50)),
    readP95: nsToMs(at(rs, 95)),
    readP99: nsToMs(at(rs, 99)),
    readMax: nsToMs(rs[rs.length - 1] ?? 0n),
    writeOps: N / (nsToMs(wallW) / 1000),
    readOps: N / (nsToMs(wallR) / 1000),
    bytesPerValue: size / N
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n=== Encoding benchmark (${N} ops, ${WARMUP} warmup, fresh env per encoding) ===\n`)

  const sizes = [
    {label: `SMALL`, data: SMALL, desc: `4 fields`},
    {label: `MEDIUM`, data: MEDIUM, desc: `12 fields, nested`},
    {label: `LARGE`, data: LARGE, desc: `40+ fields, nested arrays`},
    {label: `HUGE`, data: HUGE, desc: `~15KB, 100 rows`}
  ]

  for (const sz of sizes) {
    console.log(`--- ${sz.label} (${sz.desc}) ---`)
    const results: Partial<Record<string, BenchResult>> = {}
    for (const enc of [`msgpack`, `json`] as const) {
      results[enc] = await benchEncoding(sz.data, enc)
      printResult(sz.label, enc, results[enc]!)
    }
    const mp = results.msgpack!
    const js = results.json!
    console.log(`  bytes/val:  msgpack=${fmtBytes(mp.bytesPerValue).padStart(8)}  json=${fmtBytes(js.bytesPerValue).padStart(8)}` + `  (json=${((js.bytesPerValue / mp.bytesPerValue) * 100).toFixed(0)}% of msgpack)`)
    const wr = js.writeP50 / mp.writeP50
    const rd = js.readP50 / mp.readP50
    const wrLabel = wr > 1.05 ? `json ${wr.toFixed(2)}x faster` : mp.writeP50 / js.writeP50 > 1.05 ? `msgpack ${(mp.writeP50 / js.writeP50).toFixed(2)}x faster` : `similar`
    const rdLabel = rd > 1.05 ? `json ${rd.toFixed(2)}x faster` : mp.readP50 / js.readP50 > 1.05 ? `msgpack ${(mp.readP50 / js.readP50).toFixed(2)}x faster` : `similar`
    const sizeRatio = ((js.bytesPerValue / mp.bytesPerValue) * 100).toFixed(0)
    const sizeLabel = Number(sizeRatio) < 95 ? `msgpack ${(mp.bytesPerValue / js.bytesPerValue).toFixed(1)}x smaller` : Number(sizeRatio) > 105 ? `json ${(js.bytesPerValue / mp.bytesPerValue).toFixed(1)}x larger` : `similar`
    console.log(`  write: ${wrLabel.padEnd(30)} read: ${rdLabel.padEnd(30)} size: ${sizeLabel}  (json=${sizeRatio}% of msgpack)\n`)
  }

  console.log(`Done.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
