/**
 * F4 — CBOR encoding support.
 *
 * Upstream lmdb@3.5.6 supports `encoding: 'cbor'` via optional `cbor-x`.
 * Wrapper's ILmdbEncoding previously omitted it.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"
import type {LmdbEnvSub} from "../src/sub"

import {createTestDir, rmWithRetry} from "./test-helpers"

interface Doc {
  id: string
  n: number
  flag: boolean
}

class DocSchema extends LmdbSchema { static db = `cbor-doc-test`; static key = t.string(); static value = t.object<Doc>() }

let tmpDir: string
let env: LmdbEnv
let docs: LmdbEnvSub<typeof DocSchema>

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-cbor-test-`)
  // This line is the type-level RED: 'cbor' must be in ILmdbEncoding
  env = new LmdbEnv({path: tmpDir, maxDbs: 5, encoding: `cbor`})
  docs = env.register(DocSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbRepository cbor encoding`, () => {
  it(`stores and retrieves a document with cbor encoding`, async () => {
    const doc: Doc = {id: `d1`, n: 42, flag: true}
    await docs.put(`d1`, doc)
    expect(await docs.get(`d1`)).toEqual(doc)
  })

  it(`handles nested structures with cbor`, async () => {
    const doc: Doc = {id: `d2`, n: 0, flag: false}
    await docs.put(`d2`, doc)
    await docs.put(`d2`, {...doc, n: 99})
    expect((await docs.get(`d2`))!.n).toBe(99)
  })
})
