/**
 * Binary Helpers (putBinary / getBinary / getBinaryFast) — use when you store blobs that must bypass codec/encoding
 * (product images, pre-encoded protobuf, file chunks). Why: `putBinary` wraps with `asBinary` so LMDB stores raw bytes
 * verbatim without msgpack/JSON overhead; `getBinary` returns a copied Buffer, `getBinaryFast` returns a reusable view
 * (valid until next get — copy with Buffer.from if you keep it). Both respect `readOnly` and closed-state guards.
 *
 * The schema declares a `t.buffer()` column for typing, but all reads/writes go through the binary helpers,
 * which bypass the value pipeline entirely.
 *
 * Run with: `bun run packages/lmdb/example/binary-helpers.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"

class ImageSchema extends LmdbSchema {
  static db = `image`
  static key = t.string()
  static value = {
    data: t.buffer()
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-binary-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 5})
    const images = env.register(ImageSchema)

    console.log(`--- Binary helpers (bypass codec) ---\n`)
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    await images.putBinary(`logo`, pngHeader)
    console.log(`  putBinary logo (${pngHeader.length} bytes)`)

    const got = images.getBinary(`logo`)
    console.log(`  getBinary is Buffer:`, got instanceof Buffer, `equal:`, Buffer.compare(got!, pngHeader) === 0)

    const fast = images.getBinaryFast(`logo`)
    console.log(`  getBinaryFast length:`, fast?.length, `is Buffer:`, fast instanceof Buffer)
    // fast buffer is reusable — copy if you retain
    const copy = Buffer.from(fast!)
    console.log(`  copy equal:`, Buffer.compare(copy, pngHeader) === 0)

    console.log(`  missing ->`, images.getBinary(`missing`))

    // Read-only guard demo
    const roDir = mkdtempSync(join(tmpdir(), `lmdb-bin-ro-`))
    const wEnv = new LmdbEnv({path: roDir, maxDbs: 3})
    wEnv.register(ImageSchema)
    await wEnv.close()
    const roEnv = new LmdbEnv({path: roDir, maxDbs: 3, readOnly: true})
    const roImages = roEnv.register(ImageSchema)
    try {
      await roImages.putBinary(`x`, Buffer.from([1]))
    } catch (err) {
      console.log(`  putBinary on readOnly throws:`, (err as Error).name)
    }
    await roEnv.close()
    rmSync(roDir, {recursive: true, force: true})

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
