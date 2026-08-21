/**
 * Schema Migrations (LmdbEnv.migrate) — use when your data shape evolves and you must upgrade existing DB files
 * in place. Why: stores current `__version` in a hidden `__migrations` sub-DB; `migrate([...])` runs pending `up` callbacks
 * each inside its own writer transaction and bumps the version only on success, so a crash rolls back the failed step
 * and a concurrent second process re-checks the version inside the transaction and skips already-applied steps.
 * Re-running is idempotent and duplicate versions throw.
 *
 * Run with: `bun run packages/lmdb/example/migrations.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbRepository} from "../src/repository"

type User = {id: string; name: string}

class UserRepo extends LmdbRepository<User, string> {
  static dbName = `user`
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-migrate-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    env.register(UserRepo)

    console.log(`--- Migrations (versioned, idempotent) ---\n`)
    console.log(`  current version (0):`, env.getMigrationVersion())

    const r1 = await env.migrate([
      {version: 1, name: `seed-alice`, up: async (e) => { await e.get(UserRepo).set(`u1`, {id: `u1`, name: `Alice`}) }},
      {version: 2, name: `seed-bob`, up: async (e) => { await e.get(UserRepo).set(`u2`, {id: `u2`, name: `Bob`}) }},
      {version: 3, name: `seed-carol`, up: async (e) => { await e.get(UserRepo).set(`u3`, {id: `u3`, name: `Carol`}) }},
    ])
    console.log(`  applied:`, r1.applied.map((m) => `${m.version}:${m.name}`), `current:`, r1.currentVersion)
    console.log(`  u1:`, env.get(UserRepo).get(`u1`))

    console.log(`\n  re-run same (idempotent, 0 applied):`, (await env.migrate([{version: 1, name: `seed-alice`, up: async () => {}}])).applied.length)

    console.log(`\n--- Rollback on failure ---\n`)
    try {
      await env.migrate([{version: 4, name: `bad`, up: async () => { throw new Error(`boom`) }}])
    } catch (err) {
      console.log(`  failed as expected:`, (err as Error).message)
    }
    console.log(`  version still 3:`, env.getMigrationVersion())
    await env.migrate([{version: 4, name: `good`, up: async (e) => { await e.get(UserRepo).set(`u4`, {id: `u4`, name: `Dave`}) }}])
    console.log(`  after good v4, version 4:`, env.getMigrationVersion(), `u4:`, env.get(UserRepo).get(`u4`))

    console.log(`\n--- Duplicate version throws ---\n`)
    try {
      await env.migrate([
        {version: 5, name: `a`, up: async () => {}},
        {version: 5, name: `b`, up: async () => {}},
      ])
    } catch (err) {
      console.log(`  duplicate error:`, (err as Error).message)
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
