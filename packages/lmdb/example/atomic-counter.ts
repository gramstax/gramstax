/**
 * Atomic Counter (increment) — use when you need a monotonically increasing number shared across processes
 * (order numbers, invoice sequences, hit counts). Why: read-then-write via `get`+`set` races under concurrent writers;
 * `increment` wraps the read+write in a single LMDB writer transaction (`env.transaction`), so 10 concurrent
 * `increment` calls on the same key serialize and yield distinct 1..10 with no lost updates, even across processes.
 * Absent keys start at 0, negative delta decrements, non-numeric existing values throw.
 *
 * Run with: `bun run packages/lmdb/example/atomic-counter.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbRepository} from "../src/repository"

class CounterRepo extends LmdbRepository<number, string> {
  static dbName = `counter`
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-counter-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 5})
    const counters = env.register(CounterRepo)

    console.log(`--- Atomic increment ---\n`)
    console.log(`  increment absent "order-seq":`, await counters.increment(`order-seq`)) // 1
    console.log(`  increment again:`, await counters.increment(`order-seq`)) // 2
    console.log(`  increment by 5:`, await counters.increment(`order-seq`, 5)) // 7
    console.log(`  decrement by 2:`, await counters.increment(`order-seq`, -2)) // 5
    console.log(`  stored:`, counters.get(`order-seq`))

    console.log(`\n--- Concurrent increments (10 parallel) ---\n`)
    await counters.set(`hits`, 0)
    const results = await Promise.all(Array.from({length: 10}, () => counters.increment(`hits`)))
    console.log(`  results (sorted):`, [...results].sort((a, b) => a - b))
    console.log(`  final hits:`, counters.get(`hits`)) // 10, no lost updates

    try {
      await (counters as unknown as {env: {put: (k: string, v: unknown) => Promise<void>}}).env.put(`bad`, `not-a-number` as unknown as number)
      await counters.increment(`bad`)
    } catch (err) {
      console.log(`\n  increment non-numeric throws:`, String((err as Error & {cause?: unknown}).cause ?? err).slice(0, 70), `...`)
    }

    await env.close()
    console.log(`\nenv closed cleanly`)
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
