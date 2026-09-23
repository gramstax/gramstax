/**
 * LmdbSchema — declarative schema over LmdbRepository: extend `LmdbSchema` with
 * `static db` + `static key` + `static value` (a map of `t` builders) and `env.register(SchemaClass)`
 * materializes a fully typed repository. The repo property type is the short `RepoOf<typeof UserSchema>`;
 * row type is `ValueOf<typeof UserSchema>`; key type and index map flow through
 * `InferSchemaKey` / `SchemaIndexesOf` inside `RepoOf`, so
 * `findByIndex({id: 1})` (unique column) resolves a scalar while `findByIndex({username: damar})`
 * (non-unique index) resolves an array. Derived indexes share every embedded-index behavior:
 * atomic maintenance with primary writes, unique conflicts throw
 * LmdbError, `reindex()` rebuilds from primary data, and `delete` cleans index rows.
 *
 * Run with: `bun run packages/lmdb/example/schema.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t, type ValueOf} from "../src/schema"

type IVUser = ValueOf<typeof UsersSchema>
class UsersSchema extends LmdbSchema {
  static db = `users`
  static key = t.number()
  static value = {
    id: t.number().unique(), // SQL UNIQUE — duplicates throw LmdbError
    username: t.string().index(), // SQL INDEX — duplicates allowed
    email: t.string(),
    tags: t.array().optional(), // undefined values are stored as absent
    createdAt: t.date(),
    others: t.object({
      id: t.string().optional(),
      lain: t.map({key: t.string(), value: t.array(t.string())})
    })
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-schema-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 10})
    const users = env.register(UsersSchema)

    await users.put(1, {
      id: 1,
      username: `damar`,
      email: `damar@example.com`,
      tags: [`admin`, `beta`],
      createdAt: new Date(`2024-01-01T00:00:00.000Z`),
      others: {
        id: undefined,
        lain: new Map<string, string[]>()
      }
    })

    // process.exit()
    console.log(`--- put 2 users through the schema-typed repository ---\n`)
    await users.put(1, {id: 1, username: `damar`, email: `damar@example.com`, tags: [`admin`, `beta`], createdAt: new Date(`2024-01-01T00:00:00.000Z`), others: {id: undefined, lain: new Map()}})
    await users.put(2, {id: 2, username: `budi`, email: `budi@example.com`, tags: undefined, createdAt: new Date(`2024-06-15T00:00:00.000Z`), others: {id: `x`, lain: new Map()}})
    const first: IVUser | undefined = users.get(1)
    console.log(`  count:`, users.count())
    console.log(`  get(1).tags:`, first?.tags)
    console.log(`  get(2).tags:`, users.get(2)?.tags)

    // console.log(`  findByIndex({others: {id: 1}}):`, await users.findByIndex({}))
    // process.exit()
    console.log(`\n--- findByIndex: unique id → scalar, non-unique username → array ---\n`)
    console.log(`  findByIndex({id: 1}):`, await users.findByIndex({id: 1}))
    console.log(`  findByIndex({id: 99}):`, await users.findByIndex({id: 99}))
    console.log(`  findByIndex({username: damar}):`, await users.findByIndex({username: `damar`}))
    console.log(`  findByIndex({username: nobody}):`, await users.findByIndex({username: `nobody`}))

    console.log(`\n--- unique conflict throws LmdbError ---\n`)
    try {
      await users.put(3, {id: 1, username: `citra`, email: `citra@example.com`, tags: undefined, createdAt: new Date(), others: {id: `y`, lain: new Map()}})
      console.log(`  unexpected: duplicate id was accepted`)
    } catch (err) {
      console.log(`  caught:`, String(err))
    }
    console.log(`  count after rejected put (rolled back):`, users.count())

    console.log(`\n--- reindex() rebuilds every derived index from primary data ---\n`)
    const res = await users.reindex()
    console.log(`  built:`, res.built, `skipped:`, res.skipped)
    console.log(`  after reindex, findByIndex({username: budi}):`, await users.findByIndex({username: `budi`}))

    console.log(`\n--- delete cleans index rows ---\n`)
    await users.delete(2)
    console.log(`  after delete, findByIndex({username: budi}):`, await users.findByIndex({username: `budi`}))
    console.log(`  primary 2 gone:`, users.get(2))

    await env.close()
    console.log(`\nenv closed cleanly`)
  } catch (e) {
    console.log({e})
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
