import {Ctx} from "./ctx"
import {log} from "~/utils/log"
import {PageManager} from "~/page/manager"
import {readFileSync} from "node:fs"
import {fileURLToPath} from "node:url"
import {dirname, join, parse} from "node:path"
import {TemplateManager} from "~/template/manager"
import {CacheExternal, ICacheRpc} from "~/cache/external"
import {Bot, webhookCallback, type BotError, type Context} from "grammy"
import type {LoggingPretty} from "logging-pretty"
import type {UserFromGetMe} from "grammy/types"

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
   * @public
   */
  templateManager: TemplateManager

  /**
   * In-memory cache for keyboard instances by language.
   * @public
   */
  cacheKeyboard: Map<any, any>

  /**
   * External cache for user session data.
   * @public
   */
  cacheSession: CacheExternal<ICacheRpc>

  /**
   * Loaded and sorted page routes.
   * @readonly
   * @public
   */
  pages: ReturnType<typeof this._pageLoads>

  /**
   * Page options configuration.
   * @public
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
   * @public
   */
  log: LoggingPretty | undefined

  /**
   * The underlying grammY Bot instance.
   * @public
   */
  bot: Bot

  /**
   * Handler function for processing bot updates.
   * @remarks
   * Can be customized for serverless or webhook deployments.
   * @public
   */
  handlerBotUpdate: any

  /**
   * Creates a new Gramstax bot instance.
   *
   * @param params - Configuration options.
   * @param params.token - Telegram Bot API token.
   * @param params.deploy - Deployment mode: "polling", "webhook:\<url\>", or "serverless:\<adapter\>".
   * @param params.log - Logger instance, true for default logger, or null/false to disable.
   * @param params.cacheSession - Custom session cache implementation.
   * @param params.cacheKeyboard - Custom keyboard cache.
   * @param params.templateManager - Custom template manager.
   * @param params.optionsPage - Page routing options.
   * @param params.optionsPage.shortCallbackData - Use numeric callback data for smaller payloads.
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
  constructor(params: {
    token: string
    deploy: string
    log?: LoggingPretty | boolean | null
    cacheSession?: CacheExternal
    cacheKeyboard?: Map<any, any>
    templateManager?: TemplateManager
    optionsPage?: {
      shortCallbackData?: boolean
    }
  }) {
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
    process.once(`SIGINT`, () => this.bot.stop())
    process.once(`SIGTERM`, () => this.bot.stop())

    this.hookBeforeStart()
    if (params.deploy.startsWith(`polling`)) {
      this._runPolling()
    } else if (params.deploy.startsWith(`webhook:`)) {
      this._runWebhook(params.deploy.split(`webhook:`)[1] as string)
    } else if (params.deploy.startsWith(`serverless:`)) {
      this._runServerless(params.deploy.split(`serverless:`)[1] as string)
    } else if (params.deploy.startsWith(`test`)) {
      // nothing, for test unit internal area
    } else {
      throw new Error(`Params deploy is not valid, expected: polling, webhook:<public-url>, serverless:<your-adapter>`)
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
  hookBeforeStart() {}

  /**
   * Hook called after the bot has started.
   * @remarks Override this method to run post-start logic.
   * @virtual
   * @public
   */
  hookAfterStart() {}

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
    this.log?.success?.(`Telegram bot polling started: ${username} ${method == `webhook` || method == `serverless` ? `(${data})` : ``}`)
    this.hookAfterStart()
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
    return new Bot(token)
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
    this.handlerBotUpdate = handleUpdate

    const pathUrl = new URL(fullUrl).pathname
    serve({
      fetch(req) {
        const {pathname} = new URL(req.url)
        if (req.method == `POST` && pathname == pathUrl) {
          return handleUpdate(req)
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

    const data = await this.bot.api.getWebhookInfo()
    if (data.url != fullUrl) {
      await this.bot.api.setWebhook(fullUrl)
    }

    const botInfo = await this.bot.api.getMe()
    await this._onStart(botInfo, `webhook`, fullUrl)
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
    if (!Page.data.intentTextCommand) Page.data.intentTextCommand = Page.data.name
    if (!Page.data.intentCallback) Page.data.intentCallback = Page.data.name
  }

  /**
   * Sorts and categorizes page routes into routing tables.
   *
   * @remarks
   * Populates `routeStatic`, `routeStaticIntent`, `routeStaticSession`,
   * `routeDynamicSpesific`, and `routeDynamic` collections based on
   * which route methods exist on the page class.
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

    const partPayload = `Payload`
    const partCommand = `Command`
    const partCaption = `Caption`
    const partFree = `Free`

    const pd = pages.routeDynamic
    const pds = pages.routeDynamicSpesific

    const upFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
    const getPureRouteName = (func: string) => func.replace(partPayload, ``).replace(partCommand, ``).replace(partCaption, ``).replace(partFree, ``)
    const methodSession = (func: string, name: any) => (proto as any as Record<any, (...args: any) => string>)[`methodSession${upFirst(func)}`]?.(name)

    // all
    pages.all[name] = Page

    for (let index = 0; index < pages.lenListRouteStaticSession; index++) {
      const routeName = pages.listRouteStaticSession[index] as string

      // Check if the method exists on the page
      if (typeof (proto as any)[routeName] !== `function`) {
        continue
      }

      const ps = pages.routeStatic[routeName as keyof typeof pages.routeStatic]
      const psi = pages.routeStaticIntent[routeName as keyof typeof pages.routeStaticIntent]
      const pss = pages.routeStaticSession[routeName as keyof typeof pages.routeStaticSession]

      const value = {name, routeName}
      const p = ps || psi
      if (p !== undefined) {
        const _isCommand = routeName.includes(partCommand)
        const _isCallback = routeName.includes(`callback`)
        const _isText = routeName.startsWith(`text`)

        let key: string | undefined
        if (_isCommand) {
          const _key = Page.data.intentTextCommand
          key = _key ? `/${_key}` : undefined
        } else if (_isCallback) {
          let _key = Page.data.intentCallback
          if (this.optionsPage.shortCallbackData === true) {
            _key = String(indexPage)
            Page.data.intentCallback = _key
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

      // staticSession
      if (pss !== undefined) {
        pss[methodSession(routeName, name)!] = value
      }

      // dynamicSpesific
      if (routeName.toLowerCase().endsWith(`free`)) {
        pds[getPureRouteName(routeName) as keyof typeof pds].push(value)
      }
    }

    // all
    if (proto.free) {
      pd.push(name)
    }
  }

  async executeSyncBlocksDescription(pages: typeof Gramstax.prototype.pages) {
    // 1. Collect all unique (scope, language) pairs
    const targets = new Map<string, Set<string>>() // scope -> Set<language>
    const allCommands = pages.routeStatic.textCommand

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
      `callback`,
      // text
      `text`,
      `textCommand`,
      // photo
      `photoCaption`,
      `photoCaptionCommand`,
      // video
      `videoCaption`,
      `videoCaptionCommand`,
      // audio
      `audioCaption`,
      `audioCaptionCommand`,
      // document
      `documentCaption`,
      `documentCaptionCommand`,
      // animation
      `animationCaption`,
      `animationCaptionCommand`,
      // voice
      `voiceCaption`,
      `voiceCaptionCommand`
    ] as const
    const listRouteStaticIntent = [
      // callback
      `callbackPayload`,
      // text
      `textPayload`,
      `textCommandPayload`,
      // photo
      `photoCaptionPayload`,
      `photoCaptionCommandPayload`,
      // video
      `videoCaptionPayload`,
      `videoCaptionCommandPayload`,
      // audio
      `audioCaptionPayload`,
      `audioCaptionCommandPayload`,
      // document
      `documentCaptionPayload`,
      `documentCaptionCommandPayload`,
      // animation
      `animationCaptionPayload`,
      `animationCaptionCommandPayload`,
      // voice
      `voiceCaptionPayload`,
      `voiceCaptionCommandPayload`
    ] as const
    const listRouteStaticSession = [
      ...listRouteStatic,
      ...listRouteStaticIntent,
      // text
      `textFree`,
      // photo
      `photoFree`,
      // video
      `videoFree`,
      // audio
      `audioFree`,
      // document
      `documentFree`,
      // animation
      `animationFree`,
      // voice
      `voiceFree`,
      // videoNote
      `videoNoteFree`,
      // sticker
      `stickerFree`,
      // location
      `locationFree`,
      // contact
      `contactFree`
    ] as const

    const makeObject = <const T extends readonly string[], V extends () => any>(keys: T, val: V): {[K in T[number]]: ReturnType<V>} => Object.fromEntries(keys.map((k) => [k, val()])) as {[K in T[number]]: ReturnType<V>}
    const initDynamicSpesific = () => [] as {name: string; routeName: string}[] // [0]{name: Page.data.name, routeName: routeFunctionName}

    const pages = {
      all: {} as Record<string, typeof Ctx>, // [page.data.name]: Classes Page
      routeDynamic: [] as string[], // [Page]{ free: (...) => ... }
      // <method>: Array<{name: Page.data.name, routeName:routeFunctionName}>
      routeDynamicSpesific: {
        text: initDynamicSpesific(),
        photo: initDynamicSpesific(),
        video: initDynamicSpesific(),
        audio: initDynamicSpesific(),
        document: initDynamicSpesific(),
        animation: initDynamicSpesific(),
        voice: initDynamicSpesific(),
        videoNote: initDynamicSpesific(),
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
   * 1. **staticSession** - Session-based routes (O(1) lookup)
   *    - Checks if user has an active session with a matching method
   *    - Skips if the input matches a static or staticIntent route
   *    - Example: `textFree` with session method "7-mypage"
   *
   * 2. **static** - Exact intent match routes (O(1) lookup)
   *    - Matches exact text/callback data to page intents
   *    - Example: "start" → `text()`, "/help" → `textCommand()`
   *
   * 3. **staticIntent** - Intent with payloads routes (O(1) lookup)
   *    - Matches intent prefix when payloads are present
   *    - Example: "start:123" → `callbackPayload()`, "/add item" → `textCommandPayload()`
   *
   * 4. **dynamicSpesific** - Type-specific free handlers (O(n) iteration)
   *    - Runs all `*Free` handlers for the message type
   *    - Example: `textFree()`, `photoFree()`
   *    - **All matching handlers are executed** (no early return)
   *
   * 5. **dynamic** - Global fallback handlers (O(n) iteration)
   *    - Runs all `free()` handlers from pages that define them
   *    - Last resort when nothing else matches
   *    - **All matching handlers are executed** (no early return)
   *
   * @param ctx - The context instance.
   * @param fromListener - The listener type that triggered the route.
   * @returns The route handler result, or null if no handler answered.
   *
   * @public
   */
  async _pageRoutes(ctx: ICtx, fromListener: `callback` | keyof typeof Gramstax.prototype.pages.routeDynamicSpesific): Promise<any> {
    // to be reassigned
    let Page: typeof Ctx | undefined
    let res: {name: string; routeName: string} | undefined

    /**
     * id = 1
     * type = staticSession
     * algoritme = x = session method; O(x)
     * example = animationCaption, callback, textCommand
     * description = all route function but if have session only
     */
    if (Page === undefined) {
      const session = await ctx.sessionGet()
      if (session) {
        const mtd = session.method
        const pStaticSession = this.pages.routeStaticSession

        // Get entity for cross-checking with other routes
        const cd = ctx.callbackData
        const mt = ctx.msgText
        const mc = ctx.msgCaption
        const entity = cd || mt || mc
        const isCallback = fromListener === `callback`
        const separatorMethod = isCallback ? `colon` : `space`
        const intent = entity && ctx.havePayloads(entity, separatorMethod) ? ctx.getIntent(entity, separatorMethod, 1) : undefined
        const intent2 = !isCallback && entity ? ctx.getIntent(entity, `space`, 2) : undefined

        for (let index = 0; index < this.pages.lenListRouteStaticSession; index++) {
          const routeName = this.pages.listRouteStaticSession[index] as `animationCaption`
          if (routeName.startsWith(fromListener)) {
            // O(1) check: skip session-based routing if entity has its own route
            if (entity) {
              // Check in routeStatic (direct O(1) lookup)
              if ((this.pages.routeStatic as any)[routeName]?.[entity]) {
                continue
              }
              // Check in routeStaticIntent (direct O(1) lookup)
              const intentBucket = (this.pages.routeStaticIntent as any)[routeName]
              if (intentBucket && ((intent && intentBucket[intent]) || (intent2 && intentBucket[intent2]))) {
                continue
              }
            }

            res = pStaticSession[routeName][mtd]
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
     * example = animationCaption, callback, textCommand
     * description = route only intent, example "/start", "start", "take-photo-live-in-indonesia"
     */
    if (Page === undefined) {
      const cd = ctx.callbackData
      const mt = ctx.msgText
      const mc = ctx.msgCaption
      const pStatic = this.pages.routeStatic

      for (let index = 0; index < this.pages.lenListRouteStatic; index++) {
        const routeName = this.pages.listRouteStatic[index] as `animationCaption`
        if (routeName.startsWith(fromListener)) {
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
     * example = animationCaptionCommandPayload, callbackCommandPayload, textCommandPayload
     * description = route with intent and payloads, example "/start helloworld", "start helloworld", "/add item1", "/add item1 item2"
     *               "wallet:123", "wallet:123:kkk"
     */
    if (Page === undefined) {
      const pStaticIntent = this.pages.routeStaticIntent
      const isCallback = fromListener === `callback`
      const seperatorMethod = isCallback ? `colon` : `space`
      const data = isCallback ? ctx.callbackData : ctx.msgText || ctx.msgCaption
      const havePayloads = ctx.havePayloads(data, seperatorMethod)

      if (data && havePayloads) {
        for (let index = 0; index < this.pages.lenListRouteStaticIntent; index++) {
          const routeName = this.pages.listRouteStaticIntent[index] as `textPayload`
          if (!routeName.startsWith(fromListener)) {
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
        return
      }

      const initPage = new Page(ctx) as any
      const initRoute = await initPage[res.routeName]?.()
      return ctx.temp.isAnswer === true ? initRoute : null
    }

    /**
     * id = 4
     * type = dynamicSpesific
     * algoritme = O(n)
     * example = animationFree, textFree
     * description = route with suffix free, can be call without session. example "textFree", "animationFree"
     *               if have that route in class page you must be add validate session in first line (if use session before)
     *               example: if (!this.validateSessionTextFree()) { return null }
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
        await initPage[value.routeName]()
      }
    }

    /**
     * id = 5
     * type = dynamic
     * algoritme = O(n)
     * example = free
     * description = route with name "free", if all case before not match
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
      if (typeof Page.prototype.free == `function`) {
        const initPage = new Page(ctx)
        await initPage.free!()
      }
    }

    // returning null if "isAnswer" false. will trigger hookErrorInputNotFoundPage
    if (ctx.temp.isAnswer === false) {
      return null
    }
  }

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
   * async hookBeforeRoute(ctx: Ctx, listenerName: string) {
   *   if (ctx.userId === blockedUserId) {
   *     return false // Block this user
   *   }
   *   return true
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookBeforeRoute(ctx: ICtx, listenerName: string): Promise<boolean> {
    // must be override
    if (ctx || listenerName) {
      return true
    }
    return false
  }

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
   * async hookErrorPage(ctx: Ctx, listenerName: string, error: any) {
   *   await ctx.reply(undefined, {error: "An error occurred"})
   *   console.error(error)
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookErrorPage(ctx: ICtx, listenerName: string, error: any, isEdit: boolean): Promise<void> {
    // must be override
    if (ctx || listenerName || error || isEdit) {
      return
    }
  }

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
   *   await ctx.ct.reply("Unknown command. Type /help for assistance.")
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookErrorInputNotFoundPage(ctx: ICtx): Promise<void> {
    // must be override
    if (ctx) {
      return
    }
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
    const ctx = this.createCtx(ct)
    try {
      const before = await this.hookBeforeRoute(ctx, listenerName)
      if (before === false) {
        return
      }

      const routeResult = await this._pageRoutes(ctx, listenerName)
      if (routeResult === null) {
        await this.hookErrorInputNotFoundPage(ctx)
      }
    } catch (error) {
      await this.hookErrorPage(ctx, listenerName, error, false)
    }
  }

  /**
   * Handles incoming callback queries from inline keyboards and process route.
   *
   * @param ct - The grammY Context object.
   * @public
   */
  async _onCallbackQueryData(ct: Context): Promise<void> {
    const ctx = this.createCtx(ct)
    try {
      const before = await this.hookBeforeRoute(ctx, `onCallbackQueryData`)
      if (before === false) {
        return
      }

      // Check all route
      await this._pageRoutes(ctx, `callback`)
    } catch (error) {
      await this.hookErrorPage(ctx, `onCallbackQueryData`, error, true)
    }
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
  /** {@inheritDoc Gramstax#_onMessageText} */
  async _onMessagePhoto(ct: Context): Promise<void> {
    await this._onMessage(ct, `photo`)
  }
  /** {@inheritDoc Gramstax#_onMessageText} */
  async _onMessageVideo(ct: Context): Promise<void> {
    await this._onMessage(ct, `video`)
  }
  /** {@inheritDoc Gramstax#_onMessageText} */
  async _onMessageAudio(ct: Context): Promise<void> {
    await this._onMessage(ct, `audio`)
  }
  /** {@inheritDoc Gramstax#_onMessageText} */
  async _onMessageDocument(ct: Context): Promise<void> {
    await this._onMessage(ct, `document`)
  }
  /** {@inheritDoc Gramstax#_onMessageText} */
  async _onMessageAnimation(ct: Context): Promise<void> {
    await this._onMessage(ct, `animation`)
  }
  /** {@inheritDoc Gramstax#_onMessageText} */
  async _onMessageVoice(ct: Context): Promise<void> {
    await this._onMessage(ct, `voice`)
  }
  /** {@inheritDoc Gramstax#_onMessageText} */
  async _onMessageVideoNote(ct: Context): Promise<void> {
    await this._onMessage(ct, `videoNote`)
  }
  /** {@inheritDoc Gramstax#_onMessageText} */
  async _onMessageSticker(ct: Context): Promise<void> {
    await this._onMessage(ct, `sticker`)
  }
  /** {@inheritDoc Gramstax#_onMessageText} */
  async _onMessageLocation(ct: Context): Promise<void> {
    await this._onMessage(ct, `location`)
  }
  /** {@inheritDoc Gramstax#_onMessageText} */
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
  /** {@inheritDoc Gramstax#_registerOnCallbackQueryData} */
  _registerOnMessageText() {
    this.bot.on(`message:text`, this._onMessageText.bind(this)) // Handle global text messages
  }
  /** {@inheritDoc Gramstax#_registerOnCallbackQueryData} */
  _registerOnMessagePhoto() {
    this.bot.on(`message:photo`, this._onMessagePhoto.bind(this)) // Handle global photo messages
  }
  /** {@inheritDoc Gramstax#_registerOnCallbackQueryData} */
  _registerOnMessageVideo() {
    this.bot.on(`message:video`, this._onMessageVideo.bind(this)) // Handle global video messages
  }
  /** {@inheritDoc Gramstax#_registerOnCallbackQueryData} */
  _registerOnMessageAudio() {
    this.bot.on(`message:audio`, this._onMessageAudio.bind(this)) // Handle global audio messages
  }
  /** {@inheritDoc Gramstax#_registerOnCallbackQueryData} */
  _registerOnMessageDocument() {
    this.bot.on(`message:document`, this._onMessageDocument.bind(this)) // Handle global document messages
  }
  /** {@inheritDoc Gramstax#_registerOnCallbackQueryData} */
  _registerOnMessageAnimation() {
    this.bot.on(`message:animation`, this._onMessageAnimation.bind(this)) // Handle global animation messages
  }
  /** {@inheritDoc Gramstax#_registerOnCallbackQueryData} */
  _registerOnMessageVoice() {
    this.bot.on(`message:voice`, this._onMessageVoice.bind(this)) // Handle global voice messages
  }
  /** {@inheritDoc Gramstax#_registerOnCallbackQueryData} */
  _registerOnMessageVideoNote() {
    this.bot.on(`message:video_note`, this._onMessageVideoNote.bind(this)) // Handle global video note messages
  }
  /** {@inheritDoc Gramstax#_registerOnCallbackQueryData} */
  _registerOnMessageSticker() {
    this.bot.on(`message:sticker`, this._onMessageSticker.bind(this)) // Handle global sticker messages
  }
  /** {@inheritDoc Gramstax#_registerOnCallbackQueryData} */
  _registerOnMessageLocation() {
    this.bot.on(`message:location`, this._onMessageLocation.bind(this)) // Handle global location messages
  }
  /** {@inheritDoc Gramstax#_registerOnCallbackQueryData} */
  _registerOnMessageContact() {
    this.bot.on(`message:contact`, this._onMessageContact.bind(this)) // Handle global contact messages
  }
}
