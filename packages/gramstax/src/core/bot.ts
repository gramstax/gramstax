/**
 * Core Telegram bot — main application class.
 *
 * @remarks
 * Extends `Bot` from the Telegram Bot API framework with automatic template
 * page discovery, session management, webhook support, and the Gramstax
 * plugin system. This is the primary entry point for building a Gramstax bot.
 *
 * @public
 */

import {timingSafeEqual} from "node:crypto"
import {existsSync, readFileSync} from "node:fs"
import {createRequire} from "node:module"
import {dirname, join, parse} from "node:path"
import {fileURLToPath, pathToFileURL} from "node:url"
import {autoRetry} from "@grammyjs/auto-retry"
import {chatMemberFilter, myChatMemberFilter} from "@grammyjs/chat-members"
import {hydrateFiles} from "@grammyjs/files"
import {limit} from "@grammyjs/ratelimiter"
import {stream} from "@grammyjs/stream"
import {apiThrottler} from "@grammyjs/transformer-throttler"
import KeyvRedis from "@keyv/redis"
import {API_CONSTANTS, Bot, type BotConfig, type BotError, type Context, type Middleware, webhookCallback} from "grammy"
import type {BotCommandScope, LanguageCode, Update, UserFromGetMe} from "grammy/types"
import {CacheExternal} from "~/cache/external"
import {SessionLock} from "~/core/session-lock"
import {type LoggingHelper, log} from "~/helpers/log"
import {MetricsStore, metricsToPrometheus} from "~/helpers/metrics"
import {PageManager} from "~/page/manager"
import {TemplateManager} from "~/template/manager"
import type {IGramstaxCtxScope, IGramstaxParams, IUpdateErrorEvent, IUpdateQueueConfig, IUpdateSuccessEvent} from "~/types/bot"
import type {ICacheRpc} from "~/types/cache"
import {GRAMSTAX_SERVERLESS_ADAPTERS} from "~/types/config"
import type {ICt, ICtMiddleware, ICtxParams, ISendErrorHook} from "~/types/ctx"
import type {IAppManifest} from "~/types/manifest"
import type {IRedisLockClient} from "~/types/session-lock"
import {UpdateDispatcher} from "~/update/dispatcher"
import {UpdateQueue} from "~/update/queue"
import {E2eHelper} from "../e2e/helper"
import {Ctx} from "./ctx"

type ICustomRouteEntry = {
  name: string
  routeName: string
  listenerName: string
  event: Parameters<Bot<ICt>[`on`]>[0]
  filter: (ctx: Ctx) => boolean
  shouldCheckNotFound?: boolean
}

/** Max ms {@link Gramstax.stop} waits for in-flight queue handlers to finish. @internal */
const QUEUE_DRAIN_TIMEOUT_DEFAULT = 10_000

/** Telegram's hard ceiling for `getUpdates.limit`. @internal */
const POLLING_FETCH_LIMIT_MAX = 100

/**
 * Internal sentinel thrown when an update exceeds `updateTimeoutMs`.
 *
 * @internal
 */
class UpdateTimeoutError extends Error {}

/**
 * Maps every built-in grammY `bot.on(...)` event subscription (constructor) to its listenerName.
 *
 * @remarks
 * Used by `registerCustomRoute` to detect events that already have a built-in
 * listener. Those events must NOT get a second `bot.on` subscription: built-in
 * listeners do not call grammY `next()`, so a later subscription on the same
 * event would never run (the first matching listener consumes the update and
 * terminates the chain). Instead the custom route is dispatched by the built-in
 * subscription through routing id=6 (custom routes).
 *
 * Filter-backed subscriptions (`bot.filter(...)`) live in `_BUILT_IN_FILTER`.
 * Keep both maps in sync with the constructor registration block.
 */
const _BUILT_IN_ON = new Map<string, string>([
  [`callback_query:data`, `callbackquerydata`],
  [`message:text`, `text`],
  [`message:photo`, `photo`],
  [`message:video`, `video`],
  [`message:audio`, `audio`],
  [`message:document`, `document`],
  [`message:animation`, `animation`],
  [`message:voice`, `voice`],
  [`message:video_note`, `videonote`],
  [`message:sticker`, `sticker`],
  [`message:location`, `location`],
  [`message:contact`, `contact`],
  [`chat_member`, `chatmember`],
  [`my_chat_member`, `mychatmember`],
  [`channel_post`, `channelpost`],
  [`edited_channel_post`, `editchannelpost`],
  [`edited_message`, `edit`],
  [`message_reaction`, `reaction`],
  [`inline_query`, `inlinequery`],
  [`chosen_inline_result`, `choseninlineresult`],
  [`pre_checkout_query`, `precheckoutquery`],
  [`shipping_query`, `shippingquery`],
  [`chat_join_request`, `chatjoinrequest`],
  [`poll`, `poll`],
  [`poll_answer`, `pollanswer`],
  [`message:new_chat_members`, `newchatmembers`],
  [`message:left_chat_member`, `leftchatmember`],
  [`business_connection`, `businessconnection`],
  [`business_message`, `businessmessage`],
  [`edited_business_message`, `editedbusinessmessage`],
  [`deleted_business_messages`, `deletedbusinessmessages`],
  [`message_reaction_count`, `messagereactioncount`],
  [`chat_boost`, `chatboost`],
  [`removed_chat_boost`, `removedchatboost`],
  [`message:successful_payment`, `successfulpayment`],
  [`message:refunded_payment`, `refundedpayment`],
  [`message:group_chat_created`, `groupchatcreated`],
  [`message:supergroup_chat_created`, `supergroupchatcreated`],
  [`message:video_chat_started`, `videochatstarted`],
  [`message:video_chat_scheduled`, `videochatscheduled`],
  [`message:video_chat_ended`, `videochatended`],
  [`message:video_chat_participants_invited`, `videochatparticipantsinvited`],
  [`message:chat_shared`, `chatshared`],
  [`message:web_app_data`, `webappdata`],
  [`message:giveaway`, `giveaway`],
  [`message:giveaway_created`, `giveawaycreated`],
  [`message:giveaway_winners`, `giveawaywinners`],
  [`message:giveaway_completed`, `giveawaycompleted`],
  [`message:forum_topic_created`, `forumtopiccreated`],
  [`message:forum_topic_edited`, `forumtopicedited`],
  [`message:forum_topic_closed`, `forumtopicclosed`],
  [`message:forum_topic_reopened`, `forumtopicreopened`],
  [`message:general_forum_topic_hidden`, `generalforumtopichidden`],
  [`message:general_forum_topic_unhidden`, `generalforumtopicunhidden`],
  [`message:proximity_alert_triggered`, `proximityalerttriggered`],
  [`message:connected_website`, `connectedwebsite`],
  [`message:passport_data`, `passportdata`],
  [`message:message_auto_delete_timer_changed`, `messageautodeletetimerchanged`],
  [`message:chat_background_set`, `chatbackgroundset`],
  [`message:new_chat_title`, `newchattitle`],
  [`message:new_chat_photo`, `newchatphoto`],
  [`message:delete_chat_photo`, `deletechatphoto`],
  [`message:write_access_allowed`, `writeaccessallowed`],
  [`message:community_chat_joined`, `communitychatjoined`],
  [`stopped_message_generation`, `stoppedgeneration`]
])

/**
 * Maps every built-in grammY `bot.filter(...)` subscription (constructor) to its listenerName.
 *
 * @remarks
 * Same dispatch contract as `_BUILT_IN_ON`, but for the three events the
 * constructor subscribes via `bot.filter(predicate, ...)` instead of
 * `bot.on(...)`. Kept as a separate map so `registerCustomRoute` can tell
 * the subscription kind apart. Keep in sync with the constructor
 * registration block.
 */
const _BUILT_IN_FILTER = new Map<string, string>([
  [`message:channel_chat_created`, `channelchatcreated`],
  [`message:users_shared`, `usershared`],
  [`message:pinned_message`, `pinmessage`]
])

const __HERE: string | undefined = typeof import.meta.url === `string` ? fileURLToPath(import.meta.url) : undefined
const __PKG_VERSION__: string = (() => {
  try {
    if (__HERE === undefined) throw new Error(`no module path (fs-less runtime)`)
    return JSON.parse(readFileSync(join(dirname(__HERE), `../../package.json`), `utf-8`)).version as string
  } catch {
    return `unknown`
  }
})()

/**
 * Keys of `ICtxParams` (except `ct` and `temp`) missing from `IGramstaxCtxScope`.
 *
 * @remarks
 * Empty (`never`) when the scope covers every forwarded field. The const
 * below turns a non-empty union into a `tsc` error naming the field, so a
 * forgotten forward fails the build instead of shipping `undefined`.
 */
type IMissingCtxScopeFields = Exclude<keyof ICtxParams, keyof IGramstaxCtxScope | `ct` | `temp`>
const _assertCtxScopeComplete: IMissingCtxScopeFields extends never ? [] : [`ctxScope misses ICtxParams field(s):`, IMissingCtxScopeFields] = []

/**
 * Main bot framework class for building Telegram bots.
 *
 * @remarks
 * Gramstax provides a page-based routing system for handling Telegram updates.
 * It automatically loads page classes from the file system and routes incoming
 * messages and callbacks to the appropriate handlers.
 *
 * @typeParam ICtx - The context type extending {@link (Ctx:class)}.
 *
 * @example
 * ```typescript
 * import {Gramstax} from "gramstax"
 *
 * const bot = new Gramstax({
 *   token: process.env.BOT_TOKEN!,
 *   deploy: "polling",
 *   log: true
 * })
 * ```
 *
 * @public
 */
export class Gramstax<ICtx extends Ctx = Ctx> {
  /**
   * Manages template loading and rendering for pages.
   *
   * @remarks
   * Uses {@link TemplateManager} to load page templates from disk.
   */
  templateManager!: TemplateManager

  /**
   * In-memory cache for keyboard instances by language.
   *
   * @remarks
   * Cached values are built from {@link BlockGKeyboard} and reused per language.
   */
  cacheKeyboard: Map<string, unknown>

  /**
   * External cache for user session data.
   *
   * @remarks
   * Uses {@link CacheExternal} with {@link ICacheRpc} transport for persistence.
   */
  cacheSession: CacheExternal<ICacheRpc>

  /**
   * Loaded and sorted page routes.
   *
   * @remarks
   * Derived from page definitions loaded by {@link PageManager}.
   * @readonly
   */
  pages: ReturnType<typeof this._pageLoads>

  /**
   * Page options configuration.
   *
   * @remarks
   * Controls callback data strategy for page routing.
   */
  optionsPage = {
    /**
     * If true, uses numeric index for callback data instead of page names.
     * @defaultValue false
     */
    shortCallbackQueryData: false
  }

  /**
   * Logger instance for debugging and info output.
   *
   * @remarks
   * Uses {@link LoggingHelper} for formatted log output.
   */
  log: LoggingHelper | undefined

  /**
   * Opt-in local-path jail for media uploads.
   *
   * @remarks
   * Forwarded into every page `Ctx` via `createCtx` (mirrors `log`).
   * `null`/empty means free; when set, local file uploads outside the
   * roots pass through as `file_id` with a `log.warn`.
   */
  mediaRoots?: string[] | null

  /**
   * Forwarded `Ctx` fields, built once in the constructor.
   *
   * @remarks
   * Single source of truth for `Gramstax` → `Ctx` forwarding, spread by
   * `buildCtxParams` on every `createCtx` call. To forward a new field:
   * 1. add it to `IGramstaxParams` (input) and `ICtxParams` (output),
   * 2. add it to `IGramstaxCtxScope` (keeps the guard below honest),
   * 3. set it here in the constructor scope literal (raw branch included),
   * 4. copy it field-by-field in the `Ctx` constructor.
   * Skipping step 2 fails `tsc` with the missing field name.
   */
  ctxScope!: IGramstaxCtxScope

  /**
   * The underlying Bot instance.
   *
   * @remarks
   * Instance of the `Bot`.
   */
  bot: Bot<ICt>

  /**
   * Optional bot configuration.
   *
   * @remarks
   * Configuration object for `BotConfig` and `Context`.
   */
  botConfig?: BotConfig<ICt>

  /**
   * Webhook queue configuration.
   *
   * @remarks
   * See {@link IUpdateQueueConfig} for queue settings.
   */
  webhookQueue?: IUpdateQueueConfig

  /**
   * Active webhook queue instance.
   * @internal
   */
  webhookQueueInstance?: UpdateQueue<Update>

  /**
   * Worker pool draining {@link webhookQueueInstance} through a per-chat gate.
   *
   * @remarks
   * `undefined` unless the queue is enabled. `stop()` awaits
   * {@link UpdateDispatcher.stop} so in-flight handlers finish before teardown.
   *
   * @internal
   */
  webhookDispatcher?: UpdateDispatcher

  /**
   * Drain budget handed to {@link webhookDispatcher}, reported by
   * {@link getWebhookQueueStats}.
   * @internal
   */
  webhookDrainTimeoutMs = QUEUE_DRAIN_TIMEOUT_DEFAULT

  /**
   * Polling queue configuration, read from `optionsDeploy.polling.queue`.
   *
   * @remarks
   * `undefined` unless configured. When `enabled`, `_runPolling` hands updates
   * to an {@link UpdateDispatcher} instead of draining them inline.
   *
   * @internal
   */
  pollingQueue?: IUpdateQueueConfig

  /**
   * Active polling dispatcher, or `undefined` while polling is inline.
   * @internal
   */
  pollingDispatcher?: UpdateDispatcher

  /**
   * Active polling queue instance.
   * @internal
   */
  pollingQueueInstance?: UpdateQueue<Update>

  /**
   * Active webhook server instance.
   * @internal
   */
  webhookServer?: {stop: () => void}

  /**
   * SIGINT handler for graceful shutdown.
   * @internal
   */
  _onSigint?: () => void

  /**
   * SIGTERM handler for graceful shutdown.
   * @internal
   */
  _onSigterm?: () => void

  /**
   * Runtime metrics snapshot source (observability).
   * @public
   */
  readonly metrics = new MetricsStore()

  /** Max time (ms) an update handler may run before being treated as timed out. @internal */
  _updateTimeoutMs = 30_000
  /** Skip updates with a previously seen `update_id`. @internal */
  _skipDuplicateUpdate = false
  /** Webhook secret token checked on POST requests. @internal */
  _webhookSecretToken?: string
  /** Distributed session lock (opt-in via `sessionLock` param). @internal */
  _sessionLock?: SessionLock
  /** Custom session lock key factory (defaults to `ctx.sessionKey()`). @internal */
  _sessionLockKey?: (ctx: Ctx) => string
  /** Max accepted `message.text`/`caption` length (0 = unlimited). @internal */
  _maxTextLength = 0
  /** Max consecutive polling failures before giving up (-1 = infinite). @internal */
  _pollingMaxRetries = 5
  /** Whether boot asks Telegram to discard updates queued during downtime. @internal */
  _pollingDropPendingUpdates = false
  /** Set once `stop()` begins; the polling loop checks it before every retry. @internal */
  _pollingStopped = false
  /** Active polling backoff sleep timer (cleared by `stop()`). @internal */
  _pollingSleepTimer?: ReturnType<typeof setTimeout>
  /** Resolver for the active polling backoff sleep (settled by `stop()`). @internal */
  _pollingSleepResolve?: () => void
  /** Hostname for the status/health server. @internal */
  _statusServerHostname = `127.0.0.1`
  /** Optional HTTP port for `/health` and `/stats`. @internal */
  _statusServerPort?: number

  /** Bounded LRU of seen update ids (idempotency). @internal */
  _seenUpdates = new Map<number, number>()
  /** Max entries kept in `_seenUpdates` before evicting the oldest insertion. @internal */
  _seenUpdatesMax = 1024
  /** Local sequence for trace ids when `update_id` is missing. @internal */
  _traceSeq = 0
  /** Optional status/health HTTP server (any deploy mode). @internal */
  _statusServer?: {stop: () => void}

  /**
   * Resolves once the startup hooks (`hookBeforeStart`/`hookAfterStart`)
   * complete for constructor-driven modes (`raw`, `test`).
   *
   * @remarks
   * The constructor cannot `await`, so sync construction is preserved
   * (hooks still fire in order) while async completion is observable here.
   */
  ready: Promise<void> = Promise.resolve()

  /**
   * Handler function for processing bot updates.
   * @remarks
   * Can be customized for serverless or webhook deployments.
   */
  handlerBotUpdate: (...args: unknown[]) => Promise<unknown>

  /**
   * Deploy type
   * @remarks
   * Deploy type from constructor params
   */
  deployType: `polling` | `webhook` | `serverless` | `test` | `raw`

  /**
   * In-process E2E testing helper.
   *
   * @remarks
   * Available only when `deploy: "test"`. Provides methods to simulate
   * Telegram updates without any HTTP server. See {@link E2eHelper} for
   * full API documentation.
   *
   * When `deploy` is a `"test"` variant, this is typed as `E2eHelper`;
   * otherwise it is `undefined`.
   *
   * @example
   * ```typescript
   * const bot = new Gramstax({deploy: "test", token: "test"})
   * const responses = await bot.e2e.sendText("/start", {user: {id: 2001}})
   * ```
   */
  e2e?: E2eHelper

  /**
   * Creates a new Gramstax bot instance.
   *
   * @param params - Configuration options. See {@link IGramstaxParams} for all available options.
   *
   * @example
   * ```typescript
   * // Polling mode (development, local testing)
   * new Gramstax({token: "BOT_TOKEN", deploy: "polling"})
   *
   * // Webhook mode with Bun's HTTP server
   * new Gramstax({token: "BOT_TOKEN", deploy: "webhook", optionsDeploy: {webhook: {url: "https://example.com/bot", secretToken: "s3cr3t"}}})
   * ```
   *
   * @example
   * ```typescript
   * // Serverless mode — worker adapter
   * //
   * // The bot does NOT self-host; instead it sets up handlerBotUpdate
   * // for your serverless runtime. Export the handler and let your
   * // platform invoke it per HTTP request.
   *
   * // bot.ts — instantiation
   * const bot = new Gramstax({
   *   token: process.env.BOT_TOKEN!,
   *   deploy: "serverless",
   *   optionsDeploy: {serverless: {"cloudflare-mod": {url: "https://example.com/webhook", secretToken: env.BOT_WEBHOOK_SECRET}}}
   * })
   *
   * // handler.ts — server entry point
   * import {bot} from "./bot"
   *
   * // Bun's built-in HTTP server
   * Bun.serve({
   *   port: 3000,
   *   async fetch(req) {
   *     const url = new URL(req.url)
   *     if (url.pathname === "/webhook") {
   *       // Forward the request to gramstax's handler
   *       return await bot.handlerBotUpdate(req)
   *     }
   *     return new Response("Not found", {status: 404})
   *   }
   * })
   * ```
   *
   * @example
   * ```typescript
   * // Serverless mode — AWS Lambda
   * //
   * // bot.ts
   * const bot = new Gramstax({
   *   token: process.env.BOT_TOKEN!,
   *   deploy: "serverless",
   *   optionsDeploy: {serverless: {"aws-lambda-async": {url: "https://example.com/webhook", secretToken: process.env.BOT_WEBHOOK_SECRET}}}
   * })
   *
   * // lambda.ts
   * import {bot} from "./bot"
   * import type {APIGatewayProxyEvent, Context} from "aws-lambda"
   *
   * export const handler = async (event: APIGatewayProxyEvent, _ctx: Context) => {
   *   // webhookCallback(bot.bot, "aws-lambda") wraps the raw event
   *   // into a compatible format internally
   *   return await bot.handlerBotUpdate(event)
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Serverless mode — Cloudflare Workers
   * //
   * // bot.ts
   * const bot = new Gramstax({token: env.BOT_TOKEN, deploy: "serverless", optionsDeploy: {serverless: {"cloudflare-mod": {url: "https://example.com/webhook", secretToken: env.BOT_WEBHOOK_SECRET}}}})
   *
   * // worker.ts
   * import {bot} from "./bot"
   *
   * export default {
   *   async fetch(request: Request) {
   *     const url = new URL(request.url)
   *     if (url.pathname === "/webhook") {
   *       return await bot.handlerBotUpdate(request)
   *     }
   *     return new Response("OK")
   *   }
   * }
   * ```
   *
   * @public
   */
  constructor(params: IGramstaxParams) {
    if (!params?.token || params?.token?.length === 0) {
      throw new Error(`Token is not valid or empty`)
    }

    if (typeof params.optionsPage?.shortCallbackQueryData === `boolean`) {
      this.optionsPage.shortCallbackQueryData = params.optionsPage.shortCallbackQueryData
    }

    this.log = params.log === true ? log : !params.log ? undefined : params.log
    this.log?.info?.(`Gramstax v${__PKG_VERSION__}`)
    this.mediaRoots = params.mediaRoots ?? null
    const buildScope = (): IGramstaxCtxScope => ({
      cacheSession: this.cacheSession,
      cacheKeyboard: this.cacheKeyboard,
      templateManager: this.templateManager,
      log: this.log,
      mediaRoots: this.mediaRoots ?? null,
      onSendError: this.hookSendError?.bind(this) ?? null
    })

    this.cacheSession = params.cacheSession || new CacheExternal(`memory`, 86_400_000)
    this.cacheKeyboard = params.cacheKeyboard || new Map()
    this.botConfig = params.botConfig
    this.webhookQueue = params.optionsDeploy?.webhook?.queue
    this._updateTimeoutMs = params.updateTimeoutMs ?? 30_000
    this._skipDuplicateUpdate = params.skipDuplicateUpdate === true
    this._webhookSecretToken = params.optionsDeploy?.webhook?.secretToken
    if (params.sessionLock?.enabled !== false && params.sessionLock) {
      const store = this.cacheSession.store
      if (store instanceof KeyvRedis) {
        this._sessionLock = new SessionLock(store.client as IRedisLockClient, {
          leaseMs: params.sessionLock.leaseMs ?? 5000,
          onContended: params.sessionLock.onContended ?? `skip`
        })
        this._sessionLockKey = params.sessionLock.key
      } else {
        this.log?.warn?.(`sessionLock requires a Redis cache backend (got memory store) — session lock disabled`)
      }
    }
    this._maxTextLength = params.maxTextLength ?? 0
    this._statusServerPort = params.statusServerPort
    this._statusServerHostname = params.statusServerHostname ?? `127.0.0.1`
    this._pollingMaxRetries = params.optionsDeploy?.polling?.maxRetries ?? 5
    this._pollingDropPendingUpdates = params.optionsDeploy?.polling?.dropPendingUpdates === true
    this.pollingQueue = params.optionsDeploy?.polling?.queue
    this._validateConfig(params)

    this.bot = this.createBot(params.token)
    if (params.autoRetry !== false) {
      this.bot.api.config.use(autoRetry(params.autoRetryOptions ?? {}))
    }
    this.bot.use(stream() as Middleware<Context>)
    if (params.rateLimit) {
      const {windowMs, max} = params.rateLimit
      const rateCtxCache = new WeakMap<object, ICtx>()
      const getRateCtx = (raw: Context): ICtx => {
        let cached = rateCtxCache.get(raw)
        if (!cached) {
          cached = this.createCtx(raw)
          rateCtxCache.set(raw, cached)
        }
        return cached
      }
      this.bot.use(
        limit({
          timeFrame: windowMs,
          limit: max,
          keyGenerator: (ctx) => (this.hookKeyGenerator ? this.hookKeyGenerator(getRateCtx(ctx)) : ctx.from?.id?.toString()),
          onLimitExceeded: (ctx) => {
            void this.hookRateLimited?.(getRateCtx(ctx))
          }
        })
      )
    }
    if (params.throttle) {
      this.bot.api.config.use(apiThrottler(params.throttle))
    }
    this.bot.api.config.use(hydrateFiles(this.bot.token))
    this.bot.catch(this._onCatch)
    this.registerLowPlugin?.()?.forEach((func) => void this.bot.use(func)) // Handle middleware ct

    // Default for customize (very rarely used)
    this.handlerBotUpdate = this.bot.handleUpdate as unknown as (...args: unknown[]) => Promise<unknown>

    // Graceful shutdown (all modes)
    this._onSigint = () => {
      void this.stop()
    }
    this._onSigterm = () => {
      void this.stop()
    }
    process.once(`SIGINT`, this._onSigint)
    process.once(`SIGTERM`, this._onSigterm)

    // ── RAW MODE ──────────────────────────────────────────────────────────
    // Bare bot: no TemplateManager, no page loading, no Gramstax
    // routing listeners, no command sync, and NO auto-start. The caller owns
    // the lifecycle and writes raw handlers on `this.bot`.
    if (params.deploy === `raw`) {
      this.deployType = `raw`
      this.pages = this._buildEmptyPages()
      this.ctxScope = buildScope()
      this.ready = Promise.resolve(this.hookBeforeStart?.()).then(() => undefined)
      return
    }
    // ─────────────────────────────────────────────────────────────────────

    // ── GRAMSTAX PAGE/ROUTING MODE ───────────────────────────────────────
    // Validate templateManager param — the legacy `templateManager: {} as any`
    // worker-bot exception was removed; use `deploy: "raw"` instead.
    if (params.templateManager !== undefined && !(params.templateManager instanceof TemplateManager)) {
      throw new Error(`Raw/worker bots must use deploy: "raw". The templateManager: {} as any exception was removed; ` + `pass a real TemplateManager or omit the option.`)
    }

    this.templateManager =
      params.templateManager ||
      new TemplateManager({
        path: [join(process.cwd(), `src`, `pages`)],
        onReload: () => void this.cacheKeyboard?.clear()
      })
    this.ctxScope = buildScope()

    // Register built-in event listeners (inline — no separate overridable methods)
    this.bot.on(`callback_query:data`, (ctx) => this._onHandle(ctx, `callbackquerydata`))
    this.bot.on(`message:text`, (ctx) => this._onHandle(ctx, `text`))
    this.bot.on(`message:photo`, (ctx) => this._onHandle(ctx, `photo`))
    this.bot.on(`message:video`, (ctx) => this._onHandle(ctx, `video`))
    this.bot.on(`message:audio`, (ctx) => this._onHandle(ctx, `audio`))
    this.bot.on(`message:document`, (ctx) => this._onHandle(ctx, `document`))
    this.bot.on(`message:animation`, (ctx) => this._onHandle(ctx, `animation`))
    this.bot.on(`message:voice`, (ctx) => this._onHandle(ctx, `voice`))
    this.bot.on(`message:video_note`, (ctx) => this._onHandle(ctx, `videonote`))
    this.bot.on(`message:sticker`, (ctx) => this._onHandle(ctx, `sticker`))
    this.bot.on(`message:location`, (ctx) => this._onHandle(ctx, `location`))
    this.bot.on(`message:contact`, (ctx) => this._onHandle(ctx, `contact`))
    this.bot.on(`chat_member`, (ctx) => this._onHandle(ctx, `chatmember`, false))
    this.bot.on(`my_chat_member`, (ctx) => this._onHandle(ctx, `mychatmember`, false))

    // Channel, inline, and other non-message event listeners
    this.bot.on(`channel_post`, (ctx) => this._onHandle(ctx, `channelpost`, false))
    this.bot.on(`edited_channel_post`, (ctx) => this._onHandle(ctx, `editchannelpost`, false))
    this.bot.on(`edited_message`, (ctx) => this._onHandle(ctx, `edit`, false))
    this.bot.on(`message_reaction`, (ctx) => this._onHandle(ctx, `reaction`, false))
    this.bot.on(`inline_query`, (ctx) => this._onHandle(ctx, `inlinequery`, false))
    this.bot.on(`chosen_inline_result`, (ctx) => this._onHandle(ctx, `choseninlineresult`, false))
    this.bot.on(`pre_checkout_query`, (ctx) => this._onHandle(ctx, `precheckoutquery`, false))
    this.bot.on(`shipping_query`, (ctx) => this._onHandle(ctx, `shippingquery`, false))
    this.bot.on(`chat_join_request`, (ctx) => this._onHandle(ctx, `chatjoinrequest`, false))
    this.bot.on(`poll`, (ctx) => this._onHandle(ctx, `poll`, false))
    this.bot.on(`poll_answer`, (ctx) => this._onHandle(ctx, `pollanswer`, false))
    this.bot.on(`message:new_chat_members`, (ctx) => this._onHandle(ctx, `newchatmembers`, false))
    this.bot.on(`message:left_chat_member`, (ctx) => this._onHandle(ctx, `leftchatmember`, false))

    // Business, payments, boosts, and other production event listeners
    this.bot.on(`business_connection`, (ctx) => this._onHandle(ctx, `businessconnection`, false))
    this.bot.on(`business_message`, (ctx) => this._onHandle(ctx, `businessmessage`, false))
    this.bot.on(`edited_business_message`, (ctx) => this._onHandle(ctx, `editedbusinessmessage`, false))
    this.bot.on(`deleted_business_messages`, (ctx) => this._onHandle(ctx, `deletedbusinessmessages`, false))
    this.bot.on(`message_reaction_count`, (ctx) => this._onHandle(ctx, `messagereactioncount`, false))
    this.bot.on(`chat_boost`, (ctx) => this._onHandle(ctx, `chatboost`, false))
    this.bot.on(`removed_chat_boost`, (ctx) => this._onHandle(ctx, `removedchatboost`, false))
    this.bot.on(`message:successful_payment`, (ctx) => this._onHandle(ctx, `successfulpayment`, false))
    this.bot.on(`message:refunded_payment`, (ctx) => this._onHandle(ctx, `refundedpayment`, false))
    this.bot.on(`message:group_chat_created`, (ctx) => this._onHandle(ctx, `groupchatcreated`, false))
    this.bot.on(`message:supergroup_chat_created`, (ctx) => this._onHandle(ctx, `supergroupchatcreated`, false))
    this.bot.filter(
      (ctx) => ctx.message?.channel_chat_created !== undefined,
      (ctx) => this._onHandle(ctx, `channelchatcreated`, false)
    )
    this.bot.on(`message:video_chat_started`, (ctx) => this._onHandle(ctx, `videochatstarted`, false))
    this.bot.on(`message:video_chat_scheduled`, (ctx) => this._onHandle(ctx, `videochatscheduled`, false))
    this.bot.on(`message:video_chat_ended`, (ctx) => this._onHandle(ctx, `videochatended`, false))
    this.bot.on(`message:video_chat_participants_invited`, (ctx) => this._onHandle(ctx, `videochatparticipantsinvited`, false))
    this.bot.filter(
      (ctx) => ctx.message?.users_shared !== undefined,
      (ctx) => this._onHandle(ctx, `usershared`, false)
    )
    this.bot.on(`message:chat_shared`, (ctx) => this._onHandle(ctx, `chatshared`, false))
    this.bot.on(`message:web_app_data`, (ctx) => this._onHandle(ctx, `webappdata`, false))
    this.bot.on(`message:giveaway`, (ctx) => this._onHandle(ctx, `giveaway`, false))
    this.bot.on(`message:giveaway_created`, (ctx) => this._onHandle(ctx, `giveawaycreated`, false))
    this.bot.on(`message:giveaway_winners`, (ctx) => this._onHandle(ctx, `giveawaywinners`, false))
    this.bot.on(`message:giveaway_completed`, (ctx) => this._onHandle(ctx, `giveawaycompleted`, false))
    this.bot.filter(
      (ctx) => ctx.message?.pinned_message !== undefined,
      (ctx) => this._onHandle(ctx, `pinmessage`, false)
    )
    this.bot.on(`message:forum_topic_created`, (ctx) => this._onHandle(ctx, `forumtopiccreated`, false))
    this.bot.on(`message:forum_topic_edited`, (ctx) => this._onHandle(ctx, `forumtopicedited`, false))
    this.bot.on(`message:forum_topic_closed`, (ctx) => this._onHandle(ctx, `forumtopicclosed`, false))
    this.bot.on(`message:forum_topic_reopened`, (ctx) => this._onHandle(ctx, `forumtopicreopened`, false))
    this.bot.on(`message:general_forum_topic_hidden`, (ctx) => this._onHandle(ctx, `generalforumtopichidden`, false))
    this.bot.on(`message:general_forum_topic_unhidden`, (ctx) => this._onHandle(ctx, `generalforumtopicunhidden`, false))
    this.bot.on(`message:proximity_alert_triggered`, (ctx) => this._onHandle(ctx, `proximityalerttriggered`, false))
    this.bot.on(`message:connected_website`, (ctx) => this._onHandle(ctx, `connectedwebsite`, false))
    this.bot.on(`message:passport_data`, (ctx) => this._onHandle(ctx, `passportdata`, false))
    this.bot.on(`message:message_auto_delete_timer_changed`, (ctx) => this._onHandle(ctx, `messageautodeletetimerchanged`, false))
    this.bot.on(`message:chat_background_set`, (ctx) => this._onHandle(ctx, `chatbackgroundset`, false))
    this.bot.on(`message:new_chat_title`, (ctx) => this._onHandle(ctx, `newchattitle`, false))
    this.bot.on(`message:new_chat_photo`, (ctx) => this._onHandle(ctx, `newchatphoto`, false))
    this.bot.on(`message:delete_chat_photo`, (ctx) => this._onHandle(ctx, `deletechatphoto`, false))
    this.bot.on(`message:write_access_allowed`, (ctx) => this._onHandle(ctx, `writeaccessallowed`, false))
    this.bot.on(`message:community_chat_joined`, (ctx) => this._onHandle(ctx, `communitychatjoined`, false))
    this.bot.on(`stopped_message_generation`, (ctx) => this._onHandle(ctx, `stoppedgeneration`, false))

    // Load pages AFTER templateManager is initialized.
    // Serverless deploys run where no pages directory exists, so when the
    // caller passes no manifest we auto-load the frozen .gramstax/ output
    // (built by `gramstax build`) instead of walking the filesystem.
    // Every other deploy keeps the previous behavior byte-identical.
    const manifest = params.manifest ?? this._loadBuildManifest(params.deploy)
    if (manifest !== undefined) {
      this.log?.info?.(`Load pages from .gramstax build output (auto-detected ${params.deploy} deploy).`)
    }
    this.pages = manifest !== undefined ? this._pageLoadsFromManifest(manifest) : this._pageLoads(this.templateManager.path?.[0])

    // Pre-compute chat member filter functions
    if (this.pages.routeChatMember?.length > 0) {
      for (const route of this.pages.routeChatMember!) {
        const factory = route.type === `chatMember` ? chatMemberFilter : myChatMemberFilter
        route.filter = factory(route.oldStatus as unknown as Parameters<typeof chatMemberFilter>[0], route.newStatus as unknown as Parameters<typeof chatMemberFilter>[1]) as (ctx: Ctx) => boolean
      }
    }

    switch (params.deploy) {
      case `polling`: {
        this.deployType = `polling`
        void this._runPolling().catch((error) => this._onStartupError(error))
        break
      }
      case `webhook`: {
        this.deployType = `webhook`
        void this._runWebhook(params.optionsDeploy?.webhook?.url as string).catch((error) => this._onStartupError(error))
        break
      }
      case `serverless`: {
        this.deployType = `serverless`
        const serverlessRecord = params.optionsDeploy?.serverless as Record<string, {url?: string; secretToken?: string} | undefined> | undefined
        const serverlessAdapter = serverlessRecord === undefined ? undefined : Object.keys(serverlessRecord).find((key) => GRAMSTAX_SERVERLESS_ADAPTERS.some((adapter) => adapter === key))
        const serverlessSection = serverlessAdapter === undefined ? undefined : serverlessRecord?.[serverlessAdapter]
        void this._runServerless(serverlessAdapter ?? ``, serverlessSection?.url, serverlessSection?.secretToken).catch((error) => this._onStartupError(error))
        break
      }
      case `test`: {
        this.deployType = `test`
        const beforeHook = this.hookBeforeStart
        const afterHook = this.hookAfterStart
        this.e2e = new E2eHelper(this)
        this.ready = (async () => {
          await beforeHook?.call(this)
          await afterHook?.call(this)
        })()
        // nothing, for test unit internal area
        break
      }
      default: {
        throw new Error(`Params deploy is not valid, expected one of polling, webhook, serverless, raw, test (got "${params.deploy}")`)
      }
    }

    this._startStatusServer()
  }

  /**
   * Stop bot
   *
   * @remarks
   * Drains the webhook dispatcher (bounded by `drainTimeoutMs`) before any
   * teardown, so in-flight handlers never race `templateManager.destroy()` or
   * the keyboard cache clear. A drain that gives up is counted as `dropped`.
   *
   * @public
   */
  async stop() {
    this._pollingStopped = true
    if (this._pollingSleepTimer) {
      clearTimeout(this._pollingSleepTimer)
      this._pollingSleepTimer = undefined
    }
    this._pollingSleepResolve?.()
    this._pollingSleepResolve = undefined
    if (this._onSigint) {
      process.removeListener(`SIGINT`, this._onSigint)
    }
    if (this._onSigterm) {
      process.removeListener(`SIGTERM`, this._onSigterm)
    }
    await this.bot.stop()
    const pollDispatch = await this.pollingDispatcher?.stop()
    if (pollDispatch?.timedOut === true) {
      this.metrics.counts.dropped += pollDispatch.residual
      this.log?.warn?.(`Polling drain timed out — ${pollDispatch.residual} update(s) discarded`)
    }
    const dispatch = await this.webhookDispatcher?.stop()
    if (dispatch?.timedOut === true) {
      this.metrics.counts.dropped += dispatch.residual
      this.log?.warn?.(`Webhook drain timed out — ${dispatch.residual} update(s) discarded`)
    }
    this.webhookQueueInstance?.close()
    await this.templateManager?.destroy()
    this.cacheKeyboard?.clear()
    if (this.deployType === `webhook`) {
      await this.webhookServer?.stop()
      this.webhookServer = undefined
    }
    this._statusServer?.stop()
    this._statusServer = undefined
  }

  /**
   * Validates startup configuration, throwing with a clear message otherwise.
   *
   * @param params - Constructor parameters.
   * @internal
   */
  _validateConfig(params: IGramstaxParams): void {
    if (params.updateTimeoutMs !== undefined && (!Number.isFinite(params.updateTimeoutMs) || params.updateTimeoutMs < 0)) {
      throw new Error(`updateTimeoutMs must be a non-negative number`)
    }
    if (params.maxTextLength !== undefined && (!Number.isFinite(params.maxTextLength) || params.maxTextLength < 0)) {
      throw new Error(`maxTextLength must be a non-negative number`)
    }
    if (params.statusServerPort !== undefined && (params.statusServerPort < 0 || params.statusServerPort > 65535)) {
      throw new Error(`statusServerPort must be between 0 and 65535`)
    }
    const maxRetries = params.optionsDeploy?.polling?.maxRetries
    if (maxRetries !== undefined && (!Number.isFinite(maxRetries) || maxRetries < -1)) {
      throw new Error(`optionsDeploy.polling.maxRetries must be -1 or a non-negative number`)
    }
    // Same range checks for both queue branches, so a programmatic
    // `new Gramstax({...})` gets the same guarantees as the config file.
    const checkQueue = (queue: IUpdateQueueConfig | undefined, path: string) => {
      if (queue?.maxQueueSize !== undefined && (!Number.isFinite(queue.maxQueueSize) || queue.maxQueueSize <= 0)) {
        throw new Error(`${path}.maxQueueSize must be a positive number`)
      }
      if (queue?.workerCount !== undefined && (!Number.isFinite(queue.workerCount) || queue.workerCount < 1)) {
        throw new Error(`${path}.workerCount must be a positive number`)
      }
      if (queue?.enqueueTimeoutMs !== undefined && (!Number.isFinite(queue.enqueueTimeoutMs) || queue.enqueueTimeoutMs < 0)) {
        throw new Error(`${path}.enqueueTimeoutMs must be a non-negative number`)
      }
    }
    checkQueue(params.optionsDeploy?.webhook?.queue, `optionsDeploy.webhook.queue`)
    checkQueue(params.optionsDeploy?.polling?.queue, `optionsDeploy.polling.queue`)
    if (typeof params.deploy === `string` && params.deploy.includes(`:`)) {
      throw new Error(`Params deploy is not valid, expected one of polling, webhook, serverless, raw, test with optionsDeploy {webhook, serverless, polling, raw, test} (legacy colon forms are removed, got "${params.deploy}")`)
    }
    const modes = [`polling`, `webhook`, `serverless`, `raw`, `test`]
    if (modes.includes(params.deploy) === false) {
      throw new Error(`Params deploy is not valid, expected one of polling, webhook, serverless, raw, test (got "${params.deploy}")`)
    }
    const isNonEmptyBranch = (branch: unknown): boolean => {
      if (branch === undefined || branch === null || typeof branch !== `object`) {
        return false
      }
      return Object.values(branch as Record<string, unknown>).some((value) => value !== undefined)
    }
    const serverlessBranch = params.optionsDeploy?.serverless
    const webhookBranch = params.optionsDeploy?.webhook
    const pollingBranch = params.optionsDeploy?.polling
    const rawBranch = params.optionsDeploy?.raw
    const testBranch = params.optionsDeploy?.test
    const isRealUrl = (url: unknown): url is string => typeof url === `string` && /^https?:\/\/.+/.test(url) && url.includes(`<`) === false
    const adapterNames = GRAMSTAX_SERVERLESS_ADAPTERS.map((adapter) => `\`${adapter}\``).join(`, `)
    const requireServerlessSection = (branch: unknown): {adapter: string; section: Record<string, unknown>} => {
      if (branch === undefined || branch === null || typeof branch !== `object`) {
        throw new Error(`Params deploy serverless requires optionsDeploy.serverless to be keyed by one of ${adapterNames} (got "")`)
      }
      const record = branch as Record<string, unknown>
      const keys = Object.keys(record)
      const known = keys.filter((key) => GRAMSTAX_SERVERLESS_ADAPTERS.some((adapter) => adapter === key))
      if (known.length !== 1) {
        throw new Error(`Params deploy serverless requires optionsDeploy.serverless to be keyed by exactly one of ${adapterNames} (got ${keys.length === 0 ? `none` : keys.map((key) => `\`${key}\``).join(`, `)})`)
      }
      const adapter = known[0] as string
      const section = record[adapter]
      if (section === null || typeof section !== `object`) {
        throw new Error(`Params deploy serverless requires optionsDeploy.serverless['${adapter}'] to be an object`)
      }
      return {adapter, section: section as Record<string, unknown>}
    }
    if (params.deploy === `serverless`) {
      if (isNonEmptyBranch(webhookBranch) || isNonEmptyBranch(pollingBranch) || isNonEmptyBranch(rawBranch) || isNonEmptyBranch(testBranch)) {
        throw new Error(`Params deploy "serverless" does not match non-empty optionsDeploy branch (expected optionsDeploy.serverless only)`)
      }
      const resolved = requireServerlessSection(serverlessBranch)
      if (isRealUrl(resolved.section.url) === false) {
        throw new Error(`Params deploy serverless requires optionsDeploy.serverless['${resolved.adapter}'].url to be a real http(s) URL with no placeholder (got "${String(resolved.section.url ?? ``)}")`)
      }
      const serverlessSecretToken = resolved.section.secretToken
      if (typeof serverlessSecretToken !== `string` || serverlessSecretToken.length === 0 || /^[A-Za-z0-9_-]{1,256}$/.test(serverlessSecretToken) === false) {
        throw new Error(`Params deploy serverless requires optionsDeploy.serverless['${resolved.adapter}'].secretToken to be a non-empty string matching ^[A-Za-z0-9_-]{1,256}$ (generate one with: openssl rand -hex 32)`)
      }
    } else if (params.deploy === `webhook`) {
      if (isNonEmptyBranch(serverlessBranch) || isNonEmptyBranch(pollingBranch) || isNonEmptyBranch(rawBranch) || isNonEmptyBranch(testBranch)) {
        throw new Error(`Params deploy "webhook" does not match non-empty optionsDeploy branch (expected optionsDeploy.webhook only)`)
      }
      if (isRealUrl(webhookBranch?.url) === false) {
        throw new Error(`deploy webhook URL is not valid: "${webhookBranch?.url ?? ``}"`)
      }
      let parsed: URL
      try {
        parsed = new URL(webhookBranch?.url as string)
      } catch {
        throw new Error(`deploy webhook URL is not valid: "${webhookBranch?.url ?? ``}"`)
      }
      if (parsed.protocol !== `https:` && parsed.protocol !== `http:`) {
        throw new Error(`deploy webhook URL must use http(s): "${webhookBranch?.url ?? ``}"`)
      }
      const secretToken = webhookBranch?.secretToken
      if (typeof secretToken !== `string` || secretToken.length === 0 || /^[A-Za-z0-9_-]{1,256}$/.test(secretToken) === false) {
        throw new Error(`Params deploy webhook requires optionsDeploy.webhook.secretToken to be a non-empty string matching ^[A-Za-z0-9_-]{1,256}$ (generate one with: openssl rand -hex 32)`)
      }
    } else if (params.deploy === `polling`) {
      if (isNonEmptyBranch(webhookBranch) || isNonEmptyBranch(serverlessBranch) || isNonEmptyBranch(rawBranch) || isNonEmptyBranch(testBranch)) {
        throw new Error(`Params deploy "polling" does not match non-empty optionsDeploy branch (expected optionsDeploy.polling or empty)`)
      }
    } else {
      if (isNonEmptyBranch(webhookBranch) || isNonEmptyBranch(serverlessBranch) || isNonEmptyBranch(pollingBranch) || isNonEmptyBranch(rawBranch) || isNonEmptyBranch(testBranch)) {
        throw new Error(`Params deploy "${params.deploy}" forbids non-empty optionsDeploy (expected empty or optionsDeploy.${params.deploy})`)
      }
    }
  }

  /**
   * Handles a startup failure (webhook/serverless init) with a clear log,
   * a structured error event, and a clean shutdown.
   *
   * @param error - The startup error.
   * @internal
   */
  _onStartupError(error: unknown): void {
    this.metrics.counts.updatesFailed += 1
    this._emitUpdateError({traceId: `startup`, listenerName: `startup`, state: `error`, error, durationMs: 0, isEdit: false})
    this.log?.error?.(`startup failed: ${String(error)}`)
    void this.stop()
  }

  /**
   * Wraps `handlerBotUpdate` with a constant-time secret check.
   *
   * @remarks
   * Verifies the `X-Telegram-Bot-Api-Secret-Token` header against `secret`
   * with `timingSafeEqual` and returns a uniform 401 on mismatch (no body
   * detail, same status whether the route or the secret was wrong). Request
   * shapes without headers (plain update objects) pass through untouched.
   * When no secret is configured the handler is returned unwrapped.
   *
   * @param handler - Inner update handler.
   * @param secret - Expected secret value.
   * @internal
   */
  _withSecretGuard(handler: (...args: unknown[]) => Promise<unknown>, secret: string | undefined): (...args: unknown[]) => Promise<unknown> {
    if (!secret) {
      return handler
    }
    const expected = secret
    return (async (...args: unknown[]) => {
      const candidate = args[0]
      if (this._hasSecretHeaders(candidate)) {
        const header = this._readSecretHeader(candidate)
        if (header === null || header.length !== expected.length || !timingSafeEqual(Buffer.from(header), Buffer.from(expected))) {
          return new Response(`Unauthorized`, {status: 401})
        }
      }
      return handler(...args)
    }) as (...args: unknown[]) => Promise<unknown>
  }

  /**
   * Reports whether a `handlerBotUpdate` argument carries HTTP headers.
   *
   * @param req - First handler argument (Request, lambda event, or update).
   * @internal
   */
  _hasSecretHeaders(req: unknown): boolean {
    if (typeof req !== `object` || req === null) {
      return false
    }
    const headers = (req as {headers?: unknown}).headers
    if (headers === undefined || headers === null) {
      return false
    }
    if (typeof (headers as {get?: unknown}).get === `function`) {
      return true
    }
    return typeof headers === `object`
  }

  /**
   * Extracts the `X-Telegram-Bot-Api-Secret-Token` header value.
   *
   * @remarks
   * Supports `Request` (`headers.get`) and lambda-style plain-object
   * headers (case-insensitive). Returns `null` when absent.
   *
   * @param req - First handler argument.
   * @internal
   */
  _readSecretHeader(req: unknown): string | null {
    if (typeof req !== `object` || req === null) {
      return null
    }
    const headers = (req as {headers?: unknown}).headers
    if (headers === undefined || headers === null) {
      return null
    }
    const getter = (headers as {get?: unknown}).get
    if (typeof getter === `function`) {
      const value = (getter as (name: string) => string | null).call(headers, `X-Telegram-Bot-Api-Secret-Token`)
      return typeof value === `string` ? value : null
    }
    if (typeof headers === `object`) {
      for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
        if (key.toLowerCase() === `x-telegram-bot-api-secret-token`) {
          return typeof value === `string` ? value : Array.isArray(value) && typeof value[0] === `string` ? value[0] : null
        }
      }
    }
    return null
  }

  /**
   * Starts a small HTTP server exposing `GET /health` and `GET /stats`
   * (any deploy mode). No-op when the webhook server already serves them.
   *
   * @internal
   */
  _startStatusServer(): void {
    if (this._statusServer || this._statusServerPort === undefined) {
      return
    }
    const port = this._statusServerPort
    const hostname = this._statusServerHostname
    void import(`bun`)
      .then(({serve}) => {
        this._statusServer = serve({
          port,
          hostname,
          fetch: (req) => {
            const {pathname} = new URL(req.url)
            if (pathname === `/health`) {
              return new Response(JSON.stringify({status: `ok`}), {status: 200, headers: {"Content-Type": `application/json`}})
            }
            if ((pathname === `/stats` || pathname === `/metrics`) && this._webhookSecretToken) {
              const secret = req.headers.get(`X-Telegram-Bot-Api-Secret-Token`)
              if (secret === null || secret.length !== this._webhookSecretToken.length || !timingSafeEqual(Buffer.from(secret), Buffer.from(this._webhookSecretToken))) {
                return new Response(`Unauthorized`, {status: 401})
              }
            }
            if (pathname === `/stats`) {
              return new Response(JSON.stringify(this.metrics.snapshot()), {status: 200, headers: {"Content-Type": `application/json`}})
            }
            if (pathname === `/metrics`) {
              return new Response(metricsToPrometheus(this.metrics.snapshot(), this.webhookQueueInstance?.getStats?.() ?? null), {
                status: 200,
                headers: {"Content-Type": `text/plain; version=0.0.4`}
              })
            }
            return new Response(`Not found`, {status: 404})
          }
        })
        this.log?.info?.(`Status server listening on ${hostname}:${port} (/health, /stats, /metrics)`)
      })
      .catch((error) => {
        this.log?.error?.(`Failed to start status server: ${String(error)}`)
      })
  }

  /** Replaces the bot token with `***` so it never leaks into logs. @internal */
  _redactToken(value: string): string {
    const token = this.bot?.token
    if (!token) return value
    return value.split(token).join(`***`)
  }

  /** Emits a structured update error event via metrics + `hookUpdateError`. @internal */
  _emitUpdateError(event: IUpdateErrorEvent): void {
    try {
      this.hookUpdateError?.(event)
    } catch (error) {
      this.log?.error?.(`hookUpdateError hook failed: ${String(error)}`)
    }
  }

  /**
   * Global error handler for bot errors.
   *
   * @param error - The bot error object.
   *
   * @internal
   */
  _onCatch(error: BotError<ICt>) {
    this.metrics.counts.updatesFailed += 1
    const traceId = String(error.ctx?.update?.update_id ?? ``)
    if (this.log?.errorMake) {
      this.log.errorMake(error, `Bot`, `catch`)
    } else {
      const err = this._redactToken(JSON.stringify(error, null, 2))
      this.log?.error?.(`[Bot.catch]: ${err}`)
    }
    this._emitUpdateError({traceId, listenerName: `catch`, state: `error`, error, durationMs: 0, isEdit: false})
  }

  /**
   * Called when the bot successfully starts.
   *
   * @param botInfo - Information about the bot from Telegram.
   * @param method - The deployment method used.
   * @param data - Additional data (URL for webhook/serverless).
   *
   * @internal
   */
  async _onStart(botInfo: UserFromGetMe, method: `polling` | `webhook` | `serverless`, data: string | null) {
    await this.executeSyncBlocksDescription(this.pages)

    const {username} = botInfo
    this.log?.success?.(`Telegram bot deploy ${method} started: ${username} ${method === `webhook` || method === `serverless` ? `(${this._redactToken(data ?? ``)})` : ``}`)
    await this.hookAfterStart?.()
  }

  /**
   * Hook called before the bot starts.
   *
   * @remarks
   * Override this method to run **one-off initialization logic** that must
   * complete before the bot begins dispatching updates — for example,
   * connecting to a database, warming a cache, validating external service
   * credentials, or setting up shared singletons that pages will read from.
   *
   * This hook fires exactly once, after `cacheSession`, `templateManager`,
   * `bot`, and `pages` are initialized, and before polling/webhook/serverless
   * actually begins receiving updates.
   *
   * **Do NOT register middleware here.** Middleware belongs in
   * {@link Gramstax.registerLowPlugin}, which is the dedicated channel for
   * code that should run on every incoming update. `hookBeforeStart` runs
   * once and is the wrong place for per-update logic.
   *
   * For background tasks that need the bot to be alive (cron jobs, periodic
   * cleanup, queue processors), use {@link Gramstax.hookAfterStart} instead.
   *
   * @example
   * ```typescript
   * class MyBot extends Gramstax {
   *   async hookBeforeStart() {
   *     // Validate external service credentials before the bot goes live
   *     if (!process.env.REDIS_URL) {
   *       throw new Error(`REDIS_URL is required`)
   *     }
   *     this.log?.info?.(`Verifying external service connection...`)
   *     await pingRedis(process.env.REDIS_URL)
   *     this.log?.success?.(`External services ready`)
   *   }
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookBeforeStart?(): Promise<void>

  /**
   * Hook called after the bot has started.
   *
   * @remarks
   * Override this method to run post-start logic. The common use case is
   * initializing background workers — long-running tasks that need the bot
   * to be fully alive (scheduled jobs, periodic cleanup, queue processors,
   * cron-like tasks). Unlike `hookBeforeStart` which runs before the bot
   * is up, this hook guarantees the bot is fully started and `this.bot.api`
   * is operational, so any task that needs to make API calls or interact
   * with the bot instance should be started here.
   *
   * @example
   * ```typescript
   * class MyBot extends Gramstax {
   *   async hookAfterStart() {
   *     // Init worker thread from sub WorkerThreadInit
   *     await IncrementJob.launchWorker([5000]) // 5s
   *   }
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookAfterStart?(): Promise<void>

  /**
   * Hook called before routing an update.
   *
   * @remarks
   * Override this method to add pre-routing logic like authentication,
   * rate limiting, or logging.
   *
   * @param ctx - The context instance.
   * @param listenerName - The name of the listener handling this update.
   * @returns True to continue routing, false to abort.
   *
   * @example Simple
   * ```typescript
   * async hookBeforeRoute(ctx: Ctx) {
   *   ...
   * }
   * ```
   *
   * @example Advanced
   * ```typescript
   * async hookBeforeRoute(ctx: Ctx, data: NonNullable<Parameters<NonNullable<Gramstax[`hookBeforeRoute`]>>[1]>) {
   *   console.log(`from listener ${data.listenerName}`)
   *   if (ctx.from!.id! === blockedUserId) {
   *     return false // Will not response
   *   }
   *   return true
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookBeforeRoute?(ctx: ICtx, data?: {listenerName: string; isEdit: boolean}): Promise<boolean>

  /**
   * Hook called after routing an update.
   *
   * @remarks
   * Override this method to add after routing logic like analytics or logging.
   * NOTE: only executed when `hookBeforeRoute` set to return true or not define overrides
   *
   * @param ctx - The context instance.
   * @param listenerName - The name of the listener that handled this update.
   * @param state - Outcome of the routing: `matched` (handler ran successfully),
   * `no-match` (nothing handled the input — triggers `hookNotFoundPage`),
   * `no-handler` (page matched but has no handler for the route),
   * `blocked` (route matched but `hookBeforeRoute` returned false), or `error`.
   *
   * @example Simple
   * ```typescript
   * async hookAfterRoute(ctx: Ctx) {
   *   ...
   * }
   * ```
   *
   * @example Advanced
   * ```typescript
   * async hookAfterRoute(ctx: Ctx, data: NonNullable<Parameters<NonNullable<Gramstax[`hookAfterRoute`]>>[1]>) {
   *   console.log(`[${data.listenerName}] state: ${data.state}`)
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookAfterRoute?(ctx: ICtx, data?: {listenerName: string; state: `matched` | `no-match` | `no-handler` | `blocked` | `error` | `timeout`; isEdit: boolean}): Promise<void>

  /**
   * Hook called when a page handler throws an error.
   *
   * @remarks
   * Override this method to handle errors gracefully, e.g., sending
   * an error message to the user or logging to an external service.
   *
   * A throw from here is contained and logged rather than propagated: this is
   * the last step that can tell a user their request failed, so letting it
   * escape would end the update with nothing sent and nothing recorded.
   *
   * @param ctx - The context instance.
   * @param listenerName - The name of the listener handling this update.
   * @param error - The caught error.
   * @param isEdit - Whether the handler was editing a message.
   *
   * @example Simple
   * ```typescript
   * async hookErrorPage(ctx: Ctx) {
   *   ...
   * }
   * ```
   *
   * @example Advanced
   * ```typescript
   * async hookErrorPage(ctx: Ctx, data: NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>) {
   *   await new StatusPage(ctx).berror.show(`${data.listenerName}:hookErrorPage`, data.error, data.isEdit)
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookErrorPage?(ctx: ICtx, data?: {listenerName: string; error: unknown; isEdit: boolean}): Promise<void>

  /**
   * Hook called when no page handler matches the input.
   *
   * @remarks
   * Override this method to send a "command not found" message or
   * redirect to a help page.
   *
   * @remarks
   * A throw from here is treated as a handler failure rather than propagated: it
   * routes to {@link Gramstax.hookErrorPage}, which is guarded, so a broken
   * fallback page still leaves the user with an error message instead of
   * silence.
   *
   * @param ctx - The context instance.
   *
   * @example Simple
   * ```typescript
   * async hookNotFoundPage(ctx: Ctx) {
   *   await new StatusPage(ctx).bnotFound.show()
   * }
   * ```
   *
   * @example Advanced
   * ```typescript
   * async hookNotFoundPage(ctx: Ctx, data: NonNullable<Parameters<NonNullable<Gramstax[`hookNotFoundPage`]>>[1]>) {
   *   await new StatusPage(ctx).bnotFound.show()
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookNotFoundPage?(ctx: ICtx, data?: {listenerName: string; isEdit: boolean}): Promise<void>

  /**
   * Hook called when a user exceeds the configured `rateLimit` window.
   *
   * @remarks
   * Optional class override. Default: no reply (the update is silently
   * ignored). The context is a fully constructed page context, so the
   * override may render a "please wait" page via `ctx.render`.
   *
   * @param ctx - The page context instance for the blocked update.
   *
   * @example
   * ```typescript
   * async hookRateLimited(ctx: Ctx) {
   *   await ctx.render(`please-wait`)
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookRateLimited?(ctx: ICtx): Promise<void>

  /**
   * Hook called to produce the per-update rate-limit key.
   *
   * @remarks
   * Optional class override. Default: the sender's user id. Override to
   * group updates differently — e.g. per chat, per session, or a shared
   * global bucket. Must be synchronous (the ratelimiter middleware reads
   * the key before the update is dispatched). The context is a fully
   * constructed page context.
   *
   * @param ctx - The page context instance for the update.
   * @returns The rate-limit key, or `undefined` to fall back to the default.
   *
   * @example
   * ```typescript
   * hookKeyGenerator(ctx: Ctx) {
   *   return `global`
   * }
   * ```
   *
   * @virtual
   * @public
   */
  hookKeyGenerator?(ctx: ICtx): string | undefined

  /**
   * Hook invoked with a structured error event for every update failure
   * (errors, timeouts, blocked). Use for log sinks / alerting (Sentry, etc.).
   *
   * @remarks
   * Sibling hooks: `hookSendError` (per-send failures inside `Ctx.render*`,
   * recoverable) and `hookTrace` (every routed update, success included).
   * Routing rule: retry-queue ← `hookSendError`, Sentry ← `hookUpdateError`,
   * dashboard ← `hookTrace`. One incident (e.g. a 403) can fire all three
   * in sequence — do not forward all three to the same alert.
   *
   * @param event - The structured error event. See {@link IUpdateErrorEvent}.
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
   * @virtual
   * @public
   */
  hookUpdateError?(event: IUpdateErrorEvent): void

  /**
   * Hook invoked with a structured success event after every routed update.
   *
   * @remarks
   * Audit trail counterpart of `hookUpdateError`. Fires for matched, no-match,
   * no-handler and blocked states (not for errors/timeouts).
   *
   * @param event - The structured success event. See {@link IUpdateSuccessEvent}.
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
   * @virtual
   * @public
   */
  hookUpdate?(event: IUpdateSuccessEvent): void

  /**
   * Optional OTel-style trace export hook.
   *
   * @remarks
   * Called after every routed update with the listener name, duration, and
   * outcome. Fire-and-forget — the hook is not awaited. Use to export traces
   * to your observability backend.
   *
   * @remarks
   * Sibling hooks: `hookSendError` (per-send failures) and `hookUpdateError`
   * (dead updates). Routing rule: retry-queue ← `hookSendError`,
   * Sentry ← `hookUpdateError`, dashboard ← `hookTrace`.
   *
   * @param span - The trace span with `name`, `durationMs`, and `attributes`.
   *
   * @example
   * ```typescript
   * class MyBot extends Gramstax {
   *   override hookTrace(span: {name: string; durationMs: number; attributes: Record<string, unknown>}): void {
   *     tracer.export(span)
   *   }
   * }
   * ```
   *
   * @defaultValue `undefined` (no trace export)
   * @virtual
   * @public
   */
  hookTrace?(span: {name: string; durationMs: number; attributes: Record<string, unknown>}): void

  /**
   * Best-effort send-error hook.
   *
   * @remarks
   * Flows into every page `Ctx` via `createCtx` (mirrors the `log`
   * channel). Invoked with `{page, kind, chatId}` at every site where a
   * send error is classified; a throwing hook is swallowed. See
   * {@link ISendErrorHook}.
   *
   * @remarks
   * Sibling hooks: `hookUpdateError` (dead updates — terminal) and `hookTrace`
   * (every routed update). This one is the recoverable layer: a
   * `fallback-text` send still serves the user, a `retryable` send still
   * throws to your caller. Routing rule: retry-queue ← `hookSendError`,
   * Sentry ← `hookUpdateError`, dashboard ← `hookTrace`.
   *
   * @param err - The send error.
   * @param info - The send-error info (`page`, `kind`, `chatId`). See {@link ISendErrorHook}.
   *
   * @example
   * ```typescript
   * class MyBot extends Gramstax {
   *   override hookSendError(err: unknown, info: ISendErrorInfo): void {
   *     // info: {page: `admin/logs`, kind: `fallback-text` | `retryable`, chatId?: number}
   *     if (info.kind === `retryable`) queueRetry(info)
   *     else metrics.count(info.page, info.kind)
   *   }
   * }
   * // Throwing inside the hook is swallowed — the send flow never breaks.
   * ```
   *
   * @example Retry-for-later: collect retryables, re-drive them from a job.
   * ```typescript
   * class MyBot extends Gramstax {
   *   retryQueue: Array<{err: unknown, page: string, chatId?: number, at: number}> = []
   *   override hookSendError(err: unknown, info: ISendErrorInfo): void {
   *     if (info.kind === `retryable`) this.retryQueue.push({err, page: info.page, chatId: info.chatId, at: Date.now()})
   *   }
   * }
   * // NOTE: `retryable` still throws to your caller — the hook only observes.
   * // Drain `retryQueue` from a worker/job; do not retry inline (429 needs backoff).
   * ```
   *
   * @example Severity split: Sentry for retryables, logs for user-caused fallbacks.
   * ```typescript
   * class MyBot extends Gramstax {
   *   override hookSendError(err: unknown, info: ISendErrorInfo): void {
   *     if (info.kind === `retryable`) Sentry.captureException(err, {tags: {page: info.page}})
   *     // `fallback-text` (403 blocked, file deleted) is a normal condition — log, don't alert.
   *   }
   * }
   * ```
   *
   * @defaultValue `undefined` (no hook)
   * @virtual
   * @public
   */
  hookSendError?(...args: Parameters<ISendErrorHook>): void

  /**
   * Creates the Bot instance.
   *
   * @param token - The Telegram Bot API token.
   * @returns The Bot instance.
   *
   * @public
   */
  createBot(token: string): Bot<ICt> {
    return new Bot<ICt>(token, this.botConfig)
  }

  /**
   * Builds the params for one page `Ctx`, plus optional app extras.
   *
   * @remarks
   * Only assembly point for `createCtx`: per-update `ct` plus the
   * constructor-built `ctxScope` plus a fresh `temp`. App values (e.g. a
   * database handle) ride in `extra` through the params object, but the
   * `Ctx` constructor does NOT attach them — assign each one explicitly
   * in your subclass constructor so every wiring stays visible and easy
   * to troubleshoot. `extra` keys must not be `ct`/`temp` (thrown here).
   *
   * @typeParam T - App extra fields merged into the returned params.
   * @param ct - The grammy context for the current update.
   * @param extra - Optional app values forwarded into every page `Ctx`.
   * @returns Params for `new Ctx(...)`, shaped as `ICtxParams & T`.
   *
   * @example
   * ```typescript
   * class MyBot extends Gramstax {
   *   db = new Db()
   *   override buildCtxParams<T extends Record<string, unknown> = Record<string, never>>(ct: ICt, _extra?: T): ICtxParams & T & {db: Db} {
   *     return super.buildCtxParams(ct, {db: this.db}) as ICtxParams & T & {db: Db}
   *   }
   * }
   * class CtxCore extends Ctx {
   *   declare db: Db
   *   constructor(params: ICtxParams & {db: Db}) {
   *     super(params)
   *     this.db = params.db
   *   }
   * }
   * // inside any page extending CtxCore: this.db — fully typed, zero casts.
   * ```
   *
   * @public
   */
  buildCtxParams<T extends Record<string, unknown> = Record<string, never>>(ct: ICt, extra?: T): ICtxParams & T {
    if (extra && (`ct` in extra || `temp` in extra)) throw new Error(`Ctx extra must not override reserved key: ${`ct` in extra ? `ct` : `temp`}`)
    return {ct, ...this.ctxScope, ...extra, onSendError: this.hookSendError?.bind(this) ?? null, temp: {isAnswer: false, session: {}, data: {}}} as ICtxParams & T
  }

  /**
   * Creates a context instance for handling an update.
   *
   * @param ct - The context object.
   * @returns A new Ctx instance.
   *
   * @public
   */
  createCtx(ct: ICt): ICtx {
    return new Ctx(this.buildCtxParams(ct)) as unknown as ICtx
  }

  /**
   * Starts the bot in long polling mode.
   *
   * @internal
   */
  async _runPolling(): Promise<void> {
    try {
      await this.hookBeforeStart?.()
    } catch (error) {
      this._onStartupError(error)
      return
    }
    const opts: Record<string, unknown> = {
      onStart: (botInfo: UserFromGetMe) => this._onStart(botInfo, `polling`, null)
    }
    // Request all update types to receive channel posts, inline queries,
    // reactions, poll updates, join requests, etc.
    opts.allowed_updates = API_CONSTANTS.ALL_UPDATE_TYPES

    if (this.pollingQueue?.enabled === true) {
      await this._startPollingDispatch(opts, this.pollingQueue)
      return
    }
    void this._startPollingLoop(opts, 0)
  }

  /**
   * Start polling with a bounded queue in front of the update handlers.
   *
   * @remarks
   * grammY keeps owning the `getUpdates` loop and the `offset` bookkeeping; its
   * `handleUpdates` calls `this.handleUpdate(update)`, so replacing that method
   * is the seam. A middleware would not work: `Composer.use` appends to the end
   * of the chain, and gramstax's own routing middleware is terminal, so anything
   * added afterwards never runs. Workers call the captured original, which also
   * removes any need for a re-entrancy guard.
   *
   * Delivery is at-least-once at the enqueue boundary and lossless once the
   * update is in the queue: a crash re-delivers whatever Telegram had not yet
   * handed over, and a saturated queue blocks the fetcher rather than dropping
   * an update whose `offset` Telegram has already acknowledged.
   *
   * @internal
   */
  private async _startPollingDispatch(opts: Record<string, unknown>, queueConfig: IUpdateQueueConfig): Promise<void> {
    const queue = new UpdateQueue<Update>(queueConfig.maxQueueSize ?? 5000)

    this.pollingQueueInstance = queue

    const handleUpdate = this.bot.handleUpdate.bind(this.bot)
    this.bot.handleUpdate = (async (update: Update) => {
      try {
        // Blocks until a slot frees. A saturated queue therefore backpressures
        // grammY's fetcher instead of discarding an update whose offset
        // Telegram has already acknowledged — there is no drop path here.
        await queue.enqueue(update)
      } catch {
        // Only reachable after `stop()` closed the queue. grammY has advanced
        // `lastTriedUpdateId` past this update, so nothing can replay it.
        this.metrics.counts.dropped += 1
        this.log?.warn?.(`Polling update discarded during shutdown (update_id ${update.update_id})`)
      }
    }) as typeof this.bot.handleUpdate

    this.pollingDispatcher = new UpdateDispatcher({
      queue,
      workerCount: queueConfig.workerCount ?? 8,
      perChatConcurrency: queueConfig.perChatConcurrency ?? 1,
      waiterTimeoutMs: queueConfig.waiterTimeoutMs ?? 30_000,
      drainTimeoutMs: queueConfig.drainTimeoutMs ?? QUEUE_DRAIN_TIMEOUT_DEFAULT,
      handle: async (update) => {
        await handleUpdate(update)
      },
      onError: (error) => this.log?.error?.(`Polling worker error: ${String(error)}`)
    })

    const apiGetUpdates = this.bot.api.getUpdates.bind(this.bot.api)
    // grammY declares `AbortSignal` twice — global in `api.d.ts`, a shim in
    // `client.d.ts` — so both sides below are derived from the bound method
    // rather than annotated, and the one cast sits on the assignment.
    const clampFetchLimit = async (other: Parameters<typeof apiGetUpdates>[0], signal: Parameters<typeof apiGetUpdates>[1]) => {
      const ceiling = typeof other?.limit === `number` ? other.limit : POLLING_FETCH_LIMIT_MAX
      const free = this.pollingDispatcher?.capacity() ?? POLLING_FETCH_LIMIT_MAX
      return await apiGetUpdates({...other, limit: Math.max(1, Math.min(ceiling, free, POLLING_FETCH_LIMIT_MAX))}, signal)
    }
    this.bot.api.getUpdates = clampFetchLimit as typeof this.bot.api.getUpdates

    await this.bot.init()
    this.pollingDispatcher.start()
    void this._startPollingLoop(opts, 0)
  }

  /**
   * Live polling queue statistics.
   *
   * @returns Stats when the polling queue is enabled, otherwise `null`.
   *
   * @public
   */
  getPollingQueueStats() {
    if (this.pollingQueue?.enabled !== true || this.pollingQueueInstance === undefined) {
      return null
    }
    const queueConfig = this.pollingQueue
    const gate = this.pollingDispatcher?.stats()
    return {
      enabled: true,
      maxQueueSize: queueConfig.maxQueueSize ?? 5000,
      workerCount: queueConfig.workerCount ?? 8,
      perChatConcurrency: queueConfig.perChatConcurrency ?? 1,
      drainTimeoutMs: queueConfig.drainTimeoutMs ?? QUEUE_DRAIN_TIMEOUT_DEFAULT,
      activeKeys: gate?.activeKeys ?? 0,
      waiting: gate?.waiting ?? 0,
      ...this.pollingQueueInstance.getStats()
    }
  }

  /**
   * Runs the polling loop with exponential-backoff retries on transient
   * failures. Gives up (logs + `hookUpdateError` + `stop()`) after
   * `_pollingMaxRetries` consecutive failures, or retries forever when `-1`.
   *
   * @remarks
   * `drop_pending_updates` stays `false` unless
   * {@link Gramstax._pollingDropPendingUpdates} is opted in. Telegram holds
   * undelivered updates for up to 24h, so the default replays whatever arrived
   * while the process was down instead of deleting it on boot — the flag only
   * ever applies to the first attempt, since retries must keep the backlog.
   *
   * @param opts - grammY `bot.start` options.
   * @param attempt - Current retry attempt (0 = first run).
   * @internal
   */
  async _startPollingLoop(opts: Record<string, unknown>, attempt: number): Promise<void> {
    if (this._pollingStopped) {
      return
    }
    const attemptOpts = {...opts, drop_pending_updates: attempt === 0 && this._pollingDropPendingUpdates}
    try {
      await this.bot.start(attemptOpts)
    } catch (error) {
      if (this._pollingStopped) {
        return
      }
      this.metrics.counts.updatesFailed += 1
      this._emitUpdateError({traceId: `polling`, listenerName: `polling`, state: `error`, error, durationMs: 0, isEdit: false})
      if (this._pollingMaxRetries >= 0 && attempt >= this._pollingMaxRetries) {
        this.log?.error?.(`[Polling] stopped after ${attempt + 1} attempts: ${String(error)}`)
        await this.stop()
        return
      }
      const delay = Math.min(60_000, 1000 * 2 ** attempt)
      this.log?.warn?.(`[Polling] attempt ${attempt + 1} failed, retrying in ${delay}ms: ${String(error)}`)
      await new Promise<void>((resolve) => {
        if (this._pollingStopped) {
          resolve()
          return
        }
        this._pollingSleepResolve = resolve
        this._pollingSleepTimer = setTimeout(() => {
          this._pollingSleepTimer = undefined
          this._pollingSleepResolve = undefined
          resolve()
        }, delay)
      })
      this._pollingSleepTimer = undefined
      this._pollingSleepResolve = undefined
      if (this._pollingStopped) {
        return
      }
      await this._startPollingLoop(opts, attempt + 1)
    }
  }

  /**
   * Starts the bot in webhook mode.
   *
   * @remarks
   * Uses Bun's built-in HTTP server. Automatically sets the webhook URL if needed.
   *
   * @param fullUrl - The full public URL for the webhook.
   *
   * @internal
   */
  async _runWebhook(fullUrl: string): Promise<void> {
    await this.hookBeforeStart?.()
    const {serve} = await import(`bun`) // <==== import in this because this package support node/bun (default use bun)
    const handleUpdate = webhookCallback(this.bot, `bun`)
    const queueConfig = this.webhookQueue
    const queueEnabled = queueConfig?.enabled === true
    this.handlerBotUpdate = this._withSecretGuard((queueEnabled ? this.bot.handleUpdate.bind(this.bot) : handleUpdate) as unknown as (...args: unknown[]) => Promise<unknown>, this._webhookSecretToken)

    const queue = queueEnabled ? new UpdateQueue<Update>(queueConfig?.maxQueueSize ?? 5000) : undefined
    const workerCount = queueConfig?.workerCount ?? 8
    const perChatConcurrency = queueConfig?.perChatConcurrency ?? 1
    const blockWhenFull = queueConfig?.blockWhenFull !== false

    this.webhookQueueInstance = queue

    if (queueEnabled && queue) {
      const drainTimeoutMs = queueConfig?.drainTimeoutMs ?? QUEUE_DRAIN_TIMEOUT_DEFAULT
      this.webhookDrainTimeoutMs = drainTimeoutMs
      await this.bot.init()
      this.webhookDispatcher = new UpdateDispatcher({
        queue,
        workerCount,
        perChatConcurrency,
        waiterTimeoutMs: queueConfig?.waiterTimeoutMs ?? 30_000,
        drainTimeoutMs,
        handle: (update) => this.bot.handleUpdate(update),
        onError: (error) => this.log?.error?.(`Webhook worker error: ${String(error)}`)
      })
      this.webhookDispatcher.start()
    }

    const url = new URL(fullUrl)
    const pathUrl = url.pathname
    const port = parseInt(url.port) || 3000
    const logger = this.log
    const statsPath = `/stats_queue`
    // `activeChats` stays as the legacy alias of the gate's `activeKeys` so both
    // HTTP payloads keep the shape existing scrapers already parse.
    const gateStats = () => {
      const gate = this.webhookDispatcher?.stats() ?? {activeKeys: 0, waiting: 0}
      return {...gate, activeChats: gate.activeKeys}
    }
    this.webhookServer?.stop()
    const self = this
    const server = serve({
      port,
      async fetch(req) {
        if (self._webhookSecretToken) {
          const secret = req.headers.get(`X-Telegram-Bot-Api-Secret-Token`)
          if (secret === null || secret.length !== self._webhookSecretToken.length || !timingSafeEqual(Buffer.from(secret), Buffer.from(self._webhookSecretToken))) {
            return new Response(`Unauthorized`, {status: 401})
          }
        }
        const {pathname} = new URL(req.url)
        if (req.method === `GET` && (pathname === `/health` || pathname === `/stats`)) {
          if (pathname === `/health`) {
            return new Response(JSON.stringify({status: `ok`}), {status: 200, headers: {"Content-Type": `application/json`}})
          }
          const stats = queue?.getStats() || {length: 0, maxSize: queueConfig?.maxQueueSize ?? 5000, waitingEnqueue: 0, waitingDequeue: 0}
          return new Response(
            JSON.stringify({
              ...self.metrics.snapshot(),
              queue: {enabled: queueEnabled, ...stats, workerCount, perChatConcurrency, blockWhenFull, ...gateStats()}
            }),
            {status: 200, headers: {"Content-Type": `application/json`}}
          )
        }
        if (req.method === `POST` && pathname === pathUrl) {
          if (!queueEnabled || !queue) {
            return handleUpdate(req)
          }

          if (!blockWhenFull && queue.length >= (queueConfig?.maxQueueSize ?? 5000)) {
            logger?.warn?.(`Webhook queue full (${queue.length}) — dropping update (429)`)
            return new Response(`Queue full`, {status: 429})
          }

          try {
            const update = await req.json()
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), queueConfig?.enqueueTimeoutMs ?? 10_000)
            timeoutId.unref?.()
            try {
              await queue.enqueue(update as Update, controller.signal)
            } finally {
              clearTimeout(timeoutId)
            }
            return new Response(`OK`, {status: 200})
          } catch (error) {
            if (error instanceof Error && error.message === `WebhookQueue enqueue aborted`) {
              logger?.warn?.(`Webhook queue enqueue timed out — dropping update (429)`)
              return new Response(`Queue full`, {status: 429})
            }
            logger?.error?.(`Webhook queue error: ${String(error)}`)
            return new Response(`Bad Request`, {status: 400})
          }
        }

        if (req.method === `GET` && pathname === statsPath) {
          const stats = queue?.getStats() || {length: 0, maxSize: queueConfig?.maxQueueSize ?? 5000, waitingEnqueue: 0, waitingDequeue: 0}
          return new Response(
            JSON.stringify({
              enabled: queueEnabled,
              path: statsPath,
              timestamp: new Date().toISOString(),
              maxQueueSize: queueConfig?.maxQueueSize ?? 5000,
              workerCount,
              perChatConcurrency,
              blockWhenFull,
              queue: stats,
              ...gateStats()
            }),
            {status: 200, headers: {"Content-Type": `application/json`}}
          )
        }
        if (req.method === `GET` && pathname === `/`) {
          const timestamp = new Date().toISOString()
          return new Response(JSON.stringify({status: `OK`, timestamp}), {
            status: 200,
            headers: {"Content-Type": `application/json`}
          })
        }
        return new Response(`Not found`, {status: 404})
      }
    })
    this.webhookServer = server

    const data = await this.bot.api.getWebhookInfo()
    if (data.url !== fullUrl) {
      if (self._webhookSecretToken) {
        await this.bot.api.setWebhook(fullUrl, {secret_token: self._webhookSecretToken})
      } else {
        await this.bot.api.setWebhook(fullUrl)
      }
    }

    const botInfo = await this.bot.api.getMe()
    await this._onStart(botInfo, `webhook`, fullUrl)
  }

  /**
   * Get current webhook queue statistics.
   *
   * @remarks
   * Superset of the queue-only shape: every previously returned key is still
   * present, plus the dispatcher's per-key gate (`activeKeys`/`waiting`) and
   * its `drainTimeoutMs` budget. Gate values are `0` before `_runWebhook` builds
   * the dispatcher.
   *
   * @returns Stats object when queue is enabled, otherwise `null`.
   * @public
   */
  getWebhookQueueStats() {
    if (!this.webhookQueue?.enabled || !this.webhookQueueInstance) {
      return null
    }

    const queueStats = this.webhookQueueInstance.getStats()
    const maxQueueSize = this.webhookQueue.maxQueueSize ?? 5000
    const workerCount = this.webhookQueue.workerCount ?? 8
    const perChatConcurrency = this.webhookQueue.perChatConcurrency ?? 1
    const blockWhenFull = this.webhookQueue.blockWhenFull !== false

    return {
      enabled: true,
      maxQueueSize,
      workerCount,
      perChatConcurrency,
      blockWhenFull,
      drainTimeoutMs: this.webhookDrainTimeoutMs,
      ...queueStats,
      ...(this.webhookDispatcher?.stats() ?? {activeKeys: 0, waiting: 0})
    }
  }

  /**
   * Starts the bot in serverless mode.
   *
   * @remarks
   * Configures the handler for serverless adapters (e.g., AWS Lambda, Cloudflare Workers).
   * When a public URL is given (`serverless` with `optionsDeploy.serverless.url`), registers it
   * via `setWebhook` unless already set — mirroring `_runWebhook`.
   *
   * @param adapter - The adapter name (e.g., "cloudflare-mod", "aws-lambda-async").
   * @param publicUrl - Optional full public webhook URL to register.
   * @param secretToken - Optional branch secretToken (preferred over the env binding).
   *
   * @internal
   */
  async _runServerless(adapter: string, publicUrl?: string, secretToken?: string): Promise<void> {
    await this.hookBeforeStart?.()
    // Emitted serverless entries bake NO secret (strip-on-bake rule): in a deployed worker the baked params carry no secretToken, so the guard must resolve branch-secret ?? env-binding, else edge defense-in-depth silently disables itself.
    const serverlessSecret = secretToken ?? process.env.BOT_WEBHOOK_SECRET
    this.handlerBotUpdate = this._withSecretGuard(webhookCallback(this.bot, adapter as string as Parameters<typeof webhookCallback>[1]) as unknown as (...args: unknown[]) => Promise<unknown>, serverlessSecret)
    if (publicUrl !== undefined) {
      const data = await this.bot.api.getWebhookInfo()
      if (data.url !== publicUrl) {
        if (serverlessSecret) {
          await this.bot.api.setWebhook(publicUrl, {secret_token: serverlessSecret})
        } else {
          await this.bot.api.setWebhook(publicUrl)
        }
      }
    }
    const botInfo = await this.bot.api.getMe()
    await this._onStart(botInfo, `serverless`, adapter)
  }

  /**
   * Builds page data configuration for a page class.
   *
   * @remarks
   * Initializes `Page.data` if undefined and sets default intent values
   * based on the file name.
   *
   * @param Page - The page class.
   * @param filePath - The file path of the page.
   *
   * @internal
   */
  _pageBuildData(Page: typeof Ctx, filePath: string, routeName?: string): void {
    if (Page?.data === undefined) {
      Page.data = Page.buildData()
    }
    const d = Page.data!
    if (routeName !== undefined) {
      d.name ||= routeName
      if (!d.intentText) d.intentText = d.name
      if (!d.intentCommandText) d.intentCommandText = d.name
      if (!d.intentCallbackQueryData) d.intentCallbackQueryData = d.name
    } else {
      const {name} = parse(filePath)
      if (!d.name) d.name = name
      if (!d.intentText) d.intentText = d.name
      if (!d.intentCommandText) d.intentCommandText = d.name
      if (!d.intentCallbackQueryData) d.intentCallbackQueryData = d.name
    }
  }

  /**
   * Registers one page entry into the routing tables.
   *
   * @remarks
   * Shared by disk scan (`_pageLoads`) and manifest boot
   * (`_pageLoadsFromManifest`) so both paths enforce identical
   * uniqueness rules and route sorting.
   *
   * @internal
   */
  _pageRegisterEntry(entry: {path: string; page: typeof Ctx; routeName: string}, pages: typeof Gramstax.prototype.pages, index: number, seen: {names: Set<string>; intentText: Set<string>; intentCommandText: Set<string>; intentCallbackQueryData: Set<string>}): void {
    const {path, page, routeName} = entry
    this._pageBuildData(page, path, routeName)

    const pd = page.data!
    if (seen.names.has(pd.name)) {
      throw new Error(`Duplicate page name "${pd.name}" in ${path} (${page.name}). Each page must have a unique name set via buildData({name: ...}) or derived from the filename.`)
    }
    seen.names.add(pd.name)

    // Check uniqueness against the final routing keys (with `/` and `lang:` prefixes)
    const _checkIntentVariants = (variant: string, seenSet: Set<string>, label: string) => {
      if (seenSet.has(variant)) {
        throw new Error(`Duplicate ${label} "${variant}" in ${path} (${page.name}). Each intentText/intentCommandText variant must be unique across all pages.`)
      }
      seenSet.add(variant)
    }
    if (pd.intentTextMap) {
      for (const [lang, intent] of Object.entries(pd.intentTextMap)) {
        _checkIntentVariants(`${lang}:${intent}`, seen.intentText, `intentText variant`)
      }
    } else if (pd.intentText) {
      _checkIntentVariants(pd.intentText, seen.intentText, `intentText`)
    }
    if (pd.intentCommandTextMap) {
      for (const [, intent] of Object.entries(pd.intentCommandTextMap)) {
        if (intent) _checkIntentVariants(`/${intent}`, seen.intentCommandText, `intentCommandText variant`)
      }
    } else if (pd.intentCommandText) {
      _checkIntentVariants(`/${pd.intentCommandText}`, seen.intentCommandText, `intentCommandText`)
    }

    this._pageSorts(page, pages, index) // sort route method

    // Callback duplicate check runs AFTER the short-id mutation above so it
    // compares the final routing keys (the index scheme is preserved).
    if (pd.intentCallbackQueryData) {
      if (seen.intentCallbackQueryData.has(pd.intentCallbackQueryData)) {
        throw new Error(`Duplicate intentCallbackQueryData "${pd.intentCallbackQueryData}" in ${path} (${page.name}). Pages must have unique intentCallbackQueryData values for callback query routing. Override via buildData({callbackQueryData: ...}).`)
      }
      seen.intentCallbackQueryData.add(pd.intentCallbackQueryData)
    }
    delete page.template // delete template for efficient memory
  }

  /**
   * Sorts and categorizes page routes into routing tables.
   *
   * @remarks
   * Registration happens in 3 phases:
   *
   * **Phase 1 — Non-session static/intent routes** (id=2, id=3):
   * Iterates `listRouteStatic` and `listRouteStaticIntent`. Registers exact-match
   * routes (`handleCallbackQueryData`, `handleText`, `handleCommandText`, `handleCaption*`,
   * `handleCommandCaption*`) into `routeStatic` — and intent-with-args variants
   * (`handleArgs*`, `handleCommandArgs*`, `handleCaptionArgs*`,
   * `handleCommandCaptionArgs*`) into `routeStaticIntent`.
   * Routes are keyed by `intentCommandText` (prefixed with `/`), `intentCallbackQueryData`,
   * `intentText`, or `Page.data.name`.
   *
   * **Phase 2 — Session routes** (id=1):
   * Iterates `listRouteStaticSession`. Registers session-aware variants of all
   * static and free routes (`handleSession*`) into `routeStaticSession`.
   * Keyed by the return value of the corresponding `methodSession*()` method
   * (e.g., `methodSessionFreeText(PageName)` → session method string).
   *
   * **Phase 3 — Non-session free handlers** (id=4):
   * Scans for `handleFree*` methods defined directly on the page (via
   * `Object.hasOwn(proto, routeName)`). Excludes inherited `handleSessionFree*`
   * variants — those are dispatched exclusively via session routing (id=1).
   *
   * Also populates:
   * - `routeDynamic[Page.data.name]` — global fallback `handleFree()` handler
   * - `all[Page.data.name]` — page class reference
   *
   * @param Page - The page class.
   * @param pages - The pages routing structure.
   * @param indexPage - The page index (used for shortCallbackQueryData).
   *
   * @internal
   */
  _pageSorts(Page: typeof Ctx, pages: typeof Gramstax.prototype.pages, indexPage: number): void {
    const d = Page.data!
    const name = d.name
    const proto = Page.prototype

    const partHandle = `handle`
    const partArgs = `Args`
    const partCommand = `Command`
    const partCaption = `Caption`
    const partFree = `Free`

    const pd = pages.routeDynamic
    const pds = pages.routeDynamicSpesific

    // all
    pages.all[name] = Page

    // Non-session static/intent routes (listRouteStatic + listRouteStaticIntent)
    for (const listName of [`listRouteStatic`, `listRouteStaticIntent`] as const) {
      const lenKey = listName === `listRouteStatic` ? `lenListRouteStatic` : `lenListRouteStaticIntent`
      for (let index = 0; index < pages[lenKey]; index++) {
        const routeName = pages[listName][index] as string

        // Check if the method exists on the page
        if (typeof (proto as unknown as Record<string, unknown>)[routeName] !== `function`) {
          continue
        }

        const ps = pages.routeStatic[routeName as keyof typeof pages.routeStatic]
        const psi = pages.routeStaticIntent[routeName as keyof typeof pages.routeStaticIntent]

        const value = {name, routeName}
        const p = ps || psi
        if (p !== undefined) {
          const _isCommand = routeName.includes(partCommand)
          const _isCallbackQueryData = routeName.endsWith(`CallbackQueryData`)
          const _isText = routeName.endsWith(`Text`)

          if (_isText && d.intentTextMap) {
            // Multi-language text intent — register all variants
            for (const [lang, intent] of Object.entries(d.intentTextMap)) {
              const langKey = `${lang}:${intent}`
              p[langKey] = value
            }
          } else if (_isCommand && d.intentCommandTextMap) {
            // Multi-language command intent — register all variants
            for (const [, intent] of Object.entries(d.intentCommandTextMap)) {
              if (intent) p[`/${intent}`] = value
            }
          } else {
            // Single intent (legacy) — existing behavior
            let key: string | undefined
            if (_isCommand) {
              const _key = d.intentCommandText
              key = _key ? `/${_key}` : undefined
            } else if (_isCallbackQueryData) {
              let _key = d.intentCallbackQueryData
              if (this.optionsPage.shortCallbackQueryData === true) {
                _key = String(indexPage)
                d.intentCallbackQueryData = _key
              }
              key = _key
            } else if (_isText) {
              key = d.intentText
            } else {
              key = d.name
            }

            if (key) {
              p[key] = value
            }
          }
        }
      }
    }

    // Session routes (listRouteStaticSession)
    for (let index = 0; index < pages.lenListRouteStaticSession; index++) {
      const routeName = pages.listRouteStaticSession[index] as string

      // Check if the method exists on the page
      if (typeof (proto as unknown as Record<string, unknown>)[routeName] !== `function`) {
        continue
      }

      const pss = pages.routeStaticSession[routeName as keyof typeof pages.routeStaticSession]

      const value = {name, routeName}

      // staticSession: compute session key via methodSession{Base}(name)
      if (pss !== undefined) {
        const hidePartReplace = routeName.replace(`handle`, ``)
        const normalized = hidePartReplace.startsWith(`Session`) ? hidePartReplace.slice(7) : hidePartReplace
        const methodName = `methodSession${normalized}`
        const methodKey = (proto as unknown as Record<string, (name: string) => string>)[methodName]?.(name)
        if (methodKey !== undefined) {
          pss[methodKey] = value
          pages.hasSessionRoutes = true
        }
      }
    }

    // dynamicSpesific — handleFree* (non-session) defined directly on this page
    // (handleSessionFree* variants are dispatched exclusively via session routing id=1,
    //  NOT via dynamicSpesific — dynamic dispatch doesn't check for sessions)
    for (const routeName of pages.listRouteDynamicSpesific) {
      if (Object.hasOwn(proto, routeName) && typeof (proto as unknown as Record<string, unknown>)[routeName] === `function`) {
        const pureName = routeName.replace(partHandle, ``).replace(partArgs, ``).replace(partCommand, ``).replace(partCaption, ``).replace(partFree, ``).toLowerCase()
        const bucket = pds[pureName as keyof typeof pds]
        const alreadyExists = bucket?.some((item) => item.name === name)
        if (!alreadyExists && bucket) {
          bucket.push({name, routeName})
        }
      }
    }

    // chatMember — scan handleChatMember* / handleMyChatMember* methods
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key.startsWith(`handleChatMember`) && key !== `handleChatMember`) {
        const rest = key.slice(`handleChatMember`.length) // e.g., "OutIn"
        const parts = rest.split(/(?=[A-Z])/).filter(Boolean)
        if (parts.length === 2) {
          pages.routeChatMember.push({
            name,
            routeName: key,
            type: `chatMember`,
            oldStatus: parts[0]!.toLowerCase(),
            newStatus: parts[1]!.toLowerCase(),
            filter: () => false // placeholder, replaced in constructor
          })
        }
      } else if (key.startsWith(`handleMyChatMember`) && key !== `handleMyChatMember`) {
        const rest = key.slice(`handleMyChatMember`.length) // e.g., "OutRegular"
        const parts = rest.split(/(?=[A-Z])/).filter(Boolean)
        if (parts.length === 2) {
          pages.routeChatMember.push({
            name,
            routeName: key,
            type: `myChatMember`,
            oldStatus: parts[0]!.toLowerCase(),
            newStatus: parts[1]!.toLowerCase(),
            filter: () => false // placeholder, replaced in constructor
          })
        }
      }
    }

    // all
    if (proto.handleFree) {
      pd.push(name)
    }
  }

  /**
   * Pushes `<g-description>` blocks to Telegram as the bot command list.
   *
   * @remarks
   * Runs after start and syncs per `(scope, language)` pair, because Telegram
   * stores commands per scope and per language rather than globally.
   *
   * Three passes: collect every scope/language pair declared by a
   * `handleCommandText` page; resolve each pair's command list through
   * `getGDescription`, which already owns the fallback chain; then compare
   * against `getMyCommands` and call `setMyCommands` only on a real
   * difference. Comparison is order-insensitive (both sides sorted by command
   * name), so a reordered Telegram response does not trigger a pointless
   * write.
   *
   * Failure is contained per pair — a rejected API call is logged and the
   * remaining scopes still sync, so one bad scope cannot abort the rest.
   * Scope/language pairs with no resolvable description are skipped.
   *
   * @param pages - Routing skeleton whose `routeStatic.handleCommandText`
   * entries supply the command names.
   * @returns Nothing; failures are logged rather than thrown.
   *
   * @internal
   */
  async executeSyncBlocksDescription(pages: typeof Gramstax.prototype.pages) {
    // 1. Collect all unique (scope, language) pairs
    const targets = new Map<string, Set<string>>() // scope -> Set<language>
    const allCommands = pages?.routeStatic?.handleCommandText
    if (!allCommands) {
      return
    }

    for (const [, page] of Object.entries(allCommands)) {
      const name = page.name
      const scopes = this.templateManager.getAGDescriptionScopes(name)

      for (const scope of scopes) {
        if (!targets.has(scope)) {
          targets.set(scope, new Set())
        }

        const langs = this.templateManager.getAGDescriptionLang(name, `default`, scope)
        for (const lang of langs) {
          targets.get(scope)!.add(lang)
        }
      }
    }

    // 2. Build command lists for each (scope, language) pair
    let syncedScopes = 0
    for (const [scope, langs] of targets) {
      for (const lang of langs) {
        const commands: Array<{command: string; description: string}> = []
        for (const [, page] of Object.entries(allCommands)) {
          const name = page.name
          // Use getDescription which handles fallback logic
          const desc = this.templateManager.getGDescription(name, `default`, lang, scope)
          if (desc) {
            commands.push({command: name, description: desc})
          }
        }

        if (commands.length === 0) {
          continue
        }

        // 3. Sync with Telegram
        const scopeObj = {type: scope} as unknown as BotCommandScope
        const langCode = lang === `default` ? undefined : (lang as LanguageCode)
        try {
          const current = await this.bot.api.getMyCommands({scope: scopeObj, language_code: langCode})
          const currentJSON = JSON.stringify(current.map((c) => ({command: c.command, description: c.description})).sort((a, b) => a.command.localeCompare(b.command)))
          const desiredJSON = JSON.stringify(commands.sort((a, b) => a.command.localeCompare(b.command)))

          if (currentJSON !== desiredJSON) {
            await this.bot.api.setMyCommands(commands, {scope: scopeObj, language_code: langCode})
            syncedScopes += 1
            this.log?.debug?.(`Synced descriptions for scope: ${scope},${langCode ? ` lang: ${langCode},` : ``} total (${commands.length})`)
          }
        } catch (error) {
          this.log?.error?.(`Failed to sync descriptions for scope: ${scope},${langCode ? ` lang: ${langCode},` : ``} error: ${String(error)}`)
        }
      }
    }
    if (syncedScopes > 0) {
      this.log?.info?.(`Synced bot descriptions for ${syncedScopes} scope(s).`)
    }
  }

  /**
   * Builds the empty pages routing skeleton (no routes loaded).
   *
   * @remarks
   * Returns the same shape produced by {@link Gramstax._pageLoads} but without
   * scanning the filesystem or sorting any page classes. Used by raw deploy mode
   * so `this.pages` stays type-correct while carrying zero routes.
   *
   * @internal
   */
  _buildEmptyPages() {
    // Helper to keep map result as literal types (prevents widening to string[])
    const toSession = <T extends string>(route: T): `handleSession${T extends `handle${infer R}` ? R : T}` => {
      return `handleSession${route.startsWith(`handle`) ? route.slice(6) : route}` as unknown as `handleSession${T extends `handle${infer R}` ? R : T}`
    }
    const listRouteStatic = [
      // callback
      `handleCallbackQueryData`,
      // text
      `handleText`,
      `handleCommandText`,
      // photo
      `handleCaptionPhoto`,
      `handleCommandCaptionPhoto`,
      // video
      `handleCaptionVideo`,
      `handleCommandCaptionVideo`,
      // audio
      `handleCaptionAudio`,
      `handleCommandCaptionAudio`,
      // document
      `handleCaptionDocument`,
      `handleCommandCaptionDocument`,
      // animation
      `handleCaptionAnimation`,
      `handleCommandCaptionAnimation`,
      // voice
      `handleCaptionVoice`,
      `handleCommandCaptionVoice`
    ] as const
    const listRouteStaticIntent = [
      // callback
      `handleArgsCallbackQueryData`,
      // text
      `handleArgsText`,
      `handleCommandArgsText`,
      // photo
      `handleCaptionArgsPhoto`,
      `handleCommandCaptionArgsPhoto`,
      // video
      `handleCaptionArgsVideo`,
      `handleCommandCaptionArgsVideo`,
      // audio
      `handleCaptionArgsAudio`,
      `handleCommandCaptionArgsAudio`,
      // document
      `handleCaptionArgsDocument`,
      `handleCommandCaptionArgsDocument`,
      // animation
      `handleCaptionArgsAnimation`,
      `handleCommandCaptionArgsAnimation`,
      // voice
      `handleCaptionArgsVoice`,
      `handleCommandCaptionArgsVoice`
    ] as const
    const listRouteStaticSession = [
      ...listRouteStatic.map(toSession),
      ...listRouteStaticIntent.map(toSession),
      // text
      `handleSessionFreeText`,
      // photo
      `handleSessionFreePhoto`,
      // video
      `handleSessionFreeVideo`,
      // audio
      `handleSessionFreeAudio`,
      // document
      `handleSessionFreeDocument`,
      // animation
      `handleSessionFreeAnimation`,
      // voice
      `handleSessionFreeVoice`,
      // videoNote
      `handleSessionFreeVideoNote`,
      // sticker
      `handleSessionFreeSticker`,
      // location
      `handleSessionFreeLocation`,
      // contact
      `handleSessionFreeContact`,
      `handleSessionFreeChannelPost`,
      `handleSessionFreeEditChannelPost`,
      `handleSessionFreeEdit`,
      `handleSessionFreeReaction`,
      `handleSessionFreeInlineQuery`,
      `handleSessionFreeChosenInlineResult`,
      `handleSessionFreePreCheckoutQuery`,
      `handleSessionFreeShippingQuery`,
      `handleSessionFreeChatJoinRequest`,
      `handleSessionFreePoll`,
      `handleSessionFreePollAnswer`,
      `handleSessionFreeNewChatMembers`,
      `handleSessionFreeLeftChatMember`,
      `handleSessionFreeBusinessConnection`,
      `handleSessionFreeBusinessMessage`,
      `handleSessionFreeEditedBusinessMessage`,
      `handleSessionFreeDeletedBusinessMessages`,
      `handleSessionFreeMessageReactionCount`,
      `handleSessionFreeChatBoost`,
      `handleSessionFreeRemovedChatBoost`,
      `handleSessionFreeSuccessfulPayment`,
      `handleSessionFreeRefundedPayment`,
      `handleSessionFreeGroupChatCreated`,
      `handleSessionFreeSupergroupChatCreated`,
      `handleSessionFreeChannelChatCreated`,
      `handleSessionFreeVideoChatStarted`,
      `handleSessionFreeVideoChatScheduled`,
      `handleSessionFreeVideoChatEnded`,
      `handleSessionFreeVideoChatParticipantsInvited`,
      `handleSessionFreeUserShared`,
      `handleSessionFreeChatShared`,
      `handleSessionFreeWebAppData`,
      `handleSessionFreeGiveaway`,
      `handleSessionFreeGiveawayCreated`,
      `handleSessionFreeGiveawayWinners`,
      `handleSessionFreeGiveawayCompleted`,
      `handleSessionFreePinMessage`,
      `handleSessionFreeForumTopicCreated`,
      `handleSessionFreeForumTopicEdited`,
      `handleSessionFreeForumTopicClosed`,
      `handleSessionFreeForumTopicReopened`,
      `handleSessionFreeGeneralForumTopicHidden`,
      `handleSessionFreeGeneralForumTopicUnhidden`,
      `handleSessionFreeProximityAlertTriggered`,
      `handleSessionFreeConnectedWebsite`,
      `handleSessionFreePassportData`,
      `handleSessionFreeMessageAutoDeleteTimerChanged`,
      `handleSessionFreeChatBackgroundSet`,
      `handleSessionFreeNewChatTitle`,
      `handleSessionFreeNewChatPhoto`,
      `handleSessionFreeDeleteChatPhoto`,
      `handleSessionFreeWriteAccessAllowed`,
      `handleSessionFreeCommunityChatJoined`,
      `handleSessionFreeStoppedGeneration`
    ] as const
    const listRouteDynamicSpesific = [
      `handleFreeText`,
      `handleFreePhoto`,
      `handleFreeVideo`,
      `handleFreeAudio`,
      `handleFreeDocument`,
      `handleFreeAnimation`,
      `handleFreeVoice`,
      `handleFreeVideoNote`,
      `handleFreeSticker`,
      `handleFreeLocation`,
      `handleFreeContact`,
      `handleFreeChannelPost`,
      `handleFreeEditChannelPost`,
      `handleFreeEdit`,
      `handleFreeReaction`,
      `handleFreeInlineQuery`,
      `handleFreeChosenInlineResult`,
      `handleFreePreCheckoutQuery`,
      `handleFreeShippingQuery`,
      `handleFreeChatJoinRequest`,
      `handleFreePoll`,
      `handleFreePollAnswer`,
      `handleFreeNewChatMembers`,
      `handleFreeLeftChatMember`,
      `handleFreeBusinessConnection`,
      `handleFreeBusinessMessage`,
      `handleFreeEditedBusinessMessage`,
      `handleFreeDeletedBusinessMessages`,
      `handleFreeMessageReactionCount`,
      `handleFreeChatBoost`,
      `handleFreeRemovedChatBoost`,
      `handleFreeSuccessfulPayment`,
      `handleFreeRefundedPayment`,
      `handleFreeGroupChatCreated`,
      `handleFreeSupergroupChatCreated`,
      `handleFreeChannelChatCreated`,
      `handleFreeVideoChatStarted`,
      `handleFreeVideoChatScheduled`,
      `handleFreeVideoChatEnded`,
      `handleFreeVideoChatParticipantsInvited`,
      `handleFreeUserShared`,
      `handleFreeChatShared`,
      `handleFreeWebAppData`,
      `handleFreeGiveaway`,
      `handleFreeGiveawayCreated`,
      `handleFreeGiveawayWinners`,
      `handleFreeGiveawayCompleted`,
      `handleFreePinMessage`,
      `handleFreeForumTopicCreated`,
      `handleFreeForumTopicEdited`,
      `handleFreeForumTopicClosed`,
      `handleFreeForumTopicReopened`,
      `handleFreeGeneralForumTopicHidden`,
      `handleFreeGeneralForumTopicUnhidden`,
      `handleFreeProximityAlertTriggered`,
      `handleFreeConnectedWebsite`,
      `handleFreePassportData`,
      `handleFreeMessageAutoDeleteTimerChanged`,
      `handleFreeChatBackgroundSet`,
      `handleFreeNewChatTitle`,
      `handleFreeNewChatPhoto`,
      `handleFreeDeleteChatPhoto`,
      `handleFreeWriteAccessAllowed`,
      `handleFreeCommunityChatJoined`,
      `handleFreeStoppedGeneration`
    ] as const

    // Pre-bucket route names by listener suffix for O(1) per-update lookups
    const toListenerKey = (routeName: string) => routeName.replace(`handle`, ``).replace(`Args`, ``).replace(`Command`, ``).replace(`Caption`, ``).replace(`Free`, ``).toLowerCase()
    const listenerCandidates = new Set<string>([`callbackquerydata`, `chatmember`, `mychatmember`])
    for (const routeName of listRouteDynamicSpesific) {
      listenerCandidates.add(toListenerKey(routeName))
    }
    const routesByListener: Record<string, {static: string[]; staticIntent: string[]; staticSession: string[]}> = {}
    const bucketFor = (routeName: string, kind: `static` | `staticIntent` | `staticSession`) => {
      const lc = routeName.toLowerCase()
      for (const listener of listenerCandidates) {
        if (lc.endsWith(listener)) {
          const bucket = (routesByListener[listener] ??= {static: [], staticIntent: [], staticSession: []})
          bucket[kind].push(routeName)
        }
      }
    }
    for (const routeName of listRouteStatic) bucketFor(routeName, `static`)
    for (const routeName of listRouteStaticIntent) bucketFor(routeName, `staticIntent`)
    for (const routeName of listRouteStaticSession) bucketFor(routeName, `staticSession`)

    const makeObject = <const T extends readonly string[], V extends () => unknown>(keys: T, val: V): {[K in T[number]]: ReturnType<V>} => Object.fromEntries(keys.map((k) => [k, val()])) as {[K in T[number]]: ReturnType<V>}
    const initDynamicSpesific = () => [] as {name: string; routeName: string}[] // [0]{name: Page.data.name, routeName: routeFunctionName}
    const customRoutes = [] as ICustomRouteEntry[]

    return {
      all: {} as Record<string, typeof Ctx>, // [page.data.name]: Classes Page
      routeDynamic: [] as string[], // [Page]{ handleFree: (...) => ... }
      // <method>: Array<{name: Page.data.name, routeName:routeFunctionName}>
      // Derived from listRouteDynamicSpesific so every handleFree* listener gets a bucket automatically (single source of truth)
      routeDynamicSpesific: Object.fromEntries(listRouteDynamicSpesific.map((routeName) => [toListenerKey(routeName), initDynamicSpesific()])) as Record<string, {name: string; routeName: string}[]>,
      routeStatic: makeObject(listRouteStatic, () => ({}) as Record<string, {name: string; routeName: string}>), // [page.data.name]: {name: Page.data.name, routeName: routeFunctionName}
      routeStaticIntent: makeObject(listRouteStaticIntent, () => ({}) as Record<string, {name: string; routeName: string}>), // [routeName]: {name: Page.data.name, routeName: routeFunctionName}
      routeStaticSession: makeObject(listRouteStaticSession, () => ({}) as Record<string, {name: string; routeName: string}>), // [session.method]: {name: Page.data.name, routeName: routeFunctionName}
      routeChatMember: [] as Array<{
        name: string
        routeName: string
        type: `chatMember` | `myChatMember`
        oldStatus: string
        newStatus: string
        filter: (ctx: Ctx) => boolean
      }>,
      customRoutes,
      routeCustom: customRoutes,
      listRouteStatic,
      listRouteStaticIntent,
      listRouteStaticSession,
      listRouteDynamicSpesific,
      listRouteStaticLC: listRouteStatic.map((r) => r.toLowerCase()),
      listRouteStaticIntentLC: listRouteStaticIntent.map((r) => r.toLowerCase()),
      listRouteStaticSessionLC: listRouteStaticSession.map((r) => r.toLowerCase()),
      routesByListener,
      lenListRouteStatic: listRouteStatic.length,
      lenListRouteStaticIntent: listRouteStaticIntent.length,
      lenListRouteStaticSession: listRouteStaticSession.length,
      lenListRouteDynamicSpesific: listRouteDynamicSpesific.length,
      // true once at least one staticSession route is registered (id=1 reachable).
      // Gates the auto session-clear on non-session dispatch so apps without
      // sessions never pay an external cache read.
      hasSessionRoutes: false
    }
  }

  /**
   * Loads all page classes and builds routing tables.
   *
   * @remarks
   * Scans the pages directory, processes each page class, and builds
   * optimized routing tables for O(1) lookups.
   *
   * @param pagesPath - Optional path to the pages directory. When omitted,
   * falls back to `PageManager.getFilePath()` which defaults to
   * `process.cwd() + "/src/pages"`. The Gramstax constructor passes
   * `this.templateManager.path[0]` so that custom template paths
   * are respected without requiring `process.chdir()`.
   *
   * @returns The pages routing structure.
   *
   * @internal
   */
  _pageLoads(pagesPath?: string) {
    this.log?.info?.(`Loading pages.`)

    const pages = this._buildEmptyPages()

    const seenNames = new Set<string>()
    const seenIntentText = new Set<string>()
    const seenIntentCommandText = new Set<string>()
    const seenIntentCallbackQueryData = new Set<string>()

    const seen = {names: seenNames, intentText: seenIntentText, intentCommandText: seenIntentCommandText, intentCallbackQueryData: seenIntentCallbackQueryData}
    PageManager.getFileManySync(pagesPath).forEach((entry, index) => {
      this._pageRegisterEntry(entry, pages, index, seen)
    })

    this.log?.info?.(`Loaded ${Object.keys(pages.all).length} pages.`)
    return pages
  }

  /**
   * Best-effort load of frozen `.gramstax/` build output for serverless deploys.
   *
   * @remarks
   * Attempted only when `deploy` is `serverless` and the caller
   * passed no `manifest`. Returns undefined (the caller falls back to the
   * filesystem walk) when the output is absent or unreadable — it never
   * throws, so all other deploys behave exactly as before. Edge runtimes
   * bundle the manifest through the emitted server entry instead; this
   * path only runs where a real filesystem exists.
   *
   * @internal
   */
  _loadBuildManifest(deploy: string): IAppManifest | undefined {
    if ((deploy === `serverless`) === false) return undefined
    try {
      const base = join(process.cwd(), `.gramstax`)
      if (existsSync(join(base, `manifest.js`)) === false || existsSync(join(base, `routes.json`)) === false) return undefined
      const require = createRequire(pathToFileURL(join(process.cwd(), `package.json`)))
      const loaded = require(join(base, `manifest.js`)) as {default?: IAppManifest} & Partial<IAppManifest>
      const manifest = (loaded.default ?? loaded) as IAppManifest
      const routes = require(join(base, `routes.json`)) as IAppManifest[`routes`]
      return {...manifest, routes: routes ?? manifest.routes}
    } catch {
      return undefined
    }
  }

  /**
   * Registers pages from a frozen manifest instead of walking the filesystem.
   *
   * @remarks
   * The fs-less counterpart to the directory walk, used by `serverless` when
   * `.gramstax/` is present. Routing tables come out identical because both
   * paths funnel into the same `_pageRegisterEntry`.
   *
   * Two shapes are accepted:
   *
   * - `manifest.routes` present — routes are the source of truth and are
   *   joined to pages by `routeName`. A route with no page means the build
   *   output is stale, so it throws naming the offending file rather than
   *   silently dropping the route.
   * - `manifest.routes` absent — pages register directly, and an empty
   *   `routeName` throws because directory-index pages take the parent route.
   *
   * Class-inline `page.template` values are compiled under their route name,
   * then every `manifest.templates` entry is compiled under its own key.
   *
   * @param manifest - Frozen manifest produced by `gramstax build`.
   * @returns The populated routing skeleton.
   * @throws Error when a `manifest.routes` entry has no matching page, or a
   * page entry carries an empty `routeName`.
   *
   * @internal
   */
  _pageLoadsFromManifest(manifest: IAppManifest) {
    this.log?.info?.(`Loading pages from manifest.`)

    const pages = this._buildEmptyPages()

    const seen = {
      names: new Set<string>(),
      intentText: new Set<string>(),
      intentCommandText: new Set<string>(),
      intentCallbackQueryData: new Set<string>()
    }

    if (manifest.routes !== undefined) {
      const byRoute = new Map(manifest.pages.map((entry) => [entry.routeName, entry]))
      manifest.routes.forEach((route, index) => {
        const found = byRoute.get(route.routeName)
        if (found === undefined) {
          throw new Error(`Route "${route.routeName}" in manifest.routes has no matching page in manifest.pages (file "${route.file}"). Regenerate the manifest.`)
        }
        const inline = found.page.template
        this._pageRegisterEntry({page: found.page, path: route.file, routeName: route.routeName}, pages, index, seen)
        if (inline !== undefined) {
          this.templateManager.compile(route.routeName, inline)
        }
      })
    } else {
      manifest.pages.forEach((entry, index) => {
        if (entry.routeName.length === 0) {
          throw new Error(`Empty routeName for "${entry.path}" — manifest entries need the walk-derived route (index files use the parent route).`)
        }
        const inline = entry.page.template
        this._pageRegisterEntry(entry, pages, index, seen)
        if (inline !== undefined) {
          this.templateManager.compile(entry.routeName, inline)
        }
      })
    }

    for (const {key, template} of manifest.templates) {
      this.templateManager.compile(key, template)
    }

    this.log?.info?.(`Loaded ${Object.keys(pages.all).length} pages.`)
    return pages
  }

  /**
   * Auto-clears a pending session before a non-session handler runs.
   *
   * @remarks
   * Implements the "interruption cancels the pending flow" rule: when the
   * user interacts with anything other than the awaited session input
   * (callback, command, free text, etc.), the pending session is cleared.
   *
   * Guards:
   * - Skips entirely when the app registers no session routes (`hasSessionRoutes`),
   *   so session-less apps never pay an external cache read.
   * - `getSession()` is memoized per request, so at most one external read
   *   happens per update; `clearSession()` (one external write) only runs
   *   when a session actually exists.
   *
   * @internal
   */
  async _clearSessionOnNonSession(ctx: Ctx) {
    if (!this.pages.hasSessionRoutes) return
    if (await ctx.getSession()) {
      await ctx.clearSession()
    }
  }

  /**
   * Routes an incoming update to the appropriate page handler.
   *
   * @remarks
   * The routing follows a strict **priority hierarchy**. When a match is found
   * at any level, the method executes the handler and returns immediately.
   * If no match is found, it falls through to the next level.
   *
   * **Routing Priority (executed in order):**
   *
   * 1. **staticSession** — Session-aware routes, filtered by input type (O(n) lookup)
   *    - Only runs when the user has an active session (`session.method` is set)
   *    - Iterates `routeStaticSession` and matches by `session.method` value
   *    - **Filtered by input type**: only routes whose name ends with `fromListener`
   *      are checked (e.g., callback queries only match `*CallbackQueryData` session routes,
   *      text only matches `*Text`, photo captions only match `*CaptionPhoto`, etc.)
   *    - This prevents cross-type handler misdispatch (e.g., a callback query
   *      accidentally matching `handleSessionFreeText`)
   *    - Example: session with method "7-mypage" → finds `handleSessionFreeText["7-mypage"]`
   *      when `fromListener = "text"`
   *
   * 2. **static** — Exact intent match routes (O(1) lookup)
   *    - Matches exact text/callback data to page intents
   *    - Example: "start" → `handleText()`, "/help" → `handleCommandText()`
   *
   * 3. **staticIntent** — Intent with args routes (O(1) lookup)
   *    - Matches intent prefix when args are present
   *    - Example: "start:123" → `handleArgsCallbackQueryData()`, "/add item" → `handleCommandArgsText()`
   *
   * 4. **dynamicSpesific** — Non-session free handlers (O(n) iteration)
   *    - Runs all `handleFree*` handlers (defined directly on the page, not inherited)
   *    - `handleSessionFree*` variants are NOT dispatched here — they go through id=1
   *    - Example: `handleFreeText()`, `handleFreePhoto()`
   *    - **All matching handlers are executed** (no early return)
   *
   * 5. **dynamic** — Global fallback handlers (O(n) iteration)
   *    - Runs all `handleFree()` handlers from pages that define them
   *    - Last resort when nothing else matches
   *    - **All matching handlers are executed** (no early return)
   *
   * @param ctx - The context instance.
   * @param fromListener - The listener type that triggered the route.
   * @returns A `PageRouteResult` with `state` indicating what happened
   *
   * @public
   */
  async _pageRoutes(ctx: ICtx, fromListener: string): Promise<{state: `matched` | `no-match` | `no-handler` | `blocked`}> {
    // to be reassigned
    let Page: typeof Ctx | undefined
    let res: {name: string; routeName: string} | undefined
    // true when the matched route is a non-session handler (id=2/3). Session
    // routes (id=1) never auto-clear; free handlers (id=4/5) are handled in-loop.
    let isNonSession = false
    // Session-clear runs at most once per dispatch across every non-session
    // id (0/2/3/4/5/6) instead of once per handler-loop iteration.
    let sessionClearDone = false
    const clearSessionOnce = async (): Promise<void> => {
      if (!sessionClearDone) {
        sessionClearDone = true
        await this._clearSessionOnNonSession(ctx)
      }
    }

    /**
     * id = 0
     * type = chatMember
     * algoritme = O(n) iterasi all routeChatMember, filter pre-computed
     * example = handleChatMemberOutIn, handleMyChatMemberOutRegular
     * description = Chat member status transition routing. Iterates all chat
     *              member routes and dispatches to the first matching filter.
     *              Only runs when `fromListener === "chatmember"`.
     *              Short-circuits via early return on match.
     */
    if ((fromListener === `chatmember` || fromListener === `mychatmember`) && this.pages.routeChatMember.length > 0) {
      for (const route of this.pages.routeChatMember) {
        if (route.filter(ctx)) {
          const ChatPage = this.pages.all[route.name]
          if (ChatPage && typeof ChatPage.prototype[route.routeName as keyof typeof ChatPage.prototype] === `function`) {
            const initPage = new ChatPage(ctx)
            if ((await initPage.hookBeforeRoute?.()) !== false) {
              await clearSessionOnce()
              await (initPage as unknown as Record<string, () => unknown>)[route.routeName]!()
              await initPage.hookAfterRoute?.()
              return {state: ctx.temp.isAnswer ? `matched` : `no-match`}
            }
            return {state: `blocked`}
          }
        }
      }
      return {state: ctx.temp.isAnswer ? `matched` : `no-match`}
    }

    /**
     * id = 1
     * type = staticSession
     * algoritme = x = session method, filtered by input type; O(x)
     * example = all
     * description = Session-aware route dispatch. Only runs when `session.method` is set.
     *              Iterates `routeStaticSession` using `session.method` as the lookup key,
     *              filtered by `fromListener` (`routeName.endsWith(fromListener)`) to prevent
     *              cross-type matching (e.g., callback query hitting `handleSessionFreeText`).
     *              Falls through to id=2 when no session exists or no session route matches.
     */
    if (Page === undefined) {
      const sessionRoutes = (this.pages.routesByListener[fromListener as keyof typeof this.pages.routesByListener] ?? {static: [], staticIntent: [], staticSession: []}).staticSession
      // hasSessionRoutes gate: no session route is registered anywhere, so
      // session.method can never match — skip the external cache read entirely.
      if (sessionRoutes.length > 0 && this.pages.hasSessionRoutes) {
        const session = await ctx.getSession()
        if (session) {
          const mtd = session.method
          const pStaticSession = this.pages.routeStaticSession
          const methods = Array.isArray(mtd) ? mtd : [mtd]

          for (const routeName of sessionRoutes) {
            for (const m of methods) {
              res = pStaticSession[routeName as keyof typeof pStaticSession]?.[m]
              if (res) break
            }
            if (res) break
          }

          if (res !== undefined) {
            Page = this.pages.all[res.name]
          }
        }
      }
    }

    /**
     * id = 2
     * type = static
     * algoritme = O(1)
     * example = handleCaptionAnimation, handleCallbackQueryData, handleCommandText
     * description = route only intent, example "/start", "start", "take-photo-live-in-indonesia"
     */
    if (Page === undefined) {
      const cd = ctx.callbackQuery?.data
      const mt = ctx.msg?.text
      const mc = ctx.msg?.caption
      const rawText = cd || mt || mc || ``
      const pStatic = this.pages.routeStatic
      const staticRoutes = (this.pages.routesByListener[fromListener as keyof typeof this.pages.routesByListener] ?? {static: [], staticIntent: [], staticSession: []}).static

      for (const routeName of staticRoutes) {
        // Try exact match first (for callback data, command names)
        res = pStatic[routeName as keyof typeof pStatic][rawText]

        // For text intents, try language-prefixed lookup
        const rn = routeName as string
        if (!res && (rn === `handleText` || rn === `handleArgsText`)) {
          const lang = ctx.from?.language_code ?? `default`
          res = pStatic[routeName as keyof typeof pStatic][`${lang}:${rawText}`]
          if (!res && lang !== `default`) {
            res = pStatic[routeName as keyof typeof pStatic][`default:${rawText}`]
          }
        }

        if (res) break
      }

      if (res !== undefined) {
        Page = this.pages.all[res.name]
        isNonSession = true
      }
    }

    /**
     * id = 3
     * type = staticIntent
     * algoritme = x = startsWith; O(x)
     * example = handleCommandCaptionArgsAnimation, handleCommandArgsCallbackQueryData, handleCommandArgsText
     * description = route with intent and args, example "/start helloworld", "start helloworld", "/add item1", "/add item1 item2"
     *               "wallet:123", "wallet:123:kkk"
     */
    if (Page === undefined) {
      const pStaticIntent = this.pages.routeStaticIntent
      const isCallback = fromListener === `callbackquerydata`
      const seperatorMethod = isCallback ? `colon` : `space`
      const data = isCallback ? (ctx.callbackQuery?.data ?? ``) : ctx.msg?.text || ctx.msg?.caption || ``
      const haveArgs = ctx.haveArgs(data, seperatorMethod)

      if (data && haveArgs) {
        const tag = ctx.getSeperatorTag(seperatorMethod)
        const parts = data.split(tag)
        const intent1 = parts[0] ?? ``
        const intent2 = !isCallback ? parts.slice(0, 2).join(` `) : ``
        const lang = ctx.from?.language_code ?? `default`
        const intentRoutes = (this.pages.routesByListener[fromListener as keyof typeof this.pages.routesByListener] ?? {static: [], staticIntent: [], staticSession: []}).staticIntent

        for (const routeName of intentRoutes) {
          const bucket = pStaticIntent[routeName as keyof typeof pStaticIntent]
          const rn = routeName as string
          const isTextIntent = rn === `handleArgsText` || rn === `handleCommandArgsText`

          // check intent length 1
          res = bucket[intent1]

          // For text intents, try language-prefixed lookup
          if (!res && isTextIntent && seperatorMethod === `space`) {
            res = bucket[`${lang}:${intent1}`]
            if (!res && lang !== `default`) {
              res = bucket[`default:${intent1}`]
            }
          }

          // check intent length 2 (for space overrides)
          if (!res && !isCallback) {
            res = bucket[intent2]
            // lang-prefixed for length 2
            if (!res && isTextIntent) {
              res = bucket[`${lang}:${intent2}`]
              if (!res && lang !== `default`) {
                res = bucket[`default:${intent2}`]
              }
            }
          }
          if (res) break
        }
      }

      if (res !== undefined) {
        Page = this.pages.all[res.name]
        isNonSession = true
      }
    }

    // run
    if (Page !== undefined && res !== undefined) {
      if (!Page.prototype[res.routeName as keyof typeof Page.prototype]) {
        return {state: `no-handler`}
      }

      const initPage = new Page(ctx)
      if ((await initPage.hookBeforeRoute?.()) !== false) {
        if (isNonSession) {
          await clearSessionOnce()
        }
        await (initPage as unknown as Record<string, () => unknown>)[res.routeName]?.()
        await initPage.hookAfterRoute?.()
        return {state: ctx.temp.isAnswer ? `matched` : `no-match`}
      }
      return {state: `blocked`}
    }

    /**
     * id = 4
     * type = dynamicSpesific (non-session only)
     * algoritme = O(n)
     * example = handleFreeText, handleFreePhoto, handleFreeAnimation
     * description = Non-session free handlers. Only dispatches `handleFree*` methods defined
     *              directly on the page (via `Object.hasOwn`). `handleSessionFree*` variants
     *              are intentionally excluded — they are dispatched exclusively through id=1
     *              (session routing) to prevent calls without a valid session context.
     */
    const arrFree = this.pages.routeDynamicSpesific[fromListener as `animation`] || []
    for (let index = 0; index < arrFree.length; index++) {
      const value = arrFree[index]
      if (value === undefined) {
        continue
      }

      const Page = this.pages.all[value.name]
      if (Page === undefined) {
        continue
      }

      if (typeof Page.prototype[value.routeName as keyof typeof Page.prototype] === `function`) {
        const initPage = new Page(ctx)
        if ((await initPage.hookBeforeRoute?.()) !== false) {
          await clearSessionOnce()
          await (initPage as unknown as Record<string, () => unknown>)[value.routeName]!()
          await initPage.hookAfterRoute?.()
        }
      }
    }

    /**
     * id = 5
     * type = dynamic
     * algoritme = O(n)
     * example = handleFree
     * description = route with name "handleFree", if all case before not match
     */
    for (let index = 0; index < this.pages.routeDynamic.length; index++) {
      const name = this.pages.routeDynamic[index]
      if (name === undefined) {
        continue
      }

      const Page = this.pages.all[name]
      if (Page === undefined) {
        continue
      }

      if (typeof Page.prototype.handleFree === `function`) {
        const initPage = new Page(ctx)
        if ((await initPage.hookBeforeRoute?.()) !== false) {
          await clearSessionOnce()
          await initPage.handleFree!()
          await initPage.hookAfterRoute?.()
        }
      }
    }

    /**
     * id = 6
     * type = custom (filter-based)
     * algoritme = O(n) iterasi this.pages.customRoutes
     * example = inline_query, chosen_inline_result, message_reaction
     * description = User-registered custom filter-based routes.
     *              Fires when listenerName matches AND filter(ctx) returns true.
     *              Same lifecycle pattern as chatMemberRoutes (id=0).
     *              Register entries via Gramstax.registerCustomRoute.
     */
    for (const route of this.pages.customRoutes) {
      if (route.listenerName !== fromListener) {
        continue
      }
      if (!route.filter(ctx)) {
        continue
      }

      const Page = this.pages.all[route.name]
      if (Page === undefined) {
        continue
      }
      if (typeof Page.prototype[route.routeName as keyof typeof Page.prototype] !== `function`) {
        continue
      }

      const initPage = new Page(ctx)
      if ((await initPage.hookBeforeRoute?.()) !== false) {
        await clearSessionOnce()
        await (initPage as unknown as Record<string, () => unknown>)[route.routeName]!()
        await initPage.hookAfterRoute?.()
        return {state: ctx.temp.isAnswer ? `matched` : `no-match`}
      }
      return {state: `blocked`}
    }

    return {state: ctx.temp.isAnswer ? `matched` : `no-match`}
  }

  /**
   * Entry point for every listener: dedupes, validates length, then routes.
   *
   * @remarks
   * Runs before {@link Gramstax._handleCtx}, so everything here is a gate
   * that can only drop the update, never handle it. Two independent gates:
   *
   * 1. Duplicate suppression — when `skipDuplicateUpdate` is on and the
   *    update carries an `update_id`, a `seen` hit returns immediately. The
   *    set is bounded by evicting the oldest insertion once it exceeds
   *    `_seenUpdatesMax`, so it stays a cache and not a leak.
   * 2. Length validation — text or caption over `maxTextLength` (when
   *    non-zero) is rejected as a `validation` error event, distinct from a
   *    routing `error`.
   *
   * `traceId` prefers the update id so metrics and error events correlate
   * across retries; updates without one fall back to an incrementing
   * sequence. Both gate rejections record their own metric counter.
   *
   * @param ct - Raw grammY context for the incoming update.
   * @param listenerName - Routing key forwarded to the route table.
   * @param shouldCheckNotFound - Whether a `no-match` may render the
   * not-found view. Defaults to `true`.
   * @returns Nothing; hands the update to `_handleCtx` when both gates pass.
   *
   * @internal
   */
  async _onHandle(ct: ICt, listenerName: Parameters<Gramstax[`_pageRoutes`]>[1], shouldCheckNotFound: boolean = true): Promise<void> {
    const startedAt = Date.now()
    const updateId = ct.update?.update_id
    const traceId = updateId !== undefined ? `u${updateId}` : `c${++this._traceSeq}`
    const isEdit = listenerName === `callbackquerydata`

    // Idempotency: skip updates already processed (webhook retries).
    if (this._skipDuplicateUpdate && updateId !== undefined) {
      if (this._seenUpdates.has(updateId)) {
        this.metrics.counts.skippedDuplicate += 1
        return
      }
      this._seenUpdates.set(updateId, startedAt)
      if (this._seenUpdates.size > this._seenUpdatesMax) {
        const oldest = this._seenUpdates.keys().next().value
        if (oldest !== undefined) {
          this._seenUpdates.delete(oldest)
        }
      }
    }

    // Allow-list: reject oversized text/caption payloads.
    const rawText = ct.message?.text ?? ct.message?.caption
    if (this._maxTextLength > 0 && rawText !== undefined && rawText !== null && rawText.length > this._maxTextLength) {
      this.metrics.counts.skippedValidation += 1
      this._emitUpdateError({traceId, listenerName, state: `validation`, error: new Error(`Text exceeds maxTextLength (${this._maxTextLength})`), durationMs: Date.now() - startedAt, isEdit})
      return
    }

    const ctx = this.createCtx(ct)
    if (!this._sessionLock) {
      await Ctx._answerScope(ctx, () => this._handleCtx(ctx, listenerName, shouldCheckNotFound, traceId))
      return
    }
    // Updates without a user/chat owner have no session to protect — skip locking.
    if (ctx.from?.id === undefined && ctx.chat?.id === undefined) {
      await Ctx._answerScope(ctx, () => this._handleCtx(ctx, listenerName, shouldCheckNotFound, traceId))
      return
    }
    const lockKey = this._sessionLockKey ? this._sessionLockKey(ctx) : ctx.sessionKey()
    const handled = await this._sessionLock.withLock(lockKey, () => Ctx._answerScope(ctx, () => this._handleCtx(ctx, listenerName, shouldCheckNotFound, traceId)))
    if (handled === null) {
      this.metrics.counts.blocked += 1
    }
  }

  /**
   * Dispatches one update context through route hooks and page routing.
   *
   * @remarks
   * Runs `hookBeforeRoute` first (an explicit `false` aborts with a
   * `blocked` count and no further hooks), then `_pageRoutes`, firing
   * `hookNotFoundPage` for `no-match` when the listener opts into
   * not-found checks. Routing races against `_updateTimeoutMs`
   * (`timeout` state via `UpdateTimeoutError`); any other throw becomes
   * the `error` state via `hookErrorPage`. `hookAfterRoute` always fires,
   * metrics are recorded, `hookTrace` is guarded, and `hookUpdate` is
   * skipped for `error`/`timeout`. `isEdit` is true for
   * `callbackquerydata` listeners.
   *
   * @param ctx - The page context built for this update.
   * @param listenerName - Routing key passed to `_pageRoutes`.
   * @param shouldCheckNotFound - Whether to fire `hookNotFoundPage` on `no-match`.
   * @param traceId - Correlation id for metrics and error events.
   * @internal
   */
  async _handleCtx(ctx: ICtx, listenerName: Parameters<Gramstax[`_pageRoutes`]>[1], shouldCheckNotFound: boolean, traceId: string): Promise<void> {
    const startedAt = Date.now()
    let state: `matched` | `no-match` | `no-handler` | `blocked` | `error` | `timeout` = `no-match`
    const isEdit = listenerName === `callbackquerydata`

    try {
      const before = await this.hookBeforeRoute?.(ctx, {listenerName, isEdit})
      if (before === false) {
        this.metrics.counts.blocked += 1
        return
      }

      const runRoute = async () => {
        const routeResult = await this._pageRoutes(ctx, listenerName)
        state = routeResult.state
        if (routeResult.state === `no-match`) {
          if (shouldCheckNotFound) {
            await this.hookNotFoundPage?.(ctx, {listenerName, isEdit})
          }
        }
      }
      if (this._updateTimeoutMs > 0) {
        let timer: ReturnType<typeof setTimeout> | undefined
        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new UpdateTimeoutError(`Update listener "${listenerName}" exceeded ${this._updateTimeoutMs}ms`)), this._updateTimeoutMs)
        })
        try {
          await Promise.race([runRoute(), timeoutPromise])
        } finally {
          clearTimeout(timer)
        }
      } else {
        await runRoute()
      }
    } catch (error) {
      if (error instanceof UpdateTimeoutError) {
        state = `timeout`
        this.metrics.counts.timeouts += 1
        this._emitUpdateError({traceId, listenerName, state: `timeout`, error, durationMs: Date.now() - startedAt, isEdit})
      } else {
        state = `error`
        this.metrics.counts.updatesFailed += 1
        try {
          await this.hookErrorPage?.(ctx, {listenerName, error, isEdit})
        } catch (hookFailure) {
          // This is the last step that can tell a user their request failed, so
          // it must not escape `_handleCtx` — that would skip hookAfterRoute and
          // the metrics record with nothing sent and nothing logged. A failing
          // hookNotFoundPage also lands here, so this guard terminates the
          // fallback cascade.
          this.log?.error?.(`hookErrorPage hook failed: ${String(hookFailure)}`)
        }
        this._emitUpdateError({traceId, listenerName, state: `error`, error, durationMs: Date.now() - startedAt, isEdit})
      }
    }
    try {
      await this.hookAfterRoute?.(ctx, {listenerName, state, isEdit})
    } catch (hookFailure) {
      // Post-processing, so the update is already handled and the metrics
      // record below still has to run.
      this.log?.error?.(`hookAfterRoute hook failed: ${String(hookFailure)}`)
    }
    const durationMs = Date.now() - startedAt
    this.metrics.recordUpdate(listenerName, durationMs)
    if (this.hookTrace) {
      try {
        this.hookTrace({name: listenerName, durationMs, attributes: {state, isEdit}})
      } catch (error) {
        this.log?.error?.(`hookTrace hook failed: ${String(error)}`)
      }
    }
    if (state !== `error` && state !== `timeout`) {
      try {
        this.hookUpdate?.({traceId, listenerName, state, durationMs, isEdit})
      } catch (error) {
        this.log?.error?.(`hookUpdate hook failed: ${String(error)}`)
      }
    }
  }

  /**
   * Returns middleware to register as low-level plugins on the bot.
   *
   * @remarks
   * Override this method in a subclass to inject custom plugin middleware
   * (sessions, i18n, rate limiting, logging, authentication, etc.) into the
   * underlying bot instance.
   *
   * Each element of the returned array is a {@link ICtMiddleware} value (either a
   * `MiddlewareFn` `(ctx, next) => ...` or a `MiddlewareObj` container) that
   * The array elements are passed to `this.bot.use(...)`. It is meant to be
   * spread into `bot.use`, so the order of elements determines the order in
   * which middleware runs — earlier entries wrap later ones (outermost first).
   *
   * Difference vs. the other lifecycle hooks:
   *
   * - `hookBeforeStart` — for one-off side effects before the bot starts.
   *   Anything you want to happen exactly once at boot goes there.
   * - `registerLowPlugin` — for middleware that must run on **every update**.
   *   Use this when you need middleware semantics (filter queries,
   *   `next()` chaining, scope-aware registration).
   * - `hookBeforeRoute` / `hookAfterRoute` — for per-update hooks that run
   *   inside the router, after gramstax has already routed to a page.
   *
   * The base implementation is not provided — subclasses override this to
   * contribute their own plugins. Returning an empty array (or not
   * overriding) installs no plugins, which is the default behavior.
   *
   * @returns Array of {@link ICtMiddleware}
   * values, ready to be spread into `this.bot.use(...result)`.
   *
   * @example
   * ```typescript
   * class MyBot extends Gramstax {
   *   registerLowPlugin() {
   *     return [
   *       // 1. Logging middleware (outermost — runs first, exits last)
   *       async (ctx, next) => {
   *         this.log?.info?.(`update ${ctx.update.update_id} from ${ctx.from?.id}`)
   *         await next()
   *       },
   *       // 2. Per-chat rate limit (inner)
   *       async (ctx, next) => {
   *         // ... check + throttle ...
   *         await next()
   *       }
   *     ]
   *   }
   * }
   * ```
   *
   * @virtual
   * @public
   */
  registerLowPlugin?(): Array<ICtMiddleware<ICt>>

  /**
   * Registers a custom filter-based route entry with automatic listener subscription.
   *
   * @remarks
   * Adds a route entry to `this.pages.routeCustom` for dispatch at stage id=6
   * in _pageRoutes. The route fires when:
   * 1. listenerName matches entry.listenerName, AND
   * 2. entry.filter(ctx) returns true
   *
   * For events with a built-in listener, the route is dispatched by the existing
   * built-in subscription (the listenerName must match the built-in one). For any
   * other event, a grammY listener is subscribed automatically via
   * this.bot.on(entry.event, ...).
   *
   * @param entry - The custom route entry. See ICustomRouteEntry.
   *
   * @virtual
   * @public
   */
  registerCustomRoute(entry: ICustomRouteEntry): void {
    if (!entry.routeName || entry.routeName.startsWith(`handle`) === false) {
      throw new Error(`routeName must be a non-empty string starting with 'handle'`)
    }

    if (this.pages.all[entry.name] === undefined) {
      throw new Error(`registerCustomRoute: unknown page "${entry.name}". Register the page first so custom routes dispatch to a known handler.`)
    }

    if (this.pages.routeCustom.some((r) => r.routeName === entry.routeName)) {
      this.log?.warn?.(`registerCustomRoute: duplicate routeName "${entry.routeName}" is already registered — skipping`)
      return
    }

    this.pages.routeCustom.push(entry)

    // Events with a built-in listener must NOT get a second subscription here:
    // built-in listeners do not call grammY `next()`, so a second `bot.on` on the
    // same event would never run. The built-in subscription's `_onHandle` already
    // reaches routing id=6 (custom routes), so only the listenerName needs to match.
    const builtInListenerName = _BUILT_IN_ON.get(entry.event as string) ?? _BUILT_IN_FILTER.get(entry.event as string)
    if (builtInListenerName !== undefined) {
      if (entry.listenerName !== builtInListenerName) {
        throw new Error(`registerCustomRoute: listenerName "${entry.listenerName}" does not match the built-in listener "${builtInListenerName}" for event "${entry.event}". Use "${builtInListenerName}" so the built-in subscription dispatches this route.`)
      }
      return
    }

    this.bot.on(entry.event, (ctx) => this._onHandle(ctx, entry.listenerName, entry.shouldCheckNotFound ?? true))
  }
}
