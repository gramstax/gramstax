/**
 * Conditional Writes (putIfNotExists / compareAndSet) — use when concurrent writers (multiple bot instances / processes)
 * must not overwrite each other. Why: LMDB has a single writer lock; `putIfNotExists` maps to native `ifNoExists` (MDB_NOOVERWRITE)
 * and `compareAndSet` maps to `ifVersion` (optimistic locking). Both are atomic at the storage engine: the check and the write
 * commit together or not at all, so a second process racing on the same key cannot both succeed. Use for sign-up (create
 * user only if absent) and for CAS updates (retry on version mismatch). Requires `useVersions:true` for CAS.
 *
 * Run with: `bun run packages/lmdb/example/conditional-writes.ts`
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
    email: t.string(),
    name: t.string()
  }
}

class VUserSchema extends LmdbSchema {
  static db = `vuser`
  static key = t.string()
  static value = {
    id: t.string(),
    email: t.string(),
    name: t.string()
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-cond-`))
  const vDir = mkdtempSync(join(tmpdir(), `lmdb-cond-v-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 5})
    const users = env.register(UserSchema)

    console.log(`--- putIfNotExists: atomic sign-up ---\n`)
    console.log(`  first sign-up u1:`, await users.putIfNotExists(`u1`, {id: `u1`, email: `a@b.com`, name: `Alice`})) // true
    console.log(`  second sign-up u1 (race):`, await users.putIfNotExists(`u1`, {id: `u1`, email: `x@x.com`, name: `Hijack`})) // false
    console.log(`  stored:`, users.get(`u1`)) // still Alice

    console.log(`\n--- compareAndSet: optimistic locking (requires useVersions) ---\n`)
    const vEnv = new LmdbEnv({path: vDir, maxDbs: 5, useVersions: true})
    vEnv.register(VUserSchema)
    // Seed version 1 via raw rootPut with explicit version
    await vEnv.rootPut(`u9`, {id: `u9`, email: `v@b.com`, name: `V1`}, 1)
    console.log(`  CAS v1->v2 (correct 1):`, await vEnv.rootPut(`u9`, {id: `u9`, email: `v@b.com`, name: `V2`}, 2, 1)) // true
    console.log(`  CAS with stale 1 (should be false):`, await vEnv.rootPut(`u9`, {id: `u9`, email: `v@b.com`, name: `V3`}, 3, 1)) // false
    console.log(`  stored after CAS:`, vEnv.rootGetEntry(`u9`)?.value)
    try {
      const plainEnv = new LmdbEnv({path: mkdtempSync(join(tmpdir(), `plain-`)), maxDbs: 2})
      plainEnv.register(UserSchema)
      console.log(`  CAS without useVersions (no match):`, await plainEnv.rootPut(`x`, {id: `x`, email: `x`, name: `x`}, 1, 1))
    } catch (err) {
      console.log(`  CAS without useVersions throws:`, (err as Error).message.slice(0, 60), `...`)
    }

    await vEnv.close()
    await env.close()
    console.log(`\nenv closed cleanly`)
  } finally {
    rmSync(dir, {recursive: true, force: true})
    rmSync(vDir, {recursive: true, force: true})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
