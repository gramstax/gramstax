/**
 * dupSort Repository (duplicate values per key) — use when one key must map to many ordered values
 * (index tables, tags per entity, email -> userIds). Why: LMDB dupSort stores duplicates under the same key in
 * sorted order without manual prefix encoding; the wrapper exposes it per-repository via `static dupSort=true`
 * (env-level dupSort would incorrectly mark the root DB — LMDB forbids named DBs after that). Values are ordered
 * via `ordered-binary` encoding, so range is fast and `getValuesCount` is O(1) via native count.
 *
 * Run with: `bun run packages/lmdb/example/dupsort.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbRepository} from "../src/repository"

class TagIndexRepo extends LmdbRepository<string, string> {
  static dbName = `tag-index`
  static dupSort = true
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-dup-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 5, encoding: `ordered-binary`})
    const tags = env.register(TagIndexRepo)

    console.log(`--- dupSort: addValue / getValues / count / removeValue ---\n`)
    await tags.addValue(`post:1`, `tag:js`)
    await tags.addValue(`post:1`, `tag:ts`)
    await tags.addValue(`post:1`, `tag:lmdb`)
    await tags.addValue(`post:2`, `tag:js`)

    console.log(`  post:1 values:`, await tags.getValues(`post:1`))
    console.log(`  post:1 count:`, tags.getValuesCount(`post:1`))
    console.log(`  post:2 values:`, await tags.getValues(`post:2`))
    console.log(`  missing:`, await tags.getValues(`missing`))

    console.log(`\n  remove tag:js from post:1:`, await tags.removeValue(`post:1`, `tag:js`))
    console.log(`  post:1 after remove:`, await tags.getValues(`post:1`))
    console.log(`  remove missing (false):`, await tags.removeValue(`post:1`, `tag:missing`))

    console.log(`\n  per-key isolation — post:2 still:`, await tags.getValues(`post:2`))

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
