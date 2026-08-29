/**
 * Composite Keys — use when you need tenant / namespace isolation without manual string concatenation.
 * Why: ordered-binary encodes `["tenant-a", 42]` lexicographically, so multi-tenant keys like ["tenant-a","u1"] and
 * ["tenant-b","u1"] are distinct B+ tree entries and sort naturally; no prefix parsing, no collision, and range scans
 * like "all keys for tenant-a" become a bounded [ ["tenant-a",0], ["tenant-a",\uffff] ) scan. Use instead of "tenant-a:u1".
 *
 * A schema `static key` is a single `t` builder — a composite key is an array-typed
 * column (`t.array<string>()`): the runtime key is a plain array like ["tenant-a", "u1"].
 *
 * Run with: `bun run packages/lmdb/example/composite-keys.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"

class TenantUserSchema extends LmdbSchema {
  static db = `tenant-user`
  static key = t.array<string>() // composite key ["tenantId", "userId"]
  static value = {
    id: t.string(),
    name: t.string()
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-composite-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 5})

    const tenantUsers = env.register(TenantUserSchema)

    console.log(`--- Composite keys: same userId under different tenants are distinct ---\n`)
    await tenantUsers.put([`tenant-a`, `u1`], {id: `u1`, name: `Alice`})
    await tenantUsers.put([`tenant-b`, `u1`], {id: `u1`, name: `Alice-B`})
    await tenantUsers.put([`tenant-a`, `u2`], {id: `u2`, name: `Bob`})

    console.log(`tenant-a/u1:`, tenantUsers.get([`tenant-a`, `u1`]))
    console.log(`tenant-b/u1:`, tenantUsers.get([`tenant-b`, `u1`]))
    console.log(`has tenant-a/u2:`, tenantUsers.has([`tenant-a`, `u2`]))
    console.log(`has tenant-b/u2:`, tenantUsers.has([`tenant-b`, `u2`])) // false
    console.log(`count:`, tenantUsers.count())

    console.log(`\n--- Ordered iteration (lexicographic) ---\n`)
    const all = await tenantUsers.entries()
    for (const [k, v] of all) console.log(`${JSON.stringify(k)} ->`, v)

    // Bounded tenant scan via range: all keys for tenant-a
    const tenantA = await tenantUsers.entries({start: [`tenant-a`, ``], end: [`tenant-a`, `\uffff`]})
    console.log(`\ntenant-a entries:`, tenantA)

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
