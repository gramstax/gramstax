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

import {Ctx} from "./ctx"
import {log, type LoggingHelper} from "~/helpers/log"
import {PageManager} from "~/page/manager"
import {readFileSync} from "node:fs"
import {fileURLToPath} from "node:url"
import {dirname, join, parse} from "node:path"
import {TemplateManager} from "~/template/manager"
import {CacheExternal, ITCacheRpc} from "~/cache/external"
import {Bot, webhookCallback, type BotConfig, type BotError, API_CONSTANTS} from "grammy"
import type {UserFromGetMe} from "grammy/types"
import type {ITGramstaxParams, ITWebhookQueueConfig} from "~/types/t.bot"
import {WebhookQueue} from "~/webhook/queue"
import {ITCt, ITCtMiddleware} from "~/types/t.ctx"
import {E2eHelper} from "../e2e/helper"
import {autoRetry} from "@grammyjs/auto-retry"
import {stream} from "@grammyjs/stream"
import {chatMemberFilter, myChatMemberFilter} from "@grammyjs/chat-members"

const __dirname = dirname(
  (() => {
    try {
      return __filename
    } catch {
      return fileURLToPath(import.meta.url)
    }
  })()
)
const __PKG_VERSION__ = JSON.parse(readFileSync(join(__dirname, `../../package.json`), `utf-8`)).version as string

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
   * Cached values are built from {@link BlockKeyboard} and reused per language.
   */
  cacheKeyboard: Map<any, any>

  /**
   * External cache for user session data.
   *
   * @remarks
   * Uses {@link CacheExternal} with {@link ITCacheRpc} transport for persistence.
   */
  cacheSession: CacheExternal<ITCacheRpc>

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
   * The underlying Bot instance.
   *
   * @remarks
   * Instance of the `Bot`.
   */
   bot: Bot<ITCt>

  /**
   * Optional bot configuration.
   *
   * @remarks
   * Configuration object for `BotConfig` and `Context`.
   */
  botConfig?: BotConfig<ITCt>

  /**
   * Webhook queue configuration.
   *
   * @remarks
   * See {@link ITWebhookQueueConfig} for queue settings.
   */
  webhookQueue?: ITWebhookQueueConfig

  /**
   * Active webhook queue instance.
   * @internal
   */
  protected webhookQueueInstance?: WebhookQueue<any>

  /**
   * Active webhook server instance.
   * @internal
   */
  protected webhookServer?: {stop: () => void}

  /**
   * Handler function for processing bot updates.
   * @remarks
   * Can be customized for serverless or webhook deployments.
   */
  handlerBotUpdate: any

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
   * @param params - Configuration options. See {@link ITGramstaxParams} for all available options.
   *
   * @example
   * ```typescript
   * // Polling mode (development, local testing)
   * new Gramstax({token: "BOT_TOKEN", deploy: "polling"})
   *
   * // Webhook mode with Bun's HTTP server
   * new Gramstax({token: "BOT_TOKEN", deploy: "webhook:https://example.com/bot"})
   * ```
   *
   * @example
   * ```typescript
   * // Serverless mode — Bun std/http adapter
   * //
   * // The bot does NOT self-host; instead it sets up handlerBotUpdate
   * // for your serverless runtime. Export the handler and let your
   * // platform invoke it per HTTP request.
   *
   * // bot.ts — instantiation
   * const bot = new Gramstax({
   *   token: process.env.BOT_TOKEN!,
   *   deploy: "serverless:std/http"
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
   *   deploy: "serverless:aws-lambda"
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
   * const bot = new Gramstax({token: env.BOT_TOKEN, deploy: "serverless:cloudflare-workers-mod"})
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
  constructor(params: ITGramstaxParams) {
    if (!params?.token || params?.token?.length == 0) {
      throw new Error(`Token is not valid or empty`)
    }

    if (typeof params.optionsPage?.shortCallbackQueryData == `boolean`) {
      this.optionsPage.shortCallbackQueryData = params.optionsPage.shortCallbackQueryData
    }

    this.log = params.log === true ? log : !params.log ? undefined : params.log
    this.log?.info?.(`Gramstax v${__PKG_VERSION__}`)

    this.cacheSession = params.cacheSession || new CacheExternal(`memory`)
    this.cacheKeyboard = params.cacheKeyboard || new Map()
    this.botConfig = params.botConfig
    this.webhookQueue = params.webhookQueue

    this.bot = this.createBot(params.token)
    if (params.autoRetry !== false) {
      this.bot.api.config.use(autoRetry())
    }
    if (params.stream !== false) {
      this.bot.use(stream() as any)
    }
    this.bot.catch(this._onCatch)
    this.registerLowPlugin?.()?.forEach((func) => this.bot.use(func)) // Handle middleware ct

    // Default for customize (very rarely used)
    this.handlerBotUpdate = this.bot.handleUpdate

    // Graceful shutdown (all modes)
    process.once(`SIGINT`, () => this.stop())
    process.once(`SIGTERM`, () => this.stop())

    // ── RAW MODE ──────────────────────────────────────────────────────────
    // Bare bot: no TemplateManager, no page loading, no Gramstax
    // routing listeners, no command sync, and NO auto-start. The caller owns
    // the lifecycle and writes raw handlers on `this.bot`.
    if (params.deploy === `raw`) {
      this.deployType = `raw`
      this.pages = this._buildEmptyPages()
      this.hookBeforeStart?.()
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
        path: [join(process.cwd(), `src`, `pages`)]
      })

    this.registerLowOnCallbackQueryData() // Handle callback queries from inline keyboards
    this.registerLowOnMessageText() // Handle global text messages
    this.registerLowOnMessagePhoto() // Handle global photo messages
    this.registerLowOnMessageVideo() // Handle global video messages
    this.registerLowOnMessageAudio() // Handle global audio messages
    this.registerLowOnMessageDocument() // Handle global document messages
    this.registerLowOnMessageAnimation() // Handle global animation messages
    this.registerLowOnMessageVoice() // Handle global voice messages
    this.registerLowOnMessageVideoNote() // Handle global video note messages
    this.registerLowOnMessageSticker() // Handle global sticker messages
    this.registerLowOnMessageLocation() // Handle global location messages
    this.registerLowOnMessageContact() // Handle global contact messages
    this.registerLowOnChatMember() // Handle chat member updates

    // Load pages AFTER templateManager is initialized
    this.pages = this._pageLoads(this.templateManager._path?.[0])

    // Pre-compute chat member filter functions
    if ((this.pages as any)?.chatMemberRoutes?.length > 0) {
      for (const route of this.pages.chatMemberRoutes!) {
        const factory = route.type === `chatMember` ? chatMemberFilter : myChatMemberFilter
        route.filter = factory(route.oldStatus as any, route.newStatus as any) as (ctx: any) => boolean
      }
    }

    if (params.deploy.startsWith(`polling`)) {
      this.deployType = `polling`
      this.hookBeforeStart?.()
      this._runPolling()
    } else if (params.deploy.startsWith(`webhook:`)) {
      this.deployType = `webhook`
      this.hookBeforeStart?.()
      this._runWebhook(params.deploy.split(`webhook:`)[1] as string)
    } else if (params.deploy.startsWith(`serverless:`)) {
      this.deployType = `serverless`
      this.hookBeforeStart?.()
      this._runServerless(params.deploy.split(`serverless:`)[1] as string)
    } else if (params.deploy.startsWith(`test`)) {
      this.deployType = `test`
      this.hookBeforeStart?.()
      this.e2e = new E2eHelper(this)
      this.hookAfterStart?.()
      // nothing, for test unit internal area
    } else {
      throw new Error(`Params deploy is not valid, expected: polling, webhook:<public-url>, serverless:<your-adapter>, raw`)
    }
  }

  /**
   * Stop bot
   *
   * @public
   */
  async stop() {
    await this.bot.stop()
    if (this.deployType === `webhook`) {
      await this.webhookServer?.stop()
      this.webhookServer = undefined
    }
  }

  /**
   * Global error handler for bot errors.
   *
   * @param error - The bot error object.
   *
   * @public
   */
  _onCatch(error: BotError<ITCt>) {
    if ((this.log as any)?.errorMake) {
      ;(this.log as any)?.errorMake(error, `Bot`, `catch`)
    } else {
      const err = JSON.stringify(error, null, 2)
      this.log?.error?.(`[Bot.catch]: ${err}`)
    }
  }

  /**
   * Called when the bot successfully starts.
   *
   * @param botInfo - Information about the bot from Telegram.
   * @param method - The deployment method used.
   * @param data - Additional data (URL for webhook/serverless).
   *
   * @public
   */
  async _onStart(botInfo: UserFromGetMe, method: `polling` | `webhook` | `serverless`, data: string | null) {
    await this.executeSyncBlocksDescription(this.pages)

    const {username} = botInfo
    this.log?.success?.(`Telegram bot deploy ${method} started: ${username} ${method == `webhook` || method == `serverless` ? `(${data})` : ``}`)
    this.hookAfterStart?.()
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
  async hookBeforeStart?(): Promise<any>

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
  async hookAfterStart?(): Promise<any>

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
   * `no-match` (nothing handled the input — triggers `hookErrorInputNotFoundPage`),
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
  async hookAfterRoute?(ctx: ICtx, data?: {listenerName: string; state: `matched` | `no-match` | `no-handler` | `blocked` | `error` | `notfound`; isEdit: boolean}): Promise<void>

  /**
   * Hook called when a page handler throws an error.
   *
   * @remarks
   * Override this method to handle errors gracefully, e.g., sending
   * an error message to the user or logging to an external service.
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
   *   await new GeneralStatusPage(ctx).showError(`${data.listenerName}:hookErrorPage`, data.error, data.isEdit)
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookErrorPage?(ctx: ICtx, data?: {listenerName: string; error: any; isEdit: boolean}): Promise<void>

  /**
   * Hook called when no page handler matches the input.
   *
   * @remarks
   * Override this method to send a "command not found" message or
   * redirect to a help page.
   *
   * @param ctx - The context instance.
   *
   * @example Simple
   * ```typescript
   * async hookErrorInputNotFoundPage(ctx: Ctx) {
   *   await new GeneralStatusPage(ctx).showErrorInputNotFound()
   * }
   * ```
   *
   * @example Advanced
   * ```typescript
   * async hookErrorInputNotFoundPage(ctx: Ctx, data: NonNullable<Parameters<NonNullable<Gramstax[`hookErrorInputNotFoundPage`]>>[1]>) {
   *   await new GeneralStatusPage(ctx).showErrorInputNotFound()
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookErrorInputNotFoundPage?(ctx: ICtx, data?: {listenerName: string; isEdit: boolean}): Promise<void>

  /**
   * Creates the Bot instance.
   *
   * @param token - The Telegram Bot API token.
   * @returns The Bot instance.
   *
   * @public
   */
  createBot(token: string): Bot<ITCt> {
    return new Bot<ITCt>(token, this.botConfig)
  }

  /**
   * Creates a context instance for handling an update.
   *
   * @param ct - The context object.
   * @returns A new Ctx instance.
   *
   * @public
   */
  createCtx(ct: ITCt): ICtx {
    return new Ctx({
      ct,
      cacheSession: this.cacheSession,
      cacheKeyboard: this.cacheKeyboard,
      templateManager: this.templateManager,
      temp: {
        isAnswer: false,
        session: {},
        data: {}
      }
    }) as any
  }

  /**
   * Starts the bot in long polling mode.
   *
   * @public
   */
  _runPolling(): void {
    const opts: Record<string, any> = {
      drop_pending_updates: true,
      onStart: (botInfo: UserFromGetMe) => {
        this._onStart(botInfo, `polling`, null)
      }
    }
    if ((this.pages as any)?.chatMemberRoutes?.length > 0) {
      opts.allowed_updates = API_CONSTANTS.ALL_UPDATE_TYPES
    }
    this.bot.start(opts)
  }

  /**
   * Starts the bot in webhook mode.
   *
   * @remarks
   * Uses Bun's built-in HTTP server. Automatically sets the webhook URL if needed.
   *
   * @param fullUrl - The full public URL for the webhook.
   *
   * @public
   */
  async _runWebhook(fullUrl: string): Promise<void> {
    const {serve} = await import(`bun`) // <==== import in this because this package support node/bun (default use bun)
    const handleUpdate = webhookCallback(this.bot, `bun`)
    const queueConfig = this.webhookQueue
    const queueEnabled = queueConfig?.enabled === true
    this.handlerBotUpdate = queueEnabled ? this.bot.handleUpdate.bind(this.bot) : handleUpdate

    const queue = queueEnabled ? new WebhookQueue<any>(queueConfig?.maxQueueSize ?? 5000) : undefined
    const workerCount = queueConfig?.workerCount ?? 8
    const perChatConcurrency = queueConfig?.perChatConcurrency ?? 1
    const blockWhenFull = queueConfig?.blockWhenFull !== false
    const activeChats = new Map<string, number>()
    const waitChats = new Map<string, Array<() => void>>()

    this.webhookQueueInstance = queue

    const getChatId = (update: any) => {
      return (
        update?.message?.chat?.id ??
        update?.edited_message?.chat?.id ??
        update?.channel_post?.chat?.id ??
        update?.edited_channel_post?.chat?.id ??
        update?.callback_query?.message?.chat?.id ??
        update?.callback_query?.from?.id ??
        update?.inline_query?.from?.id ??
        update?.chosen_inline_result?.from?.id
      )
    }

    const acquireChat = async (chatId: any) => {
      if (!queueEnabled || perChatConcurrency <= 0 || chatId === undefined || chatId === null) {
        return () => {}
      }

      const key = String(chatId)
      const current = activeChats.get(key) || 0
      if (current < perChatConcurrency) {
        activeChats.set(key, current + 1)
        return () => this._releaseWebhookChat(key, activeChats, waitChats)
      }

      await new Promise<void>((resolve) => {
        const waiters = waitChats.get(key) || []
        waiters.push(resolve)
        waitChats.set(key, waiters)
      })

      const next = (activeChats.get(key) || 0) + 1
      activeChats.set(key, next)
      return () => this._releaseWebhookChat(key, activeChats, waitChats)
    }

    if (queueEnabled && queue) {
      await this.bot.init()
      for (let index = 0; index < workerCount; index++) {
        this._startWebhookWorker(queue, acquireChat, getChatId)
      }
    }

    const url = new URL(fullUrl)
    const pathUrl = url.pathname
    const port = parseInt(url.port) || 3000
    const logger = this.log
    const statsPath = `/stats_queue`
    this.webhookServer?.stop()
    const server = serve({
      port,
      async fetch(req) {
        const {pathname} = new URL(req.url)
        if (req.method == `POST` && pathname == pathUrl) {
          if (!queueEnabled || !queue) {
            return handleUpdate(req)
          }

          if (!blockWhenFull && queue.length >= (queueConfig?.maxQueueSize ?? 5000)) {
            return new Response(`Queue full`, {status: 429})
          }

          try {
            const update = await req.json()
            await queue.enqueue(update)
            return new Response(`OK`, {status: 200})
          } catch (error) {
            logger?.error?.(`Webhook queue error: ${String(error)}`)
            return new Response(`Bad Request`, {status: 400})
          }
        }

        if (req.method == `GET` && pathname == statsPath) {
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
              activeChats: activeChats.size
            }),
            {status: 200, headers: {"Content-Type": `application/json`}}
          )
        }
        if (req.method == `GET` && pathname == `/`) {
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
    if (data.url != fullUrl) {
      await this.bot.api.setWebhook(fullUrl)
    }

    const botInfo = await this.bot.api.getMe()
    await this._onStart(botInfo, `webhook`, fullUrl)
  }

  /**
   * Start a webhook worker loop for processing updates.
   *
   * @param queue - Webhook queue instance.
   * @param acquireChat - Chat concurrency gate.
   * @param getChatId - Extracts chat ID from update.
   * @internal
   */
  _startWebhookWorker(queue: WebhookQueue<any>, acquireChat: (chatId: any) => Promise<() => void>, getChatId: (update: any) => any) {
    const run = async () => {
      while (true) {
        const update = await queue.dequeue()
        const release = await acquireChat(getChatId(update))
        try {
          await this.bot.handleUpdate(update)
        } catch (error) {
          this.log?.error?.(`Webhook worker error: ${String(error)}`)
        } finally {
          release()
        }
      }
    }

    run()
  }

  /**
   * Release a chat slot and wake the next waiter if needed.
   *
   * @param key - Chat identifier.
   * @param activeChats - Active chat counter map.
   * @param waitChats - Waiting callbacks by chat ID.
   * @internal
   */
  _releaseWebhookChat(key: string, activeChats: Map<string, number>, waitChats: Map<string, Array<() => void>>) {
    const current = activeChats.get(key) || 0
    const next = Math.max(0, current - 1)
    if (next === 0) {
      activeChats.delete(key)
    } else {
      activeChats.set(key, next)
    }

    const waiters = waitChats.get(key)
    if (waiters && waiters.length > 0) {
      const resolve = waiters.shift()!
      resolve()
      if (waiters.length === 0) {
        waitChats.delete(key)
      }
    }
  }

  /**
   * Get current webhook queue statistics.
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
      ...queueStats
    }
  }

  /**
   * Starts the bot in serverless mode.
   *
   * @remarks
   * Configures the handler for serverless adapters (e.g., AWS Lambda, Cloudflare Workers).
   *
   * @param adapter - The adapter name (e.g., "std/http", "aws-lambda").
   *
   * @public
   */
  async _runServerless(adapter: string): Promise<void> {
    this.handlerBotUpdate = webhookCallback(this.bot, adapter as any)
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
   * @public
   */
  _pageBuildData(Page: typeof Ctx, filePath: string): void {
    if (Page?.data === undefined) {
      Page.data = Page.buildData() as any
    }
    const {name} = parse(filePath)
    if (!Page.data.name) Page.data.name = name
    if (!Page.data.intentText) Page.data.intentText = Page.data.name
    if (!Page.data.intentCommandText) Page.data.intentCommandText = Page.data.name
    if (!Page.data.intentCallbackQueryData) Page.data.intentCallbackQueryData = Page.data.name
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
   * @public
   */
  _pageSorts(Page: typeof Ctx, pages: typeof Gramstax.prototype.pages, indexPage: number): void {
    const name = Page.data.name
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
        if (typeof (proto as any)[routeName] !== `function`) {
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

          let key: string | undefined
          if (_isCommand) {
            const _key = Page.data.intentCommandText
            key = _key ? `/${_key}` : undefined
          } else if (_isCallbackQueryData) {
            let _key = Page.data.intentCallbackQueryData
            if (this.optionsPage.shortCallbackQueryData === true) {
              _key = String(indexPage)
              Page.data.intentCallbackQueryData = _key
            }
            key = _key
          } else if (_isText) {
            key = Page.data.intentText
          } else {
            key = Page.data.name
          }

          if (key) {
            p[key] = value
          }
        }
      }
    }

    // Session routes (listRouteStaticSession)
    for (let index = 0; index < pages.lenListRouteStaticSession; index++) {
      const routeName = pages.listRouteStaticSession[index] as string

      // Check if the method exists on the page
      if (typeof (proto as any)[routeName] !== `function`) {
        continue
      }

      const pss = pages.routeStaticSession[routeName as keyof typeof pages.routeStaticSession]

      const value = {name, routeName}

      // staticSession: compute session key via methodSession{Base}(name)
      if (pss !== undefined) {
        const hidePartReplace = routeName.replace(`handle`, ``)
        const normalized = hidePartReplace.startsWith(`Session`) ? hidePartReplace.slice(7) : hidePartReplace
        const methodName = `methodSession${normalized}`
        const methodKey = (proto as any as Record<any, (...args: any) => string>)[methodName]?.(name)
        pss[methodKey!] = value
      }
    }

    // dynamicSpesific — handleFree* (non-session) defined directly on this page
    // (handleSessionFree* variants are dispatched exclusively via session routing id=1,
    //  NOT via dynamicSpesific — dynamic dispatch doesn't check for sessions)
    for (const routeName of pages.listRouteDynamicSpesific) {
      if (Object.hasOwn(proto, routeName) && typeof (proto as any)[routeName] === `function`) {
        const pureName = routeName.replace(partHandle, ``).replace(partArgs, ``).replace(partCommand, ``).replace(partCaption, ``).replace(partFree, ``).toLowerCase()
        const alreadyExists = pds[pureName as keyof typeof pds]?.some((item) => item.name === name)
        if (!alreadyExists) {
          pds[pureName as keyof typeof pds].push({name, routeName})
        }
      }
    }

    // chatMember — scan handleChatMember* / handleMyChatMember* methods
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key.startsWith(`handleChatMember`) && key !== `handleChatMember`) {
        const rest = key.slice(`handleChatMember`.length) // e.g., "OutIn"
        const parts = rest.split(/(?=[A-Z])/).filter(Boolean)
        if (parts.length === 2) {
          pages.chatMemberRoutes.push({
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
          pages.chatMemberRoutes.push({
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
        const scopeObj = {type: scope} as any
        const langCode = lang === `default` ? undefined : lang
        try {
          const current = await this.bot.api.getMyCommands({scope: scopeObj, language_code: langCode as any})
          const currentJSON = JSON.stringify(current.map((c) => ({command: c.command, description: c.description})).sort((a, b) => a.command.localeCompare(b.command)))
          const desiredJSON = JSON.stringify(commands.sort((a, b) => a.command.localeCompare(b.command)))

          if (currentJSON !== desiredJSON) {
            await this.bot.api.setMyCommands(commands, {scope: scopeObj, language_code: langCode as any})
            this.log?.info?.(`Synced descriptions for scope: ${scope},${langCode ? ` lang: ${langCode},` : ``} total (${commands.length})`)
          }
        } catch (error) {
          this.log?.error?.(`Failed to sync descriptions for scope: ${scope},${langCode ? ` lang: ${langCode},` : ``} error: ${String(error)}`)
        }
      }
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
  protected _buildEmptyPages() {
    // Helper to keep map result as literal types (prevents widening to string[])
    const toSession = <T extends string>(route: T): `handleSession${T extends `handle${infer R}` ? R : T}` => {
      return `handleSession${route.startsWith(`handle`) ? route.slice(6) : route}` as any
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
      `handleSessionFreeContact`
    ] as const
    const listRouteDynamicSpesific = [`handleFreeText`, `handleFreePhoto`, `handleFreeVideo`, `handleFreeAudio`, `handleFreeDocument`, `handleFreeAnimation`, `handleFreeVoice`, `handleFreeVideoNote`, `handleFreeSticker`, `handleFreeLocation`, `handleFreeContact`] as const

    const makeObject = <const T extends readonly string[], V extends () => any>(keys: T, val: V): {[K in T[number]]: ReturnType<V>} => Object.fromEntries(keys.map((k) => [k, val()])) as {[K in T[number]]: ReturnType<V>}
    const initDynamicSpesific = () => [] as {name: string; routeName: string}[] // [0]{name: Page.data.name, routeName: routeFunctionName}

    return {
      all: {} as Record<string, typeof Ctx>, // [page.data.name]: Classes Page
      routeDynamic: [] as string[], // [Page]{ handleFree: (...) => ... }
      // <method>: Array<{name: Page.data.name, routeName:routeFunctionName}>
      routeDynamicSpesific: {
        text: initDynamicSpesific(),
        photo: initDynamicSpesific(),
        video: initDynamicSpesific(),
        audio: initDynamicSpesific(),
        document: initDynamicSpesific(),
        animation: initDynamicSpesific(),
        voice: initDynamicSpesific(),
        videonote: initDynamicSpesific(),
        sticker: initDynamicSpesific(),
        location: initDynamicSpesific(),
        contact: initDynamicSpesific()
      },
      routeStatic: makeObject(listRouteStatic, () => ({}) as Record<string, {name: string; routeName: string}>), // [page.data.name]: {name: Page.data.name, routeName: routeFunctionName}
      routeStaticIntent: makeObject(listRouteStaticIntent, () => ({}) as Record<string, {name: string; routeName: string}>), // [routeName]: {name: Page.data.name, routeName: routeFunctionName}
      routeStaticSession: makeObject(listRouteStaticSession, () => ({}) as Record<string, {name: string; routeName: string}>), // [session.method]: {name: Page.data.name, routeName: routeFunctionName}
      chatMemberRoutes: [] as Array<{
        name: string
        routeName: string
        type: `chatMember` | `myChatMember`
        oldStatus: string
        newStatus: string
        filter: (ctx: any) => boolean
      }>,
      listRouteStatic,
      listRouteStaticIntent,
      listRouteStaticSession,
      listRouteDynamicSpesific,
      lenListRouteStatic: listRouteStatic.length,
      lenListRouteStaticIntent: listRouteStaticIntent.length,
      lenListRouteStaticSession: listRouteStaticSession.length,
      lenListRouteDynamicSpesific: listRouteDynamicSpesific.length
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
   * `this.templateManager._path[0]` so that custom template paths
   * are respected without requiring `process.chdir()`.
   *
   * @returns The pages routing structure.
   *
   * @public
   */
  _pageLoads(pagesPath?: string) {
    this.log?.info?.(`Load pages..`)

    const pages = this._buildEmptyPages()

    PageManager.getFileManySync(pagesPath).forEach(({path, page}, index) => {
      this._pageBuildData(page, path) // create if not exist and set name (without ext) according filePath
      this._pageSorts(page, pages, index) // sort route method
      page.template = undefined // delete template for efficient memory
    })

    this.log?.info?.(`Finish load pages with total (${Object.keys(pages.all).length})`)
    return pages
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
  async _pageRoutes(ctx: ICtx, fromListener: `callbackquerydata` | `chatmember` | `mychatmember` | keyof typeof Gramstax.prototype.pages.routeDynamicSpesific): Promise<{state: `matched` | `no-match` | `no-handler` | `blocked`}> {
    // to be reassigned
    let Page: typeof Ctx | undefined
    let res: {name: string; routeName: string} | undefined

    /**
     * id = 0
     * type = chatMember
     * algoritme = O(n) iterasi all chatMemberRoutes, filter pre-computed
     * example = handleChatMemberOutIn, handleMyChatMemberOutRegular
     * description = Chat member status transition routing. Iterates all chat
     *              member routes and dispatches to the first matching filter.
     *              Only runs when `fromListener === "chatmember"`.
     *              Short-circuits via early return on match.
     */
    if ((fromListener === `chatmember` || fromListener === `mychatmember`) && this.pages.chatMemberRoutes.length > 0) {
      for (const route of this.pages.chatMemberRoutes) {
        if (route.filter(ctx)) {
          const ChatPage = this.pages.all[route.name]
          if (ChatPage && typeof ChatPage.prototype[route.routeName as keyof typeof ChatPage.prototype] === `function`) {
            const initPage = new (ChatPage as any)({
              ct: ctx,
              cacheSession: ctx.cacheSession,
              cacheKeyboard: ctx.cacheKeyboard,
              templateManager: this.templateManager,
              temp: ctx.temp
            })
            if ((await initPage.hookBeforeRoute?.()) !== false) {
              await initPage[route.routeName]()
              await initPage.hookAfterRoute?.()
              return {state: `matched`}
            }
            return {state: `blocked`}
          }
        }
      }
      return {state: `no-match`}
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
      const session = await ctx.getSession()
      if (session) {
        const mtd = session.method
        const pStaticSession = this.pages.routeStaticSession
        const methods = Array.isArray(mtd) ? mtd : [mtd]

        for (let index = 0; index < this.pages.lenListRouteStaticSession; index++) {
          const routeName = this.pages.listRouteStaticSession[index] as `handleSessionCaptionAnimation`
          if (routeName.toLowerCase().endsWith(fromListener)) {
            for (const m of methods) {
              res = pStaticSession[routeName][m]
              if (res) break
            }
          }
          if (res) break
        }

        if (res !== undefined) {
          Page = this.pages.all[res.name]
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
      const pStatic = this.pages.routeStatic

      for (let index = 0; index < this.pages.lenListRouteStatic; index++) {
        const routeName = this.pages.listRouteStatic[index] as `handleCaptionAnimation`
        if (routeName.toLowerCase().endsWith(fromListener)) {
          res = pStatic[routeName][cd || mt || mc || ``]
        }

        if (res) break
      }

      if (res !== undefined) {
        Page = this.pages.all[res.name]
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
      const data = isCallback ? ctx.callbackQuery!.data! : ctx.msg!.text! || ctx.msg!.caption!
      const haveArgs = ctx.haveArgs(data, seperatorMethod)

      if (data && haveArgs) {
        for (let index = 0; index < this.pages.lenListRouteStaticIntent; index++) {
          const routeName = this.pages.listRouteStaticIntent[index] as `handleArgsText`
          if (!routeName.toLowerCase().endsWith(fromListener)) {
            continue
          }

          const bucket = pStaticIntent[routeName]
          // check intent length 1
          res = bucket[ctx.getIntent(data, seperatorMethod, 1)]

          // check intent length 2 (for space overrides)
          if (!res && !isCallback) {
            res = bucket[ctx.getIntent(data, `space`, 2)]
          }
          if (res) break
        }
      }

      if (res !== undefined) {
        Page = this.pages.all[res.name]
      }
    }

    // run
    if (Page !== undefined && res !== undefined) {
      if (!Page.prototype[res.routeName as keyof typeof Page.prototype]) {
        return {state: `no-handler`}
      }

      const initPage = new Page({
        ct: ctx,
        cacheSession: ctx.cacheSession,
        cacheKeyboard: ctx.cacheKeyboard,
        templateManager: this.templateManager,
        temp: ctx.temp
      }) as any
      if ((await initPage.hookBeforeRoute?.()) !== false) {
        await initPage[res.routeName]?.()
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

      if (typeof Page.prototype[value.routeName as keyof typeof Page.prototype] == `function`) {
        const initPage = new Page({
          ct: ctx,
          cacheSession: ctx.cacheSession,
          cacheKeyboard: ctx.cacheKeyboard,
          templateManager: this.templateManager,
          temp: ctx.temp
        }) as any
        if ((await initPage.hookBeforeRoute?.()) !== false) {
          await initPage[value.routeName]()
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

      if (typeof Page.prototype.handleFree == `function`) {
        const initPage = new Page({
          ct: ctx,
          cacheSession: ctx.cacheSession,
          cacheKeyboard: ctx.cacheKeyboard,
          templateManager: this.templateManager,
          temp: ctx.temp
        })
        if ((await initPage.hookBeforeRoute?.()) !== false) {
          await initPage.handleFree!()
          await initPage.hookAfterRoute?.()
        }
      }
    }

    return {state: ctx.temp.isAnswer ? `matched` : `no-match`}
  }

  async _onHandle(ct: ITCt, listenerName: Parameters<Gramstax[`_pageRoutes`]>[1], shouldCheckNotFound: boolean = true): Promise<void> {
    let state: any
    const ctx = this.createCtx(ct)
    const isEdit = listenerName === `callbackquerydata`
    const before = await this.hookBeforeRoute?.(ctx, {listenerName, isEdit})
    if (before === false) {
      return
    }

    try {
      const routeResult = await this._pageRoutes(ctx, listenerName)
      state = routeResult.state
      if (routeResult.state === `no-match`) {
        if (shouldCheckNotFound) {
          await this.hookErrorInputNotFoundPage?.(ctx, {listenerName, isEdit})
        }
      }
    } catch (error) {
      state = `error`
      await this.hookErrorPage?.(ctx, {listenerName, error, isEdit})
    }
    await this.hookAfterRoute?.(ctx, {listenerName, state, isEdit})
  }

  /**
   * Returns middleware to register as low-level plugins on the bot.
   *
   * @remarks
   * Override this method in a subclass to inject custom plugin middleware
   * (sessions, i18n, rate limiting, logging, authentication, etc.) into the
   * underlying bot instance.
   *
   * Each element of the returned array is a {@link ITCtMiddleware} value (either a
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
   * @returns Array of {@link ITCtMiddleware}
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
  registerLowPlugin?(): Array<ITCtMiddleware<ITCt>>

  /**
   * Registers an event handler for a bot event.
   *
   * @remarks
   * These registration methods (`registerLowOn*`) are designed to be overridable
   * so subclasses can integrate with a different bot library, custom event
   * system, or alternative routing approach. The default implementation
   * delegates to `this.bot` to subscribe to the relevant event. Override any
   * `registerLowOn*` method to customize how a specific event or message type
   * is routed to its handler.
   *
   * @example
   * ```typescript
   * class MyBot extends Gramstax {
   *   // Override if need to route via a custom event bus instead of the default bot
   *   registerLowOnCallbackQueryData() {
   *     // default is `callback_query:data`
   *     this.bot.on(`cb_data`, (ctx) => this._onHandle(ctx, `callbackquerydata`))
   *   }
   * }
   * ```
   *
   * @public
   */
  registerLowOnCallbackQueryData() {
    this.bot.on(`callback_query:data`, (ctx) => this._onHandle(ctx, `callbackquerydata`)) // Handle callback queries from inline keyboards
  }
  /** {@inheritDoc Gramstax.registerLowOnCallbackQueryData} */
  registerLowOnMessageText() {
    this.bot.on(`message:text`, (ctx) => this._onHandle(ctx, `text`)) // Handle global text messages
  }
  /** {@inheritDoc Gramstax.registerLowOnCallbackQueryData} */
  registerLowOnMessagePhoto() {
    this.bot.on(`message:photo`, (ctx) => this._onHandle(ctx, `photo`)) // Handle global photo messages
  }
  /** {@inheritDoc Gramstax.registerLowOnCallbackQueryData} */
  registerLowOnMessageVideo() {
    this.bot.on(`message:video`, (ctx) => this._onHandle(ctx, `video`)) // Handle global video messages
  }
  /** {@inheritDoc Gramstax.registerLowOnCallbackQueryData} */
  registerLowOnMessageAudio() {
    this.bot.on(`message:audio`, (ctx) => this._onHandle(ctx, `audio`)) // Handle global audio messages
  }
  /** {@inheritDoc Gramstax.registerLowOnCallbackQueryData} */
  registerLowOnMessageDocument() {
    this.bot.on(`message:document`, (ctx) => this._onHandle(ctx, `document`)) // Handle global document messages
  }
  /** {@inheritDoc Gramstax.registerLowOnCallbackQueryData} */
  registerLowOnMessageAnimation() {
    this.bot.on(`message:animation`, (ctx) => this._onHandle(ctx, `animation`)) // Handle global animation messages
  }
  /** {@inheritDoc Gramstax.registerLowOnCallbackQueryData} */
  registerLowOnMessageVoice() {
    this.bot.on(`message:voice`, (ctx) => this._onHandle(ctx, `voice`)) // Handle global voice messages
  }
  /** {@inheritDoc Gramstax.registerLowOnCallbackQueryData} */
  registerLowOnMessageVideoNote() {
    this.bot.on(`message:video_note`, (ctx) => this._onHandle(ctx, `videonote`)) // Handle global video note messages
  }
  /** {@inheritDoc Gramstax.registerLowOnCallbackQueryData} */
  registerLowOnMessageSticker() {
    this.bot.on(`message:sticker`, (ctx) => this._onHandle(ctx, `sticker`)) // Handle global sticker messages
  }
  /** {@inheritDoc Gramstax.registerLowOnCallbackQueryData} */
  registerLowOnMessageLocation() {
    this.bot.on(`message:location`, (ctx) => this._onHandle(ctx, `location`)) // Handle global location messages
  }
  /** {@inheritDoc Gramstax.registerLowOnCallbackQueryData} */
  registerLowOnMessageContact() {
    this.bot.on(`message:contact`, (ctx) => this._onHandle(ctx, `contact`)) // Handle global contact messages
  }
  /** {@inheritDoc Gramstax.registerLowOnCallbackQueryData} */
  registerLowOnChatMember() {
    this.bot.on(`chat_member`, (ctx) => this._onHandle(ctx, `chatmember`)) // Handle chat member updates
    this.bot.on(`my_chat_member`, (ctx) => this._onHandle(ctx, `mychatmember`)) // Handle bot's own chat member updates
  }
}
