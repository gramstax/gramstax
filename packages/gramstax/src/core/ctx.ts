import {setTimeout} from "node:timers/promises"
import {TemplateManager} from "~/template/manager"
import {InlineKeyboard, Keyboard} from "grammy"
import type {InputMediaAudio, InputMediaDocument, InputMediaPhoto, InputMediaVideo} from "grammy/types"
import {CacheExternal, ITCacheRpc} from "~/cache/external"
import type {ITMediaBlock} from "~/template/engine"
import type {
  ITCt,
  ITInBoKb,
  ITData,
  ITOptEdit,
  ITBottomKb,
  ITInlineKb,
  ITOptReply,
  ITOptReplyVoice,
  ITOptReplyVideo,
  ITOptEditMedia1,
  ITOptEditMedia2,
  ITOptReplyAudio,
  ITOptReplyPhoto,
  ITOptReplyContact,
  ITOptReplySticker,
  ITReplyAction,
  ITOptReplyDocument,
  ITOptReplyLocation,
  ITOptReplyAnimation,
  ITOptReplyVideoNote,
  ITBottomKbParams,
  ITInlineKbParams,
  ITBuildDataOptions,
  ITTemp,
  ITPageData,
  ITKbCols,
  ITKbDest,
  ITCtxParams
} from "~/types/t.ctx"

type ITMediaGroupType = Extract<ITMediaBlock[`type`], `photo` | `video` | `audio` | `document`>
type ITMediaGroupInput = InputMediaAudio | InputMediaDocument | InputMediaPhoto | InputMediaVideo
type ITMediaGroupItem = NonNullable<ITMediaBlock[`mediaGroup`]>[number]

class Dynamic {
  static MEDIA_GROUP_TYPES = new Set<ITMediaBlock[`type`]>([`photo`, `video`, `audio`, `document`])
}

class Helper {
  static isMediaGroupType(type: ITMediaBlock[`type`]): type is ITMediaGroupType {
    return Dynamic.MEDIA_GROUP_TYPES.has(type)
  }

  static buildMediaGroupOptions(options: Record<string, unknown>) {
    const mediaGroupOptions = {...options}
    delete mediaGroupOptions.parse_mode
    delete mediaGroupOptions.reply_markup
    return mediaGroupOptions
  }

  static buildMediaGroupFromItems(items: ITMediaGroupItem[], caption?: string): ITMediaGroupInput[] {
    return items.map((item, index) => {
      const itemCaption = index === 0 ? caption : undefined
      if (item.type === `photo`) return itemCaption ? {type: `photo`, media: item.src, caption: itemCaption, parse_mode: `HTML`} : {type: `photo`, media: item.src}
      if (item.type === `video`) return itemCaption ? {type: `video`, media: item.src, caption: itemCaption, parse_mode: `HTML`} : {type: `video`, media: item.src}
      if (item.type === `audio`) return itemCaption ? {type: `audio`, media: item.src, caption: itemCaption, parse_mode: `HTML`} : {type: `audio`, media: item.src}
      return itemCaption ? {type: `document`, media: item.src, caption: itemCaption, parse_mode: `HTML`} : {type: `document`, media: item.src}
    })
  }

  static buildMediaGroup(type: ITMediaGroupType, srcList: string[], caption?: string): ITMediaGroupInput[] {
    if (type === `photo`) {
      return srcList.map((media, index) => (index === 0 && caption ? {type: `photo`, media, caption, parse_mode: `HTML`} : {type: `photo`, media}))
    } else if (type === `video`) {
      return srcList.map((media, index) => (index === 0 && caption ? {type: `video`, media, caption, parse_mode: `HTML`} : {type: `video`, media}))
    } else if (type === `audio`) {
      return srcList.map((media, index) => (index === 0 && caption ? {type: `audio`, media, caption, parse_mode: `HTML`} : {type: `audio`, media}))
    } else {
      return srcList.map((media, index) => (index === 0 && caption ? {type: `document`, media, caption, parse_mode: `HTML`} : {type: `document`, media}))
    }
  }
}

/**
 * The context/page base class that provides access to user data, session management,
 * template rendering, and reply methods.
 *
 * @remarks
 * Extend this class to create page handlers. Define static `template` property for
 * HTML-like templates and static `data` via `Ctx.buildData` for routing configuration.
 *
 * @example Basic Without PageBase
 * ```typescript
 * import {Ctx} from "gramstax" // not recommended, use PageBase with extends Ctx instead
 * import {Menu1Page} from "./menu1"
 * import {Menu2Page} from "./menu2"
 *
 * class StartPage extends Ctx {
 *   async handleCallbackData() {
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
 *   async handleCallbackData() {
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
   * Page routing data created by `Ctx.buildData`.
   *
   * @remarks
   * Only define when you want to override the intent and have a callback arg.
   * If nothing is needed, let the system handle it automatically.
   *
   * @example
   * ```typescript
   * class MyPage extends Ctx {
   *   // For args `handle*CallbackData`
   *   static data = this.buildData((confirm?: string) => [confirm])
   *
   *   // For args `handle*CallbackData` and `handle*Text` and `handle*CommandText` (Besides "handleFree*")
   *   static data = this.buildData({
   *     callbackData: (confirm?: string) => [confirm],
   *     intentText: `my_page`,
   *     intentCommandText: `hello`
   *   })
   * }
   * ```
   *
   * @public
   */
  static data: ITPageData<any>

  /**
   * Instance-level access to the page routing data.
   *
   * @remarks
   * This property mirrors the static `data` property but is accessible via `this.data`
   * within instance methods. Use `this.data.callbackDataData()` internally.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   const callbackData = this.data.callbackData("argument_1", "args2")
   *   console.log(callbackData) // "page_name:argument_1:args2"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  data = (this.constructor as Record<any, any>).data as ITPageData<any>

  /**
   * Indicates whether the current user has Telegram Premium.
   *
   * @remarks
   * Returns `false` if the premium status is not available.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
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
   * async handleCallbackData() {
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
   * async handleCallbackData() {
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
   * async handleCallbackData() {
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
   * async handleCallbackData() {
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
   * async handleCallbackData() {
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
   * async handleCallbackData() {
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
   * async handleCallbackData() {
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
   * async handleFreeText() {
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
   * All arg tokens parsed from message text.
   *
   * @remarks
   * Splits the message text by space separator starting from the configured position.
   *
   * @example
   * ```typescript
   * // Message: "start 123 456"
   * async handleArgsText() {
   *   console.log(this.msgTextArgs) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextArgs() {
    return this.getArgs(this.msgText, `space`, this.data?._positionArgText || this.temp?.data?._positionArgText)
  }

  /**
   * The first arg token parsed from message text.
   *
   * @example
   * ```typescript
   * // Message: "start 123 456"
   * async handleArgsText() {
   *   console.log(this.msgTextArg) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextArg() {
    return this.msgTextArgs[0] as string
  }

  /**
   * All arg tokens from a command message.
   *
   * @remarks
   * Splits the message text by space separator starting from position 1.
   *
   * @example
   * ```typescript
   * // Message: "/start 123 456"
   * async handleCommandArgsText() {
   *   console.log(this.msgTextCommandArgs) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextCommandArgs() {
    return this.getArgs(this.msgText, `space`)
  }

  /**
   * The first arg token from a command message.
   *
   * @example
   * ```typescript
   * // Message: "/start 123"
   * async handleCommandArgsText() {
   *   console.log(this.msgTextCommandArg) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextCommandArg() {
    return this.msgTextCommandArgs[0] as string
  }

  /**
   * The caption text for media messages.
   *
   * @example
   * ```typescript
   * async handleFreePhoto() {
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
   * All arg tokens parsed from caption text.
   *
   * @example
   * ```typescript
   * // Caption: "start 123 456"
   * async handleCaptionArgsPhoto() {
   *   console.log(this.msgCaptionArgs) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCaptionArgs() {
    return this.getArgs(this.msgCaption, `space`)
  }

  /**
   * The first arg token from caption text.
   *
   * @example
   * ```typescript
   * // Caption: "start 123 456"
   * async handleCaptionArgsPhoto() {
   *   console.log(this.msgCaptionArg) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCaptionArg() {
    return this.msgCaptionArgs[0] as string
  }

  /**
   * All arg tokens from a caption command.
   *
   * @example
   * ```typescript
   * // Caption: "/photo 123 456"
   * async handleCommandCaptionArgsPhoto() {
   *   console.log(this.msgCommandCaptionArgs) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCommandCaptionArgs() {
    return this.getArgs(this.msgCaption, `space`)
  }

  /**
   * The first arg token from a caption command.
   *
   * @example
   * ```typescript
   * // Caption: "/photo 123"
   * async handleCommandCaptionArgsPhoto() {
   *   console.log(this.msgCommandCaptionArg) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCommandCaptionArg() {
    return this.msgCommandCaptionArgs[0] as string
  }

  /**
   * Photo sizes attached to the message.
   *
   * @example
   * ```typescript
   * async handleFreePhoto() {
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
   * Video arg attached to the message.
   *
   * @example
   * ```typescript
   * async handleFreeVideo() {
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
   * Audio arg attached to the message.
   *
   * @example
   * ```typescript
   * async handleFreeAudio() {
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
   * Document arg attached to the message.
   *
   * @example
   * ```typescript
   * async handleFreeDocument() {
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
   * Animation/GIF arg attached to the message.
   *
   * @example
   * ```typescript
   * async handleFreeAnimation() {
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
   * Voice message arg attached to the message.
   *
   * @example
   * ```typescript
   * async handleFreeVoice() {
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
   * async handleFreeVideoNote() {
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
   * Sticker arg attached to the message.
   *
   * @example
   * ```typescript
   * async handleFreeSticker() {
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
   * Location arg attached to the message.
   *
   * @example
   * ```typescript
   * async handleFreeLocation() {
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
   * Contact arg attached to the message.
   *
   * @example
   * ```typescript
   * async handleFreeContact() {
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
   * async handleFree() {
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
   * Gift arg attached to the message.
   *
   * @example
   * ```typescript
   * async handleFree() {
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
   * async handleArgsCallbackData() {
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
   * All arg tokens parsed from callback data.
   *
   * @remarks
   * Splits the callback data by colon separator.
   *
   * @example
   * ```typescript
   * // Callback: "menu:settings:ok"
   * async handleArgsCallback() {
   *   console.log(this.callbackDataArgs) // ["settings", "ok"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get callbackDataArgs() {
    return this.getArgs(this.callbackData, `colon`)
  }

  /**
   * The first arg token parsed from callback data.
   *
   * @example
   * ```typescript
   * // Data: "menu:settings:ok"
   * async handleArgsCallback() {
   *   console.log(this.callbackDataArg) // "settings"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get callbackDataArg() {
    return this.callbackDataArgs?.[0] as string
  }

  /**
   * The grammY context object for low-level Telegram API access.
   *
   * @public
   */
  ct: ITCt

  /**
   * External cache for session storage.
   *
   * @public
   */
  cacheSession: CacheExternal<ITCacheRpc>

  /**
   * Cache for keyboard instances.
   *
   * @public
   */
  cacheKeyboard: Map<any, any>

  /**
   * Template manager for message rendering.
   *
   * @public
   */
  templateManager: TemplateManager

  /**
   * Temporary state storage for the current request.
   *
   * @public
   */
  temp: ITTemp

  /**
   * Creates a new Ctx instance.
   *
   * **note:**
   * For most pages do not define a constructor
   *
   * @param params - The initialization parameters. See {@link ITCtxParams} for details.
   *
   * @public
   */
  constructor(params: ITCtxParams) {
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
   * @param baseId - Optional template base ID position for block message.
   * @param options - Optional grammY send options.
   * @param throwError - If true, throws errors instead of swallowing them.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   const userIds = [123456, 789012]
   *   const langs = ["en", "id"]
   *   await this.broadcast(userIds, langs)
   * }
   * ```
   *
   * @public
   */
  async broadcast(ids: number[], languageCode: string[], keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReply, throwError = false) {
    const res = {successCount: 0, failedCount: 0, totalCount: 0}
    res.totalCount = ids.length
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

        res.successCount += 1
        if (index + 1 == limitFree) {
          await setTimeout(1200)
        }
      }
    } catch (err) {
      res.failedCount += 1
      if (throwError) {
        throw {...res, err}
      }
    }
    return res
  }

  /**
   * Sends a media message to multiple users in bulk.
   *
   * @remarks
   * Media type and arg are inferred from the template `<media>` block.
   * If a supported media type (`photo`, `video`, `audio`, `document`) uses a pipe-delimited
   * `src`, it is sent as a Telegram media group. Telegram media groups do not support
   * reply markup, so keyboards are ignored for grouped media.
   * Automatically throttles after 30 messages to respect Telegram rate limits.
   * Uses each user's specified language code for template rendering.
   *
   * @param ids - Array of user IDs to send the media to.
   * @param languageCode - Array of language codes corresponding to each user.
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media.
   * @param options - Optional grammY send options for the inferred media type.
   * @param throwError - If true, throws errors instead of swallowing them.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   const userIds = [123456, 789012]
   *   const langs = ["en", "id"]
   *   await this.broadcastMedia(userIds, langs)
   * }
   * ```
   *
   * @public
   */
  async broadcastMedia(
    ids: number[],
    languageCode: string[],
    keyboard?: ITInBoKb,
    data?: ITData,
    baseId?: string,
    options?: ITOptReplyPhoto | ITOptReplyVideo | ITOptReplyAudio | ITOptReplyDocument | ITOptReplyAnimation | ITOptReplyVoice | ITOptReplyVideoNote | ITOptReplySticker | ITOptReplyLocation | ITOptReplyContact,
    throwError = false
  ) {
    const res = {successCount: 0, failedCount: 0, totalCount: 0}
    res.totalCount = ids.length
    try {
      this.temp.isAnswer = true
      const limitFree = 30
      const medias = languageCode.map((it) => this.templateManager.getMedia(this.data.name, baseId, it, data))

      for (let index = 0; index < ids.length; index++) {
        const id = ids[index]
        const med = medias[index]
        if (!med) {
          continue
        }
        const opt = {parse_mode: `HTML`, reply_markup: keyboard, ...options} as Record<any, any>

        if (med.type === `group` && med.mediaGroup && med.mediaGroup.length > 0) {
          await this.ct.api.sendMediaGroup(id!, Helper.buildMediaGroupFromItems(med.mediaGroup, med.caption), Helper.buildMediaGroupOptions(opt))
          res.successCount += 1
          if (index + 1 == limitFree) {
            await setTimeout(1200)
          }
          continue
        }

        if (Helper.isMediaGroupType(med.type) && med.srcList && med.srcList.length > 1) {
          await this.ct.api.sendMediaGroup(id!, Helper.buildMediaGroup(med.type, med.srcList, med.caption), Helper.buildMediaGroupOptions(opt))
          res.successCount += 1
          if (index + 1 == limitFree) {
            await setTimeout(1200)
          }
          continue
        }

        if (med.type == `photo`) await this.ct.api.sendPhoto(id!, med.src!, {caption: med.caption!, ...opt})
        if (med.type == `video`) await this.ct.api.sendVideo(id!, med.src!, {caption: med.caption!, ...opt})
        if (med.type == `audio`) await this.ct.api.sendAudio(id!, med.src!, {caption: med.caption!, ...opt})
        if (med.type == `document`) await this.ct.api.sendDocument(id!, med.src!, {caption: med.caption!, ...opt})
        if (med.type == `animation`) await this.ct.api.sendAnimation(id!, med.src!, {caption: med.caption!, ...opt})
        if (med.type == `voice`) await this.ct.api.sendVoice(id!, med.src!, opt)
        if (med.type == `video_note`) await this.ct.api.sendVideoNote(id!, med.src!, opt)
        if (med.type == `sticker`) await this.ct.api.sendSticker(id!, med.src!, opt)
        if (med.type == `location`) await this.ct.api.sendLocation(id!, parseInt(med.latitude!), parseInt(med.longitude!), opt)
        if (med.type == `contact`) await this.ct.api.sendContact(id!, med.phone!, med.first_name!, {vcard: med.vcard!, ...opt})

        res.successCount += 1
        if (index + 1 == limitFree) {
          await setTimeout(1200)
        }
      }
    } catch (err) {
      res.failedCount += 1
      if (throwError) {
        throw {...res, err}
      }
    }
    return res
  }

  /**
   * Sends a text message reply using the page template.
   *
   * @param keyboard - Optional keyboard markup from {@link Ctx.inlineKeyboard} or {@link Ctx.bottomKeyboard}.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block message.
   * @param options - Optional grammY reply options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
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
  async reply(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReply) {
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
   * @param baseId - Optional template base ID position for block media.
   * @param options - Type-specific options for the media.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyMedia("photo")
   * }
   * ```
   *
   * @public
   */
  async replyMedia<T extends Exclude<ITMediaBlock[`type`], `group`>>(
    type: T,
    keyboard?: ITInBoKb,
    data?: ITData,
    baseId?: string,
    options?: T extends `photo`
      ? ITOptReplyPhoto
      : T extends `video`
        ? ITOptReplyVideo
        : T extends `audio`
          ? ITOptReplyAudio
          : T extends `document`
            ? ITOptReplyDocument
            : T extends `animation`
              ? ITOptReplyAnimation
              : T extends `voice`
                ? ITOptReplyVoice
                : T extends `video_note`
                  ? ITOptReplyVideoNote
                  : T extends `sticker`
                    ? ITOptReplySticker
                    : T extends `location`
                      ? ITOptReplyLocation
                      : T extends `contact`
                        ? ITOptReplyContact
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
   * Sends a Telegram media group using pipe-delimited `src` values or a `<media-group>` block from the page template.
   *
   * @remarks
   * Only `photo`, `video`, `audio`, and `document` support Telegram media groups.
   * Omit `type` when the template uses `<media-group>` with per-item media types.
   * The first item receives the template caption. Telegram media groups do not support
   * reply markup, so keyboards are ignored for grouped media.
   *
   * @param type - Supported media group type.
   * @param keyboard - Ignored for media groups; kept for API symmetry with replyMedia.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media.
   * @param options - Optional media-group send options.
   * @returns The sent media group messages.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyMediaGroup("photo")
   * }
   * ```
   *
   * @public
   */
  async replyMediaGroup(type?: ITMediaGroupType, keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyPhoto | ITOptReplyVideo | ITOptReplyAudio | ITOptReplyDocument) {
    this.temp.isAnswer = true
    const med = this.templateManager.getMedia(this.data.name, baseId, this.userLanguage, data)
    const opt = {parse_mode: `HTML`, reply_markup: keyboard, ...options} as Record<any, any>
    if (med.type === `group` && med.mediaGroup && med.mediaGroup.length > 0) {
      return await this.ct.replyWithMediaGroup(Helper.buildMediaGroupFromItems(med.mediaGroup, med.caption), Helper.buildMediaGroupOptions(opt))
    }
    if (!type) {
      throw new Error(`replyMediaGroup type is required when template media is not <media-group>`)
    }
    const srcList = med.srcList && med.srcList.length > 1 ? med.srcList : med.src ? [med.src] : []
    return await this.ct.replyWithMediaGroup(Helper.buildMediaGroup(type, srcList, med.caption), Helper.buildMediaGroupOptions(opt))
  }

  /**
   * Sends a photo message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type photo.
   * @param options - Optional photo-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyPhoto()
   * }
   * ```
   *
   * @public
   */
  async replyPhoto(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyPhoto) {
    return this.replyMedia(`photo`, keyboard, data, baseId, options)
  }

  /** Sends a photo media group using pipe-delimited `src` values from the page template. */
  async replyPhotoGroup(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyPhoto) {
    return this.replyMediaGroup(`photo`, keyboard, data, baseId, options)
  }

  /**
   * Sends a video message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type video.
   * @param options - Optional video-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyVideo()
   * }
   * ```
   *
   * @public
   */
  async replyVideo(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyVideo) {
    return this.replyMedia(`video`, keyboard, data, baseId, options)
  }

  /** Sends a video media group using pipe-delimited `src` values from the page template. */
  async replyVideoGroup(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyVideo) {
    return this.replyMediaGroup(`video`, keyboard, data, baseId, options)
  }

  /**
   * Sends an audio message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type audio.
   * @param options - Optional audio-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyAudio()
   * }
   * ```
   *
   * @public
   */
  async replyAudio(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyAudio) {
    return this.replyMedia(`audio`, keyboard, data, baseId, options)
  }

  /** Sends an audio media group using pipe-delimited `src` values from the page template. */
  async replyAudioGroup(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyAudio) {
    return this.replyMediaGroup(`audio`, keyboard, data, baseId, options)
  }

  /**
   * Sends a document message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type document.
   * @param options - Optional document-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyDocument()
   * }
   * ```
   *
   * @public
   */
  async replyDocument(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyDocument) {
    return this.replyMedia(`document`, keyboard, data, baseId, options)
  }

  /** Sends a document media group using pipe-delimited `src` values from the page template. */
  async replyDocumentGroup(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyDocument) {
    return this.replyMediaGroup(`document`, keyboard, data, baseId, options)
  }

  /**
   * Sends an animation/GIF message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type animation.
   * @param options - Optional animation-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyAnimation()
   * }
   * ```
   *
   * @public
   */
  async replyAnimation(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyAnimation) {
    return this.replyMedia(`animation`, keyboard, data, baseId, options)
  }

  /**
   * Sends a voice message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type voice.
   * @param options - Optional voice-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyVoice()
   * }
   * ```
   *
   * @public
   */
  async replyVoice(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyVoice) {
    return this.replyMedia(`voice`, keyboard, data, baseId, options)
  }

  /**
   * Sends a video note (circular video) using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type video_note.
   * @param options - Optional video note-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyVideoNote()
   * }
   * ```
   *
   * @public
   */
  async replyVideoNote(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyVideoNote) {
    return this.replyMedia(`video_note`, keyboard, data, baseId, options)
  }

  /**
   * Sends a sticker using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type sticker.
   * @param options - Optional sticker-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replySticker()
   * }
   * ```
   *
   * @public
   */
  async replySticker(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplySticker) {
    return this.replyMedia(`sticker`, keyboard, data, baseId, options)
  }

  /**
   * Sends a location using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type location.
   * @param options - Optional location-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyLocation()
   * }
   * ```
   *
   * @public
   */
  async replyLocation(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyLocation) {
    return this.replyMedia(`location`, keyboard, data, baseId, options)
  }

  /**
   * Sends a contact using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type contact.
   * @param options - Optional contact-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyContact()
   * }
   * ```
   *
   * @public
   */
  async replyContact(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyContact) {
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
   * async handleCallbackData() {
   *   await this.replyAction("typing")
   *   // Do some work...
   *   await this.reply()
   * }
   * ```
   *
   * @public
   */
  async replyAction(type: ITReplyAction) {
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
   * @param baseId - Optional template base ID position for block message.
   * @param options - Optional grammY edit options.
   * @param fallbackReply - If true, sends a reply if edit fails. Default: true.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   const kb = this.inlineKeyboard((k) => k.text("OK", "ok"))
   *   await this.edit(kb, {status: "updated"})
   * }
   * ```
   *
   * @public
   */
  async edit(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options?: ITOptEdit, fallbackReply = true) {
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
   * the original message is deleted and a new one is sent. Multi-src media groups cannot
   * replace a single message, so supported pipe-delimited media groups also delete the
   * original message and send a new media group.
   *
   * @typeParam T - The media type to edit to.
   * @param type - The media type.
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media.
   * @param options1 - Type-specific media options.
   * @param options2 - Additional edit options.
   * @param fallbackReply - If true, sends a reply if edit fails. Default: true.
   * @returns The edited/sent message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editMedia("photo")
   * }
   * ```
   *
   * @public
   */
  async editMedia<T extends Exclude<ITMediaBlock[`type`], `group`>>(
    type: T,
    keyboardInline?: ITInlineKb,
    data?: ITData,
    baseId?: string,
    options1?: T extends `voice`
      ? ITOptReplyVoice
      : T extends `video_note`
        ? ITOptReplyVideoNote
        : T extends `sticker`
          ? ITOptReplySticker
          : T extends `location`
            ? ITOptReplyLocation
            : T extends `contact`
              ? ITOptReplyContact
              : //
                ITOptEditMedia1,
    options2?: ITOptEditMedia2,
    fallbackReply = true
  ) {
    try {
      this.temp.isAnswer = true
      const med = this.templateManager.getMedia(this.data.name, baseId, this.userLanguage, data)
      const {src, caption} = med
      if (Helper.isMediaGroupType(type) && med.srcList && med.srcList.length > 1) {
        await this.delete()
        return await this.replyMediaGroup(type, keyboardInline, data, baseId)
      }
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
   * @param baseId - Optional template base ID position for block media type photo.
   * @param options1 - Optional media options.
   * @param options2 - Optional edit options.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editPhoto()
   * }
   * ```
   *
   * @public
   */
  async editPhoto(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options1?: ITOptEditMedia1, options2?: ITOptEditMedia2) {
    return await this.editMedia(`photo`, keyboardInline, data, baseId, options1, options2)
  }

  /**
   * Edits an existing message to show a video.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type video.
   * @param options1 - Optional media options.
   * @param options2 - Optional edit options.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editVideo()
   * }
   * ```
   *
   * @public
   */
  async editVideo(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options1?: ITOptEditMedia1, options2?: ITOptEditMedia2) {
    return await this.editMedia(`video`, keyboardInline, data, baseId, options1, options2)
  }

  /**
   * Edits an existing message to show an audio.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type audio.
   * @param options1 - Optional media options.
   * @param options2 - Optional edit options.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editAudio()
   * }
   * ```
   *
   * @public
   */
  async editAudio(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options1?: ITOptEditMedia1, options2?: ITOptEditMedia2) {
    return await this.editMedia(`audio`, keyboardInline, data, baseId, options1, options2)
  }

  /**
   * Edits an existing message to show a document.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type document.
   * @param options1 - Optional media options.
   * @param options2 - Optional edit options.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editDocument()
   * }
   * ```
   *
   * @public
   */
  async editDocument(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options1?: ITOptEditMedia1, options2?: ITOptEditMedia2) {
    return await this.editMedia(`document`, keyboardInline, data, baseId, options1, options2)
  }

  /**
   * Replaces the current message with a photo media group.
   *
   * @remarks
   * Deletes the original message and sends a new media group via `replyMediaGroup`.
   * Useful when the template uses pipe-delimited `src` values.
   *
   * @param keyboard - Optional keyboard markup for the new message.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type photo.
   * @param options - Optional photo-specific options.
   * @returns The sent media group message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editPhotoGroup()
   * }
   * ```
   *
   * @public
   */
  async editPhotoGroup(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyPhoto) {
    await this.delete()
    return await this.replyMediaGroup(`photo`, keyboard, data, baseId, options)
  }

  /**
   * Replaces the current message with a video media group.
   *
   * @remarks
   * Deletes the original message and sends a new media group via `replyMediaGroup`.
   * Useful when the template uses pipe-delimited `src` values.
   *
   * @param keyboard - Optional keyboard markup for the new message.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type video.
   * @param options - Optional video-specific options.
   * @returns The sent media group message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editVideoGroup()
   * }
   * ```
   *
   * @public
   */
  async editVideoGroup(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyVideo) {
    await this.delete()
    return await this.replyMediaGroup(`video`, keyboard, data, baseId, options)
  }

  /**
   * Replaces the current message with an audio media group.
   *
   * @remarks
   * Deletes the original message and sends a new media group via `replyMediaGroup`.
   * Useful when the template uses pipe-delimited `src` values.
   *
   * @param keyboard - Optional keyboard markup for the new message.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type audio.
   * @param options - Optional audio-specific options.
   * @returns The sent media group message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editAudioGroup()
   * }
   * ```
   *
   * @public
   */
  async editAudioGroup(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyAudio) {
    await this.delete()
    return await this.replyMediaGroup(`audio`, keyboard, data, baseId, options)
  }

  /**
   * Replaces the current message with a document media group.
   *
   * @remarks
   * Deletes the original message and sends a new media group via `replyMediaGroup`.
   * Useful when the template uses pipe-delimited `src` values.
   *
   * @param keyboard - Optional keyboard markup for the new message.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type document.
   * @param options - Optional document-specific options.
   * @returns The sent media group message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editDocumentGroup()
   * }
   * ```
   *
   * @public
   */
  async editDocumentGroup(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyDocument) {
    await this.delete()
    return await this.replyMediaGroup(`document`, keyboard, data, baseId, options)
  }

  /**
   * Edits an existing message to show an animation.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type animation.
   * @param options1 - Optional media options.
   * @param options2 - Optional edit options.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editAnimation()
   * }
   * ```
   *
   * @public
   */
  async editAnimation(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options1?: ITOptEditMedia1, options2?: ITOptEditMedia2) {
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
   * @param baseId - Optional template base ID position for block media type voice.
   * @param options - Optional edit options.
   * @returns The sent message object.
   *
   * @public
   */
  async editVoice(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options?: ITOptEditMedia2) {
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
   * @param baseId - Optional template base ID position for block media type video_note.
   * @param options - Optional edit options.
   * @returns The sent message object.
   *
   * @public
   */
  async editVideoNote(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options?: ITOptEditMedia2) {
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
   * @param baseId - Optional template base ID position for block media type sticker.
   * @param options - Optional edit options.
   * @returns The sent message object.
   *
   * @public
   */
  async editSticker(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options?: ITOptEditMedia2) {
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
   * @param baseId - Optional template base ID position for block media type location.
   * @param options - Optional edit options.
   * @returns The sent message object.
   *
   * @public
   */
  async editLocation(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options?: ITOptEditMedia2) {
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
   * @param baseId - Optional template base ID position for block media type contact.
   * @param options - Optional edit options.
   * @returns The sent message object.
   *
   * @public
   */
  async editContact(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options?: ITOptEditMedia2) {
    return await this.editMedia(`contact`, keyboardInline, data, baseId, options)
  }

  /**
   * Deletes the current message.
   *
   * @returns True if the message was deleted successfully.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
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
   * async handleArgsCallback() {
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
   * async handleCallbackData() {
   *   await this.setSession("random_172172783jd83", {step: "awaiting_name"})
   *   await this.reply()
   * }
   * ```
   *
   * @public
   */
  async setSession(method: string, params: any, moreRoot?: Record<any, any>) {
    try {
      const value = {method, params, ...moreRoot}
      const result = await this.cacheSession.set(`${this.userId}`, value)
      if (result) {
        this.temp.session = value
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
   *   const session = await this.getSession()
   *   if (session?.params?.step === "awaiting_name") {
   *     // Handle name input
   *   }
   * ```
   *
   * @public
   */
  async getSession(): Promise<ITCacheRpc | null> {
    try {
      const result = await this.cacheSession.get(`${this.userId}`)
      if (result) this.temp.session = result
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
   * async handleCallbackData() {
   *   await this.clearSession()
   *   await this.reply()
   * }
   * ```
   *
   * @public
   */
  async clearSession() {
    try {
      const result = await this.cacheSession.delete(`${this.userId}`)
      if (result) this.temp.session = {}
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
   * - `buildData()` - Returns default page data with no args.
   * - `buildData(callbackData)` - Returns intentCallbackData + args.
   * - `buildData(options)` - Returns page data with custom options.
   *
   * The callback must return an array of arg values that will be joined
   * with the intent using colon separators.
   *
   * @typeParam C - The callback function type.
   * @param callbackData - A function that returns arg values as an array.
   * @returns The page data configuration object.
   *
   * @example
   * ```typescript
   * class MyPage extends Ctx {
   *   // Simple callback arg
   *   static data = this.buildData((id: string) => [id])
   *
   *   // With custom intents
   *   static data = this.buildData({
   *     callbackData: (action: string) => [action],
   *     intentText: "my_page",
   *     intentCommandText: "mycommand"
   *   })
   * }
   * ```
   *
   * @public
   */
  static buildData<C extends (...args: any[]) => any>(callbackData: C): ITPageData<Parameters<C>>

  /**
   * Creates page routing data configuration with options.
   *
   * @param options - Configuration options. See {@link ITBuildDataOptions} for details.
   * @returns The page data configuration object.
   *
   * @public
   */
  static buildData<C extends (...args: any[]) => any>(options: ITBuildDataOptions): ITPageData<Parameters<C>>

  /**
   * Creates page routing data configuration with options (no type inference).
   *
   * @param options - Configuration options. See {@link ITBuildDataOptions} for details.
   * @returns The page data configuration object.
   *
   * @public
   */
  static buildData(options: ITBuildDataOptions): ITPageData<[]>

  /**
   * Creates default page routing data configuration.
   * @public
   */
  static buildData(): ITPageData<[]>
  static buildData(params?: any): ITPageData<any> {
    const isFunc = typeof params === `function`
    const options = isFunc ? {callbackData: params} : params || {}
    const cbd = options.callbackData
    const addPld = this.prototype.addArgs.bind(this.prototype)

    const name = options.name || ``
    const data: ITPageData<any> = {
      name,
      intentText: options.intentText || name,
      intentCommandText: options.intentCommandText || name,
      intentCallbackData: name,
      callbackData: cbd
        ? function (this: {intentCallbackData: string}, ...args: any[]): string {
            return addPld(this.intentCallbackData, `colon`, cbd(...args))
          }
        : function (this: {intentCallbackData: string}): string {
            return this?.intentCallbackData
          },
      _positionArgText: options.intentText ? options.intentText.split(this.prototype.getSeperatorTag(`space`)).length : (undefined as any)
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
   * @param l - Array of button labels.
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
  keyboardCols<T = any>(k: T, l: string[], layout: ITKbCols, cb: (e: string, i: number) => any): T {
    const [colsStr, lastRowStr] = layout.split(`-`)
    const cols = parseInt(colsStr!)
    const lastRow = lastRowStr ? parseInt(lastRowStr) : null
    const total = l.length
    const kb = k as any
    for (let index = 0; index < total; index++) {
      const e = l[index]!
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
   * @param baseId - Optional template base ID position for block keyboard. IMPORTANT: If a `<base id="...">` is defined in the template, you must set baseId to the same value. Leaving baseId as undefined in this case will cause errors (for example, keyboard bindings will not work). A common mistake is defining a base ID in the template but not reusing it in the keyboard configuration.
   * @param data - Optional template interpolation data.
   * @returns The bottom keyboard instance.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   const kb = this.bottomKeyboardT("2")
   *   await this.reply(kb)
   * }
   * ```
   *
   * @public
   */
  bottomKeyboardT(layout: ITKbCols = `1`, baseId?: string | null, data?: Record<any, any>) {
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
   * @param baseId - Optional template base ID position block keyboard. IMPORTANT: If a `<base id="...">` is defined in the template, you must set baseId to the same value. Leaving baseId as undefined in this case will cause errors (for example, keyboard bindings will not work). A common mistake is defining a base ID in the template but not reusing it in the keyboard configuration.
   * @param data - Optional template interpolation data.
   * @returns The inline keyboard instance.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   const kb = this.inlineKeyboardT([SettingsPage, HelpPage], "2")
   *   await this.reply(kb)
   *
   *   // Or with arg
   *   const kb = this.inlineKeyboardT([SettingsPage.data.callbackData(1), HelpPage.data.callbackData(`hi`)], "2")
   *   await this.reply(kb)
   *
   *   // Compare with builder for basic but not recomended because very long syntax, only use builder when needed.!
   *   this.inlineKeyboard((k, a) => k.text(SettingsPage.data.callbackData(), a[0]!).text(HelpPage.data.callbackData(), a[1]!))
   * }
   * ```
   *
   * @public
   */
  inlineKeyboardT(PageDest: ITKbDest[], layout: ITKbCols = `1`, baseId?: string | null, data?: ITData) {
    return this.inlineKeyboard(
      (k, a) => {
        return this.keyboardCols(k, a, layout, (e, i) => {
          const page = PageDest[i]!
          const data = typeof page == `string` ? page : page.data.callbackData()
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
   * @param params - Optional parameters. {@link ITInlineKbParams} for details.
   * @returns The inline keyboard instance.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
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
  inlineKeyboard(callback: (k: ITInlineKb, l: string[]) => ITInlineKb, params?: ITInlineKbParams): ITInlineKb {
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
   * @param params - Optional parameters. {@link ITBottomKbParams} for details.
   * @returns The bottom keyboard instance.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
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
  bottomKeyboard(callback: (k: ITBottomKb, l: string[]) => ITBottomKb, params?: ITBottomKbParams): ITBottomKb {
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
   * @public
   */
  getSeperatorTag(mtd: `space` | `colon` = `space`) {
    return mtd == `space` ? ` ` : `:`
  }

  /**
   * Checks if a string contains arg separators.
   *
   * @param str - The string to check.
   * @param mtd - The separator method.
   * @returns True if the string contains the separator.
   *
   * @public
   */
  haveArgs(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0]) {
    return str.includes(this.getSeperatorTag(mtd))
  }

  /**
   * Appends arg values to a string using the specified separator.
   *
   * @param str - The base string.
   * @param mtd - The separator method.
   * @param pld - Array of arg values to append.
   * @returns The string with appended args.
   *
   * @public
   */
  addArgs(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0], pld: (string | undefined)[]) {
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
   * Extracts arg values from a string.
   *
   * @param str - The string containing args.
   * @param mtd - The separator method.
   * @param positionStart - Starting position for arg extraction. Default: 1.
   * @returns Array of extracted arg values.
   *
   * @public
   */
  getArgs(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0], positionStart: number = 1) {
    if (!str) return []
    const tag = this.getSeperatorTag(mtd)
    return str.split(tag).slice(positionStart)
  }

  /**
   * Extracts the intent portion from a string containing args.
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
   * @public
   */
  getIntent(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0], positionEnd: number = 1) {
    if (!str) return ``
    const tag = this.getSeperatorTag(mtd)
    const spl = str.split(tag)
    return positionEnd == 1 ? (spl[0] as string) : spl.slice(0, positionEnd).join(tag)
  }

  // =============== route function
  /**
   * Route handler for callback queries without args matching `intentCallbackData`.
   *
   * @remarks Triggered by callback query data matching.
   *
   * @example this.callbackData = "start".
   * ```typescript
   * async handleCallbackData() {
   *    this.callbackData // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCallbackData?(): Promise<any>

  /**
   * Route handler for callback queries with args matching `intentCallbackData`.
   *
   * @remarks Triggered by callback data with args.
   *
   * @example this.callbackData = "start:123"
   * ```typescript
   * async handleArgsCallbackData() {
   *    this.callbackData // "start:123"
   *    this.callbackDataArg // "123"
   *    this.callbackDataArgs // ["123"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleArgsCallbackData?(): Promise<any>

  /**
   * Route handler for text messages matching `intentText`.
   *
   * @remarks Triggered by exact text match.
   *
   * @example this.msgText = "start"
   * ```typescript
   * async handleText() {
   *    this.msgText // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleText?(): Promise<any>

  /**
   * Route handler for text messages with args match intent `intentText`.
   *
   * @remarks Triggered by text with space-separated args.
   *
   * @example this.msgText = "start 123 aaa"
   * ```typescript
   * async handleTextArgs() {
   *    this.msgText // "start 123 aaa"
   *    this.msgTextArg // "123"
   *    this.msgTextArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleArgsText?(): Promise<any>

  /**
   * Route handler for command messages match intent `intentCommandText`.
   *
   * @remarks Triggered by text with slash commands.
   *
   * @example this.msgText = "/start"
   * ```typescript
   * async handleCommandText() {
   *    this.msgText // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCommandText?(): Promise<any>

  /**
   * Route handler for command messages with args match intent `intentCommandText`.
   *
   * @remarks Triggered by text with commands slash with args.
   *
   * @example this.msgText = "/start 123 aaa"
   * ```typescript
   * async handleCommandTextArgs() {
   *    this.msgText // "/start 123 aaa"
   *    this.msgTextArg // "123"
   *    this.msgTextArg // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCommandArgsText?(): Promise<any>

  /**
   * Route handler for free-form text input.
   *
   * @remarks Triggered by any text not matching other routes, typically used with sessions.
   *
   * @example this.msgText = "hello gramstax, random: 12848s8283n183m"
   * ```typescript
   * async handleFreeText() {
   *    this.msgText // "hello gramstax, random: 12848s8283n183m"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeText?(): Promise<any>

  // photo
  /**
   * Route function for photoCaptio match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption.
   *
   * @example this.data.name = "start" && this.msgPhoto
   * ```typescript
   * async handleCaptionPhoto() {
   *   this.msgPhoto // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionPhoto?(): Promise<any>

  /**
   * Route function for photoCaption with arg match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa" && this.msgPhoto
   * ```typescript
   * async handleCaptionArgsPhoto() {
   *   this.msgPhoto // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsPhoto?(): Promise<any>

  /**
   * Route function for photoCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption command.
   *
   * @example this.data.name = "/start" && this.msgPhoto
   * ```typescript
   * async handleCommandCaptionPhoto() {
   *   this.msgPhoto // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionPhoto?(): Promise<any>

  /**
   * Route function for `handleCommandCaptionArgsPhoto` with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa" && this.msgPhoto
   * ```typescript
   * async handleCommandCaptionArgsPhoto() {
   *   this.msgPhoto // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async handleCommandCaptionArgsPhoto?(): Promise<any>

  /**
   * Route handler for free-form photo input.
   *
   * @remarks Triggered by any photo not matching other routes, typically used with sessions.
   *
   * @example this.msgPhoto
   * ```typescript
   * async handleFreePhoto() {
   *    this.msgPhoto // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreePhoto?(): Promise<any>

  // video
  /**
   * Route function for videoCaption match intent `this.data.name`
   *
   * @remarks Triggered by video with caption.
   *
   * @example this.data.name = "start" && this.msgVideo
   * ```typescript
   * async handleCaptionVideo() {
   *   this.msgVideo // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionVideo?(): Promise<any>

  /**
   * Route function for `handleCaptionArgsVideo` with arg match intent `this.data.name`
   *
   * @remarks Triggered by video with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa" && this.msgVideo
   * ```typescript
   * async handleCaptionArgsVideo() {
   *   this.msgVideo // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsVideo?(): Promise<any>

  /**
   * Route function for videoCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by video with caption command.
   *
   * @example this.data.name = "/start" && this.msgVideo
   * ```typescript
   * async handleCommandCaptionVideo() {
   *   this.msgVideo // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionVideo?(): Promise<any>

  /**
   * Route function for `handleCommandCaptionArgsVideo` with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by video with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa" && this.msgVideo
   * ```typescript
   * async handleCommandCaptionArgsVideo() {
   *   this.msgVideo // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async handleCommandCaptionArgsVideo?(): Promise<any>

  /**
   * Route handler for free-form video input.
   *
   * @remarks Triggered by any video not matching other routes, typically used with sessions.
   *
   * @example this.msgVideo
   * ```typescript
   * async handleFreeVideo() {
   *    this.msgVideo // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeVideo?(): Promise<any>

  // audio
  /**
   * Route function for audioCaption match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption.
   *
   * @example this.data.name = "start" && this.msgAudio
   * ```typescript
   * async handleCaptionAudio() {
   *   this.msgAudio // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionAudio?(): Promise<any>

  /**
   * Route function for `handleCaptionArgsAudio` with arg match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa" && this.msgAudio
   * ```typescript
   * async handleCaptionArgsAudio() {
   *   this.msgAudio // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsAudio?(): Promise<any>

  /**
   * Route function for `handleCommandCaptionAudio` with slash command match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption command.
   *
   * @example this.data.name = "/start" && this.msgAudio
   * ```typescript
   * async handleCommandCaptionAudio() {
   *   this.msgAudio // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCommandCaptionAudio?(): Promise<any>

  /**
   * Route function for `handleCommandCaptionArgsAudio` with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa" && this.msgAudio
   * ```typescript
   * async handleCommandCaptionArgsAudio() {
   *   this.msgAudio // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCommandCaptionArgsAudio?(): Promise<any>

  /**
   * Route handler for free-form audio input.
   *
   * @remarks Triggered by any audio not matching other routes, typically used with sessions.
   *
   * @example this.msgAudio
   * ```typescript
   * async handleFreeAudio() {
   *    this.msgAudio // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeAudio?(): Promise<any>

  // document
  /**
   * Route function for `handleCaptionDocument` match intent `this.data.name`
   *
   * @remarks Triggered by document with caption.
   *
   * @example this.data.name = "start" && this.msgDocument
   * ```typescript
   * async handleCaptionDocument() {
   *   this.msgDocument // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionDocument?(): Promise<any>

  /**
   * Route function for `handleCaptionArgsDocument` with arg match intent `this.data.name`
   *
   * @remarks Triggered by document with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa" && this.msgDocument
   * ```typescript
   * async handleCaptionArgsDocument() {
   *   this.msgDocument // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsDocument?(): Promise<any>

  /**
   * Route function for `handleCommandCaptionDocument` with slash command match intent `this.data.name`
   *
   * @remarks Triggered by document with caption command.
   *
   * @example this.data.name = "/start" && this.msgDocument
   * ```typescript
   * async handleCommandCaptionDocument() {
   *   this.msgDocument // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionDocument?(): Promise<any>

  /**
   * Route function for `handleCommandCaptionArgsDocument` with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by document with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa"
   * ```typescript
   * async handleCommandCaptionArgsDocument() {
   *   this.msgDocument // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async handleCommandCaptionArgsDocument?(): Promise<any>

  /**
   * Route handler for free-form document input.
   *
   * @remarks Triggered by any document not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeDocument() {
   *    this.msgDocument // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeDocument?(): Promise<any>

  // animation
  /**
   * Route function for animationCaption match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption.
   *
   * @example this.data.name = "start"
   * ```typescript
   * async handleCaptionAnimation() {
   *   this.msgAnimation // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionAnimation?(): Promise<any>

  /**
   * Route function for `handleCaptionArgsAnimation` with arg match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa"
   * ```typescript
   * async handleCaptionArgsAnimation() {
   *   this.msgAnimation // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsAnimation?(): Promise<any>

  /**
   * Route function for animationCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption command.
   *
   * @example this.data.name = "/start"
   * ```typescript
   * async handleCommandCaptionAnimation() {
   *   this.msgAnimation // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionAnimation?(): Promise<any>

  /**
   * Route function for `handleCommandCaptionArgsAnimation` with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa"
   * ```typescript
   * async handleCommandCaptionArgsAnimation() {
   *   this.msgAnimation // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async handleCommandCaptionArgsAnimation?(): Promise<any>

  /**
   * Route handler for free-form animation input.
   *
   * @remarks Triggered by any animation not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeAnimation() {
   *    this.msgAnimation // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeAnimation?(): Promise<any>

  // voice
  /**
   * Route function for voiceCaption match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption.
   *
   * @example this.data.name = "start"
   * ```typescript
   * async handleCaptionVoice() {
   *   this.msgVoice // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionVoice?(): Promise<any>

  /**
   * Route function for `handleCaptionArgsVoice` with arg match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa"
   * ```typescript
   * async handleCaptionArgsVoice() {
   *   this.msgVoice // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsVoice?(): Promise<any>

  /**
   * Route function for voiceCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption command.
   *
   * @example this.data.name = "/start"
   * ```typescript
   * async voiceCommandCaption() {
   *   this.msgVoice // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionVoice?(): Promise<any>

  /**
   * Route function for `handleCommandCaptionArgsVoice` with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa"
   * ```typescript
   * async handleCommandCaptionArgsVoice() {
   *   this.msgVoice // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCommandCaptionArgsVoice?(): Promise<any>

  /**
   * Route handler for free-form voice input.
   *
   * @remarks Triggered by any voice not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeVoice() {
   *    this.msgVoice // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeVoice?(): Promise<any>

  // video_note
  /**
   * Route handler for free-form video note input.
   * @remarks Triggered by any video note not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeVideoNote() {
   *    this.msgVideoNote // {...}
   * }
   * ```
   * @virtual
   * @public
   */
  async handleFreeVideoNote?(): Promise<any>

  // sticker
  /**
   * Route handler for free-form sticker input.
   *
   * @remarks Triggered by any sticker not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeSticker() {
   *    this.msgSticker // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeSticker?(): Promise<any>

  // location
  /**
   * Route handler for free-form location input.
   *
   * @remarks Triggered by any location not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeLocation() {
   *    this.msgLocation // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeLocation?(): Promise<any>

  // contact
  /**
   * Route handler for free-form contact input.
   *
   * @remarks Triggered by any contact not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeContact() {
   *    this.msgContact // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeContact?(): Promise<any>

  // all
  /**
   * Fallback route handler for any unmatched update.
   *
   * @remarks
   * Triggered when no other route handler matches the current update. Use this for
   * global fallback logic or safety responses.
   *
   * @example
   * ```typescript
   * async handleFree() {
   *   // handle unexpected updates
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFree?(): Promise<any>

  // =============== handleSession* route function (session-aware)
  /**
   * Session-aware route handler for callback queries without args.
   *
   * @remarks
   * Mirrors the corresponding `handle*` method. Dispatched automatically by
   * `_pageRoutes` id=1 (session routing) when:
   *   1. The user has an active session (`session.method` is set)
   *   2. `session.method` matches the method key registered for this route
   *      (computed by the corresponding `methodSession*()`)
   *   3. The route name ends with `fromListener` — ensuring only the correct
   *      update type triggers it (callback queries match `*CallbackData` only;
   *      text matches `*Text` only; etc.)
   *
   * Define `handleSession*` to handle session flows separately from normal
   * flows. The regular `handle*` will only be called for non-session flows
   * — manual `isSession*()` checks inside `handle*` are unnecessary because
   * id=1 dispatches before id=2 ever runs.
   *
   * Works with ALL route types: CallbackData, ArgsCallbackData, Text,
   * CommandText, FreeText, CaptionPhoto, etc.
   *
   * @example
   * ```typescript
   * // handle* — invoked via id=2 (static) when no session matches in id=1
   * async handleCallbackData() {
   *   await this.edit(`normal flow: ${this.callbackData}`)
   * }
   *
   * // handleSession* — invoked via id=1 (session) when session.method matches
   * async handleSessionCallbackData() {
   *   const {inputText} = this.temp.session.params
   *   await this.edit(`session-active: ${inputText}`)
   * }
   * ```
   *
   * @example
   * ```typescript
   * async handleArgsCallbackData() {
   *   await this.edit(`normal: ${this.callbackData}`)
   * }
   * async handleSessionArgsCallbackData() {
   *   const {inputText} = this.temp.session.params
   *   await this.edit(`session: ${this.callbackData}, params: ${inputText}`)
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleSessionCallbackData?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionArgsCallbackData?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionText?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionArgsText?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCommandText?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCommandArgsText?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionFreeText?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCaptionPhoto?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCaptionArgsPhoto?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCommandCaptionPhoto?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCommandCaptionArgsPhoto?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionFreePhoto?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCaptionVideo?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCaptionArgsVideo?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCommandCaptionVideo?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCommandCaptionArgsVideo?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionFreeVideo?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCaptionAudio?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCaptionArgsAudio?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCommandCaptionAudio?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCommandCaptionArgsAudio?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionFreeAudio?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCaptionDocument?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCaptionArgsDocument?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCommandCaptionDocument?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCommandCaptionArgsDocument?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionFreeDocument?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCaptionAnimation?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCaptionArgsAnimation?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCommandCaptionAnimation?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCommandCaptionArgsAnimation?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionFreeAnimation?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCaptionVoice?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCaptionArgsVoice?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCommandCaptionVoice?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionCommandCaptionArgsVoice?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionFreeVoice?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionFreeVideoNote?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionFreeSticker?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionFreeLocation?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionFreeContact?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackData} */
  async handleSessionFree?(): Promise<any>

  // callback
  /**
   * Session validation utilities — check whether the active session corresponds
   * to a specific route type.
   *
   * @remarks
   * These are **user-facing helpers** for manual session checks inside a handler.
   * They are NOT used by the routing system — dispatch is handled entirely by
   * `_pageRoutes` id=1 which matches `session.method` against registered keys.
   *
   * Each `isSession*()` compares its own `methodSession*()` result against
   * the current `session.method`. Useful when a single handler needs to branch
   * on the session type, or for defensive checks in `handleFree*` handlers.
   *
   * @example
   * ```typescript
   * async handleFreeText() {
   *   if (this.isSessionFreeText()) {
   *     // Active session of type "freeText" — handle session flow
   *   } else {
   *     // No matching session — handle non-session flow
   *   }
   * }
   * ```
   *
   * @public
   */
  isSessionCallbackData() {
    return this.temp.session.method === this.methodSessionCallbackData()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionArgsCallbackData() {
    return this.temp.session.method === this.methodSessionArgsCallbackData()
  }
  // text
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionText() {
    return this.temp.session.method === this.methodSessionText()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionArgsText() {
    return this.temp.session.method === this.methodSessionArgsText()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandText() {
    return this.temp.session.method === this.methodSessionCommandText()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandArgsText() {
    return this.temp.session.method === this.methodSessionCommandArgsText()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeText() {
    return this.temp.session.method === this.methodSessionFreeText()
  }
  // photo
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionPhoto() {
    return this.temp.session.method === this.methodSessionCaptionPhoto()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionArgsPhoto() {
    return this.temp.session.method === this.methodSessionCaptionArgsPhoto()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionPhoto() {
    return this.temp.session.method === this.methodSessionCommandCaptionPhoto()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionArgsPhoto() {
    return this.temp.session.method === this.methodSessionCommandCaptionArgsPhoto()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreePhoto() {
    return this.temp.session.method === this.methodSessionFreePhoto()
  }
  // video
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionVideo() {
    return this.temp.session.method === this.methodSessionCaptionVideo()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionArgsVideo() {
    return this.temp.session.method === this.methodSessionCaptionArgsVideo()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionVideo() {
    return this.temp.session.method === this.methodSessionCommandCaptionVideo()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionArgsVideo() {
    return this.temp.session.method === this.methodSessionCommandCaptionArgsVideo()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeVideo() {
    return this.temp.session.method === this.methodSessionFreeVideo()
  }
  // audio
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionAudio() {
    return this.temp.session.method === this.methodSessionCaptionAudio()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionArgsAudio() {
    return this.temp.session.method === this.methodSessionCaptionArgsAudio()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionAudio() {
    return this.temp.session.method === this.methodSessionCommandCaptionAudio()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionArgsAudio() {
    return this.temp.session.method === this.methodSessionCommandCaptionArgsAudio()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeAudio() {
    return this.temp.session.method === this.methodSessionFreeAudio()
  }
  // document
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionDocument() {
    return this.temp.session.method === this.methodSessionCaptionDocument()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionArgsDocument() {
    return this.temp.session.method === this.methodSessionCaptionArgsDocument()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionDocument() {
    return this.temp.session.method === this.methodSessionCommandCaptionDocument()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionArgsDocument() {
    return this.temp.session.method === this.methodSessionCommandCaptionArgsDocument()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeDocument() {
    return this.temp.session.method === this.methodSessionFreeDocument()
  }
  // animation
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionAnimation() {
    return this.temp.session.method === this.methodSessionCaptionAnimation()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionArgsAnimation() {
    return this.temp.session.method === this.methodSessionCaptionArgsAnimation()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionAnimation() {
    return this.temp.session.method === this.methodSessionCommandCaptionAnimation()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionArgsAnimation() {
    return this.temp.session.method === this.methodSessionCommandCaptionArgsAnimation()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeAnimation() {
    return this.temp.session.method === this.methodSessionFreeAnimation()
  }
  // voice
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionVoice() {
    return this.temp.session.method === this.methodSessionCaptionVoice()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionArgsVoice() {
    return this.temp.session.method === this.methodSessionCaptionArgsVoice()
  }
  isSessionCommandCaptionVoice() {
    return this.temp.session.method === this.methodSessionCommandCaptionVoice()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionArgsVoice() {
    return this.temp.session.method === this.methodSessionCommandCaptionArgsVoice()
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeVoice() {
    return this.temp.session.method === this.methodSessionFreeVoice()
  }
  // video note
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeVideoNote() {
    return this.temp.session.method === this.methodSessionFreeVideoNote()
  }
  // sticker
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeSticker() {
    return this.temp.session.method === this.methodSessionFreeSticker()
  }
  // location
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeLocation() {
    return this.temp.session.method === this.methodSessionFreeLocation()
  }
  // contact
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeContact() {
    return this.temp.session.method === this.methodSessionFreeContact()
  }

  // callback
  /**
   * Session set helper methods.
   *
   * @remarks
   * These methods are shortcuts for {@link Ctx.setSession} with pre-built method names.
   * Each `session*` method sets the session for the corresponding route handler.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   // Set session input for `handleFreeText`
   *   await this.setSessionFreeText({data: "12345"})
   *   await this.reply()
   * }
   * ```
   *
   * @public
   */
  setSessionCallbackData(params?: any) {
    return this.setSession(this.methodSessionCallbackData(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionArgsCallbackData(params?: any) {
    return this.setSession(this.methodSessionArgsCallbackData(), params)
  }
  // text
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionText(params?: any) {
    return this.setSession(this.methodSessionText(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionArgsText(params?: any) {
    return this.setSession(this.methodSessionArgsText(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCommandText(params?: any) {
    return this.setSession(this.methodSessionCommandText(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCommandArgsText(params?: any) {
    return this.setSession(this.methodSessionCommandArgsText(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionFreeText(params?: any) {
    return this.setSession(this.methodSessionFreeText(), params)
  }
  // photo
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCaptionPhoto(params?: any) {
    return this.setSession(this.methodSessionCaptionPhoto(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCaptionArgsPhoto(params?: any) {
    return this.setSession(this.methodSessionCaptionArgsPhoto(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCommandCaptionPhoto(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionPhoto(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCommandCaptionArgsPhoto(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionArgsPhoto(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionFreePhoto(params?: any) {
    return this.setSession(this.methodSessionFreePhoto(), params)
  }
  // video
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCaptionVideo(params?: any) {
    return this.setSession(this.methodSessionCaptionVideo(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCaptionArgsVideo(params?: any) {
    return this.setSession(this.methodSessionCaptionArgsVideo(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCommandCaptionVideo(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionVideo(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCommandCaptionArgsVideo(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionArgsVideo(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionFreeVideo(params?: any) {
    return this.setSession(this.methodSessionFreeVideo(), params)
  }
  // audio
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCaptionAudio(params?: any) {
    return this.setSession(this.methodSessionCaptionAudio(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCaptionArgsAudio(params?: any) {
    return this.setSession(this.methodSessionCaptionArgsAudio(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCommandCaptionAudio(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionAudio(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCommandCaptionArgsAudio(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionArgsAudio(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionFreeAudio(params?: any) {
    return this.setSession(this.methodSessionFreeAudio(), params)
  }
  // document
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCaptionDocument(params?: any) {
    return this.setSession(this.methodSessionCaptionDocument(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCaptionArgsDocument(params?: any) {
    return this.setSession(this.methodSessionCaptionArgsDocument(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCommandCaptionDocument(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionDocument(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCommandCaptionArgsDocument(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionArgsDocument(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionFreeDocument(params?: any) {
    return this.setSession(this.methodSessionFreeDocument(), params)
  }
  // animation
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCaptionAnimation(params?: any) {
    return this.setSession(this.methodSessionCaptionAnimation(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCaptionArgsAnimation(params?: any) {
    return this.setSession(this.methodSessionCaptionArgsAnimation(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCommandCaptionAnimation(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionAnimation(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCommandCaptionArgsAnimation(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionArgsAnimation(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionFreeAnimation(params?: any) {
    return this.setSession(this.methodSessionFreeAnimation(), params)
  }
  // voice
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCaptionVoice(params?: any) {
    return this.setSession(this.methodSessionCaptionVoice(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCaptionArgsVoice(params?: any) {
    return this.setSession(this.methodSessionCaptionArgsVoice(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCommandCaptionVoice(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionVoice(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionCommandCaptionArgsVoice(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionArgsVoice(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionFreeVoice(params?: any) {
    return this.setSession(this.methodSessionFreeVoice(), params)
  }
  // video note
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionFreeVideoNote(params?: any) {
    return this.setSession(this.methodSessionFreeVideoNote(), params)
  }
  // sticker
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionFreeSticker(params?: any) {
    return this.setSession(this.methodSessionFreeSticker(), params)
  }
  // location
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionFreeLocation(params?: any) {
    return this.setSession(this.methodSessionFreeLocation(), params)
  }
  // contact
  /** {@inheritDoc Ctx.setSessionCallbackData} */
  setSessionFreeContact(params?: any) {
    return this.setSession(this.methodSessionFreeContact(), params)
  }

  /**
   * Session method name builders.
   *
   * @remarks
   * These methods generate unique session method identifiers used by
   * {@link Ctx.setSession} and validation methods. Each `methodSession*`
   * returns a prefixed string like `"1-PageName"`.
   *
   * @public
   */
  methodSession(prefix: string, name: string | undefined) {
    return `${prefix}-${name || this.data.name}`
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCallbackData(name?: string) {
    return this.methodSession(`1`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionArgsCallbackData(name?: string) {
    return this.methodSession(`2`, name)
  }
  // text method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionText(name?: string) {
    return this.methodSession(`3`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionArgsText(name?: string) {
    return this.methodSession(`4`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandText(name?: string) {
    return this.methodSession(`5`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandArgsText(name?: string) {
    return this.methodSession(`6`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeText(name?: string) {
    return this.methodSession(`7`, name)
  }
  // photo method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionPhoto(name?: string) {
    return this.methodSession(`8`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsPhoto(name?: string) {
    return this.methodSession(`9`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionPhoto(name?: string) {
    return this.methodSession(`10`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsPhoto(name?: string) {
    return this.methodSession(`11`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreePhoto(name?: string) {
    return this.methodSession(`12`, name)
  }
  // video method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionVideo(name?: string) {
    return this.methodSession(`13`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsVideo(name?: string) {
    return this.methodSession(`14`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionVideo(name?: string) {
    return this.methodSession(`15`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsVideo(name?: string) {
    return this.methodSession(`16`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeVideo(name?: string) {
    return this.methodSession(`17`, name)
  }
  // audio method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionAudio(name?: string) {
    return this.methodSession(`18`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsAudio(name?: string) {
    return this.methodSession(`19`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionAudio(name?: string) {
    return this.methodSession(`20`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsAudio(name?: string) {
    return this.methodSession(`21`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeAudio(name?: string) {
    return this.methodSession(`22`, name)
  }
  // document method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionDocument(name?: string) {
    return this.methodSession(`23`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsDocument(name?: string) {
    return this.methodSession(`24`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionDocument(name?: string) {
    return this.methodSession(`25`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsDocument(name?: string) {
    return this.methodSession(`26`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeDocument(name?: string) {
    return this.methodSession(`27`, name)
  }
  // animation method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionAnimation(name?: string) {
    return this.methodSession(`28`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsAnimation(name?: string) {
    return this.methodSession(`29`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionAnimation(name?: string) {
    return this.methodSession(`30`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsAnimation(name?: string) {
    return this.methodSession(`31`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeAnimation(name?: string) {
    return this.methodSession(`32`, name)
  }
  // voice method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionVoice(name?: string) {
    return this.methodSession(`33`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsVoice(name?: string) {
    return this.methodSession(`34`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionVoice(name?: string) {
    return this.methodSession(`35`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsVoice(name?: string) {
    return this.methodSession(`36`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeVoice(name?: string) {
    return this.methodSession(`37`, name)
  }
  // video note method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeVideoNote(name?: string) {
    return this.methodSession(`38`, name)
  }
  // sticker method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeSticker(name?: string) {
    return this.methodSession(`39`, name)
  }
  // location method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeLocation(name?: string) {
    return this.methodSession(`40`, name)
  }
  // contact method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeContact(name?: string) {
    return this.methodSession(`41`, name)
  }
}
