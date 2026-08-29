/**
 * Embedded Indexes — declared via schema value columns (SQL: CREATE INDEX / CREATE UNIQUE INDEX).
 * `.unique()` marks a column as a unique index (duplicates throw LmdbUniqueConstraintError);
 * `.index()` marks it as a non-unique index (duplicates allowed). Index sub-DBs are auto-created
 * at registration and maintained atomically with primary writes. `findByIndex({...})` is the single
 * object-query read: unique index keys resolve `T | undefined`, non-unique keys resolve `T[]`, and
 * multi-key queries AND all keys (contradictory keys simply yield no match). Updates free the old
 * index value, `reindex()` rebuilds every index from primary data, and `delete` cleans index rows.
 *
 * Run with: `bun run packages/lmdb/example/embedded-indexes.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbUniqueConstraintError} from "../src/errors"
import {LmdbSchema, t} from "../src/schema"

class UsersSchema extends LmdbSchema {
  static db = `users`
  static key = t.number()
  static value = {
    id: t.number().unique(), // SQL UNIQUE — duplicates throw LmdbUniqueConstraintError
    username: t.string().unique(), // SQL UNIQUE — one username per account
    email: t.string().index(), // SQL INDEX — many users may share one email
    name: t.string()
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-embedded-idx-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    const users = env.register(UsersSchema)

    console.log(`--- put maintains embedded indexes atomically ---\n`)
    await users.put(1, {id: 1, username: `damar`, email: `damar@example.com`, name: `Damar`})
    await users.put(2, {id: 2, username: `budi`, email: `shared@example.com`, name: `Budi`})
    await users.put(3, {id: 3, username: `citra`, email: `shared@example.com`, name: `Citra`})
    console.log(`  findByIndex({email: shared@example.com}):`, await users.findByIndex({email: `shared@example.com`}))
    console.log(`  findByIndex({username: damar}):`, await users.findByIndex({username: `damar`}))
    console.log(`  findByIndex({email: missing@example.com}):`, await users.findByIndex({email: `missing@example.com`}))

    console.log(`\n--- Unique conflict throws LmdbUniqueConstraintError ---\n`)
    try {
      await users.put(4, {id: 4, username: `damar`, email: `dup@example.com`, name: `Dup`})
      console.log(`  unexpected: duplicate username was accepted`)
    } catch (err) {
      console.log(`  caught:`, err instanceof LmdbUniqueConstraintError ? err.message : String(err))
    }

    console.log(`\n--- Update frees the old index value ---\n`)
    await users.put(1, {id: 1, username: `damar`, email: `damar2@example.com`, name: `Damar`})
    console.log(`  old damar@example.com (empty):`, await users.findByIndex({email: `damar@example.com`}))
    console.log(`  new damar2@example.com:`, await users.findByIndex({email: `damar2@example.com`}))

    console.log(`\n--- reindex() rebuilds every index from primary data ---\n`)
    const res = await users.reindex()
    console.log(`  built:`, res.built, `skipped:`, res.skipped)
    console.log(`  after reindex, findByIndex({username: citra}):`, await users.findByIndex({username: `citra`}))

    console.log(`\n--- delete cleans index rows ---\n`)
    await users.delete(2)
    console.log(`  after delete, shared@example.com:`, await users.findByIndex({email: `shared@example.com`}))
    console.log(`  primary 2 gone:`, users.get(2))

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
