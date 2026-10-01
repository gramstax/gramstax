import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test"
import {existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Create} from "../src/create"
import {FsUt} from "../src/utils/fs"
import {
  appendEnvDbPath,
  appendGitignoreEntries,
  isValidProjectName,
  removeDependency,
  removeTsconfigPathMappings,
  replaceTemplateVariables,
  resolveRuntimeScripts,
  resolveWorkspaceDeps,
  SetupCancelledError,
  sanitizeProjectName,
  setTsconfigCompilerOptions,
  stripBiomeScripts,
  validateCliOptions
} from "../src/utils/project"

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

  it(`spawns .cmd shims through a shell on Windows (Node EINVAL guard)`, () => {
    expect(FsUt.resolveSpawnShell(`npm`, `win32`)).toBe(true)
    expect(FsUt.resolveSpawnShell(`pnpm`, `win32`)).toBe(true)
    expect(FsUt.resolveSpawnShell(`yarn`, `win32`)).toBe(true)
    expect(FsUt.resolveSpawnShell(`bun`, `win32`)).toBe(false)

    expect(FsUt.resolveSpawnShell(`npm`, `linux`)).toBe(false)
    expect(FsUt.resolveSpawnShell(`bun`, `linux`)).toBe(false)
    expect(FsUt.resolveSpawnShell(`npm`, `darwin`)).toBe(false)
  })

  it(`prefers INIT_CWD when resolving base directory`, () => {
    expect(FsUt.resolveInitialWorkingDirectory(`C:\\current`, `C:\\from-init`)).toBe(`C:\\from-init`)
    expect(FsUt.resolveInitialWorkingDirectory(`/current`, undefined)).toBe(`/current`)
  })

  it(`promotes the gitignore template to .gitignore`, () => {
    const tempDir = mkdtempSync(join(tmpdir(), `create-gramstax-`))
    writeFileSync(join(tempDir, `gitignore`), `node_modules/\n`)

    FsUt.normalizeGitignoreFile(tempDir)

    expect(existsSync(join(tempDir, `.gitignore`))).toBe(true)
    expect(existsSync(join(tempDir, `gitignore`))).toBe(false)
    expect(readFileSync(join(tempDir, `.gitignore`), `utf-8`)).toBe(`node_modules/\n`)
    rmSync(tempDir, {recursive: true, force: true})
  })

  it(`merges the gitignore template into an existing .gitignore`, () => {
    const tempDir = mkdtempSync(join(tmpdir(), `create-gramstax-`))
    writeFileSync(join(tempDir, `gitignore`), `node_modules/\n`)
    writeFileSync(join(tempDir, `.gitignore`), `custom-entry\n`)

    FsUt.normalizeGitignoreFile(tempDir)

    expect(existsSync(join(tempDir, `.gitignore`))).toBe(true)
    expect(existsSync(join(tempDir, `gitignore`))).toBe(false)
    expect(readFileSync(join(tempDir, `.gitignore`), `utf-8`)).toBe(`custom-entry\nnode_modules/\n`)
    rmSync(tempDir, {recursive: true, force: true})
  })

  it(`is a no-op when no gitignore template exists`, () => {
    const tempDir = mkdtempSync(join(tmpdir(), `create-gramstax-`))
    expect(() => FsUt.normalizeGitignoreFile(tempDir)).not.toThrow()
    rmSync(tempDir, {recursive: true, force: true})
  })
})

describe(`replaceTemplateVariables`, () => {
  it(`replaces placeholders in content`, () => {
    const result = replaceTemplateVariables(`name: {{projectName}}, cmd: {{installCmd}}`, {
      projectName: `my-bot`,
      installCmd: `bun install`
    })
    expect(result).toBe(`name: my-bot, cmd: bun install`)
  })

  it(`replaces multiple occurrences of the same placeholder`, () => {
    const result = replaceTemplateVariables(`{{projectName}}/{{projectName}}`, {projectName: `bot`})
    expect(result).toBe(`bot/bot`)
  })

  it(`does not interpret $ sequences in values as replacement patterns`, () => {
    const result = replaceTemplateVariables(`{{projectName}}`, {projectName: `my$&proj`})
    expect(result).toBe(`my$&proj`)
  })

  it(`does not interpret $1 / $' sequences in values`, () => {
    const result = replaceTemplateVariables(`{{projectName}}`, {projectName: `a$1b$'c`})
    expect(result).toBe(`a$1b$'c`)
  })

  it(`leaves unknown placeholders untouched`, () => {
    const result = replaceTemplateVariables(`{{unknown}} {{projectName}}`, {projectName: `bot`})
    expect(result).toBe(`{{unknown}} bot`)
  })
})

describe(`isValidProjectName`, () => {
  it(`accepts letters, numbers, hyphens, and underscores`, () => {
    expect(isValidProjectName(`my-bot`)).toBe(true)
    expect(isValidProjectName(`MyBot`)).toBe(true)
    expect(isValidProjectName(`bot_1`)).toBe(true)
    expect(isValidProjectName(`123`)).toBe(true)
  })

  it(`rejects unsafe or invalid names`, () => {
    expect(isValidProjectName(``)).toBe(false)
    expect(isValidProjectName(`my bot`)).toBe(false)
    expect(isValidProjectName(`my/bot`)).toBe(false)
    expect(isValidProjectName(`..`)).toBe(false)
    expect(isValidProjectName(`my.bot`)).toBe(false)
    expect(isValidProjectName(`bot!`)).toBe(false)
  })

  it(`rejects names longer than 100 characters`, () => {
    expect(isValidProjectName(`a`.repeat(101))).toBe(false)
    expect(isValidProjectName(`a`.repeat(100))).toBe(true)
  })
})

describe(`sanitizeProjectName`, () => {
  it(`slugifies a directory name with spaces and uppercase`, () => {
    expect(sanitizeProjectName(`My Bot Project`)).toBe(`my-bot-project`)
    expect(sanitizeProjectName(`ÜBER-BOT`)).toBe(`ber-bot`)
    expect(sanitizeProjectName(`bot.v2`)).toBe(`bot-v2`)
  })

  it(`keeps already-valid names unchanged`, () => {
    expect(sanitizeProjectName(`my-bot`)).toBe(`my-bot`)
    expect(sanitizeProjectName(`MyBot_1`)).toBe(`mybot_1`)
  })

  it(`trims leading and trailing separators`, () => {
    expect(sanitizeProjectName(`--my-bot--`)).toBe(`my-bot`)
  })

  it(`falls back to a default name when nothing usable remains`, () => {
    expect(sanitizeProjectName(`!!!`)).toBe(`gramstax-bot`)
    expect(sanitizeProjectName(``)).toBe(`gramstax-bot`)
  })

  it(`always produces a valid project name`, () => {
    for (const name of [`My Bot Project`, `ÜBER`, `a.b.c`, `--x--`, `!!!`, `  spaced  `]) {
      expect(isValidProjectName(sanitizeProjectName(name))).toBe(true)
    }
  })
})

describe(`validateCliOptions`, () => {
  it(`accepts supported package managers and runtimes`, () => {
    expect(() => validateCliOptions(`bun`, `bun`)).not.toThrow()
    expect(() => validateCliOptions(`npm`, `node`)).not.toThrow()
    expect(() => validateCliOptions(`pnpm`, undefined)).not.toThrow()
    expect(() => validateCliOptions(undefined, `bun`)).not.toThrow()
    expect(() => validateCliOptions(undefined, undefined)).not.toThrow()
  })

  it(`throws a clear error for unsupported package managers`, () => {
    expect(() => validateCliOptions(`bogus`, undefined)).toThrow(/Unsupported package manager "bogus"/)
    expect(() => validateCliOptions(`bogus`, undefined)).toThrow(/bun, npm, pnpm, yarn/)
  })

  it(`throws a clear error for unsupported runtimes`, () => {
    expect(() => validateCliOptions(undefined, `deno`)).toThrow(/Unsupported runtime "deno"/)
    expect(() => validateCliOptions(undefined, `deno`)).toThrow(/bun, node/)
  })
})

describe(`stripBiomeScripts`, () => {
  it(`removes lint, lint:fix, and format scripts`, () => {
    const pkg: {scripts: Record<string, string>} = {
      scripts: {dev: `bun --watch src/index.ts`, lint: `biome lint`, "lint:fix": `biome lint --write --unsafe`, format: `biome format --write .`}
    }
    stripBiomeScripts(pkg)
    expect(pkg.scripts).toEqual({dev: `bun --watch src/index.ts`})
  })

  it(`keeps non-biome scripts intact`, () => {
    const pkg = {scripts: {dev: `bun --watch src/index.ts`, start: `bun src/index.ts`, build: `bun build src/index.ts --outdir dist --target bun`, test: `bun test test/`}}
    stripBiomeScripts(pkg)
    expect(pkg.scripts).toEqual({dev: `bun --watch src/index.ts`, start: `bun src/index.ts`, build: `bun build src/index.ts --outdir dist --target bun`, test: `bun test test/`})
  })

  it(`is a no-op when scripts are missing`, () => {
    const pkg = {dependencies: {gramstax: `^1.0.0`}}
    expect(() => stripBiomeScripts(pkg as unknown as {scripts?: Record<string, string>})).not.toThrow()
  })
})

describe(`removeDependency`, () => {
  it(`removes the target dependency and keeps the rest`, () => {
    const pkg: {dependencies: Record<string, string>} = {dependencies: {gramstax: `^1.0.0`, "@gramstax/lmdb": `^1.0.0`, dayjs: `^1.11.13`}}
    removeDependency(pkg, `@gramstax/lmdb`)
    expect(pkg.dependencies).toEqual({gramstax: `^1.0.0`, dayjs: `^1.11.13`})
  })

  it(`is a no-op when the dependency is absent`, () => {
    const pkg: {dependencies: Record<string, string>} = {dependencies: {gramstax: `^1.0.0`}}
    removeDependency(pkg, `@gramstax/lmdb`)
    expect(pkg.dependencies).toEqual({gramstax: `^1.0.0`})
  })

  it(`is a no-op when dependencies are missing`, () => {
    const pkg = {scripts: {dev: `bun src/index.ts`}}
    expect(() => removeDependency(pkg as unknown as {dependencies?: Record<string, string>}, `@gramstax/lmdb`)).not.toThrow()
  })
})

describe(`appendGitignoreEntries`, () => {
  it(`appends a new entry with a trailing newline`, () => {
    const result = appendGitignoreEntries(`node_modules/\ndist/\n`, [`data/`])
    expect(result).toBe(`node_modules/\ndist/\ndata/\n`)
  })

  it(`adds a trailing newline when the content has none`, () => {
    const result = appendGitignoreEntries(`node_modules/`, [`data/`])
    expect(result).toBe(`node_modules/\ndata/\n`)
  })

  it(`does not duplicate existing entries`, () => {
    const result = appendGitignoreEntries(`node_modules/\ndata/\n`, [`data/`])
    expect(result).toBe(`node_modules/\ndata/\n`)
  })

  it(`appends multiple new entries`, () => {
    const result = appendGitignoreEntries(`node_modules/\n`, [`data/`, `logs/`])
    expect(result).toBe(`node_modules/\ndata/\nlogs/\n`)
  })

  it(`detects duplicates in CRLF content`, () => {
    const result = appendGitignoreEntries(`node_modules/\r\ndata/\r\n`, [`data/`])
    expect(result).toBe(`node_modules/\r\ndata/\r\n`)
  })
})

describe(`appendEnvDbPath`, () => {
  it(`appends DB_PATH after the existing content`, () => {
    expect(appendEnvDbPath(`BOT_TOKEN=x\n`)).toBe(`BOT_TOKEN=x\n\n\nDB_PATH="./data"\n`)
  })

  it(`does not duplicate DB_PATH when already present`, () => {
    const content = `BOT_TOKEN=x\nDB_PATH="./data"\n`
    expect(appendEnvDbPath(content)).toBe(content)
  })

  it(`handles content without a trailing newline`, () => {
    expect(appendEnvDbPath(`BOT_TOKEN=x`)).toBe(`BOT_TOKEN=x\n\nDB_PATH="./data"\n`)
  })
})

describe(`template .gitignore`, () => {
  const templatesDir = join(import.meta.dir, `..`, `src`, `templates`)
  const gitignorePath = join(templatesDir, `gitignore`)

  it(`keeps the logs directory via !logs/.gitkeep`, () => {
    const content = readFileSync(gitignorePath, `utf-8`)
    expect(content).toContain(`logs/`)
    expect(content).toContain(`!logs/.gitkeep`)
  })

  it(`is shipped under the non-dot name 'gitignore' because npm never publishes .gitignore`, () => {
    expect(existsSync(gitignorePath)).toBe(true)
    expect(existsSync(join(templatesDir, `.gitignore`))).toBe(false)
  })
})

describe(`template README`, () => {
  const readmePath = join(import.meta.dir, `..`, `src`, `templates`, `README.md`)

  it(`does not instruct copying .env.example (it is renamed to .env at generation)`, () => {
    const content = readFileSync(readmePath, `utf-8`)
    expect(content).not.toContain(`.env.example`)
    expect(content).toContain(`.env`)
  })

  it(`uses both runDevCmd and runStartCmd placeholders`, () => {
    const content = readFileSync(readmePath, `utf-8`)
    expect(content).toContain(`{{runDevCmd}}`)
    expect(content).toContain(`{{runStartCmd}}`)
  })
})

describe(`create-gramstax package.json`, () => {
  const pkgPath = join(import.meta.dir, `..`, `package.json`)

  it(`does not declare peerDependencies (typescript is never imported by the CLI)`, () => {
    const pkg = JSON.parse(readFileSync(pkgPath, `utf-8`)) as Record<string, unknown>
    expect(pkg.peerDependencies).toBeUndefined()
  })

  it(`does not declare a module field pointing at a non-existent index.mjs`, () => {
    const pkg = JSON.parse(readFileSync(pkgPath, `utf-8`)) as Record<string, unknown>
    expect(pkg.module).toBeUndefined()
  })
})

describe(`resolveRuntimeScripts`, () => {
  const bunScripts = {dev: `bun --watch src/index.ts`, start: `bun src/index.ts`, build: `bun build src/index.ts --outdir dist --target bun`, typecheck: `tsc --noEmit`}

  it(`keeps bun scripts unchanged for the bun runtime`, () => {
    expect(resolveRuntimeScripts(`bun`, bunScripts)).toBe(bunScripts)
  })

  it(`switches dev/start to node and keeps a tsc build for the node runtime`, () => {
    const result = resolveRuntimeScripts(`node`, bunScripts)
    expect(result.dev).toBe(`node --watch src/index.ts`)
    expect(result.start).toBe(`node src/index.ts`)
    expect(result.build).toBe(`tsc --outDir dist`)
    expect(result.typecheck).toBe(`tsc --noEmit`)
  })

  it(`does not mutate the input scripts object`, () => {
    const input = {...bunScripts}
    resolveRuntimeScripts(`node`, input)
    expect(input.dev).toBe(`bun --watch src/index.ts`)
    expect(input.build).toBeDefined()
  })
})

describe(`template package.json`, () => {
  const pkgPath = join(import.meta.dir, `..`, `src`, `templates`, `package.json`)

  it(`does not declare library metadata pointing at non-existent dist/src paths`, () => {
    const pkg = JSON.parse(readFileSync(pkgPath, `utf-8`)) as Record<string, unknown>
    expect(pkg.main).toBeUndefined()
    expect(pkg.types).toBeUndefined()
    expect(pkg.exports).toBeUndefined()
    expect(pkg.files).toBeUndefined()
  })

  it(`provides a typecheck script using the peer typescript`, () => {
    const pkg = JSON.parse(readFileSync(pkgPath, `utf-8`)) as {scripts?: Record<string, string>}
    expect(pkg.scripts?.typecheck).toBe(`tsc --noEmit`)
  })
})

describe(`template e2e scripts`, () => {
  const scriptsDir = join(import.meta.dir, `..`, `src`, `templates`, `scripts`)

  it(`default e2e directory resolves to ../e2e, not the project root`, () => {
    for (const file of [`generate-e2e-structure.ts`, `check-e2e-mirror.ts`]) {
      const content = readFileSync(join(scriptsDir, file), `utf-8`)
      expect(content).toContain(`../e2e`)
      expect(content).not.toContain(`join(import.meta.dir, \`..\`)`)
    }
  })

  it(`excludes .test.ts/.test.js files via regex, not the ineffective endsWith('.test')`, () => {
    for (const file of [`generate-e2e-structure.ts`, `check-e2e-mirror.ts`]) {
      const content = readFileSync(join(scriptsDir, file), `utf-8`)
      expect(content).toContain(`\\.test\\.(ts|js)$`)
      expect(content).not.toContain(`endsWith(\`.test\`)`)
    }
  })
})

describe(`template e2e tests`, () => {
  const e2eDir = join(import.meta.dir, `..`, `src`, `templates`, `e2e`)

  it(`does not pass redundant chat options (sessions are keyed by user id)`, () => {
    const files = readdirSync(e2eDir, {recursive: true}) as string[]
    const testFiles = files.filter((f) => f.endsWith(`.test.ts`))
    expect(testFiles.length).toBeGreaterThan(0)
    for (const file of testFiles) {
      const content = readFileSync(join(e2eDir, file), `utf-8`)
      expect(content).not.toMatch(/chat\s*:/)
    }
  })
})

describe(`create-gramstax packaging`, () => {
  const pkgDir = join(import.meta.dir, `..`)

  it(`has an explicit .npmignore so npm never falls back to the repo root .gitignore`, () => {
    expect(existsSync(join(pkgDir, `.npmignore`))).toBe(true)
  })
})

describe(`template package.json transformation`, () => {
  const fixtureDir = join(import.meta.dir, `..`, `src`, `templates`)

  function simulateBuildTransform(pkgPath: string, version: string): {dependencies: Record<string, unknown>} {
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

describe(`template src imports`, () => {
  const srcDir = join(import.meta.dir, `..`, `src`, `templates`, `src`)

  it(`uses the ~ alias with automatic extension/index resolution`, () => {
    const files = readdirSync(srcDir, {recursive: true}) as string[]
    const tsFiles = files.filter((f) => f.endsWith(`.ts`))
    expect(tsFiles.length).toBeGreaterThan(0)
    for (const file of tsFiles) {
      const content = readFileSync(join(srcDir, file), `utf-8`)
      expect(content).not.toMatch(/from ".*\.ts"/)
      expect(content).not.toMatch(/from ".*\/index\.ts"/)
      expect(content).not.toMatch(/from "\.\.\/[^"]*" [^~]/)
    }
  })
})

describe(`removeTsconfigPathMappings`, () => {
  const fixtureDir = join(import.meta.dir, `..`, `src`, `templates`)

  it(`removes the @gramstax/lmdb mapping`, () => {
    const content = readFileSync(join(fixtureDir, `tsconfig.json`), `utf-8`)
    const result = removeTsconfigPathMappings(content, [`@gramstax/lmdb`])
    expect(result).not.toContain(`@gramstax/lmdb`)
    expect(result).toContain(`gramstax`)
    expect(result).toContain(`~/*`)
  })

  it(`removes both monorepo mappings when both are requested`, () => {
    const content = readFileSync(join(fixtureDir, `tsconfig.json`), `utf-8`)
    const result = removeTsconfigPathMappings(content, [`gramstax`, `@gramstax/lmdb`])
    expect(result).not.toContain(`@gramstax/lmdb`)
    expect(result).not.toContain(`"gramstax"`)
    expect(result).toContain(`~/*`)
    // no dangling comma after the last kept path entry
    expect(result).not.toMatch(/~\/\*":\s*\[[^\]]*\]\s*,\s*\n\s*\}/)
  })

  it(`leaves content unchanged when no mapping matches`, () => {
    const content = `{"compilerOptions":{"paths":{"~/*":["./src/*"]}}}`
    expect(removeTsconfigPathMappings(content, [`gramstax`])).toBe(content)
  })
})

describe(`resolveWorkspaceDeps`, () => {
  it(`replaces workspace:* deps with a concrete version`, () => {
    const pkg = {dependencies: {gramstax: `workspace:*`, dayjs: `^1.11.13`}}
    resolveWorkspaceDeps(pkg, `1.2.3`)
    expect(pkg.dependencies?.gramstax).toBe(`^1.2.3`)
    expect(pkg.dependencies?.dayjs).toBe(`^1.11.13`)
  })

  it(`handles missing dependencies object`, () => {
    const pkg = {} as {dependencies?: Record<string, string>}
    expect(() => resolveWorkspaceDeps(pkg, `1.2.3`)).not.toThrow()
  })

  it(`throws on missing version when workspace:* remains`, () => {
    const pkg = {dependencies: {gramstax: `workspace:*`}}
    expect(() => resolveWorkspaceDeps(pkg, undefined)).toThrow()
  })

  it(`does not throw on missing version when no workspace:* remains`, () => {
    const pkg = {dependencies: {gramstax: `^1.0.0`}}
    expect(() => resolveWorkspaceDeps(pkg, undefined)).not.toThrow()
    expect(pkg.dependencies?.gramstax).toBe(`^1.0.0`)
  })
})

describe(`setTsconfigCompilerOptions`, () => {
  it(`flips noEmit off for the node runtime`, () => {
    const out = setTsconfigCompilerOptions(`{"compilerOptions": {"noEmit": true}}`, {noEmit: false})
    expect(JSON.parse(out).compilerOptions.noEmit).toBe(false)
  })

  it(`parses JSONC with comments`, () => {
    const out = setTsconfigCompilerOptions(`{// generated\n"compilerOptions": {"noEmit": true}}`, {noEmit: false})
    expect(JSON.parse(out).compilerOptions.noEmit).toBe(false)
  })

  it(`returns input untouched when already set or unparseable`, () => {
    const same = `{"compilerOptions": {"noEmit": false}}`
    expect(setTsconfigCompilerOptions(same, {noEmit: false})).toBe(same)
    const broken = `{"compilerOptions": {`
    expect(setTsconfigCompilerOptions(broken, {noEmit: false})).toBe(broken)
  })
})

describe(`prompt cancel handling`, () => {
  it(`throws SetupCancelledError when enquirer resolves without a package manager`, async () => {
    mock.module(`enquirer`, () => ({
      default: {
        prompt: async () => undefined
      }
    }))
    const create = new Create(undefined)
    const result = (create as unknown as {promptForConfiguration(): Promise<unknown>}).promptForConfiguration()
    await expect(result).rejects.toBeInstanceOf(SetupCancelledError)
  })
})
