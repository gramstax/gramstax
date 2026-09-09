/**
 * Pool-scale benchmark — `execute` rate and `broadcastRequest` fan-out
 * for N=1/2/4/8 workers (dedicated pool per size, built once upfront).
 *
 * Run: bun run packages/worker-thread/bench/pool-scale.bench.ts
 *
 * @internal
 */
import {bench, do_not_optimize, group} from "mitata"
import type {WorkerThreadPool} from "../src/pool"
import {withTimeout} from "../test/helpers"
import {makePool, runBench, SMALL_PAYLOAD} from "./_setup"

const SIZES = [1, 2, 4, 8] as const

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const pools = new Map<number, {pool: WorkerThreadPool; workers: {kill: () => Promise<unknown>}[]}>()
  for (const n of SIZES) {
    const {pool, workers} = await makePool(n)
    await withTimeout(pool.broadcastRequest(`mtdPing`, []), 10_000, `pool prime`)
    pools.set(n, {pool, workers})
  }
  console.log(`Pools ready (sizes=${SIZES.join(`,`)}).\n`)

  group(`Pool / execute round-robin`, () => {
    for (const n of SIZES) {
      const entry = pools.get(n)!
      bench(`execute N=${n} (1 req)`, async () => {
        do_not_optimize(await entry.pool.execute(`mtdEcho`, [SMALL_PAYLOAD]))
      })
    }
  })

  group(`Pool / broadcast fan-out`, () => {
    for (const n of SIZES) {
      const entry = pools.get(n)!
      bench(`broadcast N=${n} (${n} reqs)`, async () => {
        do_not_optimize(await entry.pool.broadcastRequest(`mtdEcho`, [SMALL_PAYLOAD]))
      })
    }
  })

  try {
    await runBench()
  } finally {
    for (const {pool} of pools.values()) {
      try {
        pool.killAll()
      } catch {
        // intentionally ignored — best-effort teardown
      }
    }
    console.log(`\nDone.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
