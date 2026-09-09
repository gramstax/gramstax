/**
 * Transaction benchmark — single-write, batch, cross-repo throughput.
 *
 * Runner: mitata (`bench`/`group`/`run`) — populate stays outside the
 * measured closures so only the transaction itself is timed.
 *
 * Run: bun run packages/lmdb/bench/transaction.bench.ts
 *
 * @internal
 */

import {bench, do_not_optimize, group} from "mitata"
import {LmdbSchema, t} from "../src"
import {benchSize, populateSync, runBench, setupEnv} from "./_setup"

const POPULATE = benchSize(10_000)

class ItemSchema extends LmdbSchema {
  static db = `bench-tx-item`
  static key = t.string()
  static value = {
    id: t.string(),
    value: t.number()
  }
}

class LogSchema extends LmdbSchema {
  static db = `bench-tx-log`
  static key = t.string()
  static value = {
    ts: t.number(),
    msg: t.string()
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const {env} = setupEnv(`lmdb-bench-tx-`, 10)
  const items = env.register(ItemSchema)
  const logs = env.register(LogSchema)

  console.log(`Populating ${POPULATE} entries (txSync)...`)
  populateSync(env, POPULATE, (i) => {
    items.putSync(`k${i}`, {id: `k${i}`, value: i})
  })
  console.log(`Ready.\n`)

  group(`Transaction / write`, () => {
    bench(`tx single put (1 put/1 txn)`, async () => {
      await env.transaction(async () => {
        await items.put(`_tx1`, {id: `_tx1`, value: Date.now()})
      })
    })
    bench(`tx read-then-put (1 get+1 put/1 txn)`, async () => {
      await env.transaction(async () => {
        const cur = await items.get(`k0`)
        await items.put(`k0`, {id: `k0`, value: (cur?.value ?? 0) + 1})
      })
    })
    bench(`tx cross-repo (2 puts/1 txn)`, async () => {
      await env.transaction(async () => {
        await items.put(`_tx_cr`, {id: `_tx_cr`, value: Date.now()})
        await logs.put(`_log_cr`, {ts: Date.now(), msg: `cross-repo tx`})
      })
    })
    bench(`tx batch (10 puts/1 txn)`, async () => {
      await env.transaction(async () => {
        for (let i = 0; i < 10; i++) {
          await items.put(`_batch:${i}`, {id: `_batch:${i}`, value: i})
        }
      })
    })
    bench(`tx abort (1 put+abort/1 txn)`, async () => {
      await env.transaction(async (tx) => {
        await items.put(`_abort_test`, {id: `_abort_test`, value: 0})
        tx.abort()
      })
    })
  })

  group(`Transaction / read`, () => {
    bench(`readTransaction (3 gets/1 snapshot)`, async () => {
      await env.readTransaction(async () => {
        do_not_optimize(await items.get(`k0`))
        do_not_optimize(await items.get(`k100`))
        do_not_optimize(await items.get(`k500`))
      })
    })
    bench(`tx write + read snapshot (1 put+1 get/2 txns)`, async () => {
      await env.transaction(async () => {
        await items.put(`_combo`, {id: `_combo`, value: Date.now()})
      })
      await env.readTransaction(async () => {
        do_not_optimize(await items.get(`_combo`))
      })
    })
  })

  await runBench()

  await env.close()
  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
