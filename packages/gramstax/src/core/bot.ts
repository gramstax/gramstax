import { Ctx } from "./ctx"
import { serve } from "bun"
import { HelperPage } from "../helpers/page"
import { join, parse } from "node:path"
import { CacheExternal } from "../cache"
import { LoggingPretty } from "logging-pretty"
import { TemplateManager } from "../template"
import { Bot, webhookCallback, type BotError, type Context } from "grammy"
import type { UserFromGetMe } from "grammy/types"

type IDeploy = `polling` | `webhook:http://${string}` | `webhook:https://${string}` | `serverless:${string}`

export class Gramstax<ICtx extends Ctx = Ctx, IBot extends Bot = Bot> {
  public templateManager: TemplateManager
  public cacheKeyboard: Map<any, any>
  public cacheSession: CacheExternal
  public pages: ReturnType<typeof this.pageLoads>
  public log: LoggingPretty | undefined
  public bot: IBot

  public handlerBotUpdate: any

  public constructor(params: { token: string; deploy: IDeploy; log?: LoggingPretty | boolean | null; cacheData?: CacheExternal; cacheSession?: CacheExternal; cacheKeyboard?: Map<any, any>; templateManager?: TemplateManager }) {
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

    this.bot = this.createBot(params.token) as any as IBot
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
    }
  }

  public onCatch(error: BotError<Context>) {
    this.log?.error?.(`[Bot.catch]: ${String(error)}`)
  }

  public onStart(botInfo: UserFromGetMe, method: `polling` | `webhook` | `serverless`, data: string | null) {
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

  public async runPolling() {
    this.bot.start({
      onStart: async (botInfo) => {
        this.onStart(botInfo, `polling`, null)
      }
    })
  }

  public async runWebhook(baseUrl: string) {
    const handleUpdate = webhookCallback(this.bot, `bun`)
    const pathWebhook = `/telegram-webhook`

    this.handlerBotUpdate = handleUpdate

    serve({
      fetch(req) {
        const { pathname } = new URL(req.url)
        if (pathname === pathWebhook) {
          if (req.method === `POST`) {
            return handleUpdate(req as any)
          }
          return new Response(`OK`, { status: 200 })
        }

        if (pathname === `/` && req.method === `GET`) {
          const timestamp = new Date().toISOString()
          return new Response(JSON.stringify({ timestamp }), {
            status: 200,
            headers: { "Content-Type": `application/json` }
          })
        }

        // Jika tidak cocok
        return new Response(`Not found`, { status: 404 })
      }
    })

    const data = await this.bot.api.getWebhookInfo()
    const webhookUrl = baseUrl.endsWith(`/`) ? baseUrl.slice(0, -1) + pathWebhook : baseUrl + pathWebhook
    if (data.url != webhookUrl) {
      await this.bot.api.setWebhook(webhookUrl)
    }

    const botInfo = await this.bot.api.getMe()
    this.onStart(botInfo, `webhook`, webhookUrl)
  }

  public async runServerless(adapter: string) {
    this.handlerBotUpdate = webhookCallback(this.bot, adapter as any)
    const botInfo = await this.bot.api.getMe()
    this.onStart(botInfo, `serverless`, adapter)
  }

  public pageBuildData(Page: typeof Ctx, filePath: string) {
    if (Page?.data === undefined) {
      Page.data = Page.buildData()
    }
    Page.data.name = parse(filePath).name
  }

  public pageSorts(Page: typeof Ctx, pages: typeof this.pages) {
    const name = Page.data.name
    const proto = Page.prototype

    const partPayload = `Payload`
    const partCommand = `Command`
    const partCaption = `Caption`
    const partFree = `Free`

    const pd = pages.dynamic
    const pds = pages.dynamicSpesific

    const upFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
    const getPureFuncName = (func: string) => func.replace(partPayload, ``).replace(partCommand, ``).replace(partCaption, ``).replace(partFree, ``)
    const methodSession = (func: string, name: any) => (proto as any)[`methodSession${upFirst(func)}`](name)

    // all
    pages.all[name] = Page

    for (let index = 0; index < pages.lenListFuncStaticSession; index++) {
      const func = pages.listFuncStaticSession[index] as string

      const ps = pages.static[func as keyof typeof pages.static]
      const psi = pages.staticIntent[func as keyof typeof pages.staticIntent]
      const pss = pages.staticSession[func as keyof typeof pages.staticSession]

      const value = { name, func } as any
      const p = ps || psi
      if (p !== undefined) {
        const _isCommand = func.includes(partCommand)
        const _name = _isCommand ? `/${name}` : name
        p[proto.intent(_name, func.startsWith(`callback`))] = value
      }

      // staticSession
      if (pss !== undefined) {
        pss[methodSession(func, name)] = value
      }

      // dynamicStatic
      if (func.toLowerCase().endsWith(`free`)) {
        pds[getPureFuncName(func) as keyof typeof pds].push(value)
      }
    }

    // all
    if (proto.free) {
      pd.push(name)
    }
  }

  public async pageSyncDescription(pages: typeof this.pages) {
    // 1. Collect all unique (scope, language) pairs
    const targets = new Map<string, Set<string>>() // scope -> Set<language>

    const allCommands = pages.static.textCommand
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

        if (commands.length === 0) continue

        // 3. Sync with Telegram
        const scopeObj = { type: scope } as any
        const langCode = lang === `default` ? undefined : lang

        try {
          const current = await this.bot.api.getMyCommands({ scope: scopeObj, language_code: langCode as any })
          const currentJSON = JSON.stringify(current.map((c) => ({ command: c.command, description: c.description })).sort((a, b) => a.command.localeCompare(b.command)))
          const desiredJSON = JSON.stringify(commands.sort((a, b) => a.command.localeCompare(b.command)))

          if (currentJSON !== desiredJSON) {
            await this.bot.api.setMyCommands(commands, { scope: scopeObj, language_code: langCode as any })
            this.log?.info?.(`Synced descriptions for scope: ${scope},${langCode ? ` lang: ${langCode}` : ``} (Total: ${commands.length})`)
          }
        } catch (error) {
          this.log?.error?.(`Failed to sync descriptions for scope: ${scope},${langCode ? ` lang: ${langCode}` : ``}. ${String(error)}`)
        }
      }
    }
  }

  public pageLoads() {
    this.log?.info?.(`Load pages..`)

    const initStatic = {} as Record<string, { name: string; func: string }> // { [page.data.name]: { name: Page.data.name, func: routeFunctionName } }
    const initStaticIntent = initStatic // { [intent]: { name: page.data.name, func: routeFunctionName } }
    const initStaticSession = initStatic // { [session.method]: { name: page.data.name, func: routeFunctionName } }
    const initDynamicSpesific = [] as { name: string; func: string }[] //

    const listFuncStatic = [
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
    const listFuncStaticIntent = [
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
    const listFuncStaticSession = [
      ...listFuncStatic,
      ...listFuncStaticIntent,
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

    const makeObject = <const T extends readonly string[], V>(keys: T, val: V): { [K in T[number]]: V } => Object.fromEntries(keys.map((k) => [k, { ...val }])) as { [K in T[number]]: V }

    const pages = {
      all: {} as Record<string, typeof Ctx>, // { [page.data.name]: classes }. (classes) all Page
      dynamic: [] as string[], // (dynamic) all Page function free
      dynamicSpesific: {
        text: initDynamicSpesific,
        photo: initDynamicSpesific,
        video: initDynamicSpesific,
        audio: initDynamicSpesific,
        document: initDynamicSpesific,
        animation: initDynamicSpesific,
        voice: initDynamicSpesific,
        videoNote: initDynamicSpesific,
        sticker: initDynamicSpesific,
        location: initDynamicSpesific,
        contact: initDynamicSpesific
      },
      static: makeObject(listFuncStatic, initStatic),
      staticIntent: makeObject(listFuncStaticIntent, initStaticIntent),
      staticSession: makeObject(listFuncStaticSession, initStaticSession),
      listFuncStatic,
      listFuncStaticIntent,
      listFuncStaticSession,
      lenListFuncStatic: listFuncStatic.length,
      lenListFuncStaticIntent: listFuncStaticIntent.length,
      lenListFuncStaticSession: listFuncStaticSession.length
    }

    HelperPage.getPagesSync(undefined, true).forEach(({ path, page }) => {
      this.pageBuildData(page, path) // create if not exist and set name (without ext) according filePath
      this.pageSorts(page, pages) // sort route method
    })

    this.log?.info?.(`Finish load pages with total (${Object.keys(pages.all).length})`)

    this.pageSyncDescription(pages)
    return pages
  }

  public async pageRoutes(ctx: ICtx, fromListener: `callback` | keyof typeof this.pages.dynamicSpesific): Promise<any | null> {
    // to be reassigned
    let Page: typeof Ctx | undefined
    let res: { name: string; func: string } | undefined

    // (static) priority O(1)
    if (Page === undefined) {
      const cd = ctx.callbackData
      const mt = ctx.msgText
      const mc = ctx.msgCaption
      const ps = this.pages.static

      for (let index = 0; index < this.pages.lenListFuncStatic; index++) {
        const funcName = this.pages.listFuncStatic[index] as `animationCaption`
        res = ps[funcName][cd || mt || mc]
        if (res) {
          break
        }
      }

      if (res !== undefined) {
        Page = this.pages.all[res.name]
      }
    }

    // (staticSession) x = method; O(x)
    if (Page === undefined) {
      const session = await ctx.sessionGet()
      if (session) {
        const mtd = session.method
        const pss = this.pages.staticSession

        for (let index = 0; index < this.pages.lenListFuncStaticSession; index++) {
          const funcName = this.pages.listFuncStaticSession[index] as `animationCaption`
          res = pss[funcName][mtd]
          if (res) {
            break
          }
        }

        if (res !== undefined) {
          Page = this.pages.all[res.name]
        }
      }
    }

    // (staticIntent) x = startsWith; O(x)
    if (Page === undefined) {
      const cdi = ctx.callbackDataIntent
      const mti = ctx.msgTextIntent
      const mci = ctx.msgCaptionIntent
      const psi = this.pages.staticIntent

      for (let index = 0; index < this.pages.lenListFuncStaticIntent; index++) {
        const funcName = this.pages.listFuncStaticIntent[index] as `animationCaptionCommandPayload`
        res = psi[funcName][cdi || mti || mci]
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
      const initPage = new Page(ctx)
      const initRoute = await initPage[res.func as keyof typeof initPage]?.()
      return initRoute
    }

    // (dynamicSpesific) O(n)
    const arrFree = this.pages.dynamicSpesific[fromListener as keyof typeof this.pages.dynamicSpesific] || []
    for (let index = 0; index < arrFree.length; index++) {
      const value = arrFree[index]
      if (value === undefined) {
        continue
      }

      const Page = this.pages.all[value.func]
      if (Page === undefined) {
        continue
      }

      const initPage = new Page(ctx)
      const initRoute = await initPage[value.name as keyof typeof initPage]?.()
      // const initRoute = await initPage.route(value.name)
      if (initRoute !== null) {
        return initRoute // stop when return not null
      }
    }

    // (dynamic) O(n)
    for (let index = 0; index < this.pages.dynamic.length; index++) {
      const value = this.pages.dynamic[index]
      if (value === undefined) {
        continue
      }

      const Page = this.pages.all[value]
      if (Page === undefined) {
        continue
      }

      const initPage = new Page(ctx)
      const initRoute = await initPage.free?.()
      // const initRoute = await initPage.route(`free`)
      if (initRoute !== null) {
        return initRoute // stop when return not null
      }
    }

    return null
  }

  public async hookBeforeRoute(ctx: ICtx, listenerName: string) {
    // must be override
    return true
  }

  public async hookErrorPage(ctx: ICtx, listenerName: string, error: any, isEdit: boolean) {
    // must be override
    return
  }

  public async hookErrorInputNotFoundPage(ctx: ICtx) {
    // must be override
    return
  }

  public async onMessage(ct: Context, listenerName: string): Promise<void> {
    const ctx = this.createCtx(ct)
    try {
      const before = await this.hookBeforeRoute(ctx, listenerName)
      if (before === false) {
        return
      }

      const route = await this.pageRoutes(ctx, listenerName as any)
      if (route === null) {
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
    await this.onMessage(ct, `onMessageText`)
  }

  public async onMessagePhoto(ct: Context): Promise<void> {
    await this.onMessage(ct, `onMessagePhoto`)
  }

  public async onMessageVideo(ct: Context): Promise<void> {
    await this.onMessage(ct, `onMessageVideo`)
  }

  public async onMessageAudio(ct: Context): Promise<void> {
    await this.onMessage(ct, `onMessageAudio`)
  }

  public async onMessageDocument(ct: Context): Promise<void> {
    await this.onMessage(ct, `onMessageDocument`)
  }

  public async onMessageAnimation(ct: Context): Promise<void> {
    await this.onMessage(ct, `onMessageAnimation`)
  }

  public async onMessageVoice(ct: Context): Promise<void> {
    await this.onMessage(ct, `onMessageVoice`)
  }

  public async onMessageVideoNote(ct: Context): Promise<void> {
    await this.onMessage(ct, `onMessageVideoNote`)
  }

  public async onMessageSticker(ct: Context): Promise<void> {
    await this.onMessage(ct, `onMessageSticker`)
  }

  public async onMessageLocation(ct: Context): Promise<void> {
    await this.onMessage(ct, `onMessageLocation`)
  }

  public async onMessageContact(ct: Context): Promise<void> {
    await this.onMessage(ct, `onMessageContact`)
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
