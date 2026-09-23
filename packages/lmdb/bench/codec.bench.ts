/**
 * Encoding benchmark — msgpack vs json across object sizes.
 *
 * Per-repo encoding is a schema `static encoding` option, so this bench
 * builds one schema class per encoding via a factory and registers it with
 * `env.register` (the only registration path — `env._createRepo` is gone).
 * `LmdbCodec` no longer exists; custom transforms benchmark via schema
 * `static hookBeforeWrite`/`static hookBeforeRead` in decode.bench.ts.
 *
 * Runner: mitata (`bench`/`group`/`run`) — env setup + populate + byte-size
 * measurement stay outside the measured closures; only a bounded 500-key
 * write window and its sequential reads are timed.
 *
 * The ROW section proves the record codec (plan 017 Phase 2): a plain row
 * schema gets positional array storage automatically, while identity hooks
 * (or a json encoding + identity hooks) measure the uncompressed baseline.
 *
 * Run: bun run packages/lmdb/bench/codec.bench.ts
 *
 * @internal
 */

import {mkdtempSync, readdirSync, rmSync, statSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {bench, do_not_optimize, group} from "mitata"
import {LmdbEnv, LmdbSchema, t} from "../src"
import {benchSize, runBench} from "./_setup"

const N = benchSize(2_000)
const WARMUP = 200
const WINDOW = 500

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

function fmtBytes(b: number): string {
  if (b < 1024) return `${b}B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`
  return `${(b / 1024 / 1024).toFixed(2)}MB`
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

function makeBenchSchema(encoding: string) {
  return class BenchSchema extends LmdbSchema {
    static db = `bench-${encoding}`
    static key = t.string()
    static value = t.string()
    static encoding = encoding
  }
}

interface BenchHandle {
  putSync: (key: string, value: unknown) => void
  get: (key: string) => unknown
}

interface Prepared {
  env: LmdbEnv
  bench: BenchHandle
  dir: string
}

async function setupEncoding<T>(data: T, encoding: `msgpack` | `json`): Promise<Prepared> {
  const dir = mkdtempSync(join(tmpdir(), `enc-${encoding}-`))
  const env = new LmdbEnv({path: dir, maxDbs: 5})

  // Per-repo encoding via schema `static encoding` — a fresh schema class per
  // encoding (fresh env per call, so the dbName registers exactly once). The
  // register() handle is pre-bound to the schema; the bench stores raw payloads
  // of arbitrary shape, so the handle is widened to unknown values (bench-only).
  const bench = env.register(makeBenchSchema(encoding)) as unknown as BenchHandle

  // Warmup + populate (transactionSync) — unmeasured setup
  const CHUNK = 500
  for (let start = 0; start < WARMUP; start += CHUNK) {
    const end = Math.min(start + CHUNK, WARMUP)
    env.rootTransactionSync(() => {
      for (let j = start; j < end; j++) bench.putSync(`w${j}`, data)
    })
  }
  for (let i = 0; i < WARMUP; i++) await bench.get(`w${i}`)

  for (let start = 0; start < N; start += CHUNK) {
    const end = Math.min(start + CHUNK, N)
    env.rootTransactionSync(() => {
      for (let j = start; j < end; j++) bench.putSync(`k${j}`, data)
    })
  }
  for (let i = 0; i < N; i++) await bench.get(`k${i}`)

  return {env, bench, dir}
}

function makeRowSchema(dbName: string, encoding?: string, identityHooks = false) {
  class RowSchema extends LmdbSchema {
    static db = dbName
    static key = t.string()
    static value = {
      id: t.string(),
      name: t.string(),
      email: t.string(),
      bio: t.string(),
      age: t.number(),
      score: t.number(),
      active: t.boolean(),
      verified: t.boolean(),
      tags: t.array<string>(),
      roles: t.array<string>(),
      address: t.object<{street: string; city: string; country: string; zip: string}>(),
      meta: t.object<{loginCount: number; lastSeen: number}>()
    }
  }
  if (encoding !== undefined) RowSchema.encoding = encoding
  if (identityHooks) {
    RowSchema.hookBeforeWrite = (value: unknown): unknown => value
    RowSchema.hookBeforeRead = (raw: unknown): unknown => raw
  }
  return RowSchema
}

async function setupRowVariant<T>(data: T, variant: `record` | `plain` | `json`): Promise<Prepared> {
  const dir = mkdtempSync(join(tmpdir(), `rec-${variant}-`))
  const env = new LmdbEnv({path: dir, maxDbs: 5})
  // `record` registers the bare row schema (codec auto-installed); the
  // baselines add identity hooks to bypass it, `json` also flips encoding.
  const bench = env.register(makeRowSchema(`bench-row-${variant}`, variant === `json` ? `json` : undefined, variant !== `record`)) as unknown as BenchHandle

  const CHUNK = 500
  for (let start = 0; start < WARMUP; start += CHUNK) {
    const end = Math.min(start + CHUNK, WARMUP)
    env.rootTransactionSync(() => {
      for (let j = start; j < end; j++) bench.putSync(`w${j}`, data)
    })
  }
  for (let i = 0; i < WARMUP; i++) await bench.get(`w${i}`)

  for (let start = 0; start < N; start += CHUNK) {
    const end = Math.min(start + CHUNK, N)
    env.rootTransactionSync(() => {
      for (let j = start; j < end; j++) bench.putSync(`k${j}`, data)
    })
  }
  for (let i = 0; i < N; i++) await bench.get(`k${i}`)

  return {env, bench, dir}
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

  const prepared: Prepared[] = []
  const byteSizes: Record<string, Record<string, number>> = {}

  for (const sz of sizes) {
    console.log(`--- ${sz.label} (${sz.desc}) ---`)
    for (const enc of [`msgpack`, `json`] as const) {
      const p = await setupEncoding(sz.data, enc)
      prepared.push(p)
      const bytesPerValue = dirSize(p.dir) / N
      byteSizes[sz.label] ??= {}
      byteSizes[sz.label]![enc] = bytesPerValue

      // Bounded 500-key window — overwrite + sequential read, DB size stays flat
      group(`${sz.label} / ${enc}`, () => {
        bench(`write window (500 puts/1 txn)`, () => {
          p.env.rootTransactionSync(() => {
            for (let j = 0; j < WINDOW; j++) p.bench.putSync(`b${j}`, sz.data)
          })
        })
        bench(`read sequential (500 gets/500 reqs)`, async () => {
          for (let j = 0; j < WINDOW; j++) do_not_optimize(await p.bench.get(`b${j}`))
        }).gc(`inner`)
      })
    }
    const mp = byteSizes[sz.label]!.msgpack!
    const js = byteSizes[sz.label]!.json!
    console.log(`  bytes/val: msgpack=${fmtBytes(mp)}  json=${fmtBytes(js)}  (json=${((js / mp) * 100).toFixed(0)}% of msgpack)`)
    console.log(``)
  }

  console.log(`--- ROW (bot-shaped, 12 fields) record vs plain ---`)
  const rowBytes: Record<string, number> = {}
  for (const variant of [`record`, `plain`, `json`] as const) {
    const p = await setupRowVariant(MEDIUM, variant)
    prepared.push(p)
    rowBytes[variant] = dirSize(p.dir) / N

    group(`ROW / ${variant}`, () => {
      bench(`ROW write window (500 puts/1 txn)`, () => {
        p.env.rootTransactionSync(() => {
          for (let j = 0; j < WINDOW; j++) p.bench.putSync(`r${j}`, MEDIUM)
        })
      })
      bench(`ROW read sequential (500 gets/500 reqs)`, async () => {
        for (let j = 0; j < WINDOW; j++) do_not_optimize(await p.bench.get(`r${j}`))
      }).gc(`inner`)
    })
  }
  console.log(`  bytes/val: record=${fmtBytes(rowBytes.record!)}  plain=${fmtBytes(rowBytes.plain!)}  json=${fmtBytes(rowBytes.json!)}`)
  console.log(``)

  await runBench()

  for (const p of prepared) {
    await p.env.close()
    try {
      rmSync(p.dir, {recursive: true, force: true})
    } catch {
      /* ignore */
    }
  }

  console.log(`Done.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
