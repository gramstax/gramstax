/**
 * Range query and iteration example.
 *
 * Run with: `bun run packages/lmdb/example/range-query.ts`
 *
 * Demonstrates:
 * - `keys`, `values`, `entries` for batch retrieval
 * - `iterate` for memory-efficient streaming
 * - Range bounds: start, end, limit, offset, reverse
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbRepository} from "../src/repository"

type IVLog = {
  level: string
  message: string
}

class LogRepository extends LmdbRepository<IVLog, string> {
  static dbName = `log`
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-range-`))

  try {
    const env = new LmdbEnv({path: dir, maxDbs: 3})

    const logs = env.register(LogRepository)

    for (let i = 1; i <= 10; i++) {
      await logs.put(`log-${String(i).padStart(2, `0`)}`, {
        level: i % 3 === 0 ? `warn` : `info`,
        message: `entry ${i}`
      })
    }

    console.log(`--- All keys (count: ${await logs.count()}) ---\n`)
    const allKeys = await logs.keys()
    console.log(allKeys)

    console.log(`\n--- Range: log-03 to log-07 (limit 3) ---\n`)
    const rangeKeys = await logs.keys({start: `log-03`, end: `log-08`, limit: 3})
    console.log(rangeKeys)

    console.log(`\n--- Values in range ---\n`)
    const rangeVals = await logs.values({start: `log-01`, end: `log-04`})
    console.log(rangeVals)

    console.log(`\n--- Entries with reverse (start > end for LMDB reverse) ---\n`)
    const reversed = await logs.entries({start: `log-05`, end: `log-01`, reverse: true})
    console.log(reversed)

    console.log(`\n--- Stream iteration (memory-efficient) ---\n`)
    for await (const [key, value] of logs.iterate({start: `log-01`, end: `log-04`})) {
      console.log(`${key}: ${value.level} - ${value.message}`)
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
