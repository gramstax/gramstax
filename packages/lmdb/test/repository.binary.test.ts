/**
 * F6 — Binary-first helpers at repository level.
 *
 * Large blobs bypass codec/encoding via raw binary path.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"
import type {LmdbEnvSub} from "../src/sub"

import {createTestDir, rmWithRetry} from "./test-helpers"

class BlobSchema extends LmdbSchema { static db = `blob-f6-test`; static key = t.string(); static value = t.buffer() }

let tmpDir: string
let env: LmdbEnv
let blobs: LmdbEnvSub<typeof BlobSchema>

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-blob-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  blobs = env.register(BlobSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbRepository binary helpers`, () => {
  it(`putBinary stores and getBinary retrieves a Buffer`, async () => {
    const data = Buffer.from([1, 2, 3, 4])
    await blobs.putBinary(`k1`, data)
    const got = blobs.getBinary(`k1`)
    expect(got).toBeInstanceOf(Buffer)
    expect(Buffer.compare(got!, data)).toBe(0)
  })

  it(`getBinary returns undefined for a missing key`, () => {
    expect(blobs.getBinary(`missing`)).toBeUndefined()
  })

  it(`getBinaryFast returns a Buffer with the same content`, async () => {
    const data = Buffer.from([9, 8, 7])
    await blobs.putBinary(`k1`, data)
    const got = blobs.getBinaryFast(`k1`)
    expect(got).toBeInstanceOf(Buffer)
    expect(Buffer.from(got!).subarray(0, data.length).equals(data)).toBe(true)
  })

  it(`putBinary bypasses codec — storing Buffer through a codec repo`, async () => {
    const data = Buffer.from([10, 20, 30])
    await blobs.putBinary(`k2`, data)
    // get (codec path) would decode differently; getBinary must return raw
    expect(Buffer.compare(blobs.getBinary(`k2`)!, data)).toBe(0)
  })

  it(`putBinary rejects on a read-only env`, async () => {
    const roTmp = createTestDir(`lmdb-blob-ro-`)
    let roEnv: LmdbEnv | undefined
    try {
      const wEnv = new LmdbEnv({path: roTmp, maxDbs: 5})
      wEnv.register(BlobSchema)
      await wEnv.close()
      roEnv = new LmdbEnv({path: roTmp, maxDbs: 5, readOnly: true})
      const roRepo = roEnv.register(BlobSchema)
      await expect(roRepo.putBinary(`k`, Buffer.from([1]))).rejects.toThrow()
    } finally {
      if (roEnv) await roEnv.close()
      await rmWithRetry(roTmp)
    }
  })
})
