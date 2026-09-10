import {afterEach, describe, expect, it, mock} from "bun:test"
import {mkdirSync, mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Create} from "../src/create"
import {FsUt} from "../src/utils/fs"
import {log} from "../src/utils/log"
import {PROJECT_NAME_PATTERN, isValidProjectName, sanitizeProjectName, SetupCancelledError} from "../src/utils/project"

type PromptForProjectName = {promptForProjectName(): Promise<string>}
type PromptForConfiguration = {promptForConfiguration(): Promise<unknown>}
type GatherConfig = {gatherProjectConfig(): Promise<unknown>}

function mockPrompt(impl: (args?: unknown) => Promise<unknown>) {
  mock.module(`enquirer`, () => ({
    default: {prompt: impl}
  }))
}

describe(`promptForProjectName cancel handling`, () => {
  it(`maps undefined resolution to SetupCancelledError`, async () => {
    mockPrompt(async () => undefined)
    const create = new Create(undefined)
    const result = (create as unknown as PromptForProjectName).promptForProjectName()
    await expect(result).rejects.toBeInstanceOf(SetupCancelledError)
  })

  it(`maps rejected prompt to SetupCancelledError`, async () => {
    mockPrompt(async () => {
      throw new Error(`cancelled`)
    })
    const create = new Create(undefined)
    const result = (create as unknown as PromptForProjectName).promptForProjectName()
    await expect(result).rejects.toBeInstanceOf(SetupCancelledError)
  })

  it(`maps missing projectName field to SetupCancelledError`, async () => {
    mockPrompt(async () => ({}))
    const create = new Create(undefined)
    const result = (create as unknown as PromptForProjectName).promptForProjectName()
    await expect(result).rejects.toBeInstanceOf(SetupCancelledError)
  })
})

describe(`promptForProjectName trims`, () => {
  it(`trims surrounding whitespace`, async () => {
    mockPrompt(async () => ({projectName: `  my-bot  `}))
    const create = new Create(undefined)
    const result = await (create as unknown as PromptForProjectName).promptForProjectName()
    expect(result).toBe(`my-bot`)
  })

  it(`treats whitespace-only as empty`, async () => {
    mockPrompt(async () => ({projectName: `   `}))
    const create = new Create(undefined)
    const result = await (create as unknown as PromptForProjectName).promptForProjectName()
    expect(result).toBe(``)
  })
})

describe(`promptForProjectName validation uses PROJECT_NAME_PATTERN`, () => {
  it(`uses shared pattern without regex literal`, async () => {
    const source = await Bun.file(join(import.meta.dir, `..`, `src`, `create.ts`)).text()
    expect(source).toContain(`PROJECT_NAME_PATTERN`)
    expect(source).not.toContain(`^[a-z0-9-_]{1,100}$`)
  })

  it(`validate mirrors PROJECT_NAME_PATTERN with shared message`, async () => {
    let captured: {validate?: (value: string) => boolean | string} | undefined
    mockPrompt(async (args?: unknown) => {
      captured = args as {validate?: (value: string) => boolean | string}
      return {projectName: `x`}
    })
    const create = new Create(undefined)
    await (create as unknown as PromptForProjectName).promptForProjectName()
    expect(captured?.validate).toBeDefined()
    const validate = captured?.validate as (value: string) => boolean | string
    const message = `Project name can only contain letters, numbers, hyphens, and underscores (max 100 characters)`
    expect(validate(``)).toBe(true)
    expect(validate(`   `)).toBe(true)
    expect(validate(`my-bot`)).toBe(true)
    expect(validate(`my bot!`)).toBe(message)
    for (const name of [`my-bot`, `MyBot_1`, `my bot`, `my/bot`, `a`.repeat(101)]) {
      const expected = PROJECT_NAME_PATTERN.test(name) ? true : message
      expect(validate(name)).toBe(expected)
    }
  })
})

describe(`promptForConfiguration partial rejection`, () => {
  it(`rejects when runtime is missing`, async () => {
    mockPrompt(async () => ({packageManager: `bun`, lmdb: true, workerThread: true, biome: true}))
    const create = new Create(undefined)
    const result = (create as unknown as PromptForConfiguration).promptForConfiguration()
    await expect(result).rejects.toBeInstanceOf(SetupCancelledError)
  })

  it(`rejects when lmdb is missing`, async () => {
    mockPrompt(async () => ({packageManager: `bun`, runtime: `bun`, workerThread: true, biome: true}))
    const create = new Create(undefined)
    const result = (create as unknown as PromptForConfiguration).promptForConfiguration()
    await expect(result).rejects.toBeInstanceOf(SetupCancelledError)
  })

  it(`rejects when workerThread is missing`, async () => {
    mockPrompt(async () => ({packageManager: `bun`, runtime: `bun`, lmdb: true, biome: true}))
    const create = new Create(undefined)
    const result = (create as unknown as PromptForConfiguration).promptForConfiguration()
    await expect(result).rejects.toBeInstanceOf(SetupCancelledError)
  })

  it(`rejects when biome is missing`, async () => {
    mockPrompt(async () => ({packageManager: `bun`, runtime: `bun`, lmdb: true, workerThread: true}))
    const create = new Create(undefined)
    const result = (create as unknown as PromptForConfiguration).promptForConfiguration()
    await expect(result).rejects.toBeInstanceOf(SetupCancelledError)
  })

  it(`rejects when packageManager is missing but rest present`, async () => {
    mockPrompt(async () => ({runtime: `bun`, lmdb: true, workerThread: true, biome: true}))
    const create = new Create(undefined)
    const result = (create as unknown as PromptForConfiguration).promptForConfiguration()
    await expect(result).rejects.toBeInstanceOf(SetupCancelledError)
  })

  it(`maps rejected prompt to SetupCancelledError`, async () => {
    mockPrompt(async () => {
      throw new Error(`cancelled`)
    })
    const create = new Create(undefined)
    const result = (create as unknown as PromptForConfiguration).promptForConfiguration()
    await expect(result).rejects.toBeInstanceOf(SetupCancelledError)
  })

  it(`resolves full answers`, async () => {
    mockPrompt(async () => ({packageManager: `bun`, runtime: `bun`, lmdb: true, workerThread: true, biome: true}))
    const create = new Create(undefined)
    const result = await (create as unknown as PromptForConfiguration).promptForConfiguration()
    expect(result).toEqual({packageManager: `bun`, runtime: `bun`, lmdb: true, workerThread: true, biome: true})
  })
})

describe(`sanitizeProjectName truncate`, () => {
  it(`truncates long names to max 100 chars`, () => {
    const result = sanitizeProjectName(`a`.repeat(150))
    expect(result.length).toBe(100)
    expect(isValidProjectName(result)).toBe(true)
  })

  it(`keeps short names unchanged and valid`, () => {
    const result = sanitizeProjectName(`My Bot Project`)
    expect(result).toBe(`my-bot-project`)
    expect(isValidProjectName(result)).toBe(true)
  })

  it(`truncated slug stays valid for messy long input`, () => {
    const result = sanitizeProjectName(`${`My Bot! `.repeat(30)}`)
    expect(result.length).toBeLessThanOrEqual(100)
    expect(isValidProjectName(result)).toBe(true)
  })
})

describe(`directory validation before summary`, () => {
  let tempDir: string
  let originalInfo: typeof log.info
  let originalResolve: typeof FsUt.resolveInitialWorkingDirectory

  afterEach(() => {
    log.info = originalInfo
    FsUt.resolveInitialWorkingDirectory = originalResolve
    if (tempDir) rmSync(tempDir, {recursive: true, force: true})
  })

  it(`does not log Project/Location before throwing for existing directory`, async () => {
    originalInfo = log.info
    originalResolve = FsUt.resolveInitialWorkingDirectory
    tempDir = mkdtempSync(join(tmpdir(), `gramstax-prompts-`))
    mkdirSync(join(tempDir, `taken`))
    FsUt.resolveInitialWorkingDirectory = () => tempDir
    const infos: string[] = []
    log.info = ((message?: unknown) => {
      infos.push(String(message))
    }) as typeof log.info
    const create = new Create(`taken`, {cliOptions: {packageManager: `bun`, runtime: `bun`, lmdb: true, workerThread: true, biome: true}})
    await expect((create as unknown as GatherConfig).gatherProjectConfig()).rejects.toThrow(/already exists/)
    expect(infos.some((m) => m.startsWith(`Project:`))).toBe(false)
    expect(infos.some((m) => m.startsWith(`Location:`))).toBe(false)
  })
})
