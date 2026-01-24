import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {mkdtempSync, writeFileSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Create} from "../src/create"
import {FsUt} from "../src/utils/fs"

describe(`create-gramstax utilities`, () => {
  let originalConsoleLog: typeof console.log

  beforeEach(() => {
    originalConsoleLog = console.log
  })

  afterEach(() => {
    console.log = originalConsoleLog
  })

  it(`prints banner with version under ASCII`, () => {
    const logs: string[] = []
    console.log = (message?: unknown) => {
      if (message !== undefined) {
        logs.push(String(message))
      }
    }

    const create = new Create(undefined, {version: `1.2.3`})
    create.printBanner()

    expect(logs.length).toBe(1)
    const firstLog = logs[0] ?? ``
    const lines = firstLog.split(`\n`).filter((line) => line.trim().length > 0)
    expect(lines.length).toBeGreaterThan(0)
    const lastLine = lines[lines.length - 1] ?? ``
    expect(lastLine).toContain(`v1.2.3`)
  })

  it(`treats directories with only metadata files as empty`, () => {
    const tempDir = mkdtempSync(join(tmpdir(), `create-gramstax-`))
    writeFileSync(join(tempDir, `.gitkeep`), ``)
    writeFileSync(join(tempDir, `.DS_Store`), ``)

    expect(FsUt.isDirectoryEffectivelyEmpty(tempDir)).toBe(true)

    writeFileSync(join(tempDir, `real-file.txt`), `content`)
    expect(FsUt.isDirectoryEffectivelyEmpty(tempDir)).toBe(false)

    rmSync(tempDir, {recursive: true, force: true})
  })

  it(`resolves package manager commands without shell`, () => {
    expect(FsUt.resolvePackageManagerCommand(`npm`, `win32`)).toBe(`npm.cmd`)
    expect(FsUt.resolvePackageManagerCommand(`pnpm`, `win32`)).toBe(`pnpm.cmd`)
    expect(FsUt.resolvePackageManagerCommand(`yarn`, `win32`)).toBe(`yarn.cmd`)
    expect(FsUt.resolvePackageManagerCommand(`bun`, `win32`)).toBe(`bun`)

    expect(FsUt.resolvePackageManagerCommand(`npm`, `linux`)).toBe(`npm`)
    expect(FsUt.resolvePackageManagerCommand(`bun`, `linux`)).toBe(`bun`)
  })
})
