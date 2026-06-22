/**
 * Basic LMDB usage example.
 *
 * Run with: `bun run packages/lmdb/example/basic.ts`
 *
 * Demonstrates:
 * - Opening an LmdbEnv
 * - Defining LmdbRepository subclasses with static `dbName`
 * - Registering repositories with the env
 * - Basic CRUD: set, get, has, delete, count, clear
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbRepository} from "../src/repository"

type SchemaUser = {
  id: string
  name: string
  age: number
}

type SchemaSession = {
  sid: string
  data: string
}

class UserRepository extends LmdbRepository<SchemaUser, string> {
  static dbName = `user`
}

class SessionRepository extends LmdbRepository<SchemaSession, string> {
  static dbName = `session`
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-basic-`))

  try {
    const env = new LmdbEnv({path: dir, maxDbs: 5})
    await env.open()

    const users = env.register(UserRepository)
    const sessions = env.register(SessionRepository)

    console.log(`--- Basic CRUD ---\n`)

    await users.set(`u1`, {id: `u1`, name: `Alice`, age: 30})
    await users.set(`u2`, {id: `u2`, name: `Bob`, age: 25})
    await users.set(`u3`, {id: `u3`, name: `Carol`, age: 35})

    const u1 = await users.get(`u1`)
    console.log(`get u1:`, u1)

    console.log(`has u2:`, await users.has(`u2`))
    console.log(`has missing:`, await users.has(`missing`))

    console.log(`count:`, await users.count())

    console.log(`delete u3:`, await users.delete(`u3`))
    console.log(`count after delete:`, await users.count())

    await sessions.set(`s1`, {sid: `s1`, data: `active`})
    console.log(`session s1:`, await sessions.get(`s1`))

    await users.clear()
    console.log(`count after clear:`, await users.count())

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
