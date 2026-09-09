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
 * Runner: mitata (`bench`/`group`/`run`) — populate stays outside the
 * measured closures; the guardrail check stays plain (non-measured) code.
 *
 * Run: bun run packages/lmdb/bench/decode.bench.ts
 *
 * @internal
 */

import {bench, do_not_optimize, group} from "mitata"
import {LmdbSchema, t} from "../src"
import {MAX_MATERIALIZE} from "../src/types"
import {benchSize, populateSync, runBench, setupEnv} from "./_setup"

const POPULATE = benchSize(500_000)

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

async function main(): Promise<void> {
  const {env} = setupEnv(`lmdb-bench-decode-`, 10)
  const plain = env.register(PlainSchema)
  const dates = env.register(DateSchema)

  console.log(`Populating ${POPULATE} plain + ${POPULATE} date entries...`)
  populateSync(env, POPULATE, (i) => {
    const k = `k${String(i).padStart(6, `0`)}`
    plain.putSync(k, {id: k, val: i})
    dates.putSync(k, {at: new Date(Date.now() + i)})
  })
  console.log(`Ready.\n`)

  console.log(`=== read-hook overhead (plain = identity, date = real transform) ===\n`)
  console.log(`Note: values()/entries() always do .map(e => _readValue(e.value)).`)
  console.log(`      Plain repo hook is identity (raw as T) — measures pure mapping overhead.`)
  console.log(`      Date repo hook is hookBeforeRead (number -> Date) — measures real transform.\n`)

  group(`Decode / limit 100 (raw + plain + date + iterate)`, () => {
    // Raw LMDB range without any JS decode/map — baseline
    bench(`raw getRange({limit:100}) + extract value (no decode, 1 req)`, async () => {
      const arr = (env.openDB(PlainSchema.db).getRange({limit: 100}) as unknown as {asArray: unknown[]}).asArray
      await Promise.resolve(arr).then((a) => do_not_optimize((a as Array<{value: unknown}>).map((e) => e.value)))
    }).gc(`inner`)
    // Plain repo — identity decode
    bench(`env.values(PlainSchema, {limit:100}) [identity read-hook] (1 req)`, async () => do_not_optimize(await plain.values({limit: 100}))).gc(`inner`)
    bench(`env.entries(PlainSchema, {limit:100}) [identity] (1 req)`, async () => do_not_optimize(await plain.entries({limit: 100}))).gc(`inner`)
    bench(`env.iterate(PlainSchema, {limit:100}) [identity] (1 req)`, async () => {
      let c = 0
      for await (const _ of plain.iterate({limit: 100})) c++
      do_not_optimize(c)
    }).gc(`inner`)
    // Date repo — real codec
    bench(`date.values({limit:100}) [codec: number->Date] (1 req)`, async () => do_not_optimize(await dates.values({limit: 100}))).gc(`inner`)
    bench(`date.entries({limit:100}) [codec] (1 req)`, async () => do_not_optimize(await dates.entries({limit: 100}))).gc(`inner`)
  })

  group(`Decode / limit 1000 (raw + plain + date)`, () => {
    bench(`raw getRange({limit:1000}) + extract value (1 req)`, async () => {
      const arr = (env.openDB(PlainSchema.db).getRange({limit: 1000}) as unknown as {asArray: unknown[]}).asArray
      await Promise.resolve(arr).then((a) => do_not_optimize((a as Array<{value: unknown}>).map((e) => e.value)))
    }).gc(`inner`)
    bench(`env.values(PlainSchema, {limit:1000}) [identity read-hook] (1 req)`, async () => do_not_optimize(await plain.values({limit: 1000}))).gc(`inner`)
    bench(`env.entries(PlainSchema, {limit:1000}) [identity] (1 req)`, async () => do_not_optimize(await plain.entries({limit: 1000}))).gc(`inner`)
    bench(`date.values({limit:1000}) [codec] (1 req)`, async () => do_not_optimize(await dates.values({limit: 1000}))).gc(`inner`)
    bench(`date.entries({limit:1000}) [codec] (1 req)`, async () => do_not_optimize(await dates.entries({limit: 1000}))).gc(`inner`)
  })

  group(`Decode / large 10k (values vs entries)`, () => {
    bench(`env.values(PlainSchema, {limit:10_000}) [fast-path] (1 req)`, async () => do_not_optimize(await plain.values({limit: 10_000}))).gc(`inner`)
    bench(`env.entries(PlainSchema, {limit:10_000}) [fast-path] (1 req)`, async () => do_not_optimize(await plain.entries({limit: 10_000}))).gc(`inner`)
  })

  group(`Decode / large 100k (values vs entries vs iterate)`, () => {
    bench(`env.values(PlainSchema, {limit:100_000}) (1 req)`, async () => do_not_optimize(await plain.values({limit: 100_000}))).gc(`inner`)
    bench(`env.entries(PlainSchema, {limit:100_000}) (1 req)`, async () => do_not_optimize(await plain.entries({limit: 100_000}))).gc(`inner`)
    bench(`env.iterate(PlainSchema, {limit:100_000}) [lazy stream] (1 req)`, async () => {
      let c = 0
      for await (const _ of plain.iterate({limit: 100_000})) c++
      do_not_optimize(c)
    }).gc(`inner`)
  })

  // Guardrail (B4): a limit above MAX_MATERIALIZE rejects with
  // LmdbMaterializationError while iterate() remains the escape hatch.
  const cap = MAX_MATERIALIZE ?? 100_000
  group(`Decode / guardrail ${cap} (materialize vs iterate)`, () => {
    bench(`values({limit:${cap}}) [at cap, allowed] (1 req)`, async () => do_not_optimize(await plain.values({limit: cap}))).gc(`inner`)
    bench(`values({limit:${cap + 1}}) [rejects, guardrail cost]`, async () => {
      try {
        await plain.values({limit: cap + 1})
      } catch {
        /* expected LmdbMaterializationError */
      }
    })
    bench(`iterate({limit:${cap}}) [lazy stream] (1 req)`, async () => {
      let c = 0
      for await (const _ of plain.iterate({limit: cap})) c++
      do_not_optimize(c)
    }).gc(`inner`)
  })

  // Full scan 500k — single bench on the escape hatch (scale differs, not compared).
  // values() without a limit is guarded (> MAX_MATERIALIZE) — iterate() streams the full set.
  if (POPULATE >= 500_000) {
    group(`Decode / full scan 500k (escape hatch)`, () => {
      bench(`env.iterate(PlainSchema, all 500k) [lazy, escape hatch] (1 req)`, async () => {
        let c = 0
        for await (const _ of plain.iterate()) c++
        do_not_optimize(c)
      }).gc(`inner`)
    })
  }

  // Micro: pure JS map overhead (no LMDB) — isolates the read-hook call cost
  const N = 50_000
  const fake = Array.from({length: N}, (_, i) => ({key: `k${i}`, value: {id: `k${i}`, val: i}}))
  const identity = (raw: unknown) => raw as Plain
  const codecFn = (raw: unknown) => new Date(raw as number)
  const numArr = Array.from({length: N}, (_, i) => i)
  group(`Decode / micro 50k (all same N)`, () => {
    bench(`JS map identity (50k elems, 1 req, fake range)`, () => do_not_optimize(fake.map((e) => identity(e.value)))).gc(`inner`)
    bench(`JS map codec(Date) (50k elems, 1 req)`, () => do_not_optimize(numArr.map((n) => codecFn(n)))).gc(`inner`)
    bench(`JS map no-decode (e.value as T) (50k elems, 1 req)`, () => do_not_optimize(fake.map((e) => e.value as Plain))).gc(`inner`)
  })

  const M = 500_000
  const fake500 = Array.from({length: M}, (_, i) => ({key: `k${i}`, value: {id: `k${i}`, val: i}}))
  const num500 = Array.from({length: M}, (_, i) => i)
  group(`Decode / micro 500k (all same N)`, () => {
    bench(`JS map identity (500k elems, 1 req)`, () => do_not_optimize(fake500.map((e) => identity(e.value)))).gc(`inner`)
    bench(`JS map no-decode (500k elems, 1 req)`, () => do_not_optimize(fake500.map((e) => e.value as Plain))).gc(`inner`)
    bench(`JS map codec (500k elems, 1 req)`, () => do_not_optimize(num500.map((n) => codecFn(n)))).gc(`inner`)
  })

  await runBench()

  // Correctness probe (unmeasured boolean assert — the rejection cost itself is benched above)
  let guardErr: string | null = null
  try {
    await plain.values({limit: cap + 1})
  } catch (err) {
    guardErr = err instanceof Error ? err.name : String(err)
  }
  console.log(`\nGuardrail: values({limit:${cap + 1}}) -> ${guardErr ?? `NO ERROR (guardrail off)`} (expected LmdbMaterializationError)`)

  await env.close()
  console.log(`\nDone. Compare: raw vs plain vs date. Identity overhead = plain - raw.`)
  console.log(`If plain ≈ raw, read-hook identity cost is negligible. If date >> plain, the transform dominates.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
