/**
 * parentPort RPC round-trip benchmark — single + concurrent batch.
 *
 * Payload shape is IDENTICAL to `gateway-roundtrip.bench.ts`
 * (`SMALL_PAYLOAD`) so the comparison is like-for-like.
 *
 * Run: bun run packages/worker-thread/bench/rpc-roundtrip.bench.ts
 *
 * @internal
 */
import {bench, do_not_optimize, group} from "mitata"
import {withTimeout} from "../test/helpers"
import {benchSize, runBench, SMALL_PAYLOAD, spawnEchoWorker} from "./_setup"

const BATCH = benchSize(10)

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const worker = await spawnEchoWorker()
  console.log(`Worker ready (batch=${BATCH}).\n`)

  group(`RPC / round-trip`, () => {
    bench(`echo single (1 req)`, async () => {
      do_not_optimize(await worker.request(`mtdEcho`, [SMALL_PAYLOAD]))
    })
    bench(`echo batch concurrent (10 reqs)`, async () => {
      do_not_optimize(
        await Promise.all(Array.from({length: BATCH}, () => worker.request(`mtdEcho`, [SMALL_PAYLOAD])))
      )
    })
  })

  try {
    await runBench()
  } finally {
    await withTimeout(worker.kill(), 10_000, `echo worker kill`).catch(() => {})
    console.log(`\nDone.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
