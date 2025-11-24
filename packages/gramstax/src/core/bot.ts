import { Ctx } from "./ctx"
import { serve } from "bun"
import { join, parse } from "node:path"
import { CacheExternal } from "../cache"
import { LoggingPretty } from "logging-pretty"
import { TemplateManager } from "../template"
import { existsSync, readdirSync } from "node:fs"
import { Bot, webhookCallback, type BotError, type Context } from "grammy"
import type { UserFromGetMe } from "grammy/types"
import { HelperPage } from "../helpers/page"

export class Gramstax<ICtx extends Ctx = Ctx, IBot extends Bot = Bot> {
  public templateManager: TemplateManager
  public cacheKeyboard: Map<any, any>
  public cacheSession: CacheExternal
  public pages: ReturnType<typeof this.pageLoads>
  public log: LoggingPretty | undefined | null
  public bot: IBot

  public constructor(params: { token: string; deploy: string; log?: LoggingPretty; cacheData?: CacheExternal; cacheSession?: CacheExternal; cacheKeyboard?: Map<any, any>; templateManager?: TemplateManager }) {
    if (!params?.token || params?.token?.length == 0) {
      throw new Error(`Token is not valid or empty`)
    }

    this.log = params.log === null ? undefined : params.log === undefined ? new LoggingPretty() : params.log
    this.cacheSession = params.cacheSession || new CacheExternal(`memory`, `session`)
    this.cacheKeyboard = params.cacheKeyboard || new Map()
    this.templateManager =
      params.templateManager ||
      new TemplateManager({
        path: [join(process.cwd(), `src`, `pages`)]
      })

    this.bot = this.createBot(params.token) as any as IBot
    this.bot.catch(this.onCatch)
    this.bot.on(`callback_query:data`, this.onCallbackQueryData.bind(this)) // Handle callback queries from inline keyboards
    this.bot.on(`message:text`, this.onMessageText.bind(this)) // Handle global text messages
    this.bot.on(`message:photo`, this.onMessagePhoto.bind(this)) // Handle global photo messages
    this.bot.on(`message:video`, this.onMessageVideo.bind(this)) // Handle global video messages
    this.bot.on(`message:audio`, this.onMessageAudio.bind(this)) // Handle global audio messages
    this.bot.on(`message:document`, this.onMessageDocument.bind(this)) // Handle global document messages
    this.bot.on(`message:animation`, this.onMessageAnimation.bind(this)) // Handle global animation messages
    this.bot.on(`message:voice`, this.onMessageVoice.bind(this)) // Handle global voice messages
    this.bot.on(`message:video_note`, this.onMessageVideoNote.bind(this)) // Handle global video note messages
    this.bot.on(`message:sticker`, this.onMessageSticker.bind(this)) // Handle global sticker messages
    this.bot.on(`message:location`, this.onMessageLocation.bind(this)) // Handle global location messages
    this.bot.on(`message:contact`, this.onMessageContact.bind(this)) // Handle global contact messages

    // Load pages AFTER templateManager is initialized
    this.pages = this.pageLoads()

    // Graceful shutdown
    process.once(`SIGINT`, () => this.bot.stop())
    process.once(`SIGTERM`, () => this.bot.stop())

    if (params.deploy.startsWith(`polling`)) {
      this.runPolling()
    } else if (params.deploy.startsWith(`webhook`)) {
      this.runWebhook(params.deploy.split(`webhook:`)[1] as string)
    }
  }

  public onCatch(error: BotError<Context>) {
    this.log?.error?.(`[Bot.catch]: ${String(error)}`)
  }

  public onStart(botInfo: UserFromGetMe, method: `polling` | `webhook`, data: string | null) {
    const { username } = botInfo
    if (method == `polling`) {
      this.log?.success?.(`Telegram bot polling started: ${username}`)
    } else {
      this.log?.success?.(`Telegram bot webhook started: ${username} (${data})`)
    }
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
        const _name = func.includes(partCommand) ? `/${name}` : name
        p[proto.buildIntent(_name, func.startsWith(`callback`))] = value
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

  public pageLoads() {
    this.log?.info?.(`Load pages..`)

    const path = join(process.cwd(), `src`, `pages`)
    if (!existsSync(path)) {
      throw new Error(`Directory ${path} is not found, please make it manually`)
    }

    const files = readdirSync(path)
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
      all: {} as Record<string, typeof Ctx>, // (classes) all Page
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

    for (const file of files) {
      const filePath = join(path, file)
      const Page = HelperPage.getPageSync(filePath, true)

      // create if not exist and set name (without ext) according filePath
      this.pageBuildData(Page, filePath)

      // sort route method
      this.pageSorts(Page, pages)
    }

    this.log?.info?.(`Finish load pages with total (${Object.keys(pages.all).length})`)
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
}
