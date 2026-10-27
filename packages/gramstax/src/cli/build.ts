import {existsSync, readFileSync, rmSync} from "node:fs"
import {join, resolve} from "node:path"
import {pathToFileURL} from "node:url"
import {log} from "~/helpers/log"
import type {IGramstaxBuildOptions, IGramstaxBuildPlan, IServerlessRef, IServerlessSlot} from "~/types/cli"
import type {IGramstaxConfig} from "~/types/config"
import {GRAMSTAX_SERVERLESS_ADAPTERS} from "~/types/config"
import {generate} from "../../scripts/build-manifest"
import {GramstaxConfigLoader} from "./config"
import {loadProjectEnv} from "./env"
import {LambdaTarget} from "./targets/lambda"
import {WorkerTarget} from "./targets/worker"

const BUILD_TARGETS: string[] = [...GRAMSTAX_SERVERLESS_ADAPTERS]

const EDGE_SAFE_SCALAR_SLOTS = [`autoRetry`, `autoRetryOptions`, `maxTextLength`, `skipDuplicateUpdate`, `updateTimeoutMs`] as const
const EDGE_SAFE_OBJECT_SLOTS = [`optionsPage`, `rateLimit`, `throttle`] as const

const HOST_DEPENDENT_REASONS: Record<string, string> = {
  mediaRoots: "it jails local file paths; the deployed entry has no filesystem to jail against",
  sessionLock: "it needs a redis client over TCP, which neither edge isolates nor a bundled lambda entry provide",
  statusServerHostname: "there is no status server in a deployed entry",
  statusServerPort: "there is no status server in a deployed entry",
  templateManager: "it resolves template files from disk; the deployed entry uses the frozen manifest instead"
}

const REF_SLOTS: ReadonlyArray<IServerlessSlot> = [`cacheSession`, `cacheKeyboard`, `log`]

/**
 * A config slot pointing at a user module. The emitted entry imports it with a
 * static top-level import so the platform bundler resolves (and compiles) it at
 * build time rather than at first request.
 */


/**
 * Whether a `log` config object would write to disk rather than stdout.
 *
 * @remarks
 * Drives both the `_edgeSafeParams` passthrough filter and the `_droppedSlots`
 * warning: a file logger is meaningless in a deployed entry, a console one is not.
 *
 * @param value - The `log` config object.
 * @returns `true` when `pathFile` is present or `force` is `file` or `all`.
 *
 * @internal
 */
const logWritesToDisk = (value: Record<string, unknown>): boolean => `pathFile` in value === true || value.force === `file` || value.force === `all`

/**
 * Narrow a value to an inline options object, excluding module refs.
 *
 * @remarks
 * The `override` check is what separates inline options from a module ref: both
 * are plain objects, but a module ref carries an `override` wrapper and must be
 * routed through `_serverlessRefs` instead of being inlined as data.
 *
 * @param value - Candidate config value.
 * @returns `true` when `value` is a non-array object with no `override` key.
 *
 * @internal
 */
const isPlainRecord = (value: unknown): value is Record<string, unknown> => typeof value === `object` && value !== null && Array.isArray(value) === false && `override` in value === false

/**
 * Locate the configured serverless adapter section inside `optionsDeploy.serverless`.
 *
 * @remarks
 * The adapter is the KEY (`cloudflare-mod` / `aws-lambda-async`) rather than a
 * field, so it is found by intersecting the branch's own keys with
 * `GRAMSTAX_SERVERLESS_ADAPTERS` rather than by reading a fixed property. Every
 * field is read defensively and coerced to `undefined` when absent or of the
 * wrong type, so callers get a stable shape regardless of how the config was written.
 *
 * @param branch - The `optionsDeploy.serverless` value, of unknown shape.
 * @returns The adapter name plus its `name`, `url`, `compatibilityDate`, `compatibilityFlags` and `toml`, or `undefined` when the branch carries no recognizable adapter key.
 *
 * @internal
 */
const serverlessSection = (branch: unknown): {adapter?: string; name?: string; url?: string; compatibilityDate?: string; compatibilityFlags?: string[]; toml?: Record<string, unknown>} | undefined => {
  if (branch === null || typeof branch !== `object`) return undefined
  const record = branch as Record<string, unknown>
  const adapter = Object.keys(record).find((key) => GRAMSTAX_SERVERLESS_ADAPTERS.some((known) => known === key))
  if (adapter === undefined) return undefined
  const section = record[adapter]
  if (section === null || typeof section !== `object`) return undefined
  const typed = section as {name?: unknown; url?: unknown; compatibilityDate?: unknown; compatibilityFlags?: unknown; toml?: unknown}
  return {
    adapter,
    name: typeof typed.name === `string` ? typed.name : undefined,
    url: typeof typed.url === `string` ? typed.url : undefined,
    compatibilityDate: typeof typed.compatibilityDate === `string` ? typed.compatibilityDate : undefined,
    compatibilityFlags: Array.isArray(typed.compatibilityFlags) === true ? (typed.compatibilityFlags as string[]) : undefined,
    toml: typed.toml !== null && typeof typed.toml === `object` && Array.isArray(typed.toml) === false ? (typed.toml as Record<string, unknown>) : undefined
  }
}

export class GramstaxBuild {
  /**
   * Freeze `src/pages` into `.gramstax/` and emit any resolved serverless entry.
   *
   * @remarks
   * Order matters and is the reason the stages are separate calls: `--raw` and
   * `--dry-run` both return before anything touches disk, the artifact pass runs
   * and is allowed to fail the whole build on a non-zero code, and only then is
   * `--bundle` checked — bundling is meaningless without a target to bundle for,
   * so requesting it bare is an error rather than a silent no-op. The deploy-usage
   * note is logged last, after the target pass, so it reflects the real outcome.
   *
   * @param argv - Positional flag list, as produced by the Commander action in `create`.
   * @param cwd - Absolute project root holding `gramstax.config.ts` and `src/pages`.
   * @returns `0` on success, `1` when the pages directory is missing, `--bundle` has no target, or the build/target pass failed.
   *
   * @throws Error when `--target` is not one of the supported serverless adapters.
   *
   * @example
   * ```typescript
   * process.exitCode = await new GramstaxBuild().run([`--target`, `cloudflare-mod`], projectRoot)
   * ```
   *
   * @public
   */
  async run(argv: string[], cwd: string = process.cwd()): Promise<number> {
    loadProjectEnv(cwd)
    const options = this._parseArgv(argv)
    if (options.target !== undefined && BUILD_TARGETS.includes(options.target) === false) {
      throw new Error(`gramstax build: unknown target ${options.target} (supported: ${BUILD_TARGETS.join(`, `)})`)
    }
    const config: IGramstaxConfig = await new GramstaxConfigLoader().loadConfig(cwd)
    const pagesDir = `src/pages`
    const outDir = `.gramstax`
    if (options.raw === true) {
      log.info(`gramstax build: skip (raw deploy, nothing to build)`)
      return 0
    }
    const resolvedPages = resolve(cwd, pagesDir)
    const resolvedOut = resolve(cwd, outDir)
    if (existsSync(resolvedPages) === false) {
      log.error(`gramstax build: pages directory not found: ${resolvedPages}`)
      return 1
    }
    if (options.dryRun === true) {
      const explicit = await new GramstaxConfigLoader().loadExplicitBuildKeys(cwd)
      const resolved = this._resolveDeployTargets(options.target, config.optionsDeploy)
      const deploy = config.deploy ?? `polling`
      this._warnDroppedSlots(config, resolved.targets)
      this._printPlan({
        pagesDir,
        outDir,
        targets: resolved.targets,
        deploy,
        deploySource: explicit.deploy ? `config` : `default`,
        adapter: resolved.adapter ?? ``,
        adapterPath: resolved.adapter === undefined ? `optionsDeploy.serverless` : `optionsDeploy.serverless.${resolved.adapter}`,
        adapterSource: options.target !== undefined ? `flag` : explicit.adapter ? `config` : `default`,
        name: resolved.name ?? ``,
        nameSource: explicit.name ? `config` : `default`,
        url: resolved.url ?? ``,
        urlSource: explicit.url ? `config` : `default`
      })
      return 0
    }
    const code = await this._runBuild(resolvedPages, resolvedOut, true)
    if (code !== 0) return code
    if (options.bundle === true && options.target !== `cloudflare-mod` && options.target !== `aws-lambda-async`) {
      log.error(`gramstax build failed: --bundle needs --target cloudflare-mod or --target aws-lambda-async`)
      return 1
    }
    const resolved = this._resolveDeployTargets(options.target, config.optionsDeploy)
    this._warnDroppedSlots(config, resolved.targets)
    const targetCode = await this._runTarget(resolvedOut, resolved.targets, options.bundle === true, {
      adapter: resolved.adapter,
      name: resolved.name,
      url: resolved.url,
      compatibilityDate: resolved.compatibilityDate,
      compatibilityFlags: resolved.compatibilityFlags,
      toml: resolved.toml,
      passthrough: this._edgeSafeParams(config),
      refs: this._serverlessRefs(config, cwd)
    })
    this._logDeployUsageNote(config.deploy ?? `polling`)
    return targetCode
  }

  /**
   * Tell the user whether the emitted `.gramstax/` output will actually be used.
   *
   * @remarks
   * Only `deploy: "serverless"` boots through the frozen manifest; every other mode
   * runs straight from `src/pages` and ignores the build output. Warning on the
   * other modes prevents the common waste of building an artifact nothing reads.
   *
   * @param deploy - The resolved deploy mode, defaulting to `polling` when the config sets none.
   *
   * @internal
   */
  _logDeployUsageNote(deploy: string): void {
    if (deploy === `serverless`) {
      log.info(`gramstax build: .gramstax/ is consumed by \`deploy: "serverless"\` via manifest boot (fs-less).`)
      return
    }
    log.warn(`gramstax build: .gramstax/ is only consumed by \`deploy: "serverless"\` via manifest boot. \`deploy: "${deploy}"\` runs straight from src/pages via \`gramstax start\` and ignores this output — skip the build for it.`)
  }

  /**
   * Log a warning for every config slot the emitted entry cannot receive.
   *
   * @remarks
   * Returns immediately when `targets` is empty — with nothing to emit there is no
   * entry to drop a slot from, so the warning would be noise.
   *
   * @param config - The loaded config to inspect.
   * @param targets - Resolved adapter names, used only to decide whether a warning applies.
   *
   * @internal
   */
  _warnDroppedSlots(config: IGramstaxConfig, targets: string[]): void {
    if (targets.length === 0) return
    for (const {slot, reason} of this._droppedSlots(config)) {
      log.warn(`gramstax build: \`${slot}\` not passed to the ${targets.join(` + `)} entry — ${reason}`)
    }
  }

  /**
   * Config a deployed entry can actually receive: plain, serializable, and
   * meaningful without a filesystem. A module path-ref cannot be baked — the
   * emitted entry imports `gramstax`, not the user's module.
   */
  _edgeSafeParams(config: IGramstaxConfig): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const slot of EDGE_SAFE_SCALAR_SLOTS) {
      const value = config[slot]
      if (value !== undefined) out[slot] = value
    }
    for (const slot of EDGE_SAFE_OBJECT_SLOTS) {
      const value = config[slot]
      if (isPlainRecord(value) === true) out[slot] = value
    }
    const cacheSession = config.cacheSession
    if (isPlainRecord(cacheSession) === true && `store` in cacheSession) out.cacheSession = cacheSession
    const cacheKeyboard = config.cacheKeyboard
    if (Array.isArray(cacheKeyboard) === true || isPlainRecord(cacheKeyboard) === true) out.cacheKeyboard = cacheKeyboard
    const log = config.log
    if (typeof log === `boolean`) out.log = log
    else if (isPlainRecord(log) === true && logWritesToDisk(log) === false) out.log = log
    return out
  }

  /**
   * Read a config slot as a module reference, if it is written as one.
   *
   * @remarks
   * Two accepted shapes: a bare module path string, or `{override: {module, export?, args?}}`.
   * Anything else — including inline options objects — yields `undefined`, which is
   * the signal for `_serverlessRefs` to skip the slot rather than treat it as a path.
   * This runs before `GramstaxConfigLoader` validation in the build path, so it stays
   * total and never throws on malformed input.
   *
   * @param value - Raw config value for the slot.
   * @returns The `{module, exportName, args}` triple, or `undefined` when the slot is not a module ref.
   *
   * @internal
   */
  _pathRefOf(value: unknown): {module: string; exportName?: string; args: unknown[]} | undefined {
    if (typeof value === `string`) return {module: value, args: []}
    if (typeof value !== `object` || value === null || `override` in value === false) return undefined
    const override = (value as {override: unknown}).override
    if (typeof override !== `object` || override === null) return undefined
    const inner = override as {module?: unknown; export?: unknown; args?: unknown}
    if (typeof inner.module !== `string`) return undefined
    return {module: inner.module, exportName: typeof inner.export === `string` ? inner.export : undefined, args: Array.isArray(inner.args) === true ? inner.args : []}
  }

  /**
   * Collect the config slots that point at a user module, ready for static import.
   *
   * @remarks
   * Only `REF_SLOTS` are considered, and only when written in module-ref form —
   * inline options objects are handled by `_edgeSafeParams` instead, since they
   * need no import. The module path is resolved against `cwd` here so the emitted
   * entry carries an absolute specifier that the platform bundler can follow.
   *
   * @param config - The loaded config to inspect.
   * @param cwd - Absolute project root the module paths are resolved against.
   * @returns One `IServerlessRef` per module-ref slot; empty when no slot uses one.
   *
   * @internal
   */
  _serverlessRefs(config: IGramstaxConfig, cwd: string): IServerlessRef[] {
    const refs: IServerlessRef[] = []
    for (const slot of REF_SLOTS) {
      const ref = this._pathRefOf(config[slot])
      if (ref === undefined) continue
      refs.push({slot, module: resolve(cwd, ref.module), exportName: ref.exportName, args: ref.args})
    }
    return refs
  }

  /**
   * List config slots that a deployed entry cannot honor, with a reason each.
   *
   * @remarks
   * Membership is tested against `HOST_DEPENDENT_REASONS`, whose keys double as
   * the config field names, so adding a host-dependent field there is enough to
   * get it reported. `log` is special-cased: it only counts as dropped when it
   * would write to disk, because a console logger works fine in a deployed entry.
   *
   * @param config - The loaded config to inspect.
   * @returns One `{slot, reason}` pair per dropped slot; empty when the config is edge-safe.
   *
   * @internal
   */
  _droppedSlots(config: IGramstaxConfig): Array<{slot: string; reason: string}> {
    const dropped: Array<{slot: string; reason: string}> = []
    for (const [slot, reason] of Object.entries(HOST_DEPENDENT_REASONS)) {
      if (config[slot as keyof IGramstaxConfig] !== undefined) dropped.push({slot, reason})
    }
    const log = config.log
    if (isPlainRecord(log) === true && logWritesToDisk(log) === true) {
      dropped.push({slot: `log`, reason: `it writes to disk (log.pathFile, or log.force: file|all), which a deployed entry has no filesystem for`})
    }
    return dropped
  }

  /**
   * Narrow a config value to a usable http(s) URL.
   *
   * @remarks
   * Rejects anything containing `<`, which is how unfilled template placeholders
   * in a config reach this code — baking one into a deployed entry produces a
   * webhook url that can never receive an update.
   *
   * @param url - Candidate value, typically read straight off a config field.
   * @returns `true` when `url` is a string matching `^https?://` with no `<` in it.
   *
   * @internal
   */
  _isRealUrl(url: unknown): url is string {
    return typeof url === `string` && /^https?:\/\/.+/.test(url) && url.includes(`<`) === false
  }

  /**
   * Reconcile the `--target` flag with `optionsDeploy` into a single target list.
   *
   * @remarks
   * `--target` wins over the configured adapter and logs a warning when the two
   * disagree, since the emitted entry then borrows the configured url and secret.
   * The url falls back to the `webhook` branch so `deploy: webhook` plus an
   * explicit `--target` still yields a serverless artifact. An empty `targets`
   * is the "config-driven, nothing to emit" signal and is not an error; a
   * flag-driven target with a placeholder url is, because it would bake a
   * literal `<placeholder>` into the artifact.
   *
   * @param target - Adapter name from `--target`, or `undefined` to use the configured adapter.
   * @param optionsDeploy - The `optionsDeploy` object from the loaded config, read for its `serverless` and `webhook` branches.
   * @returns Resolved `targets` (empty when no adapter applies) plus the `adapter`, `name`, `url`, `compatibilityDate`, `compatibilityFlags` and `toml` to inline.
   *
   * @throws Error when `target` is set but the resolved url is not a real http(s) URL.
   *
   * @internal
   */
  _resolveDeployTargets(target: string | undefined, optionsDeploy: IGramstaxConfig[`optionsDeploy`]): {targets: string[]; adapter?: string; name?: string; url?: string; compatibilityDate?: string; compatibilityFlags?: string[]; toml?: Record<string, unknown>} {
    const section = serverlessSection(optionsDeploy?.serverless)
    const configured = section?.adapter
    const name = section?.name
    // A declared webhook branch is a deliberate fallback: `deploy: webhook` plus an
    // explicit --target builds a serverless artifact from the webhook url. Kept from
    // the pre-036 behavior; nothing in the repo pinned it until plan 036.
    const url = section?.url ?? optionsDeploy?.webhook?.url
    if (target !== undefined && configured !== undefined && target !== configured) {
      log.warn(`gramstax build: --target ${target} overrides optionsDeploy.serverless.${configured}; building for ${target} using the shared url/secretToken`)
    }
    const adapter = target ?? configured
    if (adapter === undefined) return {targets: [], name, url}
    if (this._isRealUrl(url) === false) {
      if (target === undefined) return {targets: [], adapter, name, url}
      throw new Error(`gramstax build: --target ${target} requires optionsDeploy.serverless['${adapter}'].url to be a real http(s) URL with no placeholder (got "${url ?? ``}")`)
    }
    return {targets: [adapter], adapter, name: name ?? `gramstax-worker`, url, compatibilityDate: section?.compatibilityDate, compatibilityFlags: section?.compatibilityFlags, toml: section?.toml}
  }

  /**
   * Emit one server entry per resolved target into `<outDir>/server`.
   *
   * @remarks
   * The `server` directory is removed first so entries from a previous build
   * cannot survive into the new artifact. `cloudflare-mod` dispatches to
   * `WorkerTarget`, anything else to `LambdaTarget`. Bundling is a second pass
   * over the already-emitted directory and picks the bundler by checking whether
   * `aws-lambda-async` is among the targets. The whole body is wrapped in a
   * `try` that logs and returns `1`, so a platform-bundler failure surfaces as a
   * build failure rather than an unhandled rejection.
   *
   * @param outDir - Build output directory containing `manifest.js`; `server/` is created beneath it.
   * @param targets - Resolved adapter names to emit for. Empty emits nothing and still returns `0`.
   * @param bundle - Pass `true` to follow the emit pass with a single-file bundle.
   * @param baked - Config values inlined into the entry: adapter metadata, `passthrough` config, and `refs` to statically import.
   * @returns `0` on success, `1` when emission or bundling threw.
   *
   * @internal
   */
  async _runTarget(
    outDir: string,
    targets: string[],
    bundle: boolean,
    baked?: {adapter?: string; name?: string; url?: string; compatibilityDate?: string; compatibilityFlags?: string[]; toml?: Record<string, unknown>; passthrough?: Record<string, unknown>; refs?: IServerlessRef[]}
  ): Promise<number> {
    try {
      const dir = join(resolve(outDir), `server`)
      const manifest = join(resolve(outDir), `manifest.js`)
      rmSync(dir, {recursive: true, force: true})
      for (const targetName of targets) {
        const [file] =
          targetName === `cloudflare-mod`
            ? new WorkerTarget().emit(dir, manifest, {adapter: baked?.adapter, name: baked?.name, url: baked?.url, compatibilityDate: baked?.compatibilityDate, compatibilityFlags: baked?.compatibilityFlags, toml: baked?.toml, passthrough: baked?.passthrough, refs: baked?.refs})
            : new LambdaTarget().emit(dir, manifest, {adapter: baked?.adapter, url: baked?.url})
        log.info(`target ${targetName}: ${file ?? ``}`)
      }
      if (bundle) {
        const bundled = targets.includes(`aws-lambda-async`) === true ? await new LambdaTarget().emitBundle(dir) : await new WorkerTarget().emitBundle(dir)
        log.info(`target ${targets.join(` + `)}: ${bundled}`)
      }
      return 0
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      log.error(`gramstax build failed: ${message}`)
      return 1
    }
  }

  /**
   * Freeze `pagesDir` into `outDir` and log the resulting statistics.
   *
   * @remarks
   * AOT compilation is requested via the `withAot` flag rather than being implied,
   * so the same code path serves a caller that only wants the route/manifest pass.
   * Validation of the emitted artifacts happens inside the `try`, which is what
   * turns a bad build into exit code `1` plus one logged line instead of an
   * unhandled rejection.
   *
   * @param pagesDir - Absolute pages directory to scan.
   * @param outDir - Absolute directory that receives `routes.json`, `manifest.js` and the AOT `gen/` output.
   * @param withAot - Pass `true` to run AOT compilation; `false` limits the pass to routes and manifest.
   * @returns `0` on success, `1` when generation or validation failed.
   *
   * @internal
   */
  async _runBuild(pagesDir: string, outDir: string, withAot: boolean): Promise<number> {
    const started = Date.now()
    try {
      const stats = generate(pagesDir, outDir, withAot ? {aot: true} : undefined)
      await this._validateBuild(outDir, stats.routes)
      log.info(`gramstax build complete`)
      log.info(`pagesDir: ${pagesDir}`)
      log.info(`outDir: ${outDir}`)
      log.info(`pages: ${stats.pages}, templates: ${stats.templates}, routes: ${stats.routes}, ms: ${Date.now() - started}`)
      return 0
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      log.error(`gramstax build failed: ${message}`)
      return 1
    }
  }

  /**
   * Verify the emitted artifacts match what `generate` reported.
   *
   * @remarks
   * Reads the build back from disk instead of trusting the generator's return
   * value, so a partially-written or stale `.gramstax/` is caught before any
   * serverless target is emitted. `manifest.js` is imported dynamically to
   * confirm it is loadable ESM and that its `default.pages` array has the
   * expected length.
   *
   * @param outDir - Build output directory holding `routes.json` and `manifest.js`.
   * @param expectedRoutes - Route/page count reported by the generator, used as the expected length of both artifacts.
   *
   * @throws Error when `routes.json` does not parse to an array of `expectedRoutes` entries.
   * @throws Error when `manifest.js` is missing from `outDir`.
   * @throws Error when `manifest.js` has no `default.pages` array of `expectedRoutes` entries.
   *
   * @internal
   */
  async _validateBuild(outDir: string, expectedRoutes: number): Promise<void> {
    const dir = resolve(outDir)
    const routesRaw = readFileSync(join(dir, `routes.json`), `utf-8`)
    const parsed: unknown = JSON.parse(routesRaw)
    if (Array.isArray(parsed) === false || (parsed as Array<unknown>).length !== expectedRoutes) {
      throw new Error(`routes.json validation failed: expected ${expectedRoutes} routes`)
    }
    const manifestFile = join(dir, `manifest.js`)
    if (existsSync(manifestFile) === false) {
      throw new Error(`manifest.js not found at ${manifestFile}`)
    }
    const loaded: {default?: {pages?: Array<unknown>}} = await import(pathToFileURL(manifestFile).href)
    const pages = loaded.default?.pages
    if (Array.isArray(pages) === false || (pages as Array<unknown>).length !== expectedRoutes) {
      throw new Error(`manifest.js validation failed: expected ${expectedRoutes} pages`)
    }
  }

  /**
   * Parse `gramstax build` flags into an options object.
   *
   * @remarks
   * Accepts both `--target value` and `--target=value`; `arg.split("=")` yields
   * the inline value in the second form, and the index advances by one or two
   * accordingly. Unknown flags are fatal rather than ignored, so a typo in a
   * script wrapping the CLI surfaces instead of silently changing the build.
   * Unrecognized options are rejected here even though Commander already parsed
   * them in `create`, because `run` is also called directly by tests.
   *
   * @param argv - Positional flag list forwarded from the Commander action.
   * @returns The parsed options; an empty object means a plain `gramstax build`.
   *
   * @throws Error when `argv` contains an unrecognized option.
   *
   * @internal
   */
  _parseArgv(argv: string[]): IGramstaxBuildOptions {
    const options: IGramstaxBuildOptions = {}
    let index = 0
    while (index < argv.length) {
      const arg = argv[index] ?? ``
      const [flag, inlineValue] = arg.split(`=`)
      if (flag === `--dry-run`) {
        options.dryRun = true
        index += 1
      } else if (flag === `--raw`) {
        options.raw = true
        index += 1
      } else if (flag === `--target`) {
        options.target = inlineValue ?? argv[index + 1] ?? ``
        index += inlineValue === undefined ? 2 : 1
      } else if (flag === `--bundle`) {
        options.bundle = true
        index += 1
      } else {
        throw new Error(`gramstax build: unknown option ${arg}`)
      }
    }
    return options
  }

  /**
   * Print the resolved build plan for `--dry-run`, writing nothing to disk.
   *
   * @remarks
   * Every value is printed next to a `*Source` provenance field so a reader can
   * tell an explicit config key from a fallback without re-reading the config.
   * Unresolved values are printed as empty strings rather than omitted, so the
   * output shape stays stable across runs.
   *
   * @param plan - Resolved plan assembled by `run` from the loaded config plus the `--target` flag.
   *
   * @internal
   */
  _printPlan(plan: IGramstaxBuildPlan): void {
    log.info(`gramstax build plan`)
    log.info(`pagesDir: ${plan.pagesDir}`)
    log.info(`outDir: ${plan.outDir}`)
    log.info(`targets: ${plan.targets.join(`, `)}`)
    log.info(`deploy: ${plan.deploy} (${plan.deploySource})`)
    log.info(`${plan.adapterPath}: ${plan.adapter} (${plan.adapterSource})`)
    log.info(`optionsDeploy.serverless.name: ${plan.name} (${plan.nameSource})`)
    log.info(`optionsDeploy.serverless.url: ${plan.url} (${plan.urlSource})`)
    log.info(`dry-run: no files written`)
  }
}
