/**
 * Bulk Operations (putMany / exportJSONL / importJSONL) — use when you need to seed, migrate, or back up as text.
 * Why: `putMany` chunks into 500-entry writer transactions to avoid LMDB instruction buffer overflow; `exportJSONL`
 * snapshots via `entries()` (each line `JSON.stringify([key,value])`) and `importJSONL` round-trips through `putMany`.
 * Text complement to native binary `backup()`, readable and diffable.
 *
 * Run with: `bun run packages/lmdb/example/bulk-operations.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"

class OrderSchema extends LmdbSchema {
  static db = `order`
  static key = t.string()
  static value = {
    id: t.string(),
    userId: t.string(),
    total: t.number()
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-bulk-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 5})
    const orders = env.register(OrderSchema)

    console.log(`--- putMany (batched) ---\n`)
    await orders.putMany([
      [`o1`, {id: `o1`, userId: `u1`, total: 10}],
      [`o2`, {id: `o2`, userId: `u1`, total: 20}],
      [`o3`, {id: `o3`, userId: `u2`, total: 30}]
    ])
    console.log(`  count after putMany:`, orders.count())
    console.log(`  o1:`, orders.get(`o1`))

    console.log(`\n--- exportJSONL ---\n`)
    const jsonl = await orders.exportJSONL()
    console.log(`  lines:`, jsonl.split(`\n`).filter(Boolean).length)
    console.log(`  first line:`, jsonl.split(`\n`)[0]?.slice(0, 60), `...`)

    console.log(`\n--- clear + importJSONL roundtrip ---\n`)
    await orders.clear()
    console.log(`  count after clear:`, orders.count())
    console.log(`  importJSONL restored:`, await orders.importJSONL(jsonl))
    console.log(`  count after import:`, orders.count())
    console.log(`  o2:`, orders.get(`o2`))

    console.log(`\n--- empty handling ---\n`)
    console.log(`  import empty string:`, await orders.importJSONL(``))
    console.log(`  import whitespace:`, await orders.importJSONL(`\n\n`))

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
