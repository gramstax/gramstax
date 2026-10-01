import {existsSync} from "node:fs"
import {createRequire} from "node:module"
import {join, resolve} from "node:path"
import {fileURLToPath, pathToFileURL} from "node:url"
import {watch} from "chokidar"
import type {IGramstaxParams} from "~/types/bot"
import type {IGramstaxBotClass, IGramstaxStartOptions} from "~/types/cli"
import type {IGramstaxCacheKeyboardRef, IGramstaxCacheSessionRef, IGramstaxConfig, IGramstaxLogRef, IGramstaxModuleRef, IGramstaxPathRef, IGramstaxSessionLockRef, IGramstaxTemplateManagerRef} from "~/types/config"
import type {ISessionLockOptions} from "~/types/session-lock"
import {CacheExternal} from "../cache/external"
import {Gramstax} from "../core/bot"
import type {Ctx} from "../core/ctx"
import {log as defaultLog, LoggingHelper, log} from "../helpers/log"
import {TemplateManager} from "../template/manager"
import {GramstaxConfigLoader} from "./config"

export class GramstaxStart {
  async run(argv: string[], cwd: string = process.cwd()): Promise<number> {
    const options = this._parseArgv(argv)
    const bot = await this.boot(argv, cwd)
    if (options.watch === true) {
      this._watch(cwd, argv, bot)
    }
    return 0
  }

  async boot(argv: string[], cwd: string = process.cwd()): Promise<Gramstax> {
    const options = this._parseArgv(argv)
    const config: IGramstaxConfig = await new GramstaxConfigLoader().loadConfig(cwd)
    const token = this._resolveToken(config)
    const deploy = this._resolveDeploy(options.deploy, config.deploy)
    const BotCore = await this._discoverBotCore(cwd)
    const params = await this._buildParams(config, token, deploy, cwd)
    return new BotCore(params)
  }

  _resolveToken(config: IGramstaxConfig): string {
    // Empty allowed at load since `process.env.X ?? ""` yields `""` when unset and env-less `gramstax build` must keep working; start enforces non-empty here.
    const token = config.token ?? ``
    if (token.length === 0) {
      throw new Error(`Token is not valid or empty`)
    }
    return token
  }

  _resolveDeploy(flag: string | undefined, configured: IGramstaxConfig[`deploy`]): IGramstaxParams[`deploy`] {
    if (flag !== undefined && flag.includes(`:`)) {
      throw new Error(`gramstax start: --deploy must be one of polling, webhook, serverless, raw, test with optionsDeploy {serverless, webhook, polling, raw, test} from gramstax.config.ts (legacy colon forms are removed, got "${flag}")`)
    }
    const deploy = flag ?? configured ?? `polling`
    if (deploy === `polling` || deploy === `webhook` || deploy === `serverless` || deploy === `raw` || deploy === `test`) {
      return deploy
    }
    throw new Error(`gramstax start: --deploy / config deploy must be one of polling, webhook, serverless, raw, test (got "${deploy}")`)
  }

  async _discoverBotCore(cwd: string): Promise<IGramstaxBotClass> {
    const candidates = [join(cwd, `src`, `core`, `bot.ts`), join(cwd, `src`, `core`, `bot.js`)]
    const file = candidates.find((candidate) => existsSync(candidate))
    if (file === undefined) {
      throw new Error(`gramstax start: BotCore not found — missing file ${candidates[0]} (or .js equivalent; expected a Gramstax subclass export)`)
    }
    const loaded: Record<string, unknown> = await import(pathToFileURL(file).href).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error)
      throw new Error(`gramstax start: cannot load ${file} (${detail})`)
    })
    for (const value of Object.values(loaded)) {
      if (typeof value === `function` && (value as {prototype?: unknown}).prototype instanceof Gramstax) {
        return value as IGramstaxBotClass
      }
    }
    throw new Error(
      `gramstax start: no Gramstax subclass export found in ${file} (export a class extending Gramstax, e.g. BotCore) — CLI gramstax entry is ${this._cliGramstaxEntry()} (likely cause: two gramstax copies, e.g. tsconfig \`paths\` redirecting the bot file to source while the CLI runs from dist)`
    )
  }

  _cliGramstaxEntry(): string {
    try {
      return createRequire(import.meta.url).resolve(`gramstax`)
    } catch {
      return fileURLToPath(new URL(`../index.js`, import.meta.url).href)
    }
  }

  async _buildParams(config: IGramstaxConfig, token: string, deploy: IGramstaxParams[`deploy`], cwd: string): Promise<IGramstaxParams> {
    const params: IGramstaxParams = {deploy, token}
    if (config.optionsDeploy !== undefined) params.optionsDeploy = config.optionsDeploy
    if (config.mediaRoots !== undefined) params.mediaRoots = config.mediaRoots
    if (config.botConfig !== undefined) params.botConfig = config.botConfig
    const cacheSession = await this._materializeCacheSession(config.cacheSession, cwd)
    if (cacheSession !== undefined) params.cacheSession = cacheSession
    const cacheKeyboard = await this._materializeCacheKeyboard(config.cacheKeyboard, cwd)
    if (cacheKeyboard !== undefined) params.cacheKeyboard = cacheKeyboard
    const templateManager = await this._materializeTemplateManager(config.templateManager, cwd)
    params.templateManager = templateManager ?? new TemplateManager({path: [join(cwd, `src`, `pages`)]})
    const log = await this._materializeLog(config.log, cwd)
    if (log !== undefined) params.log = log
    const sessionLock = await this._materializeSessionLock(config.sessionLock, cwd)
    if (sessionLock !== undefined) params.sessionLock = sessionLock
    if (config.autoRetry !== undefined) params.autoRetry = config.autoRetry
    if (config.autoRetryOptions !== undefined) params.autoRetryOptions = config.autoRetryOptions
    if (config.rateLimit !== undefined) params.rateLimit = config.rateLimit
    if (config.throttle !== undefined) params.throttle = config.throttle
    if (config.updateTimeoutMs !== undefined) params.updateTimeoutMs = config.updateTimeoutMs
    if (config.skipDuplicateUpdate !== undefined) params.skipDuplicateUpdate = config.skipDuplicateUpdate
    if (config.maxTextLength !== undefined) params.maxTextLength = config.maxTextLength
    if (config.statusServerPort !== undefined) params.statusServerPort = config.statusServerPort
    if (config.statusServerHostname !== undefined) params.statusServerHostname = config.statusServerHostname
    if (config.optionsPage !== undefined) params.optionsPage = config.optionsPage
    return params
  }

  async _loadModule(file: string, slot: string): Promise<Record<string, unknown>> {
    const loaded: Record<string, unknown> = await import(pathToFileURL(file).href).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error)
      throw new Error(`gramstax start: cannot load \`${slot}\` module ${file} (${detail})`)
    })
    return loaded
  }

  async _resolveExport(ref: IGramstaxPathRef, cwd: string, slot: string): Promise<{label: string; value: unknown}> {
    if (typeof ref === `string`) {
      const file = resolve(cwd, ref)
      const mod = await this._loadModule(file, slot)
      if (mod.default === undefined) {
        throw new Error(`gramstax start: invalid \`${slot}\` from ${ref} — module has no default export`)
      }
      return {label: ref, value: mod.default}
    }
    const file = resolve(cwd, ref.override.module)
    const mod = await this._loadModule(file, slot)
    const name = ref.override.export ?? `default`
    const value = name === `default` ? (mod.default ?? Object.values(mod)[0]) : mod[name]
    if (value === undefined) {
      throw new Error(`gramstax start: invalid \`${slot}\` from ${ref.override.module} — no export named \`${name}\``)
    }
    return {label: `${ref.override.module}#${name}`, value}
  }

  _buildOrUse<T>(exported: unknown, args: unknown[], slot: string, label: string, Expected: new (...ctorArgs: never[]) => T): T {
    const instance: unknown = typeof exported === `function` ? new (exported as new (...ctorArgs: unknown[]) => T)(...args) : exported
    if (instance instanceof Expected === false) {
      throw new Error(`gramstax start: invalid \`${slot}\` from ${label} — expected instance of ${Expected.name}`)
    }
    return instance
  }

  _refArgs(ref: IGramstaxPathRef): unknown[] {
    if (typeof ref === `string`) return []
    return ref.override.args ?? []
  }

  _isBareModuleRef(value: unknown): boolean {
    return typeof value === `object` && value !== null && Array.isArray(value) === false && typeof (value as Record<string, unknown>).module === `string`
  }

  _isModuleRef(value: unknown): value is {override: IGramstaxModuleRef} {
    if (typeof value !== `object` || value === null || Array.isArray(value) === true) return false
    const override = (value as Record<string, unknown>).override
    return typeof override === `object` && override !== null && Array.isArray(override) === false && typeof (override as Record<string, unknown>).module === `string`
  }

  async _materializeCacheSession(value: IGramstaxCacheSessionRef | undefined, cwd: string): Promise<CacheExternal | undefined> {
    if (value === undefined) return undefined
    if (this._isBareModuleRef(value)) {
      throw new Error(`gramstax start: invalid \`cacheSession\` — bare {module, ...} was removed, use {override: {module, ...}}`)
    }
    if (typeof value === `string` || this._isModuleRef(value)) {
      const resolved = await this._resolveExport(value, cwd, `cacheSession`)
      return this._buildOrUse(resolved.value, this._refArgs(value), `cacheSession`, resolved.label, CacheExternal)
    }
    return new CacheExternal(value.store, value.ttlMs, value.namespace)
  }

  async _materializeCacheKeyboard(value: IGramstaxCacheKeyboardRef | undefined, cwd: string): Promise<Map<string, unknown> | undefined> {
    if (value === undefined) return undefined
    if (this._isBareModuleRef(value)) {
      throw new Error(`gramstax start: invalid \`cacheKeyboard\` — bare {module, ...} was removed, use {override: {module, ...}}`)
    }
    if (typeof value === `string` || this._isModuleRef(value)) {
      const resolved = await this._resolveExport(value, cwd, `cacheKeyboard`)
      return this._buildOrUse<Map<string, unknown>>(resolved.value, this._refArgs(value), `cacheKeyboard`, resolved.label, Map as unknown as new (...ctorArgs: never[]) => Map<string, unknown>)
    }
    if (Array.isArray(value) === true) return new Map<string, unknown>(value)
    return new Map<string, unknown>(Object.entries(value))
  }

  async _materializeTemplateManager(value: IGramstaxTemplateManagerRef | undefined, cwd: string): Promise<TemplateManager | undefined> {
    if (value === undefined) return undefined
    if (this._isBareModuleRef(value)) {
      throw new Error(`gramstax start: invalid \`templateManager\` — bare {module, ...} was removed, use {override: {module, ...}}`)
    }
    if (typeof value === `string` || this._isModuleRef(value)) {
      const resolved = await this._resolveExport(value, cwd, `templateManager`)
      return this._buildOrUse(resolved.value, this._refArgs(value), `templateManager`, resolved.label, TemplateManager)
    }
    return new TemplateManager(value)
  }

  async _materializeLog(value: IGramstaxLogRef | undefined, cwd: string): Promise<LoggingHelper | undefined> {
    if (value === undefined || value === false) return undefined
    if (value === true) return defaultLog
    if (this._isBareModuleRef(value)) {
      throw new Error(`gramstax start: invalid \`log\` — bare {module, ...} was removed, use {override: {module, ...}}`)
    }
    if (typeof value === `string` || this._isModuleRef(value)) {
      const resolved = await this._resolveExport(value, cwd, `log`)
      return this._buildOrUse(resolved.value, this._refArgs(value), `log`, resolved.label, LoggingHelper)
    }
    return new LoggingHelper(value)
  }

  async _materializeSessionLock(value: IGramstaxSessionLockRef | undefined, cwd: string): Promise<ISessionLockOptions | undefined> {
    if (value === undefined) return undefined
    const lock: ISessionLockOptions = {}
    if (value.enabled !== undefined) lock.enabled = value.enabled
    if (value.leaseMs !== undefined) lock.leaseMs = value.leaseMs
    if (value.onContended !== undefined) lock.onContended = value.onContended
    if (value.key !== undefined) {
      if (this._isBareModuleRef(value.key)) {
        throw new Error(`gramstax start: invalid \`sessionLock.key\` — bare {module, ...} was removed, use {override: {module, ...}}`)
      }
      if (typeof value.key !== `string` && value.key.override.args !== undefined) {
        throw new Error(`gramstax start: invalid \`sessionLock.key.override.args\` — args are not supported, the ref must resolve to a \`(ctx) => string\` factory`)
      }
      const resolved = await this._resolveExport(value.key, cwd, `sessionLock.key`)
      if (typeof resolved.value !== `function` || /^\s*class[\s{]/.test(Function.prototype.toString.call(resolved.value))) {
        throw new Error(`gramstax start: invalid \`sessionLock.key\` from ${resolved.label} — expected a \`(ctx) => string\` factory function`)
      }
      lock.key = resolved.value as (ctx: Ctx) => string
    }
    return lock
  }

  _watch(cwd: string, argv: string[], bot: Gramstax): void {
    const dir = join(cwd, `src`)
    log.info(`gramstax start: watching ${dir} for changes..`)
    let current = bot
    let restarting = false
    watch(dir, {ignoreInitial: true}).on(`all`, () => {
      if (restarting === true) return
      restarting = true
      void (async () => {
        log.info(`gramstax start: change detected, restarting..`)
        try {
          await current.stop()
        } catch {
          // Old instance may already be stopped — restart anyway.
        }
        try {
          current = await this.boot(argv, cwd)
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          log.error(message)
        }
        restarting = false
      })()
    })
  }

  _parseArgv(argv: string[]): IGramstaxStartOptions {
    const options: IGramstaxStartOptions = {}
    let index = 0
    while (index < argv.length) {
      const arg = argv[index] ?? ``
      const [flag, inlineValue] = arg.split(`=`)
      if (flag === `--deploy`) {
        const value = inlineValue ?? argv[index + 1] ?? ``
        if (value.includes(`:`)) {
          throw new Error(`gramstax start: --deploy must be one of polling, webhook, serverless, raw, test with optionsDeploy {serverless, webhook, polling, raw, test} from gramstax.config.ts (legacy colon forms are removed, got "${value}")`)
        }
        options.deploy = value
        index += inlineValue === undefined ? 2 : 1
      } else if (flag === `--watch`) {
        options.watch = true
        index += 1
      } else {
        throw new Error(`gramstax start: unknown option ${arg}`)
      }
    }
    return options
  }
}
