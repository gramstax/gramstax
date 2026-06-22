/**
 * LmdbCodec comparison benchmark: JSON vs msgpackr vs LMDB-native msgpack.
 *
 * Tests 4 object sizes across 3 codecs with FRESH env per codec (accurate
 * size measurement). Includes warmup for msgpackr.
 *
 * Run: bun run packages/lmdb/bench/codec-bench.ts
 *
 * @internal
 */

import {mkdtempSync, statSync, rmSync, readdirSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Packr, Unpackr} from "../node_modules/msgpackr"
import {LmdbEnv, LmdbRepository, LmdbCodec, type ICodec} from "../src"

const N = 2_000
const WARMUP = 200

type SchemaSmall = {
  id: string
  name: string
  age: number
  active: boolean
}
type SchemaMedium = {
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
  meta: {loginCount: number; lastSeen: number; preferences: Record<string, boolean>}
}
type SchemaLarge = {
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
type SchemaHuge = {
  id: string
  payload: string
  metadata: Record<string, number>
  rows: Array<{id: number; values: number[]; tags: string[]; nested: {x: number; y: number; z: number}}>
}

const SMALL: SchemaSmall = {id: `u1`, name: `Alice Wonderland`, age: 30, active: true}
const MEDIUM: SchemaMedium = {
  id: `u1`,
  name: `Alice Wonderland`,
  email: `alice@example.com`,
  bio: `Senior engineer with 10 years experience building distributed systems.`,
  age: 30,
  score: 98.5,
  active: true,
  verified: true,
  tags: [`premium`, `beta`, `early-access`, `admin`, `verified`],
  roles: [`user`, `moderator`, `editor`],
  address: {street: `123 Main St`, city: `San Francisco`, country: `USA`, zip: `94105`},
  meta: {loginCount: 142, lastSeen: 1700000000, preferences: {darkMode: true, emailNotif: true, pushNotif: false}}
}
const LARGE: SchemaLarge = {
  id: `art-1`,
  title: `Building a Distributed Key-Value Store on LMDB`,
  description: `A deep dive into building a high-performance KV store using LMDB native bindings, with lessons learned from production deployments.`,
  tags: [`lmdb`, `database`, `performance`, `distributed`, `systems`, `backend`],
  categories: [`engineering`, `tutorial`, `deep-dive`],
  author: {id: `u1`, name: `Alice Wonderland`, bio: `Distributed systems engineer, passionate about performance and correctness.`, avatar: `https://avatars.example.com/u1.png`},
  stats: {views: 15234, likes: 892, shares: 145, comments: 67},
  content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. `.repeat(20),
  metadata: {version: `1.0.0`, license: `MIT`, repository: `https://github.com/example/repo`, homepage: `https://example.com`},
  timestamps: {created: 1700000000, updated: 1700100000, published: 1700200000},
  flags: {draft: false, archived: false, featured: true, pinned: false},
  relatedIds: Array.from({length: 20}, (_, i) => i + 1),
  versions: Array.from({length: 5}, (_, i) => ({v: i + 1, hash: `abc` + i + `def`, author: `u` + i, msg: `Version ` + (i + 1) + ` update`}))
}
const HUGE: SchemaHuge = {
  id: `huge-1`,
  payload: `x`.repeat(2000),
  metadata: Object.fromEntries(Array.from({length: 50}, (_, i) => [`k` + i, i * 100])),
  rows: Array.from({length: 100}, (_, i) => ({id: i, values: Array.from({length: 10}, (_, j) => i * 10 + j), tags: [`tag` + i, `tag` + (i + 1), `tag` + (i + 2)], nested: {x: i * 0.1, y: i * 0.2, z: i * 0.3}}))
}

const packr = new Packr({structuredClone: false})
const unpackr = new Unpackr({structuredClone: false})

const jsonCodec = LmdbCodec.create<unknown, string>(
  (v) => JSON.stringify(v),
  (r) => JSON.parse(r)
)
const msgpackrCodec = LmdbCodec.create<unknown, Buffer>(
  (v) => packr.pack(v),
  (r) => unpackr.unpack(r)
)
const passThroughCodec = LmdbCodec.create<unknown, unknown>(
  (v) => v,
  (r) => r
)

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

async function benchCodecFresh<T>(repo: LmdbRepository<T, string>, data: T, iters: number): Promise<BenchResult> {
  for (let i = 0; i < WARMUP; i++) {
    await repo.set(`warm` + i, data)
    await repo.get(`warm` + i)
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
  return {
    writeP50: nsToMs(at(ws, 50)),
    writeP95: nsToMs(at(ws, 95)),
    writeP99: nsToMs(at(ws, 99)),
    writeMax: nsToMs(ws[ws.length - 1] ?? 0n),
    readP50: nsToMs(at(rs, 50)),
    readP95: nsToMs(at(rs, 95)),
    readP99: nsToMs(at(rs, 99)),
    readMax: nsToMs(rs[rs.length - 1] ?? 0n),
    writeOps: iters / (nsToMs(wallWrite) / 1000),
    readOps: iters / (nsToMs(wallRead) / 1000),
    bytesPerValue: 0
  }
}

function printResult(label: string, name: string, r: BenchResult): void {
  const f = (v: number): string => fmtMs(v).padStart(10)
  const o = (v: number): string => v.toFixed(0).padStart(8)
  console.log(
    `  ` +
      label.padEnd(6) +
      ` ` +
      name.padEnd(8) +
      ` write: p50=` +
      f(r.writeP50) +
      ` p95=` +
      f(r.writeP95) +
      ` p99=` +
      f(r.writeP99) +
      ` max=` +
      f(r.writeMax) +
      `  ` +
      o(r.writeOps) +
      ` ops/s  |  read: p50=` +
      f(r.readP50) +
      ` p95=` +
      f(r.readP95) +
      ` p99=` +
      f(r.readP99) +
      ` max=` +
      f(r.readMax) +
      `  ` +
      o(r.readOps) +
      ` ops/s`
  )
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

async function runFresh<T>(label: string, data: T, repos: {json: any; msgpk: any; pass: any}): Promise<{json: BenchResult; msgpk: BenchResult; pass: BenchResult}> {
  const out: any = {}
  for (const [name, ctor] of [
    [`json`, repos.json],
    [`msgpk`, repos.msgpk],
    [`pass`, repos.pass]
  ] as const) {
    const dir = mkdtempSync(join(tmpdir(), `codec-` + label + `-` + name + `-`))
    const env = new LmdbEnv({path: dir, maxDbs: 5})
    await env.open()
    const repo = env.register(ctor)
    const result = await benchCodecFresh(repo, data, N)
    await env.close()
    const size = dirSize(dir)
    out[name] = {...result, bytesPerValue: size / N}
    printResult(label, name, out[name])
    try {
      rmSync(dir, {recursive: true, force: true})
    } catch {
      //
    }
  }
  return out
}

async function main(): Promise<void> {
  console.log(`\n=== LmdbCodec Benchmark (` + N + ` ops, ` + WARMUP + ` warmup, FRESH env per codec) ===`)
  console.log(`Codecs:`)
  console.log(`  json   = LmdbCodecJson (object -> JSON string -> LMDB wraps in msgpack)`)
  console.log(`  msgpk  = msgpackr (object -> msgpack binary -> LMDB stores as-is)`)
  console.log(`  pass   = passThrough (object -> LMDB encodes with native msgpack)\n`)

  const specs = [
    {
      label: `SMALL`,
      data: SMALL,
      desc: `4 primitive fields`,
      repos: {
        json: class extends LmdbRepository<SchemaSmall, string> {
          static dbName = `s`
          static codec = jsonCodec as ICodec<SchemaSmall>
        },
        msgpk: class extends LmdbRepository<SchemaSmall, string> {
          static dbName = `s`
          static codec = msgpackrCodec as ICodec<SchemaSmall>
        },
        pass: class extends LmdbRepository<SchemaSmall, string> {
          static dbName = `s`
          static codec = passThroughCodec as ICodec<SchemaSmall>
        }
      }
    },
    {
      label: `MEDIUM`,
      data: MEDIUM,
      desc: `12 fields, nested objects, arrays`,
      repos: {
        json: class extends LmdbRepository<SchemaMedium, string> {
          static dbName = `m`
          static codec = jsonCodec as ICodec<SchemaMedium>
        },
        msgpk: class extends LmdbRepository<SchemaMedium, string> {
          static dbName = `m`
          static codec = msgpackrCodec as ICodec<SchemaMedium>
        },
        pass: class extends LmdbRepository<SchemaMedium, string> {
          static dbName = `m`
          static codec = passThroughCodec as ICodec<SchemaMedium>
        }
      }
    },
    {
      label: `LARGE`,
      data: LARGE,
      desc: `40+ fields, 5-level nesting`,
      repos: {
        json: class extends LmdbRepository<SchemaLarge, string> {
          static dbName = `l`
          static codec = jsonCodec as ICodec<SchemaLarge>
        },
        msgpk: class extends LmdbRepository<SchemaLarge, string> {
          static dbName = `l`
          static codec = msgpackrCodec as ICodec<SchemaLarge>
        },
        pass: class extends LmdbRepository<SchemaLarge, string> {
          static dbName = `l`
          static codec = passThroughCodec as ICodec<SchemaLarge>
        }
      }
    },
    {
      label: `HUGE`,
      data: HUGE,
      desc: `~15KB serialized, 100 rows nested`,
      repos: {
        json: class extends LmdbRepository<SchemaHuge, string> {
          static dbName = `h`
          static codec = jsonCodec as ICodec<SchemaHuge>
        },
        msgpk: class extends LmdbRepository<SchemaHuge, string> {
          static dbName = `h`
          static codec = msgpackrCodec as ICodec<SchemaHuge>
        },
        pass: class extends LmdbRepository<SchemaHuge, string> {
          static dbName = `h`
          static codec = passThroughCodec as ICodec<SchemaHuge>
        }
      }
    }
  ]

  for (const spec of specs) {
    console.log(`\n--- ` + spec.label + ` (` + spec.desc + `) ---`)
    const r = await runFresh(spec.label, spec.data, spec.repos)
    console.log(`  bytes/value:  json=` + fmtBytes(r.json.bytesPerValue).padStart(8) + `  msgpk=` + fmtBytes(r.msgpk.bytesPerValue).padStart(8) + `  pass=` + fmtBytes(r.pass.bytesPerValue).padStart(8))
    const wsJ = (r.json.writeP50 / r.msgpk.writeP50).toFixed(2)
    const rsJ = (r.json.readP50 / r.msgpk.readP50).toFixed(2)
    const wsP = (r.json.writeP50 / r.pass.writeP50).toFixed(2)
    const rsP = (r.json.readP50 / r.pass.readP50).toFixed(2)
    console.log(`  json vs msgpk: write=` + wsJ + `x  read=` + rsJ + `x  (>1 = JSON faster)`)
    console.log(`  json vs pass:  write=` + wsP + `x  read=` + rsP + `x  (>1 = JSON faster)`)
    const sizeRatioM = ((r.msgpk.bytesPerValue / r.json.bytesPerValue) * 100).toFixed(0)
    const sizeRatioP = ((r.pass.bytesPerValue / r.json.bytesPerValue) * 100).toFixed(0)
    console.log(`  size: msgpk=` + sizeRatioM + `% of json  |  pass=` + sizeRatioP + `% of json`)
  }

  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
