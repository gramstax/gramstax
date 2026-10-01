import {existsSync, readFileSync, rmSync} from "node:fs"
import {join, resolve} from "node:path"
import {pathToFileURL} from "node:url"
import {log} from "~/helpers/log"
import type {IGramstaxBuildOptions, IGramstaxBuildPlan} from "~/types/cli"
import type {IGramstaxConfig} from "~/types/config"
import {generate} from "../../scripts/build-manifest"
import {CONFIG_OVERRIDE_SLOTS, GramstaxConfigLoader} from "./config"
import {LambdaTarget} from "./targets/lambda"
import {WorkerTarget} from "./targets/worker"

const BUILD_TARGETS = [`lambda`, `cloudflare-workers`]

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
      this._printPlan({
        pagesDir,
        outDir,
        targets: resolved.targets,
        deploy,
        deploySource: explicit.deploy ? `config` : `default`,
        adapter: resolved.adapter ?? ``,
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
    if (options.bundle === true && options.target !== `cloudflare-workers`) {
      log.error(`gramstax build failed: --bundle needs --target cloudflare-workers`)
      return 1
    }
    const resolved = this._resolveDeployTargets(options.target, config.optionsDeploy)
    if (resolved.targets.includes(`cloudflare-workers`) === true) {
      const ignored = CONFIG_OVERRIDE_SLOTS.filter((slot) => config[slot as keyof IGramstaxConfig] !== undefined)
      for (const slot of ignored) {
        log.warn(`gramstax build: custom \`${slot}\` ignored on cloudflare-workers (edge boots from frozen manifest output)`)
      }
    }
    return this._runTarget(resolvedOut, resolved.targets, options.bundle === true, {adapter: resolved.adapter, name: resolved.name, url: resolved.url})
  }

  _isRealUrl(url: unknown): url is string {
    return typeof url === `string` && /^https?:\/\/.+/.test(url) && url.includes(`<`) === false
  }

  _resolveDeployTargets(target: string | undefined, optionsDeploy: IGramstaxConfig[`optionsDeploy`]): {targets: string[]; adapter?: string; name?: string; url?: string} {
    const fromTarget = target === `cloudflare-workers` ? `cloudflare-mod` : target === `lambda` ? `aws-lambda-async` : undefined
    const adapter = optionsDeploy?.serverless?.adapter
    const name = optionsDeploy?.serverless?.name
    const url = optionsDeploy?.serverless?.url ?? optionsDeploy?.webhook?.url
    if (fromTarget !== undefined) {
      if (adapter !== undefined && (adapter === `cloudflare-mod` || adapter === `aws-lambda-async`) && adapter !== fromTarget) {
        throw new Error(`gramstax build: --target ${target} conflicts with optionsDeploy.serverless.adapter "${adapter}" (use --target ${adapter === `cloudflare-mod` ? `cloudflare-workers` : `lambda`} or change optionsDeploy.serverless.adapter to "${fromTarget}")`)
      }
      if (this._isRealUrl(url) === false) {
        throw new Error(`gramstax build: --target ${target} requires optionsDeploy.serverless.url to be a real http(s) URL with no placeholder (got "${url ?? ``}")`)
      }
      return {targets: [target as string], adapter: fromTarget, name: name ?? `gramstax-worker`, url: url as string}
    }
    if (adapter === `cloudflare-mod` && this._isRealUrl(url)) {
      return {targets: [`cloudflare-workers`], adapter, name: name ?? `gramstax-worker`, url: url as string}
    }
    if (adapter === `aws-lambda-async` && this._isRealUrl(url)) {
      return {targets: [`lambda`], adapter, name: name ?? `gramstax-worker`, url: url as string}
    }
    return {targets: [], adapter, name, url}
  }

  async _runTarget(outDir: string, targets: string[], bundle: boolean, baked?: {adapter?: string; name?: string; url?: string}): Promise<number> {
    try {
      const dir = join(resolve(outDir), `server`)
      const manifest = join(resolve(outDir), `manifest.js`)
      rmSync(dir, {recursive: true, force: true})
      for (const targetName of targets) {
        const [file] = targetName === `cloudflare-workers` ? new WorkerTarget().emit(dir, manifest, {adapter: baked?.adapter, name: baked?.name, url: baked?.url}) : new LambdaTarget().emit(dir, manifest, {adapter: baked?.adapter, url: baked?.url})
        log.info(`target ${targetName}: ${file ?? ``}`)
      }
      if (bundle) {
        log.warn(`gramstax build: --bundle is deprecated (multi-file output is recommended); bundling anyway`)
        const bundled = await new WorkerTarget().emitBundle(dir)
        log.info(`target cloudflare-workers: ${bundled}`)
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
    log.info(`optionsDeploy.serverless.adapter: ${plan.adapter} (${plan.adapterSource})`)
    log.info(`optionsDeploy.serverless.name: ${plan.name} (${plan.nameSource})`)
    log.info(`optionsDeploy.serverless.url: ${plan.url} (${plan.urlSource})`)
    log.info(`dry-run: no files written`)
  }
}
