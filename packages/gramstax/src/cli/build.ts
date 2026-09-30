import {existsSync, readFileSync, rmSync} from "node:fs"
import {join, resolve} from "node:path"
import {pathToFileURL} from "node:url"
import {generate} from "../../scripts/build-manifest"
import type {ITGramstaxConfig} from "./config"
import {CONFIG_OVERRIDE_SLOTS, GramstaxConfigLoader} from "./config"
import {LambdaTarget} from "./targets/lambda"
import {WorkerTarget} from "./targets/worker"

export type ITGramstaxBuildOptions = {dryRun?: boolean; raw?: boolean; target?: string; bundle?: boolean}

export type ITGramstaxPlanSource = `config` | `default`

export type ITGramstaxBuildPlan = {pagesDir: string; outDir: string; targets: string[]; deploy: string; deploySource: ITGramstaxPlanSource; adapter: string; adapterSource: ITGramstaxPlanSource | `flag`; name: string; nameSource: ITGramstaxPlanSource; url: string; urlSource: ITGramstaxPlanSource}

const BUILD_TARGETS = [`lambda`, `cloudflare-workers`]

export class GramstaxBuild {
  async run(argv: string[], cwd: string = process.cwd()): Promise<number> {
    const options = this._parseArgv(argv)
    if (options.target !== undefined && BUILD_TARGETS.includes(options.target) === false) {
      throw new Error(`gramstax build: unknown target ${options.target} (supported: ${BUILD_TARGETS.join(`, `)})`)
    }
    const config: ITGramstaxConfig = await new GramstaxConfigLoader().loadConfig(cwd)
    const pagesDir = `src/pages`
    const outDir = `.gramstax`
    if (options.raw === true) {
      console.log(`gramstax build: skip (raw deploy, nothing to build)`)
      return 0
    }
    const resolvedPages = resolve(cwd, pagesDir)
    const resolvedOut = resolve(cwd, outDir)
    if (existsSync(resolvedPages) === false) {
      console.error(`gramstax build: pages directory not found: ${resolvedPages}`)
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
      console.error(`gramstax build failed: --bundle needs --target cloudflare-workers`)
      return 1
    }
    const resolved = this._resolveDeployTargets(options.target, config.optionsDeploy)
    if (resolved.targets.includes(`cloudflare-workers`) === true) {
      const ignored = CONFIG_OVERRIDE_SLOTS.filter((slot) => config[slot as keyof ITGramstaxConfig] !== undefined)
      for (const slot of ignored) {
        console.warn(`gramstax build: custom \`${slot}\` ignored on cloudflare-workers (edge boots from frozen manifest output)`)
      }
    }
    return this._runTarget(resolvedOut, resolved.targets, options.bundle === true, {adapter: resolved.adapter, name: resolved.name, url: resolved.url})
  }

  _isRealUrl(url: unknown): url is string {
    return typeof url === `string` && /^https?:\/\/.+/.test(url) && url.includes(`<`) === false
  }

  _resolveDeployTargets(target: string | undefined, optionsDeploy: ITGramstaxConfig[`optionsDeploy`]): {targets: string[]; adapter?: string; name?: string; url?: string} {
    const fromTarget = target === `cloudflare-workers` ? `cloudflare-mod` : target === `lambda` ? `aws-lambda-async` : undefined
    const adapter = optionsDeploy?.adapter
    if (fromTarget !== undefined) {
      if (adapter !== undefined && (adapter === `cloudflare-mod` || adapter === `aws-lambda-async`) && adapter !== fromTarget) {
        throw new Error(`gramstax build: --target ${target} conflicts with optionsDeploy.adapter "${adapter}" (use --target ${adapter === `cloudflare-mod` ? `cloudflare-workers` : `lambda`} or change optionsDeploy.adapter to "${fromTarget}")`)
      }
      const url = optionsDeploy?.url
      if (this._isRealUrl(url) === false) {
        throw new Error(`gramstax build: --target ${target} requires optionsDeploy.url to be a real http(s) URL with no placeholder (got "${url ?? ``}")`)
      }
      return {targets: [target as string], adapter: fromTarget, name: optionsDeploy?.name ?? `gramstax-worker`, url: url as string}
    }
    if (adapter === `cloudflare-mod` && this._isRealUrl(optionsDeploy?.url)) {
      return {targets: [`cloudflare-workers`], adapter, name: optionsDeploy?.name ?? `gramstax-worker`, url: optionsDeploy?.url as string}
    }
    if (adapter === `aws-lambda-async` && this._isRealUrl(optionsDeploy?.url)) {
      return {targets: [`lambda`], adapter, name: optionsDeploy?.name ?? `gramstax-worker`, url: optionsDeploy?.url as string}
    }
    return {targets: [], adapter, name: optionsDeploy?.name, url: optionsDeploy?.url}
  }

  async _runTarget(outDir: string, targets: string[], bundle: boolean, baked?: {adapter?: string; name?: string; url?: string}): Promise<number> {
    try {
      const dir = join(resolve(outDir), `server`)
      const manifest = join(resolve(outDir), `manifest.js`)
      rmSync(dir, {recursive: true, force: true})
      for (const targetName of targets) {
        const [file] = targetName === `cloudflare-workers` ? new WorkerTarget().emit(dir, manifest, {adapter: baked?.adapter, name: baked?.name, url: baked?.url}) : new LambdaTarget().emit(dir, manifest, {adapter: baked?.adapter, url: baked?.url})
        console.log(`target ${targetName}: ${file ?? ``}`)
      }
      if (bundle) {
        console.warn(`gramstax build: --bundle is deprecated (multi-file output is recommended); bundling anyway`)
        const bundled = await new WorkerTarget().emitBundle(dir)
        console.log(`target cloudflare-workers: ${bundled}`)
      }
      return 0
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`gramstax build failed: ${message}`)
      return 1
    }
  }

  async _runBuild(pagesDir: string, outDir: string, withAot: boolean): Promise<number> {
    const started = Date.now()
    try {
      const stats = generate(pagesDir, outDir, withAot ? {aot: true} : undefined)
      await this._validateBuild(outDir, stats.routes)
      console.log(`gramstax build complete`)
      console.log(`pagesDir: ${pagesDir}`)
      console.log(`outDir: ${outDir}`)
      console.log(`pages: ${stats.pages}, templates: ${stats.templates}, routes: ${stats.routes}, ms: ${Date.now() - started}`)
      return 0
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`gramstax build failed: ${message}`)
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

  _parseArgv(argv: string[]): ITGramstaxBuildOptions {
    const options: ITGramstaxBuildOptions = {}
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

  _printPlan(plan: ITGramstaxBuildPlan): void {
    console.log(`gramstax build plan`)
    console.log(`pagesDir: ${plan.pagesDir}`)
    console.log(`outDir: ${plan.outDir}`)
    console.log(`targets: ${plan.targets.join(`, `)}`)
    console.log(`deploy: ${plan.deploy} (${plan.deploySource})`)
    console.log(`optionsDeploy.adapter: ${plan.adapter} (${plan.adapterSource})`)
    console.log(`optionsDeploy.name: ${plan.name} (${plan.nameSource})`)
    console.log(`optionsDeploy.url: ${plan.url} (${plan.urlSource})`)
    console.log(`dry-run: no files written`)
  }
}
