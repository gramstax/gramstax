/**
 * Basic LMDB usage example.
 *
 * Run with: `bun run packages/lmdb/example/basic.ts`
 *
 * Demonstrates:
 * - Opening an LmdbEnv
 * - Defining LmdbSchema subclasses with static `db` / `key` / `value`
 * - Registering schemas with the env (`register(SchemaClass)` → typed repo)
 * - Basic CRUD: put, get, has, delete, count, clear
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
    name: t.string(),
    age: t.number()
  }
}

class SessionSchema extends LmdbSchema {
  static db = `session`
  static key = t.string()
  static value = {
    sid: t.string(),
    data: t.string()
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-basic-`))

  try {
    const env = new LmdbEnv({path: dir, maxDbs: 5})

    const users = env.register(UserSchema)
    const sessions = env.register(SessionSchema)

    console.log(`--- Basic CRUD ---\n`)

    await users.put(`u1`, {id: `u1`, name: `Alice`, age: 30})
    await users.put(`u2`, {id: `u2`, name: `Bob`, age: 25})
    await users.put(`u3`, {id: `u3`, name: `Carol`, age: 35})

    const u1 = users.get(`u1`)
    console.log(`get u1:`, u1)

    console.log(`has u2:`, users.has(`u2`))
    console.log(`has missing:`, users.has(`missing`))

    console.log(`count:`, users.count())

    console.log(`delete u3:`, await users.delete(`u3`))
    console.log(`count after delete:`, users.count())

    await sessions.put(`s1`, {sid: `s1`, data: `active`})
    console.log(`session s1:`, sessions.get(`s1`))

    await users.clear()
    console.log(`count after clear:`, users.count())

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
