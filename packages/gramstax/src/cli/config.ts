import {existsSync} from "node:fs"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import type {IRateLimitOptions, IWebhookQueueConfig} from "~/types/bot"
import type {IGramstaxCacheKeyboardRef, IGramstaxCacheSessionRef, IGramstaxConfig, IGramstaxExplicitBuildKeys, IGramstaxLogRef, IGramstaxModuleRef, IGramstaxOptionsDeploy, IGramstaxPathRef, IGramstaxPollingDeployOptions, IGramstaxServerlessDeployOptions, IGramstaxSessionLockRef, IGramstaxTemplateManagerRef, IGramstaxWebhookDeployOptions} from "~/types/config"
import type {ISessionLockOnContended} from "~/types/session-lock"
import type {ITemplateOptions} from "~/types/template"

const VALID_ADAPTERS = [`cloudflare-mod`, `aws-lambda-async`]
const VALID_DEPLOYS = [`polling`, `webhook`, `serverless`, `raw`, `test`]
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
  async loadConfig(cwd: string): Promise<IGramstaxConfig> {
    const file = join(cwd, `gramstax.config.ts`)
    if (existsSync(file) === false) return {deploy: DEFAULT_CONFIG.deploy}
    const imported: {default?: unknown} = await import(pathToFileURL(file).href).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error)
      throw new Error(`Invalid gramstax config at ${file}: cannot load module (${detail})`)
    })
    return this._validateConfig(file, imported.default)
  }

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
    return {hasFile: true, deploy: raw.deploy !== undefined, adapter: serverless?.adapter !== undefined, name: serverless?.name !== undefined, url: serverless?.url !== undefined || webhook?.url !== undefined}
  }

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
      if (typeof deploy !== `string` || VALID_DEPLOYS.includes(deploy) === false) {
        throw new Error(`Invalid gramstax config at ${file}: \`deploy\` must be one of polling, webhook, serverless, raw, test (got \`${String(deploy)}\`)`)
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
    const nonEmpty = Object.entries(out).filter(([, branch]) => Object.keys(branch as Record<string, unknown>).length > 0).map(([name]) => name)
    if (nonEmpty.length > 1) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy\` must define at most one deploy branch (got \`${nonEmpty.join(`\`, \``)}\`)`)
    }
    if (nonEmpty.length === 1 && nonEmpty[0] !== deploy) {
      throw new Error(`Invalid gramstax config at ${file}: optionsDeploy branch '${nonEmpty[0]}' does not match deploy '${deploy}'`)
    }
    if (deploy === `webhook`) {
      this._requireWebhookBranch(file, out.webhook)
    }
    if (deploy === `serverless`) {
      this._requireServerlessBranch(file, out.serverless)
    }
    return out
  }

  _validateServerlessBranch(file: string, value: unknown): IGramstaxServerlessDeployOptions {
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless\` must be an object`)
    }
    for (const key of Object.keys(value)) {
      if (key !== `adapter` && key !== `name` && key !== `url` && key !== `secretToken`) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`optionsDeploy.serverless\` (supported: \`adapter\`, \`name\`, \`url\`, \`secretToken\`)`)
      }
    }
    const out: IGramstaxServerlessDeployOptions = {}
    if (value.adapter !== undefined) {
      if (typeof value.adapter !== `string` || VALID_ADAPTERS.includes(value.adapter as string) === false) {
        throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless.adapter\` must be one of cloudflare-mod, aws-lambda-async (got \`${String(value.adapter)}\`)`)
      }
      out.adapter = value.adapter as string
    }
    if (value.name !== undefined) {
      if (typeof value.name !== `string`) {
        throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless.name\` must be a string`)
      }
      out.name = value.name as string
    }
    if (value.url !== undefined) {
      if (typeof value.url !== `string`) {
        throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless.url\` must be a string`)
      }
      out.url = value.url as string
    }
    if (value.secretToken !== undefined) {
      if (typeof value.secretToken !== `string`) {
        throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless.secretToken\` must be a string`)
      }
      out.secretToken = value.secretToken as string
    }
    return out
  }

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
      out.queue = this._validateWebhookQueue(file, value.queue)
    }
    return out
  }

  _validatePollingBranch(file: string, value: unknown): IGramstaxPollingDeployOptions {
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.polling\` must be an object`)
    }
    for (const key of Object.keys(value)) {
      if (key !== `maxRetries`) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`optionsDeploy.polling\` (supported: \`maxRetries\`)`)
      }
    }
    const out: IGramstaxPollingDeployOptions = {}
    if (value.maxRetries !== undefined) {
      if (typeof value.maxRetries !== `number` || Number.isFinite(value.maxRetries) === false || ((value.maxRetries as number) !== -1 && (value.maxRetries as number) < 0)) {
        throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.polling.maxRetries\` must be -1 or a non-negative number`)
      }
      out.maxRetries = value.maxRetries as number
    }
    return out
  }

  _validateEmptyBranch(file: string, branch: string, value: unknown): void {
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.${branch}\` must be an object`)
    }
    for (const key of Object.keys(value)) {
      if ((value as Record<string, unknown>)[key] === undefined) continue
      throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`optionsDeploy.${branch}\` (supported: (none))`)
    }
  }

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

  _requireServerlessBranch(file: string, branch: IGramstaxServerlessDeployOptions | undefined): void {
    if (branch?.adapter === undefined || VALID_ADAPTERS.includes(branch.adapter as string) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless.adapter\` must be one of cloudflare-mod, aws-lambda-async (got \`${String(branch?.adapter)}\`)`)
    }
    if (branch?.url === undefined) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless.url\` is required when \`deploy\` is \`serverless\` (fix: set \`optionsDeploy: {serverless: {adapter: \`cloudflare-mod\`, url: \`https://example.com/webhook\`}}\`)`)
    }
    if (this._isRealUrl(branch.url as string) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless.url\` must be a real https:// URL with no \`<placeholder>\` (got \`${String(branch.url)}\`)`)
    }
    if (branch.secretToken === undefined || (branch.secretToken as string).length === 0) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless.secretToken\` is required when \`deploy\` is \`serverless\` (fix: generate via \`openssl rand -hex 32\`)`)
    }
    if (/^[A-Za-z0-9_-]{1,256}$/.test(branch.secretToken as string) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless.secretToken\` must match ^[A-Za-z0-9_-]{1,256}$ (got \`${String(branch.secretToken)}\`) (fix: generate via \`openssl rand -hex 32\`)`)
    }
  }

  _isRealUrl(value: string): boolean {
    return /^https?:\/\//.test(value) === true && value.includes(`<`) === false
  }

  _isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === `object` && value !== null && Array.isArray(value) === false
  }

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

  _validateWebhookQueue(file: string, value: unknown): IWebhookQueueConfig {
    if (this._isRecord(value) === false) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.webhook.queue\` must be an object`)
    }
    for (const key of Object.keys(value)) {
      if ([`enabled`, `maxQueueSize`, `workerCount`, `perChatConcurrency`, `blockWhenFull`, `enqueueTimeoutMs`, `waiterTimeoutMs`].includes(key) === false) {
        throw new Error(`Invalid gramstax config at ${file}: unknown field \`${key}\` in \`optionsDeploy.webhook.queue\``)
      }
    }
    if (value.enabled !== undefined && typeof value.enabled !== `boolean`) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.webhook.queue.enabled\` must be a boolean`)
    }
    if (value.maxQueueSize !== undefined && (typeof value.maxQueueSize !== `number` || Number.isFinite(value.maxQueueSize) === false || (value.maxQueueSize as number) <= 0)) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.webhook.queue.maxQueueSize\` must be a positive number`)
    }
    if (value.workerCount !== undefined && (typeof value.workerCount !== `number` || Number.isFinite(value.workerCount) === false || (value.workerCount as number) < 1)) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.webhook.queue.workerCount\` must be a positive number`)
    }
    if (value.perChatConcurrency !== undefined && (typeof value.perChatConcurrency !== `number` || Number.isFinite(value.perChatConcurrency) === false || (value.perChatConcurrency as number) < 0)) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.webhook.queue.perChatConcurrency\` must be a non-negative number`)
    }
    if (value.blockWhenFull !== undefined && typeof value.blockWhenFull !== `boolean`) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.webhook.queue.blockWhenFull\` must be a boolean`)
    }
    if (value.enqueueTimeoutMs !== undefined && (typeof value.enqueueTimeoutMs !== `number` || Number.isFinite(value.enqueueTimeoutMs) === false || (value.enqueueTimeoutMs as number) < 0)) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.webhook.queue.enqueueTimeoutMs\` must be a non-negative number`)
    }
    if (value.waiterTimeoutMs !== undefined && (typeof value.waiterTimeoutMs !== `number` || Number.isFinite(value.waiterTimeoutMs) === false || (value.waiterTimeoutMs as number) < 0)) {
      throw new Error(`Invalid gramstax config at ${file}: \`optionsDeploy.webhook.queue.waiterTimeoutMs\` must be a non-negative number`)
    }
    return value as IWebhookQueueConfig
  }

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
