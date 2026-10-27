import {describe, expect, it} from "bun:test"
import {readFileSync} from "node:fs"
import {join} from "node:path"

const packageDir = join(import.meta.dir, `..`)

describe(`gramstax published bin`, () => {
  it(`starts with a Bun shebang`, () => {
    const source = readFileSync(join(packageDir, `src`, `cli`, `gramstax.ts`), `utf-8`)
    expect(source.split(`\n`, 1)[0]).toBe(`#!/usr/bin/env bun`)
  })

  it(`points the package bin at the built CLI`, () => {
    const pkg = JSON.parse(readFileSync(join(packageDir, `package.json`), `utf-8`)) as {bin?: Record<string, string>}
    expect(pkg.bin?.gramstax).toBe(`dist/src/cli/gramstax.js`)
  })
})
