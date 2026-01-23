import {setTimeout} from "node:timers/promises"
import {TemplateManager} from "~/template/manager"
import {InlineKeyboard, Keyboard} from "grammy"
import {CacheExternal, ICacheRpc} from "~/cache/external"
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
type ITemp = {isAnswer: boolean; session: Partial<ICacheRpc>; data: Partial<IPageData<any>>; [key: string]: any}
type IKbDest = typeof Ctx | Ctx | string
type IKbCols = `${1 | 2 | 3 | 4 | 5 | 6}` | `${1 | 2 | 3 | 4 | 5 | 6}-${1 | 2 | 3 | 4 | 5 | 6}`

/**
 * The context/page base class that provides access to user data, session management,
 * template rendering, and reply methods.
 *
 * @remarks
 * Extend this class to create page handlers. Define static `template` property for
 * HTML-like templates and static `data` via {@link Ctx.buildData} for routing configuration.
 *
 * @example Basic Without PageBase
 * ```typescript
 * import {Ctx} from "gramstax" // not recommended, use PageBase with extends Ctx instead
 * import {Menu1Page} from "./menu1"
 * import {Menu2Page} from "./menu2"
 *
 * class StartPage extends Ctx {
 *   async callback() {
 *     const kb = this.inlineKeyboardT([Menu1Page, Menu2Page])
 *     await this.reply(kb)
 *   }
 *
 *   static template = `
 *     <base>
 *       <keyboard>Button 1, Button 2</keyboard>
 *       <message>Hello {{name}}!</message>
 *     </base>
 *   `
 * }
 * ```
 *
 * @example Multi Base Id
 * ```typescript
 * import {Ctx} from "gramstax"
 * import {Menu1Page} from "./menu1"
 * import {Menu2Page} from "./menu2"
 *
 * class StartPage extends Ctx {
 *   async callback() {
 *     const kb = this.inlineKeyboardT([Menu1Page, Menu2Page], "2", "special-kb")
 *     await this.reply()
 *   }
 *
 *   static template = `
 *     <base id="special-kb">
 *       <keyboard>Button 1, Button 2</keyboard>
 *     </base>
 *     <base>
 *       <message>Hello {{name}}!</message>
 *     </base>
 *   `
 * }
 * ```
 *
 * @public
 */
export class Ctx {
  /**
   * HTML-like template string for the page.
   *
   * @remarks
   * Must contain a `<base></base>` block. Supports template interpolation with `{{variable}}` syntax.
   *
   * @example Basic
   * ```typescript
   * class MyPage extends Ctx {
   *   static template = `
   *     <base>
   *       <keyboard>Button 1, Button 2</keyboard>
   *       <message>Hello {{name}}!</message>
   *     </base>
   *   `
   * }
   * ```
   *
   * @example Multi Id
   * ```typescript
   * class MyPage extends Ctx {
   *   static template = `
   *     <base id="lah">
   *       <keyboard>Button 1, Button 2</keyboard>
   *     </base>
   *     <base>
   *       <message>Hello {{name}}!</message>
   *     </base>
   *   `
   * }
   * ```
   *
   * @example Multi Language
   * ```typescript
   * class MyPage extends Ctx {
   *   static template = `
   *     <base id="lah">
   *       <keyboard>Button 1, Button 2</keyboard>
   *       <keyboard lang="id">Tombol 1, Tombol 2</keyboard>
   *     </base>
   *     <base>
   *       <message>Hello {{name}}!</message>
   *       <message lang="id">Halo {{name}}!</message>
   *     </base>
   *   `
   * }
   * ```
   *
   * @virtual
   * @public
   */
  static template?: string

  /**
   * Page routing data created by {@link Ctx.buildData}.
   *
   * @remarks
   * Only define when you want to override the intent and have a callback payload.
   * If nothing is needed, let the system handle it automatically.
   *
   * @example
   * ```typescript
   * class MyPage extends Ctx {
   *   // For callback payload route only
   *   static data = this.buildData((confirm?: string) => [confirm])
   *
   *   // For callback payload route and text/textCommand trigger
   *   static data = this.buildData({
   *     callback: (confirm?: string) => [confirm],
   *     intentText: `my_page`,
   *     intentTextCommand: `hello`
   *   })
   * }
   * ```
   *
   * @public
   */
  static data: IPageData<any>

  /**
   * Instance-level access to the page routing data.
   *
   * @remarks
   * This property mirrors the static `data` property but is accessible via `this.data`
   * within instance methods. Use `this.data.callback()` internally.
   *
   * @example
   * ```typescript
   * async callback() {
   *   const callbackData = this.data.callback("payload1")
   *   console.log(callbackData) // "page_name:payload1"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  data = (this.constructor as Record<any, any>).data as IPageData<any>

  /**
   * Indicates whether the current user has Telegram Premium.
   *
   * @remarks
   * Returns `false` if the premium status is not available.
   *
   * @example
   * ```typescript
   * async callback() {
   *   if (this.userIsPremium) {
   *     await this.reply(undefined, {tier: "Premium"})
   *   }
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get userIsPremium() {
    return this.ct.from?.is_premium ?? false
  }

  /**
   * Indicates whether the current sender is a bot account.
   *
   * @remarks
   * Returns `false` if the bot status is not available.
   *
   * @example
   * ```typescript
   * async callback() {
   *   if (this.userIsBot) {
   *     return // Ignore bot messages
   *   }
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get userIsBot() {
    return this.ct.from?.is_bot ?? false
  }

  /**
   * The Telegram user ID from the current update context.
   *
   * @example
   * ```typescript
   * async callback() {
   *   console.log(this.userId) // 12345678
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get userId() {
    return this.ct.from?.id as number
  }

  /**
   * The Telegram username from the user profile.
   *
   * @remarks
   * May be `undefined` if the user has not set a username.
   *
   * @example
   * ```typescript
   * async callback() {
   *   console.log(this.userName) // "gramstax_user"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get userName() {
    return this.ct.from?.username as string
  }

  /**
   * The combined first and last name from the user's Telegram profile.
   *
   * @example
   * ```typescript
   * async callback() {
   *   console.log(this.userFullName) // "Alya Putri"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get userFullName() {
    return `${this.ct.from?.first_name} ${this.ct.from?.last_name || ``}`
  }

  /**
   * The user's first name from the Telegram profile.
   *
   * @example
   * ```typescript
   * async callback() {
   *   console.log(this.userFirstName) // "Alya"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get userFirstName() {
    return this.ct.from?.first_name as string
  }

  /**
   * The user's last name from the Telegram profile.
   *
   * @remarks
   * May be `undefined` if the user has not set a last name.
   *
   * @example
   * ```typescript
   * async callback() {
   *   console.log(this.userLastName) // "Putri"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get userLastName() {
    return this.ct.from?.last_name as string
  }

  /**
   * The user's language code from Telegram (e.g., "en", "id").
   *
   * @remarks
   * This property can be both read and written. Setting this value overrides
   * the language used for template rendering.
   *
   * @example
   * ```typescript
   * async callback() {
   *   console.log(this.userLanguage) // "en"
   *   this.userLanguage = "id" // Override to Indonesian
   * }
   * ```
   *
   * @public
   */
  get userLanguage() {
    return this.ct.from?.language_code as string
  }
  set userLanguage(v: string) {
    this.ct.from!.language_code = v
  }

  /**
   * The raw message text from the current update.
   *
   * @example
   * ```typescript
   * async textFree() {
   *   console.log(this.msgText) // "Hello World"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgText() {
    return this.ct.message?.text as string
  }

  /**
   * All payload tokens parsed from message text.
   *
   * @remarks
   * Splits the message text by space separator starting from the configured position.
   *
   * @example
   * ```typescript
   * // Message: "start 123 456"
   * async textPayload() {
   *   console.log(this.msgTextPayloads) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextPayloads() {
    return this.getPayloads(this.msgText, `space`, this.data?._positionPayloadText || this.temp?.data?._positionPayloadText)
  }

  /**
   * The first payload token parsed from message text.
   *
   * @example
   * ```typescript
   * // Message: "start 123 456"
   * async textPayload() {
   *   console.log(this.msgTextPayload) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextPayload() {
    return this.msgTextPayloads[0] as string
  }

  /**
   * All payload tokens from a command message.
   *
   * @remarks
   * Splits the message text by space separator starting from position 1.
   *
   * @example
   * ```typescript
   * // Message: "/start 123 456"
   * async textCommandPayload() {
   *   console.log(this.msgTextCommandPayloads) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextCommandPayloads() {
    return this.getPayloads(this.msgText, `space`)
  }

  /**
   * The first payload token from a command message.
   *
   * @example
   * ```typescript
   * // Message: "/start 123"
   * async textCommandPayload() {
   *   console.log(this.msgTextCommandPayload) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextCommandPayload() {
    return this.msgTextCommandPayloads[0] as string
  }

  /**
   * The caption text for media messages.
   *
   * @example
   * ```typescript
   * async photoFree() {
   *   console.log(this.msgCaption) // "<Photo caption>"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCaption() {
    return this.ct.message?.caption as string
  }

  /**
   * All payload tokens parsed from caption text.
   *
   * @example
   * ```typescript
   * // Caption: "start 123 456"
   * async photoCaptionPayload() {
   *   console.log(this.msgCaptionPayloads) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCaptionPayloads() {
    return this.getPayloads(this.msgCaption, `space`)
  }

  /**
   * The first payload token from caption text.
   *
   * @example
   * ```typescript
   * // Caption: "start 123 456"
   * async photoCaptionPayload() {
   *   console.log(this.msgCaptionPayload) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCaptionPayload() {
    return this.msgCaptionPayloads[0] as string
  }

  /**
   * All payload tokens from a caption command.
   *
   * @example
   * ```typescript
   * // Caption: "/photo 123 456"
   * async photoCaptionCommandPayload() {
   *   console.log(this.msgCaptionCommandPayloads) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCaptionCommandPayloads() {
    return this.getPayloads(this.msgCaption, `space`)
  }

  /**
   * The first payload token from a caption command.
   *
   * @example
   * ```typescript
   * // Caption: "/photo 123"
   * async photoCaptionCommandPayload() {
   *   console.log(this.msgCaptionCommandPayload) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCaptionCommandPayload() {
    return this.msgCaptionCommandPayloads[0] as string
  }

  /**
   * Photo sizes attached to the message.
   *
   * @example
   * ```typescript
   * async photoFree() {
   *   const photos = this.msgPhoto
   *   const largest = photos?.[photos.length - 1]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgPhoto() {
    return this.ct.message?.photo
  }

  /**
   * Video payload attached to the message.
   *
   * @example
   * ```typescript
   * async videoFree() {
   *   const video = this.msgVideo
   *   console.log(video?.file_id)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgVideo() {
    return this.ct.message?.video
  }

  /**
   * Audio payload attached to the message.
   *
   * @example
   * ```typescript
   * async audioFree() {
   *   const audio = this.msgAudio
   *   console.log(audio?.file_id)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgAudio() {
    return this.ct.message?.audio
  }

  /**
   * Document payload attached to the message.
   *
   * @example
   * ```typescript
   * async documentFree() {
   *   const doc = this.msgDocument
   *   console.log(doc?.file_name)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgDocument() {
    return this.ct.message?.document
  }

  /**
   * Animation/GIF payload attached to the message.
   *
   * @example
   * ```typescript
   * async animationFree() {
   *   const anim = this.msgAnimation
   *   console.log(anim?.file_id)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgAnimation() {
    return this.ct.message?.animation
  }

  /**
   * Voice message payload attached to the message.
   *
   * @example
   * ```typescript
   * async voiceFree() {
   *   const voice = this.msgVoice
   *   console.log(voice?.duration)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgVoice() {
    return this.ct.message?.voice
  }

  /**
   * Video note (circular video) attached to the message.
   *
   * @example
   * ```typescript
   * async videoNoteFree() {
   *   const videoNote = this.msgVideoNote
   *   console.log(videoNote?.length)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgVideoNote() {
    return this.ct.message?.video_note
  }

  /**
   * Sticker payload attached to the message.
   *
   * @example
   * ```typescript
   * async stickerFree() {
   *   const sticker = this.msgSticker
   *   console.log(sticker?.emoji)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgSticker() {
    return this.ct.message?.sticker
  }

  /**
   * Location payload attached to the message.
   *
   * @example
   * ```typescript
   * async locationFree() {
   *   const loc = this.msgLocation
   *   console.log(loc?.latitude, loc?.longitude)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgLocation() {
    return this.ct.message?.location
  }

  /**
   * Contact payload attached to the message.
   *
   * @example
   * ```typescript
   * async contactFree() {
   *   const contact = this.msgContact
   *   console.log(contact?.phone_number)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgContact() {
    return this.ct.message?.contact
  }

  /**
   * Web app data attached to the message.
   *
   * @example
   * ```typescript
   * async free() {
   *   const webAppData = this.msgWebAppData
   *   console.log(webAppData?.data)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgWebAppData() {
    return this.ct.message?.web_app_data
  }

  /**
   * Gift payload attached to the message.
   *
   * @example
   * ```typescript
   * async free() {
   *   const gift = this.msgGift
   *   console.log(gift)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgGift() {
    return this.ct.message?.gift
  }

  /**
   * Raw callback query data from inline keyboard interactions.
   *
   * @example
   * ```typescript
   * async callbackPayload() {
   *   console.log(this.callbackData) // "menu:settings:ok"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get callbackData() {
    return this.ct.callbackQuery?.data as string
  }

  /**
   * All payload tokens parsed from callback data.
   *
   * @remarks
   * Splits the callback data by colon separator.
   *
   * @example
   * ```typescript
   * // Callback: "menu:settings:ok"
   * async callbackPayload() {
   *   console.log(this.callbackDataPayloads) // ["settings", "ok"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get callbackDataPayloads() {
    return this.getPayloads(this.callbackData, `colon`)
  }

  /**
   * The first payload token parsed from callback data.
   *
   * @example
   * ```typescript
   * // Data: "menu:settings:ok"
   * async callbackPayload() {
   *   console.log(this.callbackDataPayload) // "settings"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get callbackDataPayload() {
    return this.callbackDataPayloads?.[0] as string
  }

  /**
   * Gets and setter the current session data.
   *
   * @example
   * ```typescript
   * async textFree() {
   *   const session = this.session
   *   console.log(session) // {method: "...", params: ...}
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get session() {
    return this.temp.session
  }
  set session(v: ITemp[`session`]) {
    this.temp.session = v
  }

  /**
   * The grammY context object for low-level Telegram API access.
   *
   * @internal
   */
  ct: ICt

  /**
   * External cache for session storage.
   *
   * @internal
   */
  cacheSession: CacheExternal<ICacheRpc>

  /**
   * Cache for keyboard instances.
   *
   * @internal
   */
  cacheKeyboard: Map<any, any>

  /**
   * Template manager for message rendering.
   *
   * @internal
   */
  templateManager: TemplateManager

  /**
   * Temporary state storage for the current request.
   *
   * @internal
   */
  temp: ITemp

  /**
   * Creates a new Ctx instance.
   *
   * @param params - The initialization parameters.
   * @param params.ct - The grammY context object.
   * @param params.cacheSession - External session cache.
   * @param params.cacheKeyboard - Keyboard cache map.
   * @param params.templateManager - Template manager instance.
   * @param params.temp - Temporary state object.
   *
   * @internal
   */
  constructor(params: {ct: ICt; cacheSession: CacheExternal; cacheKeyboard: Map<any, any>; templateManager: TemplateManager; temp: ITemp}) {
    this.ct = params.ct
    this.cacheSession = params.cacheSession
    this.cacheKeyboard = params.cacheKeyboard
    this.templateManager = params.templateManager
    this.temp = params.temp
  }

  /**
   * Sends a message to multiple users in bulk.
   *
   * @remarks
   * Automatically throttles after 30 messages to respect Telegram rate limits.
   * Uses each user's specified language code for template rendering.
   *
   * @param ids - Array of user IDs to send the message to.
   * @param languageCode - Array of language codes corresponding to each user.
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional grammY send options.
   * @param throwError - If true, throws errors instead of swallowing them.
   *
   * @example
   * ```typescript
   * async callback() {
   *   const userIds = [123456, 789012]
   *   const langs = ["en", "id"]
   *   await this.broadcast(userIds, langs)
   * }
   * ```
   *
   * @public
   */
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

  /**
   * Sends a text message reply using the page template.
   *
   * @param keyboard - Optional keyboard markup from {@link Ctx.inlineKeyboard} or {@link Ctx.bottomKeyboard}.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID. Defaults to `default`.
   * @param options - Optional grammY reply options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async callback() {
   *   // Automatic reply with content from this.template
   *   await this.reply()
   *
   *   // With keyboard builder and data
   *   const kb = this.inlineKeyboard((k) => k.text("OK", "ok"))
   *   await this.reply(kb, {name: "John"})
   *
   *   // With keyboard short and custom baseId between reply and keyboard
   *   const kb = this.inlineKeyboardT([StartPage], `1`, "my-custom-id")
   *   await this.reply(kb, {name: "John"}, "id-hello-world")
   * }
   * ```
   *
   * @public
   */
  async reply(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReply) {
    this.temp.isAnswer = true
    const msg = this.templateManager.getMessage(this.data.name, baseId, this.userLanguage, data)
    return await this.ct.reply(msg, {
      parse_mode: `HTML`,
      reply_markup: keyboard,
      ...options
    })
  }

  /**
   * Sends a media message reply with dynamic type selection.
   *
   * @remarks
   * This is the base method for all media reply methods. Use specific methods
   * like {@link Ctx.replyPhoto} or {@link Ctx.replyVideo} for simpler usage.
   *
   * @typeParam T - The media type to send.
   * @param type - The media type (photo, video, audio, document, animation, voice, video_note, sticker, location, contact).
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Type-specific options for the media.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async callback() {
   *   await this.replyMedia("photo")
   * }
   * ```
   *
   * @public
   */
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

  /**
   * Sends a photo message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional photo-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async callback() {
   *   await this.replyPhoto()
   * }
   * ```
   *
   * @public
   */
  async replyPhoto(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyPhoto) {
    return this.replyMedia(`photo`, keyboard, data, baseId, options)
  }

  /**
   * Sends a video message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional video-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async callback() {
   *   await this.replyVideo()
   * }
   * ```
   *
   * @public
   */
  async replyVideo(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyVideo) {
    return this.replyMedia(`video`, keyboard, data, baseId, options)
  }

  /**
   * Sends an audio message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional audio-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async callback() {
   *   await this.replyAudio()
   * }
   * ```
   *
   * @public
   */
  async replyAudio(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyAudio) {
    return this.replyMedia(`audio`, keyboard, data, baseId, options)
  }

  /**
   * Sends a document message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional document-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async callback() {
   *   await this.replyDocument()
   * }
   * ```
   *
   * @public
   */
  async replyDocument(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyDocument) {
    return this.replyMedia(`document`, keyboard, data, baseId, options)
  }

  /**
   * Sends an animation/GIF message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional animation-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async callback() {
   *   await this.replyAnimation()
   * }
   * ```
   *
   * @public
   */
  async replyAnimation(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyAnimation) {
    return this.replyMedia(`animation`, keyboard, data, baseId, options)
  }

  /**
   * Sends a voice message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional voice-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async callback() {
   *   await this.replyVoice()
   * }
   * ```
   *
   * @public
   */
  async replyVoice(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyVoice) {
    return this.replyMedia(`voice`, keyboard, data, baseId, options)
  }

  /**
   * Sends a video note (circular video) using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional video note-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async callback() {
   *   await this.replyVideoNote()
   * }
   * ```
   *
   * @public
   */
  async replyVideoNote(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyVideoNote) {
    return this.replyMedia(`video_note`, keyboard, data, baseId, options)
  }

  /**
   * Sends a sticker using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional sticker-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async callback() {
   *   await this.replySticker()
   * }
   * ```
   *
   * @public
   */
  async replySticker(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplySticker) {
    return this.replyMedia(`sticker`, keyboard, data, baseId, options)
  }

  /**
   * Sends a location using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional location-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async callback() {
   *   await this.replyLocation()
   * }
   * ```
   *
   * @public
   */
  async replyLocation(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyLocation) {
    return this.replyMedia(`location`, keyboard, data, baseId, options)
  }

  /**
   * Sends a contact using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional contact-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async callback() {
   *   await this.replyContact()
   * }
   * ```
   *
   * @public
   */
  async replyContact(keyboard?: IInBoKb, data?: IData, baseId?: string, options?: IOptReplyContact) {
    return this.replyMedia(`contact`, keyboard, data, baseId, options)
  }

  /**
   * Sends a chat action indicator (typing, uploading, etc.).
   *
   * @param type - The action type (typing, upload_photo, upload_video, etc.).
   * @returns True if the action was sent successfully.
   *
   * @example
   * ```typescript
   * async callback() {
   *   await this.replyAction("typing")
   *   // Do some work...
   *   await this.reply()
   * }
   * ```
   *
   * @public
   */
  async replyAction(type: ITypeReplyAction) {
    return await this.ct.replyWithChatAction(type)
  }
  /**
   * Edits an existing message text using the page template.
   *
   * @remarks
   * If editing fails (e.g., message too old), falls back to sending a new reply
   * unless `fallbackReply` is set to false.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional grammY edit options.
   * @param fallbackReply - If true, sends a reply if edit fails. Default: true.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async callbackPayload() {
   *   const kb = this.inlineKeyboard((k) => k.text("OK", "ok"))
   *   await this.edit(kb, {status: "updated"})
   * }
   * ```
   *
   * @public
   */
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

  /**
   * Edits an existing media message with dynamic type selection.
   *
   * @remarks
   * For media types that cannot be edited (voice, video_note, sticker, location, contact),
   * the original message is deleted and a new one is sent.
   *
   * @typeParam T - The media type to edit to.
   * @param type - The media type.
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options1 - Type-specific media options.
   * @param options2 - Additional edit options.
   * @param fallbackReply - If true, sends a reply if edit fails. Default: true.
   * @returns The edited/sent message object.
   *
   * @example
   * ```typescript
   * async callbackPayload() {
   *   await this.editMedia("photo")
   * }
   * ```
   *
   * @public
   */
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

  /**
   * Edits an existing message to show a photo.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options1 - Optional media options.
   * @param options2 - Optional edit options.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async callbackPayload() {
   *   await this.editPhoto()
   * }
   * ```
   *
   * @public
   */
  async editPhoto(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options1?: IOptEditMedia1, options2?: IOptEditMedia2) {
    return await this.editMedia(`photo`, keyboardInline, data, baseId, options1, options2)
  }

  /**
   * Edits an existing message to show a video.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options1 - Optional media options.
   * @param options2 - Optional edit options.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async callbackPayload() {
   *   await this.editVideo()
   * }
   * ```
   *
   * @public
   */
  async editVideo(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options1?: IOptEditMedia1, options2?: IOptEditMedia2) {
    return await this.editMedia(`video`, keyboardInline, data, baseId, options1, options2)
  }

  /**
   * Edits an existing message to show an audio.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options1 - Optional media options.
   * @param options2 - Optional edit options.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async callbackPayload() {
   *   await this.editAudio()
   * }
   * ```
   *
   * @public
   */
  async editAudio(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options1?: IOptEditMedia1, options2?: IOptEditMedia2) {
    return await this.editMedia(`audio`, keyboardInline, data, baseId, options1, options2)
  }

  /**
   * Edits an existing message to show a document.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options1 - Optional media options.
   * @param options2 - Optional edit options.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async callbackPayload() {
   *   await this.editDocument()
   * }
   * ```
   *
   * @public
   */
  async editDocument(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options1?: IOptEditMedia1, options2?: IOptEditMedia2) {
    return await this.editMedia(`document`, keyboardInline, data, baseId, options1, options2)
  }

  /**
   * Edits an existing message to show an animation.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options1 - Optional media options.
   * @param options2 - Optional edit options.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async callbackPayload() {
   *   await this.editAnimation()
   * }
   * ```
   *
   * @public
   */
  async editAnimation(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options1?: IOptEditMedia1, options2?: IOptEditMedia2) {
    return await this.editMedia(`animation`, keyboardInline, data, baseId, options1, options2)
  }

  /**
   * Replaces the current message with a voice message.
   *
   * @remarks
   * Voice messages cannot be edited in-place, so this deletes the original and sends a new one.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional edit options.
   * @returns The sent message object.
   *
   * @public
   */
  async editVoice(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEditMedia2) {
    return await this.editMedia(`voice`, keyboardInline, data, baseId, options)
  }

  /**
   * Replaces the current message with a video note.
   *
   * @remarks
   * Video notes cannot be edited in-place, so this deletes the original and sends a new one.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional edit options.
   * @returns The sent message object.
   *
   * @public
   */
  async editVideoNote(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEditMedia2) {
    return await this.editMedia(`video_note`, keyboardInline, data, baseId, options)
  }

  /**
   * Replaces the current message with a sticker.
   *
   * @remarks
   * Stickers cannot be edited in-place, so this deletes the original and sends a new one.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional edit options.
   * @returns The sent message object.
   *
   * @public
   */
  async editSticker(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEditMedia2) {
    return await this.editMedia(`sticker`, keyboardInline, data, baseId, options)
  }

  /**
   * Replaces the current message with a location.
   *
   * @remarks
   * Locations cannot be edited in-place, so this deletes the original and sends a new one.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional edit options.
   * @returns The sent message object.
   *
   * @public
   */
  async editLocation(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEditMedia2) {
    return await this.editMedia(`location`, keyboardInline, data, baseId, options)
  }

  /**
   * Replaces the current message with a contact.
   *
   * @remarks
   * Contacts cannot be edited in-place, so this deletes the original and sends a new one.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID.
   * @param options - Optional edit options.
   * @returns The sent message object.
   *
   * @public
   */
  async editContact(keyboardInline?: IInlineKb, data?: IData, baseId?: string, options?: IOptEditMedia2) {
    return await this.editMedia(`contact`, keyboardInline, data, baseId, options)
  }

  /**
   * Deletes the current message.
   *
   * @returns True if the message was deleted successfully.
   *
   * @example
   * ```typescript
   * async callbackPayload() {
   *   await this.delete()
   * }
   * ```
   *
   * @public
   */
  async delete() {
    return await this.ct.deleteMessage()
  }

  /**
   * Answers a callback query with an optional notification.
   *
   * @remarks
   * Should be called in callback handlers to acknowledge the callback query.
   * Errors are silently caught and return null.
   *
   * @param options - Optional answer options (text, show_alert, url, cache_time).
   * @returns True if the answer was sent, or null on error.
   *
   * @example
   * ```typescript
   * async callbackPayload() {
   *   await this.callbackQueryAnswer({text: "Action completed!"})
   *   await this.edit()
   * }
   * ```
   *
   * @public
   */
  async callbackQueryAnswer(options?: Parameters<typeof Ctx.prototype.ct.answerCallbackQuery>[0]) {
    try {
      this.temp.isAnswer = true
      return await this.ct.answerCallbackQuery(options)
    } catch {
      return null
    }
  }

  /**
   * Sets session data for the current user.
   *
   * @remarks
   * Session data is stored in the external cache and persists across requests.
   * Used to maintain state between different page interactions.
   *
   * @param method - The session method name (typically matches a route handler).
   * @param params - The session parameters to store.
   * @param moreRoot - Additional root-level properties to merge.
   * @returns True if the session was set successfully, or null on error.
   *
   * @example
   * ```typescript
   * async callback() {
   *   await this.sessionSet("textFree", {step: "awaiting_name"})
   *   await this.reply()
   * }
   * ```
   *
   * @public
   */
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
  /**
   * Retrieves session data for the current user.
   *
   * @remarks
   * Fetches the session from external cache and updates the local session property.
   *
   * @returns The session data, or null if not found or on error.
   *
   * @example
   * ```typescript
   * async textFree() {
   *   const session = await this.sessionGet()
   *   if (session?.params?.step === "awaiting_name") {
   *     // Handle name input
   *   }
   * }
   * ```
   *
   * @public
   */
  async sessionGet(): Promise<ICacheRpc | null> {
    try {
      const result = await this.cacheSession.get(`${this.userId}`)
      if (result) this.session = result
      return result || null
    } catch {
      return null
    }
  }

  /**
   * Clears session data for the current user.
   *
   * @remarks
   * Removes the session from external cache and resets the local session property.
   *
   * @returns True if the session was cleared, or null on error.
   *
   * @example
   * ```typescript
   * async callback() {
   *   await this.sessionClear()
   *   await this.reply()
   * }
   * ```
   *
   * @public
   */
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
  /**
   * Creates page routing data configuration.
   *
   * @remarks
   * This method has multiple overloads:
   * - `buildData()` - Returns default page data with no payloads.
   * - `buildData(callback)` - Returns page data with callback payloads.
   * - `buildData(options)` - Returns page data with custom options.
   *
   * The callback must return an array of payload values that will be joined
   * with the intent using colon separators.
   *
   * @typeParam C - The callback function type.
   * @param callback - A function that returns payload values as an array.
   * @returns The page data configuration object.
   *
   * @example
   * ```typescript
   * class MyPage extends Ctx {
   *   // Simple callback payload
   *   static data = this.buildData((id: string) => [id])
   *
   *   // With custom intents
   *   static data = this.buildData({
   *     callback: (action: string) => [action],
   *     intentText: "my_page",
   *     intentTextCommand: "mycommand"
   *   })
   * }
   * ```
   *
   * @public
   */
  static buildData<C extends (...args: any[]) => any>(callback: C): IPageData<Parameters<C>>
  /**
   * Creates page routing data configuration with options.
   *
   * @param options - Configuration options.
   * @param options.name - Optional page name override.
   * @param options.callback - Optional callback function for payloads.
   * @param options.intentText - Optional text intent override.
   * @param options.intentTextCommand - Optional text command intent override.
   * @returns The page data configuration object.
   *
   * @public
   */
  static buildData<C extends (...args: any[]) => any>(options: {name?: string; callback?: C; intentText?: string; intentTextCommand?: string}): IPageData<Parameters<C>>
  /**
   * Creates page routing data configuration with options (no type inference).
   * @public
   */
  static buildData(options: {name?: string; callback?: any; intentText?: string; intentTextCommand?: string}): IPageData<[]>
  /**
   * Creates default page routing data configuration.
   * @public
   */
  static buildData(): IPageData<[]>
  static buildData(params?: any): IPageData<any> {
    const isFunc = typeof params === `function`
    const options = isFunc ? {callback: params} : params || {}
    const cbd = options.callback
    const addPld = this.prototype.addPayloads.bind(this.prototype)

    const name = options.name || ``
    const data: IPageData<any> = {
      /**
       * Internal value derived from the file name.
       * This value is used as the default intent.
       *
       * important!: Do not set this manually. Let the system handle it.
       */
      name,
      /**
       * Overrides intent value used to trigger the route function text (besides the ending "free").
       * This is typically used when you want to trigger the route using a space-separated command, for example "X Start" or "🏠 Home", with a maximum of one space.
       *
       * default: this.data.name
       * important!: Leave this unset unless explicitly needed.
       */
      intentText: options.intentText || name,
      /**
       * Overrides intent value used to trigger the route function textCommand (besides the ending "free").
       * This is usually required when this.data.name includes a hyphen ("-"), which may interfere with default routing behavior.
       *
       * default: this.data.name
       * important!: Leave this unset unless explicitly needed.
       */
      intentTextCommand: options.intentTextCommand || name,
      /**
       * Internal intent value used to trigger route function callback (besides the ending "free").
       * if constructorParams.shortCallbackData is set to true, a numeric index value will be used instead.
       *
       * default: this.data.name
       * important!: Do not set this manually. Let the system handle it.
       */
      intentCallback: name,
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
  /**
   * Helper method to arrange keyboard buttons in a grid layout.
   *
   * @remarks
   * Supports custom column configurations and special handling for the last row.
   *
   * @typeParam T - The keyboard type.
   * @param k - The keyboard instance.
   * @param a - Array of button labels.
   * @param layout - Layout format: "cols" or "cols-lastRow" (e.g., "2" or "3-2").
   * @param cb - Callback to create each button.
   * @returns The keyboard instance with buttons arranged.
   *
   * @example
   * ```typescript
   * const kb = this.keyboardCols(new InlineKeyboard(), ["A", "B", "C"], "2", (e, i) => {
   *   kb.text(e, `btn:${i}`)
   * })
   * ```
   *
   * @public
   */
  keyboardCols<T = any>(k: T, a: string[], layout: IKbCols, cb: (e: string, i: number) => any): T {
    const [colsStr, lastRowStr] = layout.split(`-`)
    const cols = parseInt(colsStr!)
    const lastRow = lastRowStr ? parseInt(lastRowStr) : null
    const total = a.length
    const kb = k as any
    for (let index = 0; index < total; index++) {
      const e = a[index]!
      cb(e, index)

      // Jika tidak ada spesifikasi lastRow, pakai pola normal
      if (lastRow === null) {
        if ((index + 1) % cols === 0 && index < total - 1) {
          kb.row()
        }
      } else {
        // Ada spesifikasi lastRow
        const remainingButtons = total - (index + 1)

        // Jika sisa tombol sama dengan lastRow, row break sekarang
        if (remainingButtons === lastRow) {
          kb.row()
        }
        // Jika belum mencapai baris terakhir, pakai pola cols normal
        else if (remainingButtons > lastRow && (index + 1) % cols === 0) {
          kb.row()
        }
      }
    }
    return k
  }

  /**
   * Creates a bottom keyboard with template-based text buttons.
   *
   * @remarks
   * Shorthand for {@link Ctx.bottomKeyboard} with automatic text button creation.
   *
   * @param layout - Layout format: "cols" or "cols-lastRow". Default: "1".
   * @param baseId - Optional template base ID. IMPORTANT: If a `<base id="...">` is defined in the template, you must set baseId to the same value. Leaving baseId as undefined in this case will cause errors (for example, keyboard bindings will not work). A common mistake is defining a base ID in the template but not reusing it in the keyboard configuration.
   * @param data - Optional template interpolation data.
   * @returns The bottom keyboard instance.
   *
   * @example
   * ```typescript
   * async callback() {
   *   const kb = this.bottomKeyboardT("2")
   *   await this.reply(kb)
   * }
   * ```
   *
   * @public
   */
  bottomKeyboardT(layout: IKbCols = `1`, baseId?: string | null, data?: Record<any, any>) {
    return this.bottomKeyboard(
      (k, a) => {
        return this.keyboardCols(k, a, layout, (e) => k.text(e))
      },
      {baseId: baseId ?? undefined, data}
    )
  }

  /**
   * Creates an inline keyboard with template-based buttons linked to page destinations.
   *
   * @remarks
   * Shorthand for {@link Ctx.inlineKeyboard} with automatic callback data from page destinations.
   *
   * @param PageDest - Array of page classes or callback data strings.
   * @param layout - Layout format: "cols" or "cols-lastRow". Default: "1".
   * @param baseId - Optional template base ID. IMPORTANT: If a `<base id="...">` is defined in the template, you must set baseId to the same value. Leaving baseId as undefined in this case will cause errors (for example, keyboard bindings will not work). A common mistake is defining a base ID in the template but not reusing it in the keyboard configuration.
   * @param data - Optional template interpolation data.
   * @returns The inline keyboard instance.
   *
   * @example
   * ```typescript
   * async callback() {
   *   const kb = this.inlineKeyboardT([SettingsPage, HelpPage], "2")
   *   await this.reply(kb)
   *
   *   // Or with payload
   *   const kb = this.inlineKeyboardT([SettingsPage.data.callback(1), HelpPage.data.callback(`hi`)], "2")
   *   await this.reply(kb)
   *
   *   // Compare with builder for basic but not recomended because very long syntax, only use builder when needed.!
   *   this.inlineKeyboard((k, a) => k.text(SettingsPage.data.callback(), a[0]!).text(HelpPage.data.callback(), a[1]!))
   * }
   * ```
   *
   * @public
   */
  inlineKeyboardT(PageDest: IKbDest[], layout: IKbCols = `1`, baseId?: string | null, data?: Record<any, any>) {
    return this.inlineKeyboard(
      (k, a) => {
        return this.keyboardCols(k, a, layout, (e, i) => {
          const page = PageDest[i]!
          const data = typeof page == `string` ? page : page.data.callback()
          k.text(e, data)
        })
      },
      {baseId: baseId ?? undefined, data}
    )
  }

  /**
   * Creates an inline keyboard using a builder callback.
   *
   * @remarks
   * The callback receives the keyboard instance and an array of button labels
   * from the template. Supports optional caching for performance.
   *
   * @param callback - Builder function that receives keyboard and labels.
   * @param params - Optional parameters.
   * @param params.baseId - Optional Template base ID. IMPORTANT: If a `<base id="...">` is defined in the template, you must set baseId to the same value. Leaving baseId as undefined in this case will cause errors (for example, keyboard bindings will not work). A common mistake is defining a base ID in the template but not reusing it in the keyboard configuration.
   * @param params.data - Template interpolation data.
   * @param params.cache - If true, caches the keyboard by language.
   * @returns The inline keyboard instance.
   *
   * @example
   * ```typescript
   * async callback() {
   *   const kb = this.inlineKeyboard((k, labels) => {
   *     labels.forEach((label, i) => k.text(label, `action:${i}`))
   *     return k
   *   })
   *   await this.reply(kb)
   * }
   * ```
   *
   * @public
   */
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

  /**
   * Creates a bottom (reply) keyboard using a builder callback.
   *
   * @remarks
   * The callback receives the keyboard instance and an array of button labels
   * from the template. Automatically applies `resized()` to the keyboard.
   *
   * @param callback - Builder function that receives keyboard and labels.
   * @param params - Optional parameters.
   * @param params.baseId - Template base ID. IMPORTANT: If a `<base id="...">` is defined in the template, you must set baseId to the same value. Leaving baseId as undefined in this case will cause errors (for example, keyboard bindings will not work). A common mistake is defining a base ID in the template but not reusing it in the keyboard configuration.
   * @param params.data - Template interpolation data.
   * @param params.cache - If true, caches the keyboard by language.
   * @returns The bottom keyboard instance.
   *
   * @example
   * ```typescript
   * async callback() {
   *   const kb = this.bottomKeyboard((k, labels) => {
   *     labels.forEach(label => k.text(label))
   *     return k
   *   })
   *   await this.reply(kb)
   * }
   * ```
   *
   * @public
   */
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
  /**
   * Gets the separator character for the specified method.
   *
   * @param mtd - The separator method: "space" or "colon". Default: "space".
   * @returns The separator character (" " or ":").
   *
   * @internal
   */
  getSeperatorTag(mtd: `space` | `colon` = `space`) {
    return mtd == `space` ? ` ` : `:`
  }

  /**
   * Checks if a string contains payload separators.
   *
   * @param str - The string to check.
   * @param mtd - The separator method.
   * @returns True if the string contains the separator.
   *
   * @internal
   */
  havePayloads(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0]) {
    return str.includes(this.getSeperatorTag(mtd))
  }

  /**
   * Appends payload values to a string using the specified separator.
   *
   * @param str - The base string.
   * @param mtd - The separator method.
   * @param pld - Array of payload values to append.
   * @returns The string with appended payloads.
   *
   * @internal
   */
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

  /**
   * Extracts payload values from a string.
   *
   * @param str - The string containing payloads.
   * @param mtd - The separator method.
   * @param positionStart - Starting position for payload extraction. Default: 1.
   * @returns Array of extracted payload values.
   *
   * @internal
   */
  getPayloads(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0], positionStart: number = 1) {
    if (!str) return []
    const tag = this.getSeperatorTag(mtd)
    return str.split(tag).slice(positionStart)
  }

  /**
   * Extracts the intent portion from a string containing payloads.
   *
   * @param str - The string to extract intent from.
   * @param mtd - The separator method.
   * @param positionEnd - Number of segments to include in the intent. Default: 1.
   * @returns The intent string.
   *
   * @example
   * ```typescript
   * const intent = this.getIntent("start:123:456", "colon", 1)
   * console.log(intent) // "start"
   * ```
   *
   * @internal
   */
  getIntent(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0], positionEnd: number = 1) {
    if (!str) return ``
    const tag = this.getSeperatorTag(mtd)
    const spl = str.split(tag)
    return positionEnd == 1 ? (spl[0] as string) : spl.slice(0, positionEnd).join(tag)
  }

  // =============== most common used function
  /**
   * Transition method for navigating between pages.
   *
   * @remarks
   * Override this method in subclasses to implement page-to-page transitions.
   * This is a placeholder that must be implemented when needed.
   *
   * @param args - Transition parameters.
   * @returns Promise resolving when transition is complete.
   *
   * @virtual
   * @public
   */
  async transition?(...args: any): Promise<any>

  // =============== route function
  /**
   * Route handler for callback queries without payloads matching `intentCallback`.
   *
   * @remarks Triggered by callback data matching.
   *
   * @example callbackData = "start".
   * ```typescript
   * async callback() {
   *    this.callbackData // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async callback?(): Promise<any>

  /**
   * Route handler for callback queries with payloads matching `intentCallback`.
   *
   * @remarks Triggered by callback data with payloads.
   *
   * @example callbackData = "start:123"
   * ```typescript
   * async callbackPayload() {
   *    this.callbackData // "start:123"
   *    this.callbackDataPayload // "123"
   *    this.callbackDataPayloads // ["123"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async callbackPayload?(): Promise<any>

  /**
   * Route handler for text messages matching `intentText`.
   *
   * @remarks Triggered by exact text match.
   *
   * @example // msgText = "start"
   * ```typescript
   * async text() {
   *    this.msgText // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async text?(): Promise<any>

  /**
   * Route handler for text messages with payloads match intent `intentText`.
   *
   * @remarks Triggered by text with space-separated payloads.
   *
   * @example msgText = "start 123 aaa"
   * ```typescript
   * async textPayload() {
   *    this.msgText // "start"
   *    this.msgTextPayload // "123"
   *    this.msgTextPayloads // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async textPayload?(): Promise<any>

  /**
   * Route handler for command messages match intent `intentTextCommand`.
   *
   * @remarks Triggered by text with slash commands.
   *
   * @example msgText = "/start"
   * ```typescript
   * async textCommand() {
   *    this.msgText // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async textCommand?(): Promise<any>

  /**
   * Route handler for command messages with payloads match intent `intentTextCommand`.
   *
   * @remarks Triggered by text with commands slash with payloads.
   *
   * @example msgText = "/start 123 aaa"
   * ```typescript
   * async textCommandPayload() {
   *    this.msgText // "/start 123 aaa"
   *    this.msgTextPayload // "123"
   *    this.msgTextPayload // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async textCommandPayload?(): Promise<any>

  /**
   * Route handler for free-form text input.
   *
   * @remarks Triggered by any text not matching other routes, typically used with sessions.
   *
   * @example msgText = "hello gramstax"
   * ```typescript
   * async text() {
   *    this.msgText // "hello gramstax"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async textFree?(): Promise<any>

  // photo
  /**
   * Route function for photoCaption match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption.
   *
   * @example this.data.name = "start"
   * ```typescript
   * async photoCaption() {
   *   this.msgPhoto // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async photoCaption?(): Promise<any>

  /**
   * Route function for photoCaption with payload match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption and with payload.
   *
   * @example this.data.name = "start 123 aaa"
   * ```typescript
   * async photoCaptionPayload() {
   *   this.msgPhoto // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionPayloads // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async photoCaptionPayload?(): Promise<any>

  /**
   * Route function for photoCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption command.
   *
   * @example this.data.name = "/start"
   * ```typescript
   * async photoCaptionCommand() {
   *   this.msgPhoto // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async photoCaptionCommand?(): Promise<any>

  /**
   * Route function for photoCaptionCommandPayload with slash command and payload match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption command and payloads.
   *
   * @example this.data.name = "/start 123 aaa"
   * ```typescript
   * async photoCaptionCommandPayload() {
   *   this.msgPhoto // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionPayloads // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async photoCaptionCommandPayload?(): Promise<any>

  /**
   * Route handler for free-form photo input.
   *
   * @remarks Triggered by any photo not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async photoFree() {
   *    this.msgPhoto // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async photoFree?(): Promise<any>

  // video
  /**
   * Route function for videoCaption match intent `this.data.name`
   *
   * @remarks Triggered by video with caption.
   *
   * @example this.data.name = "start"
   * ```typescript
   * async videoCaption() {
   *   this.msgVideo // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async videoCaption?(): Promise<any>

  /**
   * Route function for videoCaption with payload match intent `this.data.name`
   *
   * @remarks Triggered by video with caption and with payload.
   *
   * @example this.data.name = "start 123 aaa"
   * ```typescript
   * async videoCaptionPayload() {
   *   this.msgVideo // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionPayloads // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async videoCaptionPayload?(): Promise<any>

  /**
   * Route function for videoCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by video with caption command.
   *
   * @example this.data.name = "/start"
   * ```typescript
   * async videoCaptionCommand() {
   *   this.msgVideo // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async videoCaptionCommand?(): Promise<any>

  /**
   * Route function for videoCaptionCommandPayload with slash command and payload match intent `this.data.name`
   *
   * @remarks Triggered by video with caption command and payloads.
   *
   * @example this.data.name = "/start 123 aaa"
   * ```typescript
   * async videoCaptionCommandPayload() {
   *   this.msgVideo // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionPayloads // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async videoCaptionCommandPayload?(): Promise<any>

  /**
   * Route handler for free-form video input.
   *
   * @remarks Triggered by any video not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async videoFree() {
   *    this.msgVideo // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async videoFree?(): Promise<any>

  // audio
  /**
   * Route function for audioCaption match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption.
   *
   * @example this.data.name = "start"
   * ```typescript
   * async audioCaption() {
   *   this.msgAudio // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async audioCaption?(): Promise<any>

  /**
   * Route function for audioCaption with payload match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption and with payload.
   *
   * @example this.data.name = "start 123 aaa"
   * ```typescript
   * async audioCaptionPayload() {
   *   this.msgAudio // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionPayloads // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async audioCaptionPayload?(): Promise<any>

  /**
   * Route function for audioCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption command.
   *
   * @example this.data.name = "/start"
   * ```typescript
   * async audioCaptionCommand() {
   *   this.msgAudio // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async audioCaptionCommand?(): Promise<any>

  /**
   * Route function for audioCaptionCommandPayload with slash command and payload match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption command and payloads.
   *
   * @example this.data.name = "/start 123 aaa"
   * ```typescript
   * async audioCaptionCommandPayload() {
   *   this.msgAudio // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionPayloads // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async audioCaptionCommandPayload?(): Promise<any>

  /**
   * Route handler for free-form audio input.
   *
   * @remarks Triggered by any audio not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async audioFree() {
   *    this.msgAudio // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async audioFree?(): Promise<any>

  // document
  /**
   * Route function for documentCaption match intent `this.data.name`
   *
   * @remarks Triggered by document with caption.
   *
   * @example this.data.name = "start"
   * ```typescript
   * async documentCaption() {
   *   this.msgDocument // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async documentCaption?(): Promise<any>

  /**
   * Route function for documentCaption with payload match intent `this.data.name`
   *
   * @remarks Triggered by document with caption and with payload.
   *
   * @example this.data.name = "start 123 aaa"
   * ```typescript
   * async documentCaptionPayload() {
   *   this.msgDocument // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionPayloads // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async documentCaptionPayload?(): Promise<any>

  /**
   * Route function for documentCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by document with caption command.
   *
   * @example this.data.name = "/start"
   * ```typescript
   * async documentCaptionCommand() {
   *   this.msgDocument // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async documentCaptionCommand?(): Promise<any>

  /**
   * Route function for documentCaptionCommandPayload with slash command and payload match intent `this.data.name`
   *
   * @remarks Triggered by document with caption command and payloads.
   *
   * @example this.data.name = "/start 123 aaa"
   * ```typescript
   * async documentCaptionCommandPayload() {
   *   this.msgDocument // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionPayloads // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async documentCaptionCommandPayload?(): Promise<any>

  /**
   * Route handler for free-form document input.
   *
   * @remarks Triggered by any document not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async documentFree() {
   *    this.msgDocument // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async documentFree?(): Promise<any>

  // animation
  /**
   * Route function for animationCaption match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption.
   *
   * @example this.data.name = "start"
   * ```typescript
   * async animationCaption() {
   *   this.msgAnimation // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async animationCaption?(): Promise<any>

  /**
   * Route function for animationCaption with payload match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption and with payload.
   *
   * @example this.data.name = "start 123 aaa"
   * ```typescript
   * async animationCaptionPayload() {
   *   this.msgAnimation // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionPayloads // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async animationCaptionPayload?(): Promise<any>

  /**
   * Route function for animationCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption command.
   *
   * @example this.data.name = "/start"
   * ```typescript
   * async animationCaptionCommand() {
   *   this.msgAnimation // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async animationCaptionCommand?(): Promise<any>

  /**
   * Route function for animationCaptionCommandPayload with slash command and payload match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption command and payloads.
   *
   * @example this.data.name = "/start 123 aaa"
   * ```typescript
   * async animationCaptionCommandPayload() {
   *   this.msgAnimation // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionPayloads // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async animationCaptionCommandPayload?(): Promise<any>

  /**
   * Route handler for free-form animation input.
   *
   * @remarks Triggered by any animation not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async animationFree() {
   *    this.msgAnimation // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async animationFree?(): Promise<any>

  // voice
  /**
   * Route function for voiceCaption match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption.
   *
   * @example this.data.name = "start"
   * ```typescript
   * async voiceCaption() {
   *   this.msgVoice // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async voiceCaption?(): Promise<any>

  /**
   * Route function for voiceCaption with payload match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption and with payload.
   *
   * @example this.data.name = "start 123 aaa"
   * ```typescript
   * async voiceCaptionPayload() {
   *   this.msgVoice // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionPayloads // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async voiceCaptionPayload?(): Promise<any>

  /**
   * Route function for voiceCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption command.
   *
   * @example this.data.name = "/start"
   * ```typescript
   * async voiceCaptionCommand() {
   *   this.msgVoice // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async voiceCaptionCommand?(): Promise<any>

  /**
   * Route function for voiceCaptionCommandPayload with slash command and payload match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption command and payloads.
   *
   * @example this.data.name = "/start 123 aaa"
   * ```typescript
   * async voiceCaptionCommandPayload() {
   *   this.msgVoice // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionPayloads // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async voiceCaptionCommandPayload?(): Promise<any>

  /**
   * Route handler for free-form voice input.
   *
   * @remarks Triggered by any voice not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async voiceFree() {
   *    this.msgVoice // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async voiceFree?(): Promise<any>

  // video_note
  /**
   * Route handler for free-form video note input.
   * @remarks Triggered by any video note not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async videoNoteFree() {
   *    this.msgVideoNote // {...}
   * }
   * ```
   * @virtual
   * @public
   */
  async videoNoteFree?(): Promise<any>

  // sticker
  /**
   * Route handler for free-form sticker input.
   *
   * @remarks Triggered by any sticker not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async stickerFree() {
   *    this.msgSticker // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async stickerFree?(): Promise<any>

  // location
  /**
   * Route handler for free-form location input.
   *
   * @remarks Triggered by any location not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async locationFree() {
   *    this.msgLocation // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async locationFree?(): Promise<any>

  // contact
  /**
   * Route handler for free-form contact input.
   *
   * @remarks Triggered by any contact not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async contactFree() {
   *    this.msgContact // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async contactFree?(): Promise<any>

  // all
  /**
   * Fallback route handler for any unmatched update.
   *
   * @remarks
   * Triggered when no other route handler matches the current update. Use this for
   * global fallback logic, logging, or safety responses.
   *
   * @example
   * ```typescript
   * async free() {
   *   // handle unexpected updates
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async free?(): Promise<any>

  /**
   * Session validation methods.
   *
   * @remarks
   * These methods validate if the current session matches a specific route handler.
   * Each `validateSession*` method compares the session method against the
   * corresponding `methodSession*` result.
   *
   * @example
   * ```typescript
   * async textFree() {
   *   const session = await this.sessionGet()
   *   if (this.validateSessionTextFree()) {
   *     // Handle the expected session flow
   *   }
   * }
   * ```
   *
   * @internal
   */
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

  /**
   * Session set helper methods.
   *
   * @remarks
   * These methods are shortcuts for {@link Ctx.sessionSet} with pre-built method names.
   * Each `session*` method sets the session for the corresponding route handler.
   *
   * @example
   * ```typescript
   * async callback() {
   *   // Set session to expect textFree input
   *   await this.sessionTextFree({data: "12345"})
   *   await this.reply()
   * }
   * ```
   *
   * @public
   */
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

  /**
   * Session update helper methods.
   *
   * @remarks
   * These methods merge additional parameters with existing session params and update
   * the session for a new route handler. Useful for multi-step flows.
   *
   * @example
   * ```typescript
   * async textFree() {
   *   // Add step info to existing session and move to next handler
   *   await this.sessionToTextFree({inputData: 2})
   * }
   * ```
   *
   * @internal
   */
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

  /**
   * Session method name builders.
   *
   * @remarks
   * These methods generate unique session method identifiers used by
   * {@link Ctx.sessionSet} and validation methods. Each `methodSession*`
   * returns a prefixed string like `"1-PageName"`.
   *
   * @internal
   */
  methodSession(prefix: string, name: string | undefined) {
    return `${prefix}-${name || this.data.name}`
  }
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
  methodSessionVideoNoteFree(name?: string) {
    return this.methodSession(`38`, name)
  }
  // sticker method
  methodSessionStickerFree(name?: string) {
    return this.methodSession(`39`, name)
  }
  // location method
  methodSessionLocationFree(name?: string) {
    return this.methodSession(`40`, name)
  }
  // contact method
  methodSessionContactFree(name?: string) {
    return this.methodSession(`41`, name)
  }
}
