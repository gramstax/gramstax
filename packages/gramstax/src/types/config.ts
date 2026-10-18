import type {APIThrottlerOptions} from "@grammyjs/transformer-throttler"
import type {BotConfig, Context} from "grammy"
import type {IRateLimitOptions, IUpdateQueueConfig} from "./bot"
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
 * Either a bare module path (default export, zero-arg) or a wrapped override ref.
 *
 * @remarks
 * The string form must be a non-empty string resolving relative to the
 * project root. The object form is `{override: {@link IGramstaxModuleRef}}` with
 * `override.module`, optional `override.export`, and optional `override.args`; unknown fields are
 * rejected by the loader.
 *
 * @example
 * ```typescript
 * const bare: IGramstaxPathRef = `./src/cache.ts`
 * const full: IGramstaxPathRef = {override: {module: `./src/cache.ts`, export: `RedisCache`}}
 * ```
 *
 * @public
 */
export type IGramstaxPathRef = string | {override: IGramstaxModuleRef}

/**
 * `cacheSession` slot: a path-ref to a `CacheExternal` subclass, or builtin
 * params mirrored from the real constructor `(store, ttlMs, namespace?)`.
 *
 * @remarks
 * Three accepted shapes (enforced by the loader):
 * - a module path string resolving to a `CacheExternal` subclass
 * - an `{override: {module, export?, args?}}` ref resolving to a `CacheExternal` subclass
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
 * - an `{override: {module, export?, args?}}` ref resolving to a `Map` subclass
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
 * - an `{override: {module, export?, args?}}` ref resolving to a `TemplateManager` subclass
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
 * - an `{override: {module, export?, args?}}` ref resolving to a `LoggingHelper`
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
 * `{override: {module, export?, args?}}`) resolving to a `(ctx) => string` function.
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
   * A bare module path string or `{override: {module, export?, args?}}` resolving to
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
 * Canonical deploy-mode names.
 *
 * @remarks
 * Single runtime source for the deploy-mode vocabulary. Lives here rather than in
 * `cli/config` so `core/bot` can validate without importing a CLI module.
 * `IDeployMode` is derived from it and {@link GRAMSTAX_DEPLOY_MODE_SET} is built
 * from it, so the literal union and the membership test cannot drift apart.
 *
 * @public
 */
export const GRAMSTAX_DEPLOY_MODES = [`polling`, `webhook`, `serverless`, `raw`, `test`] as const

/**
 * Name of a deploy mode.
 *
 * @public
 */
export type IDeployMode = (typeof GRAMSTAX_DEPLOY_MODES)[number]

/**
 * O(1) membership view of {@link GRAMSTAX_DEPLOY_MODES}.
 *
 * @remarks
 * A `Set` lookup instead of `Array.includes`, which is O(n). Widened to
 * `ReadonlySet<string>` because call sites test raw `string` input (an `unknown`
 * config field narrowed by `typeof`, and `params.deploy`); a
 * `ReadonlySet<IDeployMode>` would force an unsound cast at every call site.
 * The `as const` tuple above remains the source of truth for the union.
 *
 * @public
 */
export const GRAMSTAX_DEPLOY_MODE_SET: ReadonlySet<string> = new Set(GRAMSTAX_DEPLOY_MODES)

/**
 * Canonical serverless adapter names.
 *
 * @remarks
 * Single runtime source for the adapter vocabulary. Lives here rather than in
 * `cli/config` so `core/bot` can validate without importing a CLI module.
 * `IGramstaxServerlessAdapter` is derived from it, and
 * {@link GRAMSTAX_SERVERLESS_FIELDS} is keyed by it, so adding an adapter
 * without declaring its fields is a compile error.
 *
 * @public
 */
export const GRAMSTAX_SERVERLESS_ADAPTERS = [`cloudflare-mod`, `aws-lambda-async`] as const

/**
 * Name of a serverless adapter.
 *
 * @public
 */
export type IGramstaxServerlessAdapter = (typeof GRAMSTAX_SERVERLESS_ADAPTERS)[number]

/**
 * Per-adapter allowed config fields.
 *
 * @remarks
 * A field absent from an adapter's list does not exist for that adapter —
 * it is rejected rather than ignored. This is what makes the adapter-keyed
 * shape precise instead of a bag of optional fields.
 *
 * @public
 */
export const GRAMSTAX_SERVERLESS_FIELDS: Record<IGramstaxServerlessAdapter, readonly string[]> = {
  "cloudflare-mod": [`name`, `compatibilityDate`, `compatibilityFlags`, `url`, `secretToken`, `toml`],
  "aws-lambda-async": [`url`, `secretToken`]
}

/**
 * `cloudflare-mod` adapter section of `optionsDeploy.serverless`.
 *
 * @remarks
 * The adapter is the KEY, so this type only exists under the `cloudflare-mod`
 * key. Fields that do not apply to Cloudflare are absent from this type
 * rather than present-and-ignored.
 *
 * `compatibilityDate` and `compatibilityFlags` are emitted into
 * `wrangler.toml`. When `undefined` they are written as commented lines
 * carrying the default, so the emitted file documents what would be used.
 *
 * @example
 * ```typescript
 * const section: IGramstaxCloudflareModOptions = {
 *   name: `gramstax-worker`,
 *   compatibilityDate: `2026-01-01`,
 *   compatibilityFlags: [`nodejs_compat`],
 *   url: `https://example.com/webhook`,
 *   secretToken: process.env.BOT_WEBHOOK_SECRET ?? ``,
 *   toml: {account_id: `abc123`}
 * }
 * ```
 *
 * @public
 */
export type IGramstaxCloudflareModOptions = {
  /**
   * Cloudflare worker name, written as `name = "..."` in `wrangler.toml`.
   *
   * @remarks
   * Optional. When absent the emitted TOML writes the default
   * `gramstax-worker` — it is never emitted as a comment, because
   * Cloudflare requires a worker name to deploy.
   *
   * @example
   * ```typescript
   * name: `gramstax-worker`
   * ```
   */
  name?: string
  /**
   * Value for `compatibility_date` in `wrangler.toml`.
   *
   * @remarks
   * When absent, emitted as `# compatibility_date = "2026-01-01"`.
   *
   * @example
   * ```typescript
   * compatibilityDate: `2026-01-01`
   * ```
   */
  compatibilityDate?: string
  /**
   * Value for `compatibility_flags` in `wrangler.toml`.
   *
   * @remarks
   * When absent, emitted as `# compatibility_flags = ["nodejs_compat"]`.
   * Note this flips the current behavior, where `nodejs_compat` is always
   * written.
   *
   * @example
   * ```typescript
   * compatibilityFlags: [`nodejs_compat`]
   * ```
   */
  compatibilityFlags?: string[]
  /**
   * Public webhook URL for the serverless deployment.
   *
   * @remarks
   * Must be a real `https?://` URL with no `<` placeholder when `deploy`
   * is `serverless`. Required in that mode.
   *
   * Optional in the type so author-written env expressions
   * (`process.env.BOT_DEPLOY_URL`) typecheck; the loader and the constructor
   * both enforce presence with an explicit error.
   *
   * @example
   * ```typescript
   * url: `https://example.com/webhook`
   * ```
   */
  url?: string
  /**
   * Webhook secret token value.
   *
   * @remarks
   * Must be non-empty and match `^[A-Za-z0-9_-]{1,256}$` when `deploy` is
   * `serverless`. Required in that mode. Used for webhook secret
   * registration and local start. NEVER baked into emitted bundles —
   * edge reads the `BOT_WEBHOOK_SECRET` runtime binding.
   * Generate via `openssl rand -hex 32`.
   *
   * Optional in the type for env-expression ergonomics; required in
   * `serverless` mode and enforced by the loader and the constructor.
   *
   * @example
   * ```typescript
   * secretToken: process.env.BOT_WEBHOOK_SECRET ?? ``
   * ```
   */
  secretToken?: string
  /**
   * Escape hatch merged into the emitted `wrangler.toml`.
   *
   * @remarks
   * Flat-merged LAST, so it wins over every typed field above — including
   * `name`. Keys are not validated; an unrecognized key reaches
   * `wrangler.toml` verbatim and is rejected by `wrangler deploy`, not by
   * gramstax. A `vars` key merges per-key so gramstax's secret-warning
   * comments survive.
   *
   * @example
   * ```typescript
   * toml: {account_id: `abc123`, vars: {STAGE: `prod`}}
   * ```
   */
  toml?: Record<string, unknown>
}

/**
 * `aws-lambda-async` adapter section of `optionsDeploy.serverless`.
 *
 * @remarks
 * The adapter is the KEY, so this type only exists under the
 * `aws-lambda-async` key.
 *
 * This section currently has NO adapter-specific fields: `lambda.ts` emits
 * only `lambda.js` and no AWS-side artifact, so there is nothing to
 * configure yet. AWS settings (`functionName`, `memorySize`, `timeoutMs`,
 * `architecture`) are deliberately absent — adding them before an emitter
 * exists would create knobs that silently do nothing.
 *
 * @example
 * ```typescript
 * const section: IGramstaxAwsLambdaAsyncOptions = {url: `https://example.com/webhook`, secretToken: process.env.BOT_WEBHOOK_SECRET ?? ``}
 * ```
 *
 * @public
 */
export type IGramstaxAwsLambdaAsyncOptions = {
  /**
   * Public webhook URL for the serverless deployment.
   *
   * @remarks
   * Must be a real `https?://` URL with no `<` placeholder when `deploy`
   * is `serverless`. Required in that mode.
   *
   * Optional in the type so author-written env expressions
   * (`process.env.BOT_DEPLOY_URL`) typecheck; the loader and the constructor
   * both enforce presence with an explicit error.
   *
   * @example
   * ```typescript
   * url: `https://example.com/webhook`
   * ```
   */
  url?: string
  /**
   * Webhook secret token value.
   *
   * @remarks
   * Must be non-empty and match `^[A-Za-z0-9_-]{1,256}$` when `deploy` is
   * `serverless`. Required in that mode. NEVER baked into emitted bundles —
   * the function reads the `BOT_WEBHOOK_SECRET` environment variable.
   * Generate via `openssl rand -hex 32`.
   *
   * Optional in the type for env-expression ergonomics; required in
   * `serverless` mode and enforced by the loader and the constructor.
   *
   * @example
   * ```typescript
   * secretToken: process.env.BOT_WEBHOOK_SECRET ?? ``
   * ```
   */
  secretToken?: string
}

/**
 * Serverless deploy branch of `optionsDeploy`.
 *
 * @remarks
 * The adapter name is the KEY. Exactly one key must be present. Each key
 * carries only the fields that adapter actually uses.
 *
 * The `secretToken` value is validated for shape only — it is NEVER baked
 * into emitted bundles; the deployed function reads the `BOT_WEBHOOK_SECRET`
 * runtime binding instead.
 *
 * @example
 * ```typescript
 * const serverless: IGramstaxServerlessDeployOptions = {'cloudflare-mod': {url: `https://example.com/webhook`, secretToken: process.env.BOT_WEBHOOK_SECRET ?? ``}}
 * ```
 *
 * @public
 */
export type IGramstaxServerlessDeployOptions = {"cloudflare-mod": IGramstaxCloudflareModOptions} | {"aws-lambda-async": IGramstaxAwsLambdaAsyncOptions}

/**
 * Webhook deploy branch of `optionsDeploy`.
 *
 * @remarks
 * Only meaningful when `deploy` is `webhook`. Carries the public URL, the
 * secret token shape, and the queue config that used to live at the root
 * `webhookQueue` field.
 *
 * @example
 * ```typescript
 * const webhook: IGramstaxWebhookDeployOptions = {url: `https://example.com/bot`, secretToken: `s3cr3t`, queue: {enabled: true}}
 * ```
 *
 * @public
 */
export type IGramstaxWebhookDeployOptions = {
  /**
   * Public webhook URL.
   *
   * @remarks
   * Must be a real `https?://` URL with no `<` placeholder when `deploy`
   * is `webhook`. Required in that mode.
   *
   * @example
   * ```typescript
   * url: `https://example.com/bot`
   * ```
   */
  url?: string
  /**
   * Webhook secret token value.
   *
   * @remarks
   * Must be non-empty and match `^[A-Za-z0-9_-]{1,256}$` when `deploy` is
   * `webhook`. Required in that mode. Sent by Telegram in the
   * `X-Telegram-Bot-Api-Secret-Token` header; mismatching requests
   * return `401`. Generate via `openssl rand -hex 32`.
   *
   * @example
   * ```typescript
   * secretToken: `s3cr3t-token_01`
   * ```
   */
  secretToken?: string
  /**
   * Webhook queue configuration for backpressure and worker pooling.
   *
   * @remarks
   * Must be an object when present. Accepted keys: `enabled (boolean)`,
   * `maxQueueSize (positive number)`, `workerCount (number >= 1)`,
   * `perChatConcurrency (number >= 0)`, `blockWhenFull (boolean)`,
   * `enqueueTimeoutMs (non-negative number)`, `waiterTimeoutMs (non-negative number)`,
   * `drainTimeoutMs (non-negative number)`. Unknown fields are rejected.
   *
   * @example
   * ```typescript
   * queue: {enabled: true, maxQueueSize: 5000, workerCount: 8}
   * ```
   */
  queue?: IUpdateQueueConfig
}

/**
 * Polling deploy branch of `optionsDeploy`.
 *
 * @remarks
 * Only meaningful when `deploy` is `polling`. Carries the retry budget that
 * used to live at the root `pollingMaxRetries` field, plus the optional
 * `queue` sink that turns the sequential `getUpdates` loop into a bounded
 * worker pool. Omitting `queue` leaves polling exactly as it was: sequential
 * processing, one update at a time.
 *
 * @example
 * ```typescript
 * const polling: IGramstaxPollingDeployOptions = {maxRetries: 5}
 * const concurrent: IGramstaxPollingDeployOptions = {maxRetries: 5, queue: {enabled: true, workerCount: 8, perChatConcurrency: 1}}
 * ```
 *
 * @public
 */
export type IGramstaxPollingDeployOptions = {
  /**
   * Max consecutive polling failures before giving up and stopping the bot.
   *
   * @remarks
   * Must be `-1` (retry forever) or a non-negative finite number when
   * present.
   *
   * @defaultValue `5`
   *
   * @example
   * ```typescript
   * maxRetries: 5
   * ```
   */
  maxRetries?: number
  /**
   * Delete updates that Telegram buffered while the bot was down, instead of
   * replaying them once polling starts.
   *
   * @remarks
   * Telegram holds undelivered updates for up to 24 hours, so the default
   * (`false`) replays whatever arrived during an outage. Setting this to `true`
   * is the only way to discard that backlog, and it is destructive: every
   * message sent while the bot was down is dropped without being handled, so
   * users get no reply at all. Enable it only for a deliberate clean slate.
   *
   * @defaultValue `false`
   *
   * @example
   * ```typescript
   * dropPendingUpdates: false
   * ```
   */
  dropPendingUpdates?: boolean
  /**
   * Concurrent update sink for polling — backpressure and worker pooling.
   *
   * @remarks
   * Must be an object when present. Opt-in: omit it (or leave `enabled` off)
   * and polling stays sequential, one update at a time. Validated by the same
   * rules as `optionsDeploy.webhook.queue`, so a block that is accepted here is
   * exactly as valid there.
   *
   * Accepted keys: `enabled (boolean)`, `maxQueueSize (positive number)`,
   * `workerCount (number >= 1)`, `perChatConcurrency (number >= 0)`,
   * `blockWhenFull (boolean)`, `enqueueTimeoutMs (non-negative number)`,
   * `waiterTimeoutMs (non-negative number)`, `drainTimeoutMs (non-negative number)`.
   * Unknown fields are rejected.
   *
   * @example
   * ```typescript
   * queue: {enabled: true, maxQueueSize: 5000, workerCount: 8}
   * ```
   */
  queue?: IUpdateQueueConfig
}

/**
 * Raw deploy branch of `optionsDeploy`.
 *
 * @remarks
 * Only meaningful when `deploy` is `raw`. Accepts no fields — any defined
 * key is rejected as unknown. An empty object counts as an empty branch.
 *
 * @example
 * ```typescript
 * const raw: IGramstaxRawDeployOptions = {}
 * ```
 *
 * @public
 */
export type IGramstaxRawDeployOptions = Record<string, never>

/**
 * Test deploy branch of `optionsDeploy`.
 *
 * @remarks
 * Only meaningful when `deploy` is `test`. Accepts no fields — any defined
 * key is rejected as unknown. An empty object counts as an empty branch.
 *
 * @example
 * ```typescript
 * const test: IGramstaxTestDeployOptions = {}
 * ```
 *
 * @public
 */
export type IGramstaxTestDeployOptions = Record<string, never>

/**
 * Per-deploy-method nested deploy options.
 *
 * @remarks
 * At most one branch may be non-empty (a branch is non-empty when it holds
 * at least one key whose value is not `undefined` — explicit-`undefined`
 * equals absent). Zero branches are allowed only when `deploy` is
 * `polling`, `raw`, or `test`. The single non-empty branch (if any) must
 * equal `deploy`, else the loader throws. Unknown branch names and unknown
 * fields inside each branch are rejected.
 *
 * @example
 * ```typescript
 * const webhook: IGramstaxOptionsDeploy = {webhook: {url: `https://example.com/bot`, secretToken: `s3cr3t`}}
 * const serverless: IGramstaxOptionsDeploy = {serverless: {'cloudflare-mod': {url: `https://example.com/webhook`, secretToken: `s3cr3t`}}}
 * const polling: IGramstaxOptionsDeploy = {polling: {maxRetries: 5}}
 * ```
 *
 * @public
 */
export type IGramstaxOptionsDeploy = {
  /**
   * Serverless deploy options.
   *
   * @remarks
   * Only meaningful when `deploy` is `serverless`. Accepted keys:
   * `adapter`, `name`, `url`, `secretToken`. Unknown fields are rejected.
   *
   * @example
   * ```typescript
   * serverless: {'cloudflare-mod': {url: `https://example.com/webhook`, secretToken: `s3cr3t`}}
   * ```
   */
  serverless?: IGramstaxServerlessDeployOptions
  /**
   * Webhook deploy options.
   *
   * @remarks
   * Only meaningful when `deploy` is `webhook`. Accepted keys: `url`,
   * `secretToken`, `queue`. Unknown fields are rejected.
   *
   * @example
   * ```typescript
   * webhook: {url: `https://example.com/bot`, secretToken: `s3cr3t`}
   * ```
   */
  webhook?: IGramstaxWebhookDeployOptions
  /**
   * Polling deploy options.
   *
   * @remarks
   * Only meaningful when `deploy` is `polling`. Accepted keys:
   * `maxRetries` (`-1` or non-negative), `queue` (same rules as the webhook
   * queue). Unknown fields are rejected.
   *
   * @example
   * ```typescript
   * polling: {maxRetries: 5}
   * polling: {maxRetries: 5, queue: {enabled: true, workerCount: 8}}
   * ```
   */
  polling?: IGramstaxPollingDeployOptions
  /**
   * Raw deploy options (no fields).
   *
   * @remarks
   * Only meaningful when `deploy` is `raw`. Any defined key is rejected.
   *
   * @example
   * ```typescript
   * raw: {}
   * ```
   */
  raw?: IGramstaxRawDeployOptions
  /**
   * Test deploy options (no fields).
   *
   * @remarks
   * Only meaningful when `deploy` is `test`. Any defined key is rejected.
   *
   * @example
   * ```typescript
   * test: {}
   * ```
   */
  test?: IGramstaxTestDeployOptions
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
 *   token: process.env.BOT_TOKEN ?? ``,
 *   deploy: process.env.DEPLOY ?? `polling`,
 *   optionsDeploy: {webhook: {url: `https://example.com/bot`, secretToken: `s3cr3t`}}
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
   * token: process.env.BOT_TOKEN ?? ``
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
   * Per-deploy-method nested deploy options.
   *
   * @remarks
   * Must be an object when present. Accepted branches: `serverless`
   * (`adapter`, `name`, `url`, `secretToken`), `webhook` (`url`, `secretToken`, `queue`),
   * `polling` (`maxRetries`, `queue`), `raw` (no fields), `test` (no fields).
   * At most one branch may be non-empty and it must equal `deploy`.
   * Unknown branches and unknown fields inside each branch are rejected.
   * Explicit-`undefined` equals absent.
   *
   * @example
   * ```typescript
   * optionsDeploy: {webhook: {url: `https://example.com/bot`, secretToken: `s3cr3t`}}
   * optionsDeploy: {serverless: {'cloudflare-mod': {name: `gramstax-worker`, url: `https://example.com/webhook`, secretToken: `s3cr3t`}}}
   * optionsDeploy: {polling: {maxRetries: 5}}
   * ```
   */
  optionsDeploy?: IGramstaxOptionsDeploy
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
   * Must be an object when present. Accepted keys: `maxRetryAttempts (positive number >= 1)`, `retryOnInternalServerErrors (boolean)`.
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
   * Accepts a module path string, an `{override: {module, export?, args?}}` ref to a
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
   * Accepts a module path string, an `{override: {module, export?, args?}}` ref to a
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
   * Accepts a module path string, an `{override: {module, export?, args?}}` ref to a
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
   * a module path string or `{override: {module, export?, args?}}` ref resolving to a
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
   * Whether an adapter key is present in `optionsDeploy.serverless`.
   *
   * @remarks
   * `false` when there is no `optionsDeploy.serverless` object or it lacks
   * `adapter`. Presence check only (`!== undefined`).
   *
   * @example
   * ```typescript
   * adapter: true
   * ```
   */
  adapter: boolean
  /**
   * Whether `optionsDeploy.serverless.name` is defined.
   *
   * @remarks
   * `false` when there is no `optionsDeploy.serverless` object or it lacks
   * `name`. Presence check only (`!== undefined`).
   *
   * @example
   * ```typescript
   * name: true
   * ```
   */
  name: boolean
  /**
   * Whether a deploy URL is defined.
   *
   * @remarks
   * `true` when `optionsDeploy.serverless.url` or
   * `optionsDeploy.webhook.url` is present (`!== undefined`). Covers both
   * URL-bearing branches for `--dry-run` display.
   *
   * @example
   * ```typescript
   * url: true
   * ```
   */
  url: boolean
}
