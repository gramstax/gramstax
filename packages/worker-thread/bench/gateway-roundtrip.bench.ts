/**
 * Gateway socket round-trip benchmark — json vs messagepack groups.
 *
 * Payload shape is IDENTICAL to `rpc-roundtrip.bench.ts`
 * (`SMALL_PAYLOAD`) so the comparison is like-for-like.
 *
 * Run: bun run packages/worker-thread/bench/gateway-roundtrip.bench.ts
 *
 * @internal
 */
import {bench, do_not_optimize, group} from "mitata"
import {withTimeout} from "../test/helpers"
import {benchSize, runBench, SMALL_PAYLOAD, spawnGatewayPair} from "./_setup"

const BATCH = benchSize(10)

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const json = await spawnGatewayPair()
  const msgpack = await spawnGatewayPair({messagepack: true})
  console.log(`Gateway pairs ready (batch=${BATCH}).\n`)

  group(`Gateway / json`, () => {
    bench(`json echo single (1 req)`, async () => {
      do_not_optimize(await json.client.request(`echo`, [SMALL_PAYLOAD]))
    })
    bench(`json echo batch concurrent (10 reqs)`, async () => {
      do_not_optimize(
        await Promise.all(Array.from({length: BATCH}, () => json.client.request(`echo`, [SMALL_PAYLOAD])))
      )
    })
  })

  group(`Gateway / messagepack`, () => {
    bench(`msgpack echo single (1 req)`, async () => {
      do_not_optimize(await msgpack.client.request(`echo`, [SMALL_PAYLOAD]))
    })
    bench(`msgpack echo batch concurrent (10 reqs)`, async () => {
      do_not_optimize(
        await Promise.all(Array.from({length: BATCH}, () => msgpack.client.request(`echo`, [SMALL_PAYLOAD])))
      )
    })
  })

  try {
    await runBench()
  } finally {
    await withTimeout(json.client.close(), 10_000, `json client close`).catch(() => {})
    await withTimeout(json.server.close(), 10_000, `json server close`).catch(() => {})
    await withTimeout(msgpack.client.close(), 10_000, `msgpack client close`).catch(() => {})
    await withTimeout(msgpack.server.close(), 10_000, `msgpack server close`).catch(() => {})
    console.log(`\nDone.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
