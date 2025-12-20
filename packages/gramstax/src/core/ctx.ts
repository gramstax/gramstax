import { setTimeout } from "node:timers/promises"
import { CacheExternal } from "~/cache"
import { InlineKeyboard, Keyboard } from "grammy"
import { IMediaBlock, TemplateManager } from "~/template"
import type {
  ICt,
  IKb,
  IData,
  IOptEdit,
  IBottomKb,
  IInlineKb,
  IOptReply,
  IOptReplyVoice,
  IOptReplyVideo,
  IOptEditMedia1,
  IOptEditMedia2,
  IOptReplyAudio,
  IOptReplyPhoto,
  IOptReplyContact,
  IOptReplySticker,
  ITypeReplyAction,
  IOptReplyDocument,
  IOptReplyLocation,
  IOptReplyAnimation,
  IOptReplyVideoNote
} from "~/types/ctx"

type IPageData = { name: string; callbackData: (...args: string[]) => string }
type ITemp = { session: { method?: string; params?: any }; data: Partial<IPageData>; [key: string]: any }

export class Ctx {
  public static template?: string // string html
  public static data: IPageData // for external access (**.data). example StartPage.data.callbackData
  public data = (this.constructor as Record<any, any>).data as IPageData // for internal access (this.**). example this.data.callbackData

  public get userIsPremium() {
    return this.ct.from?.is_premium ?? false
  }
  public get userIsBot() {
    return this.ct.from?.is_bot ?? false
  }
  public get userId() {
    return this.ct.from?.id as number
  }
  public get userName() {
    return this.ct.from?.username as string
  }
  public get userFullName() {
    return `${this.ct.from?.first_name}${this.ct.from?.last_name}`
  }
  public get userFirstName() {
    return this.ct.from?.first_name as string
  }
  public get userLastName() {
    return this.ct.from?.last_name as string
  }
  public get userLanguage() {
    return this.ct.from?.language_code as string
  }
  public set userLanguage(v: string) {
    this.ct.from!.language_code = v
  }
  public get msgText() {
    return this.ct.message?.text as string
  }
  public get msgTextIntent() {
    return this.msgText && this.msgText.indexOf(` `) != -1 ? (this.msgText.split(` `)[0] as string) : ``
  }
  public get msgTextPayloads() {
    return this.msgText && this.msgText.indexOf(` `) != -1 ? this.msgText.split(` `).slice(1) : ([] as string[])
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
    return this.callbackData && this.callbackData.indexOf(`:`) != -1 ? this.callbackData.split(`:`).slice(1) : ([] as string[])
  }
  public get callbackDataPayload() {
    return this.callbackDataPayloads?.[0] as string
  }
  public get callbackDataParts() {
    return this.callbackDataPayload && this.callbackDataPayload.indexOf(`+`) != -1 ? this.callbackDataPayload.split(`+`) : ([] as string[])
  }
  public set session(v: ITemp[`session`]) {
    this.temp.session = v
  }
  public get session() {
    return this.temp.session
  }

  public ct: ICt
  public cacheSession: CacheExternal
  public cacheKeyboard: Map<any, any>
  public templateManager: TemplateManager
  public temp: ITemp
  public constructor(params: { ct: ICt; cacheSession: CacheExternal; cacheKeyboard: Map<any, any>; templateManager: TemplateManager; temp: ITemp }) {
    this.ct = params.ct
    this.cacheSession = params.cacheSession
    this.cacheKeyboard = params.cacheKeyboard
    this.templateManager = params.templateManager
    this.temp = params.temp
  }

  public async broadcast(ids: number[], languageCode: string[], keyboard?: IKb, data?: IData, baseId?: string, options?: IOptReply, throwError = false) {
    try {
      const limitFree = 30
      const msgs = languageCode.map((it) => this.templateManager.getMessage(this.data.name, baseId, it, data))
      for (let index = 0; index < ids.length; index++) {
        const id = ids[index]
        const msg = msgs[index]
        await this.ct.api.sendMessage(id!, msg!, {
          parse_mode: `HTML`,
          reply_markup: keyboard,
          ...options
        })

        if (index + 1 == limitFree) {
          await setTimeout(1200)
        }
      }
    } catch (err) {
      if (throwError) {
        throw err
      }
    }
  }

  public async reply(keyboard?: IKb, data?: IData, baseId?: string, options?: IOptReply) {
    const msg = this.templateManager.getMessage(this.data.name, baseId, this.userLanguage, data)
    return await this.ct.reply(msg, {
      parse_mode: `HTML`,
      reply_markup: keyboard,
      ...options
    })
  }

  public async replyMedia<T extends IMediaBlock[`type`]>(
    type: T,
    keyboard?: IKb,
    data?: IData,
    baseId?: string,
    options?: T extends `photo`
      ? IOptReplyPhoto
      : T extends `video`
      ? IOptReplyVideo
      : T extends `audio`
      ? IOptReplyAudio
      : T extends `document`
      ? IOptReplyDocument
      : T extends `animation`
      ? IOptReplyAnimation
      : T extends `voice`
      ? IOptReplyVoice
      : T extends `video_note`
      ? IOptReplyVideoNote
      : T extends `sticker`
      ? IOptReplySticker
      : T extends `location`
      ? IOptReplyLocation
      : T extends `contact`
      ? IOptReplyContact
      : undefined
  ) {
    const med = this.templateManager.getMedia(this.data.name, baseId, this.userLanguage, data)
    const opt = { parse_mode: `HTML`, reply_markup: keyboard, ...options } as Record<any, any>

    if (type == `photo`) return await this.ct.replyWithPhoto(med.src!, { caption: med.caption!, ...opt })
    if (type == `video`) return await this.ct.replyWithVideo(med.src!, { caption: med.caption!, ...opt })
    if (type == `audio`) return await this.ct.replyWithAudio(med.src!, { caption: med.caption!, ...opt })
    if (type == `document`) return await this.ct.replyWithDocument(med.src!, { caption: med.caption!, ...opt })
    if (type == `animation`) return await this.ct.replyWithAnimation(med.src!, { caption: med.caption!, ...opt })
    if (type == `voice`) return await this.ct.replyWithVoice(med.src!, opt)
    if (type == `video_note`) return await this.ct.replyWithVideoNote(med.src!, opt)
    if (type == `sticker`) return await this.ct.replyWithSticker(med.src!, opt)
    if (type == `location`) return await this.ct.replyWithLocation(parseInt(med.latitude!), parseInt(med.longitude!), opt)
    if (type == `contact`) return await this.ct.replyWithContact(med.phone!, med.first_name!, { vcard: med.vcard!, ...opt })
  }

  public async replyPhoto(keyboard?: IKb, data?: IData, baseId?: string, options?: IOptReplyPhoto) {
    return this.replyMedia(`photo`, keyboard, data, baseId, options)
  }

  public async replyVideo(keyboard?: IKb, data?: IData, baseId?: string, options?: IOptReplyVideo) {
    return this.replyMedia(`video`, keyboard, data, baseId, options)
  }

  public async replyAudio(keyboard?: IKb, data?: IData, baseId?: string, options?: IOptReplyAudio) {
    return this.replyMedia(`audio`, keyboard, data, baseId, options)
  }

  public async replyDocument(keyboard?: IKb, data?: IData, baseId?: string, options?: IOptReplyDocument) {
    return this.replyMedia(`document`, keyboard, data, baseId, options)
  }

  public async replyAnimation(keyboard?: IKb, data?: IData, baseId?: string, options?: IOptReplyAnimation) {
    return this.replyMedia(`animation`, keyboard, data, baseId, options)
  }

  public async replyVoice(keyboard?: IKb, data?: IData, baseId?: string, options?: IOptReplyVoice) {
    return this.replyMedia(`voice`, keyboard, data, baseId, options)
  }

  public async replyVideoNote(keyboard?: IKb, data?: IData, baseId?: string, options?: IOptReplyVideoNote) {
    return this.replyMedia(`video_note`, keyboard, data, baseId, options)
  }

  public async replySticker(keyboard?: IKb, data?: IData, baseId?: string, options?: IOptReplySticker) {
    return this.replyMedia(`sticker`, keyboard, data, baseId, options)
  }

  public async replyLocation(keyboard?: IKb, data?: IData, baseId?: string, options?: IOptReplyLocation) {
    return this.replyMedia(`location`, keyboard, data, baseId, options)
  }

  public async replyContact(keyboard?: IKb, data?: IData, baseId?: string, options?: IOptReplyContact) {
    return this.replyMedia(`contact`, keyboard, data, baseId, options)
  }

  public async replyAction(type: ITypeReplyAction) {
    return await this.ct.replyWithChatAction(type)
  }

  public async edit(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEdit, fallbackReply = true) {
    try {
      const msg = this.templateManager.getMessage(this.data.name, baseId, this.userLanguage, data)
      return await this.ct.editMessageText(msg, {
        parse_mode: `HTML`,
        reply_markup: keyboardInline,
        ...options
      })
    } catch (error) {
      if (fallbackReply) {
        await this.reply(keyboardInline, data, baseId, options)
      } else {
        throw error
      }
    }
  }

  public async editMedia<T extends IMediaBlock[`type`]>(
    type: T,
    keyboardInline?: IInlineKb,
    data?: IData,
    baseId?: string,
    options1?: T extends `voice`
      ? IOptReplyVoice
      : T extends `video_note`
      ? IOptReplyVideoNote
      : T extends `sticker`
      ? IOptReplySticker
      : T extends `location`
      ? IOptReplyLocation
      : T extends `contact`
      ? IOptReplyContact
      : //
        IOptEditMedia1,
    options2?: IOptEditMedia2,
    fallbackReply = true
  ) {
    try {
      const { src, caption } = this.templateManager.getMedia(this.data.name, baseId, this.userLanguage, data)
      if (type == `voice`) {
        await this.delete()
        return await this.replyVoice(keyboardInline, data, baseId, options1)
      }
      if (type == `video_note`) {
        await this.delete()
        return await this.replyVoice(keyboardInline, data, baseId, options1)
      }
      if (type == `sticker`) {
        await this.delete()
        return await this.replySticker(keyboardInline, data, baseId, options1 as Record<any, any>)
      }
      if (type == `location`) {
        await this.delete()
        return await this.replyLocation(keyboardInline, data, baseId, options1 as Record<any, any>)
      }
      if (type == `contact`) {
        await this.delete()
        return await this.replyContact(keyboardInline, data, baseId, options1 as Record<any, any>)
      }

      return await this.ct.editMessageMedia(
        {
          media: src!,
          caption,
          type,
          parse_mode: `HTML`,
          ...options1
        },
        { reply_markup: keyboardInline, ...options2 }
      )
    } catch (error) {
      if (fallbackReply === true) {
        await this.reply(keyboardInline, data, baseId, options2)
      } else {
        throw error
      }
    }
  }

  public async editPhoto(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options1?: IOptEditMedia1, options2?: IOptEditMedia2) {
    return await this.editMedia(`photo`, keyboardInline, data, baseId, options1, options2)
  }

  public async editVideo(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options1?: IOptEditMedia1, options2?: IOptEditMedia2) {
    return await this.editMedia(`video`, keyboardInline, data, baseId, options1, options2)
  }

  public async editAudio(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options1?: IOptEditMedia1, options2?: IOptEditMedia2) {
    return await this.editMedia(`audio`, keyboardInline, data, baseId, options1, options2)
  }

  public async editDocument(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options1?: IOptEditMedia1, options2?: IOptEditMedia2) {
    return await this.editMedia(`document`, keyboardInline, data, baseId, options1, options2)
  }

  public async editAnimation(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options1?: IOptEditMedia1, options2?: IOptEditMedia2) {
    return await this.editMedia(`animation`, keyboardInline, data, baseId, options1, options2)
  }

  public async editVoice(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEditMedia2) {
    return await this.editMedia(`voice`, keyboardInline, data, baseId, options)
  }

  public async editVideoNote(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEditMedia2) {
    return await this.editMedia(`video_note`, keyboardInline, data, baseId, options)
  }

  public async editSticker(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEditMedia2) {
    return await this.editMedia(`sticker`, keyboardInline, data, baseId, options)
  }

  public async editLocation(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEditMedia2) {
    return await this.editMedia(`location`, keyboardInline, data, baseId, options)
  }

  public async editContact(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEditMedia2) {
    return await this.editMedia(`contact`, keyboardInline, data, baseId, options)
  }

  public async delete() {
    return await this.ct.deleteMessage()
  }

  public async callbackQueryAnswer(options?: Parameters<typeof this.ct.answerCallbackQuery>[0]) {
    try {
      return await this.ct.answerCallbackQuery(options)
    } catch {
      return null
    }
  }

  public async sessionSet(method: string, params: any, moreRoot?: Record<any, any>) {
    try {
      const value = { method, params, ...moreRoot }
      const result = await this.cacheSession.set(`${this.userId}`, value)
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
      const result = await this.cacheSession.get(`${this.userId}`)
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
      const result = await this.cacheSession.delete(`${this.userId}`)
      if (result) {
        this.session = {}
      }
      return result
    } catch {
      return null
    }
  }

  // =============== build data

  public static buildData<C extends ((...args: string[]) => any) | undefined = undefined>(callback?: C) {
    return {
      name: ``,
      callbackData: callback
        ? function (this: { name: string }, ...args: Parameters<Exclude<C, undefined>>): ReturnType<Exclude<C, undefined>> {
            const params = callback(...args)
            return `${this.name}${params == `` || params === undefined ? `` : `:${params}`}` as any
          }
        : function (this: { name: string }) {
            return this?.name
          }
    }
  }

  // =============== build keyboard

  public inlineKeyboard(callback: (kb: IInlineKb, arr: string[]) => IInlineKb, params?: { baseId?: string; data?: IData; cache?: boolean }): IInlineKb {
    const tkey = this.data.name
    if (params?.cache === true) {
      const key = `${tkey}:${this.userLanguage}:i`
      const ckb = this.cacheKeyboard.get(key)
      if (!ckb) {
        const ikb = new InlineKeyboard()
        const arr = this.templateManager.getKeyboard(tkey, params?.baseId, this.userLanguage, `inline`, params?.data)
        const rkb = callback(ikb, arr)
        this.cacheKeyboard.set(key, rkb)
        return rkb
      }
      return ckb
    }
    const ikb = new InlineKeyboard()
    const arr = this.templateManager.getKeyboard(tkey, params?.baseId, this.userLanguage, `inline`, params?.data)
    const rkb = callback(ikb, arr)
    return rkb
  }

  public bottomKeyboard(callback: (kb: IBottomKb, arr: string[]) => IBottomKb, params?: { baseId?: string; data?: IData; cache?: boolean }): IBottomKb {
    const tkey = this.data.name
    if (params?.cache === true) {
      const key = `${tkey}:${this.userLanguage}:b`
      const ckb = this.cacheKeyboard.get(key)
      if (!ckb) {
        const kb = new Keyboard()
        const arr = this.templateManager.getKeyboard(tkey, params?.baseId, this.userLanguage, `bottom`, params?.data)
        const rkb = callback(kb, arr)
        rkb.resized(true)
        this.cacheKeyboard.set(key, rkb)
        return rkb
      }
      return ckb
    }
    const kb = new Keyboard()
    const arr = this.templateManager.getKeyboard(tkey, params?.baseId, this.userLanguage, `bottom`, params?.data)
    const rkb = callback(kb, arr)
    rkb.resized()
    return rkb
  }

  // =============== most common used function
  public async transition?(...args: any): Promise<void>
  public async internal?(...args: any): Promise<void>

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
    return method === undefined ? false : method === this.methodSessionCallback(name)
  }

  public validateSessionCallbackPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionCallbackPayload(name)
  }

  // text

  public validateSessionText(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionText(name)
  }

  public validateSessionTextPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionTextPayload(name)
  }

  public validateSessionTextCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionTextCommand(name)
  }

  public validateSessionTextCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionTextCommandPayload(name)
  }

  public validateSessionTextFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionTextFree(name)
  }

  // photo

  public validateSessionPhotoCaption(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionPhotoCaption(name)
  }

  public validateSessionPhotoCaptionPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionPhotoCaptionPayload(name)
  }

  public validateSessionPhotoCaptionCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionPhotoCaptionCommand(name)
  }

  public validateSessionPhotoCaptionCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionPhotoCaptionCommandPayload(name)
  }

  public validateSessionPhotoFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionPhotoFree(name)
  }

  // video

  public validateSessionVideoCaption(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionVideoCaption(name)
  }

  public validateSessionVideoCaptionPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionVideoCaptionPayload(name)
  }

  public validateSessionVideoCaptionCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionVideoCaptionCommand(name)
  }

  public validateSessionVideoCaptionCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionVideoCaptionCommandPayload(name)
  }

  public validateSessionVideoFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionVideoFree(name)
  }

  // audio

  public validateSessionAudioCaption(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionAudioCaption(name)
  }

  public validateSessionAudioCaptionPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionAudioCaptionPayload(name)
  }

  public validateSessionAudioCaptionCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionAudioCaptionCommand(name)
  }

  public validateSessionAudioCaptionCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionAudioCaptionCommandPayload(name)
  }

  public validateSessionAudioFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionAudioFree(name)
  }

  // document

  public validateSessionDocumentCaption(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionDocumentCaption(name)
  }

  public validateSessionDocumentCaptionPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionDocumentCaptionPayload(name)
  }

  public validateSessionDocumentCaptionCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionDocumentCaptionCommand(name)
  }

  public validateSessionDocumentCaptionCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionDocumentCaptionCommandPayload(name)
  }

  public validateSessionDocumentFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionDocumentFree(name)
  }

  // animation

  public validateSessionAnimationCaption(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionAnimationCaption(name)
  }

  public validateSessionAnimationCaptionPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionAnimationCaptionPayload(name)
  }

  public validateSessionAnimationCaptionCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionAnimationCaptionCommand(name)
  }

  public validateSessionAnimationCaptionCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionAnimationCaptionCommandPayload(name)
  }

  public validateSessionAnimationFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionAnimationFree(name)
  }

  // voice

  public validateSessionVoiceCaption(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionVoiceCaption(name)
  }

  public validateSessionVoiceCaptionPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionVoiceCaptionPayload(name)
  }

  public validateSessionVoiceCaptionCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionVoiceCaptionCommand(name)
  }

  public validateSessionVoiceCaptionCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionVoiceCaptionCommandPayload(name)
  }

  public validateSessionVoiceFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionVoiceFree(name)
  }

  // video note

  public validateSessionVideoNoteCaption(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionVideoNoteCaption(name)
  }

  public validateSessionVideoNoteCaptionPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionVideoNoteCaptionPayload(name)
  }

  public validateSessionVideoNoteCaptionCommand(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionVideoNoteCaptionCommand(name)
  }

  public validateSessionVideoNoteCaptionCommandPayload(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionVideoNoteCaptionCommandPayload(name)
  }

  public validateSessionVideoNoteFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionVideoNoteFree(name)
  }

  // sticker

  public validateSessionStickerFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionStickerFree(name)
  }

  // location

  public validateSessionLocationFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionLocationFree(name)
  }

  // contact

  public validateSessionContactFree(method?: string, name?: string) {
    if (method === undefined) {
      method = this.session.method
    }
    return method === undefined ? false : method === this.methodSessionContactFree(name)
  }

  // =============== session set
  // callback

  public sessionCallback(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionCallback(name), params)
  }

  public sessionCallbackPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionCallbackPayload(name), params)
  }

  // text

  public sessionText(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionText(name), params)
  }

  public sessionTextPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionTextPayload(name), params)
  }

  public sessionTextCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionTextCommand(name), params)
  }

  public sessionTextCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionTextCommandPayload(name), params)
  }

  public sessionTextFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionTextFree(name), params)
  }

  // photo

  public sessionPhotoCaption(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionPhotoCaption(name), params)
  }

  public sessionPhotoCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionPhotoCaptionPayload(name), params)
  }

  public sessionPhotoCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionPhotoCaptionCommand(name), params)
  }

  public sessionPhotoCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionPhotoCaptionCommandPayload(name), params)
  }

  public sessionPhotoFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionPhotoFree(name), params)
  }

  // video

  public sessionVideoCaption(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoCaption(name), params)
  }

  public sessionVideoCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoCaptionPayload(name), params)
  }

  public sessionVideoCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoCaptionCommand(name), params)
  }

  public sessionVideoCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoCaptionCommandPayload(name), params)
  }

  public sessionVideoFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoFree(name), params)
  }

  // audio

  public sessionAudioCaption(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAudioCaption(name), params)
  }

  public sessionAudioCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAudioCaptionPayload(name), params)
  }

  public sessionAudioCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAudioCaptionCommand(name), params)
  }

  public sessionAudioCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAudioCaptionCommandPayload(name), params)
  }

  public sessionAudioFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAudioFree(name), params)
  }

  // document

  public sessionDocumentCaption(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionDocumentCaption(name), params)
  }

  public sessionDocumentCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionDocumentCaptionPayload(name), params)
  }

  public sessionDocumentCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionDocumentCaptionCommand(name), params)
  }

  public sessionDocumentCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionDocumentCaptionCommandPayload(name), params)
  }

  public sessionDocumentFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionDocumentFree(name), params)
  }

  // animation

  public sessionAnimationCaption(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAnimationCaption(name), params)
  }

  public sessionAnimationCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAnimationCaptionPayload(name), params)
  }

  public sessionAnimationCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAnimationCaptionCommand(name), params)
  }

  public sessionAnimationCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAnimationCaptionCommandPayload(name), params)
  }

  public sessionAnimationFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAnimationFree(name), params)
  }

  // voice

  public sessionVoiceCaption(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVoiceCaption(name), params)
  }

  public sessionVoiceCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVoiceCaptionPayload(name), params)
  }

  public sessionVoiceCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVoiceCaptionCommand(name), params)
  }

  public sessionVoiceCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVoiceCaptionCommandPayload(name), params)
  }

  public sessionVoiceFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVoiceFree(name), params)
  }

  // video note

  public sessionVideoNoteCaption(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoNoteCaption(name), params)
  }

  public sessionVideoNoteCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoNoteCaptionPayload(name), params)
  }

  public sessionVideoNoteCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoNoteCaptionCommand(name), params)
  }

  public sessionVideoNoteCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoNoteCaptionCommandPayload(name), params)
  }

  public sessionVideoNoteFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoNoteFree(name), params)
  }

  // sticker

  public sessionStickerFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionStickerFree(name), params)
  }

  // location

  public sessionLocationFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionLocationFree(name), params)
  }

  // contact

  public sessionContactFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionContactFree(name), params)
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

  public intent(str?: string, isCallbackData = true) {
    // for get intent from page name or callbackData
    if (!str) {
      str = isCallbackData ? this.data.callbackData() : this.data.name
    }

    const tag = isCallbackData ? `:` : ` `
    return str.indexOf(tag) != -1 ? (str.split(tag)[0] as string) : str
  }

  // =============== build session method

  public methodSession(prefix: string, name: string | undefined) {
    return `${prefix}-${name || this.data.name}`
  }

  // callback method

  public methodSessionCallback(name?: string) {
    return this.methodSession(`1`, name)
  }

  public methodSessionCallbackPayload(name?: string) {
    return this.methodSession(`2`, name)
  }

  // text method

  public methodSessionText(name?: string) {
    return this.methodSession(`3`, name)
  }

  public methodSessionTextPayload(name?: string) {
    return this.methodSession(`4`, name)
  }

  public methodSessionTextCommand(name?: string) {
    return this.methodSession(`5`, name)
  }

  public methodSessionTextCommandPayload(name?: string) {
    return this.methodSession(`6`, name)
  }

  public methodSessionTextFree(name?: string) {
    return this.methodSession(`7`, name)
  }

  // photo method

  public methodSessionPhotoCaption(name?: string) {
    return this.methodSession(`8`, name)
  }

  public methodSessionPhotoCaptionPayload(name?: string) {
    return this.methodSession(`9`, name)
  }

  public methodSessionPhotoCaptionCommand(name?: string) {
    return this.methodSession(`10`, name)
  }

  public methodSessionPhotoCaptionCommandPayload(name?: string) {
    return this.methodSession(`11`, name)
  }

  public methodSessionPhotoFree(name?: string) {
    return this.methodSession(`12`, name)
  }

  // video method

  public methodSessionVideoCaption(name?: string) {
    return this.methodSession(`13`, name)
  }

  public methodSessionVideoCaptionPayload(name?: string) {
    return this.methodSession(`14`, name)
  }

  public methodSessionVideoCaptionCommand(name?: string) {
    return this.methodSession(`15`, name)
  }

  public methodSessionVideoCaptionCommandPayload(name?: string) {
    return this.methodSession(`16`, name)
  }

  public methodSessionVideoFree(name?: string) {
    return this.methodSession(`17`, name)
  }

  // audio method

  public methodSessionAudioCaption(name?: string) {
    return this.methodSession(`18`, name)
  }

  public methodSessionAudioCaptionPayload(name?: string) {
    return this.methodSession(`19`, name)
  }

  public methodSessionAudioCaptionCommand(name?: string) {
    return this.methodSession(`20`, name)
  }

  public methodSessionAudioCaptionCommandPayload(name?: string) {
    return this.methodSession(`21`, name)
  }

  public methodSessionAudioFree(name?: string) {
    return this.methodSession(`22`, name)
  }

  // document method

  public methodSessionDocumentCaption(name?: string) {
    return this.methodSession(`23`, name)
  }

  public methodSessionDocumentCaptionPayload(name?: string) {
    return this.methodSession(`24`, name)
  }

  public methodSessionDocumentCaptionCommand(name?: string) {
    return this.methodSession(`25`, name)
  }

  public methodSessionDocumentCaptionCommandPayload(name?: string) {
    return this.methodSession(`26`, name)
  }

  public methodSessionDocumentFree(name?: string) {
    return this.methodSession(`27`, name)
  }

  // animation method

  public methodSessionAnimationCaption(name?: string) {
    return this.methodSession(`28`, name)
  }
  public methodSessionAnimationCaptionPayload(name?: string) {
    return this.methodSession(`29`, name)
  }
  public methodSessionAnimationCaptionCommand(name?: string) {
    return this.methodSession(`30`, name)
  }
  public methodSessionAnimationCaptionCommandPayload(name?: string) {
    return this.methodSession(`31`, name)
  }
  public methodSessionAnimationFree(name?: string) {
    return this.methodSession(`32`, name)
  }

  // voice method

  public methodSessionVoiceCaption(name?: string) {
    return this.methodSession(`33`, name)
  }
  public methodSessionVoiceCaptionPayload(name?: string) {
    return this.methodSession(`34`, name)
  }
  public methodSessionVoiceCaptionCommand(name?: string) {
    return this.methodSession(`35`, name)
  }
  public methodSessionVoiceCaptionCommandPayload(name?: string) {
    return this.methodSession(`36`, name)
  }
  public methodSessionVoiceFree(name?: string) {
    return this.methodSession(`37`, name)
  }

  // video note method
  public methodSessionVideoNoteCaption(name?: string) {
    return this.methodSession(`38`, name)
  }
  public methodSessionVideoNoteCaptionPayload(name?: string) {
    return this.methodSession(`39`, name)
  }
  public methodSessionVideoNoteCaptionCommand(name?: string) {
    return this.methodSession(`40`, name)
  }
  public methodSessionVideoNoteCaptionCommandPayload(name?: string) {
    return this.methodSession(`41`, name)
  }
  public methodSessionVideoNoteFree(name?: string) {
    return this.methodSession(`42`, name)
  }
  public methodSessionStickerFree(name?: string) {
    return this.methodSession(`43`, name) // sticker method
  }
  public methodSessionLocationFree(name?: string) {
    return this.methodSession(`44`, name) // location method
  }
  public methodSessionContactFree(name?: string) {
    return this.methodSession(`45`, name) // contact method
  }
}
