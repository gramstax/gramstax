/**
 * Read-hook overhead benchmark — measure cost of identity vs hookBeforeRead in range queries.
 *
 * Why: LmdbRepository.values()/entries()/iterate() always do `.map(e => _readValue(e.value))`
 * even when no hook is configured (identity). This bench quantifies that overhead vs raw
 * LMDB range without the read hook and vs a real transform (Date -> number).
 *
 * `LmdbCodec` was removed in the schema-only API — the real transform side is now a schema
 * `static hookBeforeWrite`/`static hookBeforeRead` pair, which forwards to the same repository codec opts.
 *
 * Run: bun run packages/lmdb/bench/decode.bench.ts
 *
 * @internal
 */

import {mkdtempSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv, LmdbSchema, t} from "../src"
import {MAX_MATERIALIZE} from "../src/types"

const POPULATE = Number(process.env.BENCH_N ?? 500_000)
const ITERS = 300
const WARMUP = 30
const ITERS_LARGE = 20
const WARMUP_LARGE = 5

class PlainSchema extends LmdbSchema {
  static db = `bench-decode-plain`
  static key = t.string()
  static value = {
    id: t.string(),
    val: t.number()
  }
}

class DateSchema extends LmdbSchema {
  static db = `bench-decode-date`
  static key = t.string()
  static value = {at: t.date()}
  static hookBeforeWrite = (row: unknown): unknown => ({at: (row as {at: Date}).at.getTime()})
  static hookBeforeRead = (raw: unknown): unknown => ({at: new Date((raw as {at: number}).at)})
}

// Row shape of PlainSchema — used by the pure-JS micro benchmarks below.
type Plain = {id: string; val: number}

function fmtNs(ns: bigint): string {
  const n = Number(ns)
  if (n < 1_000) return `${n}ns`
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}us`
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}ms`
  return `${(n / 1_000_000_000).toFixed(2)}s`
}

interface BenchResult {
  label: string
  median: bigint
  min: bigint
  max: bigint
  mean: bigint
}

async function bench(label: string, fn: () => Promise<unknown> | unknown, iterations = ITERS, warmup = WARMUP): Promise<BenchResult> {
  for (let i = 0; i < warmup; i++) await fn()
  const samples: bigint[] = []
  for (let i = 0; i < iterations; i++) {
    const t0 = process.hrtime.bigint()
    await fn()
    samples.push(process.hrtime.bigint() - t0)
  }
  samples.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const median = samples[Math.floor(samples.length / 2)] ?? 0n
  const min = samples[0] ?? 0n
  const max = samples[samples.length - 1] ?? 0n
  const mean = samples.reduce((a, b) => a + b, 0n) / BigInt(samples.length)
  console.log(`  ${label.padEnd(48)} median=${fmtNs(median).padStart(10)} min=${fmtNs(min).padStart(10)} max=${fmtNs(max).padStart(10)} mean=${fmtNs(mean).padStart(10)}`)
  return {label, median, min, max, mean}
}

function rankAndPrint(results: BenchResult[], title = `benchmark`): void {
  const sorted = [...results].sort((a, b) => (a.median < b.median ? -1 : a.median > b.median ? 1 : 0))
  const winner = sorted[0]
  const loser = sorted[sorted.length - 1]
  if (!winner) {
    console.log(`\n--- Ranking: ${title} (by median) — no results ---\n`)
    return
  }
  if (sorted.length < 2 || !loser) {
    console.log(`\n┌─ Ranking: ${title} (by median) ─┐`)
    console.log(`│ #1 🏆 ${winner.label} │ median=${fmtNs(winner.median)} │ WINNER │`)
    console.log(`└─────────────────────────────────────┘`)
    return
  }
  const ratio = Number(loser.median) / Number(winner.median)
  const vsLoserPct = (Number(loser.median - winner.median) / Number(loser.median)) * 100

  // --- build table rows ---
  type Row = {rank: string; label: string; median: string; min: string; max: string; mean: string; vs: string; tag: string}
  const rows: Row[] = sorted.map((r, i) => {
    const isWinner = i === 0
    const isLoser = i === sorted.length - 1
    const vsWinnerPct = (Number(r.median - winner.median) / Number(winner.median)) * 100
    const vs = isWinner ? `+0.0%` : `+${vsWinnerPct.toFixed(1)}%`
    const tag = isWinner ? `🏆 WINNER` : isLoser ? `💀 LOSER` : ``
    const rank = isWinner ? `#${i + 1} 🏆` : isLoser ? `#${i + 1} 💀` : `#${i + 1}`
    return {
      rank,
      label: r.label,
      median: fmtNs(r.median),
      min: fmtNs(r.min),
      max: fmtNs(r.max),
      mean: fmtNs(r.mean),
      vs,
      tag
    }
  })

  // column widths (header + rows)
  const headers: Row = {rank: `Rank`, label: `Label`, median: `Median`, min: `Min`, max: `Max`, mean: `Mean`, vs: `vs Winner`, tag: `Status`}
  const allRows = [headers, ...rows]
  const w = {
    rank: Math.max(...allRows.map((r) => r.rank.length)),
    label: Math.max(...allRows.map((r) => r.label.length), 20),
    median: Math.max(...allRows.map((r) => r.median.length)),
    min: Math.max(...allRows.map((r) => r.min.length)),
    max: Math.max(...allRows.map((r) => r.max.length)),
    mean: Math.max(...allRows.map((r) => r.mean.length)),
    vs: Math.max(...allRows.map((r) => r.vs.length)),
    tag: Math.max(...allRows.map((r) => r.tag.length))
  }
  // clamp label to 48 for readability
  w.label = Math.min(w.label, 48)

  const pad = (s: string, n: number, right = false): string => (right ? s.padStart(n) : s.padEnd(n))
  const line = (_c: string, fill = `─`): string => `├${fill.repeat(w.rank + 2)}┼${fill.repeat(w.label + 2)}┼${fill.repeat(w.median + 2)}┼${fill.repeat(w.min + 2)}┼${fill.repeat(w.max + 2)}┼${fill.repeat(w.mean + 2)}┼${fill.repeat(w.vs + 2)}┼${fill.repeat(w.tag + 2)}┤`
  const top = `┌${`─`.repeat(w.rank + 2)}┬${`─`.repeat(w.label + 2)}┬${`─`.repeat(w.median + 2)}┬${`─`.repeat(w.min + 2)}┬${`─`.repeat(w.max + 2)}┬${`─`.repeat(w.mean + 2)}┬${`─`.repeat(w.vs + 2)}┬${`─`.repeat(w.tag + 2)}┐`
  const bottom = `└${`─`.repeat(w.rank + 2)}┴${`─`.repeat(w.label + 2)}┴${`─`.repeat(w.median + 2)}┴${`─`.repeat(w.min + 2)}┴${`─`.repeat(w.max + 2)}┴${`─`.repeat(w.mean + 2)}┴${`─`.repeat(w.vs + 2)}┴${`─`.repeat(w.tag + 2)}┘`
  const fmtRow = (r: Row): string => `│ ${pad(r.rank, w.rank)} │ ${pad(r.label.slice(0, 48), w.label)} │ ${pad(r.median, w.median, true)} │ ${pad(r.min, w.min, true)} │ ${pad(r.max, w.max, true)} │ ${pad(r.mean, w.mean, true)} │ ${pad(r.vs, w.vs, true)} │ ${pad(r.tag, w.tag)} │`

  console.log(`\n┌─ Ranking: ${title} (by median, ${sorted.length} entries) ─${`─`.repeat(Math.max(0, 40 - title.length))}┐`)
  console.log(top)
  console.log(fmtRow(headers))
  console.log(line(`┼`))
  for (const r of rows) console.log(fmtRow(r))
  console.log(bottom)
  console.log(`│ Winner is ${ratio.toFixed(2)}x faster than loser: ${fmtNs(loser.median)} vs ${fmtNs(winner.median)} │ loser +${((Number(loser.median) / Number(winner.median) - 1) * 100).toFixed(0)}% vs winner │ winner saves ${vsLoserPct.toFixed(0)}% │`)
  console.log(`└${`─`.repeat(w.rank + w.label + w.median + w.min + w.max + w.mean + w.vs + w.tag + 24)}┘`)
}

async function main(): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), `lmdb-bench-decode-`))
  const env = new LmdbEnv({path: tmp, maxDbs: 10})
  const plain = env.register(PlainSchema)
  const dates = env.register(DateSchema)

  console.log(`Populating ${POPULATE} plain + ${POPULATE} date entries...`)
  const CHUNK = 500
  for (let start = 0; start < POPULATE; start += CHUNK) {
    const end = Math.min(start + CHUNK, POPULATE)
    await env.rootTransactionSync(() => {
      for (let i = start; i < end; i++) {
        const k = `k${String(i).padStart(6, `0`)}`
        plain.putSync(k, {id: k, val: i})
        dates.putSync(k, {at: new Date(Date.now() + i)})
      }
    })
  }
  console.log(`Ready.\n`)

  console.log(`=== read-hook overhead (plain = identity, date = real transform) ===\n`)
  console.log(`Note: values()/entries() always do .map(e => _readValue(e.value)).`)
  console.log(`      Plain repo hook is identity (raw as T) — measures pure mapping overhead.`)
  console.log(`      Date repo hook is hookBeforeRead (number -> Date) — measures real transform.\n`)

  // Grouped by limit for fair comparison — 100 vs 1000 must not share one table
  const limit100: BenchResult[] = []
  const limit1000: BenchResult[] = []

  // Raw LMDB range without any JS decode/map — baseline
  const raw100 = await bench(`raw getRange({limit:100}) + extract value (no decode)`, async () => {
    const arr = (env.openDB(PlainSchema.db).getRange({limit: 100}) as unknown as {asArray: unknown[]}).asArray
    await Promise.resolve(arr).then((a) => (a as Array<{value: unknown}>).map((e) => e.value))
  })
  limit100.push(raw100)
  const raw1000 = await bench(`raw getRange({limit:1000}) + extract value`, async () => {
    const arr = (env.openDB(PlainSchema.db).getRange({limit: 1000}) as unknown as {asArray: unknown[]}).asArray
    await Promise.resolve(arr).then((a) => (a as Array<{value: unknown}>).map((e) => e.value))
  })
  limit1000.push(raw1000)

  // Plain repo — identity decode
  const pv100 = await bench(`env.values(PlainSchema, {limit:100}) [identity read-hook]`, () => plain.values({limit: 100}))
  limit100.push(pv100)
  const pv1000 = await bench(`env.values(PlainSchema, {limit:1000}) [identity read-hook]`, () => plain.values({limit: 1000}))
  limit1000.push(pv1000)
  const pe100 = await bench(`env.entries(PlainSchema, {limit:100}) [identity]`, () => plain.entries({limit: 100}))
  limit100.push(pe100)
  const pe1000 = await bench(`env.entries(PlainSchema, {limit:1000}) [identity]`, () => plain.entries({limit: 1000}))
  limit1000.push(pe1000)
  const pi100 = await bench(`env.iterate(PlainSchema, {limit:100}) [identity]`, async () => {
    for await (const _ of plain.iterate({limit: 100})) {
      /* drain */
    }
  })
  limit100.push(pi100)

  // Date repo — real codec
  const dv100 = await bench(`date.values({limit:100}) [codec: number->Date]`, () => dates.values({limit: 100}))
  limit100.push(dv100)
  const dv1000 = await bench(`date.values({limit:1000}) [codec]`, () => dates.values({limit: 1000}))
  limit1000.push(dv1000)
  const de100 = await bench(`date.entries({limit:100}) [codec]`, () => dates.entries({limit: 100}))
  limit100.push(de100)
  const de1000 = await bench(`date.entries({limit:1000}) [codec]`, () => dates.entries({limit: 1000}))
  limit1000.push(de1000)

  rankAndPrint(limit100, `Decode / limit 100 (raw + plain + date + iterate)`)
  rankAndPrint(limit1000, `Decode / limit 1000 (raw + plain + date)`)

  // Large limits — grouped by limit (10k vs 100k separated for fair vs)
  console.log(`\n--- Large scale (500k DB) ---\n`)
  const large10k: BenchResult[] = []
  const l1 = await bench(`env.values(PlainSchema, {limit:10_000}) [fast-path]`, () => plain.values({limit: 10_000}), ITERS_LARGE, WARMUP_LARGE)
  large10k.push(l1)
  const l2 = await bench(`env.entries(PlainSchema, {limit:10_000}) [fast-path]`, () => plain.entries({limit: 10_000}), ITERS_LARGE, WARMUP_LARGE)
  large10k.push(l2)
  rankAndPrint(large10k, `Decode / large 10k (values vs entries)`)

  const large100k: BenchResult[] = []
  const l3 = await bench(`env.values(PlainSchema, {limit:100_000})`, () => plain.values({limit: 100_000}), 10, 2)
  large100k.push(l3)
  const l4 = await bench(`env.entries(PlainSchema, {limit:100_000})`, () => plain.entries({limit: 100_000}), 10, 2)
  large100k.push(l4)
  const l5 = await bench(
    `env.iterate(PlainSchema, {limit:100_000}) [lazy stream]`,
    async () => {
      for await (const _ of plain.iterate({limit: 100_000})) {
        /* drain */
      }
    },
    10,
    2
  )
  large100k.push(l5)
  rankAndPrint(large100k, `Decode / large 100k (values vs entries vs iterate)`)

  // Guardrail (B4): a limit above MAX_MATERIALIZE rejects with
  // LmdbMaterializationError while iterate() remains the escape hatch.
  console.log(`\n--- Guardrail: >100k materialization cap (B4) ---\n`)
  const cap = MAX_MATERIALIZE ?? 100_000
  let guardErr: string | null = null
  try {
    await plain.values({limit: cap + 1})
  } catch (err) {
    guardErr = err instanceof Error ? err.name : String(err)
  }
  console.log(`  values({limit:${cap + 1}}) -> ${guardErr ?? `NO ERROR (guardrail off)`} (expected LmdbMaterializationError)`)
  const guard100k: BenchResult[] = []
  guard100k.push(await bench(`values({limit:${cap}}) [at cap, allowed]`, () => plain.values({limit: cap}), 5, 2))
  guard100k.push(
    await bench(
      `iterate({limit:${cap}}) [lazy stream]`,
      async () => {
        for await (const _ of plain.iterate({limit: cap})) {
          /* drain */
        }
      },
      5,
      2
    )
  )
  rankAndPrint(guard100k, `Decode / guardrail ${cap} (materialize vs iterate)`)

  // Full scan 500k — single sample, not ranked (scale berbeda, tidak fair dibanding 10k/100k).
  // values() without a limit is guarded (> MAX_MATERIALIZE) — iterate() streams the full set.
  if (POPULATE >= 500_000) {
    const l6 = await bench(
      `env.iterate(PlainSchema, all 500k) [lazy, escape hatch]`,
      async () => {
        for await (const _ of plain.iterate()) {
          /* drain */
        }
      },
      5,
      1
    )
    console.log(`\n  Full scan 500k absolute: median=${fmtNs(l6.median)} min=${fmtNs(l6.min)} max=${fmtNs(l6.max)} (single sample, not ranked)`)
  }

  // Micro: pure JS map overhead (no LMDB) — isolates the read-hook call cost
  console.log(`\n--- Micro: pure JS map (50k elements, no LMDB) ---\n`)
  const N = 50_000
  const fake = Array.from({length: N}, (_, i) => ({key: `k${i}`, value: {id: `k${i}`, val: i}}))
  const identity = (raw: unknown) => raw as Plain
  const codecFn = (raw: unknown) => new Date(raw as number)
  const numArr = Array.from({length: N}, (_, i) => i)
  const micro50k: BenchResult[] = []
  micro50k.push(await bench(`JS map identity 50k (fake range)`, () => fake.map((e) => identity(e.value))))
  micro50k.push(await bench(`JS map codec(Date) 50k`, () => numArr.map((n) => codecFn(n))))
  micro50k.push(await bench(`JS map no-decode (e.value as T) 50k`, () => fake.map((e) => e.value as Plain)))
  rankAndPrint(micro50k, `Decode / micro 50k (all same N)`)

  console.log(`\n--- Micro: pure JS map (500k) ---\n`)
  const M = 500_000
  const fake500 = Array.from({length: M}, (_, i) => ({key: `k${i}`, value: {id: `k${i}`, val: i}}))
  const num500 = Array.from({length: M}, (_, i) => i)
  const micro500k: BenchResult[] = []
  micro500k.push(await bench(`JS map identity 500k`, () => fake500.map((e) => identity(e.value)), 20, 3))
  micro500k.push(await bench(`JS map no-decode 500k`, () => fake500.map((e) => e.value as Plain), 20, 3))
  micro500k.push(await bench(`JS map codec 500k`, () => num500.map((n) => codecFn(n)), 20, 3))
  rankAndPrint(micro500k, `Decode / micro 500k (all same N)`)

  await env.close()
  console.log(`\nDone. Compare median: raw vs plain vs date. Identity overhead = plain - raw.`)
  console.log(`If plain ≈ raw, read-hook identity cost is negligible. If date >> plain, the transform dominates.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
