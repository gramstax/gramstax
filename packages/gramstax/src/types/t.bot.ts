import type {BotConfig, Context, FilterQuery} from "grammy"
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
