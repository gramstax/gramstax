import type {BotConfig, Context, FilterQuery} from "grammy"
import type {APIThrottlerOptions} from "@grammyjs/transformer-throttler"
import type {CacheExternal} from "~/cache/external"
import type {Ctx} from "~/core/ctx"
import type {LoggingHelper} from "~/helpers/log"
import type {TemplateManager} from "~/template/manager"

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
 * const entry: ITCustomRouteEntry = {
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
export type ITCustomRouteEntry = {
  /** Page name key in `this.pages.all`. */
  name: string
  /** Method name to call on the page instance (e.g., `"handleInlineQuery"`). */
  routeName: string
  /** Must match the `listenerName` passed to `_onHandle()`. */
  listenerName: string
  /** GrammY event filter string (e.g., `"inline_query"`, `"message:forward_date"`). */
  event: FilterQuery
  /** Predicate: return `true` to dispatch this route for the current update. */
  filter: (ctx: Ctx) => boolean
  /**
   * Pass `false` to skip `hookNotFoundPage` when no route matches
   * (analogous to chat member routes). Defaults to `true`.
   */
  shouldCheckNotFound?: boolean
}

/**
 * Webhook queue configuration for backpressure and worker pooling.
 *
 * @remarks
 * Enable this only for webhook deployments. The queue buffers incoming updates
 * and dispatches them to a worker pool, decoupling HTTP latency from handler work.
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
 * @public
 */
export type ITWebhookQueueConfig = {
  /**
   * Enable webhook queue and worker pool.
   *
   * @remarks
   * Set this to `true` to activate queue-based processing for webhooks.
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
   * When the queue is full, webhook requests will block (default) or be rejected
   * based on `blockWhenFull`.
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
   * throughput for IO-bound handlers.
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
   * Block webhook requests when queue is full.
   *
   * @remarks
   * When `true`, the HTTP request waits until a queue slot is free. When `false`,
   * the request is rejected with HTTP 429.
   *
   * @example
   * ```typescript
   * blockWhenFull: true
   * ```
   */
  blockWhenFull?: boolean
  /**
   * Max milliseconds a webhook request waits for a free queue slot before being
   * rejected with HTTP 429 (only when `blockWhenFull` is true).
   *
   * @defaultValue `10000`
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
   */
  waiterTimeoutMs?: number
}

/**
 * Rate-limit configuration for incoming updates (`@grammyjs/ratelimiter`).
 *
 * @remarks
 * Configuration only — the rate-limit key and the behavior when the limit
 * is exceeded are provided by overriding the {@link Gramstax.hookKeyGenerator}
 * and {@link Gramstax.hookRateLimited} class hooks.
 *
 * @public
 */
export type ITRateLimitOptions = {
  /**
   * Length of the fixed time window in milliseconds.
   */
  windowMs: number
  /**
   * Maximum number of updates a key may send within `windowMs`.
   */
  max: number
}

/**
 * Configuration options for Gramstax bot instance.
 *
 * @public
 */
export type ITGramstaxParams = {
  /**
   * Telegram Bot API token.
   *
   * @remarks
   * This token is obtained from BotFather when creating a new bot.
   *
   * @example
   * ```typescript
   * token: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
   * ```
   */
  token: string

  /**
   * Deployment mode for the bot.
   *
   * @remarks
   * Supported modes:
   * - `"polling"` - Long polling mode for development
   * - `"webhook:<url>"` - Webhook mode with specified URL
   * - `"serverless:<adapter>"` - Serverless mode with specified adapter
   * - `"test"` - Test mode with E2eHelper
   * - `"raw"` - Bare bot: no pages, no templates, no Gramstax routing.
   *   The constructor builds `this.bot` (`Bot`) and returns without
   *   auto-start. Write raw handlers on `bot.bot` and call
   *   `bot.bot.start()` (or `bot.bot.startWebhook(...)`) yourself.
   *   `templateManager` is left undefined.
   *
   * @example
   * ```typescript
   * deploy: "polling"
   * deploy: "webhook:https://example.com/bot"
   * deploy: "serverless:std/http"
   * deploy: "test"
   * deploy: "raw"
   * ```
   */
  deploy: string

  /**
   * Logger configuration.
   *
   * @remarks
   * - Pass a `LoggingPretty` instance for custom logging
   * - Pass `true` to use the default logger
   * - Pass `null` or `false` to disable logging
   *
   * @defaultValue `false`
   */
  log?: LoggingHelper | boolean | null

  /**
   * Bot configuration options.
   *
   * @remarks
   * Use this to customize API client settings like apiRoot.
   */
  botConfig?: BotConfig<Context>

  /** Webhook queue configuration for backpressure and worker pooling. */
  webhookQueue?: ITWebhookQueueConfig

  /**
   * Custom session cache implementation.
   *
   * @remarks
   * Provides external session storage for persisting user data across restarts.
   */
  cacheSession?: CacheExternal

  /**
   * Custom keyboard cache.
   *
   * @remarks
   * Used to cache inline/bottom keyboard configurations for super large keyboard.
   */
  cacheKeyboard?: Map<string, unknown>

  /**
   * Custom template manager instance.
   *
   * @remarks
   * Allows customization of message template rendering and management.
   */
  templateManager?: TemplateManager

  /**
   * Enable/disable the auto-retry plugin.
   *
   * @remarks
   * When enabled (default), the auto-retry plugin is automatically registered
   * on the API client, automatically handling Telegram rate limits by retrying
   * failed requests.
   *
   * @defaultValue `true`
   */
  autoRetry?: boolean

  /**
   * Forwarded options for the auto-retry plugin (backoff / retry policy).
   *
   * @remarks
   * Only applies when `autoRetry !== false`. See `@grammyjs/auto-retry`.
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
   */
  rateLimit?: ITRateLimitOptions

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
   */
  throttle?: APIThrottlerOptions

  /**
   * Max time (milliseconds) allowed for a single update handler before the
   * update is treated as timed out (watchdog — the page keeps running but the
   * failure is recorded via `onUpdateError` and metrics).
   *
   * @defaultValue `30000`
   */
  updateTimeoutMs?: number

  /**
   * Skip updates whose `update_id` was already processed (idempotency).
   *
   * @remarks
   * Uses a bounded LRU of recent update ids. Handy for webhook retries /
   * at-least-once delivery where a duplicate should not be handled twice.
   *
   * @defaultValue `false`
   */
  skipDuplicateUpdate?: boolean

  /**
   * Secret token sent by Telegram in the `X-Telegram-Bot-Api-Secret-Token`
   * header on webhook requests. Mismatching requests return `401`.
   */
  webhookSecretToken?: string

  /**
   * Max length of incoming `message.text` / `message.caption`. Updates longer
   * than this are skipped (counted as invalid). `0` disables the check.
   *
   * @defaultValue `0` (unlimited)
   */
  maxTextLength?: number

  /**
   * Hook invoked with a structured error event for every update failure
   * (errors, timeouts, blocked). Use for log sinks / alerting (Sentry, etc.).
   */
  onUpdateError?: (event: ITUpdateErrorEvent) => void

  /**
   * Optional HTTP port that serves `GET /health` (liveness) and `GET /stats`
   * (metrics) in any deploy mode. When unset, these routes are only available
   * on the webhook server (if deployed via `webhook:`).
   */
  statusServerPort?: number

  /**
   * Hostname the status/health server binds to.
   *
   * @remarks
   * Defaults to `127.0.0.1` so metrics are not exposed to the network. Set to
   * `0.0.0.0` only when the endpoint is intentionally public.
   *
   * @defaultValue `"127.0.0.1"`
   */
  statusServerHostname?: string

  /**
   * Max consecutive polling failures before giving up and stopping the bot.
   *
   * @remarks
   * After a transient failure (network blip, 409 conflict) the bot retries with
   * exponential backoff (1s → 2s → 4s … capped at 60s). After this many retries
   * the bot logs the failure, emits `onUpdateError` and calls `stop()`.
   * `-1` retries forever.
   *
   * @defaultValue `5`
   */
  pollingMaxRetries?: number

  /**
   * Hook invoked with a structured success event after every routed update.
   *
   * @remarks
   * Audit trail counterpart of `onUpdateError`. Fires for matched, no-match,
   * no-handler and blocked states (not for errors/timeouts).
   */
  onUpdate?: (event: ITUpdateSuccessEvent) => void

  /**
   * Page routing configuration options.
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
     */
    shortCallbackQueryData?: boolean
  }
}

/**
 * Structured error event emitted by `onUpdateError`.
 *
 * @public
 */
export type ITUpdateErrorEvent = {
  traceId: string
  listenerName: string
  state: `error` | `timeout` | `blocked` | `no-handler` | `validation`
  error: unknown
  durationMs: number
  isEdit: boolean
}

/**
 * Structured success event emitted by `onUpdate`.
 *
 * @public
 */
export type ITUpdateSuccessEvent = {
  traceId: string
  listenerName: string
  state: `matched` | `no-match` | `no-handler` | `blocked`
  durationMs: number
  isEdit: boolean
}
