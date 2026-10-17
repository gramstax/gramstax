import {existsSync} from "node:fs"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import type {IRateLimitOptions, IUpdateQueueConfig} from "~/types/bot"
import type {
  IGramstaxAwsLambdaAsyncOptions,
  IGramstaxCacheKeyboardRef,
  IGramstaxCacheSessionRef,
  IGramstaxCloudflareModOptions,
  IGramstaxConfig,
  IGramstaxExplicitBuildKeys,
  IGramstaxLogRef,
  IGramstaxModuleRef,
  IGramstaxOptionsDeploy,
  IGramstaxPathRef,
  IGramstaxPollingDeployOptions,
  IGramstaxServerlessDeployOptions,
  IGramstaxSessionLockRef,
  IGramstaxTemplateManagerRef,
  IGramstaxWebhookDeployOptions
} from "~/types/config"
import {GRAMSTAX_DEPLOY_MODE_SET, GRAMSTAX_DEPLOY_MODES, GRAMSTAX_SERVERLESS_ADAPTERS, GRAMSTAX_SERVERLESS_FIELDS} from "~/types/config"
import type {ISessionLockOnContended} from "~/types/session-lock"
import type {ITemplateOptions} from "~/types/template"

const TOP_LEVEL_FIELDS = [
  `optionsDeploy`,
  `token`,
  `deploy`,
  `mediaRoots`,
  `botConfig`,
  `autoRetry`,
  `autoRetryOptions`,
  `rateLimit`,
  `throttle`,
  `updateTimeoutMs`,
  `skipDuplicateUpdate`,
  `maxTextLength`,
  `statusServerPort`,
  `statusServerHostname`,
  `optionsPage`,
  `cacheSession`,
  `cacheKeyboard`,
  `templateManager`,
  `log`,
  `sessionLock`
]
const OVERRIDE_SLOTS = [`cacheSession`, `cacheKeyboard`, `templateManager`, `log`, `sessionLock`]

export const DEFAULT_CONFIG: IGramstaxConfig = {deploy: `polling`}

export class GramstaxConfigLoader {
  /**
   * Load and validate `gramstax.config.ts` from the project root.
   *
   * @remarks
   * The single composition point for boot: there is no hand-written entry file, so
   * this method is what turns a project directory into config. A missing file is not
   * an error — it yields the defaults, which keeps a bare project bootable — but a
   * file that exists and cannot be imported is fatal, since silently falling back
   * would hide a typo in the path. The file is imported dynamically through a
   * `file://` URL, so loading TypeScript requires a TS-capable runtime (`bun --bun`).
   * The default export must be an object; a missing or non-object export is rejected.
   *
   * @param cwd - Absolute project root searched for `gramstax.config.ts`.
   * @returns The validated config, or `{deploy: "polling"}` when the file is absent.
   *
   * @throws Error when the config module cannot be imported.
   * @throws Error when the default export fails `_validateConfig`.
   *
   * @defaultValue `{deploy: "polling"}` when no config file exists
   *
   * @example
   * ```typescript
   * const config = await new GramstaxConfigLoader().loadConfig(projectRoot)
   * ```
   *
   * @public
   */
  async loadConfig(cwd: string): Promise<IGramstaxConfig> {
    const file = join(cwd, `gramstax.config.ts`)
    if (existsSync(file) === false) return {deploy: DEFAULT_CONFIG.deploy}
    const imported: {default?: unknown} = await import(pathToFileURL(file).href).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error)
      throw new Error(`Invalid gramstax config at ${file}: cannot load module (${detail})`)
    })
    return this._validateConfig(file, imported.default)
  }

  /**
   * Report which build-relevant keys the config sets explicitly.
   *
   * @remarks
   * Reads the raw default export without validating it, so `gramstax build
   * --dry-run` can still print a plan for a config that would fail to boot — the
   * point of dry-run is to show what the author wrote. Import failures are swallowed
   * and reported as "no file", since a plan is still more useful than a stack trace.
   * `url` is `true` when either the serverless adapter section or the `webhook`
   * branch supplies one, matching how `GramstaxBuild` resolves the url.
   *
   * @param cwd - Absolute project root searched for `gramstax.config.ts`.
   * @returns Provenance flags for `deploy`, the adapter key, `name` and `url`, plus whether the file exists.
   *
   * @public
   */
  async loadExplicitBuildKeys(cwd: string): Promise<IGramstaxExplicitBuildKeys> {
    const absent: IGramstaxExplicitBuildKeys = {hasFile: false, deploy: false, adapter: false, name: false, url: false}
    const file = join(cwd, `gramstax.config.ts`)
    if (existsSync(file) === false) return absent
    const imported: {default?: unknown} = await import(pathToFileURL(file).href).catch(() => ({default: undefined}))
    const record = imported.default
    if (typeof record !== `object` || record === null || Array.isArray(record) === true) return {...absent, hasFile: true}
    const raw = record as Record<string, unknown>
    const deployRoot = this._isRecord(raw.optionsDeploy) ? (raw.optionsDeploy as Record<string, unknown>) : undefined
    const serverless = deployRoot !== undefined && this._isRecord(deployRoot.serverless) ? (deployRoot.serverless as Record<string, unknown>) : undefined
    const webhook = deployRoot !== undefined && this._isRecord(deployRoot.webhook) ? (deployRoot.webhook as Record<string, unknown>) : undefined
    const adapterKey = serverless === undefined ? undefined : Object.keys(serverless).find((key) => GRAMSTAX_SERVERLESS_ADAPTERS.some((adapter) => adapter === key))
    const section = serverless === undefined || adapterKey === undefined ? undefined : serverless[adapterKey]
    return {hasFile: true, deploy: raw.deploy !== undefined, adapter: adapterKey !== undefined, name: this._isRecord(section) && section.name !== undefined, url: (this._isRecord(section) && section.url !== undefined) || webhook?.url !== undefined}
  }

  /**
   * Validate the config default export field by field.
   *
   * @remarks
   * Closed-world: any key outside `TOP_LEVEL_FIELDS` throws, so a typo like
   * `optionDeploy` fails at boot instead of being silently ignored. The result is
   * rebuilt from scratch rather than the input being passed through, which means
   * every field has been type-checked and only known keys can reach the bot.
   * `deploy` is validated before `optionsDeploy` so the branch-mismatch check
   * compares against the resolved mode rather than a default. The token is only
   * type-checked here — non-emptiness is enforced by `GramstaxStart`, which lets
   * `gramstax build` run without one.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param loaded - The config module's default export, of unknown type.
   * @returns A fresh `IGramstaxConfig` seeded with the default deploy mode.
   *
   * @throws Error when `loaded` is not an object.
   * @throws Error when any key outside `TOP_LEVEL_FIELDS` is present.
   * @throws Error when `deploy` is not one of the five supported modes.
   * @throws Error when any field fails its own section validator.
   *
   * @internal
   */
  _validateConfig(file: string, loaded: unknown): IGramstaxConfig {
    if (loaded === undefined || loaded === null || typeof loaded !== `object`) {
      throw new Error(`Invalid gramstax config at ${file}: default export must be an object with optional \`deploy\`, \`token\` and \`optionsDeploy\` sections`)
    }
    const record = loaded as Record<string, unknown>
    for (const key of Object.keys(record)) {
      if (TOP_LEVEL_FIELDS.includes(key) === false) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` (supported: ${TOP_LEVEL_FIELDS.join(`, `)})`)
      }
    }
    const config: IGramstaxConfig = {deploy: DEFAULT_CONFIG.deploy}
    // Empty allowed here: author pattern `process.env.X ?? ""` yields `""` when unset and env-less `gramstax build` must keep working.
    const token = record.token
    if (token !== undefined) {
      if (typeof token !== `string`) {
        throw new Error(`Invalid gramstax config at ${file}: \`token\` must be a string`)
      }
      config.token = token
    }
    const deploy = record.deploy
    if (deploy !== undefined) {
      if (typeof deploy !== `string` || GRAMSTAX_DEPLOY_MODE_SET.has(deploy) === false) {
        throw new Error(`Invalid gramstax config at ${file}: \`deploy\` must be one of ${GRAMSTAX_DEPLOY_MODES.join(`, `)} (got \`${String(deploy)}\`)`)
      }
      config.deploy = deploy
    }
    const optionsDeploy = record.optionsDeploy
    if (optionsDeploy !== undefined) {
      config.optionsDeploy = this._validateOptionsDeploy(file, optionsDeploy, config.deploy ?? DEFAULT_CONFIG.deploy ?? `polling`)
    }
    const mediaRoots = record.mediaRoots
    if (mediaRoots !== undefined) {
      if (mediaRoots !== null && (Array.isArray(mediaRoots) === false || (mediaRoots as Array<unknown>).some((root) => typeof root !== `string` || (root as string).length === 0))) {
        throw new Error(`Invalid gramstax config at ${file}: \`mediaRoots\` must be an array of non-empty strings or null`)
      }
      config.mediaRoots = mediaRoots as IGramstaxConfig[`mediaRoots`]
    }
    const botConfig = record.botConfig
    if (botConfig !== undefined) {
      if (this._isRecord(botConfig) === false) {
        throw new Error(`Invalid gramstax config at ${file}: \`botConfig\` must be an object`)
      }
      config.botConfig = botConfig as IGramstaxConfig[`botConfig`]
    }
    const autoRetry = record.autoRetry
    if (autoRetry !== undefined) {
      if (typeof autoRetry !== `boolean`) {
        throw new Error(`Invalid gramstax config at ${file}: \`autoRetry\` must be a boolean`)
      }
      config.autoRetry = autoRetry
    }
    const autoRetryOptions = record.autoRetryOptions
    if (autoRetryOptions !== undefined) {
      config.autoRetryOptions = this._validateAutoRetryOptions(file, autoRetryOptions)
    }
    const rateLimit = record.rateLimit
    if (rateLimit !== undefined) {
      config.rateLimit = this._validateRateLimit(file, rateLimit)
    }
    const throttle = record.throttle
    if (throttle !== undefined) {
      if (this._isRecord(throttle) === false) {
        throw new Error(`Invalid gramstax config at ${file}: \`throttle\` must be an object`)
      }
      config.throttle = throttle as IGramstaxConfig[`throttle`]
    }
    const updateTimeoutMs = record.updateTimeoutMs
    if (updateTimeoutMs !== undefined) {
      if (typeof updateTimeoutMs !== `number` || Number.isFinite(updateTimeoutMs) === false || updateTimeoutMs < 0) {
        throw new Error(`Invalid gramstax config at ${file}: \`updateTimeoutMs\` must be a non-negative number`)
      }
      config.updateTimeoutMs = updateTimeoutMs
    }
    const skipDuplicateUpdate = record.skipDuplicateUpdate
    if (skipDuplicateUpdate !== undefined) {
      if (typeof skipDuplicateUpdate !== `boolean`) {
        throw new Error(`Invalid gramstax config at ${file}: \`skipDuplicateUpdate\` must be a boolean`)
      }
      config.skipDuplicateUpdate = skipDuplicateUpdate
    }
    const maxTextLength = record.maxTextLength
    if (maxTextLength !== undefined) {
      if (typeof maxTextLength !== `number` || Number.isFinite(maxTextLength) === false || maxTextLength < 0) {
        throw new Error(`Invalid gramstax config at ${file}: \`maxTextLength\` must be a non-negative number`)
      }
      config.maxTextLength = maxTextLength
    }
    const statusServerPort = record.statusServerPort
    if (statusServerPort !== undefined) {
      if (typeof statusServerPort !== `number` || statusServerPort < 0 || statusServerPort > 65535) {
        throw new Error(`Invalid gramstax config at ${file}: \`statusServerPort\` must be between 0 and 65535`)
      }
      config.statusServerPort = statusServerPort
    }
    const statusServerHostname = record.statusServerHostname
    if (statusServerHostname !== undefined) {
      if (typeof statusServerHostname !== `string` || statusServerHostname.length === 0 || statusServerHostname.trim().length === 0) {
        throw new Error(`Invalid gramstax config at ${file}: \`statusServerHostname\` must be a non-empty string`)
      }
      config.statusServerHostname = statusServerHostname
    }
    const optionsPage = record.optionsPage
    if (optionsPage !== undefined) {
      config.optionsPage = this._validateOptionsPage(file, optionsPage)
    }
    const cacheSession = record.cacheSession
    if (cacheSession !== undefined) {
      config.cacheSession = this._validateCacheSession(file, cacheSession)
    }
    const cacheKeyboard = record.cacheKeyboard
    if (cacheKeyboard !== undefined) {
      config.cacheKeyboard = this._validateCacheKeyboard(file, cacheKeyboard)
    }
    const templateManager = record.templateManager
    if (templateManager !== undefined) {
      config.templateManager = this._validateTemplateManager(file, templateManager)
    }
    const log = record.log
    if (log !== undefined) {
      config.log = this._validateLog(file, log)
    }
    const sessionLock = record.sessionLock
    if (sessionLock !== undefined) {
      config.sessionLock = this._validateSessionLock(file, sessionLock)
    }
    return config
  }

  /**
   * Validate the `optionsDeploy` object and its branches.
   *
   * @remarks
   * Enforces the nested-branch contract: at most one branch may be non-empty, and
   * that branch must equal the resolved `deploy`. Emptiness is measured on the
   * validated output, so `raw: {}` and `test: {}` — which validate to empty objects
   * — do not count as a branch. The `deploy` parameter is threaded in from
   * `_validateConfig` rather than re-read here, so the CLI's `--deploy` flag and the
   * config are checked against the same value.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param value - Raw `optionsDeploy` value.
   * @param deploy - The resolved deploy mode the single branch must match.
   * @returns The validated `IGramstaxOptionsDeploy`.
   *
   * @throws Error when `value` is not an object.
   * @throws Error when a key other than `serverless`, `webhook`, `polling`, `raw` or `test` is present.
   * @throws Error when more than one branch is non-empty.
   * @throws Error when the single non-empty branch does not equal `deploy`.
   * @throws Error when `deploy` is `webhook` and the `webhook` branch fails `_requireWebhookBranch`.
   *
   * @internal
   */
  _validateOptionsDeploy(file: string, value: unknown, deploy: string): IGramstaxOptionsDeploy {
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy\` must be an object`)
    }
    for (const key of Object.keys(value)) {
      if (key !== `serverless` && key !== `webhook` && key !== `polling` && key !== `raw` && key !== `test`) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`optionsDeploy\` (supported: \`serverless\`, \`webhook\`, \`polling\`, \`raw\`, \`test\`)`)
      }
    }
    const out: IGramstaxOptionsDeploy = {}
    if (value.serverless !== undefined) {
      out.serverless = this._validateServerlessBranch(file, value.serverless)
    }
    if (value.webhook !== undefined) {
      out.webhook = this._validateWebhookBranch(file, value.webhook)
    }
    if (value.polling !== undefined) {
      out.polling = this._validatePollingBranch(file, value.polling)
    }
    if (value.raw !== undefined) {
      this._validateEmptyBranch(file, `raw`, value.raw)
      out.raw = {}
    }
    if (value.test !== undefined) {
      this._validateEmptyBranch(file, `test`, value.test)
      out.test = {}
    }
    const nonEmpty = Object.entries(out)
      .filter(([, branch]) => Object.keys(branch as Record<string, unknown>).length > 0)
      .map(([name]) => name)
    if (nonEmpty.length > 1) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy\` must define at most one deploy branch (got \`${nonEmpty.join(`\`, \``)}\`)`)
    }
    if (nonEmpty.length === 1 && nonEmpty[0] !== deploy) {
      throw new Error(`Invalid gramstax config at ${file}: optionsDeploy branch '${nonEmpty[0]}' does not match deploy '${deploy}'`)
    }
    if (deploy === `webhook`) {
      this._requireWebhookBranch(file, out.webhook)
    }
    return out
  }

  /**
   * Validate the `optionsDeploy.serverless` branch and dispatch to the adapter section.
   *
   * @remarks
   * The adapter is the key, so exactly one key from `GRAMSTAX_SERVERLESS_ADAPTERS`
   * must be present — zero means no adapter was chosen, more than one is ambiguous
   * since the emitted entry can only target one platform. Keys are sorted before the
   * count check purely so the error message is deterministic regardless of the order
   * the author wrote them in. Dispatch is on the adapter name, so an unrecognized
   * key is caught by the allowlist loop before reaching the ternary.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param value - Raw `serverless` branch value.
   * @returns A single-key object keyed by the adapter name, holding its validated section.
   *
   * @throws Error when `value` is not an object.
   * @throws Error when a key is not a known serverless adapter.
   * @throws Error when the adapter key count is not exactly one.
   * @throws Error when the adapter's section is not an object.
   * @throws Error when the adapter's section fails its own validation.
   *
   * @internal
   */
  _validateServerlessBranch(file: string, value: unknown): IGramstaxServerlessDeployOptions {
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless\` must be an object`)
    }
    const keys = Object.keys(value)
    for (const key of keys) {
      if (GRAMSTAX_SERVERLESS_ADAPTERS.some((adapter) => adapter === key) === false) {
        throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless\` has unknown adapter key \`${key}\` (supported: ${this._quoteList(GRAMSTAX_SERVERLESS_ADAPTERS)})`)
      }
    }
    // Sorted so the message is deterministic regardless of config key order.
    const sorted = [...keys].sort()
    if (sorted.length !== 1) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless\` must define exactly one adapter key (got ${sorted.length === 0 ? `none` : this._quoteList(sorted)})`)
    }
    const adapter = sorted[0] as string
    const section = value[adapter]
    if (this._isRecord(section) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless['${adapter}']\` must be an object`)
    }
    return adapter === `cloudflare-mod` ? {"cloudflare-mod": this._validateCloudflareModSection(file, section)} : {"aws-lambda-async": this._validateAwsLambdaAsyncSection(file, section)}
  }

  /**
   * Validate the `optionsDeploy.serverless['cloudflare-mod']` section.
   *
   * @remarks
   * The widest adapter section. `compatibilityFlags` is checked element-wise because
   * a single non-string entry would reach the platform bundler and fail there with
   * no mention of the config. The returned object is seeded with empty `url` and
   * `secretToken` so the required-field pass can overwrite them from the raw value,
   * which keeps the compiler satisfied without weakening the runtime check.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param value - Raw `cloudflare-mod` section value.
   * @returns A validated `IGramstaxCloudflareModOptions`.
   *
   * @throws Error when a key outside the `cloudflare-mod` allowlist is present.
   * @throws Error when `name` is not a string.
   * @throws Error when `compatibilityDate` is not a non-empty string.
   * @throws Error when `compatibilityFlags` is not an array of strings.
   * @throws Error when `toml` is not an object.
   * @throws Error when `url` or `secretToken` is missing, mistyped, or a placeholder.
   *
   * @internal
   */
  _validateCloudflareModSection(file: string, value: Record<string, unknown>): IGramstaxCloudflareModOptions {
    const path = `optionsDeploy.serverless['cloudflare-mod']`
    const allowed = GRAMSTAX_SERVERLESS_FIELDS["cloudflare-mod"]
    for (const key of Object.keys(value)) {
      if (allowed.includes(key) === false) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`${path}\` (supported: ${this._quoteList(allowed)})`)
      }
    }
    const out: IGramstaxCloudflareModOptions = {url: ``, secretToken: ``}
    if (value.name !== undefined) {
      if (typeof value.name !== `string`) {
        throw new Error(`Invalid gramstax config at ${file}: \`${path}.name\` must be a string`)
      }
      out.name = value.name
    }
    if (value.compatibilityDate !== undefined) {
      if (typeof value.compatibilityDate !== `string` || value.compatibilityDate.length === 0) {
        throw new Error(`Invalid gramstax config at ${file}: \`${path}.compatibilityDate\` must be a non-empty string`)
      }
      out.compatibilityDate = value.compatibilityDate
    }
    if (value.compatibilityFlags !== undefined) {
      if (Array.isArray(value.compatibilityFlags) === false || value.compatibilityFlags.some((flag) => typeof flag !== `string`)) {
        throw new Error(`Invalid gramstax config at ${file}: \`${path}.compatibilityFlags\` must be an array of strings`)
      }
      out.compatibilityFlags = value.compatibilityFlags as string[]
    }
    if (value.toml !== undefined) {
      if (this._isRecord(value.toml) === false) {
        throw new Error(`Invalid gramstax config at ${file}: \`${path}.toml\` must be an object`)
      }
      out.toml = value.toml
    }
    this._requireServerlessFields(file, path, value)
    out.url = value.url as string
    out.secretToken = value.secretToken as string
    return out
  }

  /**
   * Validate the `optionsDeploy.serverless['aws-lambda-async']` section.
   *
   * @remarks
   * The leanest adapter section: the allowlist from `GRAMSTAX_SERVERLESS_FIELDS` is
   * only `url` and `secretToken`, so there is nothing to type-check beyond
   * delegating to `_requireServerlessFields`. Contrast with the `cloudflare-mod`
   * section, which also validates the platform-specific fields.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param value - Raw `aws-lambda-async` section value.
   * @returns A validated `IGramstaxAwsLambdaAsyncOptions` carrying `url` and `secretToken`.
   *
   * @throws Error when a key other than `url` or `secretToken` is present.
   * @throws Error when `url` or `secretToken` is missing, mistyped, or a placeholder.
   *
   * @internal
   */
  _validateAwsLambdaAsyncSection(file: string, value: Record<string, unknown>): IGramstaxAwsLambdaAsyncOptions {
    const path = `optionsDeploy.serverless['aws-lambda-async']`
    const allowed = GRAMSTAX_SERVERLESS_FIELDS["aws-lambda-async"]
    for (const key of Object.keys(value)) {
      if (allowed.includes(key) === false) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`${path}\` (supported: ${this._quoteList(allowed)})`)
      }
    }
    this._requireServerlessFields(file, path, value)
    return {url: value.url as string, secretToken: value.secretToken as string}
  }

  /**
   * Presence + shape rules shared by every adapter section. Per the
   * hard-break contract a declared `serverless` section is a declaration of
   * intent to deploy serverless, so its mandatory fields are enforced here
   * rather than in a later pass — otherwise the branch-vs-deploy mismatch
   * check would fire first and hide the real problem.
   */
  _requireServerlessFields(file: string, path: string, value: Record<string, unknown>): void {
    if (value.url === undefined || value.url === ``) {
      throw new Error(
        `Invalid gramstax config at ${file}: \`${path}.url\` is required when \`deploy\` is \`serverless\` (fix: set \`optionsDeploy: {serverless: {${path.includes(`aws-lambda-async`) ? `'aws-lambda-async'` : `'cloudflare-mod'`}: {url: \`https://example.com/webhook\`, secretToken: \`<32+ chars>\`}}}\`)`
      )
    }
    if (typeof value.url !== `string`) {
      throw new Error(`Invalid gramstax config at ${file}: \`${path}.url\` must be a string`)
    }
    if (this._isRealUrl(value.url) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`${path}.url\` must be a real https:// URL with no \`<placeholder>\` (got \`${value.url}\`)`)
    }
    if (value.secretToken === undefined || value.secretToken === ``) {
      throw new Error(`Invalid gramstax config at ${file}: \`${path}.secretToken\` is required when \`deploy\` is \`serverless\` (fix: generate via \`openssl rand -hex 32\`)`)
    }
    if (typeof value.secretToken !== `string`) {
      throw new Error(`Invalid gramstax config at ${file}: \`${path}.secretToken\` must be a string`)
    }
    if (/^[A-Za-z0-9_-]{1,256}$/.test(value.secretToken) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`${path}.secretToken\` must match ^[A-Za-z0-9_-]{1,256}$ (got \`${value.secretToken}\`) (fix: generate via \`openssl rand -hex 32\`)`)
    }
  }

  /**
   * Format a list of names as a backticked, comma-separated string.
   *
   * @remarks
   * Exists so every "supported: ..." error message quotes its values identically —
   * backticks make the boundary visible in a terminal and keep a value containing
   * punctuation from reading as message prose.
   *
   * @param values - Names to format, typically an allowlist constant.
   * @returns The values wrapped in backticks and joined with `, `.
   *
   * @internal
   */
  _quoteList(values: readonly string[]): string {
    return values.map((value) => `\`${value}\``).join(`, `)
  }

  /**
   * Validate the `optionsDeploy.webhook` branch.
   *
   * @remarks
   * Presence and type checks only; the mandatory-field rules for
   * `deploy: "webhook"` live in `_requireWebhookBranch`, which runs later and only
   * when the deploy mode actually selects this branch.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param value - Raw `webhook` branch value.
   * @returns The validated `IGramstaxWebhookDeployOptions`.
   *
   * @throws Error when `value` is not an object.
   * @throws Error when a key other than `url`, `secretToken` or `queue` is present.
   * @throws Error when `url` or `secretToken` is not a string.
   * @throws Error when `queue` fails `_validateQueue`.
   *
   * @internal
   */
  _validateWebhookBranch(file: string, value: unknown): IGramstaxWebhookDeployOptions {
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.webhook\` must be an object`)
    }
    for (const key of Object.keys(value)) {
      if (key !== `url` && key !== `secretToken` && key !== `queue`) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`optionsDeploy.webhook\` (supported: \`url\`, \`secretToken\`, \`queue\`)`)
      }
    }
    const out: IGramstaxWebhookDeployOptions = {}
    if (value.url !== undefined) {
      if (typeof value.url !== `string`) {
        throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.webhook.url\` must be a string`)
      }
      out.url = value.url as string
    }
    if (value.secretToken !== undefined) {
      if (typeof value.secretToken !== `string`) {
        throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.webhook.secretToken\` must be a string`)
      }
      out.secretToken = value.secretToken as string
    }
    if (value.queue !== undefined) {
      out.queue = this._validateQueue(file, `optionsDeploy.webhook.queue`, value.queue)
    }
    return out
  }

  /**
   * Validate the `optionsDeploy.polling` branch.
   *
   * @remarks
   * Two optional fields. `maxRetries` admits `-1` as a distinct sentinel for
   * "retry forever" alongside any non-negative count, which is why the check cannot
   * simply be a range test. `queue` is delegated to `_validateQueue` — the same
   * validator the `webhook` branch uses — so both branches accept an identical
   * block under identical rules; there is deliberately no second copy of the
   * field list here.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param value - Raw `polling` branch value.
   * @returns The validated `IGramstaxPollingDeployOptions`.
   *
   * @throws Error when `value` is not an object.
   * @throws Error when a key other than `maxRetries` or `queue` is present.
   * @throws Error when `maxRetries` is neither `-1` nor a non-negative finite number.
   * @throws Error when `queue` fails `_validateQueue`.
   *
   * @internal
   */
  _validatePollingBranch(file: string, value: unknown): IGramstaxPollingDeployOptions {
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.polling\` must be an object`)
    }
    for (const key of Object.keys(value)) {
      if (key !== `maxRetries` && key !== `queue` && key !== `dropPendingUpdates`) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`optionsDeploy.polling\` (supported: \`maxRetries\`, \`queue\`, \`dropPendingUpdates\`)`)
      }
    }
    const out: IGramstaxPollingDeployOptions = {}
    if (value.maxRetries !== undefined) {
      if (typeof value.maxRetries !== `number` || Number.isFinite(value.maxRetries) === false || ((value.maxRetries as number) !== -1 && (value.maxRetries as number) < 0)) {
        throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.polling.maxRetries\` must be -1 or a non-negative number`)
      }
      out.maxRetries = value.maxRetries as number
    }
    if (value.dropPendingUpdates !== undefined) {
      if (typeof value.dropPendingUpdates !== `boolean`) {
        throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.polling.dropPendingUpdates\` must be a boolean`)
      }
      out.dropPendingUpdates = value.dropPendingUpdates
    }
    if (value.queue !== undefined) {
      out.queue = this._validateQueue(file, `optionsDeploy.polling.queue`, value.queue)
    }
    return out
  }

  /**
   * Reject any field in a deploy branch that is supposed to be empty.
   *
   * @remarks
   * Used for the `raw` and `test` branches, which exist only to signal intent in
   * `optionsDeploy` and take no settings. Keys explicitly set to `undefined` are
   * skipped so spreading an optional value in does not fail.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param branch - Branch name (`raw` or `test`), used in the error message.
   * @param value - Raw branch value, which must be an object with no defined keys.
   *
   * @throws Error when `value` is not an object.
   * @throws Error when any key is present with a value other than `undefined`.
   *
   * @internal
   */
  _validateEmptyBranch(file: string, branch: string, value: unknown): void {
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.${branch}\` must be an object`)
    }
    for (const key of Object.keys(value)) {
      if ((value as Record<string, unknown>)[key] === undefined) continue
      throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`optionsDeploy.${branch}\` (supported: (none))`)
    }
  }

  /**
   * Enforce the mandatory fields of a `deploy: "webhook"` branch.
   *
   * @remarks
   * Called only when `deploy` is `webhook`, which is why these fields are optional
   * in the type but mandatory in practice — the branch exists solely to describe a
   * webhook. Runs after the branch-vs-deploy match check so a mismatch is reported
   * first. `secretToken` is constrained to an unreserved-character set and capped at
   * 256 characters, matching what Telegram accepts, so an unusable token is
   * rejected at boot rather than at the first webhook call.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param branch - The validated `webhook` branch, or `undefined` when absent.
   *
   * @throws Error when `url` is missing.
   * @throws Error when `url` is not a real https URL free of `<placeholder>`.
   * @throws Error when `secretToken` is missing or empty.
   * @throws Error when `secretToken` does not match `^[A-Za-z0-9_-]{1,256}$`.
   *
   * @internal
   */
  _requireWebhookBranch(file: string, branch: IGramstaxWebhookDeployOptions | undefined): void {
    if (branch?.url === undefined) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.webhook.url\` is required when \`deploy\` is \`webhook\` (fix: set \`optionsDeploy: {webhook: {url: \`https://example.com/bot\`}}\`)`)
    }
    if (this._isRealUrl(branch.url as string) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.webhook.url\` must be a real https:// URL with no \`<placeholder>\` (got \`${String(branch.url)}\`)`)
    }
    if (branch.secretToken === undefined || (branch.secretToken as string).length === 0) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.webhook.secretToken\` is required when \`deploy\` is \`webhook\` (fix: generate via \`openssl rand -hex 32\`)`)
    }
    if (/^[A-Za-z0-9_-]{1,256}$/.test(branch.secretToken as string) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.webhook.secretToken\` must match ^[A-Za-z0-9_-]{1,256}$ (got \`${String(branch.secretToken)}\`) (fix: generate via \`openssl rand -hex 32\`)`)
    }
  }

  /**
   * Check that a url is a real http(s) URL and not an unfilled placeholder.
   *
   * @remarks
   * The `<` rejection is the point of this helper: a config left with a
   * `<placeholder>` passes a naive protocol check but produces a webhook url that
   * can never receive an update. Note the scheme test here is prefix-only, unlike
   * the stricter `GramstaxBuild._isRealUrl` which also requires a non-empty host.
   *
   * @param value - Candidate url string.
   * @returns `true` when `value` starts with `http://` or `https://` and contains no `<`.
   *
   * @internal
   */
  _isRealUrl(value: string): boolean {
    return /^https?:\/\//.test(value) === true && value.includes(`<`) === false
  }

  /**
   * Narrow a value to a plain object.
   *
   * @remarks
   * Arrays are excluded because every config section this guards against is an
   * object literal; letting an array through would turn a key check into an
   * index check.
   *
   * @param value - Candidate value of unknown type.
   * @returns `true` when `value` is a non-null, non-array object.
   *
   * @internal
   */
  _isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === `object` && value !== null && Array.isArray(value) === false
  }

  /**
   * Validate a module path ref shared by the ref-accepting config slots.
   *
   * @remarks
   * The shared grammar for every slot that can point at a user module: either a bare
   * path string, or `{override: {module, export?, args?}}`. The removed bare
   * `{module, ...}` form gets its own message naming the replacement, because it is
   * the most likely mistake after an upgrade. `field` is passed in rather than
   * hard-coded so the error names the actual slot the user wrote.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param field - Dotted config path of the slot being validated, used in error messages.
   * @param value - Raw slot value: a path string or `{override: {module, export?, args?}}`.
   * @returns The validated ref, normalized to the `{override: {module, ...}}` form.
   *
   * @throws Error when a string path is empty or whitespace-only.
   * @throws Error when the removed bare `{module, ...}` form is used.
   * @throws Error when `value` is neither a string nor an object carrying `override`.
   * @throws Error when a key other than `override` is present at the top level.
   * @throws Error when `override.module` is missing, not a string, or empty.
   * @throws Error when `override.export` is present but not a non-empty string.
   * @throws Error when `override.args` is present but not an array.
   * @throws Error when a key other than `module`, `export` or `args` is present inside `override`.
   *
   * @internal
   */
  _validatePathRef(file: string, field: string, value: unknown): IGramstaxPathRef {
    if (typeof value === `string`) {
      if (value.length === 0 || value.trim().length === 0) {
        throw new Error(`Invalid gramstax config at ${file}: \`${field}\` path must be a non-empty string`)
      }
      return value
    }
    if (this._isRecord(value) === true && `module` in value && `override` in value === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`${field}\` uses removed bare {module, ...} form — use {override: {module, ...}}`)
    }
    if (this._isRecord(value) === false || `override` in value === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`${field}\` must be a module path string or \`{override: {module, export?, args?}}\``)
    }
    for (const key of Object.keys(value)) {
      if (key !== `override`) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`${field}\` (supported: \`override\`)`)
      }
    }
    const inner: unknown = (value as Record<string, unknown>).override
    if (this._isRecord(inner) === false || typeof inner.module !== `string` || inner.module.length === 0 || (inner.module as string).trim().length === 0) {
      throw new Error(`Invalid gramstax config at ${file}: \`${field}\` must be a module path string or \`{override: {module, export?, args?}}\``)
    }
    const ref: IGramstaxModuleRef = {module: inner.module}
    if (inner.export !== undefined) {
      if (typeof inner.export !== `string` || inner.export.length === 0 || (inner.export as string).trim().length === 0) {
        throw new Error(`Invalid gramstax config at ${file}: \`${field}.override.export\` must be a non-empty string`)
      }
      ref.export = inner.export
    }
    if (inner.args !== undefined) {
      if (Array.isArray(inner.args) === false) {
        throw new Error(`Invalid gramstax config at ${file}: \`${field}.override.args\` must be an array`)
      }
      ref.args = inner.args
    }
    for (const key of Object.keys(inner)) {
      if (key !== `module` && key !== `export` && key !== `args`) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`${field}.override\` (supported: \`module\`, \`export\`, \`args\`)`)
      }
    }
    return {override: ref}
  }

  /**
   * Validate an `optionsDeploy.<branch>.queue` config section.
   *
   * @remarks
   * Shared by the `webhook` and `polling` branches so a queue block means
   * exactly the same thing under both — same allowed-key list, same numeric
   * bounds, same type checks. That parity is the point: the polling sink reuses
   * the webhook queue, so a config that validates under one branch must be
   * equally valid under the other. `path` is a parameter rather than a
   * hard-coded `optionsDeploy.webhook.queue` so every message names the branch
   * the author actually wrote.
   *
   * Unlike most sections the allowed-key list is inlined rather than referenced from
   * a shared constant, and `workerCount` is checked against `>= 1` while
   * `perChatConcurrency` allows `0`, which the bot reads as "skip the per-chat gate".
   * Every field is optional; the queue's own defaults apply when they are absent.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param path - Dotted config path of the queue section, used in error messages.
   * @param value - Raw `queue` value from the branch.
   * @returns The validated `IUpdateQueueConfig`.
   *
   * @throws Error when `value` is not an object.
   * @throws Error when an unknown key is present.
   * @throws Error when `enabled` or `blockWhenFull` is not a boolean.
   * @throws Error when `maxQueueSize` or `workerCount` is not a positive number.
   * @throws Error when `perChatConcurrency`, `enqueueTimeoutMs`, `waiterTimeoutMs` or `drainTimeoutMs` is not a non-negative number.
   *
   * @internal
   */
  _validateQueue(file: string, path: string, value: unknown): IUpdateQueueConfig {
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`${path}\` must be an object`)
    }
    for (const key of Object.keys(value)) {
      if ([`enabled`, `maxQueueSize`, `workerCount`, `perChatConcurrency`, `blockWhenFull`, `enqueueTimeoutMs`, `waiterTimeoutMs`, `drainTimeoutMs`].includes(key) === false) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`${path}\``)
      }
    }
    if (value.enabled !== undefined && typeof value.enabled !== `boolean`) {
      throw new Error(`Invalid gramstax config at ${file}: \`${path}.enabled\` must be a boolean`)
    }
    if (value.maxQueueSize !== undefined && (typeof value.maxQueueSize !== `number` || Number.isFinite(value.maxQueueSize) === false || (value.maxQueueSize as number) <= 0)) {
      throw new Error(`Invalid gramstax config at ${file}: \`${path}.maxQueueSize\` must be a positive number`)
    }
    if (value.workerCount !== undefined && (typeof value.workerCount !== `number` || Number.isFinite(value.workerCount) === false || (value.workerCount as number) < 1)) {
      throw new Error(`Invalid gramstax config at ${file}: \`${path}.workerCount\` must be a positive number`)
    }
    if (value.perChatConcurrency !== undefined && (typeof value.perChatConcurrency !== `number` || Number.isFinite(value.perChatConcurrency) === false || (value.perChatConcurrency as number) < 0)) {
      throw new Error(`Invalid gramstax config at ${file}: \`${path}.perChatConcurrency\` must be a non-negative number`)
    }
    if (value.blockWhenFull !== undefined && typeof value.blockWhenFull !== `boolean`) {
      throw new Error(`Invalid gramstax config at ${file}: \`${path}.blockWhenFull\` must be a boolean`)
    }
    if (value.enqueueTimeoutMs !== undefined && (typeof value.enqueueTimeoutMs !== `number` || Number.isFinite(value.enqueueTimeoutMs) === false || (value.enqueueTimeoutMs as number) < 0)) {
      throw new Error(`Invalid gramstax config at ${file}: \`${path}.enqueueTimeoutMs\` must be a non-negative number`)
    }
    if (value.waiterTimeoutMs !== undefined && (typeof value.waiterTimeoutMs !== `number` || Number.isFinite(value.waiterTimeoutMs) === false || (value.waiterTimeoutMs as number) < 0)) {
      throw new Error(`Invalid gramstax config at ${file}: \`${path}.waiterTimeoutMs\` must be a non-negative number`)
    }
    if (value.drainTimeoutMs !== undefined && (typeof value.drainTimeoutMs !== `number` || Number.isFinite(value.drainTimeoutMs) === false || (value.drainTimeoutMs as number) < 0)) {
      throw new Error(`Invalid gramstax config at ${file}: \`${path}.drainTimeoutMs\` must be a non-negative number`)
    }
    return value as IUpdateQueueConfig
  }

  /**
   * Validate the `autoRetryOptions` config section.
   *
   * @remarks
   * Only meaningful when `autoRetry` is also enabled, but it is validated
   * independently so a bad value is reported even when retry is currently off.
   * `maxRetryAttempts` must be at least `1`, since zero attempts is not a retry.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param value - Raw `autoRetryOptions` value.
   * @returns The validated `{maxRetryAttempts?, retryOnInternalServerErrors?}` object.
   *
   * @throws Error when `value` is not an object.
   * @throws Error when an unknown key is present.
   * @throws Error when `maxRetryAttempts` is not a number of at least `1`.
   * @throws Error when `retryOnInternalServerErrors` is not a boolean.
   *
   * @internal
   */
  _validateAutoRetryOptions(file: string, value: unknown): {maxRetryAttempts?: number; retryOnInternalServerErrors?: boolean} {
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`autoRetryOptions\` must be an object`)
    }
    for (const key of Object.keys(value)) {
      if (key !== `maxRetryAttempts` && key !== `retryOnInternalServerErrors`) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`autoRetryOptions\``)
      }
    }
    if (value.maxRetryAttempts !== undefined && (typeof value.maxRetryAttempts !== `number` || Number.isFinite(value.maxRetryAttempts) === false || (value.maxRetryAttempts as number) < 1)) {
      throw new Error(`Invalid gramstax config at ${file}: \`autoRetryOptions.maxRetryAttempts\` must be a positive number`)
    }
    if (value.retryOnInternalServerErrors !== undefined && typeof value.retryOnInternalServerErrors !== `boolean`) {
      throw new Error(`Invalid gramstax config at ${file}: \`autoRetryOptions.retryOnInternalServerErrors\` must be a boolean`)
    }
    return value as {maxRetryAttempts?: number; retryOnInternalServerErrors?: boolean}
  }

  /**
   * Validate the `rateLimit` config section.
   *
   * @remarks
   * Both `windowMs` and `max` are required — unlike most optional sections — because
   * a rate limiter with either half missing has no meaningful window or no
   * threshold, and silently defaulting either would turn a limit the author asked
   * for into one they did not.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param value - Raw `rateLimit` value.
   * @returns The validated `IRateLimitOptions`.
   *
   * @throws Error when `value` is not an object.
   * @throws Error when an unknown key is present.
   * @throws Error when `windowMs` is not a positive number.
   * @throws Error when `max` is not a positive number.
   *
   * @internal
   */
  _validateRateLimit(file: string, value: unknown): IRateLimitOptions {
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`rateLimit\` must be an object`)
    }
    for (const key of Object.keys(value)) {
      if (key !== `windowMs` && key !== `max`) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`rateLimit\``)
      }
    }
    if (typeof value.windowMs !== `number` || Number.isFinite(value.windowMs) === false || (value.windowMs as number) <= 0) {
      throw new Error(`Invalid gramstax config at ${file}: \`rateLimit.windowMs\` must be a positive number`)
    }
    if (typeof value.max !== `number` || Number.isFinite(value.max) === false || (value.max as number) <= 0) {
      throw new Error(`Invalid gramstax config at ${file}: \`rateLimit.max\` must be a positive number`)
    }
    return value as IRateLimitOptions
  }

  /**
   * Validate the `optionsPage` config section.
   *
   * @remarks
   * Currently a single flag, `shortCallbackQueryData`. Every other key is rejected
   * so a misspelled option does not silently do nothing.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param value - Raw `optionsPage` value.
   * @returns The validated `{shortCallbackQueryData?}` object.
   *
   * @throws Error when `value` is not an object.
   * @throws Error when an unknown key is present.
   * @throws Error when `shortCallbackQueryData` is not a boolean.
   *
   * @internal
   */
  _validateOptionsPage(file: string, value: unknown): {shortCallbackQueryData?: boolean} {
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsPage\` must be an object`)
    }
    for (const key of Object.keys(value)) {
      if (key !== `shortCallbackQueryData`) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`optionsPage\``)
      }
    }
    if (value.shortCallbackQueryData !== undefined && typeof value.shortCallbackQueryData !== `boolean`) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsPage.shortCallbackQueryData\` must be a boolean`)
    }
    return value as {shortCallbackQueryData?: boolean}
  }

  /**
   * Validate the `cacheSession` config section.
   *
   * @remarks
   * Two disjoint forms: a module ref, or inline store options. `store` is required
   * in the inline form because a session cache with no backing store cannot
   * function, and it is validated as a non-empty string rather than left to the
   * `CacheExternal` constructor to reject later with a less specific message.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param value - Raw `cacheSession` value: store options or a module ref.
   * @returns A validated `IGramstaxCacheSessionRef`.
   *
   * @throws Error when `value` is neither a module ref nor a store-options object.
   * @throws Error when an unknown key is present.
   * @throws Error when `store` is not a non-empty string.
   * @throws Error when `ttlMs` is not a non-negative number.
   * @throws Error when `namespace` is not a string.
   *
   * @internal
   */
  _validateCacheSession(file: string, value: unknown): IGramstaxCacheSessionRef {
    if (this._isRecord(value) === true && `module` in value && `override` in value === false) {
      return this._validatePathRef(file, `cacheSession`, value)
    }
    if (typeof value === `string` || (this._isRecord(value) === true && `override` in value)) {
      return this._validatePathRef(file, `cacheSession`, value)
    }
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`cacheSession\` must be a module path string, \`{override: {module, export?, args?}}\`, or \`{store, ttlMs?, namespace?}\``)
    }
    for (const key of Object.keys(value)) {
      if (key !== `store` && key !== `ttlMs` && key !== `namespace`) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`cacheSession\` (supported: \`store\`, \`ttlMs\`, \`namespace\`)`)
      }
    }
    if (typeof value.store !== `string` || value.store.length === 0) {
      throw new Error(`Invalid gramstax config at ${file}: \`cacheSession.store\` must be a non-empty string`)
    }
    if (value.ttlMs !== undefined && (typeof value.ttlMs !== `number` || Number.isFinite(value.ttlMs) === false || (value.ttlMs as number) < 0)) {
      throw new Error(`Invalid gramstax config at ${file}: \`cacheSession.ttlMs\` must be a non-negative number`)
    }
    if (value.namespace !== undefined && typeof value.namespace !== `string`) {
      throw new Error(`Invalid gramstax config at ${file}: \`cacheSession.namespace\` must be a string`)
    }
    return value as {store: string; ttlMs?: number; namespace?: string}
  }

  /**
   * Validate the `cacheKeyboard` config section.
   *
   * @remarks
   * Three shapes are accepted and none are deeply validated: a module ref, an
   * entries array, or a plain object. The array and object forms are passed
   * through unchecked because the keyboard payloads are opaque to the framework —
   * `new Map(...)` at materialization is where their shape matters, and rejecting
   * unknown keys here would break forward compatibility with new keyboard payloads.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param value - Raw `cacheKeyboard` value.
   * @returns A validated `IGramstaxCacheKeyboardRef`.
   *
   * @throws Error when `value` is neither a module ref, nor an entries array, nor a plain object.
   *
   * @internal
   */
  _validateCacheKeyboard(file: string, value: unknown): IGramstaxCacheKeyboardRef {
    if (this._isRecord(value) === true && `module` in value && `override` in value === false) {
      return this._validatePathRef(file, `cacheKeyboard`, value) as IGramstaxCacheKeyboardRef
    }
    if (typeof value === `string` || (this._isRecord(value) === true && `override` in value)) {
      return this._validatePathRef(file, `cacheKeyboard`, value) as IGramstaxCacheKeyboardRef
    }
    if (Array.isArray(value) === true) return value as Array<[string, unknown]>
    if (this._isRecord(value) === true) return value as Record<string, unknown>
    throw new Error(`Invalid gramstax config at ${file}: \`cacheKeyboard\` must be a module path string, \`{override: {module, export?, args?}}\`, an entries array, or a plain object`)
  }

  /**
   * Validate the `templateManager` config section.
   *
   * @remarks
   * Accepts either a module ref or inline `ITemplateOptions`. `path` is required
   * when inline and must be a non-empty array of non-empty strings, because a
   * template manager with no directories can never find a template. `onReload` is
   * checked for `function` only — its signature is not verified here.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param value - Raw `templateManager` value: inline options or a module ref.
   * @returns A validated `IGramstaxTemplateManagerRef`.
   *
   * @throws Error when `value` is neither a module ref nor an object.
   * @throws Error when an unknown key is present.
   * @throws Error when `path` is not a non-empty array of non-empty strings.
   * @throws Error when `enableWatch` is not a boolean.
   * @throws Error when `watchOptions` is not an object.
   * @throws Error when `onReload` is not a function.
   *
   * @internal
   */
  _validateTemplateManager(file: string, value: unknown): IGramstaxTemplateManagerRef {
    if (this._isRecord(value) === true && `module` in value && `override` in value === false) {
      return this._validatePathRef(file, `templateManager`, value) as IGramstaxTemplateManagerRef
    }
    if (typeof value === `string` || (this._isRecord(value) === true && `override` in value)) {
      return this._validatePathRef(file, `templateManager`, value) as IGramstaxTemplateManagerRef
    }
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`templateManager\` must be a module path string, \`{override: {module, export?, args?}}\`, or template options with \`path\``)
    }
    for (const key of Object.keys(value)) {
      if (key !== `path` && key !== `enableWatch` && key !== `watchOptions` && key !== `onReload`) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`templateManager\``)
      }
    }
    if (Array.isArray(value.path) === false || (value.path as Array<unknown>).length === 0 || (value.path as Array<unknown>).some((entry) => typeof entry !== `string` || (entry as string).length === 0)) {
      throw new Error(`Invalid gramstax config at ${file}: \`templateManager.path\` must be a non-empty array of non-empty strings`)
    }
    if (value.enableWatch !== undefined && typeof value.enableWatch !== `boolean`) {
      throw new Error(`Invalid gramstax config at ${file}: \`templateManager.enableWatch\` must be a boolean`)
    }
    if (value.watchOptions !== undefined && this._isRecord(value.watchOptions) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`templateManager.watchOptions\` must be an object`)
    }
    if (value.onReload !== undefined && typeof value.onReload !== `function`) {
      throw new Error(`Invalid gramstax config at ${file}: \`templateManager.onReload\` must be a function`)
    }
    return value as unknown as ITemplateOptions
  }

  /**
   * Validate the `log` config section.
   *
   * @remarks
   * A boolean is returned as-is: `true` means "use the default logger" and `false`
   * means "no logging", both handled at materialization rather than here. Among the
   * object forms, `force` is constrained to three literals so a typo cannot silently
   * fall back to console output on a host where the author expected a file.
   * `pathFile` explicitly accepts `null`, meaning "no file output".
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param value - Raw `log` value: a boolean, logger options, or a module ref.
   * @returns A validated `IGramstaxLogRef`.
   *
   * @throws Error when `value` is neither a boolean, a module ref, nor an object.
   * @throws Error when an unknown key is present.
   * @throws Error when `pathFile` is neither a string nor `null`.
   * @throws Error when `force` is not `console`, `file` or `all`.
   * @throws Error when `formatTime` is not a string.
   *
   * @internal
   */
  _validateLog(file: string, value: unknown): IGramstaxLogRef {
    if (typeof value === `boolean`) return value
    if (this._isRecord(value) === true && `module` in value && `override` in value === false) {
      return this._validatePathRef(file, `log`, value) as IGramstaxLogRef
    }
    if (typeof value === `string` || (this._isRecord(value) === true && `override` in value)) {
      return this._validatePathRef(file, `log`, value) as IGramstaxLogRef
    }
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`log\` must be a boolean, a module path string, \`{override: {module, export?, args?}}\`, or logger options`)
    }
    for (const key of Object.keys(value)) {
      if (key !== `pathFile` && key !== `force` && key !== `formatTime`) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`log\` (supported: \`pathFile\`, \`force\`, \`formatTime\`)`)
      }
    }
    if (value.pathFile !== undefined && value.pathFile !== null && typeof value.pathFile !== `string`) {
      throw new Error(`Invalid gramstax config at ${file}: \`log.pathFile\` must be a string or null`)
    }
    if (value.force !== undefined && value.force !== `console` && value.force !== `file` && value.force !== `all`) {
      throw new Error(`Invalid gramstax config at ${file}: \`log.force\` must be one of \`console\`, \`file\`, \`all\``)
    }
    if (value.formatTime !== undefined && typeof value.formatTime !== `string`) {
      throw new Error(`Invalid gramstax config at ${file}: \`log.formatTime\` must be a string`)
    }
    return value as {pathFile?: string | null; force?: `console` | `file` | `all`; formatTime?: string}
  }

  /**
   * Validate the `sessionLock` config section.
   *
   * @remarks
   * Copies only the three known keys onto a fresh object rather than passing the
   * raw value through, so the returned type cannot smuggle in unvalidated fields.
   * `key` is delegated to `_validatePathRef` because it is a module ref, not inline
   * data; note that `args` on that ref is rejected later, at materialization.
   *
   * @param file - Absolute config file path, used as the error-message prefix.
   * @param value - Raw `sessionLock` value from the config's default export.
   * @returns A validated `IGramstaxSessionLockRef` carrying only the keys that were set.
   *
   * @throws Error when `value` is not an object.
   * @throws Error when an unknown key is present.
   * @throws Error when `enabled` is not a boolean.
   * @throws Error when `leaseMs` is not a positive number.
   * @throws Error when `onContended` is not one of `skip`, `wait`, `serialize`.
   * @throws Error when `key` is not a valid module ref.
   *
   * @internal
   */
  _validateSessionLock(file: string, value: unknown): IGramstaxSessionLockRef {
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`sessionLock\` must be an object`)
    }
    for (const key of Object.keys(value)) {
      if (key !== `enabled` && key !== `leaseMs` && key !== `onContended` && key !== `key`) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`sessionLock\``)
      }
    }
    if (value.enabled !== undefined && typeof value.enabled !== `boolean`) {
      throw new Error(`Invalid gramstax config at ${file}: \`sessionLock.enabled\` must be a boolean`)
    }
    if (value.leaseMs !== undefined && (typeof value.leaseMs !== `number` || Number.isFinite(value.leaseMs) === false || (value.leaseMs as number) <= 0)) {
      throw new Error(`Invalid gramstax config at ${file}: \`sessionLock.leaseMs\` must be a positive number`)
    }
    if (value.onContended !== undefined && value.onContended !== `skip` && value.onContended !== `wait` && value.onContended !== `serialize`) {
      throw new Error(`Invalid gramstax config at ${file}: \`sessionLock.onContended\` must be one of \`skip\`, \`wait\`, \`serialize\``)
    }
    const ref: IGramstaxSessionLockRef = {}
    if (value.enabled !== undefined) ref.enabled = value.enabled as boolean
    if (value.leaseMs !== undefined) ref.leaseMs = value.leaseMs as number
    if (value.onContended !== undefined) ref.onContended = value.onContended as ISessionLockOnContended
    if (value.key !== undefined) ref.key = this._validatePathRef(file, `sessionLock.key`, value.key)
    return ref
  }
}

/**
 * Names of the INSTANCE override slots ignored on edge builds.
 *
 * @remarks
 * Used by `gramstax build` for the R3a guardrail warning: when the config
 * carries any of these slots and the target set includes
 * `cloudflare-workers` (or no `--target`), the build prints a non-blocking
 * warning naming the ignored slot(s).
 *
 * @public
 */
export const CONFIG_OVERRIDE_SLOTS: string[] = [...OVERRIDE_SLOTS]
