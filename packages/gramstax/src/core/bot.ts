import { Ctx } from "./ctx"
import { serve } from "bun"
import { join, parse } from "node:path"
import { PageManager } from "~/page/manager"
import { CacheExternal } from "~/cache/external"
import { LoggingPretty } from "logging-pretty"
import { TemplateManager } from "~/template/manager"
import { Bot, webhookCallback, type BotError, type Context } from "grammy"
import type { UserFromGetMe } from "grammy/types"

export class Gramstax<ICtx extends Ctx = Ctx> {
  public templateManager: TemplateManager
  public cacheKeyboard: Map<any, any>
  public cacheSession: CacheExternal
  public pages: ReturnType<typeof this.pageLoads>
  public log: LoggingPretty | undefined
  public bot: Bot

  public handlerBotUpdate: any

  public constructor(params: { token: string; deploy: string; log?: LoggingPretty | boolean | null; cacheData?: CacheExternal; cacheSession?: CacheExternal; cacheKeyboard?: Map<any, any>; templateManager?: TemplateManager }) {
    if (!params?.token || params?.token?.length == 0) {
      throw new Error(`Token is not valid or empty`)
    }

    this.log = params.log === true ? new LoggingPretty() : !params.log ? undefined : params.log
    this.cacheSession = params.cacheSession || new CacheExternal(`memory`, `session`)
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

  public onCatch(error: BotError<Context>) {
    this.log?.error?.(`[Bot.catch]: ${JSON.stringify(error, null, 2)}`)
  }

  public async onStart(botInfo: UserFromGetMe, method: `polling` | `webhook` | `serverless`, data: string | null) {
    await this.executeSyncTagDescription(this.pages)

    const { username } = botInfo
    this.log?.success?.(`Telegram bot polling started: ${username} ${method == `webhook` || method == `serverless` ? `(${data})` : ``}`)
  }

  public createBot(token: string) {
    return new Bot(token)
  }

  public createCtx(ct: Context): ICtx {
    return new Ctx({
      ct,
      cacheSession: this.cacheSession,
      cacheKeyboard: this.cacheKeyboard,
      templateManager: this.templateManager,
      temp: {
        session: {},
        data: {}
      }
    }) as any
  }

  public runPolling(): void {
    this.bot.start({
      onStart: (botInfo) => {
        this.onStart(botInfo, `polling`, null)
      }
    })
  }

  public async runWebhook(fullUrl: string): Promise<void> {
    const handleUpdate = webhookCallback(this.bot, `bun`)
    this.handlerBotUpdate = handleUpdate

    const pathUrl = new URL(fullUrl).pathname

    serve({
      fetch(req) {
        const { pathname } = new URL(req.url)
        if (req.method == `POST` && pathname == pathUrl) {
          return handleUpdate(req)
        }

        if (req.method == `GET` && pathname == `/`) {
          const timestamp = new Date().toISOString()
          return new Response(JSON.stringify({ status: `OK`, timestamp }), {
            status: 200,
            headers: { "Content-Type": `application/json` }
          })
        }
        return new Response(`Not found`, { status: 404 })
      }
    })

    const data = await this.bot.api.getWebhookInfo()
    if (data.url != fullUrl) {
      await this.bot.api.setWebhook(fullUrl)
    }

    const botInfo = await this.bot.api.getMe()
    await this.onStart(botInfo, `webhook`, fullUrl)
  }

  public async runServerless(adapter: string): Promise<void> {
    this.handlerBotUpdate = webhookCallback(this.bot, adapter as any)
    const botInfo = await this.bot.api.getMe()
    await this.onStart(botInfo, `serverless`, adapter)
  }

  public pageBuildData(Page: typeof Ctx, filePath: string): void {
    if (Page?.data === undefined) {
      Page.data = Page.buildData() as any
    }
    Page.data.name = parse(filePath).name
  }

  public pageSorts(Page: typeof Ctx, pages: typeof this.pages): void {
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

      const ps = pages.routeStatic[routeName as keyof typeof pages.routeStatic]
      const psi = pages.routeStaticIntent[routeName as keyof typeof pages.routeStaticIntent]
      const pss = pages.routeStaticSession[routeName as keyof typeof pages.routeStaticSession]

      const value = { name, routeName }
      const p = ps || psi
      if (p !== undefined) {
        const _isCommand = routeName.includes(partCommand)
        const _name = _isCommand ? `/${name}` : name
        p[proto.intent(_name, routeName.startsWith(`callback`))] = value
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

  public async executeSyncTagDescription(pages: typeof this.pages) {
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
        const commands: Array<{ command: string; description: string }> = []
        for (const [, page] of Object.entries(allCommands)) {
          const name = page.name
          // Use getDescription which handles fallback logic
          const desc = this.templateManager.getDescription(name, `default`, lang, scope)
          if (desc) {
            commands.push({ command: name, description: desc })
          }
        }

        if (commands.length === 0) {
          continue
        }

        // 3. Sync with Telegram
        const scopeObj = { type: scope } as any
        const langCode = lang === `default` ? undefined : lang
        try {
          const current = await this.bot.api.getMyCommands({ scope: scopeObj, language_code: langCode as any })
          const currentJSON = JSON.stringify(current.map((c) => ({ command: c.command, description: c.description })).sort((a, b) => a.command.localeCompare(b.command)))
          const desiredJSON = JSON.stringify(commands.sort((a, b) => a.command.localeCompare(b.command)))

          if (currentJSON !== desiredJSON) {
            await this.bot.api.setMyCommands(commands, { scope: scopeObj, language_code: langCode as any })
            this.log?.info?.(`Synced descriptions for scope: ${scope},${langCode ? ` lang: ${langCode},` : ``} total (${commands.length})`)
          }
        } catch (error) {
          this.log?.error?.(`Failed to sync descriptions for scope: ${scope},${langCode ? ` lang: ${langCode},` : ``} error: ${String(error)}`)
        }
      }
    }
  }

  public pageLoads() {
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
      `voiceCaptionCommand`,
      // videoNote
      `videoNoteCaption`,
      `videoNoteCaptionCommand`
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
      `voiceCaptionCommandPayload`,
      // video note
      `videoNoteCaptionPayload`,
      `videoNoteCaptionCommandPayload`
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

    const makeObject = <const T extends readonly string[], V extends () => any>(keys: T, val: V): { [K in T[number]]: ReturnType<V> } => Object.fromEntries(keys.map((k) => [k, val()])) as { [K in T[number]]: ReturnType<V> }
    const initDynamicSpesific = () => [] as { name: string; routeName: string }[] // [0]{name: Page.data.name, routeName: routeFunctionName}

    const pages = {
      all: {} as Record<string, typeof Ctx>, // [page.data.name]: Classes Page
      routeDynamic: [] as string[], // [Page]{ free: (...) => ... }
      routeDynamicSpesific: {
        text: initDynamicSpesific(), // text: []{name: Page.data.name, routeName:routeFunctionName}
        photo: initDynamicSpesific(), // photo: []{name: Page.data.name, routeName:routeFunctionName}
        video: initDynamicSpesific(), // video: []{name: Page.data.name, routeName:routeFunctionName}
        audio: initDynamicSpesific(), // audio: []{name: Page.data.name, routeName:routeFunctionName}
        document: initDynamicSpesific(), // document: []{name: Page.data.name, routeName:routeFunctionName}
        animation: initDynamicSpesific(), // animation: []{name: Page.data.name, routeName:routeFunctionName}
        voice: initDynamicSpesific(), // voice: []{name: Page.data.name, routeName:routeFunctionName}
        videoNote: initDynamicSpesific(), // videoNote: []{name: Page.data.name, routeName:routeFunctionName}
        sticker: initDynamicSpesific(), // sticker: []{name: Page.data.name, routeName:routeFunctionName}
        location: initDynamicSpesific(), // location: []{name: Page.data.name, routeName:routeFunctionName}
        contact: initDynamicSpesific() // contact: []{name: Page.data.name, routeName:routeFunctionName}
      },
      routeStatic: makeObject(listRouteStatic, () => ({} as Record<string, { name: string; routeName: string }>)), // [page.data.name]: {name: Page.data.name, routeName: routeFunctionName}
      routeStaticIntent: makeObject(listRouteStaticIntent, () => ({} as Record<string, { name: string; routeName: string }>)), // [intent]: {name: Page.data.name, routeName: routeFunctionName}
      routeStaticSession: makeObject(listRouteStaticSession, () => ({} as Record<string, { name: string; routeName: string }>)), // [session.method]: {name: Page.data.name, routeName: routeFunctionName}
      listRouteStatic,
      listRouteStaticIntent,
      listRouteStaticSession,
      lenListRouteStatic: listRouteStatic.length,
      lenListRouteStaticIntent: listRouteStaticIntent.length,
      lenListRouteStaticSession: listRouteStaticSession.length
    }

    PageManager.getFileManySync(undefined, true).forEach(({ path, page }) => {
      this.pageBuildData(page, path) // create if not exist and set name (without ext) according filePath
      this.pageSorts(page, pages) // sort route method
    })

    this.log?.info?.(`Finish load pages with total (${Object.keys(pages.all).length})`)
    return pages
  }

  public async pageRoutes(ctx: ICtx, fromListener: `callback` | keyof typeof this.pages.routeDynamicSpesific): Promise<any> {
    // to be reassigned
    let Page: typeof Ctx | undefined
    let res: { name: string; routeName: string } | undefined

    /**
     * id = 1
     * type = static
     * algoritme = O(1)
     * example = animationCaption, callback, textCommand
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

        if (res) {
          break
        }
      }

      if (res !== undefined) {
        Page = this.pages.all[res.name]
      }
    }

    /**
     * id = 2
     * type = staticSession
     * algoritme = x = session method; O(x)
     * example = animationCaption, callback, textCommand
     */
    if (Page === undefined) {
      const session = await ctx.sessionGet()
      if (session) {
        const mtd = session.method
        const pStaticSession = this.pages.routeStaticSession

        for (let index = 0; index < this.pages.lenListRouteStaticSession; index++) {
          const routeName = this.pages.listRouteStaticSession[index] as `animationCaption`
          if (routeName.startsWith(fromListener)) {
            res = pStaticSession[routeName][mtd]
          }

          if (res) {
            break
          }
        }

        if (res !== undefined) {
          Page = this.pages.all[res.name]
        }
      }
    }

    /**
     * id = 3
     * type = staticIntent
     * algoritme = x = startsWith; O(x)
     * example = animationCaptionCommandPayload, callbackCommandPayload, textCommandPayload
     */
    if (Page === undefined) {
      const cdi = ctx.callbackDataIntent
      const mti = ctx.msgTextIntent
      const mci = ctx.msgCaptionIntent
      const pStaticIntent = this.pages.routeStaticIntent

      for (let index = 0; index < this.pages.lenListRouteStaticIntent; index++) {
        const routeName = this.pages.listRouteStaticIntent[index] as `animationCaptionCommandPayload`
        if (routeName.startsWith(fromListener)) {
          res = pStaticIntent[routeName][cdi || mti || mci]
        }

        if (res) {
          break
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
      return initRoute
    }

    /**
     * id = 4
     * type = dynamicSpesific
     * algoritme = O(n)
     * example = animationFree, textFree
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
      if (!Page.prototype[value.routeName as keyof typeof Page.prototype]) {
        continue
      }

      const initPage = new Page(ctx) as any
      const initRoute = await initPage[value.routeName]?.()
      if (initRoute !== null) {
        return initRoute // stop when return not null
      }
    }

    /**
     * id = 5
     * type = dynamic
     * algoritme = O(n)
     * example = free
     * note = global fallback (only 1 route function can init)
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
      if (!Page.prototype.free) {
        continue
      }

      const initPage = new Page(ctx)
      const initRoute = await initPage.free?.()
      if (initRoute !== null) {
        return initRoute // stop when return not null
      }
    }

    return null
  }

  public async hookBeforeRoute(ctx: ICtx, listenerName: string): Promise<boolean> {
    // must be override
    if (ctx || listenerName) {
      return true
    }
    return false
  }

  public async hookErrorPage(ctx: ICtx, listenerName: string, error: any, isEdit: boolean): Promise<void> {
    // must be override
    if (ctx || listenerName || error || isEdit) {
      return
    }
  }

  public async hookErrorInputNotFoundPage(ctx: ICtx): Promise<void> {
    // must be override
    if (ctx) {
      return
    }
  }

  public async onMessage(ct: Context, listenerName: keyof typeof this.pages.routeDynamicSpesific): Promise<void> {
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

  public async onCallbackQueryData(ct: Context): Promise<void> {
    const ctx = this.createCtx(ct)
    try {
      // answer callback query first for fast response
      await ctx.callbackQueryAnswer()
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

  public async onMessageText(ct: Context): Promise<void> {
    await this.onMessage(ct, `text`)
  }

  public async onMessagePhoto(ct: Context): Promise<void> {
    await this.onMessage(ct, `photo`)
  }

  public async onMessageVideo(ct: Context): Promise<void> {
    await this.onMessage(ct, `video`)
  }

  public async onMessageAudio(ct: Context): Promise<void> {
    await this.onMessage(ct, `audio`)
  }

  public async onMessageDocument(ct: Context): Promise<void> {
    await this.onMessage(ct, `document`)
  }

  public async onMessageAnimation(ct: Context): Promise<void> {
    await this.onMessage(ct, `animation`)
  }

  public async onMessageVoice(ct: Context): Promise<void> {
    await this.onMessage(ct, `voice`)
  }

  public async onMessageVideoNote(ct: Context): Promise<void> {
    await this.onMessage(ct, `videoNote`)
  }

  public async onMessageSticker(ct: Context): Promise<void> {
    await this.onMessage(ct, `sticker`)
  }

  public async onMessageLocation(ct: Context): Promise<void> {
    await this.onMessage(ct, `location`)
  }

  public async onMessageContact(ct: Context): Promise<void> {
    await this.onMessage(ct, `contact`)
  }

  public registerOnCallbackQueryData() {
    this.bot.on(`callback_query:data`, this.onCallbackQueryData.bind(this)) // Handle callback queries from inline keyboards
  }

  public registerOnMessageText() {
    this.bot.on(`message:text`, this.onMessageText.bind(this)) // Handle global text messages
  }

  public registerOnMessagePhoto() {
    this.bot.on(`message:photo`, this.onMessagePhoto.bind(this)) // Handle global photo messages
  }

  public registerOnMessageVideo() {
    this.bot.on(`message:video`, this.onMessageVideo.bind(this)) // Handle global video messages
  }

  public registerOnMessageAudio() {
    this.bot.on(`message:audio`, this.onMessageAudio.bind(this)) // Handle global audio messages
  }

  public registerOnMessageDocument() {
    this.bot.on(`message:document`, this.onMessageDocument.bind(this)) // Handle global document messages
  }

  public registerOnMessageAnimation() {
    this.bot.on(`message:animation`, this.onMessageAnimation.bind(this)) // Handle global animation messages
  }

  public registerOnMessageVoice() {
    this.bot.on(`message:voice`, this.onMessageVoice.bind(this)) // Handle global voice messages
  }

  public registerOnMessageVideoNote() {
    this.bot.on(`message:video_note`, this.onMessageVideoNote.bind(this)) // Handle global video note messages
  }

  public registerOnMessageSticker() {
    this.bot.on(`message:sticker`, this.onMessageSticker.bind(this)) // Handle global sticker messages
  }

  public registerOnMessageLocation() {
    this.bot.on(`message:location`, this.onMessageLocation.bind(this)) // Handle global location messages
  }

  public registerOnMessageContact() {
    this.bot.on(`message:contact`, this.onMessageContact.bind(this)) // Handle global contact messages
  }
}
