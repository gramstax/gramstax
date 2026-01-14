import {setTimeout} from "node:timers/promises"
import {CacheExternal} from "~/cache/external"
import {InlineKeyboard, Keyboard} from "grammy"
import {TemplateManager} from "~/template/manager"
import type {IMediaBlock} from "~/template/engine"
import type {
  ICt,
  IInBoKb,
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

type IPageData<T extends any[] = any[]> = {name: string; callback: (...payloads: T) => string; intentText: string; intentTextCommand: string; _positionPayloadText: number; intentCallback: string}
type ITemp = {isAnswer: boolean; session: {method?: string; params?: any}; data: Partial<IPageData<any>>; [key: string]: any}

export class Ctx {
  static template?: string // string html
  static data: IPageData<any> // for external access (**.data). example StartPage.data.callback
  data = (this.constructor as Record<any, any>).data as IPageData<any> // for internal access (this.**). example this.data.callback
  get userIsPremium() {
    return this.ct.from?.is_premium ?? false
  }
  get userIsBot() {
    return this.ct.from?.is_bot ?? false
  }
  get userId() {
    return this.ct.from?.id as number
  }
  get userName() {
    return this.ct.from?.username as string
  }
  get userFullName() {
    return `${this.ct.from?.first_name} ${this.ct.from?.last_name || ``}`
  }
  get userFirstName() {
    return this.ct.from?.first_name as string
  }
  get userLastName() {
    return this.ct.from?.last_name as string
  }
  get userLanguage() {
    return this.ct.from?.language_code as string
  }
  set userLanguage(v: string) {
    this.ct.from!.language_code = v
  }
  get msgText() {
    return this.ct.message?.text as string
  }
  get msgTextPayloads() {
    return this.getPayloads(this.msgText, `space`, this.data?._positionPayloadText || this.temp?.data?._positionPayloadText)
  }
  get msgTextPayload() {
    return this.msgTextPayloads[0] as string
  }
  get msgTextCommandPayloads() {
    return this.getPayloads(this.msgText, `space`)
  }
  get msgTextCommandPayload() {
    return this.msgTextCommandPayloads[0] as string
  }
  get msgCaption() {
    return this.ct.message?.caption as string
  }
  get msgCaptionPayloads() {
    return this.getPayloads(this.msgCaption, `space`)
  }
  get msgCaptionPayload() {
    return this.msgCaptionPayloads[0] as string
  }
  get msgCaptionCommandPayloads() {
    return this.getPayloads(this.msgCaption, `space`)
  }
  get msgCaptionCommandPayload() {
    return this.msgCaptionCommandPayloads[0] as string
  }
  get msgPhoto() {
    return this.ct.message?.photo
  }
  get msgVideo() {
    return this.ct.message?.video
  }
  get msgAudio() {
    return this.ct.message?.audio
  }
  get callbackData() {
    return this.ct.callbackQuery?.data as string
  }
  get callbackDataPayloads() {
    return this.getPayloads(this.callbackData, `colon`)
  }
  get callbackDataPayload() {
    return this.callbackDataPayloads?.[0] as string
  }
  set session(v: ITemp[`session`]) {
    this.temp.session = v
  }
  get session() {
    return this.temp.session
  }
  ct: ICt
  cacheSession: CacheExternal
  cacheKeyboard: Map<any, any>
  templateManager: TemplateManager
  temp: ITemp
  constructor(params: {ct: ICt; cacheSession: CacheExternal; cacheKeyboard: Map<any, any>; templateManager: TemplateManager; temp: ITemp}) {
    this.ct = params.ct
    this.cacheSession = params.cacheSession
    this.cacheKeyboard = params.cacheKeyboard
    this.templateManager = params.templateManager
    this.temp = params.temp
  }

  async broadcast(ids: number[], languageCode: string[], keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReply, throwError = false) {
    try {
      this.temp.isAnswer = true
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
  async reply(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReply) {
    this.temp.isAnswer = true
    const msg = this.templateManager.getMessage(this.data.name, baseId, this.userLanguage, data)
    return await this.ct.reply(msg, {
      parse_mode: `HTML`,
      reply_markup: keyboard,
      ...options
    })
  }
  async replyMedia<T extends IMediaBlock[`type`]>(
    type: T,
    keyboard?: IInBoKb,
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
    this.temp.isAnswer = true
    const med = this.templateManager.getMedia(this.data.name, baseId, this.userLanguage, data)
    const opt = {parse_mode: `HTML`, reply_markup: keyboard, ...options} as Record<any, any>

    if (type == `photo`) return await this.ct.replyWithPhoto(med.src!, {caption: med.caption!, ...opt})
    if (type == `video`) return await this.ct.replyWithVideo(med.src!, {caption: med.caption!, ...opt})
    if (type == `audio`) return await this.ct.replyWithAudio(med.src!, {caption: med.caption!, ...opt})
    if (type == `document`) return await this.ct.replyWithDocument(med.src!, {caption: med.caption!, ...opt})
    if (type == `animation`) return await this.ct.replyWithAnimation(med.src!, {caption: med.caption!, ...opt})
    if (type == `voice`) return await this.ct.replyWithVoice(med.src!, opt)
    if (type == `video_note`) return await this.ct.replyWithVideoNote(med.src!, opt)
    if (type == `sticker`) return await this.ct.replyWithSticker(med.src!, opt)
    if (type == `location`) return await this.ct.replyWithLocation(parseInt(med.latitude!), parseInt(med.longitude!), opt)
    if (type == `contact`) return await this.ct.replyWithContact(med.phone!, med.first_name!, {vcard: med.vcard!, ...opt})
  }
  async replyPhoto(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyPhoto) {
    return this.replyMedia(`photo`, keyboard, data, baseId, options)
  }
  async replyVideo(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyVideo) {
    return this.replyMedia(`video`, keyboard, data, baseId, options)
  }
  async replyAudio(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyAudio) {
    return this.replyMedia(`audio`, keyboard, data, baseId, options)
  }
  async replyDocument(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyDocument) {
    return this.replyMedia(`document`, keyboard, data, baseId, options)
  }
  async replyAnimation(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyAnimation) {
    return this.replyMedia(`animation`, keyboard, data, baseId, options)
  }
  async replyVoice(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyVoice) {
    return this.replyMedia(`voice`, keyboard, data, baseId, options)
  }
  async replyVideoNote(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyVideoNote) {
    return this.replyMedia(`video_note`, keyboard, data, baseId, options)
  }
  async replySticker(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplySticker) {
    return this.replyMedia(`sticker`, keyboard, data, baseId, options)
  }
  async replyLocation(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyLocation) {
    return this.replyMedia(`location`, keyboard, data, baseId, options)
  }
  async replyContact(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyContact) {
    return this.replyMedia(`contact`, keyboard, data, baseId, options)
  }
  async replyAction(type: ITypeReplyAction) {
    return await this.ct.replyWithChatAction(type)
  }
  async edit(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEdit, fallbackReply = true) {
    try {
      this.temp.isAnswer = true
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
  async editMedia<T extends IMediaBlock[`type`]>(
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
      this.temp.isAnswer = true
      const {src, caption} = this.templateManager.getMedia(this.data.name, baseId, this.userLanguage, data)
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
        {reply_markup: keyboardInline, ...options2}
      )
    } catch (error) {
      if (fallbackReply === true) {
        await this.reply(keyboardInline, data, baseId, options2)
      } else {
        throw error
      }
    }
  }
  async editPhoto(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options1?: IOptEditMedia1, options2?: IOptEditMedia2) {
    return await this.editMedia(`photo`, keyboardInline, data, baseId, options1, options2)
  }
  async editVideo(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options1?: IOptEditMedia1, options2?: IOptEditMedia2) {
    return await this.editMedia(`video`, keyboardInline, data, baseId, options1, options2)
  }
  async editAudio(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options1?: IOptEditMedia1, options2?: IOptEditMedia2) {
    return await this.editMedia(`audio`, keyboardInline, data, baseId, options1, options2)
  }
  async editDocument(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options1?: IOptEditMedia1, options2?: IOptEditMedia2) {
    return await this.editMedia(`document`, keyboardInline, data, baseId, options1, options2)
  }
  async editAnimation(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options1?: IOptEditMedia1, options2?: IOptEditMedia2) {
    return await this.editMedia(`animation`, keyboardInline, data, baseId, options1, options2)
  }
  async editVoice(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEditMedia2) {
    return await this.editMedia(`voice`, keyboardInline, data, baseId, options)
  }
  async editVideoNote(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEditMedia2) {
    return await this.editMedia(`video_note`, keyboardInline, data, baseId, options)
  }
  async editSticker(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEditMedia2) {
    return await this.editMedia(`sticker`, keyboardInline, data, baseId, options)
  }
  async editLocation(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEditMedia2) {
    return await this.editMedia(`location`, keyboardInline, data, baseId, options)
  }
  async editContact(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEditMedia2) {
    return await this.editMedia(`contact`, keyboardInline, data, baseId, options)
  }
  async delete() {
    return await this.ct.deleteMessage()
  }
  async callbackQueryAnswer(options?: Parameters<typeof this.ct.answerCallbackQuery>[0]) {
    try {
      this.temp.isAnswer = true
      return await this.ct.answerCallbackQuery(options)
    } catch {
      return null
    }
  }
  async sessionSet(method: string, params: any, moreRoot?: Record<any, any>) {
    try {
      const value = {method, params, ...moreRoot}
      const result = await this.cacheSession.set(`${this.userId}`, value)
      if (result) {
        this.session = value
      }
      return result
    } catch {
      return null
    }
  }
  async sessionGet(): Promise<{method: string; params: any; [moreRoot: string]: any} | null> {
    try {
      const result = await this.cacheSession.get(`${this.userId}`)
      if (result) this.session = result
      return result || null
    } catch {
      return null
    }
  }
  async sessionClear() {
    try {
      const result = await this.cacheSession.delete(`${this.userId}`)
      if (result) this.session = {}
      return result
    } catch {
      return null
    }
  }
  // =============== build data
  static buildData<C extends (...args: any[]) => any>(dataCallback: C): IPageData<Parameters<C>>
  static buildData<C extends (...args: any[]) => any>(options: {dataCallback?: C; intentText?: string; intentTextCommand?: string}): IPageData<Parameters<C>>
  static buildData(options: {dataCallback?: any; intentText?: string; intentTextCommand?: string}): IPageData<[]>
  static buildData(): IPageData<[]>
  static buildData(params?: any): IPageData<any> {
    const isFunc = typeof params === `function`
    const options = isFunc ? {dataCallback: params} : params || {}
    const cbd = options.dataCallback
    const addPld = this.prototype.addPayloads.bind(this.prototype)

    const data: IPageData<any> = {
      /**
       * Internal value derived from the file name.
       * This value is used as the default intent.
       *
       * important!: Do not set this manually. Let the system handle it.
       */
      name: ``,
      /**
       * Overrides intent value used to trigger the route function text (besides the ending "free").
       * This is typically used when you want to trigger the route using a space-separated command, for example "X Start" or "🏠 Home", with a maximum of one space.
       *
       * default: this.data.name
       * important!: Leave this unset unless explicitly needed.
       */
      intentText: options.intentText || ``,
      /**
       * Overrides intent value used to trigger the route function textCommand (besides the ending "free").
       * This is usually required when this.data.name includes a hyphen ("-"), which may interfere with default routing behavior.
       *
       * default: this.data.name
       * important!: Leave this unset unless explicitly needed.
       */
      intentTextCommand: options.intentTextCommand || ``,
      /**
       * Add payloads to intentCallback, will trigger only to route function callback (besides the ending "free").
       * This is usually used when you want to insert a payload into it.
       *
       * note: return cbd should use ARRAY only if there is a payload so that the background system can process it into a string
       *
       * default: this.data.name
       * important!: Leave this unset unless explicitly needed.
       */
      callback: cbd
        ? function (this: {intentCallback: string}, ...payloads: any[]): string {
            return addPld(this.intentCallback, `colon`, cbd(...payloads))
          }
        : function (this: {intentCallback: string}): string {
            return this?.intentCallback
          },
      /**
       * Internal intent value used to trigger route function callback (besides the ending "free").
       * if constructorParams.shortCallbackData is set to true, a numeric index value will be used instead.
       *
       * default: this.data.name
       * important!: Do not set this manually. Let the system handle it.
       */
      intentCallback: ``,
      /**
       * An internal value that specifies the payload position for the route function text.
       * The maximum allowed value is 2, which means only single spaces are supported, for example, "🏠 Home".
       *
       * default: 1
       * important!: Do not set this manually. Let the system handle it.
       */
      _positionPayloadText: options.intentText ? options.intentText.split(this.prototype.getSeperatorTag(`space`)).length : (undefined as any)
    }
    return data
  }

  // =============== build keyboard
  ikb(...args: Parameters<typeof this.inlineKeyboard>) {
    return this.inlineKeyboard(...args)
  }
  bkb(...args: Parameters<typeof this.bottomKeyboard>) {
    return this.bottomKeyboard(...args)
  }
  inlineKeyboard(callback: (k: IInlineKb, a: string[]) => IInlineKb, params?: {baseId?: string; data?: IData; cache?: boolean}): IInlineKb {
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
  bottomKeyboard(callback: (k: IBottomKb, a: string[]) => IBottomKb, params?: {baseId?: string; data?: IData; cache?: boolean}): IBottomKb {
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
  // =============== manipulation string
  getSeperatorTag(mtd: `space` | `colon` = `space`) {
    return mtd == `space` ? ` ` : `:`
  }
  havePayloads(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0]) {
    return str.includes(this.getSeperatorTag(mtd))
  }
  addPayloads(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0], pld: (string | undefined)[]) {
    const sep = this.getSeperatorTag(mtd)
    let out = ``
    for (let i = 0; i < pld.length; i++) {
      const v = pld[i]
      if (v != null && v !== ``) {
        out += sep + v
      }
    }
    return str + out
  }
  getPayloads(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0], positionStart: number = 1) {
    if (!str) return []
    const tag = this.getSeperatorTag(mtd)
    return str.split(tag).slice(positionStart)
  }
  getIntent(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0], positionEnd: number = 1) {
    if (!str) return ``
    const tag = this.getSeperatorTag(mtd)
    const spl = str.split(tag)
    return positionEnd == 1 ? (spl[0] as string) : spl.slice(0, positionEnd).join(tag)
  }
  // =============== most common used function
  async to?(...args: any): Promise<any> // for transition page
  async core?(...args: any): Promise<any> // for process core logic
  // =============== route function
  // callback
  async callback?(): Promise<void | null> // example: start
  async callbackPayload?(): Promise<void | null> // example: start:{DYNAMIC}
  // text
  async text?(): Promise<void | null> // example: start
  async textPayload?(): Promise<void | null> // example: start {...DYNAMIC}
  async textCommand?(): Promise<void | null> // example: /start
  async textCommandPayload?(): Promise<void | null> // example: /start {...DYNAMIC}
  async textFree?(): Promise<void | null> // example (for session): {...DYNAMIC}
  // photo
  async photoCaption?(): Promise<void | null>
  async photoCaptionPayload?(): Promise<void | null>
  async photoCaptionCommand?(): Promise<void | null>
  async photoCaptionCommandPayload?(): Promise<void | null>
  async photoFree?(): Promise<void | null>
  // video
  async videoCaption?(): Promise<void | null>
  async videoCaptionPayload?(): Promise<void | null>
  async videoCaptionCommand?(): Promise<void | null>
  async videoCaptionCommandPayload?(): Promise<void | null>
  async videoFree?(): Promise<void | null>
  // audio
  async audioCaption?(): Promise<void | null>
  async audioCaptionPayload?(): Promise<void | null>
  async audioCaptionCommand?(): Promise<void | null>
  async audioCaptionCommandPayload?(): Promise<void | null>
  async audioFree?(): Promise<void | null>
  // document
  async documentCaption?(): Promise<void | null>
  async documentCaptionPayload?(): Promise<void | null>
  async documentCaptionCommand?(): Promise<void | null>
  async documentCaptionCommandPayload?(): Promise<void | null>
  async documentFree?(): Promise<void | null>
  // animation
  async animationCaption?(): Promise<void | null>
  async animationCaptionPayload?(): Promise<void | null>
  async animationCaptionCommand?(): Promise<void | null>
  async animationCaptionCommandPayload?(): Promise<void | null>
  async animationFree?(): Promise<void | null>
  // voice
  async voiceCaption?(): Promise<void | null>
  async voiceCaptionPayload?(): Promise<void | null>
  async voiceCaptionCommand?(): Promise<void | null>
  async voiceCaptionCommandPayload?(): Promise<void | null>
  async voiceFree?(): Promise<void | null>
  // video_note
  async videoNoteCaption?(): Promise<void | null>
  async videoNoteCaptionPayload?(): Promise<void | null>
  async videoNoteCaptionCommand?(): Promise<void | null>
  async videoNoteCaptionCommandPayload?(): Promise<void | null>
  async videoNoteFree?(): Promise<void | null>
  // sticker
  async stickerFree?(): Promise<void | null>
  // location
  async locationFree?(): Promise<void | null>
  // contact
  async contactFree?(): Promise<void | null>
  // all
  async free?(): Promise<void | null>

  // =============== session validate
  // callback
  validateSessionCallback(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionCallback(name)
  }
  validateSessionCallbackPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionCallbackPayload(name)
  }
  // text
  validateSessionText(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionText(name)
  }
  validateSessionTextPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionTextPayload(name)
  }
  validateSessionTextCommand(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionTextCommand(name)
  }
  validateSessionTextCommandPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionTextCommandPayload(name)
  }
  validateSessionTextFree(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionTextFree(name)
  }
  // photo
  validateSessionPhotoCaption(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionPhotoCaption(name)
  }
  validateSessionPhotoCaptionPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionPhotoCaptionPayload(name)
  }
  validateSessionPhotoCaptionCommand(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionPhotoCaptionCommand(name)
  }
  validateSessionPhotoCaptionCommandPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionPhotoCaptionCommandPayload(name)
  }
  validateSessionPhotoFree(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionPhotoFree(name)
  }
  // video
  validateSessionVideoCaption(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionVideoCaption(name)
  }
  validateSessionVideoCaptionPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionVideoCaptionPayload(name)
  }
  validateSessionVideoCaptionCommand(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionVideoCaptionCommand(name)
  }
  validateSessionVideoCaptionCommandPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionVideoCaptionCommandPayload(name)
  }
  validateSessionVideoFree(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionVideoFree(name)
  }
  // audio
  validateSessionAudioCaption(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionAudioCaption(name)
  }
  validateSessionAudioCaptionPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionAudioCaptionPayload(name)
  }
  validateSessionAudioCaptionCommand(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionAudioCaptionCommand(name)
  }
  validateSessionAudioCaptionCommandPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionAudioCaptionCommandPayload(name)
  }
  validateSessionAudioFree(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionAudioFree(name)
  }
  // document
  validateSessionDocumentCaption(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionDocumentCaption(name)
  }
  validateSessionDocumentCaptionPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionDocumentCaptionPayload(name)
  }
  validateSessionDocumentCaptionCommand(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionDocumentCaptionCommand(name)
  }
  validateSessionDocumentCaptionCommandPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionDocumentCaptionCommandPayload(name)
  }
  validateSessionDocumentFree(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionDocumentFree(name)
  }
  // animation
  validateSessionAnimationCaption(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionAnimationCaption(name)
  }
  validateSessionAnimationCaptionPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionAnimationCaptionPayload(name)
  }
  validateSessionAnimationCaptionCommand(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionAnimationCaptionCommand(name)
  }
  validateSessionAnimationCaptionCommandPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionAnimationCaptionCommandPayload(name)
  }
  validateSessionAnimationFree(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionAnimationFree(name)
  }
  // voice
  validateSessionVoiceCaption(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionVoiceCaption(name)
  }
  validateSessionVoiceCaptionPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionVoiceCaptionPayload(name)
  }
  validateSessionVoiceCaptionCommand(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionVoiceCaptionCommand(name)
  }
  validateSessionVoiceCaptionCommandPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionVoiceCaptionCommandPayload(name)
  }
  validateSessionVoiceFree(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionVoiceFree(name)
  }
  // video note
  validateSessionVideoNoteCaption(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionVideoNoteCaption(name)
  }
  validateSessionVideoNoteCaptionPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionVideoNoteCaptionPayload(name)
  }
  validateSessionVideoNoteCaptionCommand(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionVideoNoteCaptionCommand(name)
  }
  validateSessionVideoNoteCaptionCommandPayload(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionVideoNoteCaptionCommandPayload(name)
  }
  validateSessionVideoNoteFree(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionVideoNoteFree(name)
  }
  // sticker
  validateSessionStickerFree(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionStickerFree(name)
  }
  // location
  validateSessionLocationFree(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionLocationFree(name)
  }
  // contact
  validateSessionContactFree(method?: string, name?: string) {
    return (method ?? this.session.method) === this.methodSessionContactFree(name)
  }
  // =============== session set
  // callback
  sessionCallback(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionCallback(name), params)
  }
  sessionCallbackPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionCallbackPayload(name), params)
  }
  // text
  sessionText(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionText(name), params)
  }
  sessionTextPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionTextPayload(name), params)
  }
  sessionTextCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionTextCommand(name), params)
  }
  sessionTextCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionTextCommandPayload(name), params)
  }
  sessionTextFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionTextFree(name), params)
  }
  // photo
  sessionPhotoCaption(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionPhotoCaption(name), params)
  }
  sessionPhotoCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionPhotoCaptionPayload(name), params)
  }
  sessionPhotoCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionPhotoCaptionCommand(name), params)
  }
  sessionPhotoCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionPhotoCaptionCommandPayload(name), params)
  }
  sessionPhotoFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionPhotoFree(name), params)
  }
  // video
  sessionVideoCaption(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoCaption(name), params)
  }
  sessionVideoCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoCaptionPayload(name), params)
  }
  sessionVideoCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoCaptionCommand(name), params)
  }
  sessionVideoCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoCaptionCommandPayload(name), params)
  }
  sessionVideoFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoFree(name), params)
  }
  // audio
  sessionAudioCaption(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAudioCaption(name), params)
  }
  sessionAudioCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAudioCaptionPayload(name), params)
  }
  sessionAudioCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAudioCaptionCommand(name), params)
  }
  sessionAudioCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAudioCaptionCommandPayload(name), params)
  }
  sessionAudioFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAudioFree(name), params)
  }
  // document
  sessionDocumentCaption(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionDocumentCaption(name), params)
  }
  sessionDocumentCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionDocumentCaptionPayload(name), params)
  }
  sessionDocumentCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionDocumentCaptionCommand(name), params)
  }
  sessionDocumentCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionDocumentCaptionCommandPayload(name), params)
  }
  sessionDocumentFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionDocumentFree(name), params)
  }
  // animation
  sessionAnimationCaption(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAnimationCaption(name), params)
  }
  sessionAnimationCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAnimationCaptionPayload(name), params)
  }
  sessionAnimationCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAnimationCaptionCommand(name), params)
  }
  sessionAnimationCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAnimationCaptionCommandPayload(name), params)
  }
  sessionAnimationFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionAnimationFree(name), params)
  }
  // voice
  sessionVoiceCaption(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVoiceCaption(name), params)
  }
  sessionVoiceCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVoiceCaptionPayload(name), params)
  }
  sessionVoiceCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVoiceCaptionCommand(name), params)
  }
  sessionVoiceCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVoiceCaptionCommandPayload(name), params)
  }
  sessionVoiceFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVoiceFree(name), params)
  }
  // video note
  sessionVideoNoteCaption(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoNoteCaption(name), params)
  }
  sessionVideoNoteCaptionPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoNoteCaptionPayload(name), params)
  }
  sessionVideoNoteCaptionCommand(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoNoteCaptionCommand(name), params)
  }
  sessionVideoNoteCaptionCommandPayload(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoNoteCaptionCommandPayload(name), params)
  }
  sessionVideoNoteFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionVideoNoteFree(name), params)
  }
  // sticker
  sessionStickerFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionStickerFree(name), params)
  }
  // location
  sessionLocationFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionLocationFree(name), params)
  }
  // contact
  sessionContactFree(params?: any, name?: string) {
    return this.sessionSet(this.methodSessionContactFree(name), params)
  }

  // =============== session update to set
  // callback
  sessionToCallback(paramsAdd?: any, name?: string) {
    return this.sessionCallback({...this.session.params, ...paramsAdd}, name)
  }
  sessionToCallbackPayload(paramsAdd?: any, name?: string) {
    return this.sessionCallbackPayload({...this.session.params, ...paramsAdd}, name)
  }
  // text
  sessionToText(paramsAdd?: any, name?: string) {
    return this.sessionText({...this.session.params, ...paramsAdd}, name)
  }
  sessionToTextPayload(paramsAdd?: any, name?: string) {
    return this.sessionTextPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToTextCommand(paramsAdd?: any, name?: string) {
    return this.sessionTextCommand({...this.session.params, ...paramsAdd}, name)
  }
  sessionToTextCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionTextCommandPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToTextFree(paramsAdd?: any, name?: string) {
    return this.sessionTextFree({...this.session.params, ...paramsAdd}, name)
  }
  // photo
  sessionToPhotoCaption(paramsAdd?: any, name?: string) {
    return this.sessionPhotoCaption({...this.session.params, ...paramsAdd}, name)
  }
  sessionToPhotoCaptionPayload(paramsAdd?: any, name?: string) {
    return this.sessionPhotoCaptionPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToPhotoCaptionCommand(paramsAdd?: any, name?: string) {
    return this.sessionPhotoCaptionCommand({...this.session.params, ...paramsAdd}, name)
  }
  sessionToPhotoCaptionCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionPhotoCaptionCommandPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToPhotoFree(paramsAdd?: any, name?: string) {
    return this.sessionPhotoFree({...this.session.params, ...paramsAdd}, name)
  }
  // video
  sessionToVideoCaption(paramsAdd?: any, name?: string) {
    return this.sessionVideoCaption({...this.session.params, ...paramsAdd}, name)
  }
  sessionToVideoCaptionPayload(paramsAdd?: any, name?: string) {
    return this.sessionVideoCaptionPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToVideoCaptionCommand(paramsAdd?: any, name?: string) {
    return this.sessionVideoCaptionCommand({...this.session.params, ...paramsAdd}, name)
  }
  sessionToVideoCaptionCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionVideoCaptionCommandPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToVideoFree(paramsAdd?: any, name?: string) {
    return this.sessionVideoFree({...this.session.params, ...paramsAdd}, name)
  }
  // audio
  sessionToAudioCaption(paramsAdd?: any, name?: string) {
    return this.sessionAudioCaption({...this.session.params, ...paramsAdd}, name)
  }
  sessionToAudioCaptionPayload(paramsAdd?: any, name?: string) {
    return this.sessionAudioCaptionPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToAudioCaptionCommand(paramsAdd?: any, name?: string) {
    return this.sessionAudioCaptionCommand({...this.session.params, ...paramsAdd}, name)
  }
  sessionToAudioCaptionCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionAudioCaptionCommandPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToAudioFree(paramsAdd?: any, name?: string) {
    return this.sessionAudioFree({...this.session.params, ...paramsAdd}, name)
  }
  // document
  sessionToDocumentCaption(paramsAdd?: any, name?: string) {
    return this.sessionDocumentCaption({...this.session.params, ...paramsAdd}, name)
  }
  sessionToDocumentCaptionPayload(paramsAdd?: any, name?: string) {
    return this.sessionDocumentCaptionPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToDocumentCaptionCommand(paramsAdd?: any, name?: string) {
    return this.sessionDocumentCaptionCommand({...this.session.params, ...paramsAdd}, name)
  }
  sessionToDocumentCaptionCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionDocumentCaptionCommandPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToDocumentFree(paramsAdd?: any, name?: string) {
    return this.sessionDocumentFree({...this.session.params, ...paramsAdd}, name)
  }
  // animation
  sessionToAnimationCaption(paramsAdd?: any, name?: string) {
    return this.sessionAnimationCaption({...this.session.params, ...paramsAdd}, name)
  }
  sessionToAnimationCaptionPayload(paramsAdd?: any, name?: string) {
    return this.sessionAnimationCaptionPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToAnimationCaptionCommand(paramsAdd?: any, name?: string) {
    return this.sessionAnimationCaptionCommand({...this.session.params, ...paramsAdd}, name)
  }
  sessionToAnimationCaptionCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionAnimationCaptionCommandPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToAnimationFree(paramsAdd?: any, name?: string) {
    return this.sessionAnimationFree({...this.session.params, ...paramsAdd}, name)
  }
  // voice
  sessionToVoiceCaption(paramsAdd?: any, name?: string) {
    return this.sessionVoiceCaption({...this.session.params, ...paramsAdd}, name)
  }
  sessionToVoiceCaptionPayload(paramsAdd?: any, name?: string) {
    return this.sessionVoiceCaptionPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToVoiceCaptionCommand(paramsAdd?: any, name?: string) {
    return this.sessionVoiceCaptionCommand({...this.session.params, ...paramsAdd}, name)
  }
  sessionToVoiceCaptionCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionVoiceCaptionCommandPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToVoiceFree(paramsAdd?: any, name?: string) {
    return this.sessionVoiceFree({...this.session.params, ...paramsAdd}, name)
  }
  // videonote
  sessionToVideoNoteCaption(paramsAdd?: any, name?: string) {
    return this.sessionVideoNoteCaption({...this.session.params, ...paramsAdd}, name)
  }
  sessionToVideoNoteCaptionPayload(paramsAdd?: any, name?: string) {
    return this.sessionVideoNoteCaptionPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToVideoNoteCaptionCommand(paramsAdd?: any, name?: string) {
    return this.sessionVideoNoteCaptionCommand({...this.session.params, ...paramsAdd}, name)
  }
  sessionToVideoNoteCaptionCommandPayload(paramsAdd?: any, name?: string) {
    return this.sessionVideoNoteCaptionCommandPayload({...this.session.params, ...paramsAdd}, name)
  }
  sessionToVideoNoteFree(paramsAdd?: any, name?: string) {
    return this.sessionVideoNoteFree({...this.session.params, ...paramsAdd}, name)
  }
  // sticker
  sessionToStickerFree(paramsAdd?: any, name?: string) {
    return this.sessionStickerFree({...this.session.params, ...paramsAdd}, name)
  }
  // location
  sessionToLocationFree(paramsAdd?: any, name?: string) {
    return this.sessionLocationFree({...this.session.params, ...paramsAdd}, name)
  }
  // contact
  sessionToContactFree(paramsAdd?: any, name?: string) {
    return this.sessionContactFree({...this.session.params, ...paramsAdd}, name)
  }
  // =============== build session method
  methodSession(prefix: string, name: string | undefined) {
    return `${prefix}-${name || this.data.name}`
  }
  // callback method
  methodSessionCallback(name?: string) {
    return this.methodSession(`1`, name)
  }
  methodSessionCallbackPayload(name?: string) {
    return this.methodSession(`2`, name)
  }
  // text method
  methodSessionText(name?: string) {
    return this.methodSession(`3`, name)
  }
  methodSessionTextPayload(name?: string) {
    return this.methodSession(`4`, name)
  }
  methodSessionTextCommand(name?: string) {
    return this.methodSession(`5`, name)
  }
  methodSessionTextCommandPayload(name?: string) {
    return this.methodSession(`6`, name)
  }
  methodSessionTextFree(name?: string) {
    return this.methodSession(`7`, name)
  }
  // photo method
  methodSessionPhotoCaption(name?: string) {
    return this.methodSession(`8`, name)
  }
  methodSessionPhotoCaptionPayload(name?: string) {
    return this.methodSession(`9`, name)
  }
  methodSessionPhotoCaptionCommand(name?: string) {
    return this.methodSession(`10`, name)
  }
  methodSessionPhotoCaptionCommandPayload(name?: string) {
    return this.methodSession(`11`, name)
  }
  methodSessionPhotoFree(name?: string) {
    return this.methodSession(`12`, name)
  }
  // video method
  methodSessionVideoCaption(name?: string) {
    return this.methodSession(`13`, name)
  }
  methodSessionVideoCaptionPayload(name?: string) {
    return this.methodSession(`14`, name)
  }
  methodSessionVideoCaptionCommand(name?: string) {
    return this.methodSession(`15`, name)
  }
  methodSessionVideoCaptionCommandPayload(name?: string) {
    return this.methodSession(`16`, name)
  }
  methodSessionVideoFree(name?: string) {
    return this.methodSession(`17`, name)
  }
  // audio method
  methodSessionAudioCaption(name?: string) {
    return this.methodSession(`18`, name)
  }
  methodSessionAudioCaptionPayload(name?: string) {
    return this.methodSession(`19`, name)
  }
  methodSessionAudioCaptionCommand(name?: string) {
    return this.methodSession(`20`, name)
  }
  methodSessionAudioCaptionCommandPayload(name?: string) {
    return this.methodSession(`21`, name)
  }
  methodSessionAudioFree(name?: string) {
    return this.methodSession(`22`, name)
  }
  // document method
  methodSessionDocumentCaption(name?: string) {
    return this.methodSession(`23`, name)
  }
  methodSessionDocumentCaptionPayload(name?: string) {
    return this.methodSession(`24`, name)
  }
  methodSessionDocumentCaptionCommand(name?: string) {
    return this.methodSession(`25`, name)
  }
  methodSessionDocumentCaptionCommandPayload(name?: string) {
    return this.methodSession(`26`, name)
  }
  methodSessionDocumentFree(name?: string) {
    return this.methodSession(`27`, name)
  }
  // animation method
  methodSessionAnimationCaption(name?: string) {
    return this.methodSession(`28`, name)
  }
  methodSessionAnimationCaptionPayload(name?: string) {
    return this.methodSession(`29`, name)
  }
  methodSessionAnimationCaptionCommand(name?: string) {
    return this.methodSession(`30`, name)
  }
  methodSessionAnimationCaptionCommandPayload(name?: string) {
    return this.methodSession(`31`, name)
  }
  methodSessionAnimationFree(name?: string) {
    return this.methodSession(`32`, name)
  }
  // voice method
  methodSessionVoiceCaption(name?: string) {
    return this.methodSession(`33`, name)
  }
  methodSessionVoiceCaptionPayload(name?: string) {
    return this.methodSession(`34`, name)
  }
  methodSessionVoiceCaptionCommand(name?: string) {
    return this.methodSession(`35`, name)
  }
  methodSessionVoiceCaptionCommandPayload(name?: string) {
    return this.methodSession(`36`, name)
  }
  methodSessionVoiceFree(name?: string) {
    return this.methodSession(`37`, name)
  }
  // video note method
  methodSessionVideoNoteCaption(name?: string) {
    return this.methodSession(`38`, name)
  }
  methodSessionVideoNoteCaptionPayload(name?: string) {
    return this.methodSession(`39`, name)
  }
  methodSessionVideoNoteCaptionCommand(name?: string) {
    return this.methodSession(`40`, name)
  }
  methodSessionVideoNoteCaptionCommandPayload(name?: string) {
    return this.methodSession(`41`, name)
  }
  methodSessionVideoNoteFree(name?: string) {
    return this.methodSession(`42`, name)
  }
  // sticker method
  methodSessionStickerFree(name?: string) {
    return this.methodSession(`43`, name)
  }
  // location method
  methodSessionLocationFree(name?: string) {
    return this.methodSession(`44`, name)
  }
  // contact method
  methodSessionContactFree(name?: string) {
    return this.methodSession(`45`, name)
  }
}
