import type {APIThrottlerOptions} from "@grammyjs/transformer-throttler"
import type {BotConfig, Context} from "grammy"
import type {IRateLimitOptions, IWebhookQueueConfig} from "./bot"
import type {ISessionLockOnContended} from "./session-lock"
import type {ITemplateOptions} from "./template"

/**
 * File-path reference to a class or value living in a project module.
 *
 * @remarks
 * A bare string resolves the module's default export with zero arguments.
 * The object form picks a named export and spreads `args` into the
 * constructor. Paths resolve relative to the project root (cwd).
 * Materialized only by `gramstax start` — never by `gramstax build`.
 *
 * @example
 * ```typescript
 * const ref: IGramstaxModuleRef = {module: `./src/cache.ts`}
 * const named: IGramstaxModuleRef = {module: `./src/cache.ts`, export: `RedisCache`, args: [`redis://localhost:6379`]}
 * ```
 *
 * @public
 */
export type IGramstaxModuleRef = {
  /**
   * Module path relative to the project root.
   *
   * @remarks
   * Must be a non-empty string. Resolves relative to the project root (cwd).
   *
   * @example
   * ```typescript
   * module: `./src/cache.ts`
   * ```
   */
  module: string
  /**
   * Named export to use.
   *
   * @remarks
   * Must be a non-empty string when present. Resolves the named export
   * instead of the module's default export.
   *
   * @defaultValue `default` (the module's default export)
   *
   * @example
   * ```typescript
   * export: `RedisCache`
   * ```
   */
  export?: string
  /**
   * Constructor arguments spread into `new Export(...args)`.
   *
   * @remarks
   * Must be an array when present. Each entry is passed positionally to
   * the resolved export's constructor.
   *
   * @example
   * ```typescript
   * args: [`redis://localhost:6379`, 3600000]
   * ```
   */
  args?: unknown[]
}

/**
 * Either a bare module path (default export, zero-arg) or a full module ref.
 *
 * @remarks
 * The string form must be a non-empty string resolving relative to the
 * project root. The object form is an {@link IGramstaxModuleRef} with
 * `module`, optional `export`, and optional `args`; unknown fields are
 * rejected by the loader.
 *
 * @example
 * ```typescript
 * const bare: IGramstaxPathRef = `./src/cache.ts`
 * const full: IGramstaxPathRef = {module: `./src/cache.ts`, export: `RedisCache`}
 * ```
 *
 * @public
 */
export type IGramstaxPathRef = string | IGramstaxModuleRef

/**
 * `cacheSession` slot: a path-ref to a `CacheExternal` subclass, or builtin
 * params mirrored from the real constructor `(store, ttlMs, namespace?)`.
 *
 * @remarks
 * Three accepted shapes (enforced by the loader):
 * - a module path string resolving to a `CacheExternal` subclass
 * - a `{module, export?, args?}` ref resolving to a `CacheExternal` subclass
 * - builtin params `{store, ttlMs?, namespace?}` passed to `new CacheExternal(params)`
 *
 * @example
 * ```typescript
 * const fromPath: IGramstaxCacheSessionRef = `./src/session-cache.ts`
 * const builtin: IGramstaxCacheSessionRef = {store: `redis://localhost:6379`, ttlMs: 3600000}
 * ```
 *
 * @public
 */
export type IGramstaxCacheSessionRef = IGramstaxPathRef | {store: string; ttlMs?: number; namespace?: string}

/**
 * `cacheKeyboard` slot: a path-ref to a `Map` subclass, an entries array, or
 * a plain object (entries via `Object.entries`).
 *
 * @remarks
 * Four accepted shapes (enforced by the loader):
 * - a module path string resolving to a `Map` subclass
 * - a `{module, export?, args?}` ref resolving to a `Map` subclass
 * - an entries array (`Array<[string, unknown]>`) used as `new Map(entries)`
 * - a plain object whose entries seed the map via `Object.entries`
 *
 * @example
 * ```typescript
 * const fromPath: IGramstaxCacheKeyboardRef = `./src/keyboard-cache.ts`
 * const entries: IGramstaxCacheKeyboardRef = [[`main:en`, {text: `Main`}]]
 * const plain: IGramstaxCacheKeyboardRef = {[`main:en`]: {text: `Main`}}
 * ```
 *
 * @public
 */
export type IGramstaxCacheKeyboardRef = IGramstaxPathRef | Array<[string, unknown]> | Record<string, unknown>

/**
 * `templateManager` slot: a path-ref to a `TemplateManager` subclass, or
 * builtin `ITemplateOptions` passed to `new TemplateManager(params)`.
 *
 * @remarks
 * Three accepted shapes (enforced by the loader):
 * - a module path string resolving to a `TemplateManager` subclass
 * - a `{module, export?, args?}` ref resolving to a `TemplateManager` subclass
 * - builtin template options (`path`, `enableWatch?`, `watchOptions?`, `onReload?`)
 *   passed to `new TemplateManager(params)` — `path` must be a non-empty
 *   array of non-empty strings, `enableWatch` a boolean, `watchOptions` an
 *   object, `onReload` a function. Unknown fields are rejected.
 *
 * @example
 * ```typescript
 * const fromPath: IGramstaxTemplateManagerRef = `./src/templates.ts`
 * const builtin: IGramstaxTemplateManagerRef = {path: [`./src/pages`], enableWatch: true}
 * ```
 *
 * @public
 */
export type IGramstaxTemplateManagerRef = IGramstaxPathRef | ITemplateOptions

/**
 * `log` slot: `true` for the default logger, `false`/omitted for silent,
 * otherwise a path-ref (or logger options) resolving to a `LoggingHelper`.
 *
 * @remarks
 * Four accepted shapes (enforced by the loader):
 * - a boolean (`true` mounts the default logger, `false` stays silent)
 * - a module path string resolving to a `LoggingHelper`
 * - a `{module, export?, args?}` ref resolving to a `LoggingHelper`
 * - logger options `{pathFile?, force?, formatTime?}` — `pathFile` is a
 *   string or `null`, `force` is one of `console`, `file`, `all`,
 *   `formatTime` is a string. Unknown fields are rejected.
 *
 * @example
 * ```typescript
 * const silent: IGramstaxLogRef = false
 * const file: IGramstaxLogRef = {pathFile: `./logs/bot.log`, force: `all`}
 * ```
 *
 * @public
 */
export type IGramstaxLogRef = boolean | IGramstaxPathRef | {pathFile?: string | null; force?: `console` | `file` | `all`; formatTime?: string}

/**
 * `sessionLock` slot: scalars plus an optional `key` factory given as a
 * path-ref resolving to `(ctx) => string`.
 *
 * @remarks
 * Must be an object when present — unknown fields are rejected by the loader.
 * The optional `key` factory is a path-ref (bare string or
 * `{module, export?, args?}`) resolving to a `(ctx) => string` function.
 *
 * @example
 * ```typescript
 * const lock: IGramstaxSessionLockRef = {enabled: true, leaseMs: 5000, onContended: `skip`}
 * ```
 *
 * @public
 */
export type IGramstaxSessionLockRef = {
  /**
   * Master switch for the distributed session lock.
   *
   * @remarks
   * Must be a boolean when present. `false` disables locking even when
   * other fields are set.
   *
   * @example
   * ```typescript
   * enabled: true
   * ```
   */
  enabled?: boolean
  /**
   * Lease duration in milliseconds.
   *
   * @remarks
   * Must be a positive number when present. The lock auto-expires after
   * this long so a crashed instance cannot hold a session forever.
   *
   * @example
   * ```typescript
   * leaseMs: 5000
   * ```
   */
  leaseMs?: number
  /**
   * Contention behavior when the session key is already locked.
   *
   * @remarks
   * Accepted values: `skip` (drop the contended update), `wait` (retry
   * until the lease frees), `serialize` (queue per key).
   *
   * @example
   * ```typescript
   * onContended: `skip`
   * ```
   */
  onContended?: ISessionLockOnContended
  /**
   * Custom lock-key factory given as a path-ref.
   *
   * @remarks
   * A bare module path string or `{module, export?, args?}` resolving to
   * a `(ctx) => string` function. Must be a non-empty string in the bare
   * form.
   *
   * @example
   * ```typescript
   * key: `./src/lock-key.ts`
   * ```
   */
  key?: IGramstaxPathRef
}

/**
 * Author-written `gramstax.config.ts` shape.
 *
 * @remarks
 * Every field is optional so `gramstax build` stays zero-config: a missing
 * file (or an empty default export) yields `{deploy: "polling"}`. Unknown
 * top-level fields are rejected by the loader. CLI flags win over file
 * values at merge time.
 *
 * Mirrors `IGramstaxParams` for the file-serializable subset — instance
 * values (`CacheExternal`, `Map`, `TemplateManager`, `LoggingHelper`)
 * become path-refs or builtin params in their `*Ref` slot types.
 *
 * @example
 * ```typescript
 * const config: IGramstaxConfig = {
 *   token: process.env.TELEGRAM_BOT_TOKEN ?? ``,
 *   deploy: process.env.DEPLOY ?? `polling`,
 *   optionsDeploy: {url: `https://example.com/bot`}
 * }
 * ```
 *
 * @public
 */
export type IGramstaxConfig = {
  /**
   * Bot token value.
   *
   * @remarks
   * Must be a string when present (mirrors `IGramstaxParams.token`).
   * Empty string is allowed here: the author pattern
   * `process.env.X ?? ""` yields `""` when unset and env-less
   * `gramstax build` must keep working.
   *
   * @example
   * ```typescript
   * token: process.env.TELEGRAM_BOT_TOKEN ?? ``
   * ```
   */
  token?: string
  /**
   * Deploy mode.
   *
   * @remarks
   * Plain `string` (not a literal union) so author-written env expressions
   * like `process.env.X ?? "polling"` typecheck — membership in `polling`,
   * `webhook`, `serverless`, `raw`, `test` is enforced by the loader.
   * CLI `--deploy` wins over this value.
   *
   * @defaultValue `polling`
   *
   * @example
   * ```typescript
   * deploy: process.env.DEPLOY ?? `polling`
   * ```
   */
  deploy?: string
  /**
   * Structured deploy options for `webhook`/`serverless` modes.
   *
   * @remarks
   * Must be an object when present (mirrors `IGramstaxParams.optionsDeploy`).
   * Accepted keys: `adapter` (one of `cloudflare-mod`, `aws-lambda-async`),
   * `name` (string), `url` (string). Unknown fields are rejected.
   *
   * @example
   * ```typescript
   * optionsDeploy: {url: `https://example.com/bot`}
   * optionsDeploy: {adapter: `cloudflare-mod`, name: `gramstax-worker`, url: `https://example.com/webhook`}
   * ```
   */
  optionsDeploy?: {adapter?: string; name?: string; url?: string}
  /**
   * Opt-in local-path jail for media uploads.
   *
   * @remarks
   * Must be an array of non-empty strings or `null` when present (mirrors
   * `IGramstaxParams.mediaRoots`). `undefined` (omitted), `null`, and `[]`
   * all leave the jail off; a non-empty array only allows local file paths
   * resolving under one of the roots.
   *
   * @example
   * ```typescript
   * mediaRoots: [`./backups`, `./logs`]
   * ```
   */
  mediaRoots?: string[] | null
  /**
   * Bot configuration options.
   *
   * @remarks
   * Must be an object when present (mirrors `IGramstaxParams.botConfig`).
   * Forwards grammY `BotConfig` fields such as `apiRoot`.
   */
  botConfig?: BotConfig<Context>
  /**
   * Webhook queue configuration for backpressure and worker pooling.
   *
   * @remarks
   * Must be an object when present (mirrors `IGramstaxParams.webhookQueue`).
   * Accepted keys: `enabled` (boolean), `maxQueueSize` (positive number),
   * `workerCount` (number >= 1), `perChatConcurrency` (number >= 0),
   * `blockWhenFull` (boolean), `enqueueTimeoutMs` (non-negative number),
   * `waiterTimeoutMs` (non-negative number). Unknown fields are rejected.
   *
   * @example
   * ```typescript
   * webhookQueue: {enabled: true, maxQueueSize: 5000, workerCount: 8}
   * ```
   */
  webhookQueue?: IWebhookQueueConfig
  /**
   * Enable/disable the auto-retry plugin.
   *
   * @remarks
   * Must be a boolean when present (mirrors `IGramstaxParams.autoRetry`).
   * When enabled, the auto-retry plugin handles Telegram rate limits by
   * retrying failed requests.
   *
   * @defaultValue `true`
   */
  autoRetry?: boolean
  /**
   * Forwarded options for the auto-retry plugin (backoff / retry policy).
   *
   * @remarks
   * Must be an object when present. Accepted keys: `maxRetryAttempts`
   * (positive number >= 1), `retryOnInternalServerErrors` (boolean).
   * Unknown fields are rejected.
   */
  autoRetryOptions?: {maxRetryAttempts?: number; retryOnInternalServerErrors?: boolean}
  /**
   * Per-user rate limiting for incoming updates.
   *
   * @remarks
   * Must be an object with required `windowMs` (positive number, fixed
   * window in ms) and `max` (positive number, max updates per key per
   * window) when present (mirrors `IGramstaxParams.rateLimit`). Unknown
   * fields are rejected.
   *
   * @example
   * ```typescript
   * rateLimit: {windowMs: 1000, max: 5}
   * ```
   */
  rateLimit?: IRateLimitOptions
  /**
   * Outgoing API-call throttling via `@grammyjs/transformer-throttler`.
   *
   * @remarks
   * Must be an object when present (mirrors `IGramstaxParams.throttle`).
   * Mounts the `apiThrottler` transformer with Bottleneck buckets
   * (`global`, `group`, `out`), composing with `autoRetry`.
   */
  throttle?: APIThrottlerOptions
  /**
   * Max time in milliseconds allowed for a single update handler before
   * the update is treated as timed out.
   *
   * @remarks
   * Must be a non-negative finite number when present (mirrors
   * `IGramstaxParams.updateTimeoutMs`).
   *
   * @defaultValue `30000`
   *
   * @example
   * ```typescript
   * updateTimeoutMs: 30000
   * ```
   */
  updateTimeoutMs?: number
  /**
   * Skip updates whose `update_id` was already processed (idempotency).
   *
   * @remarks
   * Must be a boolean when present (mirrors
   * `IGramstaxParams.skipDuplicateUpdate`). Handy for webhook retries /
   * at-least-once delivery where a duplicate should not be handled twice.
   *
   * @defaultValue `false`
   */
  skipDuplicateUpdate?: boolean
  /**
   * Webhook secret token value.
   *
   * @remarks
   * Must be a string when present (mirrors
   * `IGramstaxParams.webhookSecretToken`). Sent by Telegram in the
   * `X-Telegram-Bot-Api-Secret-Token` header; mismatching requests
   * return `401`.
   */
  webhookSecretToken?: string
  /**
   * Max length of incoming `message.text` / `message.caption`.
   *
   * @remarks
   * Must be a non-negative finite number when present (mirrors
   * `IGramstaxParams.maxTextLength`). Updates longer than this are
   * skipped. `0` disables the check.
   *
   * @defaultValue `0` (unlimited)
   */
  maxTextLength?: number
  /**
   * Optional HTTP port serving `GET /health` and `GET /stats` in any
   * deploy mode.
   *
   * @remarks
   * Must be a number between 0 and 65535 when present (mirrors
   * `IGramstaxParams.statusServerPort`). When unset, these routes are
   * only available on the webhook server.
   *
   * @example
   * ```typescript
   * statusServerPort: 3001
   * ```
   */
  statusServerPort?: number
  /**
   * Hostname the status/health server binds to.
   *
   * @remarks
   * Must be a non-empty string when present (mirrors
   * `IGramstaxParams.statusServerHostname`).
   *
   * @defaultValue `127.0.0.1`
   *
   * @example
   * ```typescript
   * statusServerHostname: `127.0.0.1`
   * ```
   */
  statusServerHostname?: string
  /**
   * Max consecutive polling failures before giving up and stopping the bot.
   *
   * @remarks
   * Must be `-1` (retry forever) or a non-negative finite number when
   * present (mirrors `IGramstaxParams.pollingMaxRetries`).
   *
   * @defaultValue `5`
   */
  pollingMaxRetries?: number
  /**
   * Page routing configuration options.
   *
   * @remarks
   * Must be an object when present (mirrors `IGramstaxParams.optionsPage`).
   * Accepted keys: `shortCallbackQueryData` (boolean — numeric callback
   * data for smaller args). Unknown fields are rejected.
   */
  optionsPage?: {shortCallbackQueryData?: boolean}
  /**
   * Custom session cache slot.
   *
   * @remarks
   * Accepts a module path string, a `{module, export?, args?}` ref to a
   * `CacheExternal` subclass, or builtin `{store, ttlMs?, namespace?}`
   * params (`store` non-empty string, `ttlMs` non-negative number,
   * `namespace` string). Unknown fields are rejected.
   *
   * @example
   * ```typescript
   * cacheSession: {store: `redis://localhost:6379`, ttlMs: 3600000}
   * ```
   */
  cacheSession?: IGramstaxCacheSessionRef
  /**
   * Custom keyboard cache slot.
   *
   * @remarks
   * Accepts a module path string, a `{module, export?, args?}` ref to a
   * `Map` subclass, an entries array, or a plain object (entries via
   * `Object.entries`).
   *
   * @example
   * ```typescript
   * cacheKeyboard: [[`main:en`, {text: `Main`}]]
   * ```
   */
  cacheKeyboard?: IGramstaxCacheKeyboardRef
  /**
   * Custom template manager slot.
   *
   * @remarks
   * Accepts a module path string, a `{module, export?, args?}` ref to a
   * `TemplateManager` subclass, or builtin template options with `path`
   * (non-empty array of non-empty strings).
   *
   * @example
   * ```typescript
   * templateManager: {path: [`./src/pages`]}
   * ```
   */
  templateManager?: IGramstaxTemplateManagerRef
  /**
   * Logger configuration slot.
   *
   * @remarks
   * Accepts a boolean (`true` for the default logger, `false` for silent),
   * a module path string or `{module, export?, args?}` ref resolving to a
   * `LoggingHelper`, or logger options `{pathFile?, force?, formatTime?}`.
   * Unknown fields are rejected.
   *
   * @example
   * ```typescript
   * log: {pathFile: `./logs/bot.log`, force: `all`}
   * ```
   */
  log?: IGramstaxLogRef
  /**
   * Distributed session lock slot for multi-instance deployments.
   *
   * @remarks
   * Must be an object when present. Accepted keys: `enabled` (boolean),
   * `leaseMs` (positive number), `onContended` (one of `skip`, `wait`,
   * `serialize`), `key` (path-ref to a `(ctx) => string` factory).
   * Unknown fields are rejected.
   *
   * @example
   * ```typescript
   * sessionLock: {enabled: true, leaseMs: 5000, onContended: `skip`}
   * ```
   */
  sessionLock?: IGramstaxSessionLockRef
}

/**
 * NextConfig-style alias for the `gramstax.config.ts` shape.
 *
 * @remarks
 * Thin alias of `IGramstaxConfig` so scaffolded projects can write
 * `const config: GramstaxConfig = {...}` and get typo-checking on every key.
 *
 * @public
 */
export type GramstaxConfig = IGramstaxConfig

/**
 * Which build-relevant keys a `gramstax.config.ts` file explicitly defines.
 *
 * @remarks
 * The merged `loadConfig` result cannot distinguish "from file" vs "default",
 * so `gramstax build --dry-run` consults this helper to annotate each printed
 * value with its source (`flag` wins, else `config` when the file exists and
 * defines the key, else `default`). Reads the raw default export without
 * validation — callers must `loadConfig` first so invalid shapes still throw
 * the usual `Invalid gramstax config` error.
 *
 * @public
 */
export type IGramstaxExplicitBuildKeys = {
  /**
   * Whether a `gramstax.config.ts` file exists in the project root.
   *
   * @remarks
   * `false` when no config file was found; all other flags are `false`
   * in that case.
   */
  hasFile: boolean
  /**
   * Whether the raw default export defines a top-level `deploy` key.
   *
   * @remarks
   * Presence check only (`!== undefined`) — the value is not validated here.
   */
  deploy: boolean
  /**
   * Whether `optionsDeploy.adapter` is defined.
   *
   * @remarks
   * `false` when there is no `optionsDeploy` object or it lacks `adapter`.
   */
  adapter: boolean
  /**
   * Whether `optionsDeploy.name` is defined.
   *
   * @remarks
   * `false` when there is no `optionsDeploy` object or it lacks `name`.
   */
  name: boolean
  /**
   * Whether `optionsDeploy.url` is defined.
   *
   * @remarks
   * `false` when there is no `optionsDeploy` object or it lacks `url`.
   */
  url: boolean
}
