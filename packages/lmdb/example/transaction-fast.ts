/**
 * `transactionFast` — off-thread commit without rollback.
 *
 * Run with: `bun run packages/lmdb/example/transaction-fast.ts`
 *
 * Demonstrates:
 * - `env.transactionFast()` as the no-rollback counterpart of `env.transaction()`
 * - Why `tx.abort()` throws here instead of silently doing nothing
 * - Why a throwing callback still commits the writes it already made
 * - The paths that deliberately stay on `env.transaction()`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"

class UserSchema extends LmdbSchema {
  static db = `user`
  static key = t.string()
  static value = {
    id: t.string(),
    name: t.string()
  }
}

class SessionSchema extends LmdbSchema {
  static db = `session`
  static key = t.string()
  static value = {
    id: t.string(),
    userId: t.string()
  }
}

const dir = mkdtempSync(join(tmpdir(), `lmdb-txfast-`))
const env = new LmdbEnv({path: dir, maxDbs: 5})
const users = env.register(UserSchema)
const sessions = env.register(SessionSchema)

try {
  console.log(`--- transactionFast commits atomically ---\n`)
  await env.transactionFast(() => {
    users.putSync(`u1`, {id: `u1`, name: `Alice`})
    sessions.putSync(`s1`, {id: `s1`, userId: `u1`})
  })
  console.log(`  u1:`, users.get(`u1`))
  console.log(`  s1:`, sessions.get(`s1`))
  console.log(`  -> both visible together, one native write txn`)

  console.log(`\n--- tx.abort() throws instead of silently doing nothing ---\n`)
  try {
    await env.transactionFast((tx) => {
      tx.abort()
    })
  } catch (err) {
    console.log(`  threw:`, String((err as Error).message).slice(0, 92), `...`)
    console.log(`  -> the point: this path has no rollback, so it refuses rather than lies.`)
  }

  console.log(`\n--- a throwing callback still commits what it wrote ---\n`)
  try {
    await env.transactionFast(() => {
      users.putSync(`u2`, {id: `u2`, name: `Bob`})
      throw new Error(`boom`)
    })
  } catch (err) {
    console.log(`  threw:`, String((err as Error).message).slice(0, 96), `...`)
  }
  console.log(`  u2 after the throw:`, users.get(`u2`), `<- committed, not discarded`)

  console.log(`\n--- transaction() is still the one that rolls back ---\n`)
  await env.transaction((tx) => {
    users.putSync(`u3`, {id: `u3`, name: `Carol`})
    sessions.putSync(`s3`, {id: `s3`, userId: `u3`})
    tx.abort()
  })
  console.log(`  u3:`, users.get(`u3`), ` s3:`, sessions.get(`s3`), `<- rolled back`)

  console.log(`\n--- both callback styles are legal; sync is preferred ---\n`)
  await env.transactionFast(async () => {
    await Promise.resolve()
    users.putSync(`u5`, {id: `u5`, name: `Eve`})
  })
  console.log(`  async callback worked, u5:`, users.get(`u5`))
  console.log(`  -> but every await holds the single writer lock open, and writes`)
  console.log(`     queued meanwhile are pulled into this transaction — on both`)
  console.log(`     transaction() and transactionFast(). Sync wins.`)

  console.log(`\nStays on transaction() because rollback is load-bearing:`)
  console.log(`  unique-index conflict handling — a committed row without its`)
  console.log(`    index entry would leave the index inconsistent`)
  console.log(`  migrate() — up() runs inside the transaction`)
  console.log(`  purgeExpired() — counts removeSync return values`)
  console.log(`  increment() — throws before any write, so a commit-on-throw`)
  console.log(`    message would be false`)

  console.log(`\nenv closed cleanly`)
} finally {
  await env.close()
  rmSync(dir, {recursive: true, force: true})
}
