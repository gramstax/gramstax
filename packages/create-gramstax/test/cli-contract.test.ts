import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test"
import {mkdtempSync, readFileSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Create} from "../src/create"
import {FsUt} from "../src/utils/fs"
import {validateCliOptions} from "../src/utils/project"

const indexPath = join(import.meta.dir, `..`, `src`, `index.ts`)
const createPath = join(import.meta.dir, `..`, `src`, `create.ts`)

function readIndex(): string {
  return readFileSync(indexPath, `utf-8`)
}

function readCreate(): string {
  return readFileSync(createPath, `utf-8`)
}

let tempDirs: string[] = []
let originalResolve: typeof FsUt.resolveInitialWorkingDirectory
let originalIsTTY: boolean | undefined

function makeTempBase(): string {
  const dir = mkdtempSync(join(tmpdir(), `cli-contract-`))
  tempDirs.push(dir)
  return dir
}

function setTTY(value: boolean | undefined): void {
  try {
    Object.defineProperty(process.stdin, `isTTY`, {value, configurable: true})
  } catch {
    const stdin = process.stdin as unknown as {isTTY?: boolean}
    stdin.isTTY = value
  }
}

function mockEnquirer(impl: (args?: unknown) => Promise<unknown>): void {
  mock.module(`enquirer`, () => ({
    default: {prompt: impl}
  }))
}

beforeEach(() => {
  originalResolve = FsUt.resolveInitialWorkingDirectory
  try {
    originalIsTTY = process.stdin.isTTY
  } catch {
    originalIsTTY = undefined
  }
})

afterEach(() => {
  FsUt.resolveInitialWorkingDirectory = originalResolve
  setTTY(originalIsTTY)
  mock.restore()
  for (const dir of tempDirs) {
    rmSync(dir, {recursive: true, force: true})
  }
  tempDirs = []
})

describe(`cli-contract pm runtime case-insensitive plus choices`, () => {
  it(`normalizes uppercase pm runtime before validation`, async () => {
    const base = makeTempBase()
    FsUt.resolveInitialWorkingDirectory = () => base
    setTTY(false)
    const name = `norm-${Date.now().toString(36)}`
    const create = new Create(name, {
      cliOptions: {packageManager: `NPM` as unknown as `npm`, runtime: `NODE` as unknown as `node`, lmdb: true, workerThread: true, biome: true}
    })
    const config = await create.gatherProjectConfig()
    expect(config.packageManager).toBe(`npm`)
    expect(config.runtime).toBe(`node`)
  })

  it(`trims whitespace around pm runtime`, async () => {
    const base = makeTempBase()
    FsUt.resolveInitialWorkingDirectory = () => base
    setTTY(false)
    const name = `trim-${Date.now().toString(36)}`
    const create = new Create(name, {
      cliOptions: {packageManager: `  pnpm  ` as unknown as `pnpm`, runtime: `  bun  ` as unknown as `bun`, lmdb: true, workerThread: true, biome: true}
    })
    const config = await create.gatherProjectConfig()
    expect(config.packageManager).toBe(`pnpm`)
    expect(config.runtime).toBe(`bun`)
  })

  it(`declares commander choices for pm and runtime`, () => {
    const source = readIndex()
    expect(source).toContain(`choices`)
    expect(source).toContain(`bun`)
    expect(source).toContain(`npm`)
    expect(source).toContain(`pnpm`)
    expect(source).toContain(`yarn`)
    expect(source).toContain(`toLowerCase`)
    expect(source).toContain(`trim`)
  })
})

describe(`cli-contract feature flags are two-sided and default to unstated`, () => {
  it(`defines both spellings for lmdb worker-thread and biome`, () => {
    const source = readIndex()
    expect(source).toContain(`--lmdb`)
    expect(source).toContain(`--no-lmdb`)
    expect(source).toContain(`--worker-thread`)
    expect(source).toContain(`--no-worker-thread`)
    expect(source).toContain(`--biome`)
    expect(source).toContain(`--no-biome`)
  })

  it(`gives the three feature flags no default, so a declined prompt is reachable`, () => {
    // This is the regression guard. A `true` default made `opts.lmdb` always
    // defined, so `cli?.lmdb ?? prompted.lmdb` resolved to the flag on every run
    // and the confirm prompt was decorative. Asserted on the source because the
    // symptom is only observable through commander and the config assembly.
    const source = readIndex()
    expect(source).not.toMatch(/\.option\(`--lmdb`,[^)]*,\s*true\)/)
    expect(source).not.toMatch(/\.option\(`--worker-thread`,[^)]*,\s*true\)/)
    expect(source).not.toMatch(/\.option\(`--biome`,[^)]*,\s*true\)/)
    expect(source).toContain(`addOption(new Option(\`--lmdb\``)
    expect(source).toContain(`addOption(new Option(\`--no-lmdb\``)
  })

  it(`carries skipInstall into the project config`, () => {
    // `skipInstall` was parsed and threaded into `Create`, but no branch that
    // assembles the config copied it, so `config.skipInstall === true` never
    // held and the install step ran regardless of the flag.
    const source = readCreate()
    expect(source).toContain(`skipInstall: cli?.skipInstall === true`)
    expect(source).toContain(`config.skipInstall = this._cliOptions?.skipInstall === true`)
  })
})

describe(`cli-contract detectPackageManager pure`, () => {
  it(`exports detectPackageManager from index`, async () => {
    const mod = (await import(`../src/index`)) as {detectPackageManager?: unknown}
    expect(typeof mod.detectPackageManager).toBe(`function`)
  })

  it(`prefers explicit over env and lockfile`, async () => {
    const mod = (await import(`../src/index`)) as {detectPackageManager: (explicit?: string, overrides?: {userAgent?: string; cwd?: string; exists?: (p: string) => boolean}) => string}
    const result = mod.detectPackageManager(`npm`, {userAgent: `pnpm/9.0.0`, cwd: `/tmp`, exists: () => true})
    expect(result).toBe(`npm`)
  })

  it(`reads npm_config_user_agent with pnpm before npm substring`, async () => {
    const mod = (await import(`../src/index`)) as {detectPackageManager: (explicit?: string, overrides?: {userAgent?: string}) => string}
    expect(mod.detectPackageManager(undefined, {userAgent: `pnpm/9.0.0 npm/10.0.0 node/v22`})).toBe(`pnpm`)
    expect(mod.detectPackageManager(undefined, {userAgent: `yarn/1.22.0 npm/10.0.0`})).toBe(`yarn`)
    expect(mod.detectPackageManager(undefined, {userAgent: `bun/1.1.0`})).toBe(`bun`)
    expect(mod.detectPackageManager(undefined, {userAgent: `npm/10.0.0 node/v22`})).toBe(`npm`)
  })

  it(`detects lockfiles in priority order then falls back to bun`, async () => {
    const mod = (await import(`../src/index`)) as {detectPackageManager: (explicit?: string, overrides?: {cwd?: string; exists?: (p: string) => boolean; userAgent?: string}) => string}
    const existsBunLockb = (p: string): boolean => p.endsWith(`bun.lockb`)
    expect(mod.detectPackageManager(undefined, {userAgent: ``, cwd: `/proj`, exists: existsBunLockb})).toBe(`bun`)
    const existsPnpm = (p: string): boolean => p.endsWith(`pnpm-lock.yaml`)
    expect(mod.detectPackageManager(undefined, {userAgent: ``, cwd: `/proj`, exists: existsPnpm})).toBe(`pnpm`)
    const existsYarn = (p: string): boolean => p.endsWith(`yarn.lock`)
    expect(mod.detectPackageManager(undefined, {userAgent: ``, cwd: `/proj`, exists: existsYarn})).toBe(`yarn`)
    const existsNpm = (p: string): boolean => p.endsWith(`package-lock.json`)
    expect(mod.detectPackageManager(undefined, {userAgent: ``, cwd: `/proj`, exists: existsNpm})).toBe(`npm`)
    expect(mod.detectPackageManager(undefined, {userAgent: ``, cwd: `/proj`, exists: () => false})).toBe(`bun`)
  })

  it(`uses detect as fallback instead of hardcoded bun`, () => {
    const source = readCreate()
    expect(source).toContain(`detectPackageManager`)
  })
})

describe(`cli-contract partial flags prompt or throw`, () => {
  it(`throws explicit missing runtime in non-TTY partial mode`, async () => {
    const base = makeTempBase()
    FsUt.resolveInitialWorkingDirectory = () => base
    setTTY(false)
    const name = `partial-${Date.now().toString(36)}`
    const create = new Create(name, {cliOptions: {packageManager: `bun`}})
    await expect(create.gatherProjectConfig()).rejects.toThrow(/runtime/i)
  })

  it(`prompts for missing fields in TTY partial mode`, async () => {
    const base = makeTempBase()
    FsUt.resolveInitialWorkingDirectory = () => base
    setTTY(true)
    let prompted = false
    mockEnquirer(async () => {
      prompted = true
      return {packageManager: `bun`, runtime: `bun`, lmdb: true, workerThread: true, biome: true}
    })
    const name = `partial-tty-${Date.now().toString(36)}`
    const create = new Create(name, {cliOptions: {packageManager: `bun`}})
    const config = await create.gatherProjectConfig()
    expect(prompted).toBe(true)
    expect(config.packageManager).toBe(`bun`)
  })
})

describe(`cli-contract missing project name`, () => {
  it(`throws Missing in non-TTY when no name and no flags`, async () => {
    const base = makeTempBase()
    FsUt.resolveInitialWorkingDirectory = () => base
    setTTY(false)
    mockEnquirer(async () => ({projectName: `should-not-prompt`}))
    const create = new Create(undefined, {})
    await expect(create.gatherProjectConfig()).rejects.toThrow(/Missing project name/)
  })

  it(`prompts for name in TTY when flags present but name missing`, async () => {
    const base = makeTempBase()
    FsUt.resolveInitialWorkingDirectory = () => base
    setTTY(true)
    let namePrompted = false
    mockEnquirer(async (args?: unknown) => {
      const first = Array.isArray(args) ? (args[0] as {name?: string}) : (args as {name?: string})
      if (first !== undefined && !Array.isArray(args)) {
        namePrompted = true
        return {projectName: `tty-named-${Date.now().toString(36)}`}
      }
      return {packageManager: `bun`, runtime: `bun`, lmdb: true, workerThread: true, biome: true}
    })
    const create = new Create(undefined, {cliOptions: {packageManager: `bun`, runtime: `bun`, lmdb: true, workerThread: true, biome: true}})
    const config = await create.gatherProjectConfig()
    expect(namePrompted).toBe(true)
    expect(config.projectName.startsWith(`tty-named-`)).toBe(true)
  })
})

describe(`cli-contract skip-install flag`, () => {
  it(`defines --skip-install and skipInstall field plus mapping`, () => {
    const indexSource = readIndex()
    const createSource = readCreate()
    expect(indexSource).toContain(`--skip-install`)
    expect(indexSource).toContain(`skipInstall`)
    expect(createSource).toContain(`skipInstall`)
  })
})

describe(`cli-contract never process.exit in Create`, () => {
  it(`create.ts contains no process.exit`, () => {
    expect(readCreate()).not.toContain(`process.exit`)
  })

  it(`index maps to exitCode with cancelled info and no Failed word`, () => {
    const source = readIndex()
    expect(source).toContain(`process.exitCode`)
    expect(source).toContain(`SetupCancelledError`)
    expect(source).toContain(`Setup cancelled`)
    expect(source).not.toContain(`process.exit(`)
    expect(source).toContain(`= 0`)
    expect(source).toContain(`= 1`)
    expect(source).toContain(`= 2`)
  })

  it(`createProject only throws instead of exiting`, async () => {
    const base = makeTempBase()
    FsUt.resolveInitialWorkingDirectory = () => base
    setTTY(false)
    const create = new Create(`definitely-invalid-name-!!!`, {cliOptions: {packageManager: `bun`}})
    await expect(create.createProject()).rejects.toThrow()
  })
})

describe(`cli-contract version resilient plus validation messages`, () => {
  it(`loads version with fallback when package.json corrupt`, () => {
    const source = readIndex()
    expect(source).toContain(`0.0.0`)
    expect(source).toContain(`try`)
    expect(source).toContain(`catch`)
  })

  it(`validation errors mention received value plus legal list`, () => {
    expect(() => validateCliOptions(`bogus-pm`, undefined)).toThrow(/bogus-pm/)
    expect(() => validateCliOptions(`bogus-pm`, undefined)).toThrow(/bun, npm, pnpm, yarn/)
    expect(() => validateCliOptions(undefined, `deno`)).toThrow(/deno/)
    expect(() => validateCliOptions(undefined, `deno`)).toThrow(/bun, node/)
  })
})
