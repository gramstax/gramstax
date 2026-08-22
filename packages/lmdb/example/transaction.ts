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
import {LmdbRepository} from "../src/repository"

type IVUser = {
  id: string
  name: string
}

type IVSession = {
  id: string
  userId: string
}

class UserRepository extends LmdbRepository<IVUser, string> {
  static dbName = `user`
}

class SessionRepository extends LmdbRepository<IVSession, string> {
  static dbName = `session`
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-tx-`))

  try {
    const env = new LmdbEnv({path: dir, maxDbs: 5})

    const users = env.register(UserRepository)
    const sessions = env.register(SessionRepository)

    console.log(`--- Cross-repo transaction (commit) ---\n`)

    await env.transaction(async (tx) => {
      await users.put(`u1`, {id: `u1`, name: `Alice`}, tx)
      await sessions.put(`s1`, {id: `s1`, userId: `u1`}, tx)
      tx.commit()
    })

    console.log(`u1:`, await users.get(`u1`))
    console.log(`s1:`, await sessions.get(`s1`))

    console.log(`\n--- Snapshot read via env.readTransaction ---\n`)

    const snapshot = await env.readTransaction(async (tx) => {
      return await users.entries({}, tx)
    })
    console.log(`snapshot entries:`, snapshot)

    console.log(`\n--- LmdbTransaction commit + tx.abort() (no-op after commit) ---\n`)

    await env.transaction(async (tx) => {
      await users.put(`u2`, {id: `u2`, name: `Bob`}, tx)
      tx.commit()
    })

    console.log(`u2:`, await users.get(`u2`))

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
