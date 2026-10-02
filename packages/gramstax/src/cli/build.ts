import {existsSync, readFileSync, rmSync} from "node:fs"
import {join, resolve} from "node:path"
import {pathToFileURL} from "node:url"
import {log} from "~/helpers/log"
import type {IGramstaxBuildOptions, IGramstaxBuildPlan} from "~/types/cli"
import type {IGramstaxConfig} from "~/types/config"
import {GRAMSTAX_SERVERLESS_ADAPTERS} from "~/types/config"
import {generate} from "../../scripts/build-manifest"
import {GramstaxConfigLoader} from "./config"
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

const REF_SLOTS = [`cacheSession`, `cacheKeyboard`, `log`] as const

/**
 * A config slot pointing at a user module. The emitted entry imports it with a
 * static top-level import so the platform bundler resolves (and compiles) it at
 * build time rather than at first request.
 */
export type IServerlessRef = {
  slot: (typeof REF_SLOTS)[number]
  module: string
  exportName?: string
  args: unknown[]
}

const logWritesToDisk = (value: Record<string, unknown>): boolean => `pathFile` in value === true || value.force === `file` || value.force === `all`
const isPlainRecord = (value: unknown): value is Record<string, unknown> => typeof value === `object` && value !== null && Array.isArray(value) === false && `override` in value === false

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
  async run(argv: string[], cwd: string = process.cwd()): Promise<number> {
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

  _logDeployUsageNote(deploy: string): void {
    if (deploy === `serverless`) {
      log.info(`gramstax build: .gramstax/ is consumed by \`deploy: "serverless"\` via manifest boot (fs-less).`)
      return
    }
    log.warn(`gramstax build: .gramstax/ is only consumed by \`deploy: "serverless"\` via manifest boot. \`deploy: "${deploy}"\` runs straight from src/pages via \`gramstax start\` and ignores this output — skip the build for it.`)
  }

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

  _pathRefOf(value: unknown): {module: string; exportName?: string; args: unknown[]} | undefined {
    if (typeof value === `string`) return {module: value, args: []}
    if (typeof value !== `object` || value === null || `override` in value === false) return undefined
    const override = (value as {override: unknown}).override
    if (typeof override !== `object` || override === null) return undefined
    const inner = override as {module?: unknown; export?: unknown; args?: unknown}
    if (typeof inner.module !== `string`) return undefined
    return {module: inner.module, exportName: typeof inner.export === `string` ? inner.export : undefined, args: Array.isArray(inner.args) === true ? inner.args : []}
  }

  _serverlessRefs(config: IGramstaxConfig, cwd: string): IServerlessRef[] {
    const refs: IServerlessRef[] = []
    for (const slot of REF_SLOTS) {
      const ref = this._pathRefOf(config[slot])
      if (ref === undefined) continue
      refs.push({slot, module: resolve(cwd, ref.module), exportName: ref.exportName, args: ref.args})
    }
    return refs
  }

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

  _isRealUrl(url: unknown): url is string {
    return typeof url === `string` && /^https?:\/\/.+/.test(url) && url.includes(`<`) === false
  }

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
