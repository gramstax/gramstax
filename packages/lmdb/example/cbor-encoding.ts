/**
 * CBOR Encoding (cbor-x) — use when you need smaller, faster binary encoding than msgpack/json and you can afford
 * an optional peer dep. Why: `cbor-x` encodes typed arrays and structured data more compactly than JSON and
 * is natively understood by lmdb-js when `encoding:"cbor"` is set; the wrapper forwards it per sub-DB so all
 * processes opening the env must agree. Zero-cost when not used — `cbor-x` is an optional peer (`peerDependenciesMeta`
 * optional) and only loaded when `encoding:"cbor"` is selected. Use for high-throughput event logs or binary-heavy docs.
 *
 * Run with: `bun run packages/lmdb/example/cbor-encoding.ts`
 * Requires: `cbor-x` peer (already in devDependencies for this repo).
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbRepository} from "../src/repository"

type Doc = {id: string; title: string; tags: string[]; createdAt: number}

class DocRepo extends LmdbRepository<Doc, string> {
  static dbName = `doc`
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-cbor-`))
  try {
    console.log(`--- CBOR encoding ---\n`)
    // cbor encoding is per-env; all sub-DBs in this env share it
    const env = new LmdbEnv({path: dir, maxDbs: 5, encoding: `cbor`})
    const docs = env.register(DocRepo)

    const doc: Doc = {id: `d1`, title: `Hello CBOR`, tags: [`lmdb`, `cbor`], createdAt: Date.now()}
    await docs.set(`d1`, doc)
    console.log(`  stored:`, doc)
    console.log(`  retrieved:`, docs.get(`d1`))
    console.log(`  equal:`, JSON.stringify(docs.get(`d1`)) === JSON.stringify(doc))

    // CBOR handles binary-friendly structures without base64 wrapping
    await docs.set(`d2`, {id: `d2`, title: `Second`, tags: [], createdAt: 0})
    console.log(`  d2:`, docs.get(`d2`))

    await env.close()
    console.log(`\nenv closed cleanly (cbor peer was loaded only for this env)`)
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
