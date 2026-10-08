import type {APIThrottlerOptions} from "@grammyjs/transformer-throttler"
import type {BotConfig, Context, FilterQuery} from "grammy"
import type {CacheExternal} from "~/cache/external"
import type {Ctx} from "~/core/ctx"
import type {LoggingHelper} from "~/helpers/log"
import type {TemplateManager} from "~/template/manager"
import type {UpdateQueue} from "~/update/queue"
import type {Update} from "grammy/types"
import type {IGramstaxOptionsDeploy} from "~/types/config"
import type {ICtxParams} from "./ctx"
import type {IAppManifest} from "./manifest"
import type {ISessionLockOptions} from "./session-lock"

/**
 * A custom filter-based route entry, registered via {@link Gramstax.registerCustomRoute}.
 *
 * @remarks
 * Similar to chat member routes but for any `listenerName`. The route fires at
 * dispatch stage id=6 in {@link Gramstax._pageRoutes} when:
 * 1. `fromListener === listenerName`, AND
 * 2. `filter(ctx)` returns `true`
 *
 * `registerCustomRoute` automatically calls `this.bot.on(entry.event, ...)` to
 * subscribe the listener — no separate `registerLowOn*` override needed.
 *
 * @example
 * ```typescript
 * const entry: ICustomRouteEntry = {
 *   name: `search`,
 *   routeName: `handleInlineQuery`,
 *   listenerName: `inlinequery`,
 *   event: `inline_query`,
 *   filter: (ctx) => !!ctx.inlineQuery,
 *   shouldCheckNotFound: false
 * }
 * ```
 *
 * @public
 */
export type ICustomRouteEntry = {
  /**
   * Page name key in `this.pages.all`.
   *
   * @remarks
   * Must match a loaded page name — the dispatcher looks the page instance
   * up by this key and calls `routeName` on it.
   *
   * @example
   * ```typescript
   * name: `search`
   * ```
   */
  name: string
  /**
   * Method name to call on the page instance.
   *
   * @remarks
   * Any public page method name (convention: `handle*`). Resolved
   * dynamically on the page instance at dispatch time.
   *
   * @example
   * ```typescript
   * routeName: `handleInlineQuery`
   * ```
   */
  routeName: string
  /**
   * Must match the `listenerName` passed to `_onHandle()`.
   *
   * @remarks
   * The route only fires when the incoming update arrived through this
   * listener — e.g. `inlinequery` for the `inline_query` subscription.
   *
   * @example
   * ```typescript
   * listenerName: `inlinequery`
   * ```
   */
  listenerName: string
  /**
   * GrammY event filter string.
   *
   * @remarks
   * Any grammY `FilterQuery` — `registerCustomRoute` passes it straight to
   * `this.bot.on(entry.event, ...)` to subscribe the listener.
   *
   * @example
   * ```typescript
   * event: `inline_query`
   * ```
   *
   * @example
   * ```typescript
   * event: `message:forward_date`
   * ```
   */
  event: FilterQuery
  /**
   * Predicate: return `true` to dispatch this route for the current update.
   *
   * @remarks
   * Runs at dispatch stage id=6 with the fully constructed page `Ctx`.
   * Keep it synchronous and cheap — it runs for every update on the listener.
   *
   * @example
   * ```typescript
   * filter: (ctx) => !!ctx.inlineQuery
   * ```
   */
  filter: (ctx: Ctx) => boolean
  /**
   * Pass `false` to skip `hookNotFoundPage` when no route matches
   * (analogous to chat member routes).
   *
   * @defaultValue `true`
   */
  shouldCheckNotFound?: boolean
}

/**
 * Update queue configuration for backpressure and worker pooling.
 *
 * @remarks
 * Enable this for polling and webhook deployments. The queue buffers incoming
 * updates and dispatches them to a worker pool, decoupling source latency from
 * handler work. Both modes configure the same {@link UpdateQueue} class; each
 * keeps its own instance, so the two never contend with one another.
 *
 * @example
 * ```typescript
 * webhookQueue: {
 *   enabled: true,
 *   maxQueueSize: 5000,
 *   workerCount: 8,
 *   perChatConcurrency: 1,
 *   blockWhenFull: true
 * }
 * ```
 *
 * @example
 * ```typescript
 * optionsDeploy: {polling: {queue: {enabled: true, workerCount: 8}}}
 * ```
 *
 * @public
 */
export type IUpdateQueueConfig = {
  /**
   * Enable update queue and worker pool.
   *
   * @remarks
   * Set this to `true` to activate queue-based processing for the mode.
   *
   * @example
   * ```typescript
   * enabled: true
   * ```
   */
  enabled?: boolean
  /**
   * Maximum queued updates before backpressure applies.
   *
   * @remarks
   * When the queue is full, producers block (default) or are rejected based on
   * `blockWhenFull`. Rejected by `_validateConfig` unless positive.
   *
   * @example
   * ```typescript
   * maxQueueSize: 5000
   * ```
   */
  maxQueueSize?: number
  /**
   * Number of concurrent async worker loops processing updates.
   *
   * @remarks
   * These are in-process async loops (not OS threads). Increase to improve
   * throughput for IO-bound handlers. Rejected by `_validateConfig` below `1`.
   *
   * @example
   * ```typescript
   * workerCount: 8
   * ```
   */
  workerCount?: number
  /**
   * Max concurrent updates per chat (0 disables).
   *
   * @remarks
   * Use `1` to preserve ordering per chat. Set to `0` to disable per-chat locking.
   * Higher values allow parallel handling in the same chat, which can lead to
   * out-of-order effects if handlers write to shared state.
   *
   * @example
   * ```typescript
   * perChatConcurrency: 1
   * ```
   *
   * @example
   * ```typescript
   * // Disable per-chat locking to maximize throughput
   * perChatConcurrency: 0
   * ```
   *
   * @example
   * ```typescript
   * // Allow two concurrent updates per chat
   * perChatConcurrency: 2
   * ```
   */
  perChatConcurrency?: number
  /**
   * Block producers when queue is full.
   *
   * @remarks
   * When `true`, the producer waits until a queue slot is free. When `false`,
   * a webhook request is rejected with HTTP 429 and a polling update is dropped.
   *
   * @example
   * ```typescript
   * blockWhenFull: true
   * ```
   */
  blockWhenFull?: boolean
  /**
   * Max milliseconds a producer waits for a free queue slot before the enqueue
   * fails — HTTP 429 for webhook, dropped update for polling (only when
   * `blockWhenFull` is true).
   *
   * @remarks
   * Rejected by `_validateConfig` when negative. Omit for the queue default.
   *
   * @defaultValue `10000`
   *
   * @example
   * ```typescript
   * enqueueTimeoutMs: 10000
   * ```
   */
  enqueueTimeoutMs?: number
  /**
   * Max milliseconds a worker waits for a per-chat slot before bypassing the
   * concurrency gate and processing the update anyway.
   *
   * @remarks
   * Prevents a hung handler from stalling all updates for that chat forever.
   *
   * @defaultValue `30000`
   *
   * @example
   * ```typescript
   * waiterTimeoutMs: 30000
   * ```
   */
  waiterTimeoutMs?: number
  /**
   * Max milliseconds `stop()` waits for in-flight handlers before giving up on
   * the queue drain.
   *
   * @remarks
   * Applies to both deploy modes. When the budget elapses, whatever is still
   * buffered is counted in `metrics.counts.dropped` and logged — the drain never
   * silently abandons updates. Teardown waits for the drain, so a larger value
   * delays shutdown.
   *
   * @defaultValue `10000`
   *
   * @example
   * ```typescript
   * drainTimeoutMs: 10000
   * ```
   */
  drainTimeoutMs?: number
}

/**
 * Legacy alias for {@link IUpdateQueueConfig}.
 *
 * @deprecated Renamed to {@link IUpdateQueueConfig}. Kept as an alias for the
 * public barrel; will be removed in the next major version.
 * @public
 */
export type IWebhookQueueConfig = IUpdateQueueConfig

/**
 * Rate-limit configuration for incoming updates (`@grammyjs/ratelimiter`).
 *
 * @remarks
 * Configuration only — the rate-limit key and the behavior when the limit
 * is exceeded are provided by overriding the {@link Gramstax.hookKeyGenerator}
 * and {@link Gramstax.hookRateLimited} class hooks. Mounted via `limit()` with
 * `timeFrame: windowMs` and `limit: max`.
 *
 * @example
 * ```typescript
 * rateLimit: {windowMs: 1000, max: 5}
 * ```
 *
 * @public
 */
export type IRateLimitOptions = {
  /**
   * Length of the fixed time window in milliseconds.
   *
   * @remarks
   * Forwarded as `timeFrame` to the `@grammyjs/ratelimiter` middleware —
   * each key may send at most `max` updates per window.
   *
   * @example
   * ```typescript
   * windowMs: 1000
   * ```
   */
  windowMs: number
  /**
   * Maximum number of updates a key may send within `windowMs`.
   *
   * @remarks
   * Forwarded as `limit` to the `@grammyjs/ratelimiter` middleware.
   * Updates past the limit are dropped (or handled by `hookRateLimited`).
   *
   * @example
   * ```typescript
   * max: 5
   * ```
   */
  max: number
}

/**
 * Configuration options for Gramstax bot instance.
 *
 * @remarks
 * Passed to `new Gramstax(params)`. The constructor validates `token`,
 * `deploy`/`optionsDeploy` membership, and numeric ranges (`_validateConfig`)
 * and throws with an explicit message on violation.
 *
 * @example
 * ```typescript
 * new Gramstax({token: `BOT_TOKEN`, deploy: `polling`, log: true})
 * ```
 *
 * @public
 */
export type IGramstaxParams = {
  /**
   * Telegram Bot API token.
   *
   * @remarks
   * This token is obtained from BotFather when creating a new bot. The
   * constructor throws when it is missing or empty, and it is passed to
   * `createBot` to build the underlying grammY `Bot`.
   *
   * @example
   * ```typescript
   * token: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
   * ```
   */
  token: string

  /**
   * Deployment mode for the bot.
   *
   * @remarks
   * Supported modes:
   * - `"polling"` - Long polling mode for development
   * - `"webhook"` - Webhook mode with the public URL in `optionsDeploy.webhook.url`
   * - `"serverless"` - Serverless mode, keyed by adapter: `optionsDeploy.serverless['cloudflare-mod'].url`
   * - `"test"` - Test mode with E2eHelper
   * - `"raw"` - Bare bot: no pages, no templates, no Gramstax routing.
   *   The constructor builds `this.bot` (`Bot`) and returns without
   *   auto-start. Write raw handlers on `bot.bot` and call
   *   `bot.bot.start()` (or `bot.bot.startWebhook(...)`) yourself.
   *   `templateManager` is left undefined.
   *
   * @example
   * ```typescript
   * deploy: `polling`
   * deploy: `webhook`
   * deploy: `serverless`
   * deploy: `test`
   * deploy: `raw`
   * ```
   *
   * Plain `string` (not a literal union) so author-written env expressions
   * like `process.env.X` typecheck — membership is enforced by the constructor
   * at runtime with explicit errors.
   */
  deploy: string

  /**
   * Per-deploy-method nested deploy options.
   *
   * @remarks
   * At most one branch may be non-empty and it must equal `deploy`:
   * - `serverless` is keyed by adapter name and must carry exactly one key
   *   (`'cloudflare-mod'` or `'aws-lambda-async'`). Each key requires a real
   *   `url` (`https?://` with no `<` placeholder) and a `secretToken`. Only
   *   `'cloudflare-mod'` accepts `name`, `compatibilityDate`,
   *   `compatibilityFlags` and the `toml` escape hatch.
   * - `webhook` requires a real `url` and a `secretToken`, with an optional
   *   `queue` for backpressure and worker pooling.
   * - `polling` accepts an optional `maxRetries` (`-1` retries forever).
   * - `raw` and `test` accept no fields.
   *
   * @example
   * ```typescript
   * optionsDeploy: {webhook: {url: `https://example.com/bot`, secretToken: `s3cr3t`}}
   * optionsDeploy: {serverless: {'cloudflare-mod': {url: `https://example.com/webhook`, secretToken: `s3cr3t`}}}
   * optionsDeploy: {polling: {maxRetries: 5}}
   * ```
   */
  optionsDeploy?: IGramstaxOptionsDeploy

  /**
   * Logger configuration.
   *
   * @remarks
   * - Pass a `LoggingPretty` instance for custom logging
   * - Pass `true` to use the default logger
   * - Pass `null` or `false` to disable logging
   *
   * Resolved in the constructor (`true` → shared `log`, falsy → `undefined`)
   * and forwarded into every page `Ctx` via `ctxScope`.
   *
   * @defaultValue `false`
   *
   * @example
   * ```typescript
   * log: true
   * ```
   */
  log?: LoggingHelper | boolean | null

  /**
   * Opt-in local-path jail for media uploads.
   *
   * @remarks
   * Flows into every page `Ctx` via `createCtx` (mirrors the `log`
   * channel). Jail-off cases (current behavior unchanged, byte-identical):
   * - `undefined` (omitted) — jail off, any existing local path uploads.
   * - `null` (explicit) — same as omitted, jail off.
   * - `[]` (empty array) — same as omitted, jail off.
   * When set to a non-empty array, a local file path uploads only when
   * its resolved absolute form sits under one of the resolved roots —
   * otherwise it passes through as a `file_id` with a `log.warn`.
   * `file_id`/URL/`Buffer`/`InputFile` sources are unaffected.
   *
   * @example
   * ```typescript
   * const bot = new Gramstax({
   *   token: process.env.BOT_TOKEN,
   *   mediaRoots: [`./backups`, `./logs`]
   * })
   * // `<g-media src="./backups/db.tar.gz">` uploads normally;
   * // `src="/etc/passwd"` passes through as a file_id with a log.warn.
   * ```
   *
   * @defaultValue `undefined` (jail off)
   */
  mediaRoots?: string[] | null

  /**
   * Bot configuration options.
   *
   * @remarks
   * Stored as `this.botConfig` and forwarded to the grammY `Bot`
   * constructor via `createBot` — use it to customize API client settings
   * like `apiRoot` or `client` options.
   *
   * @example
   * ```typescript
   * botConfig: {apiRoot: `https://api.example.com`}
   * ```
   */
  botConfig?: BotConfig<Context>

  /**
   * Custom session cache implementation.
   *
   * @remarks
   * Stored as `this.cacheSession` and forwarded into every page `Ctx`
   * via `ctxScope`. Falls back to an in-memory `CacheExternal` (24h TTL)
   * when omitted. Provides external session storage for persisting user
   * data across restarts.
   *
   * @example
   * ```typescript
   * cacheSession: new CacheExternal(`redis`, 86_400_000)
   * ```
   */
  cacheSession?: CacheExternal

  /**
   * Custom keyboard cache.
   *
   * @remarks
   * Stored as `this.cacheKeyboard` and forwarded into every page `Ctx`
   * via `ctxScope`. Falls back to a fresh `Map` when omitted. Used to
   * cache inline/bottom keyboard configurations for super large keyboard.
   *
   * @example
   * ```typescript
   * cacheKeyboard: new Map()
   * ```
   */
  cacheKeyboard?: Map<string, unknown>

  /**
   * Custom template manager instance.
   *
   * @remarks
   * Stored as `this.templateManager` and forwarded into every page `Ctx`
   * via `ctxScope`. Falls back to a `TemplateManager` over `src/pages`
   * when omitted. Must be a real `TemplateManager` instance — any other
   * value throws (use `deploy: "raw"` for template-less bots). Allows
   * customization of message template rendering and management.
   *
   * @example
   * ```typescript
   * templateManager: new TemplateManager({path: [`./src/pages`]})
   * ```
   */
  templateManager?: TemplateManager

  /**
   * Static page/template manifest for filesystem-less boot.
   *
   * @remarks
   * When provided, pages register from the manifest instead of scanning
   * the pages directory (Cloudflare Workers and other fs-less runtimes).
   * Omit for polling/webhook/test file discovery (unchanged default).
   *
   * @example
   * ```typescript
   * manifest: {pages: [{name: `start`, path: `./start.ts`}]}
   * ```
   */
  manifest?: IAppManifest

  /**
   * Enable/disable the auto-retry plugin.
   *
   * @remarks
   * When enabled (default), the auto-retry plugin is automatically registered
   * on the API client, automatically handling Telegram rate limits by retrying
   * failed requests.
   *
   * @defaultValue `true`
   *
   * @example
   * ```typescript
   * autoRetry: false
   * ```
   */
  autoRetry?: boolean

  /**
   * Forwarded options for the auto-retry plugin (backoff / retry policy).
   *
   * @remarks
   * Only applies when `autoRetry !== false`. Passed straight to
   * `autoRetry(options)` from `@grammyjs/auto-retry`.
   *
   * @example
   * ```typescript
   * autoRetryOptions: {maxRetryAttempts: 3, retryOnInternalServerErrors: true}
   * ```
   */
  autoRetryOptions?: {maxRetryAttempts?: number; retryOnInternalServerErrors?: boolean}

  /**
   * Per-user rate limiting for incoming updates.
   *
   * @remarks
   * When provided, the official `@grammyjs/ratelimiter` middleware is mounted
   * with a fixed window of `windowMs` and a `max` update count per key.
   * Updates that exceed the limit are silently dropped (unless the
   * `hookRateLimited` class hook is overridden to reply).
   *
   * @defaultValue `undefined` (no rate limiting)
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
   * When provided, the `apiThrottler` transformer is mounted on the bot's
   * API client (composing with `autoRetry`), throttling ALL outgoing
   * Telegram API calls with the given Bottleneck buckets (`global`,
   * `group`, `out`).
   *
   * @defaultValue `undefined` (no outgoing throttling)
   *
   * @example
   * ```typescript
   * throttle: {global: {maxConcurrent: 30}}
   * ```
   */
  throttle?: APIThrottlerOptions

  /**
   * Distributed session lock for multi-instance deployments.
   *
   * @remarks
   * When provided (and not `{enabled: false}`), `getSession`/`setSession`/
   * `clearSession` acquire a short lease on the session key so concurrent
   * updates for the same user/chat are serialized or skipped across
   * instances. Lease auto-expires (`leaseMs`, default 5000). Requires a
   * Redis cache backend — with a memory store the lock is auto-disabled
   * with a log line.
   *
   * @defaultValue `undefined` (no session locking)
   *
   * @example
   * ```typescript
   * sessionLock: {enabled: true, leaseMs: 5000, onContended: `skip`}
   * ```
   */
  sessionLock?: ISessionLockOptions

  /**
   * Max time (milliseconds) allowed for a single update handler before the
   * update is treated as timed out (watchdog — the page keeps running but the
   * failure is recorded via `hookUpdateError` and metrics).
   *
   * @remarks
   * Stored as `this._updateTimeoutMs`. Rejected by `_validateConfig` when
   * negative or non-finite.
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
   * Uses a bounded LRU of recent update ids. Handy for webhook retries /
   * at-least-once delivery where a duplicate should not be handled twice.
   * Stored as `this._skipDuplicateUpdate` (`true` only on exact `true`).
   *
   * @defaultValue `false`
   *
   * @example
   * ```typescript
   * skipDuplicateUpdate: true
   * ```
   */
  skipDuplicateUpdate?: boolean

  /**
   * Max length of incoming `message.text` / `message.caption`. Updates longer
   * than this are skipped (counted as invalid). `0` disables the check.
   *
   * @remarks
   * Stored as `this._maxTextLength`. Rejected by `_validateConfig` when
   * negative or non-finite.
   *
   * @defaultValue `0` (unlimited)
   *
   * @example
   * ```typescript
   * maxTextLength: 4096
   * ```
   */
  maxTextLength?: number

  /**
   * Optional HTTP port that serves `GET /health` (liveness) and `GET /stats`
   * (metrics) in any deploy mode. When unset, these routes are only available
   * on the webhook server (if deployed via `webhook`).
   *
   * @remarks
   * Stored as `this._statusServerPort`. Rejected by `_validateConfig`
   * outside `0`–`65535`.
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
   * Defaults to `127.0.0.1` so metrics are not exposed to the network. Set to
   * `0.0.0.0` only when the endpoint is intentionally public. Stored as
   * `this._statusServerHostname`.
   *
   * @defaultValue `"127.0.0.1"`
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
   * Stored on `this.optionsPage` — currently only the callback-data strategy.
   *
   * @example
   * ```typescript
   * optionsPage: {shortCallbackQueryData: true}
   * ```
   */
  optionsPage?: {
    /**
     * Use numeric callback data for smaller args.
     *
     * @remarks
     * When enabled, callback data uses numeric IDs instead of full strings,
     * reducing payload size for inline keyboards.
     *
     * @defaultValue `false`
     *
     * @example
     * ```typescript
     * shortCallbackQueryData: true
     * ```
     */
    shortCallbackQueryData?: boolean
  }
}

/**
 * Forwarded `Ctx` fields owned by `Gramstax.ctxScope`.
 *
 * @remarks
 * Exactly the `ICtxParams` keys (minus `ct` and `temp`) that `Gramstax`
 * forwards into every page `Ctx`. Add a newly forwarded field here AND
 * in the `Gramstax` constructor scope literal — the `_assertCtxScopeComplete`
 * guard next to `Gramstax.ctxScope` fails `tsc` with the missing field name
 * when this type drifts from `ICtxParams`.
 *
 * @public
 */
export type IGramstaxCtxScope = Pick<ICtxParams, `cacheSession` | `cacheKeyboard` | `templateManager` | `log` | `mediaRoots` | `onSendError`>

/**
 * Structured error event emitted by `onUpdateError`.
 *
 * @remarks
 * Built by `_emitUpdateError` / `_onCatch` / `_onStartupError` and delivered
 * to the `hookUpdateError` class hook (Sentry-style sink). Sibling hooks:
 * `hookSendError` (per-send failures) and `hookTrace` (every routed update).
 *
 * @example
 * ```typescript
 * class MyBot extends Gramstax {
 *   override hookUpdateError(event: IUpdateErrorEvent): void {
 *     Sentry.captureException(event.error, {tags: {listener: event.listenerName}})
 *   }
 * }
 * ```
 *
 * @public
 */
export type IUpdateErrorEvent = {
  /**
   * Correlation id for the update.
   *
   * @remarks
   * The Telegram `update_id` as a string, or a local sequence / the
   * literal `startup` for startup failures and `catch` for global errors.
   *
   * @example
   * ```typescript
   * traceId: `123456789`
   * ```
   */
  traceId: string
  /**
   * Listener that was handling the update when it failed.
   *
   * @remarks
   * The `_onHandle` listener name (e.g. `text`, `callbackquerydata`), or
   * `catch` / `startup` for failures outside routing.
   *
   * @example
   * ```typescript
   * listenerName: `text`
   * ```
   */
  listenerName: string
  /**
   * Failure category.
   *
   * @remarks
   * - `error` — handler threw or the global catch fired
   * - `timeout` — the update exceeded `updateTimeoutMs`
   * - `blocked` — `hookBeforeRoute` returned `false`
   * - `no-handler` — page matched but has no handler for the route
   * - `validation` — the update failed input validation
   *
   * @example
   * ```typescript
   * state: `error`
   * ```
   */
  state: `error` | `timeout` | `blocked` | `no-handler` | `validation`
  /**
   * The caught failure value.
   *
   * @remarks
   * Whatever was thrown — an `Error`, a watchdog `UpdateTimeoutError`, or
   * an unknown rejection reason. Forward it to the error sink as-is.
   *
   * @example
   * ```typescript
   * Sentry.captureException(event.error)
   * ```
   */
  error: unknown
  /**
   * Wall-clock time spent on the update in milliseconds.
   *
   * @remarks
   * Measured from dispatch start to failure. `0` for failures raised
   * before routing began (`catch`, `startup`).
   *
   * @example
   * ```typescript
   * durationMs: 42
   * ```
   */
  durationMs: number
  /**
   * Whether the failed handler was editing a message.
   *
   * @remarks
   * `true` when the update was an edit path (`edited_message`,
   * callback-query edit) — error pages should edit rather than reply.
   *
   * @example
   * ```typescript
   * isEdit: false
   * ```
   */
  isEdit: boolean
}

/**
 * Structured success event emitted by `onUpdate`.
 *
 * @remarks
 * Audit-trail counterpart of {@link IUpdateErrorEvent}. Delivered to the
 * `hookUpdate` class hook for matched, no-match, no-handler and blocked
 * states (not for errors/timeouts).
 *
 * @example
 * ```typescript
 * class MyBot extends Gramstax {
 *   override hookUpdate(event: IUpdateSuccessEvent): void {
 *     metrics.count(event.listenerName, event.state)
 *   }
 * }
 * ```
 *
 * @public
 */
export type IUpdateSuccessEvent = {
  /**
   * Correlation id for the update.
   *
   * @remarks
   * The Telegram `update_id` as a string, or a local sequence when the
   * update carries no id.
   *
   * @example
   * ```typescript
   * traceId: `123456789`
   * ```
   */
  traceId: string
  /**
   * Listener that handled the update.
   *
   * @remarks
   * The `_onHandle` listener name (e.g. `text`, `callbackquerydata`).
   *
   * @example
   * ```typescript
   * listenerName: `text`
   * ```
   */
  listenerName: string
  /**
   * Routing outcome.
   *
   * @remarks
   * - `matched` — a handler ran successfully
   * - `no-match` — nothing handled the input (triggers `hookNotFoundPage`)
   * - `no-handler` — page matched but has no handler for the route
   * - `blocked` — `hookBeforeRoute` returned `false`
   *
   * @example
   * ```typescript
   * state: `matched`
   * ```
   */
  state: `matched` | `no-match` | `no-handler` | `blocked`
  /**
   * Wall-clock time spent on the update in milliseconds.
   *
   * @remarks
   * Measured from dispatch start to handler completion.
   *
   * @example
   * ```typescript
   * durationMs: 12
   * ```
   */
  durationMs: number
  /**
   * Whether the handler edited a message.
   *
   * @remarks
   * `true` when the update was an edit path (`edited_message`,
   * callback-query edit).
   *
   * @example
   * ```typescript
   * isEdit: false
   * ```
   */
  isEdit: boolean
}

/**
 * Options for {@link UpdateGate}.
 *
 * @public
 */
export type IUpdateGateOptions = {
  /** Max concurrent updates per key. `0` disables gating entirely. */
  perChatConcurrency: number
  /** Max ms a waiter parks before proceeding ungated, so a hung handler cannot deadlock its key. */
  waiterTimeoutMs: number
  /** Called once per waiter that bypassed on timeout. */
  onTimeout?: (key: string) => void
}

/**
 * Options for {@link UpdateDispatcher}.
 *
 * @public
 */
export type IUpdateDispatcherOptions = {
  queue: UpdateQueue<Update>
  workerCount: number
  perChatConcurrency: number
  waiterTimeoutMs: number
  /** Max ms to wait for in-flight handlers on `stop()` before giving up. */
  drainTimeoutMs: number
  handle: (update: Update) => Promise<void>
  onError: (error: unknown, update: Update) => void
  onWaiterTimeout?: (key: string) => void
}

/**
 * Result of {@link UpdateDispatcher.stop}.
 *
 * @public
 */
export type IUpdateDispatchStopResult = {
  /** True when `drainTimeoutMs` elapsed with handlers still running. */
  timedOut: boolean
  /** Updates still buffered when the drain gave up. */
  residual: number
}
