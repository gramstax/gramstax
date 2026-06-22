/**
 * Encoding comparison benchmark: LMDB native `msgpack` vs `json` vs `binary`.
 *
 * Tests 4 object sizes with each of LMDB's native encodings to show where
 * each wins. No external codec dependency — LMDB handles encoding per sub-DB.
 *
 * Run: bun run packages/lmdb/bench/codec-bench.ts
 *
 * @internal
 */

import {mkdtempSync, statSync, rmSync, readdirSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv, LmdbRepository} from "../src"

const N = 2_000
const WARMUP = 200

interface Small { id: string; name: string; age: number; active: boolean }
interface Medium { id: string; name: string; email: string; bio: string; age: number; score: number; active: boolean; verified: boolean; tags: string[]; roles: string[]; address: {street: string; city: string; country: string; zip: string}; meta: {loginCount: number; lastSeen: number; preferences: Record<string, boolean>} }
interface Large { id: string; title: string; description: string; tags: string[]; categories: string[]; author: {id: string; name: string; bio: string; avatar: string}; stats: {views: number; likes: number; shares: number; comments: number}; content: string; metadata: Record<string, string>; timestamps: {created: number; updated: number; published: number}; flags: {draft: boolean; archived: boolean; featured: boolean; pinned: boolean}; relatedIds: number[]; versions: Array<{v: number; hash: string; author: string; msg: string}> }
interface Huge { id: string; payload: string; metadata: Record<string, number>; rows: Array<{id: number; values: number[]; tags: string[]; nested: {x: number; y: number; z: number}}> }

const SMALL: Small = {id: `u1`, name: `Alice Wonderland`, age: 30, active: true}
const MEDIUM: Medium = {id: `u1`, name: `Alice Wonderland`, email: `alice@example.com`, bio: `Senior engineer with 10 years experience building distributed systems.`, age: 30, score: 98.5, active: true, verified: true, tags: [`premium`, `beta`, `early-access`, `admin`, `verified`], roles: [`user`, `moderator`, `editor`], address: {street: `123 Main St`, city: `San Francisco`, country: `USA`, zip: `94105`}, meta: {loginCount: 142, lastSeen: 1700000000, preferences: {darkMode: true, emailNotif: true, pushNotif: false}}}
const LARGE: Large = {id: `art-1`, title: `Building a Distributed Key-Value Store on LMDB`, description: `A deep dive into building a high-performance KV store using LMDB native bindings, with lessons learned from production deployments.`, tags: [`lmdb`, `database`, `performance`, `distributed`, `systems`, `backend`], categories: [`engineering`, `tutorial`, `deep-dive`], author: {id: `u1`, name: `Alice Wonderland`, bio: `Distributed systems engineer, passionate about performance and correctness.`, avatar: `https://avatars.example.com/u1.png`}, stats: {views: 15234, likes: 892, shares: 145, comments: 67}, content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. `.repeat(20), metadata: {version: `1.0.0`, license: `MIT`, repository: `https://github.com/example/repo`, homepage: `https://example.com`}, timestamps: {created: 1700000000, updated: 1700100000, published: 1700200000}, flags: {draft: false, archived: false, featured: true, pinned: false}, relatedIds: Array.from({length: 20}, (_, i) => i + 1), versions: Array.from({length: 5}, (_, i) => ({v: i + 1, hash: `abc` + i + `def`, author: `u` + i, msg: `Version ` + (i + 1) + ` update`}))}
const HUGE: Huge = {id: `huge-1`, payload: `x`.repeat(2000), metadata: Object.fromEntries(Array.from({length: 50}, (_, i) => [`k` + i, i * 100])), rows: Array.from({length: 100}, (_, i) => ({id: i, values: Array.from({length: 10}, (_, j) => i * 10 + j), tags: [`tag` + i, `tag` + (i + 1), `tag` + (i + 2)], nested: {x: i * 0.1, y: i * 0.2, z: i * 0.3}}))}

const nsToMs = (ns: bigint): number => Number(ns) / 1_000_000

function fmtMs(ms: number): string {
  if (ms < 0.001) return Math.round(ms * 1_000_000) + `ns`
  if (ms < 1) return (ms * 1_000).toFixed(1) + `us`
  if (ms < 1000) return ms.toFixed(2) + `ms`
  return (ms / 1000).toFixed(2) + `s`
}

function fmtBytes(b: number): string {
  if (b < 1024) return b + `B`
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + `KB`
  return (b / 1024 / 1024).toFixed(2) + `MB`
}

interface BenchResult {
  writeP50: number; writeP95: number; writeP99: number; writeMax: number
  readP50: number; readP95: number; readP99: number; readMax: number
  writeOps: number; readOps: number
  bytesPerValue: number
}

async function benchEncodingFresh<T>(data: T, encoding: `msgpack` | `json` | `binary`, iters: number): Promise<BenchResult> {
  const dir = mkdtempSync(join(tmpdir(), `enc-bench-${encoding}-`))
  const env = new LmdbEnv({path: dir, maxDbs: 5})
  await env.open()

  class BenchRepo extends LmdbRepository<T, string> {
    static dbName = `bench-${encoding}`
    static encoding = encoding
  }
  const repo = env.register(BenchRepo)

  for (let i = 0; i < WARMUP; i++) {
    await repo.set(`w` + i, data)
    await repo.get(`w` + i)
  }

  const writeLatencies: bigint[] = []
  const readLatencies: bigint[] = []
  for (let i = 0; i < iters; i++) {
    const key = `k` + i
    const t0 = process.hrtime.bigint()
    await repo.set(key, data)
    writeLatencies.push(process.hrtime.bigint() - t0)
    const t1 = process.hrtime.bigint()
    await repo.get(key)
    readLatencies.push(process.hrtime.bigint() - t1)
  }
  const sorted = (arr: bigint[]): bigint[] => [...arr].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const at = (s: bigint[], p: number): bigint => s[Math.min(s.length - 1, Math.floor((s.length * p) / 100))] ?? 0n
  const ws = sorted(writeLatencies)
  const rs = sorted(readLatencies)
  const wallWrite = ws.reduce((a, b) => a + b, 0n)
  const wallRead = rs.reduce((a, b) => a + b, 0n)
  const size = dirSize(dir)

  await env.close()
  try { rmSync(dir, {recursive: true, force: true}) } catch { /* ignore */ }

  return {
    writeP50: nsToMs(at(ws, 50)), writeP95: nsToMs(at(ws, 95)), writeP99: nsToMs(at(ws, 99)), writeMax: nsToMs(ws[ws.length - 1] ?? 0n),
    readP50: nsToMs(at(rs, 50)), readP95: nsToMs(at(rs, 95)), readP99: nsToMs(at(rs, 99)), readMax: nsToMs(rs[rs.length - 1] ?? 0n),
    writeOps: iters / (nsToMs(wallWrite) / 1000), readOps: iters / (nsToMs(wallRead) / 1000),
    bytesPerValue: size / iters
  }
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

function printResult(label: string, encoding: string, r: BenchResult): void {
  const f = (v: number): string => fmtMs(v).padStart(10)
  const o = (v: number): string => v.toFixed(0).padStart(8)
  console.log(`  ` + label.padEnd(6) + ` ` + encoding.padEnd(8) + ` write: p50=` + f(r.writeP50) + ` p95=` + f(r.writeP95) + ` p99=` + f(r.writeP99) + ` max=` + f(r.writeMax) + `  ` + o(r.writeOps) + ` ops/s  |  read: p50=` + f(r.readP50) + ` p95=` + f(r.readP95) + ` p99=` + f(r.readP99) + ` max=` + f(r.readMax) + `  ` + o(r.readOps) + ` ops/s`)
}

async function main(): Promise<void> {
  console.log(`\n=== LMDB Encoding Benchmark (` + N + ` ops, ` + WARMUP + ` warmup, FRESH env per encoding) ===`)
  console.log(`Encodings (LMDB native — no external codec):`)
  console.log(`  msgpack = LMDB's default (msgpackr — supports Date/Map/Set/BigInt)`)
  console.log(`  json    = LMDB native JSON.stringify/parse (no double encoding)`)
  console.log(`  binary  = LMDB stores raw Buffer (for already-encoded data)\n`)

  const sizes = [
    {label: `SMALL`, data: SMALL, desc: `4 primitive fields`},
    {label: `MEDIUM`, data: MEDIUM, desc: `12 fields, nested objects, arrays`},
    {label: `LARGE`, data: LARGE, desc: `40+ fields, 5-level nesting`},
    {label: `HUGE`, data: HUGE, desc: `~15KB serialized, 100 rows nested`}
  ]

  for (const sz of sizes) {
    console.log(`\n--- ` + sz.label + ` (` + sz.desc + `) ---`)
    const results: any = {}
    for (const enc of [`msgpack`, `json`] as const) {
      results[enc] = await benchEncodingFresh(sz.data, enc, N)
      printResult(sz.label, enc, results[enc])
    }
    console.log(`  bytes/value:  msgpack=` + fmtBytes(results.msgpack.bytesPerValue).padStart(8) + `  json=` + fmtBytes(results.json.bytesPerValue).padStart(8))
    const wrSpeedup = (results.json.writeP50 / results.msgpack.writeP50).toFixed(2)
    const rdSpeedup = (results.json.readP50 / results.msgpack.readP50).toFixed(2)
    console.log(`  json vs msgpack: write=` + wrSpeedup + `x  read=` + rdSpeedup + `x  (>1 = JSON faster)`)
    const sizeRatio = (results.json.bytesPerValue / results.msgpack.bytesPerValue * 100).toFixed(0)
    console.log(`  size: json=` + sizeRatio + `% of msgpack`)
  }

  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})