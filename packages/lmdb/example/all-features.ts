/**
 * All-features showcase for @gramstax/lmdb backlog 013 (12 features).
 *
 * Run with: `bun run packages/lmdb/example/all-features.ts`
 *
 * Use case — Multi-tenant SaaS order platform:
 *  - Tenants isolate data via composite keys
 *  - Users created with conditional writes, counters, and cbor efficiency
 *  - Orders indexed via dupSort + secondary index
 *  - Product images stored as raw binary
 *  - Sessions with TTL
 *  - Schema migrations, bulk import/export, queue processing, replica/backup
 */

import {existsSync, mkdtempSync, readdirSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {NonUniqueIndex} from "../src/non-unique-index"
import {backupWithRetention, LmdbReplica} from "../src/replica"
import {LmdbRepository} from "../src/repository"
import {LmdbTtlRepository} from "../src/ttl"

// ── Types ──────────────────────────────────────────────────────────

type User = {id: string; email: string; name: string}
type Order = {id: string; userId: string; total: number}
type Session = {userId: string; token: string}
// ── Repositories ───────────────────────────────────────────────────

class TenantUserRepo extends LmdbRepository<User, [string, string]> {
  static dbName = `tenant-user`
}

class UserRepo extends LmdbRepository<User, string> {
  static dbName = `user`
}

class CounterRepo extends LmdbRepository<number, string> {
  static dbName = `counter`
}

class OrderRepo extends LmdbRepository<Order, string> {
  static dbName = `order`
}

// dupSort index: email -> userId
class EmailIndexRepo extends LmdbRepository<string, string> {
  static dbName = `email-index`
  static dupSort = true
}

class OrderByUserIndexRepo extends LmdbRepository<string, string> {
  static dbName = `order-by-user`
  static dupSort = true
}

class ImageRepo extends LmdbRepository<Buffer, string> {
  static dbName = `image`
}

class SessionRepo extends LmdbTtlRepository<Session, string> {
  static dbName = `session-ttl`
}

class DocRepo extends LmdbRepository<{title: string}, string> {
  static dbName = `doc-cbor`
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-all-features-`))
  console.log(`\n=== @gramstax/lmdb — All 12 Features Showcase ===`)
  console.log(`env path: ${dir}\n`)

  try {
    // ── Env ───────────────────────────────────────────────────────
    const env = new LmdbEnv({path: dir, maxDbs: 15})

    // ── F1: Composite keys ────────────────────────────────────────
    // Use case: Tenant isolation — same userId under different tenants must not collide.
    console.log(`--- F1: Composite keys [tenantId, userId] ---`)
    const tenantUsers = env.register(TenantUserRepo)
    await tenantUsers.put([`tenant-a`, `u1`], {id: `u1`, email: `a@a.com`, name: `Alice`})
    await tenantUsers.put([`tenant-b`, `u1`], {id: `u1`, email: `a@b.com`, name: `Alice-B`})
    console.log(`  tenant-a/u1:`, tenantUsers.get([`tenant-a`, `u1`]))
    console.log(`  tenant-b/u1:`, tenantUsers.get([`tenant-b`, `u1`]))
    console.log(`  count:`, tenantUsers.count(), `(isolated per composite key)`)

    // ── F2: Conditional writes ────────────────────────────────────
    console.log(`\n--- F2: Conditional writes (putIfNotExists / compareAndSet) ---`)
    const users = env.register(UserRepo)
    const vEnvDir = mkdtempSync(join(tmpdir(), `lmdb-v-`))
    const vEnv = new LmdbEnv({path: vEnvDir, maxDbs: 5, useVersions: true})
    class VUserRepo extends LmdbRepository<User, string> {
      static dbName = `vuser`
    }
    const vUsers = vEnv.register(VUserRepo)
    // putIfNotExists — create only if absent (safe for concurrent sign-ups)
    console.log(`  putIfNotExists u1 (first):`, await users.putIfNotExists(`u1`, {id: `u1`, email: `a@b.com`, name: `Alice`}))
    console.log(`  putIfNotExists u1 (second, should be false):`, await users.putIfNotExists(`u1`, {id: `u1`, email: `x@x.com`, name: `Hijack`}))
    console.log(`  u1 after second attempt:`, users.get(`u1`))
    // compareAndSet — optimistic locking via versions
    await (vUsers as unknown as {env: LmdbEnv}).env.put(`u9`, {id: `u9`, email: `v@b.com`, name: `V1`}, 1)
    console.log(`  compareAndSet v1->v2 (correct version 1):`, await vUsers.compareAndSet(`u9`, 1, {id: `u9`, email: `v@b.com`, name: `V2`}))
    console.log(`  compareAndSet with stale version 1 (should be false):`, await vUsers.compareAndSet(`u9`, 1, {id: `u9`, email: `v@b.com`, name: `V3`}))
    await vEnv.close()
    rmSync(vEnvDir, {recursive: true, force: true})

    // ── F3: Atomic counter ────────────────────────────────────────
    console.log(`\n--- F3: Atomic increment ---`)
    const counters = env.register(CounterRepo)
    await counters.put(`order-seq`, 100)
    console.log(`  increment order-seq by 1:`, await counters.increment(`order-seq`))
    console.log(`  increment by 5:`, await counters.increment(`order-seq`, 5))
    console.log(`  final:`, counters.get(`order-seq`))

    // ── F4: CBOR encoding ─────────────────────────────────────────
    console.log(`\n--- F4: CBOR encoding (optional cbor-x peer) ---`)
    // cbor env is separate because encoding is per-env
    const cborDir = mkdtempSync(join(tmpdir(), `lmdb-cbor-`))
    const cborEnv = new LmdbEnv({path: cborDir, maxDbs: 5, encoding: `cbor`})
    const docs = cborEnv.register(DocRepo)
    await docs.put(`d1`, {title: `Hello CBOR`})
    console.log(`  cbor get d1:`, docs.get(`d1`))
    await cborEnv.close()
    rmSync(cborDir, {recursive: true, force: true})

    // ── F5: dupSort ───────────────────────────────────────────────
    console.log(`\n--- F5: dupSort (email -> userId index) ---`)
    const emailIndex = env.register(EmailIndexRepo)
    await emailIndex.addValue(`shared@b.com`, `u1`)
    await emailIndex.addValue(`shared@b.com`, `u2`)
    console.log(`  shared@b.com ->`, await emailIndex.getValues(`shared@b.com`))
    console.log(`  count shared@b.com:`, emailIndex.getValuesCount(`shared@b.com`))
    await emailIndex.removeValue(`shared@b.com`, `u1`)
    console.log(`  after remove u1:`, await emailIndex.getValues(`shared@b.com`))

    // ── F6: Binary helpers ────────────────────────────────────────
    console.log(`\n--- F6: Binary helpers (asBinary) ---`)
    const images = env.register(ImageRepo)
    const blob = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]) // PNG header
    await images.putBinary(`logo`, blob)
    console.log(`  getBinary logo:`, images.getBinary(`logo`))
    console.log(`  getBinaryFast length:`, images.getBinaryFast(`logo`)?.length)

    // ── F7: TTL ───────────────────────────────────────────────────
    // Priority: per-call ttlMs → static ttlMs → never expires
    console.log(`\n--- F7: TTL repository (per-call + class default) ---`)
    const sessions = env.register(SessionRepo)
    await sessions.put(`s1`, {userId: `u1`, token: `tok-abc`}, {ttlMs: 80})
    console.log(`  s1 before expiry:`, sessions.get(`s1`))
    await Bun.sleep(100)
    console.log(`  s1 after 100ms (expired):`, sessions.get(`s1`))
    await sessions.put(`s2`, {userId: `u2`, token: `tok-xyz`}, {ttlMs: 200})
    await sessions.put(`s3`, {userId: `u3`, token: `keep`}) // never expires
    await Bun.sleep(30)
    console.log(`  purgeExpired removed:`, await sessions.purgeExpired(), `(s1 already gone)`)
    console.log(`  s2 alive:`, !!sessions.get(`s2`), `s3 alive:`, !!sessions.get(`s3`))

    // Class-level default: static ttlMs = 80, per-call overrides it
    class DefaultTtlSessionRepo extends LmdbTtlRepository<Session, string> {
      static dbName = `session-default-ttl`
      static ttlMs = 80
    }
    const defaultSessions = env.register(DefaultTtlSessionRepo)
    await defaultSessions.put(`d1`, {userId: `u1`, token: `via-class`}) // uses class 80ms
    console.log(`  d1 with class default 80ms (alive):`, !!defaultSessions.get(`d1`))
    await Bun.sleep(100)
    console.log(`  d1 after 100ms (expired via class):`, defaultSessions.get(`d1`))
    await defaultSessions.put(`d2`, {userId: `u2`, token: `override`}, {ttlMs: 300000}) // per-call overrides class
    await Bun.sleep(100)
    console.log(`  d2 per-call 300s overrides class (alive):`, !!defaultSessions.get(`d2`))

    // ── F8: Secondary index ───────────────────────────────────────
    console.log(`\n--- F8: Secondary index (email -> user) ---`)
    const orders = env.register(OrderRepo)
    env.register(OrderByUserIndexRepo)
    const userIndex = new NonUniqueIndex(env, users, emailIndex, (u: User) => u.email)
    // Reuse users + emailIndex from F5; put via index helper
    await userIndex.put(`u10`, {id: `u10`, email: `alice@example.com`, name: `Alice`})
    await userIndex.put(`u11`, {id: `u11`, email: `bob@example.com`, name: `Bob`})
    console.log(`  find alice@example.com:`, await userIndex.findByIndex(`alice@example.com`))
    await userIndex.put(`u10`, {id: `u10`, email: `alice2@example.com`, name: `Alice`})
    console.log(`  after email change, old index empty:`, await userIndex.findByIndex(`alice@example.com`))
    console.log(`  new index:`, await userIndex.findByIndex(`alice2@example.com`))

    // ── F9: Migrations ────────────────────────────────────────────
    console.log(`\n--- F9: Schema migrations ---`)
    console.log(`  current version:`, env.getMigrationVersion())
    const migResult = await env.migrate([
      {
        version: 1,
        name: `seed-orders`,
        up: async (e) => {
          await e.get(OrderRepo).put(`o1`, {id: `o1`, userId: `u10`, total: 42})
        }
      },
      {
        version: 2,
        name: `seed-more`,
        up: async (e) => {
          await e.get(OrderRepo).put(`o2`, {id: `o2`, userId: `u11`, total: 99})
        }
      }
    ])
    console.log(
      `  applied:`,
      migResult.applied.map((m) => m.version),
      `current:`,
      migResult.currentVersion
    )
    console.log(`  re-run (idempotent) applied:`, (await env.migrate([{version: 1, name: `seed-orders`, up: async () => {}}])).applied.length)

    // ── F10: Bulk ─────────────────────────────────────────────────
    console.log(`\n--- F10: Bulk putMany / exportJSONL / importJSONL ---`)
    await orders.putMany([
      [`o10`, {id: `o10`, userId: `u1`, total: 10}],
      [`o11`, {id: `o11`, userId: `u1`, total: 20}],
      [`o12`, {id: `o12`, userId: `u2`, total: 30}]
    ])
    console.log(`  count after putMany:`, orders.count())
    const jsonl = await orders.exportJSONL()
    console.log(`  exportJSONL lines:`, jsonl.split(`\n`).length)
    await orders.clear()
    console.log(`  count after clear:`, orders.count())
    console.log(`  importJSONL restored:`, await orders.importJSONL(jsonl), `count:`, orders.count())

    // ── F11: Queue ────────────────────────────────────────────────
    console.log(`\n--- F11: FIFO queue ---`)
    const {LmdbQueue} = await import("../src/queue")
    const queue = new LmdbQueue<{task: string}>(env, `jobs`)
    const qid1 = await queue.enqueue({task: `email-welcome`})
    const qid2 = await queue.enqueue({task: `generate-invoice`})
    console.log(`  enqueued:`, qid1, qid2, `size:`, await queue.size())
    console.log(`  peek:`, await queue.peek())
    console.log(`  dequeue:`, await queue.dequeue())
    console.log(`  size after dequeue:`, await queue.size())
    await queue.clear()

    // ── F12: Replica + backup retention ───────────────────────────
    console.log(`\n--- F12: Replica (readOnly) + backupWithRetention ---`)
    const replica = await LmdbReplica.open(dir)
    replica.register(UserRepo)
    replica.resetReadTxn()
    console.log(`  replica readOnly:`, replica.readOnly, `peek u10:`, replica.get(UserRepo).get(`u10`))
    await replica.close()
    if (process.platform !== `win32`) {
      const base = mkdtempSync(join(tmpdir(), `lmdb-backup-demo-`))
      try {
        await backupWithRetention(env, base, 2)
        await Bun.sleep(10)
        await backupWithRetention(env, base, 2)
        console.log(`  backups kept (keep=2):`, readdirSync(base).length, `expected 2`)
        console.log(`  backup dirs:`, readdirSync(base))
      } finally {
        rmSync(base, {recursive: true, force: true})
      }
    } else {
      console.log(`  backup skipped on win32 (native flakiness, as in env.test.ts)`)
      // Still demonstrate backup call would work on non-win32
      if (existsSync(dir)) console.log(`  env path exists:`, true)
    }

    await env.close()
    console.log(`\nenv closed cleanly — all 12 features demonstrated`)
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
