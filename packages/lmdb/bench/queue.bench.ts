/**
 * LmdbQueue benchmark — v2 single-transaction enqueue/dequeue.
 *
 * v2: enqueue bumps the monotonic sequence counter AND writes the payload in
 * ONE synchronous transaction (`env.transactionSync`), so the generated
 * zero-padded id and the payload commit atomically — FIFO order is preserved
 * even across processes. Dequeue reads the head through a synchronous cursor
 * and deletes it in ONE synchronous transaction.
 *
 * Runner: mitata (`bench`/`group`/`run`) — populate stays outside the
 * measured closures so only the op itself is timed.
 *
 * Run:   bun run packages/lmdb/bench/queue.bench.ts
 * Quick: BENCH_N=5000 bun run packages/lmdb/bench/queue.bench.ts
 *
 * @internal
 */

import {bench, do_not_optimize, group} from "mitata"
import {LmdbQueue} from "../src"
import {LmdbSchema, t} from "../src/schema"
import {benchSize, runBench, setupEnv} from "./_setup"

const N = benchSize(50_000)
const REFILL = 10_000

class JobSchema extends LmdbSchema {
  static db = `jobs`
  static key = t.string()
  static value = {
    id: t.string(),
    payload: t.object<{type: string; n: number}>()
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const {env, tmp} = setupEnv(`lmdb-bench-queue-`, 10)
  const queue = new LmdbQueue(env, JobSchema)

  console.log(`Populating ${N} jobs via v2 enqueue (single txn each)...`)
  const t0 = process.hrtime.bigint()
  for (let i = 0; i < N; i++) {
    await queue.enqueue({id: `job-${i}`, payload: {type: `bench`, n: i}})
  }
  const populate = process.hrtime.bigint() - t0
  console.log(`Enqueued ${N} jobs in ${populate}ns total — queue size: ${await queue.size()}\n`)

  let refillSeq = 0
  group(`Queue v2 (enqueue vs dequeue)`, () => {
    // v2 enqueue — counter bump + payload put in ONE transactionSync
    bench(`enqueue (1 job, 1 req/1 txn)`, async () => {
      do_not_optimize(await queue.enqueue({id: `bench-${Date.now()}-${Math.random()}`, payload: {type: `bench`, n: 0}}))
    })

    // v2 dequeue — sync-cursor read + delete in ONE transactionSync
    bench(`dequeue (1 job, 1 req/1 txn)`, async () => {
      let job = await queue.dequeue()
      if (job === undefined) {
        for (let i = 0; i < REFILL; i++) await queue.enqueue({id: `refill-${refillSeq++}-${i}`, payload: {type: `bench`, n: i}})
        job = await queue.dequeue()
      }
      if (job === undefined) throw new Error(`queue drained unexpectedly during dequeue bench`)
    })
  })

  await runBench()
  console.log(`\nSnapshot: N=${N} tmp=${tmp} queueSize=${await queue.size()}`)

  await env.close()
  console.log(`\nDone. enqueue = seq bump + payload (atomic); dequeue = read head + delete (atomic).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
