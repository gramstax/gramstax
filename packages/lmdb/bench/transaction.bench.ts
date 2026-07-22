/**
 * Transaction benchmark — single-write, batch, cross-repo throughput.
 *
 * Run: bun run packages/lmdb/bench/transaction.bench.ts
 *
 * @internal
 */

import {mkdtempSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv, LmdbRepository} from "../src"

const POPULATE = 10_000
const ITERS = 500
const WARMUP = 50

interface Item { id: string; value: number }
interface Log { ts: number; msg: string }

class ItemRepo extends LmdbRepository<Item, string> {
  static dbName = `bench-tx-item`
}

class LogRepo extends LmdbRepository<Log, string> {
  static dbName = `bench-tx-log`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtNs(ns: bigint): string {
  const n = Number(ns)
  if (n < 1_000) return `${n}ns`
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}us`
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}ms`
  return `${(n / 1_000_000_000).toFixed(2)}s`
}

async function bench(
  label: string,
  fn: () => Promise<unknown> | unknown,
  iterations = ITERS,
  warmup = WARMUP
): Promise<void> {
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
  const sum = samples.reduce((a, b) => a + b, 0n)
  const mean = sum / BigInt(samples.length)
  console.log(
    `  ${label.padEnd(36)} median=${fmtNs(median).padStart(10)} min=${fmtNs(min).padStart(10)} max=${fmtNs(max).padStart(10)} mean=${fmtNs(mean).padStart(10)}`
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), `lmdb-bench-tx-`))
  const env = new LmdbEnv({path: tmp, maxDbs: 10})
  const items = env.register(ItemRepo)
  const logs = env.register(LogRepo)

  console.log(`Populating ${POPULATE} entries (txSync)...`)
  const CHUNK = 500
  for (let start = 0; start < POPULATE; start += CHUNK) {
    const end = Math.min(start + CHUNK, POPULATE)
    items.env.transactionSync(() => {
      for (let i = start; i < end; i++) {
        items.env.putSync(`k${i}`, {id: `k${i}`, value: i})
      }
    })
  }
  console.log(`Ready.\n`)

  console.log(`=== Transaction benchmark (${ITERS} iters) ===\n`)

  // Single write inside transaction
  await bench(`tx single set`, async () => {
    await env.transaction(async () => {
      await items.set(`_tx1`, {id: `_tx1`, value: Date.now()})
    })
  })

  // Read + write inside transaction
  await bench(`tx read-then-set`, async () => {
    await env.transaction(async () => {
      const cur = await items.get(`k0`)
      await items.set(`k0`, {id: `k0`, value: (cur?.value ?? 0) + 1})
    })
  })

  // Cross-repo transaction (two repos)
  await bench(`tx cross-repo (2 repos)`, async () => {
    await env.transaction(async () => {
      await items.set(`_tx_cr`, {id: `_tx_cr`, value: Date.now()})
      await logs.set(`_log_cr`, {ts: Date.now(), msg: `cross-repo tx`})
    })
  })

  // Batch write (multiple sets in one tx)
  await bench(`tx batch 10 sets`, async () => {
    await env.transaction(async () => {
      for (let i = 0; i < 10; i++) {
        await items.set(`_batch:${i}`, {id: `_batch:${i}`, value: i})
      }
    })
  })

  // Transaction with abort
  await bench(`tx abort (rollback)`, async () => {
    await env.transaction(async (tx) => {
      await items.set(`_abort_test`, {id: `_abort_test`, value: 0})
      tx.abort()
    })
  })

  // Read-only transaction
  await bench(`readTransaction (snapshot)`, async () => {
    await env.readTransaction(async () => {
      await items.get(`k0`)
      await items.get(`k100`)
      await items.get(`k500`)
    })
  })

  // writeTransaction + readTransaction combo
  await bench(`tx write + read snapshot`, async () => {
    await env.transaction(async () => {
      await items.set(`_combo`, {id: `_combo`, value: Date.now()})
    })
    await env.readTransaction(async () => {
      await items.get(`_combo`)
    })
  })

  await env.close()
  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
