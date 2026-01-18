import {Ctx} from "./ctx"
import {log} from "~/utils/log"
import {join, dirname, parse} from "node:path"
import {readFileSync} from "node:fs"
import {fileURLToPath} from "node:url"
import {PageManager} from "~/page/manager"
import type {LoggingPretty} from "logging-pretty"
import {TemplateManager} from "~/template/manager"
import {Bot, webhookCallback, type BotError, type Context} from "grammy"
import type {UserFromGetMe} from "grammy/types"
import {CacheExternal, ICacheRpc} from "~/cache/external"

const ___filename = (() => {
  try {
    return __filename
  } catch {
    return fileURLToPath(import.meta.url)
  }
})()
const __dirname = dirname(___filename)
const __PKG_VERSION__ = JSON.parse(readFileSync(join(__dirname, `../../package.json`), `utf-8`)).version as string

export class Gramstax<ICtx extends Ctx = Ctx> {
  templateManager: TemplateManager
  cacheKeyboard: Map<any, any>
  cacheSession: CacheExternal<ICacheRpc>
  pages: ReturnType<typeof this.pageLoads>
  optionsPage = {
    shortCallbackData: false
  }
  log: LoggingPretty | undefined
  bot: Bot

  handlerBotUpdate: any

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
    this.bot.catch(this.onCatch)
    this.registerOnCallbackQueryData() // Handle callback queries from inline keyboards
    this.registerOnMessageText() // Handle global text messages
    this.registerOnMessagePhoto() // Handle global photo messages
    this.registerOnMessageVideo() // Handle global video messages
    this.registerOnMessageAudio() // Handle global audio messages
    this.registerOnMessageDocument() // Handle global document messages
    this.registerOnMessageAnimation() // Handle global animation messages
    this.registerOnMessageVoice() // Handle global voice messages
    this.registerOnMessageVideoNote() // Handle global video note messages
    this.registerOnMessageSticker() // Handle global sticker messages
    this.registerOnMessageLocation() // Handle global location messages
    this.registerOnMessageContact() // Handle global contact messages

    // Default for customize (very rarely used)
    this.handlerBotUpdate = this.bot.handleUpdate

    // Load pages AFTER templateManager is initialized
    this.pages = this.pageLoads()

    // Graceful shutdown
    process.once(`SIGINT`, () => this.bot.stop())
    process.once(`SIGTERM`, () => this.bot.stop())

    this.hookBeforeStart()
    if (params.deploy.startsWith(`polling`)) {
      this.runPolling()
    } else if (params.deploy.startsWith(`webhook:`)) {
      this.runWebhook(params.deploy.split(`webhook:`)[1] as string)
    } else if (params.deploy.startsWith(`serverless:`)) {
      this.runServerless(params.deploy.split(`serverless:`)[1] as string)
    } else if (params.deploy.startsWith(`test`)) {
      // nothing, for test unit internal area
    } else {
      throw new Error(`Params deploy is not valid, expected: polling, webhook:<public-url>, serverless:<your-adapter>`)
    }
  }

  onCatch(error: BotError<Context>) {
    if ((this.log as any)?.errorMake) {
      ;(this.log as any)?.errorMake(error, `Bot`, `catch`)
    } else {
      const err = JSON.stringify(error, null, 2)
      this.log?.error?.(`[Bot.catch]: ${err}`)
    }
  }

  hookBeforeStart() {}
  hookAfterStart() {}
  async onStart(botInfo: UserFromGetMe, method: `polling` | `webhook` | `serverless`, data: string | null) {
    await this.executeSyncBlocksDescription(this.pages)

    const {username} = botInfo
    this.log?.success?.(`Telegram bot polling started: ${username} ${method == `webhook` || method == `serverless` ? `(${data})` : ``}`)
    this.hookAfterStart()
  }

  createBot(token: string) {
    return new Bot(token)
  }

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

  runPolling(): void {
    this.bot.start({
      onStart: (botInfo) => {
        this.onStart(botInfo, `polling`, null)
      }
    })
  }

  async runWebhook(fullUrl: string): Promise<void> {
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
    await this.onStart(botInfo, `webhook`, fullUrl)
  }

  async runServerless(adapter: string): Promise<void> {
    this.handlerBotUpdate = webhookCallback(this.bot, adapter as any)
    const botInfo = await this.bot.api.getMe()
    await this.onStart(botInfo, `serverless`, adapter)
  }

  pageBuildData(Page: typeof Ctx, filePath: string): void {
    if (Page?.data === undefined) {
      Page.data = Page.buildData() as any
    }
    const name = parse(filePath).name
    Page.data.name = name
    if (!Page.data.intentText) Page.data.intentText = name
    if (!Page.data.intentTextCommand) Page.data.intentTextCommand = name
    if (!Page.data.intentCallback) Page.data.intentCallback = name
  }

  pageSorts(Page: typeof Ctx, pages: typeof this.pages, indexPage: number): void {
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

  async executeSyncBlocksDescription(pages: typeof this.pages) {
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

  pageLoads() {
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
      this.pageBuildData(page, path) // create if not exist and set name (without ext) according filePath
      this.pageSorts(page, pages, index) // sort route method
      page.template = undefined // delete template for efficient memory
    })

    this.log?.info?.(`Finish load pages with total (${Object.keys(pages.all).length})`)
    return pages
  }

  async pageRoutes(ctx: ICtx, fromListener: `callback` | keyof typeof this.pages.routeDynamicSpesific): Promise<any> {
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

  async hookBeforeRoute(ctx: ICtx, listenerName: string): Promise<boolean> {
    // must be override
    if (ctx || listenerName) {
      return true
    }
    return false
  }

  async hookErrorPage(ctx: ICtx, listenerName: string, error: any, isEdit: boolean): Promise<void> {
    // must be override
    if (ctx || listenerName || error || isEdit) {
      return
    }
  }

  async hookErrorInputNotFoundPage(ctx: ICtx): Promise<void> {
    // must be override
    if (ctx) {
      return
    }
  }

  async onMessage(ct: Context, listenerName: keyof typeof this.pages.routeDynamicSpesific): Promise<void> {
    const ctx = this.createCtx(ct)
    try {
      const before = await this.hookBeforeRoute(ctx, listenerName)
      if (before === false) {
        return
      }

      const routeResult = await this.pageRoutes(ctx, listenerName)
      if (routeResult === null) {
        await this.hookErrorInputNotFoundPage(ctx)
      }
    } catch (error) {
      await this.hookErrorPage(ctx, listenerName, error, false)
    }
  }

  async onCallbackQueryData(ct: Context): Promise<void> {
    const ctx = this.createCtx(ct)
    try {
      const before = await this.hookBeforeRoute(ctx, `onCallbackQueryData`)
      if (before === false) {
        return
      }

      // Check all route
      await this.pageRoutes(ctx, `callback`)
    } catch (error) {
      await this.hookErrorPage(ctx, `onCallbackQueryData`, error, true)
    }
  }

  async onMessageText(ct: Context): Promise<void> {
    await this.onMessage(ct, `text`)
  }
  async onMessagePhoto(ct: Context): Promise<void> {
    await this.onMessage(ct, `photo`)
  }
  async onMessageVideo(ct: Context): Promise<void> {
    await this.onMessage(ct, `video`)
  }
  async onMessageAudio(ct: Context): Promise<void> {
    await this.onMessage(ct, `audio`)
  }
  async onMessageDocument(ct: Context): Promise<void> {
    await this.onMessage(ct, `document`)
  }
  async onMessageAnimation(ct: Context): Promise<void> {
    await this.onMessage(ct, `animation`)
  }
  async onMessageVoice(ct: Context): Promise<void> {
    await this.onMessage(ct, `voice`)
  }
  async onMessageVideoNote(ct: Context): Promise<void> {
    await this.onMessage(ct, `videoNote`)
  }
  async onMessageSticker(ct: Context): Promise<void> {
    await this.onMessage(ct, `sticker`)
  }
  async onMessageLocation(ct: Context): Promise<void> {
    await this.onMessage(ct, `location`)
  }
  async onMessageContact(ct: Context): Promise<void> {
    await this.onMessage(ct, `contact`)
  }
  registerOnCallbackQueryData() {
    this.bot.on(`callback_query:data`, this.onCallbackQueryData.bind(this)) // Handle callback queries from inline keyboards
  }
  registerOnMessageText() {
    this.bot.on(`message:text`, this.onMessageText.bind(this)) // Handle global text messages
  }
  registerOnMessagePhoto() {
    this.bot.on(`message:photo`, this.onMessagePhoto.bind(this)) // Handle global photo messages
  }
  registerOnMessageVideo() {
    this.bot.on(`message:video`, this.onMessageVideo.bind(this)) // Handle global video messages
  }
  registerOnMessageAudio() {
    this.bot.on(`message:audio`, this.onMessageAudio.bind(this)) // Handle global audio messages
  }
  registerOnMessageDocument() {
    this.bot.on(`message:document`, this.onMessageDocument.bind(this)) // Handle global document messages
  }
  registerOnMessageAnimation() {
    this.bot.on(`message:animation`, this.onMessageAnimation.bind(this)) // Handle global animation messages
  }
  registerOnMessageVoice() {
    this.bot.on(`message:voice`, this.onMessageVoice.bind(this)) // Handle global voice messages
  }
  registerOnMessageVideoNote() {
    this.bot.on(`message:video_note`, this.onMessageVideoNote.bind(this)) // Handle global video note messages
  }
  registerOnMessageSticker() {
    this.bot.on(`message:sticker`, this.onMessageSticker.bind(this)) // Handle global sticker messages
  }
  registerOnMessageLocation() {
    this.bot.on(`message:location`, this.onMessageLocation.bind(this)) // Handle global location messages
  }
  registerOnMessageContact() {
    this.bot.on(`message:contact`, this.onMessageContact.bind(this)) // Handle global contact messages
  }
}
