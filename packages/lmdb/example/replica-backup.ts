/**
 * Replica + Backup Retention (LmdbReplica / backupWithRetention) — use for 1-writer N-reader deployments and
 * operational safety. Why: `LmdbReplica.open(path)` opens the same file readOnly with optional `pollMs` polling via
 * `resetReadTxn` (readers otherwise see a stale snapshot until next event turn); `backupWithRetention(env, baseDir, keep)`
 * creates timestamped `backup-…` subdirs via `env.backup` and prunes oldest beyond `keep` by `mtimeMs` sort.
 * Readers never block the writer; backups are crash-consistent snapshots.
 *
 * Run with: `bun run packages/lmdb/example/replica-backup.ts`
 * Note: backup is skipped on win32 in this demo (native LMDB mmap file-lock race, as in env.test.ts).
 */
import {existsSync, mkdtempSync, readdirSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {backupWithRetention, LmdbReplica} from "../src/replica"
import {LmdbRepository} from "../src/repository"

type User = {id: string; name: string}

class UserRepo extends LmdbRepository<User, string> {
  static dbName = `user`
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-replica-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    env.register(UserRepo)
    await env.get(UserRepo).put(`u1`, {id: `u1`, name: `Alice`})
    await env.committed

    console.log(`--- Replica (readOnly) ---\n`)
    const replica = await LmdbReplica.open(dir)
    replica.register(UserRepo)
    replica.resetReadTxn()
    console.log(`  replica readOnly:`, replica.readOnly)
    console.log(`  replica sees u1:`, replica.get(UserRepo).get(`u1`))

    await env.get(UserRepo).put(`u2`, {id: `u2`, name: `Bob`})
    await env.committed
    // Replica's read txn is stale until reset
    console.log(`  before reset, sees u2?`, replica.get(UserRepo).get(`u2`))
    replica.resetReadTxn()
    console.log(`  after resetReadTxn, sees u2:`, replica.get(UserRepo).get(`u2`))

    try {
      await replica.get(UserRepo).put(`u3`, {id: `u3`, name: `Carol`})
    } catch (err) {
      console.log(`  replica write throws:`, (err as Error).name)
    }
    await replica.close()
    console.log(`  replica closed`)

    console.log(`\n--- backupWithRetention (keep=2) ---\n`)
    if (process.platform === `win32`) {
      console.log(`  skipped on win32 (native flakiness, as in env.test.ts)`)
      console.log(`  env path exists:`, existsSync(dir))
    } else {
      const base = mkdtempSync(join(tmpdir(), `lmdb-backup-demo-`))
      try {
        await backupWithRetention(env, base, 2)
        await Bun.sleep(10)
        await backupWithRetention(env, base, 2)
        await Bun.sleep(10)
        await backupWithRetention(env, base, 2)
        const entries = readdirSync(base)
        console.log(`  backups kept (keep=2):`, entries.length, `(expected 2)`)
        for (const e of entries) {
          const full = join(base, e)
          console.log(`    ${e} exists:`, existsSync(full))
        }
      } finally {
        rmSync(base, {recursive: true, force: true})
      }
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
