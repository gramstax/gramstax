/**
 * Cross-repository transaction example.
 *
 * Run with: `bun run packages/lmdb/example/transaction.ts`
 *
 * Demonstrates:
 * - Atomic writes across multiple repositories via env.transaction
 * - tx.abort() to roll back user-initiated rollback (note: LMDB async batching
 *   caveat applies to awaited writes)
 * - env.readTransaction for snapshot reads
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

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-tx-`))

  try {
    const env = new LmdbEnv({path: dir, maxDbs: 5})
    const user = env.register(UserSchema)
    const session = env.register(SessionSchema)

    console.log(`--- Cross-repo transaction (commit) ---\n`)

    await env.transaction((tx) => {
      user.put(`u1`, {id: `u1`, name: `Alice`}, tx)
      session.put(`s1`, {id: `s1`, userId: `u1`}, tx)
    })

    console.log(`u1:`, user.get(`u1`))
    console.log(`s1:`, session.get(`s1`))

    console.log(`\n--- Snapshot read via env.readTransaction ---\n`)

    const snapshot = await env.readTransaction(() => user.entries())
    console.log(`snapshot entries:`, snapshot)

    console.log(`\n--- LmdbTransaction commit + tx.abort() (no-op after commit) ---\n`)

    await env.transaction((tx) => {
      user.put(`u2`, {id: `u2`, name: `Bob`}, tx)
    })

    console.log(`u2:`, user.get(`u2`))

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
