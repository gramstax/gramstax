import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm, writeFile} from "node:fs/promises"
import {join} from "node:path"
import {PageManager} from "~/page/manager"

const TEST_DIR = join(import.meta.dir, `views-page-dup`)

describe(`PageManager.getFileManySync duplicates`, () => {
  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
    await mkdir(TEST_DIR, {recursive: true})
  })

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })

  it(`throws when a flat file and a directory index share a route`, async () => {
    await writeFile(join(TEST_DIR, `dup.ts`), `export const x = 1\n`)
    await mkdir(join(TEST_DIR, `dup`), {recursive: true})
    await writeFile(join(TEST_DIR, `dup`, `index.ts`), `export const y = 2\n`)
    expect(() => PageManager.getFileManySync(TEST_DIR)).toThrow(/Duplicate page/)
  })
})
