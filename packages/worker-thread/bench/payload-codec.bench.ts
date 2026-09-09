/**
 * Gateway payload-codec benchmark — json vs messagepack across sizes.
 *
 * Scales: tiny object / 64KB string (`BENCH_N` KB) / mixed
 * Date + BigInt + typed-array struct (messagepack-only fidelity — the
 * json side measures throughput without asserting the round-trip shape).
 *
 * Run: bun run packages/worker-thread/bench/payload-codec.bench.ts
 *
 * @internal
 */
import {bench, do_not_optimize, group} from "mitata"
import {withTimeout} from "../test/helpers"
import {benchSize, runBench, SMALL_PAYLOAD, spawnGatewayPair} from "./_setup"

const BIG_KB = benchSize(64)
const BIG_STRING = `x`.repeat(BIG_KB * 1024)
const MIXED_STRUCT = {
  when: new Date(`2026-01-01T00:00:00.000Z`),
  big: 12345678901234567890n,
  buf: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
  nested: {ok: true, n: 7}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const json = await spawnGatewayPair()
  const msgpack = await spawnGatewayPair({messagepack: true})
  await withTimeout(msgpack.client.request(`echo`, [MIXED_STRUCT]), 10_000, `msgpack mixed prime`)
  console.log(`Codec pairs ready (big=${BIG_KB}KB).\n`)

  group(`Codec / json`, () => {
    bench(`json tiny object (1 req)`, async () => {
      do_not_optimize(await json.client.request(`echo`, [SMALL_PAYLOAD]))
    })
    bench(`json 64KB string (1 req)`, async () => {
      do_not_optimize(await json.client.request(`echo`, [BIG_STRING]))
    })
    bench(`json mixed struct (1 req)`, async () => {
      do_not_optimize(await json.client.request(`echo`, [{...SMALL_PAYLOAD, n: 1}]))
    })
  })

  group(`Codec / messagepack`, () => {
    bench(`msgpack tiny object (1 req)`, async () => {
      do_not_optimize(await msgpack.client.request(`echo`, [SMALL_PAYLOAD]))
    })
    bench(`msgpack 64KB string (1 req)`, async () => {
      do_not_optimize(await msgpack.client.request(`echo`, [BIG_STRING]))
    })
    bench(`msgpack mixed Date+BigInt+typed-array (1 req)`, async () => {
      do_not_optimize(await msgpack.client.request(`echo`, [MIXED_STRUCT]))
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
