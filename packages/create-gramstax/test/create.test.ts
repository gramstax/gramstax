import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {mkdtempSync, writeFileSync, rmSync, readFileSync} from "node:fs"
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

  it(`prefers INIT_CWD when resolving base directory`, () => {
    expect(FsUt.resolveInitialWorkingDirectory(`C:\\current`, `C:\\from-init`)).toBe(`C:\\from-init`)
    expect(FsUt.resolveInitialWorkingDirectory(`/current`, undefined)).toBe(`/current`)
  })
})

describe(`template package.json transformation`, () => {
  const fixtureDir = join(import.meta.dir, `..`, `src`, `templates`)

  function simulateBuildTransform(pkgPath: string, version: string): Record<string, any> {
    const pkg = JSON.parse(readFileSync(pkgPath, `utf-8`))
    const ver = `^${version}`

    if (pkg.dependencies) {
      for (const [name, val] of Object.entries(pkg.dependencies)) {
        if (val === `workspace:*`) {
          pkg.dependencies[name] = ver
        }
      }
    }
    return pkg
  }

  it(`replaces all workspace:* deps with real version`, () => {
    const pkg = simulateBuildTransform(join(fixtureDir, `package.json`), `1.2.3`)

    for (const [name, val] of Object.entries(pkg.dependencies)) {
      if (val === `^1.2.3`) {
        expect(name).toMatch(/gramstax|@gramstax/)
      }
    }
    // Verify no workspace:* deps remain
    const workspaceDeps = Object.entries(pkg.dependencies).filter(([_, v]) => v === `workspace:*`)
    expect(workspaceDeps).toHaveLength(0)
  })

  it(`handles version bump correctly`, () => {
    const pkg = simulateBuildTransform(join(fixtureDir, `package.json`), `2.0.0`)

    const workspaceDeps = Object.entries(pkg.dependencies).filter(([_, v]) => v === `workspace:*`)
    expect(workspaceDeps).toHaveLength(0)

    // gramstax deps should have the new version
    expect(pkg.dependencies[`@gramstax/lmdb`]).toBe(`^2.0.0`)
  })

  it(`template source still uses workspace:* for local dev`, () => {
    const raw = readFileSync(join(fixtureDir, `package.json`), `utf-8`)

    for (const dep of [`gramstax`, `@gramstax/lmdb`]) {
      expect(raw).toContain(`"${dep}": "workspace:*"`)
    }
  })
})

describe(`template tsconfig.json transformation`, () => {
  const fixtureDir = join(import.meta.dir, `..`, `src`, `templates`)

  function simulateCleanPaths(tsconfigPath: string): string {
    let content = readFileSync(tsconfigPath, `utf-8`)
    content = content.replace(/,?\s*\n\s*"(gramstax|@gramstax\/lmdb)":\s*\[[\s\S]*?\]/g, ``)
    return content
  }

  it(`removes gramstax path mapping for published output`, () => {
    const result = simulateCleanPaths(join(fixtureDir, `tsconfig.json`))
    expect(result).not.toContain(`"gramstax":`)
    expect(result).not.toContain(`"@gramstax/lmdb":`)
  })

  it(`preserves other paths like ~/*`, () => {
    const result = simulateCleanPaths(join(fixtureDir, `tsconfig.json`))
    expect(result).toContain(`"~/*"`)
    expect(result).toContain(`"./src/*"`)
  })
})
