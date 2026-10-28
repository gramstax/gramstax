import {beforeEach, describe, expect, it, mock} from "bun:test"
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Create} from "../src/create"
import {log} from "../src/utils/log"
import {assertNoLeftoverPlaceholders, buildServicesSource, removeDependency, removeTsconfigPathMappings, resolveWorkspaceDeps, stripBiomeScripts, writeJsonFileAtomic, writeTextFileAtomic} from "../src/utils/project"

type GenerationConfig = {
  projectName: string
  projectPath: string
  packageManager: `bun`
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

/** Template files whose content matches `pattern`, as `template/...` paths. */
function scaffoldOffenders(pattern: RegExp): string[] {
  const root = join(import.meta.dir, `..`, `src`, `templates`)
  const hits: Array<string> = []
  const walk = (current: string) => {
    for (const entry of readdirSync(current, {withFileTypes: true})) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith(`.ts`) && pattern.test(readFileSync(full, `utf-8`))) {
        hits.push(full.replace(root, `template`))
      }
    }
  }
  walk(join(root, `src`))
  return hits
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

describe(`generated agent guidance`, () => {
  it(`copies AGENTS.md into the generated project`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const creator = makeCreator({calls: 0})
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath, {skipInstall: true}))
      const agentsPath = join(projectPath, `AGENTS.md`)
      expect(existsSync(agentsPath)).toBe(true)
      const content = readFileSync(agentsPath, `utf-8`)
      expect(content).toContain(`gramstax.config.ts`)
      expect(content).toContain(`src/core/bot.ts`)
      expect(content).toContain(`src/db/`)
      expect(content).toContain(`src/workers/`)
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
    const examplePath = join(import.meta.dir, `..`, `src`, `templates`, `src`, `workers`, `job.ts`)
    expect(existsSync(examplePath)).toBe(true)
    const content = readFileSync(examplePath, `utf-8`)
    expect(content).toContain(`WorkerThreadInit`)
    expect(content).toMatch(/mtd\w+/)
    expect(content).toContain(`extends WorkerThreadInit`)
    expect(content).toContain(`WorkerThreadExport`)
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

describe(`types scaffold`, () => {
  const templateSrc = join(import.meta.dir, `..`, `src`, `templates`, `src`)

  it(`ships the three type files and the consumers import them`, () => {
    for (const name of [`user.ts`, `job.ts`, `page.ts`]) {
      expect(existsSync(join(templateSrc, `types`, name))).toBe(true)
    }
    expect(readFileSync(join(templateSrc, `db`, `repositories`, `user.ts`), `utf-8`)).toContain(`from "~/types/user"`)
    expect(readFileSync(join(templateSrc, `workers`, `job.ts`), `utf-8`)).toContain(`from "~/types/job"`)
    expect(readFileSync(join(templateSrc, `core`, `bot.ts`), `utf-8`)).toContain(`from "~/types/page"`)
    expect(readFileSync(join(templateSrc, `pages`, `sum-number.ts`), `utf-8`)).toContain(`from "~/types/page"`)
  })

  it(`keeps all three type files when both features are enabled`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath))
      for (const name of [`user.ts`, `job.ts`, `page.ts`]) {
        expect(existsSync(join(projectPath, `src`, `types`, name))).toBe(true)
      }
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`prunes user types when lmdb is disabled`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath, {useLmdb: false, useWorkerThread: true}))
      expect(existsSync(join(projectPath, `src`, `types`, `user.ts`))).toBe(false)
      expect(existsSync(join(projectPath, `src`, `types`, `job.ts`))).toBe(true)
      expect(existsSync(join(projectPath, `src`, `types`, `page.ts`))).toBe(true)
      expect(filesContaining(projectPath, `~/types/user`)).toEqual([])
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`prunes job types when worker threads are disabled`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath, {useLmdb: true, useWorkerThread: false}))
      expect(existsSync(join(projectPath, `src`, `types`, `job.ts`))).toBe(false)
      expect(existsSync(join(projectPath, `src`, `types`, `user.ts`))).toBe(true)
      expect(existsSync(join(projectPath, `src`, `types`, `page.ts`))).toBe(true)
      expect(filesContaining(projectPath, `~/types/job`)).toEqual([])
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })

  it(`keeps only page types when both features are disabled`, async () => {
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const seen = {calls: 0}
    const creator = makeCreator(seen)
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath, {useLmdb: false, useWorkerThread: false}))
      expect(readdirSync(join(projectPath, `src`, `types`))).toEqual([`page.ts`])
      expect(filesContaining(projectPath, `~/types/user`)).toEqual([])
      expect(filesContaining(projectPath, `~/types/job`)).toEqual([])
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })
})

describe(`service seam`, () => {
  const servicesTemplatePath = join(import.meta.dir, `..`, `src`, `templates`, `src`, `core`, `services.ts`)

  it(`the shipped template is byte-identical to the generated both-on variant`, () => {
    // create.ts overwrites services.ts on every run, so a divergence here means
    // the reviewed file in the repo is dead code nobody ever sees.
    expect(readFileSync(servicesTemplatePath, `utf-8`)).toBe(buildServicesSource(true, true))
  })

  it(`drops the db import when lmdb is disabled`, () => {
    const source = buildServicesSource(false, true)
    expect(source).not.toContain(`~/db`)
    expect(source).not.toContain(`Db.start()`)
    expect(source).toContain(`JobWorker.launchWorker()`)
  })

  it(`drops the workers import when worker threads are disabled`, () => {
    const source = buildServicesSource(true, false)
    expect(source).not.toContain(`~/workers/job`)
    expect(source).not.toContain(`JobWorker`)
    expect(source).toContain(`Db.start()`)
  })

  it(`emits a no-op class that names no pruned package when both are disabled`, () => {
    const source = buildServicesSource(false, false)
    expect(source).not.toContain(`@gramstax/lmdb`)
    expect(source).not.toContain(`@gramstax/worker-thread`)
    expect(source).not.toContain(`import `)
    expect(source).toContain(`export class ServicesCore`)
  })

  it(`stops workers before the database`, () => {
    const source = buildServicesSource(true, true)
    expect(source.indexOf(`JobWorker.shutdown(`)).toBeLessThan(source.indexOf(`Db.stop()`))
  })

  it(`exposes only a class — no module-level lifecycle functions`, () => {
    // Template code is class-based by convention, so the seam must not leak
    // free functions into a generated project.
    for (const useLmdb of [true, false]) {
      for (const useWorkerThread of [true, false]) {
        const source = buildServicesSource(useLmdb, useWorkerThread)
        expect(source).not.toMatch(/^export (async )?function/m)
        expect(source).not.toMatch(/^export const \w+ = async/m)
      }
    }
  })

  it(`no scaffolded source file exports a module-level function`, () => {
    // The same rule as the seam above, enforced across every template file so a
    // free function cannot reappear in a page, guard or repository.
    expect(scaffoldOffenders(/^export (async )?function/m)).toEqual([])
    expect(scaffoldOffenders(/^export const \w+ = (async )?\(/m)).toEqual([])
  })

  it(`no scaffolded source file calls console.*`, () => {
    // The app routes everything through the gramstax logger (helpers/log.ts), so
    // a stray console.* would bypass the configured log destination.
    expect(scaffoldOffenders(/console\.(log|warn|error|info|debug|trace)\s*\(/m)).toEqual([])
  })

  it(`no scaffolded class declares a private member without the underscore prefix`, () => {
    expect(scaffoldOffenders(/\bprivate\s+(?!static\s+_|readonly\s+_)[A-Za-z_$][\w$]*/m)).toEqual([])
  })

  it(`regenerates services.ts in the generated project for each feature set`, async () => {
    for (const [useLmdb, useWorkerThread] of [
      [true, true],
      [true, false],
      [false, true],
      [false, false]
    ] as const) {
      const root = makeTempRoot()
      const projectPath = join(root, `proj`)
      const creator = makeCreator({calls: 0})
      try {
        await creator.executeProjectGeneration(baseConfig(projectPath, {useLmdb, useWorkerThread}))
        expect(readFileSync(join(projectPath, `src`, `core`, `services.ts`), `utf-8`)).toBe(buildServicesSource(useLmdb, useWorkerThread))
      } finally {
        rmSync(root, {recursive: true, force: true})
      }
    }
  })

  it(`emits gramstax.config.ts byte-identical to the template`, async () => {
    const template = readFileSync(join(import.meta.dir, `..`, `src`, `templates`, `gramstax.config.ts`), `utf-8`)
    const root = makeTempRoot()
    const projectPath = join(root, `proj`)
    const creator = makeCreator({calls: 0})
    try {
      await creator.executeProjectGeneration(baseConfig(projectPath))
      expect(readFileSync(join(projectPath, `gramstax.config.ts`), `utf-8`)).toBe(template)
    } finally {
      rmSync(root, {recursive: true, force: true})
    }
  })
})
