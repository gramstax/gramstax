import {Ctx} from "./ctx"
import {log, type LoggingHelper} from "~/helpers/log"
import {PageManager} from "~/page/manager"
import {readFileSync} from "node:fs"
import {fileURLToPath} from "node:url"
import {dirname, join, parse} from "node:path"
import {TemplateManager} from "~/template/manager"
import {CacheExternal, ITCacheRpc} from "~/cache/external"
import {Bot, webhookCallback, type BotConfig, type BotError, type Context} from "grammy"
import type {UserFromGetMe} from "grammy/types"
import type {ITGramstaxParams, ITWebhookQueueConfig} from "~/types/t.bot"
import {WebhookQueue} from "~/webhook/queue"

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
 * @typeParam ICtx - The context type extending {@link Ctx}.
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
  templateManager: TemplateManager

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
    shortCallbackData: false
  }

  /**
   * Logger instance for debugging and info output.
   *
   * @remarks
   * Uses {@link LoggingHelper} for formatted log output.
   */
  log: LoggingHelper | undefined

  /**
   * The underlying grammY Bot instance.
   *
   * @remarks
   * Instance of the grammY `Bot`.
   */
  bot: Bot

  /**
   * Optional grammY bot configuration.
   *
   * @remarks
   * Configuration object for grammY `BotConfig` and `Context`.
   */
  botConfig?: BotConfig<Context>

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
  deployType: `polling` | `webhook` | `serverless` | `test`

  /**
   * Creates a new Gramstax bot instance.
   *
   * @param params - Configuration options. See {@link ITGramstaxParams} for all available options.
   *
   * @example
   * ```typescript
   * // Polling mode
   * new Gramstax({token: "BOT_TOKEN", deploy: "polling"})
   *
   * // Webhook mode
   * new Gramstax({token: "BOT_TOKEN", deploy: "webhook:https://example.com/bot"})
   *
   * // Serverless mode
   * new Gramstax({token: "BOT_TOKEN", deploy: "serverless:std/http"})
   * ```
   *
   * @public
   */
  constructor(params: ITGramstaxParams) {
    if (!params?.token || params?.token?.length == 0) {
      throw new Error(`Token is not valid or empty`)
    }

    if (typeof params.optionsPage?.shortCallbackData == `boolean`) {
      this.optionsPage.shortCallbackData = params.optionsPage.shortCallbackData
    }

    this.log = params.log === true ? log : !params.log ? undefined : params.log
    this.log?.info?.(`Gramstax v${__PKG_VERSION__}`)

    this.cacheSession = params.cacheSession || new CacheExternal(`memory`)
    this.cacheKeyboard = params.cacheKeyboard || new Map()
    this.botConfig = params.botConfig
    this.webhookQueue = params.webhookQueue
    this.templateManager =
      params.templateManager ||
      new TemplateManager({
        path: [join(process.cwd(), `src`, `pages`)]
      })

    this.bot = this.createBot(params.token)
    this.bot.catch(this._onCatch)
    this._registerOnCallbackQueryData() // Handle callback queries from inline keyboards
    this._registerOnMessageText() // Handle global text messages
    this._registerOnMessagePhoto() // Handle global photo messages
    this._registerOnMessageVideo() // Handle global video messages
    this._registerOnMessageAudio() // Handle global audio messages
    this._registerOnMessageDocument() // Handle global document messages
    this._registerOnMessageAnimation() // Handle global animation messages
    this._registerOnMessageVoice() // Handle global voice messages
    this._registerOnMessageVideoNote() // Handle global video note messages
    this._registerOnMessageSticker() // Handle global sticker messages
    this._registerOnMessageLocation() // Handle global location messages
    this._registerOnMessageContact() // Handle global contact messages

    // Default for customize (very rarely used)
    this.handlerBotUpdate = this.bot.handleUpdate

    // Load pages AFTER templateManager is initialized
    this.pages = this._pageLoads()

    // Graceful shutdown
    process.once(`SIGINT`, () => this.stop())
    process.once(`SIGTERM`, () => this.stop())

    this.hookBeforeStart?.()
    if (params.deploy.startsWith(`polling`)) {
      this.deployType = `polling`
      this._runPolling()
    } else if (params.deploy.startsWith(`webhook:`)) {
      this.deployType = `webhook`
      this._runWebhook(params.deploy.split(`webhook:`)[1] as string)
    } else if (params.deploy.startsWith(`serverless:`)) {
      this.deployType = `serverless`
      this._runServerless(params.deploy.split(`serverless:`)[1] as string)
    } else if (params.deploy.startsWith(`test`)) {
      this.deployType = `test`
      // nothing, for test unit internal area
    } else {
      throw new Error(`Params deploy is not valid, expected: polling, webhook:<public-url>, serverless:<your-adapter>`)
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
  _onCatch(error: BotError<Context>) {
    if ((this.log as any)?.errorMake) {
      ;(this.log as any)?.errorMake(error, `Bot`, `catch`)
    } else {
      const err = JSON.stringify(error, null, 2)
      this.log?.error?.(`[Bot.catch]: ${err}`)
    }
  }

  /**
   * Hook called before the bot starts.
   * @remarks Override this method to run initialization logic.
   * @virtual
   * @public
   */
  async hookBeforeStart?(): Promise<any>

  /**
   * Hook called after the bot has started.
   * @remarks Override this method to run post-start logic.
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
   * @example
   * ```typescript
   * async hookBeforeRoute(ctx: Ctx, data: Parameters<NonNullable<Gramstax[`hookBeforeRoute`]>>[1]) {
   *   console.log(`[${data.listenerName}] handled by page: ${ctx.data.name} execute: `)
   *   if (ctx.userId === blockedUserId) {
   *     return false // Will not response
   *   }
   *   return true
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookBeforeRoute?(ctx: ICtx, data: {listenerName: string}): Promise<boolean>

  /**
   * Hook called after routing an update.
   *
   * @remarks
   * Override this method to add after routing logic like analytics or logging.
   * NOTE: only executed when `hookBeforeRoute` set to return true or not define overrides
   *
   * @param ctx - The context instance.
   * @param listenerName - The name of the listener that handled this update.
   * @param status - Status this update
   *
   * @example
   * ```typescript
   * async hookAfterRoute(ctx: Ctx, data: Parameters<NonNullable<Gramstax[`hookAfterRoute`]>>[1]) {
   *   console.log(`[${data.listenerName}] handled by page: ${ctx.data.name} execute: status: ${data.status}`)
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookAfterRoute?(ctx: ICtx, data: {listenerName: string; status: `success` | `error` | `notfound`}): Promise<void>

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
   * @example
   * ```typescript
   * async hookErrorPage(ctx: Ctx, data: Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]) {
   *   await new GeneralStatusPage(ctx).showError(`${data.listenerName}:hookErrorPage`, data.error, data.isEdit)
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookErrorPage?(ctx: ICtx, data: {listenerName: string; error: any; isEdit: boolean}): Promise<void>

  /**
   * Hook called when no page handler matches the input.
   *
   * @remarks
   * Override this method to send a "command not found" message or
   * redirect to a help page.
   *
   * @param ctx - The context instance.
   *
   * @example
   * ```typescript
   * async hookErrorInputNotFoundPage(ctx: Ctx) {
   *   await new GeneralStatusPage(ctx).showErrorInputNotFound()
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookErrorInputNotFoundPage?(ctx: ICtx): Promise<void>

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
   * Creates the grammY Bot instance.
   *
   * @param token - The Telegram Bot API token.
   * @returns The Bot instance.
   *
   * @public
   */
  createBot(token: string) {
    return new Bot(token, this.botConfig)
  }

  /**
   * Creates a context instance for handling an update.
   *
   * @param ct - The grammY Context object.
   * @returns A new Ctx instance.
   *
   * @public
   */
  createCtx(ct: Context): ICtx {
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
    this.bot.start({
      drop_pending_updates: true,
      onStart: (botInfo) => {
        this._onStart(botInfo, `polling`, null)
      }
    })
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
   * @param adapter - The grammY adapter name (e.g., "std/http", "aws-lambda").
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
    if (!Page.data.intentCallbackData) Page.data.intentCallbackData = Page.data.name
  }

  /**
   * Sorts and categorizes page routes into routing tables.
   *
   * @remarks
   * Registration happens in 3 phases:
   *
   * **Phase 1 — Non-session static/intent routes** (id=2, id=3):
   * Iterates `listRouteStatic` and `listRouteStaticIntent`. Registers exact-match
   * routes (`handleCallbackData`, `handleText`, `handleCommandText`, `handleCaption*`,
   * `handleCommandCaption*`) into `routeStatic` — and intent-with-args variants
   * (`handleArgs*`, `handleCommandArgs*`, `handleCaptionArgs*`,
   * `handleCommandCaptionArgs*`) into `routeStaticIntent`.
   * Routes are keyed by `intentCommandText` (prefixed with `/`), `intentCallbackData`,
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
   * @param indexPage - The page index (used for shortCallbackData).
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
          const _isCallbackData = routeName.endsWith(`CallbackData`)
          const _isText = routeName.endsWith(`Text`)

          let key: string | undefined
          if (_isCommand) {
            const _key = Page.data.intentCommandText
            key = _key ? `/${_key}` : undefined
          } else if (_isCallbackData) {
            let _key = Page.data.intentCallbackData
            if (this.optionsPage.shortCallbackData === true) {
              _key = String(indexPage)
              Page.data.intentCallbackData = _key
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
    const nonSessionFreeRoutes = [`handleFreeText`, `handleFreePhoto`, `handleFreeVideo`, `handleFreeAudio`, `handleFreeDocument`, `handleFreeAnimation`, `handleFreeVoice`, `handleFreeVideoNote`, `handleFreeSticker`, `handleFreeLocation`, `handleFreeContact`] as const
    for (const routeName of nonSessionFreeRoutes) {
      if (Object.hasOwn(proto, routeName) && typeof (proto as any)[routeName] === `function`) {
        const pureName = routeName.replace(partHandle, ``).replace(partArgs, ``).replace(partCommand, ``).replace(partCaption, ``).replace(partFree, ``).toLowerCase()
        const alreadyExists = pds[pureName as keyof typeof pds]?.some((item) => item.name === name)
        if (!alreadyExists) {
          pds[pureName as keyof typeof pds].push({name, routeName})
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
      const scopes = this.templateManager.getDescriptionScopes(name)

      for (const scope of scopes) {
        if (!targets.has(scope)) {
          targets.set(scope, new Set())
        }

        const langs = this.templateManager.getDescriptionLanguage(name, `default`, scope)
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
          const desc = this.templateManager.getDescription(name, `default`, lang, scope)
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
   * Loads all page classes and builds routing tables.
   *
   * @remarks
   * Scans the pages directory, processes each page class, and builds
   * optimized routing tables for O(1) lookups.
   *
   * @returns The pages routing structure.
   *
   * @public
   */
  _pageLoads() {
    this.log?.info?.(`Load pages..`)

    const listRouteStatic = [
      // callback
      `handleCallbackData`,
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
      `handleArgsCallbackData`,
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
    // Helper to keep map result as literal types (prevents widening to string[])
    const toSession = <T extends string>(route: T): `handleSession${T extends `handle${infer R}` ? R : T}` => {
      return `handleSession${route.startsWith(`handle`) ? route.slice(6) : route}` as any
    }
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

    const makeObject = <const T extends readonly string[], V extends () => any>(keys: T, val: V): {[K in T[number]]: ReturnType<V>} => Object.fromEntries(keys.map((k) => [k, val()])) as {[K in T[number]]: ReturnType<V>}
    const initDynamicSpesific = () => [] as {name: string; routeName: string}[] // [0]{name: Page.data.name, routeName: routeFunctionName}

    const pages = {
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
      listRouteStatic,
      listRouteStaticIntent,
      listRouteStaticSession,
      lenListRouteStatic: listRouteStatic.length,
      lenListRouteStaticIntent: listRouteStaticIntent.length,
      lenListRouteStaticSession: listRouteStaticSession.length
    }

    PageManager.getFileManySync(undefined).forEach(({path, page}, index) => {
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
   *      are checked (e.g., callback queries only match `*CallbackData` session routes,
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
   *    - Example: "start:123" → `handleArgsCallbackData()`, "/add item" → `handleCommandArgsText()`
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
   * @returns `result`: The route handler result, or null if no handler answered.
   *
   * @public
   */
  async _pageRoutes(ctx: ICtx, fromListener: `callbackdata` | keyof typeof Gramstax.prototype.pages.routeDynamicSpesific): Promise<{result: any}> {
    // to be reassigned
    let Page: typeof Ctx | undefined
    let res: {name: string; routeName: string} | undefined

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
     * example = handleCaptionAnimation, handleCallbackData, handleCommandText
     * description = route only intent, example "/start", "start", "take-photo-live-in-indonesia"
     */
    if (Page === undefined) {
      const cd = ctx.callbackData
      const mt = ctx.msgText
      const mc = ctx.msgCaption
      const pStatic = this.pages.routeStatic

      for (let index = 0; index < this.pages.lenListRouteStatic; index++) {
        const routeName = this.pages.listRouteStatic[index] as `handleCaptionAnimation`
        if (routeName.toLowerCase().endsWith(fromListener)) {
          res = pStatic[routeName][cd || mt || mc]
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
     * example = handleCommandCaptionArgsAnimation, handleCommandArgsCallbackData, handleCommandArgsText
     * description = route with intent and args, example "/start helloworld", "start helloworld", "/add item1", "/add item1 item2"
     *               "wallet:123", "wallet:123:kkk"
     */
    if (Page === undefined) {
      const pStaticIntent = this.pages.routeStaticIntent
      const isCallback = fromListener === `callbackdata`
      const seperatorMethod = isCallback ? `colon` : `space`
      const data = isCallback ? ctx.callbackData : ctx.msgText || ctx.msgCaption
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
      // check first is have route function or not for best performance. if not have return undefined
      if (!Page.prototype[res.routeName as keyof typeof Page.prototype]) {
        return {
          result: undefined
        }
      }

      const initPage = new Page(ctx) as any
      if ((await initPage.hookBeforeRoute?.()) !== false) {
        const initRoute = await initPage[res.routeName]?.()
        await initPage.hookAfterRoute?.()
        return {
          result: ctx.temp.isAnswer === true ? initRoute : null
        }
      }
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

      // check first is have route function or not for best performance. if not continue
      if (typeof Page.prototype[value.routeName as keyof typeof Page.prototype] == `function`) {
        const initPage = new Page(ctx) as any
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

      // check first is have route function or not for best performance. if not continue
      if (typeof Page.prototype.handleFree == `function`) {
        const initPage = new Page(ctx)
        if ((await initPage.hookBeforeRoute?.()) !== false) {
          await initPage.handleFree!()
          await initPage.hookAfterRoute?.()
        }
      }
    }

    // returning result null if "isAnswer" false. will trigger hookErrorInputNotFoundPage
    return {
      result: ctx.temp.isAnswer === false ? null : undefined
    }
  }

  async _onHandle(ct: Context, listenerName: keyof typeof Gramstax.prototype.pages.routeDynamicSpesific | `onCallbackQueryData`, fromListener: Parameters<Gramstax[`_pageRoutes`]>[1], shouldCheckNotFound: boolean = true): Promise<void> {
    let status: any
    const ctx = this.createCtx(ct)
    const before = await this.hookBeforeRoute?.(ctx, {listenerName})
    if (before === false) {
      return
    }
    try {
      const {result} = await this._pageRoutes(ctx, fromListener)
      if (result === null) {
        status = `notfound`
        if (shouldCheckNotFound) {
          await this.hookErrorInputNotFoundPage?.(ctx)
        }
      } else {
        status = `success`
      }
    } catch (error) {
      status = `error`
      await this.hookErrorPage?.(ctx, {listenerName, error, isEdit: false})
    }
    await this.hookAfterRoute?.(ctx, {listenerName, status})
  }

  /**
   * Handles incoming messages of a specific type and process route.
   *
   * @param ct - The grammY Context object.
   * @param listenerName - The message type being handled.
   *
   * @public
   */
  async _onMessage(ct: Context, listenerName: keyof typeof Gramstax.prototype.pages.routeDynamicSpesific): Promise<void> {
    await this._onHandle(ct, listenerName, listenerName)
  }

  /**
   * Handles incoming callback queries from inline keyboards and process route.
   *
   * @param ct - The grammY Context object.
   * @public
   */
  async _onCallbackQueryData(ct: Context): Promise<void> {
    await this._onHandle(ct, `onCallbackQueryData`, `callbackdata`, false)
  }

  /**
   * Handles incoming messages*
   *
   * @param ct - The grammY Context object.
   * @public
   */
  async _onMessageText(ct: Context): Promise<void> {
    await this._onMessage(ct, `text`)
  }
  /** {@inheritDoc Gramstax._onMessageText} */
  async _onMessagePhoto(ct: Context): Promise<void> {
    await this._onMessage(ct, `photo`)
  }
  /** {@inheritDoc Gramstax._onMessageText} */
  async _onMessageVideo(ct: Context): Promise<void> {
    await this._onMessage(ct, `video`)
  }
  /** {@inheritDoc Gramstax._onMessageText} */
  async _onMessageAudio(ct: Context): Promise<void> {
    await this._onMessage(ct, `audio`)
  }
  /** {@inheritDoc Gramstax._onMessageText} */
  async _onMessageDocument(ct: Context): Promise<void> {
    await this._onMessage(ct, `document`)
  }
  /** {@inheritDoc Gramstax._onMessageText} */
  async _onMessageAnimation(ct: Context): Promise<void> {
    await this._onMessage(ct, `animation`)
  }
  /** {@inheritDoc Gramstax._onMessageText} */
  async _onMessageVoice(ct: Context): Promise<void> {
    await this._onMessage(ct, `voice`)
  }
  /** {@inheritDoc Gramstax._onMessageText} */
  async _onMessageVideoNote(ct: Context): Promise<void> {
    await this._onMessage(ct, `videonote`)
  }
  /** {@inheritDoc Gramstax._onMessageText} */
  async _onMessageSticker(ct: Context): Promise<void> {
    await this._onMessage(ct, `sticker`)
  }
  /** {@inheritDoc Gramstax._onMessageText} */
  async _onMessageLocation(ct: Context): Promise<void> {
    await this._onMessage(ct, `location`)
  }
  /** {@inheritDoc Gramstax._onMessageText} */
  async _onMessageContact(ct: Context): Promise<void> {
    await this._onMessage(ct, `contact`)
  }

  /**
   * Registers handlers message*.
   *
   * @remarks
   * These methods register grammY event handlers for different message types.
   * Override to customize message filtering.
   *
   * @public
   */
  _registerOnCallbackQueryData() {
    this.bot.on(`callback_query:data`, this._onCallbackQueryData.bind(this)) // Handle callback queries from inline keyboards
  }
  /** {@inheritDoc Gramstax._registerOnCallbackQueryData} */
  _registerOnMessageText() {
    this.bot.on(`message:text`, this._onMessageText.bind(this)) // Handle global text messages
  }
  /** {@inheritDoc Gramstax._registerOnCallbackQueryData} */
  _registerOnMessagePhoto() {
    this.bot.on(`message:photo`, this._onMessagePhoto.bind(this)) // Handle global photo messages
  }
  /** {@inheritDoc Gramstax._registerOnCallbackQueryData} */
  _registerOnMessageVideo() {
    this.bot.on(`message:video`, this._onMessageVideo.bind(this)) // Handle global video messages
  }
  /** {@inheritDoc Gramstax._registerOnCallbackQueryData} */
  _registerOnMessageAudio() {
    this.bot.on(`message:audio`, this._onMessageAudio.bind(this)) // Handle global audio messages
  }
  /** {@inheritDoc Gramstax._registerOnCallbackQueryData} */
  _registerOnMessageDocument() {
    this.bot.on(`message:document`, this._onMessageDocument.bind(this)) // Handle global document messages
  }
  /** {@inheritDoc Gramstax._registerOnCallbackQueryData} */
  _registerOnMessageAnimation() {
    this.bot.on(`message:animation`, this._onMessageAnimation.bind(this)) // Handle global animation messages
  }
  /** {@inheritDoc Gramstax._registerOnCallbackQueryData} */
  _registerOnMessageVoice() {
    this.bot.on(`message:voice`, this._onMessageVoice.bind(this)) // Handle global voice messages
  }
  /** {@inheritDoc Gramstax._registerOnCallbackQueryData} */
  _registerOnMessageVideoNote() {
    this.bot.on(`message:video_note`, this._onMessageVideoNote.bind(this)) // Handle global video note messages
  }
  /** {@inheritDoc Gramstax._registerOnCallbackQueryData} */
  _registerOnMessageSticker() {
    this.bot.on(`message:sticker`, this._onMessageSticker.bind(this)) // Handle global sticker messages
  }
  /** {@inheritDoc Gramstax._registerOnCallbackQueryData} */
  _registerOnMessageLocation() {
    this.bot.on(`message:location`, this._onMessageLocation.bind(this)) // Handle global location messages
  }
  /** {@inheritDoc Gramstax._registerOnCallbackQueryData} */
  _registerOnMessageContact() {
    this.bot.on(`message:contact`, this._onMessageContact.bind(this)) // Handle global contact messages
  }
}
