import {describe, expect, it} from "bun:test"
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {FsUt} from "../src/utils/fs"

describe(`FsUt.normalizeGitignoreFile merge`, () => {
  it(`merges shipped template rules into an existing .gitignore without losing them`, () => {
    const templateContent = readFileSync(join(import.meta.dir, `..`, `src`, `templates`, `gitignore`), `utf-8`)
    expect(templateContent.split(/\r?\n/).length).toBeGreaterThan(30)
    const templateLines = templateContent.split(/\r?\n/).filter((line) => line.length > 0)

    const tempDir = mkdtempSync(join(tmpdir(), `create-gramstax-`))
    writeFileSync(join(tempDir, `gitignore`), templateContent)
    writeFileSync(join(tempDir, `.gitignore`), `custom-entry\nnode_modules/\n`)

    FsUt.normalizeGitignoreFile(tempDir)

    expect(existsSync(join(tempDir, `gitignore`))).toBe(false)
    expect(existsSync(join(tempDir, `.gitignore`))).toBe(true)
    const result = readFileSync(join(tempDir, `.gitignore`), `utf-8`)
    expect(result).toContain(`custom-entry`)
    for (const line of templateLines) {
      expect(result).toContain(line)
    }
    expect(result.split(`node_modules/`).length - 1).toBe(1)

    rmSync(tempDir, {recursive: true, force: true})
  })

  it(`renames the template when no .gitignore exists`, () => {
    const tempDir = mkdtempSync(join(tmpdir(), `create-gramstax-`))
    writeFileSync(join(tempDir, `gitignore`), `node_modules/\n`)

    FsUt.normalizeGitignoreFile(tempDir)

    expect(existsSync(join(tempDir, `.gitignore`))).toBe(true)
    expect(existsSync(join(tempDir, `gitignore`))).toBe(false)
    expect(readFileSync(join(tempDir, `.gitignore`), `utf-8`)).toBe(`node_modules/\n`)

    rmSync(tempDir, {recursive: true, force: true})
  })
})

describe(`FsUt.isDirectoryEffectivelyEmpty recursion`, () => {
  it(`treats a directory containing only logs/.gitkeep as empty`, () => {
    const tempDir = mkdtempSync(join(tmpdir(), `create-gramstax-`))
    mkdirSync(join(tempDir, `logs`), {recursive: true})
    writeFileSync(join(tempDir, `logs`, `.gitkeep`), ``)

    expect(FsUt.isDirectoryEffectivelyEmpty(tempDir)).toBe(true)

    rmSync(tempDir, {recursive: true, force: true})
  })

  it(`reports non-empty when a nested real file exists`, () => {
    const tempDir = mkdtempSync(join(tmpdir(), `create-gramstax-`))
    mkdirSync(join(tempDir, `logs`), {recursive: true})
    writeFileSync(join(tempDir, `logs`, `app.log`), `hello`)

    expect(FsUt.isDirectoryEffectivelyEmpty(tempDir)).toBe(false)

    rmSync(tempDir, {recursive: true, force: true})
  })

  it(`throws a friendly Error for a missing path`, () => {
    const missing = join(tmpdir(), `create-gramstax-does-not-exist-12345`)
    rmSync(missing, {recursive: true, force: true})
    expect(() => FsUt.isDirectoryEffectivelyEmpty(missing)).toThrow(/does not exist/)
  })

  it(`keeps DEFAULT_IGNORED_ENTRIES frozen`, () => {
    expect(Object.isFrozen(FsUt.DEFAULT_IGNORED_ENTRIES)).toBe(true)
  })

  it(`documents shallow scope and copies the default set`, () => {
    const source = readFileSync(join(import.meta.dir, `..`, `src`, `utils`, `fs.ts`), `utf-8`)
    expect(source).toMatch(/shallow/i)
    expect(source).toContain(`new Set(FsUt.DEFAULT_IGNORED_ENTRIES)`)
  })
})

describe(`FsUt.resolveInitialWorkingDirectory empty fallback`, () => {
  it(`falls back to cwd for empty or whitespace initCwd`, () => {
    expect(FsUt.resolveInitialWorkingDirectory(`/current`, ``)).toBe(`/current`)
    expect(FsUt.resolveInitialWorkingDirectory(`/current`, `   `)).toBe(`/current`)
  })

  it(`prefers a non-empty initCwd`, () => {
    expect(FsUt.resolveInitialWorkingDirectory(`/current`, `/from-init`)).toBe(`/from-init`)
  })
})

describe(`FsUt.resolvePackageManagerCommand defense in depth`, () => {
  it(`throws Unsupported package manager for unknown input`, () => {
    expect(() => FsUt.resolvePackageManagerCommand(`bogus` as unknown as `bun`)).toThrow(/Unsupported package manager/)
  })

  it(`still resolves known managers`, () => {
    expect(FsUt.resolvePackageManagerCommand(`npm`, `win32`)).toBe(`npm.cmd`)
    expect(FsUt.resolvePackageManagerCommand(`bun`, `win32`)).toBe(`bun`)
    expect(FsUt.resolvePackageManagerCommand(`npm`, `linux`)).toBe(`npm`)
  })
})

describe(`installDependencies single error line`, () => {
  it(`does not log.fail before resolving false in the Task 8 path`, () => {
    const source = readFileSync(join(import.meta.dir, `..`, `src`, `create.ts`), `utf-8`)
    expect(source).not.toContain(`log.fail(\`Dependencies installation failed`)
  })
})
