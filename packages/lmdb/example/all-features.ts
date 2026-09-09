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
 *
 * Every repository is an LmdbSchema (`static db` / `static key` / `static value`)
 * registered via `env.register(SchemaClass)`. Scalar shapes (bare-number
 * counters) and dupSort sub-DBs are declared with a scalar `static value`
 * (plus `static dupSort = true`); TTL-specific members (`put(..., {ttlMs})`,
 * `purgeExpired`) are exposed via a narrow `LmdbTtlRepository` cast.
 */

import {existsSync, mkdtempSync, readdirSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {backupWithRetention, LmdbReplica} from "../src/replica"
import {LmdbSchema, t} from "../src/schema"

// ── Schemas ─────────────────────────────────────────────────────────

class TenantUserSchema extends LmdbSchema {
  static db = `tenant-user`
  static key = t.array<string>() // composite key ["tenantId", "userId"]
  static value = {
    id: t.string(),
    email: t.string(),
    name: t.string()
  }
}

class UserSchema extends LmdbSchema {
  static db = `user`
  static key = t.string()
  static value = {
    id: t.string(),
    email: t.string(),
    name: t.string()
  }
}

class OrderSchema extends LmdbSchema {
  static db = `order`
  static key = t.string()
  static value = {
    id: t.string(),
    userId: t.string(),
    total: t.number()
  }
}

class ImageSchema extends LmdbSchema {
  static db = `image`
  static key = t.string()
  static value = {
    data: t.buffer()
  }
}

class SessionTTLSchema extends LmdbSchema {
  static db = `session-ttl`
  static key = t.string()
  static value = {
    userId: t.string(),
    token: t.string()
  }
  // Declaring `ttl` materializes a TTL repository; 0 = no default, per-call `{ttlMs}` only.
  static ttl = 0
}

class DocCborSchema extends LmdbSchema {
  static db = `doc-cbor`
  static key = t.string()
  static value = {
    id: t.string(),
    title: t.string(),
    tags: t.array<string>(),
    createdAt: t.number()
  }
}

class CounterSchema extends LmdbSchema {
  static db = `counter`
  static key = t.string()
  static value = t.number()
}

class EmailIndexSchema extends LmdbSchema {
  static db = `email-index`
  static key = t.string()
  static value = t.string()
  static dupSort = true
}

class JobsSchema extends LmdbSchema {
  static db = `jobs`
  static key = t.string()
  static value = {
    task: t.string()
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-all-features-`))
  console.log(`\n=== @gramstax/lmdb — All 12 Features Showcase ===`)
  console.log(`env path: ${dir}\n`)

  try {
    // ── Env ───────────────────────────────────────────────────────
    const env = new LmdbEnv({path: dir, maxDbs: 15})
    const tenantUser = env.register(TenantUserSchema)
    const users = env.register(UserSchema)
    const orders = env.register(OrderSchema)
    const images = env.register(ImageSchema)
    const sessions = env.register(SessionTTLSchema)
    const counters = env.register(CounterSchema)

    // ── F1: Composite keys ────────────────────────────────────────
    // Use case: Tenant isolation — same userId under different tenants must not collide.
    console.log(`--- F1: Composite keys [tenantId, userId] ---`)
    await tenantUser.put([`tenant-a`, `u1`], {id: `u1`, email: `a@a.com`, name: `Alice`})
    await tenantUser.put([`tenant-b`, `u1`], {id: `u1`, email: `a@b.com`, name: `Alice-B`})
    console.log(`  tenant-a/u1:`, tenantUser.get([`tenant-a`, `u1`]))
    console.log(`  tenant-b/u1:`, tenantUser.get([`tenant-b`, `u1`]))
    console.log(`  count:`, tenantUser.count(), `(isolated per composite key)`)

    // ── F2: Conditional writes ────────────────────────────────────
    console.log(`\n--- F2: Conditional writes (putIfNotExists / compareAndSet) ---`)
    const vEnvDir = mkdtempSync(join(tmpdir(), `lmdb-v-`))
    const vEnv = new LmdbEnv({path: vEnvDir, maxDbs: 5, useVersions: true})
    class VUserSchema extends LmdbSchema {
      static db = `vuser`
      static key = t.string()
      static value = {
        id: t.string(),
        email: t.string(),
        name: t.string()
      }
    }
    vEnv.register(VUserSchema)
    // putIfNotExists — create only if absent (safe for concurrent sign-ups)
    console.log(`  putIfNotExists u1 (first):`, await users.putIfNotExists(`u1`, {id: `u1`, email: `a@b.com`, name: `Alice`}))
    console.log(`  putIfNotExists u1 (second, should be false):`, await users.putIfNotExists(`u1`, {id: `u1`, email: `x@x.com`, name: `Hijack`}))
    console.log(`  u1 after second attempt:`, users.get(`u1`))
    // compareAndSet — optimistic locking via versions (root-level versioned put)
    await vEnv.rootPut(`u9`, {id: `u9`, email: `v@b.com`, name: `V1`}, 1)
    console.log(`  compareAndSet v1->v2 (correct version 1):`, await vEnv.rootPut(`u9`, {id: `u9`, email: `v@b.com`, name: `V2`}, 2, 1))
    console.log(`  compareAndSet with stale version 1 (should be false):`, await vEnv.rootPut(`u9`, {id: `u9`, email: `v@b.com`, name: `V3`}, 3, 1))
    await vEnv.close()
    rmSync(vEnvDir, {recursive: true, force: true})

    // ── F3: Atomic counter ────────────────────────────────────────
    console.log(`\n--- F3: Atomic increment ---`)
    // Scalar schema: counter values are bare numbers.
    await counters.put(`order-seq`, 100)
    console.log(`  increment order-seq by 1:`, await counters.increment(`order-seq`))
    console.log(`  increment by 5:`, await counters.increment(`order-seq`, 5))
    console.log(`  final:`, counters.get(`order-seq`))

    // ── F4: CBOR encoding ─────────────────────────────────────────
    console.log(`\n--- F4: CBOR encoding (optional cbor-x peer) ---`)
    // cbor env is separate because encoding is per-env
    const cborDir = mkdtempSync(join(tmpdir(), `lmdb-cbor-`))
    const cborEnv = new LmdbEnv({path: cborDir, maxDbs: 5, encoding: `cbor`})
    const cborDocs = cborEnv.register(DocCborSchema)
    await cborDocs.put(`d1`, {id: `d1`, title: `Hello CBOR`, tags: [`a`, `b`], createdAt: Date.now()})
    console.log(`  cbor get d1:`, cborDocs.get(`d1`))
    await cborEnv.close()
    rmSync(cborDir, {recursive: true, force: true})

    // ── F5: dupSort ───────────────────────────────────────────────
    console.log(`\n--- F5: dupSort (email -> userId index) ---`)
    // Scalar dupSort schema: one key -> many ordered values.
    const emailIndex = env.register(EmailIndexSchema)
    await emailIndex.addValue(`shared@b.com`, `u1`)
    await emailIndex.addValue(`shared@b.com`, `u2`)
    console.log(`  shared@b.com ->`, await emailIndex.getValues(`shared@b.com`))
    console.log(`  count shared@b.com:`, emailIndex.getValuesCount(`shared@b.com`))
    await emailIndex.removeValue(`shared@b.com`, `u1`)
    console.log(`  after remove u1:`, await emailIndex.getValues(`shared@b.com`))

    // ── F6: Binary helpers ────────────────────────────────────────
    console.log(`\n--- F6: Binary helpers (asBinary) ---`)
    const blob = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]) // PNG header
    await images.putBinary(`logo`, blob)
    console.log(`  getBinary logo:`, images.getBinary(`logo`))
    console.log(`  getBinaryFast length:`, images.getBinaryFast(`logo`)?.length)

    // ── F7: TTL ───────────────────────────────────────────────────
    // Priority: per-call ttlMs → static ttl → never expires
    console.log(`\n--- F7: TTL repository (per-call + schema default) ---`)
    await sessions.put(`s1`, {userId: `u1`, token: `tok-abc`}, {ttlMs: 80})
    console.log(`  s1 before expiry:`, sessions.get(`s1`))
    await Bun.sleep(100)
    console.log(`  s1 after 100ms (expired):`, sessions.get(`s1`))
    await sessions.put(`s2`, {userId: `u2`, token: `tok-xyz`}, {ttlMs: 200})
    await sessions.put(`s3`, {userId: `u3`, token: `keep`}) // never expires
    await Bun.sleep(30)
    console.log(`  purgeExpired removed:`, await sessions.purgeExpired(), `(s1 already gone)`)
    console.log(`  s2 alive:`, !!sessions.get(`s2`), `s3 alive:`, !!sessions.get(`s3`))

    // Schema-level default: static ttl = 80, per-call overrides it
    class DefaultTtlSessionSchema extends LmdbSchema {
      static db = `session-default-ttl`
      static key = t.string()
      static value = {
        userId: t.string(),
        token: t.string()
      }
      static ttl = 80
    }
    const defaultTtlSessions = env.register(DefaultTtlSessionSchema)
    await defaultTtlSessions.put(`d1`, {userId: `u1`, token: `via-schema`}) // uses static ttl 80ms
    console.log(`  d1 with schema default 80ms (alive):`, !!defaultTtlSessions.get(`d1`))
    await Bun.sleep(100)
    console.log(`  d1 after 100ms (expired via schema):`, defaultTtlSessions.get(`d1`))
    await defaultTtlSessions.put(`d2`, {userId: `u2`, token: `override`}, {ttlMs: 300000}) // per-call overrides schema
    await Bun.sleep(100)
    console.log(`  d2 per-call 300s overrides schema (alive):`, !!defaultTtlSessions.get(`d2`))

    // ── F8: Migrations ────────────────────────────────────────────
    console.log(`\n--- F8: Schema migrations ---`)
    console.log(`  current version:`, env.getMigrationVersion())
    const migResult = await env.migrate([
      {
        version: 1,
        name: `seed-orders`,
        up: async () => {
          await orders.put(`o1`, {id: `o1`, userId: `u10`, total: 42})
        }
      },
      {
        version: 2,
        name: `seed-more`,
        up: async () => {
          await orders.put(`o2`, {id: `o2`, userId: `u11`, total: 99})
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

    // ── F9: Bulk ─────────────────────────────────────────────────
    console.log(`\n--- F9: Bulk putMany / exportJSONL / importJSONL ---`)
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

    // ── F10: Queue ───────────────────────────────────────────────
    console.log(`\n--- F10: FIFO queue ---`)
    const {LmdbQueue} = await import("../src/queue")
    const queue = new LmdbQueue(env, JobsSchema)
    const qid1 = await queue.enqueue({task: `email-welcome`})
    const qid2 = await queue.enqueue({task: `generate-invoice`})
    console.log(`  enqueued:`, qid1, qid2, `size:`, await queue.size())
    console.log(`  peek:`, await queue.peek())
    console.log(`  dequeue:`, await queue.dequeue())
    console.log(`  size after dequeue:`, await queue.size())
    await queue.clear()

    // ── F11: Replica + backup retention ───────────────────────────
    console.log(`\n--- F11: Replica (readOnly) + backupWithRetention ---`)
    const replica = await LmdbReplica.open(dir)
    const replicaUsers = replica.register(UserSchema)
    replica.resetReadTxn()
    console.log(`  replica readOnly:`, replica.readOnly, `peek u10:`, replicaUsers.get(`u10`))
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
    try {
      rmSync(dir, {recursive: true, force: true})
    } catch {
      // Windows LMDB lock race — ignore
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
