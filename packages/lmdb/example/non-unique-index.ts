/**
 * Non-Unique Index (NonUniqueIndex) — use when you need to query primary records by a non-primary field
 * where many primaries can share the same indexed value (find Users by email domain, Orders by userId, Users by language).
 * Why: LMDB is key-value only — without an index you must full-scan O(N). This helper maintains a dupSort index
 * `IndexKey -> PrimaryKey` (SQL: CREATE INDEX — non-unique, allows duplicates, unlike CREATE UNIQUE INDEX) and updates
 * it in the same writer transaction as the primary `put`/`remove`, so concurrent writers never leave index and primary
 * inconsistent. The index repo MUST be `static dupSort = true` — validated in the constructor. `findByIndex` fans out
 * via `getValues` + `get` and returns primary values.
 *
 * Run with: `bun run packages/lmdb/example/non-unique-index.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {NonUniqueIndex} from "../src/non-unique-index"
import {LmdbRepository} from "../src/repository"

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
    const byEmail = new NonUniqueIndex(env, users, emailIndex, (u: User) => u.email)

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
      (await byEmail.findByIndex(`shared@example.com`)).map((u: User) => u.id)
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
