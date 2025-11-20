import { setTimeout } from "node:timers/promises"
import { BaseGeneral } from "../base"
import { CacheExternal } from "../cache"
import { IMediaBlock, TemplateManager } from "../template"
import { InlineKeyboard, Keyboard, type Context } from "grammy"

type IData = { name: string; callbackData: (...args: any) => string | any }
type ITemp = { session: { method?: string; params?: any }; data: Partial<IData>; [key: string]: any }

export class Ctx extends BaseGeneral {
  public static template?: string // string html
  public static data: IData // for external access (**.data). example StartPage.data.callbackData
  public data = (this as any).constructor.data as IData // for internal access (this.**). example this.data.callbackData

  public get isPremium() {
    return this.ct.from?.is_premium ?? false
  }
  public get isBot() {
    return this.ct.from?.is_bot ?? false
  }
  public get userid() {
    return this.ct.from?.id as number
  }
  public get username() {
    return this.ct.from?.username as string
  }
  public get fullname() {
    return `${this.ct.from?.first_name || ``}${this.ct.from?.last_name || ``}`
  }
  public get firstname() {
    return this.ct.from?.first_name as string
  }
  public get lastname() {
    return this.ct.from?.last_name as string
  }
  public get msgText() {
    return this.ct.message?.text as string
  }
  public get msgTextIntent() {
    return this.msgText && this.msgText.indexOf(` `) != -1 ? (this.msgText.split(` `)[0] as string) : ``
  }
  public get msgTextPayloads() {
    return this.msgText && this.msgText.indexOf(` `) != -1 ? (this.msgText.split(` `).slice(1) as any[]) : ([] as any[])
  }
  public get msgTextPayload() {
    return this.msgTextPayloads[0] as string
  }
  public get msgCaption() {
    return this.ct.message?.caption as string
  }
  public get msgCaptionIntent() {
    return this.msgCaption && this.msgCaption.indexOf(` `) != -1 ? (this.msgCaption.split(` `)[0] as string) : ``
  }
  public get msgPhoto() {
    return this.ct.message?.photo
  }
  public get msgVideo() {
    return this.ct.message?.video
  }
  public get msgAudio() {
    return this.ct.message?.audio
  }
  public get callbackData() {
    return this.ct.callbackQuery?.data as string
  }
  public get callbackDataIntent() {
    return this.callbackData && this.callbackData.indexOf(`:`) != -1 ? (this.callbackData.split(`:`)[0] as string) : ``
  }
  public get callbackDataPayloads() {
    return this.callbackData && this.callbackData.indexOf(`:`) != -1 ? (this.callbackData.split(`:`).slice(1) as any[]) : ([] as any[])
  }
  public get callbackDataPayload() {
    return this.callbackDataPayloads?.[0] as string
  }
  public get callbackDataParts() {
    return this.callbackDataPayload && this.callbackDataPayload.indexOf(`+`) != -1 ? (this.callbackDataPayload.split(`+`) as any[]) : ([] as any[])
  }
  public get languageCode() {
    return this.ct.from?.language_code as string
  }
  public set languageCode(v: any) {
    ;(this as any).ct.from.language_code = v
  }
  public set session(v: any) {
    this.temp.session = v
  }
  public get session() {
    return this.temp.session
  }

  public ct: Context
  public cacheSession: CacheExternal
  public cacheKeyboard: Map<any, any>
  public templateManager: TemplateManager
  public temp: ITemp
  public constructor(params: { ct: Context; cacheSession: CacheExternal; cacheKeyboard: Map<any, any>; templateManager: TemplateManager; temp: ITemp }) {
    super()
    this.ct = params.ct
    this.cacheSession = params.cacheSession
    this.cacheKeyboard = params.cacheKeyboard
    this.templateManager = params.templateManager
    this.temp = params.temp
    if ((params as any)?.data) {
      this.temp.data = (params as any).data
    }
  }

  public async broadcast(ids: any[], languageCode: any[], keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: any) {
    const limitFree = 30
    const msgs = languageCode.map((it) => this.templateManager.getMessage(this.data.name, baseId, it, data)) as any[]
    for (let index = 0; index < ids.length; index++) {
      const id = ids[index]
      const msg = msgs[index]
      await this.ct.api.sendMessage(id, msg, {
        parse_mode: `HTML`,
        reply_markup: keyboard,
        ...options
      })

      if (index + 1 == limitFree) {
        await setTimeout(1200)
      }
    }
  }

  public async reply(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: any) {
    const msg = this.templateManager.getMessage(this.data.name, baseId, this.languageCode, data)
    return await this.ct.reply(msg, {
      parse_mode: `HTML`,
      reply_markup: keyboard,
      ...options
    })
  }

  public async replyMedia<T extends IMediaBlock[`type`]>(
    type: T,
    keyboard?: Keyboard | InlineKeyboard,
    data?: Record<string, any>,
    baseId?: string,
    options?: T extends `photo`
      ? Parameters<typeof this.ct.replyWithPhoto>[1]
      : T extends `video`
      ? Parameters<typeof this.ct.replyWithVideo>[1]
      : T extends `audio`
      ? Parameters<typeof this.ct.replyWithAudio>[1]
      : T extends `document`
      ? Parameters<typeof this.ct.replyWithDocument>[1]
      : T extends `animation`
      ? Parameters<typeof this.ct.replyWithAnimation>[1]
      : T extends `voice`
      ? Parameters<typeof this.ct.replyWithVoice>[1]
      : T extends `video_note`
      ? Parameters<typeof this.ct.replyWithVideoNote>[1]
      : T extends `sticker`
      ? Parameters<typeof this.ct.replyWithSticker>[1]
      : T extends `location`
      ? Parameters<typeof this.ct.replyWithLocation>[2]
      : T extends `contact`
      ? Parameters<typeof this.ct.replyWithContact>[2]
      : undefined
  ) {
    const med = this.templateManager.getMedia(this.data.name, baseId, this.languageCode, data)
    const opt = { parse_mode: `HTML`, reply_markup: keyboard, ...(options as any) }

    if (type == `photo`) return await this.ct.replyWithPhoto(med.src, { caption: med.caption, ...opt })
    if (type == `video`) return await this.ct.replyWithVideo(med.src, { caption: med.caption, ...opt })
    if (type == `audio`) return await this.ct.replyWithAudio(med.src, { caption: med.caption, ...opt })
    if (type == `document`) return await this.ct.replyWithDocument(med.src, { caption: med.caption, ...opt })
    if (type == `animation`) return await this.ct.replyWithAnimation(med.src, { caption: med.caption, ...opt })
    if (type == `voice`) return await this.ct.replyWithVoice(med.src, opt)
    if (type == `video_note`) return await this.ct.replyWithVideoNote(med.src, opt)
    if (type == `sticker`) return await this.ct.replyWithSticker(med.src, opt)
    if (type == `location`) return await this.ct.replyWithLocation(med.latitude, med.longitude, opt)
    if (type == `contact`) return await this.ct.replyWithContact(med.phone, med.first_name, { vcard: med.vcard, ...opt })
  }

  public async replyPhoto(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.replyWithPhoto>[1]) {
    return this.replyMedia(`photo`, keyboard, data, baseId, options)
  }

  public async replyVideo(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.replyWithVideo>[1]) {
    return this.replyMedia(`video`, keyboard, data, baseId, options)
  }

  public async replyAudio(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.replyWithAudio>[1]) {
    return this.replyMedia(`audio`, keyboard, data, baseId, options)
  }

  public async replyDocument(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.replyWithDocument>[1]) {
    return this.replyMedia(`document`, keyboard, data, baseId, options)
  }

  public async replyAnimation(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.replyWithAnimation>[1]) {
    return this.replyMedia(`animation`, keyboard, data, baseId, options)
  }

  public async replyVoice(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.replyWithVoice>[1]) {
    return this.replyMedia(`voice`, keyboard, data, baseId, options)
  }

  public async replyVideoNote(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.replyWithVideoNote>[1]) {
    return this.replyMedia(`video_note`, keyboard, data, baseId, options)
  }

  public async replySticker(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.replyWithSticker>[1]) {
    return this.replyMedia(`sticker`, keyboard, data, baseId, options)
  }

  public async replyLocation(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.replyWithLocation>[2]) {
    return this.replyMedia(`location`, keyboard, data, baseId, options)
  }

  public async replyContact(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.replyWithContact>[2]) {
    return this.replyMedia(`contact`, keyboard, data, baseId, options)
  }

  public async replyAction(type: Parameters<typeof this.ct.replyWithChatAction>[0]) {
    return await this.ct.replyWithChatAction(type)
  }

  public async edit(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.editMessageText>[1]) {
    try {
      const msg = this.templateManager.getMessage(this.data.name, baseId, this.languageCode, data)
      return await this.ct.editMessageText(msg, {
        parse_mode: `HTML`,
        reply_markup: keyboard,
        ...(options as any)
      })
    } catch (error) {
      await this.reply(keyboard, data, baseId, options)
    }
  }

  public async editMedia<T extends IMediaBlock[`type`]>(
    type: T,
    keyboard?: Keyboard | InlineKeyboard,
    data?: Record<string, any>,
    baseId?: string,
    options1?: T extends `voice`
      ? Parameters<typeof this.ct.replyWithVoice>[1]
      : T extends `video_note`
      ? Parameters<typeof this.ct.replyWithVideoNote>[1]
      : T extends `sticker`
      ? Parameters<typeof this.ct.replyWithSticker>[1]
      : T extends `location`
      ? Parameters<typeof this.ct.replyWithLocation>[2]
      : T extends `contact`
      ? Parameters<typeof this.ct.replyWithContact>[2]
      : Parameters<typeof this.ct.editMessageMedia>[0],
    options2?: Parameters<typeof this.ct.editMessageMedia>[1]
  ) {
    try {
      const { src, caption } = this.templateManager.getMedia(this.data.name, baseId, this.languageCode, data)
      if (type == `voice`) {
        await this.delete()
        return await this.replyVoice(keyboard, data, baseId, options1)
      }
      if (type == `video_note`) {
        await this.delete()
        return await this.replyVoice(keyboard, data, baseId, options1)
      }
      if (type == `sticker`) {
        await this.delete()
        return await this.replySticker(keyboard, data, baseId, options1 as any)
      }
      if (type == `location`) {
        await this.delete()
        return await this.replyLocation(keyboard, data, baseId, options1 as any)
      }
      if (type == `contact`) {
        await this.delete()
        return await this.replyContact(keyboard, data, baseId, options1 as any)
      }

      return await this.ct.editMessageMedia(
        {
          media: src,
          caption,
          type,
          parse_mode: `HTML`,
          ...(options1 as any)
        },
        { reply_markup: keyboard, ...(options2 as any) }
      )
    } catch (error) {
      await this.reply(keyboard, data, baseId, options2)
    }
  }

  public async editPhoto(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options1?: Parameters<typeof this.ct.editMessageMedia>[0], options2?: Parameters<typeof this.ct.editMessageMedia>[1]) {
    return await this.editMedia(`photo`, keyboard, data, baseId, options1, options2)
  }

  public async editVideo(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options1?: Parameters<typeof this.ct.editMessageMedia>[0], options2?: Parameters<typeof this.ct.editMessageMedia>[1]) {
    return await this.editMedia(`video`, keyboard, data, baseId, options1, options2)
  }

  public async editAudio(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options1?: Parameters<typeof this.ct.editMessageMedia>[0], options2?: Parameters<typeof this.ct.editMessageMedia>[1]) {
    return await this.editMedia(`audio`, keyboard, data, baseId, options1, options2)
  }

  public async editDocument(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options1?: Parameters<typeof this.ct.editMessageMedia>[0], options2?: Parameters<typeof this.ct.editMessageMedia>[1]) {
    return await this.editMedia(`document`, keyboard, data, baseId, options1, options2)
  }

  public async editAnimation(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options1?: Parameters<typeof this.ct.editMessageMedia>[0], options2?: Parameters<typeof this.ct.editMessageMedia>[1]) {
    return await this.editMedia(`animation`, keyboard, data, baseId, options1, options2)
  }

  public async editVoice(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.replyWithVoice>[1]) {
    return await this.editMedia(`voice`, keyboard, data, baseId, options)
  }

  public async editVideoNote(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.replyWithVideoNote>[1]) {
    return await this.editMedia(`video_note`, keyboard, data, baseId, options)
  }

  public async editSticker(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.replyWithSticker>[1]) {
    return await this.editMedia(`sticker`, keyboard, data, baseId, options)
  }

  public async editLocation(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.replyWithLocation>[2]) {
    return await this.editMedia(`location`, keyboard, data, baseId, options)
  }

  public async editContact(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: Parameters<typeof this.ct.replyWithContact>[2]) {
    return await this.editMedia(`contact`, keyboard, data, baseId, options)
  }

  public async delete() {
    return await this.ct.deleteMessage()
  }

  public async callbackQueryAnswer(options?: any) {
    try {
      return await this.ct.answerCallbackQuery(options)
    } catch {
      return null
    }
  }

  public async sessionSet(method: string, params: any, moreRoot?: Record<any, any>) {
    try {
      const value = { method, params, ...moreRoot }
      const result = await this.cacheSession.set(`${this.userid}`, value)
      if (result) {
        this.session = value
      }
      return result
    } catch {
      return null
    }
  }

  public async sessionGet(): Promise<{ method: string; params: any; [moreRoot: string]: any } | null> {
    try {
      const result = await this.cacheSession.get(`${this.userid}`)
      if (result) {
        this.session = result
      }
      return result || null
    } catch {
      return null
    }
  }

  public async sessionClear() {
    try {
      const result = await this.cacheSession.delete(`${this.userid}`)
      if (result) {
        this.session = {}
      }
      return result
    } catch {
      return null
    }
  }

  // =============== build data

  public static buildData<C extends ((...args: any[]) => any) | undefined = undefined>(callback?: C) {
    return {
      name: ``,
      callbackData: callback
        ? function (this: { name: string }, ...args: Parameters<Exclude<C, undefined>>): ReturnType<Exclude<C, undefined>> {
            const params = callback(...args)
            return `${this.name}${params === undefined ? `` : `:${params}`}` as any
          }
        : function (this: { name: string }) {
            return this?.name
          }
    }
  }

  // =============== build keyboard

  public buildInlineKeyboard(callback: (kb: InlineKeyboard, arr: any[]) => InlineKeyboard, params?: { baseId?: any; data?: Record<string, any>; cache?: boolean }): InlineKeyboard {
    const tkey = this.data.name
    if (params?.cache === true) {
      const key = `${tkey}:${this.languageCode}:inline`
      const ckb = this.cacheKeyboard.get(key)
      if (!ckb) {
        const ikb = new InlineKeyboard()
        const arr = this.templateManager.getKeyboard(tkey, params?.baseId, this.languageCode, `inline`, params?.data)
        const rkb = callback(ikb, arr)
        this.cacheKeyboard.set(key, rkb)
        return rkb
      }
      return ckb
    }
    const ikb = new InlineKeyboard()
    const arr = this.templateManager.getKeyboard(tkey, params?.baseId, this.languageCode, `inline`, params?.data)
    const rkb = callback(ikb, arr)
    return rkb
  }

  public buildKeyboard(callback: (kb: Keyboard, arr: any[]) => Keyboard, params?: { baseId?: any; data?: Record<string, any>; cache?: boolean }): Keyboard {
    const tkey = this.data.name
    if (params?.cache === true) {
      const key = `${tkey}:${this.languageCode}:default`
      const ckb = this.cacheKeyboard.get(key)
      if (!ckb) {
        const kb = new Keyboard()
        const arr = this.templateManager.getKeyboard(tkey, params?.baseId, this.languageCode, `default`, params?.data)
        const rkb = callback(kb, arr)
        rkb.resized(true)
        this.cacheKeyboard.set(key, rkb)
        return rkb
      }
      return ckb
    }
    const kb = new Keyboard()
    const arr = this.templateManager.getKeyboard(tkey, params?.baseId, this.languageCode, `default`, params?.data)
    const rkb = callback(kb, arr)
    rkb.resized()
    return rkb
  }

  // =============== most common used function
  public async transition?(...args: any): Promise<void>
  public async internal?(...args: any): Promise<void>
  public async notify?(...args: any): Promise<void>

  // =============== route function
  // callback
  public async callback?(): Promise<void> // example: start
  public async callbackPayload?(): Promise<void> // example: start:{DYNAMIC}
  // text
  public async text?(): Promise<void> // example: start
  public async textPayload?(): Promise<void> // example: start {...DYNAMIC}
  public async textCommand?(): Promise<void> // example: /start
  public async textCommandPayload?(): Promise<void> // example: /start {...DYNAMIC}
  public async textFree?(): Promise<void> // example (for session): {...DYNAMIC}

  // photo
  public async photoCaption?(): Promise<void>
  public async photoCaptionPayload?(): Promise<void>
  public async photoCaptionCommand?(): Promise<void>
  public async photoCaptionCommandPayload?(): Promise<void>
  public async photoFree?(): Promise<void>
  // video
  public async videoCaption?(): Promise<void>
  public async videoCaptionPayload?(): Promise<void>
  public async videoCaptionCommand?(): Promise<void>
  public async videoCaptionCommandPayload?(): Promise<void>
  public async videoFree?(): Promise<void>
  // audio
  public async audioCaption?(): Promise<void>
  public async audioCaptionPayload?(): Promise<void>
  public async audioCaptionCommand?(): Promise<void>
  public async audioCaptionCommandPayload?(): Promise<void>
  public async audioFree?(): Promise<void>
  // document
  public async documentCaption?(): Promise<void>
  public async documentCaptionPayload?(): Promise<void>
  public async documentCaptionCommand?(): Promise<void>
  public async documentCaptionCommandPayload?(): Promise<void>
  public async documentFree?(): Promise<void>
  // animation
  public async animationCaption?(): Promise<void>
  public async animationCaptionPayload?(): Promise<void>
  public async animationCaptionCommand?(): Promise<void>
  public async animationCaptionCommandPayload?(): Promise<void>
  public async animationFree?(): Promise<void>
  // voice
  public async voiceCaption?(): Promise<void>
  public async voiceCaptionPayload?(): Promise<void>
  public async voiceCaptionCommand?(): Promise<void>
  public async voiceCaptionCommandPayload?(): Promise<void>
  public async voiceFree?(): Promise<void>
  // video_note
  public async videoNoteCaption?(): Promise<void>
  public async videoNoteCaptionPayload?(): Promise<void>
  public async videoNoteCaptionCommand?(): Promise<void>
  public async videoNoteCaptionCommandPayload?(): Promise<void>
  public async videoNoteFree?(): Promise<void>
  // sticker
  public async stickerFree?(): Promise<void>
  // location
  public async locationFree?(): Promise<void>
  // contact
  public async contactFree?(): Promise<void>
  // all
  public async free?(): Promise<void>

  // =============== session validate
  // callback

  public validateSessionCallback(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodCallback(name)
  }

  public validateSessionCallbackPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodCallbackPayload(name)
  }

  // text

  public validateSessionText(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodText(name)
  }

  public validateSessionTextPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodTextPayload(name)
  }

  public validateSessionTextCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodTextCommand(name)
  }

  public validateSessionTextCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodTextCommandPayload(name)
  }

  public validateSessionTextFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodTextFree(name)
  }

  // photo

  public validateSessionPhotoCaption(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodPhotoCaption(name)
  }

  public validateSessionPhotoCaptionPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodPhotoCaptionPayload(name)
  }

  public validateSessionPhotoCaptionCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodPhotoCaptionCommand(name)
  }

  public validateSessionPhotoCaptionCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodPhotoCaptionCommandPayload(name)
  }

  public validateSessionPhotoFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodPhotoFree(name)
  }

  // video

  public validateSessionVideoCaption(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodVideoCaption(name)
  }

  public validateSessionVideoCaptionPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodVideoCaptionPayload(name)
  }

  public validateSessionVideoCaptionCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodVideoCaptionCommand(name)
  }

  public validateSessionVideoCaptionCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodVideoCaptionCommandPayload(name)
  }

  public validateSessionVideoFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodVideoFree(name)
  }

  // audio

  public validateSessionAudioCaption(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodAudioCaption(name)
  }

  public validateSessionAudioCaptionPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodAudioCaptionPayload(name)
  }

  public validateSessionAudioCaptionCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodAudioCaptionCommand(name)
  }

  public validateSessionAudioCaptionCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodAudioCaptionCommandPayload(name)
  }

  public validateSessionAudioFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodAudioFree(name)
  }

  // document

  public validateSessionDocumentCaption(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodDocumentCaption(name)
  }

  public validateSessionDocumentCaptionPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodDocumentCaptionPayload(name)
  }

  public validateSessionDocumentCaptionCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodDocumentCaptionCommand(name)
  }

  public validateSessionDocumentCaptionCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodDocumentCaptionCommandPayload(name)
  }

  public validateSessionDocumentFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodDocumentFree(name)
  }

  // animation

  public validateSessionAnimationCaption(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodAnimationCaption(name)
  }

  public validateSessionAnimationCaptionPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodAnimationCaptionPayload(name)
  }

  public validateSessionAnimationCaptionCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodAnimationCaptionCommand(name)
  }

  public validateSessionAnimationCaptionCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodAnimationCaptionCommandPayload(name)
  }

  public validateSessionAnimationFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodAnimationFree(name)
  }

  // voice

  public validateSessionVoiceCaption(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodVoiceCaption(name)
  }

  public validateSessionVoiceCaptionPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodVoiceCaptionPayload(name)
  }

  public validateSessionVoiceCaptionCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodVoiceCaptionCommand(name)
  }

  public validateSessionVoiceCaptionCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodVoiceCaptionCommandPayload(name)
  }

  public validateSessionVoiceFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodVoiceFree(name)
  }

  // video note

  public validateSessionVideoNoteCaption(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodVideoNoteCaption(name)
  }

  public validateSessionVideoNoteCaptionPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodVideoNoteCaptionPayload(name)
  }

  public validateSessionVideoNoteCaptionCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodVideoNoteCaptionCommand(name)
  }

  public validateSessionVideoNoteCaptionCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodVideoNoteCaptionCommandPayload(name)
  }

  public validateSessionVideoNoteFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodVideoNoteFree(name)
  }

  // sticker

  public validateSessionStickerFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodStickerFree(name)
  }

  // location

  public validateSessionLocationFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodLocationFree(name)
  }

  // contact

  public validateSessionContactFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.buildSessionMethodContactFree(name)
  }

  // =============== session set
  // callback

  public sessionCallback(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodCallback(name), params)
  }

  public sessionCallbackPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodCallbackPayload(name), params)
  }

  // text

  public sessionText(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodText(name), params)
  }

  public sessionTextPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodTextPayload(name), params)
  }

  public sessionTextCommand(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodTextCommand(name), params)
  }

  public sessionTextCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodTextCommandPayload(name), params)
  }

  public sessionTextFree(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodTextFree(name), params)
  }

  // photo

  public sessionPhotoCaption(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodPhotoCaption(name), params)
  }

  public sessionPhotoCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodPhotoCaptionPayload(name), params)
  }

  public sessionPhotoCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodPhotoCaptionCommand(name), params)
  }

  public sessionPhotoCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodPhotoCaptionCommandPayload(name), params)
  }

  public sessionPhotoFree(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodPhotoFree(name), params)
  }

  // video

  public sessionVideoCaption(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodVideoCaption(name), params)
  }

  public sessionVideoCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodVideoCaptionPayload(name), params)
  }

  public sessionVideoCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodVideoCaptionCommand(name), params)
  }

  public sessionVideoCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodVideoCaptionCommandPayload(name), params)
  }

  public sessionVideoFree(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodVideoFree(name), params)
  }

  // audio

  public sessionAudioCaption(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodAudioCaption(name), params)
  }

  public sessionAudioCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodAudioCaptionPayload(name), params)
  }

  public sessionAudioCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodAudioCaptionCommand(name), params)
  }

  public sessionAudioCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodAudioCaptionCommandPayload(name), params)
  }

  public sessionAudioFree(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodAudioFree(name), params)
  }

  // document

  public sessionDocumentCaption(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodDocumentCaption(name), params)
  }

  public sessionDocumentCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodDocumentCaptionPayload(name), params)
  }

  public sessionDocumentCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodDocumentCaptionCommand(name), params)
  }

  public sessionDocumentCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodDocumentCaptionCommandPayload(name), params)
  }

  public sessionDocumentFree(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodDocumentFree(name), params)
  }

  // animation

  public sessionAnimationCaption(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodAnimationCaption(name), params)
  }

  public sessionAnimationCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodAnimationCaptionPayload(name), params)
  }

  public sessionAnimationCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodAnimationCaptionCommand(name), params)
  }

  public sessionAnimationCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodAnimationCaptionCommandPayload(name), params)
  }

  public sessionAnimationFree(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodAnimationFree(name), params)
  }

  // voice

  public sessionVoiceCaption(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodVoiceCaption(name), params)
  }

  public sessionVoiceCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodVoiceCaptionPayload(name), params)
  }

  public sessionVoiceCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodVoiceCaptionCommand(name), params)
  }

  public sessionVoiceCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodVoiceCaptionCommandPayload(name), params)
  }

  public sessionVoiceFree(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodVoiceFree(name), params)
  }

  // video note

  public sessionVideoNoteCaption(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodVideoNoteCaption(name), params)
  }

  public sessionVideoNoteCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodVideoNoteCaptionPayload(name), params)
  }

  public sessionVideoNoteCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodVideoNoteCaptionCommand(name), params)
  }

  public sessionVideoNoteCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodVideoNoteCaptionCommandPayload(name), params)
  }

  public sessionVideoNoteFree(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodVideoNoteFree(name), params)
  }

  // sticker

  public sessionStickerFree(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodStickerFree(name), params)
  }

  // location

  public sessionLocationFree(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodLocationFree(name), params)
  }

  // contact

  public sessionContactFree(params?: any, name?: string) {
    return this.sessionSet(this.buildSessionMethodContactFree(name), params)
  }

  // =============== session update to set
  // callback

  public sessionToCallback(paramsAdd?: any, name?: string) {
    return this.sessionCallback({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToCallbackPayload(paramsAdd?: any, name?: string) {
    return this.sessionCallbackPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  // text

  public sessionToText(paramsAdd?: any, name?: string) {
    return this.sessionText({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToTextPayload(paramsAdd?: any, name?: string) {
    return this.sessionTextPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToTextCommand(paramsAdd?: any, name?: string) {
    return this.sessionTextCommand({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToTextCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionTextCommandPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToTextFree(paramsAdd?: any, name?: string) {
    return this.sessionTextFree({ ...this.session.params, ...paramsAdd }, name)
  }

  // photo

  public sessionToPhotoCaption(paramsAdd?: any, name?: string) {
    return this.sessionPhotoCaption({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToPhotoCaptionPayload(paramsAdd?: any, name?: string) {
    return this.sessionPhotoCaptionPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToPhotoCaptionCommand(paramsAdd?: any, name?: string) {
    return this.sessionPhotoCaptionCommand({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToPhotoCaptionCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionPhotoCaptionCommandPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToPhotoFree(paramsAdd?: any, name?: string) {
    return this.sessionPhotoFree({ ...this.session.params, ...paramsAdd }, name)
  }

  // video

  public sessionToVideoCaption(paramsAdd?: any, name?: string) {
    return this.sessionVideoCaption({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToVideoCaptionPayload(paramsAdd?: any, name?: string) {
    return this.sessionVideoCaptionPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToVideoCaptionCommand(paramsAdd?: any, name?: string) {
    return this.sessionVideoCaptionCommand({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToVideoCaptionCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionVideoCaptionCommandPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToVideoFree(paramsAdd?: any, name?: string) {
    return this.sessionVideoFree({ ...this.session.params, ...paramsAdd }, name)
  }

  // audio

  public sessionToAudioCaption(paramsAdd?: any, name?: string) {
    return this.sessionAudioCaption({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToAudioCaptionPayload(paramsAdd?: any, name?: string) {
    return this.sessionAudioCaptionPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToAudioCaptionCommand(paramsAdd?: any, name?: string) {
    return this.sessionAudioCaptionCommand({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToAudioCaptionCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionAudioCaptionCommandPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToAudioFree(paramsAdd?: any, name?: string) {
    return this.sessionAudioFree({ ...this.session.params, ...paramsAdd }, name)
  }

  // document

  public sessionToDocumentCaption(paramsAdd?: any, name?: string) {
    return this.sessionDocumentCaption({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToDocumentCaptionPayload(paramsAdd?: any, name?: string) {
    return this.sessionDocumentCaptionPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToDocumentCaptionCommand(paramsAdd?: any, name?: string) {
    return this.sessionDocumentCaptionCommand({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToDocumentCaptionCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionDocumentCaptionCommandPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToDocumentFree(paramsAdd?: any, name?: string) {
    return this.sessionDocumentFree({ ...this.session.params, ...paramsAdd }, name)
  }

  // animation

  public sessionToAnimationCaption(paramsAdd?: any, name?: string) {
    return this.sessionAnimationCaption({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToAnimationCaptionPayload(paramsAdd?: any, name?: string) {
    return this.sessionAnimationCaptionPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToAnimationCaptionCommand(paramsAdd?: any, name?: string) {
    return this.sessionAnimationCaptionCommand({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToAnimationCaptionCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionAnimationCaptionCommandPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToAnimationFree(paramsAdd?: any, name?: string) {
    return this.sessionAnimationFree({ ...this.session.params, ...paramsAdd }, name)
  }

  // voice

  public sessionToVoiceCaption(paramsAdd?: any, name?: string) {
    return this.sessionVoiceCaption({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToVoiceCaptionPayload(paramsAdd?: any, name?: string) {
    return this.sessionVoiceCaptionPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToVoiceCaptionCommand(paramsAdd?: any, name?: string) {
    return this.sessionVoiceCaptionCommand({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToVoiceCaptionCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionVoiceCaptionCommandPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToVoiceFree(paramsAdd?: any, name?: string) {
    return this.sessionVoiceFree({ ...this.session.params, ...paramsAdd }, name)
  }

  // videonote

  public sessionToVideoNoteCaption(paramsAdd?: any, name?: string) {
    return this.sessionVideoNoteCaption({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToVideoNoteCaptionPayload(paramsAdd?: any, name?: string) {
    return this.sessionVideoNoteCaptionPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToVideoNoteCaptionCommand(paramsAdd?: any, name?: string) {
    return this.sessionVideoNoteCaptionCommand({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToVideoNoteCaptionCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionVideoNoteCaptionCommandPayload({ ...this.session.params, ...paramsAdd }, name)
  }

  public sessionToVideoNoteFree(paramsAdd?: any, name?: string) {
    return this.sessionVideoNoteFree({ ...this.session.params, ...paramsAdd }, name)
  }

  // sticker

  public sessionToStickerFree(paramsAdd?: any, name?: string) {
    return this.sessionStickerFree({ ...this.session.params, ...paramsAdd }, name)
  }

  // location

  public sessionToLocationFree(paramsAdd?: any, name?: string) {
    return this.sessionLocationFree({ ...this.session.params, ...paramsAdd }, name)
  }

  // contact

  public sessionToContactFree(paramsAdd?: any, name?: string) {
    return this.sessionContactFree({ ...this.session.params, ...paramsAdd }, name)
  }

  // =============== build intent

  public buildIntent(str?: string, fbCallbackData = true) {
    if (!str) {
      str = fbCallbackData ? this.data.callbackData() : this.data.name
    }

    const tag = fbCallbackData ? `:` : ` `
    return str?.indexOf?.(tag) != -1 ? (str?.split?.(tag)?.[0] as string) : str
  }

  // =============== build session method

  public buildSessionMethod(prefix: string, name: string | undefined) {
    return `${prefix}-${name || this.data.name}`
  }

  // callback method

  public buildSessionMethodCallback(name?: string) {
    return this.buildSessionMethod(`1`, name)
  }

  public buildSessionMethodCallbackPayload(name?: string) {
    return this.buildSessionMethod(`2`, name)
  }

  // text method

  public buildSessionMethodText(name?: string) {
    return this.buildSessionMethod(`3`, name)
  }

  public buildSessionMethodTextPayload(name?: string) {
    return this.buildSessionMethod(`4`, name)
  }

  public buildSessionMethodTextCommand(name?: string) {
    return this.buildSessionMethod(`5`, name)
  }

  public buildSessionMethodTextCommandPayload(name?: string) {
    return this.buildSessionMethod(`6`, name)
  }

  public buildSessionMethodTextFree(name?: string) {
    return this.buildSessionMethod(`7`, name)
  }

  // photo method

  public buildSessionMethodPhotoCaption(name?: string) {
    return this.buildSessionMethod(`8`, name)
  }

  public buildSessionMethodPhotoCaptionPayload(name?: string) {
    return this.buildSessionMethod(`9`, name)
  }

  public buildSessionMethodPhotoCaptionCommand(name?: string) {
    return this.buildSessionMethod(`10`, name)
  }

  public buildSessionMethodPhotoCaptionCommandPayload(name?: string) {
    return this.buildSessionMethod(`11`, name)
  }

  public buildSessionMethodPhotoFree(name?: string) {
    return this.buildSessionMethod(`12`, name)
  }

  // video method

  public buildSessionMethodVideoCaption(name?: string) {
    return this.buildSessionMethod(`13`, name)
  }

  public buildSessionMethodVideoCaptionPayload(name?: string) {
    return this.buildSessionMethod(`14`, name)
  }

  public buildSessionMethodVideoCaptionCommand(name?: string) {
    return this.buildSessionMethod(`15`, name)
  }

  public buildSessionMethodVideoCaptionCommandPayload(name?: string) {
    return this.buildSessionMethod(`16`, name)
  }

  public buildSessionMethodVideoFree(name?: string) {
    return this.buildSessionMethod(`17`, name)
  }

  // audio method

  public buildSessionMethodAudioCaption(name?: string) {
    return this.buildSessionMethod(`18`, name)
  }

  public buildSessionMethodAudioCaptionPayload(name?: string) {
    return this.buildSessionMethod(`19`, name)
  }

  public buildSessionMethodAudioCaptionCommand(name?: string) {
    return this.buildSessionMethod(`20`, name)
  }

  public buildSessionMethodAudioCaptionCommandPayload(name?: string) {
    return this.buildSessionMethod(`21`, name)
  }

  public buildSessionMethodAudioFree(name?: string) {
    return this.buildSessionMethod(`22`, name)
  }

  // document method

  public buildSessionMethodDocumentCaption(name?: string) {
    return this.buildSessionMethod(`23`, name)
  }

  public buildSessionMethodDocumentCaptionPayload(name?: string) {
    return this.buildSessionMethod(`24`, name)
  }

  public buildSessionMethodDocumentCaptionCommand(name?: string) {
    return this.buildSessionMethod(`25`, name)
  }

  public buildSessionMethodDocumentCaptionCommandPayload(name?: string) {
    return this.buildSessionMethod(`26`, name)
  }

  public buildSessionMethodDocumentFree(name?: string) {
    return this.buildSessionMethod(`27`, name)
  }

  // animation method

  public buildSessionMethodAnimationCaption(name?: string) {
    return this.buildSessionMethod(`28`, name)
  }
  public buildSessionMethodAnimationCaptionPayload(name?: string) {
    return this.buildSessionMethod(`29`, name)
  }
  public buildSessionMethodAnimationCaptionCommand(name?: string) {
    return this.buildSessionMethod(`30`, name)
  }
  public buildSessionMethodAnimationCaptionCommandPayload(name?: string) {
    return this.buildSessionMethod(`31`, name)
  }
  public buildSessionMethodAnimationFree(name?: string) {
    return this.buildSessionMethod(`32`, name)
  }

  // voice method

  public buildSessionMethodVoiceCaption(name?: string) {
    return this.buildSessionMethod(`33`, name)
  }
  public buildSessionMethodVoiceCaptionPayload(name?: string) {
    return this.buildSessionMethod(`34`, name)
  }
  public buildSessionMethodVoiceCaptionCommand(name?: string) {
    return this.buildSessionMethod(`35`, name)
  }
  public buildSessionMethodVoiceCaptionCommandPayload(name?: string) {
    return this.buildSessionMethod(`36`, name)
  }
  public buildSessionMethodVoiceFree(name?: string) {
    return this.buildSessionMethod(`37`, name)
  }

  // video note method
  public buildSessionMethodVideoNoteCaption(name?: string) {
    return this.buildSessionMethod(`38`, name)
  }
  public buildSessionMethodVideoNoteCaptionPayload(name?: string) {
    return this.buildSessionMethod(`39`, name)
  }
  public buildSessionMethodVideoNoteCaptionCommand(name?: string) {
    return this.buildSessionMethod(`40`, name)
  }
  public buildSessionMethodVideoNoteCaptionCommandPayload(name?: string) {
    return this.buildSessionMethod(`41`, name)
  }
  public buildSessionMethodVideoNoteFree(name?: string) {
    return this.buildSessionMethod(`42`, name)
  }
  public buildSessionMethodStickerFree(name?: string) {
    return this.buildSessionMethod(`43`, name) // sticker method
  }
  public buildSessionMethodLocationFree(name?: string) {
    return this.buildSessionMethod(`44`, name) // location method
  }
  public buildSessionMethodContactFree(name?: string) {
    return this.buildSessionMethod(`45`, name) // contact method
  }
}
