import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs"
import {join, sep} from "node:path"
import {pathToFileURL} from "node:url"
import {describe, expect, it} from "bun:test"
import {GramstaxConfigLoader} from "~/cli/config"
import {GramstaxStart} from "~/cli/start"

function makeTempDir(): string {
  return mkdtempSync(join(import.meta.dir, `tmp-start-`))
}

function writeConfig(dir: string, body: string): void {
  writeFileSync(join(dir, `gramstax.config.ts`), body, `utf-8`)
}

async function loadMessage(dir: string): Promise<string> {
  try {
    await new GramstaxConfigLoader().loadConfig(dir)
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }
  return ``
}

async function startMessage(dir: string, argv: string[] = []): Promise<string> {
  try {
    await new GramstaxStart().run(argv, dir)
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }
  return ``
}

const CACHE_FIXTURE = [`import {CacheExternal} from "~/cache/external"`, ``, `export class MyCache extends CacheExternal<unknown> {`, `  constructor() {`, `    super(\`memory\`, 1000, \`t\`)`, `  }`, `}`, ``, `export class NotACache {`, `}`, ``].join(`\n`)

const BOT_FIXTURE = [`import {Gramstax} from "~/core/bot"`, ``, `export class BotCore extends Gramstax {`, `}`, ``].join(`\n`)

const NOT_A_BOT_FIXTURE = [`export class NotABot {`, `}`, ``].join(`\n`)

const STUB_COPY_FIXTURE = [`export class Gramstax {}`, ``, `export class BotCore extends Gramstax {`, `}`, ``].join(`\n`)

function writeBotProject(dir: string, botFile: string = BOT_FIXTURE): void {
  const coreDir = join(dir, `src`, `core`)
  const pagesDir = join(dir, `src`, `pages`)
  mkdirSync(coreDir, {recursive: true})
  mkdirSync(pagesDir, {recursive: true})
  writeFileSync(join(coreDir, `bot.ts`), botFile, `utf-8`)
}

function pagesPosix(dir: string): string {
  return join(dir, `src`, `pages`).split(sep).join(`/`)
}

function bootConfig(dir: string, tokenValue: string, extra: string): string {
  return `export default {token: \`${tokenValue}\`, deploy: \`test\`, templateManager: {path: [\`${pagesPosix(dir)}\`]}${extra === `` ? `` : `, ${extra}`}}\n`
}

describe(`gramstax start config DATA fields`, () => {
  it(`accepts the full raw-data shape with defaults for omitted optionals`, async () => {
    const dir = makeTempDir()
    try {
      writeConfig(
        dir,
        `export default {token: \`test\`, deploy: \`webhook\`, optionsDeploy: {webhook: {url: \`https://example.com/hook\`, secretToken: \`test-secret\`, queue: {enabled: true, maxQueueSize: 100}}}, mediaRoots: [\`./backups\`], autoRetry: false, autoRetryOptions: {maxRetryAttempts: 2}, rateLimit: {windowMs: 1000, max: 5}, updateTimeoutMs: 1000, skipDuplicateUpdate: true, maxTextLength: 100, statusServerPort: 8080, statusServerHostname: \`127.0.0.1\`, optionsPage: {shortCallbackQueryData: true}}\n`
      )
      const config = await new GramstaxConfigLoader().loadConfig(dir)
      expect(config.token).toBe(`test`)
      expect(config.deploy).toBe(`webhook`)
      expect(config.mediaRoots).toEqual([`./backups`])
      expect(config.optionsDeploy?.webhook?.queue?.maxQueueSize).toBe(100)
      expect(config.autoRetry).toBe(false)
      expect(config.rateLimit?.max).toBe(5)
      expect(config.updateTimeoutMs).toBe(1000)
      expect(config.skipDuplicateUpdate).toBe(true)
      expect(config.optionsDeploy?.webhook?.secretToken).toBe(`test-secret`)
      expect(config.optionsDeploy?.webhook?.url).toBe(`https://example.com/hook`)
      expect(config.maxTextLength).toBe(100)
      expect(config.statusServerPort).toBe(8080)
      expect(config.optionsPage?.shortCallbackQueryData).toBe(true)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`defaults deploy to polling when omitted`, async () => {
    const dir = makeTempDir()
    try {
      writeConfig(dir, `export default {token: \`test\`}\n`)
      const config = await new GramstaxConfigLoader().loadConfig(dir)
      expect(config.deploy).toBe(`polling`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`accepts a literal token and an empty token at load with zero throw`, async () => {
    for (const body of [`export default {token: \`test\`}\n`, `export default {token: \`\`}\n`]) {
      const dir = makeTempDir()
      try {
        writeConfig(dir, body)
        const config = await new GramstaxConfigLoader().loadConfig(dir)
        expect(typeof config.token === `string` || config.token === undefined).toBe(true)
      } finally {
        rmSync(dir, {force: true, recursive: true})
      }
    }
  })

  it(`rejects wrong types and empty values with Invalid gramstax config`, async () => {
    const cases: Array<{body: string; field: string}> = [
      {body: `export default {token: 42}\n`, field: `token`},
      {body: `export default {deploy: 42}\n`, field: `deploy`},
      {body: `export default {deploy: \`\`}\n`, field: `deploy`},
      {body: `export default {mediaRoots: \`x\`}\n`, field: `mediaRoots`},
      {body: `export default {deploy: \`webhook\`, optionsDeploy: {webhook: {url: \`https://example.com/hook\`, secretToken: \`s\`, queue: {maxQueueSize: 0}}}}\n`, field: `maxQueueSize`},
      {body: `export default {deploy: \`webhook\`, optionsDeploy: {webhook: {url: \`https://example.com/hook\`, secretToken: \`s\`, queue: {workerCount: 0}}}}\n`, field: `workerCount`},
      {body: `export default {autoRetry: \`yes\`}\n`, field: `autoRetry`},
      {body: `export default {rateLimit: {windowMs: \`x\`, max: 1}}\n`, field: `windowMs`},
      {body: `export default {updateTimeoutMs: -1}\n`, field: `updateTimeoutMs`},
      {body: `export default {skipDuplicateUpdate: 1}\n`, field: `skipDuplicateUpdate`},
      {body: `export default {deploy: \`webhook\`, optionsDeploy: {webhook: {url: \`https://example.com/hook\`, secretToken: 42}}}\n`, field: `secretToken`},
      {body: `export default {maxTextLength: -1}\n`, field: `maxTextLength`},
      {body: `export default {statusServerPort: 99999}\n`, field: `statusServerPort`},
      {body: `export default {statusServerHostname: 42}\n`, field: `statusServerHostname`},
      {body: `export default {deploy: \`polling\`, optionsDeploy: {polling: {maxRetries: -2}}}\n`, field: `maxRetries`},
      {body: `export default {optionsPage: {shortCallbackQueryData: 1}}\n`, field: `shortCallbackQueryData`}
    ]
    for (const entry of cases) {
      const dir = makeTempDir()
      try {
        writeConfig(dir, entry.body)
        const message = await loadMessage(dir)
        expect(message).toContain(`Invalid gramstax config`)
        expect(message).toContain(entry.field)
      } finally {
        rmSync(dir, {force: true, recursive: true})
      }
    }
  })

  it(`rejects unknown top-level fields including manifest`, async () => {
    for (const field of [`bogus`, `manifest`]) {
      const dir = makeTempDir()
      try {
        writeConfig(dir, `export default {${field}: {}}\n`)
        const message = await loadMessage(dir)
        expect(message).toContain(`Invalid gramstax config`)
        expect(message).toContain(field)
      } finally {
        rmSync(dir, {force: true, recursive: true})
      }
    }
  })
})

describe(`gramstax start token rule`, () => {
  it(`missing token throws Token is not valid or empty verbatim`, async () => {
    const dir = makeTempDir()
    try {
      writeBotProject(dir)
      writeConfig(dir, `export default {deploy: \`test\`}\n`)
      const message = await startMessage(dir)
      expect(message).toBe(`Token is not valid or empty`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`empty token throws Token is not valid or empty verbatim`, async () => {
    const dir = makeTempDir()
    try {
      writeBotProject(dir)
      writeConfig(dir, `export default {token: \`\`, deploy: \`test\`}\n`)
      const message = await startMessage(dir)
      expect(message).toBe(`Token is not valid or empty`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`literal token boots`, async () => {
    const dir = makeTempDir()
    try {
      writeBotProject(dir)
      writeConfig(dir, bootConfig(dir, `test`, ``))
      const bot = await new GramstaxStart().boot([], dir)
      expect(bot.deployType).toBe(`test`)
      await bot.stop()
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`optionsDeploy.webhook passes straight through to params`, async () => {
    const dir = makeTempDir()
    try {
      mkdirSync(join(dir, `src`, `pages`), {recursive: true})
      const params = await new GramstaxStart()._buildParams({token: `test`, optionsDeploy: {webhook: {url: `https://example.com/hook`, secretToken: `test-secret`}}}, `test`, `test`, dir)
      expect(params.optionsDeploy).toEqual({webhook: {url: `https://example.com/hook`, secretToken: `test-secret`}})
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })
})

describe(`gramstax start path-ref materialization`, () => {
  it(`resolves {override: {module, export}} relative to cwd and boots`, async () => {
    const dir = makeTempDir()
    try {
      writeBotProject(dir)
      writeFileSync(join(dir, `cache.ts`), CACHE_FIXTURE, `utf-8`)
      writeConfig(dir, bootConfig(dir, `test`, `cacheSession: {override: {module: \`./cache.ts\`, export: \`MyCache\`}}`))
      const bot = await new GramstaxStart().boot([], dir)
      expect(bot.deployType).toBe(`test`)
      await bot.stop()
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`resolves a bare string via the default export with zero args`, async () => {
    const dir = makeTempDir()
    try {
      writeBotProject(dir)
      writeFileSync(join(dir, `cache-default.ts`), [`import {CacheExternal} from "~/cache/external"`, ``, `export default class DefaultCache extends CacheExternal<unknown> {`, `  constructor() {`, `    super(\`memory\`)`, `  }`, `}`, ``].join(`\n`), `utf-8`)
      writeConfig(dir, bootConfig(dir, `test`, `cacheSession: \`./cache-default.ts\``))
      const bot = await new GramstaxStart().boot([], dir)
      expect(bot.deployType).toBe(`test`)
      await bot.stop()
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`instanceof failures throw naming the slot and expected base`, async () => {
    const dir = makeTempDir()
    try {
      writeBotProject(dir)
      writeFileSync(join(dir, `cache.ts`), CACHE_FIXTURE, `utf-8`)
      writeConfig(dir, `export default {token: \`test\`, deploy: \`test\`, cacheSession: {override: {module: \`./cache.ts\`, export: \`NotACache\`}}}\n`)
      const message = await startMessage(dir)
      expect(message).toContain(`cacheSession`)
      expect(message).toContain(`CacheExternal`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`builds builtin cacheSession params into a CacheExternal`, async () => {
    const dir = makeTempDir()
    try {
      writeBotProject(dir)
      writeConfig(dir, bootConfig(dir, `test`, `cacheSession: {store: \`memory\`, ttlMs: 1000, namespace: \`s\`}`))
      const bot = await new GramstaxStart().boot([], dir)
      expect(bot.deployType).toBe(`test`)
      await bot.stop()
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })
})

describe(`gramstax start BotCore discovery`, () => {
  it(`missing src/core/bot.ts throws a clear error`, async () => {
    const dir = makeTempDir()
    try {
      writeConfig(dir, `export default {token: \`test\`, deploy: \`test\`}\n`)
      const message = await startMessage(dir)
      expect(message).toContain(`src`)
      expect(message).toContain(`bot.ts`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`discovers src/core/bot.js when bot.ts is absent (JS projects)`, async () => {
    const dir = makeTempDir()
    try {
      const coreDir = join(dir, `src`, `core`)
      const pagesDir = join(dir, `src`, `pages`)
      mkdirSync(coreDir, {recursive: true})
      mkdirSync(pagesDir, {recursive: true})
      const gramstaxBot = pathToFileURL(join(import.meta.dir, `..`, `src`, `core`, `bot.ts`)).href
      writeFileSync(join(coreDir, `bot.js`), [`import {Gramstax} from "${gramstaxBot}"`, ``, `export class BotCore extends Gramstax {`, `}`, ``].join(`\n`), `utf-8`)
      writeConfig(dir, `export default {token: \`test\`, deploy: \`test\`}\n`)
      const message = await startMessage(dir)
      expect(message).toBe(``)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`a file with no Gramstax subclass throws naming Gramstax`, async () => {
    const dir = makeTempDir()
    try {
      writeBotProject(dir, NOT_A_BOT_FIXTURE)
      writeConfig(dir, `export default {token: \`test\`, deploy: \`test\`}\n`)
      const message = await startMessage(dir)
      expect(message).toContain(`Gramstax`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`a subclass of a DIFFERENT Gramstax copy names both resolved locations`, async () => {
    const dir = makeTempDir()
    try {
      writeBotProject(dir, STUB_COPY_FIXTURE)
      writeConfig(dir, `export default {token: \`test\`, deploy: \`test\`}\n`)
      const message = await startMessage(dir)
      expect(message).toContain(join(dir, `src`, `core`, `bot.ts`))
      expect(message).toContain(`gramstax`)
      expect(message).toContain(`two`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`the mismatch hint points at tsconfig paths vs dist`, async () => {
    const dir = makeTempDir()
    try {
      writeBotProject(dir, STUB_COPY_FIXTURE)
      writeConfig(dir, `export default {token: \`test\`, deploy: \`test\`}\n`)
      const message = await startMessage(dir)
      expect(message).toContain(`tsconfig`)
      expect(message).toContain(`dist`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })
})

describe(`gramstax start deploy precedence`, () => {
  it(`--deploy beats config deploy`, async () => {
    const start = new GramstaxStart()
    expect(start._resolveDeploy(`webhook`, `polling`)).toBe(`webhook`)
    expect(start._resolveDeploy(undefined, `polling`)).toBe(`polling`)
    expect(start._resolveDeploy(undefined, undefined)).toBe(`polling`)
  })

  it(`--deploy with a colon throws naming the new form`, async () => {
    const start = new GramstaxStart()
    expect(() => start._resolveDeploy(`webhook:https://example.com/hook`, `polling`)).toThrow(/optionsDeploy/)
    expect(() => start._parseArgv([`--deploy`, `webhook:https://example.com/hook`])).toThrow(/optionsDeploy/)
  })

  it(`--deploy parses from argv`, async () => {
    const start = new GramstaxStart()
    expect(start._parseArgv([`--deploy`, `polling`]).deploy).toBe(`polling`)
    expect(start._parseArgv([`--watch`]).watch).toBe(true)
  })
})

describe(`gramstax build workers guardrail`, () => {
  it(`warns naming ignored override slots on cloudflare-workers`, async () => {
    const {GramstaxBuild} = await import(`~/cli/build`)
    const dir = makeTempDir()
    try {
      const {cpSync, readFileSync, readdirSync, statSync, writeFileSync} = await import(`node:fs`)
      const {pathToFileURL} = await import(`node:url`)
      cpSync(join(import.meta.dir, `fixtures`, `manifest`, `pages`), join(dir, `src`, `pages`), {recursive: true})
      const ctxAbs = pathToFileURL(join(import.meta.dir, `..`, `src`, `core`, `ctx.ts`)).href
      const walk = (dirPath: string): void => {
        for (const entry of readdirSync(dirPath)) {
          const full = join(dirPath, entry)
          if (statSync(full).isDirectory()) {
            walk(full)
            continue
          }
          if (full.endsWith(`.ts`) === false) continue
          writeFileSync(full, readFileSync(full, `utf-8`).replaceAll(`~/core/ctx`, ctxAbs))
        }
      }
      walk(join(dir, `src`, `pages`))
      writeConfig(dir, `export default {token: \`test\`, deploy: \`serverless\`, optionsDeploy: {serverless: {adapter: \`cloudflare-mod\`, url: \`https://example.com/webhook\`, secretToken: \`test-secret\`}}, cacheSession: {store: \`memory\`}}\n`)
      const warned: string[] = []
      const originalLog = console.log
      console.log = (...args: unknown[]): void => {
        warned.push(args.map((arg) => String(arg)).join(` `))
      }
      try {
        await new GramstaxBuild().run([`--target`, `cloudflare-workers`], dir)
      } finally {
        console.log = originalLog
      }
      expect(warned.join(`\n`)).toContain(`cacheSession`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })
})
