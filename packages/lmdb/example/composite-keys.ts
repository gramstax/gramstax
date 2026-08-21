/**
 * Composite Keys — use when you need tenant / namespace isolation without manual string concatenation.
 * Why: ordered-binary encodes `["tenant-a", 42]` lexicographically, so multi-tenant keys like ["tenant-a","u1"] and
 * ["tenant-b","u1"] are distinct B+ tree entries and sort naturally; no prefix parsing, no collision, and range scans
 * like "all keys for tenant-a" become a bounded [ ["tenant-a",0], ["tenant-a",\uffff] ) scan. Use instead of "tenant-a:u1".
 *
 * Run with: `bun run packages/lmdb/example/composite-keys.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbRepository} from "../src/repository"

type User = {id: string; name: string}

class TenantUserRepo extends LmdbRepository<User, [string, string]> {
  static dbName = `tenant-user`
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-composite-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 5})
    const repo = env.register(TenantUserRepo)

    console.log(`--- Composite keys: same userId under different tenants are distinct ---\n`)
    await repo.set([`tenant-a`, `u1`], {id: `u1`, name: `Alice`})
    await repo.set([`tenant-b`, `u1`], {id: `u1`, name: `Alice-B`})
    await repo.set([`tenant-a`, `u2`], {id: `u2`, name: `Bob`})

    console.log(`tenant-a/u1:`, repo.get([`tenant-a`, `u1`]))
    console.log(`tenant-b/u1:`, repo.get([`tenant-b`, `u1`]))
    console.log(`has tenant-a/u2:`, repo.has([`tenant-a`, `u2`]))
    console.log(`has tenant-b/u2:`, repo.has([`tenant-b`, `u2`])) // false
    console.log(`count:`, repo.count())

    console.log(`\n--- Ordered iteration (lexicographic) ---\n`)
    const all = await repo.entries()
    for (const [k, v] of all) console.log(`${JSON.stringify(k)} ->`, v)

    // Bounded tenant scan via range: all keys for tenant-a
    const tenantA = await repo.entries({start: [`tenant-a`, ``], end: [`tenant-a`, `\uffff`]})
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
