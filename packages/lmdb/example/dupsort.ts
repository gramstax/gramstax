/**
 * dupSort Repository (duplicate values per key) — use when one key must map to many ordered values
 * (index tables, tags per entity, email -> userIds). Why: LMDB dupSort stores duplicates under the same key in
 * sorted order without manual prefix encoding. A scalar dupSort table like `tag -> postId` is declared with a
 * scalar `static value` plus `static dupSort = true` on an `LmdbSchema` class, registered via `env.register` —
 * the only registration path. Values are ordered via `ordered-binary` encoding, so range is fast and
 * `getValuesCount` is O(1) via native count.
 *
 * Run with: `bun run packages/lmdb/example/dupsort.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"

class TagIndexSchema extends LmdbSchema {
  static db = `tag-index`
  static key = t.string()
  static value = t.string()
  static dupSort = true
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-dup-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 5, encoding: `ordered-binary`})
    // Scalar dupSort schema: `tag -> postId` table (one key, many ordered values).
    const tagIndex = env.register(TagIndexSchema)

    console.log(`--- dupSort: addValue / getValues / count / removeValue ---\n`)
    await tagIndex.addValue(`post:1`, `tag:js`)
    await tagIndex.addValue(`post:1`, `tag:ts`)
    await tagIndex.addValue(`post:1`, `tag:lmdb`)
    await tagIndex.addValue(`post:2`, `tag:js`)

    console.log(`  post:1 values:`, await tagIndex.getValues(`post:1`))
    console.log(`  post:1 count:`, tagIndex.getValuesCount(`post:1`))
    console.log(`  post:2 values:`, await tagIndex.getValues(`post:2`))
    console.log(`  missing:`, await tagIndex.getValues(`missing`))

    console.log(`\n  remove tag:js from post:1:`, await tagIndex.removeValue(`post:1`, `tag:js`))
    console.log(`  post:1 after remove:`, await tagIndex.getValues(`post:1`))
    console.log(`  remove missing (false):`, await tagIndex.removeValue(`post:1`, `tag:missing`))

    console.log(`\n  per-key isolation — post:2 still:`, await tagIndex.getValues(`post:2`))

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
