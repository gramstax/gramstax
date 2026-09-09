/**
 * Two LmdbSchema repos coexisting in one env — each schema class declares its own
 * `static db`, and `register(SchemaClass)` materializes a fully typed repository per
 * schema. The returned handle is the only way to reach a repo — keep it from
 * `const users = env.register(UserSchema)` instead of re-fetching. Both repos share
 * one env, one transaction boundary, and per-repo sub-DB isolation (same key,
 * different data, zero collision).
 *
 * Run with: `bun run packages/lmdb/example/hybrid.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {type KeyOf, LmdbSchema, t, type ValueOf} from "../src/schema"

// Schema repo 1 — users keyed by id, unique `id` + `username` columns, non-unique `email`.
type IKUsers = KeyOf<typeof UsersSchema>
class UsersSchema extends LmdbSchema {
  static db = `users`
  static key = t.number()
  static value = {
    id: t.number().unique(),
    username: t.string().unique(),
    email: t.string().index()
  }
}

// Schema repo 2 — profiles keyed by id, unique `userId` column.
type IVProfiles = ValueOf<typeof ProfilesSchema>
class ProfilesSchema extends LmdbSchema {
  static db = `profiles`
  static key = t.number()
  static value = {
    userId: t.number().unique(),
    bio: t.string()
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-hybrid-`))
  const env = new LmdbEnv({path: dir, maxDbs: 10})
  const users = env.register(UsersSchema)
  const profiles = env.register(ProfilesSchema)
  try {
    console.log(`--- put 1 record in each repo — same key 1, different data, isolated sub-DBs ---\n`)
    const key: IKUsers = 1
    await users.put(key, {id: 1, username: `damar`, email: `damar@example.com`})
    await profiles.put(key, {userId: 1, bio: `Schema-driven bio`})
    console.log(`  users.get(1):`, users.get(1))
    console.log(`  profiles.get(1):`, profiles.get(1))
    console.log(`  users.count():`, users.count(), `| profiles.count():`, profiles.count())

    console.log(`\n--- cross-repo transaction: reads from both repos in one atomic unit ---\n`)
    const snapshot = await env.transaction(() => ({
      user: users.get(1),
      profile: profiles.get(1)
    }))
    console.log(`  in-tx users.get(1):`, snapshot.user)
    console.log(`  in-tx profiles.get(1):`, snapshot.profile)

    console.log(`\n--- handle reads: users.get(key) / users.has(key) ---\n`)
    console.log(`  users.get(1):`, users.get(1))
    console.log(`  users.has(1):`, users.has(1))
    console.log(`  profiles.has(1):`, profiles.has(1))
    console.log(`  users.get(99):`, users.get(99))
    const profileViaGet: IVProfiles | undefined = profiles.get(1)
    console.log(`  profiles.get(1):`, profileViaGet)

    console.log(`\n--- findByIndex on both repos ---\n`)
    console.log(`  users.findByIndex({username: damar}):`, await users.findByIndex({username: `damar`}))
    console.log(`  profiles.findByIndex({userId: 1}):`, await profiles.findByIndex({userId: 1}))

    console.log(`\nenv closed cleanly`)
  } finally {
    await env.close()
    rmSync(dir, {recursive: true, force: true})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
