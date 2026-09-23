/**
 * Search + CDC + Composite demo — the query-scale epic end to end.
 *
 * One schema exercises all three: `t.string().search()` columns answer
 * full-text queries, `.index([tenant, status])` answers tuple/prefix/range
 * queries from one concatenated-key table, and `env.subscribe` streams every
 * committed write to an in-process follower. Sync + migrations + sorted
 * bulk import compose on the same handle without special wiring.
 *
 * Run with: `bun run packages/lmdb/example/search-cdc-demo.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"

class DocSchema extends LmdbSchema {
  static db = `demo-doc`
  static key = t.number()
  static value = {
    tenant: t.string().index([`tenant`, `status`]),
    status: t.string(),
    title: t.string().search(),
    body: t.string().search()
  }
}

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-search-cdc-demo-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 20})
    const docs = env.register(DocSchema)

    const seen: Array<unknown> = []
    const unsub = env.subscribe(`demo-doc`, (e) => {
      seen.push(e)
    })

    console.log(`--- puts stream CDC events ---\n`)
    await docs.put(1, {tenant: `t1`, status: `active`, title: `hello world`, body: `first post`})
    await docs.put(2, {tenant: `t1`, status: `archived`, title: `hello there`, body: `second post`})
    await docs.put(3, {tenant: `t2`, status: `active`, title: `goodbye world`, body: `third post`})
    console.log(`  subscriber saw ${seen.length} puts`)

    console.log(`\n--- full-text search ranks across columns ---\n`)
    console.log(`  search('hello world'):`, await docs.search(`hello world`))
    console.log(`  search('hello'):`, await docs.search(`hello`))

    console.log(`\n--- composite point, prefix, and range ---\n`)
    console.log(`  point [t1, active]:`, (await docs.findByIndex({"tenant+status": [`t1`, `active`]})).map((d) => d.title).join(`, `))
    console.log(`  prefix [t1]:`, (await docs.findByIndex({"tenant+status": [`t1`]})).map((d) => d.title).join(`, `))
    console.log(`  range t1..t2:`, (await docs.findByIndex({"tenant+status": {start: [`t1`], end: [`t2`]}})).map((d) => d.title).join(`, `))

    console.log(`\n--- delete streams too; unsubscribe detaches ---\n`)
    await docs.delete(3)
    console.log(`  subscriber saw ${seen.length} events total`)
    unsub()
    await docs.put(4, {tenant: `t2`, status: `active`, title: `fourth post`, body: `unseen`})
    console.log(`  subscriber still sees ${seen.length} events after unsubscribe`)

    console.log(`\n--- tail + migrate + sync compose on the same handle ---\n`)
    const tail = await env.tailCdc({limit: 2})
    console.log(`  outbox tail seqs:`, tail.map((e) => e.seq).join(`, `))
    const migrated = await env.migrate([
      {
        version: 1,
        name: `noop-declare`,
        up: () => {}
      }
    ])
    console.log(`  migrate applied:`, migrated.applied.length, `version:`, migrated.currentVersion)
    await env.close()
    console.log(`\nDone.`)
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
