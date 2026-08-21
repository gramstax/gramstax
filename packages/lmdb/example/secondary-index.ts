/**
 * Secondary Index (SecondaryIndex) — use when you need to query primary records by a non-primary field
 * (find User by email, Order by userId). Why: LMDB is key-value only; a dupSort index stores `indexedValue -> primaryKey`
 * and is updated in the same writer transaction as the primary put/remove, so index and primary never diverge even
 * with concurrent writers. `findByIndex` fans out via `getValues` + `get` and returns primary values.
 *
 * Run with: `bun run packages/lmdb/example/secondary-index.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbRepository} from "../src/repository"
import {SecondaryIndex} from "../src/secondary-index"

type User = {id: string; email: string; name: string}

class UserRepo extends LmdbRepository<User, string> {
  static dbName = `user`
}

class EmailIndexRepo extends LmdbRepository<string, string> {
  static dbName = `email-index`
  static dupSort = true
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-sec-idx-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    const users = env.register(UserRepo)
    const emailIndex = env.register(EmailIndexRepo)
    const byEmail = new SecondaryIndex(env, users, emailIndex, (u) => u.email)

    console.log(`--- Secondary index: email -> user ---\n`)
    await byEmail.put(`u1`, {id: `u1`, email: `alice@example.com`, name: `Alice`})
    await byEmail.put(`u2`, {id: `u2`, email: `bob@example.com`, name: `Bob`})
    console.log(`  alice@example.com:`, await byEmail.findByIndex(`alice@example.com`))
    console.log(`  missing:`, await byEmail.findByIndex(`missing@example.com`))

    console.log(`\n--- Update moves index atomically ---\n`)
    await byEmail.put(`u1`, {id: `u1`, email: `alice2@example.com`, name: `Alice`})
    console.log(`  old alice@example.com (empty):`, await byEmail.findByIndex(`alice@example.com`))
    console.log(`  new alice2@example.com:`, await byEmail.findByIndex(`alice2@example.com`))

    console.log(`\n--- Multiple primaries sharing same indexed value (dupSort) ---\n`)
    await byEmail.put(`u3`, {id: `u3`, email: `shared@example.com`, name: `Carol`})
    await byEmail.put(`u4`, {id: `u4`, email: `shared@example.com`, name: `Dave`})
    console.log(
      `  shared@example.com:`,
      (await byEmail.findByIndex(`shared@example.com`)).map((u) => u.id)
    )

    console.log(`\n--- Remove cleans index ---\n`)
    await byEmail.remove(`u1`)
    console.log(`  after remove u1, alice2@example.com:`, await byEmail.findByIndex(`alice2@example.com`))
    console.log(`  primary u1 gone:`, users.get(`u1`))

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
