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
import {loadProjectEnv} from "./env"

export class GramstaxStart {
  /**
   * Boot the bot and, with `--watch`, keep it in sync with `<cwd>/src`.
   *
   * @remarks
   * The watcher is attached only after `boot` resolves, so a failed boot reports
   * its own error instead of being masked by a restart loop. Returning before the
   * watcher finishes is intentional — the process stays alive through the
   * chokidar handle, not through this promise. This method is the target of the
   * `start` Commander action, which copies its return value into `process.exitCode`.
   *
   * @param argv - Positional flag list from the Commander action, parsed for `--deploy` and `--watch`.
   * @param cwd - Absolute project root holding `gramstax.config.ts` and `src`.
   * @returns `0` once the bot is booted and the optional watcher is attached.
   *
   * @defaultValue `process.cwd()`
   *
   * @public
   */
  async run(argv: string[], cwd: string = process.cwd()): Promise<number> {
    const options = this._parseArgv(argv)
    const bot = await this.boot(argv, cwd)
    if (options.watch === true) {
      this._watch(cwd, argv, bot)
    }
    return 0
  }

  /**
   * Boot the bot: load config, discover the subclass, and construct it.
   *
   * @remarks
   * Construction *is* boot — there is no separate `run()` step. Exposed separately
   * from `run` because the `--watch` restarter needs to build a fresh instance
   * without re-parsing flags or re-attaching a watcher. The published CLI runs on
   * Bun: the discovered bot file is imported through a `file://` URL, and Bun loads
   * the TypeScript source directly.
   *
   * @param argv - Positional flag list from the Commander action, parsed for `--deploy`.
   * @param cwd - Absolute project root holding `gramstax.config.ts` and `src/core/bot.ts`.
   * @returns The constructed, already-started `Gramstax` instance.
   *
   * @defaultValue `process.cwd()`
   *
   * @example
   * ```typescript
   * const bot = await new GramstaxStart().boot([], projectRoot)
   * ```
   *
   * @public
   */
  async boot(argv: string[], cwd: string = process.cwd()): Promise<Gramstax> {
    loadProjectEnv(cwd)
    const options = this._parseArgv(argv)
    const config: IGramstaxConfig = await new GramstaxConfigLoader().loadConfig(cwd)
    const token = this._resolveToken(config)
    const deploy = this._resolveDeploy(options.deploy, config.deploy)
    const BotCore = await this._discoverBotCore(cwd)
    const params = await this._buildParams(config, token, deploy, cwd)
    return new BotCore(params)
  }

  /**
   * Read the bot token off the config and require it to be non-empty.
   *
   * @remarks
   * Config validation deliberately allows an empty token so the common
   * `process.env.X ?? ""` pattern works and an env-less `gramstax build` keeps
   * working; enforcing non-emptiness here means only `gramstax start`, which
   * actually needs the token, rejects it.
   *
   * @param config - The validated config.
   * @returns The token string.
   *
   * @throws Error when the config has no token or the token is empty.
   *
   * @internal
   */
  _resolveToken(config: IGramstaxConfig): string {
    // Empty allowed at load since `process.env.X ?? ""` yields `""` when unset and env-less `gramstax build` must keep working; start enforces non-empty here.
    const token = config.token ?? ``
    if (token.length === 0) {
      throw new Error(`Token is not valid or empty`)
    }
    return token
  }

  /**
   * Decide the effective deploy mode from the flag and the config.
   *
   * @remarks
   * Precedence is flag, then config, then `polling`. A colon in the flag is rejected
   * separately from the membership check below, because the legacy
   * `webhook:<url>` grammar would otherwise be reported as merely "not one of the
   * five modes" and the reader would have no way to guess what replaced it.
   *
   * @param flag - Value of `--deploy`, or `undefined` when the flag is absent.
   * @param configured - The `deploy` key from the config, or `undefined` when unset.
   * @returns One of `polling`, `webhook`, `serverless`, `raw` or `test`.
   *
   * @throws Error when the flag uses the removed colon grammar.
   * @throws Error when the resolved mode is not one of the five supported modes.
   *
   * @internal
   */
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

  /**
   * Load the project's `Gramstax` subclass from `<cwd>/src/core/bot.ts`.
   *
   * @remarks
   * Convention-based discovery: the file is fixed, but the export name is not — any
   * export whose prototype extends `Gramstax` is accepted, so `BotCore`, `App`, or
   * any other name works. The `.js` variant is tried second for projects compiled
   * ahead of time. The no-subclass error deliberately names the CLI's own resolved
   * entry, because the usual cause is two copies of gramstax in play (a `paths`
   * redirect sending the bot file to source while the CLI runs from `dist`), which
   * makes the `instanceof` check fail despite the class looking correct.
   *
   * @param cwd - Absolute project root searched for `src/core/bot.ts` or `src/core/bot.js`.
   * @returns The discovered `Gramstax` subclass constructor.
   *
   * @throws Error when neither candidate file exists.
   * @throws Error when the file cannot be imported.
   * @throws Error when the file exports no `Gramstax` subclass.
   *
   * @internal
   */
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

  /**
   * Report which `gramstax` entry the running CLI resolved, for diagnostics.
   *
   * @remarks
   * Uses module resolution so the printed path is the one the CLI itself loaded;
   * falls back to `../index.js` relative to this module when the bare specifier
   * cannot be resolved, which happens in a linked or workspace layout. The value
   * only ever reaches an error message.
   *
   * @returns Absolute path or resolved specifier of the CLI's own `gramstax` entry.
   *
   * @internal
   */
  _cliGramstaxEntry(): string {
    try {
      return createRequire(import.meta.url).resolve(`gramstax`)
    } catch {
      return fileURLToPath(new URL(`../index.js`, import.meta.url).href)
    }
  }

  /**
   * Assemble the constructor params for the project `Gramstax` subclass.
   *
   * @remarks
   * The config file holds refs and plain data, so this is where they cross over
   * into instances. Every optional key is copied only when the config set it,
   * because `Gramstax` treats an absent key differently from an explicit
   * `undefined` in several slots. The one exception is `templateManager`: it
   * always receives a value, defaulting to a `TemplateManager` rooted at
   * `<cwd>/src/pages`, since page templates are required outside `deploy: "raw"`.
   *
   * @param config - The validated config loaded from `gramstax.config.ts`.
   * @param token - Resolved bot token, already checked for non-emptiness.
   * @param deploy - Resolved deploy mode, after applying the `--deploy` flag.
   * @param cwd - Absolute project root that ref paths and default template paths resolve against.
   * @returns The params object handed to the discovered `Gramstax` subclass constructor.
   *
   * @internal
   */
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

  /**
   * Dynamically import a module file and tag failures with the slot it came from.
   *
   * @remarks
   * The raw import rejection (bad syntax, missing dependency) says nothing about
   * which config entry caused it, so it is rewrapped with the slot name and path.
   *
   * @param file - Absolute path of the module to import.
   * @param slot - Config slot name, used in the error message.
   * @returns The imported module namespace object.
   *
   * @throws Error when the module cannot be imported.
   *
   * @internal
   */
  async _loadModule(file: string, slot: string): Promise<Record<string, unknown>> {
    const loaded: Record<string, unknown> = await import(pathToFileURL(file).href).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error)
      throw new Error(`gramstax start: cannot load \`${slot}\` module ${file} (${detail})`)
    })
    return loaded
  }

  /**
   * Import a module-ref target and pick the export the ref names.
   *
   * @remarks
   * A bare path string must have a default export; the `{override: {export: "..."}}`
   * form names an export explicitly and falls back to `default` — then to the first
   * export of the module — when `export` is omitted. The returned `label` is what
   * callers pass to `_buildOrUse` so a type mismatch names the exact file and
   * export the user wrote.
   *
   * @param ref - A module ref: a path string or `{override: {module, export?, args?}}`.
   * @param cwd - Absolute project root that the module path resolves against.
   * @param slot - Config slot name, used in the error message.
   * @returns The `{label, value}` pair, where `label` is `path` or `path#exportName`.
   *
   * @throws Error when the module cannot be imported.
   * @throws Error when a bare path string has no default export.
   * @throws Error when the named export is missing.
   *
   * @internal
   */
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

  /**
   * Accept either a ready instance or a constructor export, and type-check the result.
   *
   * @remarks
   * Lets a module export either an already-constructed singleton or the class
   * itself, so authors are not forced to instantiate at module scope. The
   * `instanceof` check is the only thing standing between a config typo and a
   * `TypeError` deep inside boot, so it runs even for the constructor path.
   *
   * @typeParam T - The expected instance type.
   *
   * @param exported - The resolved export: an instance, or a constructor to call.
   * @param args - Constructor arguments, forwarded only when `exported` is a function.
   * @param slot - Config slot name, used in the error message.
   * @param label - Human-readable origin of the value (module path, or `path#export`), used in the error message.
   * @param Expected - Constructor whose `prototype` the result must be an instance of.
   * @returns The value, guaranteed to be an instance of `Expected`.
   *
   * @throws Error when the result is not an instance of `Expected`.
   *
   * @internal
   */
  _buildOrUse<T>(exported: unknown, args: unknown[], slot: string, label: string, Expected: new (...ctorArgs: never[]) => T): T {
    const instance: unknown = typeof exported === `function` ? new (exported as new (...ctorArgs: unknown[]) => T)(...args) : exported
    if (instance instanceof Expected === false) {
      throw new Error(`gramstax start: invalid \`${slot}\` from ${label} - expected instance of ${Expected.name}`)
    }
    return instance
  }

  /**
   * Read the constructor arguments declared on a module ref.
   *
   * @remarks
   * A bare path string carries no arguments, so it yields an empty list — the
   * shape `_buildOrUse` expects for a constructor export.
   *
   * @param ref - A module ref: either a path string or `{override: {module, export?, args?}}`.
   * @returns The declared `args`, or an empty array when none were given.
   *
   * @internal
   */
  _refArgs(ref: IGramstaxPathRef): unknown[] {
    if (typeof ref === `string`) return []
    return ref.override.args ?? []
  }

  /**
   * Detect the removed bare `{module, ...}` config form.
   *
   * @remarks
   * Every `_*materialize*` method calls this first purely to raise a targeted
   * error naming the correct replacement, instead of letting the value fall
   * through to a generic "must be an object" message from validation.
   *
   * @param value - Candidate config value.
   * @returns `true` when `value` is a non-array object with a string `module` key.
   *
   * @internal
   */
  _isBareModuleRef(value: unknown): boolean {
    return typeof value === `object` && value !== null && Array.isArray(value) === false && typeof (value as Record<string, unknown>).module === `string`
  }

  /**
   * Narrow a value to the `{override: {module, ...}}` module-ref shape.
   *
   * @remarks
   * Checks the `override` wrapper rather than a top-level `module` key, which is
   * how the removed bare form is told apart from the supported one. Returns a
   * type predicate so callers can read `ref.override` without a cast.
   *
   * @param value - Candidate config value.
   * @returns `true` when `value` is a non-array object whose `override` carries a string `module`.
   *
   * @internal
   */
  _isModuleRef(value: unknown): value is {override: IGramstaxModuleRef} {
    if (typeof value !== `object` || value === null || Array.isArray(value) === true) return false
    const override = (value as Record<string, unknown>).override
    return typeof override === `object` && override !== null && Array.isArray(override) === false && typeof (override as Record<string, unknown>).module === `string`
  }

  /**
   * Turn the `cacheSession` config value into a `CacheExternal` instance.
   *
   * @remarks
   * An inline `{store, ttlMs?, namespace?}` object is passed straight to the
   * `CacheExternal` constructor; a module ref must resolve to a `CacheExternal`
   * instance or a constructor for one, with `override.args` forwarded as
   * constructor arguments.
   *
   * @param value - The `cacheSession` config value: store options or a module ref.
   * @param cwd - Absolute project root that a module-ref path resolves against.
   * @returns A `CacheExternal`, or `undefined` when unset.
   *
   * @throws Error when the value uses the removed bare `{module, ...}` form.
   * @throws Error when a module ref does not yield a `CacheExternal`.
   *
   * @internal
   */
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

  /**
   * Turn the `cacheKeyboard` config value into a `Map`.
   *
   * @remarks
   * Two inline shapes are accepted and normalized to the same `Map`: an entries
   * array, or a plain object whose keys become the map keys. A module ref must
   * resolve to a `Map` instance (or a constructor for one), which is why the
   * `Map` constructor is passed as the expected type.
   *
   * @param value - The `cacheKeyboard` config value: entries array, plain object, or module ref.
   * @param cwd - Absolute project root that a module-ref path resolves against.
   * @returns A `Map` of cached keyboards, or `undefined` when unset.
   *
   * @throws Error when the value uses the removed bare `{module, ...}` form.
   * @throws Error when a module ref does not yield a `Map`.
   *
   * @internal
   */
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

  /**
   * Turn the `templateManager` config value into a `TemplateManager` instance.
   *
   * @remarks
   * Returns `undefined` when unset so `_buildParams` can substitute its own
   * default rooted at `<cwd>/src/pages` — that default lives in the caller
   * because it needs `cwd`, which this method only forwards to module resolution.
   *
   * @param value - The `templateManager` config value: template options or a module ref.
   * @param cwd - Absolute project root that a module-ref path resolves against.
   * @returns A `TemplateManager` built from the value, or `undefined` when unset.
   *
   * @throws Error when the value uses the removed bare `{module, ...}` form.
   * @throws Error when a module ref does not yield a `TemplateManager`.
   *
   * @internal
   */
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

  /**
   * Turn the `log` config value into a `LoggingHelper` instance.
   *
   * @remarks
   * The only slot with a boolean shorthand: `true` reuses the shared default
   * logger and `false` disables logging by yielding `undefined`. Inline option
   * objects are wrapped in a fresh `LoggingHelper`; module refs are resolved and
   * constructed through `_buildOrUse`.
   *
   * @param value - The `log` config value: a boolean, logger options, or a module ref.
   * @param cwd - Absolute project root that a module-ref path resolves against.
   * @returns A `LoggingHelper`, the shared default logger for `true`, or `undefined` when unset or `false`.
   *
   * @throws Error when the value uses the removed bare `{module, ...}` form.
   * @throws Error when a module ref does not yield a `LoggingHelper`.
   *
   * @internal
   */
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

  /**
   * Turn the `sessionLock` config value into a runtime lock options object.
   *
   * @remarks
   * Unlike the other slots this one resolves to a plain options object, not an
   * instance — the lock is created later per session. `key` is the one nested ref:
   * it must resolve to a plain `(ctx) => string` factory, so `override.args` is
   * rejected (there is nothing to construct) and a `class` is rejected by matching
   * its source text, since calling a class without `new` would throw far from the
   * config mistake that caused it.
   *
   * @param value - The `sessionLock` config value, or `undefined` when unset.
   * @param cwd - Absolute project root that a module-ref `key` resolves against.
   * @returns A lock options object with only the keys the config set, or `undefined` when `value` is unset.
   *
   * @throws Error when `key` uses the removed bare `{module, ...}` form.
   * @throws Error when `key.override.args` is supplied.
   * @throws Error when `key` does not resolve to a plain function.
   *
   * @internal
   */
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

  /**
   * Watch `<cwd>/src` and re-boot the bot on every change.
   *
   * @remarks
   * Restarting constructs a whole new instance rather than patching the existing
   * one, since page modules and templates are cached inside the instance. The
   * `restarting` latch coalesces the burst of events a single editor save produces
   * into one restart. A `stop()` failure is swallowed — the old instance may
   * already be down — but a failed re-boot is logged and leaves the previous
   * `current` in place so the next change can retry. `ignoreInitial` keeps the
   * initial scan from triggering a restart.
   *
   * @param cwd - Absolute project root; `<cwd>/src` is the watched directory.
   * @param argv - Flag list replayed on each restart so the new instance boots with the same options.
   * @param bot - The already-booted instance to stop before the first restart.
   *
   * @internal
   */
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

  /**
   * Parse `gramstax start` flags into an options object.
   *
   * @remarks
   * Accepts both `--deploy mode` and `--deploy=mode`. A value containing `:` is
   * rejected here with a message naming the replacement nested `optionsDeploy`
   * shape, because the legacy colon grammar fails later with a far less obvious
   * error. `run` and `boot` each parse independently, so the colon check runs
   * twice per invocation — deliberate, since `boot` is also called directly by
   * the watcher and by tests without going through `run`.
   *
   * @param argv - Positional flag list forwarded from the Commander action in `create`.
   * @returns The parsed options; an empty object boots with config defaults and no watcher.
   *
   * @throws Error when `argv` contains an unrecognized option.
   * @throws Error when the `--deploy` value uses the removed colon grammar.
   *
   * @internal
   */
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
