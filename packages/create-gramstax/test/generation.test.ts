import {beforeEach, describe, expect, it, mock} from "bun:test"
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Create} from "../src/create"
import {log} from "../src/utils/log"
import {
  assertNoLeftoverPlaceholders,
  removeDependency,
  removeTsconfigPathMappings,
  resolveRuntimeScripts,
  resolveWorkspaceDeps,
  stripBiomeScripts,
  writeJsonFileAtomic,
  writeTextFileAtomic
} from "../src/utils/project"

type GenerationConfig = {
  projectName: string
  projectPath: string
  packageManager: `bun`
  runtime: `bun` | `node`
  setupBiome: boolean
  useLmdb: boolean
  useWorkerThread: boolean
  skipInstall?: boolean
}

type TestCreate = {
  copyDirectorySync(source: string, destination: string, variables?: Record<string, string>): void
  executeProjectGeneration(config: GenerationConfig): Promise<void>
  installDependencies: (projectPath: string, packageManager: string) => Promise<boolean>
}

function baseConfig(projectPath: string, overrides?: Partial<GenerationConfig>): GenerationConfig {
  return {
    projectName: `MyBot`,
    projectPath,
    packageManager: `bun`,
    runtime: `bun`,
    setupBiome: true,
    useLmdb: true,
    useWorkerThread: true,
    ...overrides
  }
}

function mockSpawnNoop() {
  mock.module(`node:child_process`, () => ({
    spawn: () => ({
      on: (event: string, callback: (code?: number) => void) => {
        if (event === `close`) callback(0)
      }
    })
  }))
}

function stubInstall(creator: TestCreate, seen: {calls: number; devDepsAtInstall?: unknown}) {
  creator.installDependencies = async (projectPath: string) => {
    seen.calls += 1
    try {
      const pkg = JSON.parse(readFileSync(join(projectPath, `package.json`), `utf-8`)) as {devDependencies?: Record<string, string>}
      seen.devDepsAtInstall = pkg.devDependencies
    } catch {
      seen.devDepsAtInstall = undefined
    }
    return true
  }
}

function makeCreator(seen: {calls: number; devDepsAtInstall?: unknown}): TestCreate {
  const creator = new Create(undefined, {version: `9.9.9`}) as unknown as TestCreate
  stubInstall(creator, seen)
  return creator
}

function makeTempRoot(): string {
  return mkdtempSync(join(tmpdir(), `gramstax-generation-`))
}

function filesContaining(dir: string, needle: string): string[] {
  const hits: string[] = []
  const walk = (current: string) => {
    for (const entry of readdirSync(current, {withFileTypes: true})) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile()) {
        const raw = readFileSync(full)
        if (!raw.includes(0) && raw.toString(`utf-8`).includes(needle)) hits.push(full)
      }
    }
  }
  walk(dir)
  return hits
}

beforeEach(() => {
  mockSpawnNoop()
})

describe(`generation copy handles binary, modes, and symlinks`, () => {
  it(`byte-copies non-UTF8 files without substitution`, () => {
    const root = makeTempRoot()
    const src = join(root, `src`)
    const dest = join(root, `dest`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      mkdirSync(src, {recursive: true})
      const bytes = Buffer.from([0x48, 0x65, 0x00, 0xff, 0xfe, 0x41])
      writeFileSync(join(src, `blob.bin`), bytes)
      writeFileSync(join(src, `note.txt`), `hello {{projectName}}`)
      creator.copyDirectorySync(src, dest, {projectName: `demo`})
      expect(Buffer.compare(readFileSync(join(dest, `blob.bin`)), bytes)).toBe(0)
      expect(readFileSync(join(dest, `note.txt`), `utf-8`)).toBe(`hello demo`)
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`preserves read-only mode bits on copied text files`, () => {
    const root = makeTempRoot()
    const src = join(root, `src`)
    const dest = join(root, `dest`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      mkdirSync(src, {recursive: true})
      writeFileSync(join(src, `locked.txt`), `locked`)
      chmodSync(join(src, `locked.txt`), 0o444)
      creator.copyDirectorySync(src, dest, {})
      expect(statSync(join(dest, `locked.txt`)).mode & 0o222).toBe(0)
    } finally {
      chmodSync(join(src, `locked.txt`), 0o666)
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`preserves exec mode bits on POSIX`, () => {
    if (process.platform === `win32`) return
    const root = makeTempRoot()
    const src = join(root, `src`)
    const dest = join(root, `dest`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      mkdirSync(src, {recursive: true})
      writeFileSync(join(src, `run.sh`), `echo hi`)
      chmodSync(join(src, `run.sh`), 0o755)
      creator.copyDirectorySync(src, dest, {})
      expect(statSync(join(dest, `run.sh`)).mode & 0o111).toBe(0o111)
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`warns and skips symlinks instead of copying them`, () => {
    const root = makeTempRoot()
    const src = join(root, `src`)
    const dest = join(root, `dest`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    const originalWarn = log.warn
    let warned = ``
    log.warn = (message: string) => {
      warned += message
    }
    try {
      mkdirSync(src, {recursive: true})
      writeFileSync(join(src, `real.txt`), `real`)
      try {
        symlinkSync(join(src, `real.txt`), join(src, `link.txt`), `file`)
      } catch {
        return
      }
      creator.copyDirectorySync(src, dest, {})
      expect(warned).toContain(`link.txt`)
      expect(existsSync(join(dest, `link.txt`))).toBe(false)
      expect(readFileSync(join(dest, `real.txt`), `utf-8`)).toBe(`real`)
    } finally {
      log.warn = originalWarn
      rmSync(root, {recursive: true, force: true})
    }
  })
})

describe(`leftover template placeholders`, () => {
  it(`throws naming the file when an unlisted placeholder remains`, () => {
    const root = makeTempRoot()
    try {
      writeFileSync(join(root, `page.ts`), `hello {{userName}} and {{oops}}`)
      expect(() => assertNoLeftoverPlaceholders(root)).toThrow(/oops/)
      expect(() => assertNoLeftoverPlaceholders(root)).toThrow(/page\.ts/)
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`allows the runtime placeholders userName, result, and res`, () => {
    const root = makeTempRoot()
    try {
      writeFileSync(join(root, `page.ts`), `{{userName}} {{result}} {{res}}`)
      expect(() => assertNoLeftoverPlaceholders(root)).not.toThrow()
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`generated projects contain no unlisted placeholders`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath))
      expect(() => assertNoLeftoverPlaceholders(projectPath)).not.toThrow()
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })
})

describe(`packageName lowercasing`, () => {
  it(`uses the lowercased project name for package.json name`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath, {projectName: `MyBot`}))
      const pkg = JSON.parse(readFileSync(join(projectPath, `package.json`), `utf-8`)) as {name?: string}
      expect(pkg.name).toBe(`mybot`)
      expect(readFileSync(join(projectPath, `README.md`), `utf-8`)).toContain(`MyBot`)
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })
})

describe(`.env handling`, () => {
  it(`keeps an existing .env and unlinks .env.example`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      mkdirSync(projectPath, {recursive: true})
      writeFileSync(join(projectPath, `.env`), `EXISTING=1\n`)
      await creator.executeProjectGeneration(baseConfig(projectPath))
      const env = readFileSync(join(projectPath, `.env`), `utf-8`)
      expect(env.startsWith(`EXISTING=1\n`)).toBe(true)
      expect(env).toContain(`DB_PATH`)
      expect(existsSync(join(projectPath, `.env.example`))).toBe(false)
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`renames .env.example to .env when no .env exists`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath))
      expect(existsSync(join(projectPath, `.env`))).toBe(true)
      expect(existsSync(join(projectPath, `.env.example`))).toBe(false)
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })
})

describe(`lmdb prune`, () => {
  it(`removes lmdb from every dep section, both path mappings, and all imports`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath, {useLmdb: false}))
      expect(existsSync(join(projectPath, `src`, `db`))).toBe(false)
      const pkg = JSON.parse(readFileSync(join(projectPath, `package.json`), `utf-8`)) as Record<string, Record<string, string> | undefined>
      for (const section of [`dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`]) {
        expect(pkg[section]?.["@gramstax/lmdb"]).toBeUndefined()
      }
      const tsconfig = readFileSync(join(projectPath, `tsconfig.json`), `utf-8`)
      expect(tsconfig).not.toContain(`@gramstax/lmdb`)
      expect(tsconfig).not.toContain(`"gramstax"`)
      expect(tsconfig).toContain(`~/*`)
      expect(filesContaining(projectPath, `@gramstax/lmdb`)).toEqual([])
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`always drops the monorepo path mappings even when lmdb is kept`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath, {useLmdb: true}))
      expect(existsSync(join(projectPath, `src`, `db`))).toBe(true)
      const tsconfig = readFileSync(join(projectPath, `tsconfig.json`), `utf-8`)
      expect(tsconfig).not.toContain(`@gramstax/lmdb`)
      expect(tsconfig).not.toContain(`"gramstax"`)
      expect(tsconfig).toContain(`~/*`)
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`removeDependency clears every dep section`, () => {
    const pkg: Record<string, Record<string, string>> = {
      dependencies: {a: `1`, "@gramstax/lmdb": `*`},
      devDependencies: {"@gramstax/lmdb": `*`},
      peerDependencies: {"@gramstax/lmdb": `*`},
      optionalDependencies: {"@gramstax/lmdb": `*`}
    }
    removeDependency(pkg, `@gramstax/lmdb`)
    for (const section of [`dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`]) {
      expect(pkg[section]?.["@gramstax/lmdb"]).toBeUndefined()
    }
    expect(pkg.dependencies?.a).toBe(`1`)
  })

  it(`removeTsconfigPathMappings parses JSONC and keeps ~/*`, () => {
    const content = `{\n// comment\n"compilerOptions": {"paths": {"~/*": ["./src/*"], "gramstax": ["x"], "@gramstax/lmdb": ["y"]}}\n}`
    const result = removeTsconfigPathMappings(content, [`gramstax`, `@gramstax/lmdb`])
    expect(result).not.toContain(`@gramstax/lmdb`)
    expect(result).not.toContain(`"gramstax"`)
    expect(result).toContain(`~/*`)
    expect(() => JSON.parse(result)).not.toThrow()
  })
})

describe(`workers scaffold`, () => {
  it(`ships a minimal WorkerThreadInit subclass with one mtd method`, () => {
    const examplePath = join(import.meta.dir, `..`, `src`, `templates`, `src`, `workers`, `example.ts`)
    expect(existsSync(examplePath)).toBe(true)
    const content = readFileSync(examplePath, `utf-8`)
    expect(content).toContain(`WorkerThreadInit`)
    expect(content).toMatch(/mtd\w+/)
    expect(content).toContain(`extends WorkerThreadInit`)
  })

  it(`declares @gramstax/worker-thread as workspace:* in the template`, () => {
    const raw = readFileSync(join(import.meta.dir, `..`, `src`, `templates`, `package.json`), `utf-8`)
    expect(raw).toContain(`"@gramstax/worker-thread": "workspace:*"`)
  })

  it(`resolves the worker-thread dep when workers are kept`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath, {useWorkerThread: true}))
      expect(existsSync(join(projectPath, `src`, `workers`))).toBe(true)
      const pkg = JSON.parse(readFileSync(join(projectPath, `package.json`), `utf-8`)) as {dependencies?: Record<string, string>}
      expect(pkg.dependencies?.["@gramstax/worker-thread"]).toBe(`^9.9.9`)
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`prunes the workers dir, every dep section, and all imports`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath, {useWorkerThread: false}))
      expect(existsSync(join(projectPath, `src`, `workers`))).toBe(false)
      const pkg = JSON.parse(readFileSync(join(projectPath, `package.json`), `utf-8`)) as Record<string, Record<string, string> | undefined>
      for (const section of [`dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`]) {
        expect(pkg[section]?.["@gramstax/worker-thread"]).toBeUndefined()
      }
      expect(filesContaining(projectPath, `@gramstax/worker-thread`)).toEqual([])
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`does not add worker-thread to the CLI runtime dependencies`, () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dir, `..`, `package.json`), `utf-8`)) as {dependencies?: Record<string, string>}
    expect(pkg.dependencies?.["@gramstax/worker-thread"]).toBeUndefined()
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual([`commander`, `enquirer`, `logging-pretty`])
  })
})

describe(`node runtime scripts`, () => {
  it(`rewrites dev, start, build, and bun test scripts without deleting build`, () => {
    const scripts = {
      dev: `bun --watch src/index.ts`,
      start: `bun src/index.ts`,
      build: `bun build src/index.ts --outdir dist --target bun`,
      typecheck: `tsc --noEmit`,
      test: `bun test test/`,
      "test:e2e": `bun test e2e/`,
      "test:all": `bun test test/ e2e/`
    }
    const result = resolveRuntimeScripts(`node`, scripts)
    expect(result.dev).toBe(`node --watch src/index.ts`)
    expect(result.start).toBe(`node src/index.ts`)
    expect(result.build).toBeDefined()
    expect(result.build ?? ``).not.toContain(`bun`)
    for (const key of [`test`, `test:e2e`, `test:all`]) {
      expect(result[key] ?? ``).not.toContain(`bun`)
    }
    expect(result.typecheck).toBe(`tsc --noEmit`)
  })

  it(`rewrites the generated package.json scripts for node`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath, {runtime: `node`}))
      const pkg = JSON.parse(readFileSync(join(projectPath, `package.json`), `utf-8`)) as {scripts?: Record<string, string>}
      expect(pkg.scripts?.dev).toContain(`node`)
      expect(pkg.scripts?.start).toContain(`node`)
      expect(pkg.scripts?.build).toBeDefined()
      for (const value of Object.values(pkg.scripts ?? {})) {
        expect(value).not.toContain(`bun`)
      }
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })
})

describe(`resolveWorkspaceDeps`, () => {
  it(`rewrites workspace:* in every dep section`, () => {
    const pkg: Record<string, Record<string, string>> = {
      dependencies: {gramstax: `workspace:*`, dayjs: `^1.0.0`},
      devDependencies: {"@gramstax/worker-thread": `workspace:*`},
      peerDependencies: {typescript: `workspace:*`},
      optionalDependencies: {extra: `workspace:*`}
    }
    resolveWorkspaceDeps(pkg, `1.2.3`)
    expect(pkg.dependencies?.gramstax).toBe(`^1.2.3`)
    expect(pkg.dependencies?.dayjs).toBe(`^1.0.0`)
    expect(pkg.devDependencies?.["@gramstax/worker-thread"]).toBe(`^1.2.3`)
    expect(pkg.peerDependencies?.typescript).toBe(`^1.2.3`)
    expect(pkg.optionalDependencies?.extra).toBe(`^1.2.3`)
  })

  it(`throws when the version is undefined but workspace:* remains`, () => {
    const pkg = {dependencies: {gramstax: `workspace:*`}}
    expect(() => resolveWorkspaceDeps(pkg, undefined)).toThrow(/workspace/)
  })

  it(`stays silent when the version is undefined and nothing needs resolving`, () => {
    const pkg = {dependencies: {gramstax: `^1.0.0`}}
    expect(() => resolveWorkspaceDeps(pkg, undefined)).not.toThrow()
    expect(pkg.dependencies.gramstax).toBe(`^1.0.0`)
  })
})

describe(`biome single install`, () => {
  it(`adds @biomejs/biome to devDependencies before install`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen: {calls: number; devDepsAtInstall?: unknown} = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath, {setupBiome: true}))
      expect(seen.calls).toBe(1)
      const devDeps = seen.devDepsAtInstall as Record<string, string> | undefined
      expect(devDeps?.[`@biomejs/biome`]).toBeDefined()
      const pkg = JSON.parse(readFileSync(join(projectPath, `package.json`), `utf-8`)) as {devDependencies?: Record<string, string>}
      expect(pkg.devDependencies?.[`@biomejs/biome`]).toBeDefined()
      expect(existsSync(join(projectPath, `biome.json`))).toBe(true)
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`prunes biome.json, lint/format scripts, and the biome devDep`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath, {setupBiome: false}))
      expect(seen.calls).toBe(1)
      expect(existsSync(join(projectPath, `biome.json`))).toBe(false)
      const pkg = JSON.parse(readFileSync(join(projectPath, `package.json`), `utf-8`)) as {scripts?: Record<string, string>; devDependencies?: Record<string, string>}
      for (const key of Object.keys(pkg.scripts ?? {})) {
        expect(key).not.toMatch(/^lint/)
        expect(key).not.toMatch(/^format/)
      }
      expect(pkg.scripts?.dev).toBeDefined()
      expect(pkg.devDependencies?.[`@biomejs/biome`]).toBeUndefined()
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`stripBiomeScripts removes every lint/format prefixed script`, () => {
    const pkg: {scripts: Record<string, string>} = {
      scripts: {dev: `bun --watch src/index.ts`, lint: `x`, "lint:fix": `x`, "lint:check": `x`, format: `x`, "format:check": `x`}
    }
    stripBiomeScripts(pkg)
    expect(pkg.scripts).toEqual({dev: `bun --watch src/index.ts`})
  })

  it(`a failed install throws instead of logging success`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const creator = new Create(undefined, {version: `9.9.9`}) as unknown as TestCreate
    creator.installDependencies = async () => false
    try {
      await expect(creator.executeProjectGeneration(baseConfig(projectPath))).rejects.toThrow(/installation failed/i)
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })
})

describe(`skipInstall`, () => {
  it(`skips the installer when skipInstall is true`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath, {skipInstall: true}))
      expect(seen.calls).toBe(0)
      expect(existsSync(join(projectPath, `package.json`))).toBe(true)
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`installs once when skipInstall is falsy`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath))
      expect(seen.calls).toBe(1)
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })
})

describe(`atomic file writes`, () => {
  it(`writeJsonFileAtomic round-trips JSON with no tmp leftovers`, () => {
    const root = makeTempRoot()
    try {
      const target = join(root, `pkg.json`)
      writeJsonFileAtomic(target, {name: `demo`, scripts: {dev: `x`}})
      expect(JSON.parse(readFileSync(target, `utf-8`))).toEqual({name: `demo`, scripts: {dev: `x`}})
      expect(readdirSync(root).filter((entry) => entry.includes(`.tmp-`))).toEqual([])
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`writeTextFileAtomic round-trips text with no tmp leftovers`, () => {
    const root = makeTempRoot()
    try {
      const target = join(root, `.env`)
      writeTextFileAtomic(target, `A=1\n`)
      expect(readFileSync(target, `utf-8`)).toBe(`A=1\n`)
      expect(readdirSync(root).filter((entry) => entry.includes(`.tmp-`))).toEqual([])
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })
})
