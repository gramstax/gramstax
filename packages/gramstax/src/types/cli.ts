import type {Gramstax} from "~/core/bot"
import type {IGramstaxParams} from "./bot"

/**
 * Parsed `gramstax build` flags.
 *
 * @remarks
 * Produced by `GramstaxBuild._parseArgv` from `--dry-run`, `--raw`,
 * `--target <name>`, and `--bundle`. All fields optional — an empty object
 * means plain `gramstax build` with defaults.
 *
 * @public
 */
export type IGramstaxBuildOptions = {
  /**
   * Print the resolved plan without writing files.
   *
   * @remarks
   * Set by `--dry-run`. Resolves deploy targets and prints them via
   * `GramstaxBuild._printPlan`, then exits `0` before `_runBuild`.
   */
  dryRun?: boolean
  /**
   * Skip the build for raw-deploy projects.
   *
   * @remarks
   * Set by `--raw`. When `true`, `GramstaxBuild.run` logs
   * `skip (raw deploy, nothing to build)` and exits `0` — raw projects
   * have no pages to freeze.
   */
  raw?: boolean
  /**
   * Serverless target to emit.
   *
   * @remarks
   * Set by `--target <name>`. Supported values are the adapter names
   * `cloudflare-mod` and `aws-lambda-async`; anything else throws
   * `unknown target`. Feeds `_resolveDeployTargets` and marks
   * `adapterSource` as `flag`.
   */
  target?: string
  /**
   * Bundle the cloudflare-workers server entry into a single file.
   *
   * @remarks
   * Set by `--bundle`. Only valid with `--target cloudflare-workers`
   * (otherwise the build fails). Deprecated — multi-file output is
   * recommended — but still honored via `WorkerTarget.emitBundle`.
   */
  bundle?: boolean
}

/**
 * Provenance of a resolved `IGramstaxBuildPlan` value.
 *
 * @remarks
 * `config` means the value came from an explicit key in
 * `gramstax.config.ts` (see `loadExplicitBuildKeys`); `default` means the
 * fallback was used. `IGramstaxBuildPlan.adapterSource` widens this with
 * `flag` when `--target` was passed on the command line.
 *
 * @public
 */
export type IGramstaxPlanSource = `config` | `default`

/**
 * Resolved `gramstax build --dry-run` plan printed without writing files.
 *
 * @remarks
 * Built in `GramstaxBuild.run` from the loaded `IGramstaxConfig` plus the
 * `--target` flag, then rendered by `GramstaxBuild._printPlan`. Every value
 * field carries a `*Source` provenance sibling.
 *
 * @public
 */
export type IGramstaxBuildPlan = {
  /**
   * Pages source directory (relative).
   *
   * @remarks
   * Always `src/pages` — the convention root scanned for page modules.
   */
  pagesDir: string
  /**
   * Build output directory (relative).
   *
   * @remarks
   * Always `.gramstax` — receives `routes.json` and `manifest.js`.
   */
  outDir: string
  /**
   * Resolved serverless targets to emit.
   *
   * @remarks
   * Derived by `_resolveDeployTargets` from `--target` plus
   * `optionsDeploy.adapter`/`url`. Empty means no target matched.
   */
  targets: string[]
  /**
   * Resolved deploy mode.
   *
   * @remarks
   * Falls back to `polling` when the config sets no `deploy` key.
   */
  deploy: string
  /**
   * Provenance of `deploy`.
   *
   * @remarks
   * `config` when `deploy` was set explicitly in `gramstax.config.ts`,
   * otherwise `default`.
   */
  deploySource: IGramstaxPlanSource
  /**
   * Resolved deploy adapter.
   *
   * @remarks
   * The adapter name, which is also the key under `optionsDeploy.serverless`.
   * `--target` and the configured key use the same vocabulary, so there is no
   * mapping. Empty string when unresolved.
   */
  adapter: string
  /**
   * Config path the adapter was read from, for dry-run output.
   *
   * @remarks
   * `optionsDeploy.serverless` on its own when no adapter was resolved,
   * otherwise the full path including the adapter key.
   */
  adapterPath: string
  /**
   * Provenance of `adapter`.
   *
   * @remarks
   * `flag` when `--target` was passed, `config` when an adapter key was
   * present in `optionsDeploy.serverless`, otherwise `default`.
   */
  adapterSource: IGramstaxPlanSource | `flag`
  /**
   * Resolved deploy name.
   *
   * @remarks
   * Taken from `optionsDeploy.name`, defaulting to `gramstax-worker` for
   * flag-driven targets. Empty string when unresolved.
   */
  name: string
  /**
   * Provenance of `name`.
   *
   * @remarks
   * `config` when `optionsDeploy.name` was set explicitly, otherwise
   * `default`.
   */
  nameSource: IGramstaxPlanSource
  /**
   * Resolved deploy URL.
   *
   * @remarks
   * Taken from `optionsDeploy.url`. Flag-driven targets require a real
   * `http(s)` URL with no placeholder. Empty string when unresolved.
   */
  url: string
  /**
   * Provenance of `url`.
   *
   * @remarks
   * `config` when `optionsDeploy.url` was set explicitly, otherwise
   * `default`.
   */
  urlSource: IGramstaxPlanSource
}

/**
 * Parsed `gramstax start` flags.
 *
 * @remarks
 * Produced by `GramstaxStart._parseArgv` from `--deploy <mode>` and
 * `--watch`. All fields optional — an empty object boots with config
 * defaults and no watcher.
 *
 * @public
 */
export type IGramstaxStartOptions = {
  /**
   * Deploy mode override (beats config).
   *
   * @remarks
   * Set by `--deploy <mode>`. Must be one of `polling`, `webhook`,
   * `serverless`, `raw`, or `test` — legacy colon forms are rejected.
   * Falls back to the config `deploy`, then to `polling`.
   */
  deploy?: string
  /**
   * Restart the bot on `src` changes.
   *
   * @remarks
   * Set by `--watch`. When `true`, `GramstaxStart.run` attaches a chokidar
   * watcher on `<cwd>/src` that stops the current instance and re-boots on
   * every change.
   */
  watch?: boolean
}

/**
 * Constructor of the project `BotCore` class.
 *
 * @remarks
 * Discovered by `GramstaxStart._discoverBotCore` from `src/core/bot.ts`
 * (or `.js`): the first export whose prototype extends `Gramstax`.
 * Instantiated with the materialized `IGramstaxParams` in
 * `GramstaxStart.boot`.
 *
 * @public
 */
export type IGramstaxBotClass = new (params: IGramstaxParams) => Gramstax

/**
 * Config slot that may hold a module reference in a serverless build.
 *
 * @remarks
 * Declared here so `cli/build.ts` can type-check its `REF_SLOTS` list against a
 * single definition instead of the union being spelled out twice.
 *
 * @public
 */
export type IServerlessSlot = `cacheSession` | `cacheKeyboard` | `log`

/**
 * A config slot resolved to an imported module for a serverless bundle.
 *
 * @public
 */
export type IServerlessRef = {
  slot: IServerlessSlot
  module: string
  exportName?: string
  args: unknown[]
}
