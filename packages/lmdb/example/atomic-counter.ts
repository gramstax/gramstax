/**
 * Atomic Counter (increment / decrement) — use when you need a monotonically increasing/decreasing number shared
 * across processes (order numbers, invoice sequences, hit counts, stock). Why: read-then-write via `get`+`put` races
 * under concurrent writers; `increment`/`decrement` wrap the read+write in a single LMDB writer transaction
 * (`env.transaction`), so 10 concurrent calls on the same key serialize and yield distinct values with no lost updates,
 * even across processes. Absent keys start at 0, non-numeric existing values throw. Prefer `decrement` over
 * `increment(key, -n)` for clarity.
 *
 * A counter is a scalar-number column, declared with a scalar `static value`:
 * `static value = t.number()` on an `LmdbSchema` class, registered via
 * `env.register` — the only registration path.
 *
 * Run with: `bun run packages/lmdb/example/atomic-counter.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"

class CounterSchema extends LmdbSchema {
  static db = `counter`
  static key = t.string()
  static value = t.number()
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-counter-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 5})
    // Scalar schema: a counter value is a bare number, not a row object.
    const counter = env.register(CounterSchema)

    console.log(`--- Atomic increment / decrement ---\n`)
    console.log(`  increment absent "order-seq":`, await counter.increment(`order-seq`)) // 1
    console.log(`  increment again:`, await counter.increment(`order-seq`)) // 2
    console.log(`  increment by 5:`, await counter.increment(`order-seq`, 5)) // 7
    console.log(`  decrement by 2:`, await counter.decrement(`order-seq`, 2)) // 5
    console.log(`  stored:`, counter.get(`order-seq`))

    console.log(`\n--- Concurrent increments (10 parallel) ---\n`)
    await counter.put(`hits`, 0)
    const results = await Promise.all(Array.from({length: 10}, () => counter.increment(`hits`)))
    console.log(
      `  results (sorted):`,
      [...results].sort((a, b) => a - b)
    )
    console.log(`  final hits:`, counter.get(`hits`)) // 10, no lost updates

    try {
      await env.rootPut(`bad`, `not-a-number` as unknown as number)
      await counter.increment(`bad`)
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
